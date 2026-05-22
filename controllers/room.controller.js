const { randomUUID } = require("crypto");
const { ensureClient, makeParticipantToken, hashToken } = require("../db/pool");
const { parseJsonSafe, validateNickname, validateThemeKey, validateAnswers, shuffleInPlace, makeRoomCode, addDays, isPast, mysqlDateToIso } = require("../utils/helpers");
const { getRoomByCode, getHostParticipant, getGuestParticipants, getAnswerSet, getRoomStatus } = require("../services/room.service");
const { getActiveQuestionIds } = require("../services/question.service");
const { computeAndPersistRoomResults } = require("../services/result.service");
const { INVITE_EXPIRE_DAYS, GUEST_LIMIT } = require("../config");

async function createRoom(pool, THEMES, body, clientIdHeader, userId) {
  const clientId = await ensureClient(pool, clientIdHeader);
  const themeKey = validateThemeKey(body?.themeKey, THEMES);
  const nickname = validateNickname(body?.nickname) || "Nova";
  const roomName = String(body?.roomName || "").trim().slice(0, 64) || null;
  if (!themeKey) return { status: 400, data: { error: "invalid_theme" } };

  const activeQuestions = await getActiveQuestionIds(pool, themeKey);
  if (activeQuestions.length === 0) return { status: 500, data: { error: "no_questions" } };

  const desiredCount = 12;
  const picked = shuffleInPlace(activeQuestions.slice()).slice(0, Math.min(desiredCount, activeQuestions.length));

  let code = "";
  for (let i = 0; i < 40; i++) {
    const candidate = makeRoomCode();
    const [existsRows] = await pool.query("SELECT 1 FROM rooms WHERE code = ? LIMIT 1", [candidate]);
    if (!existsRows || existsRows.length === 0) { code = candidate; break; }
  }
  if (!code) return { status: 500, data: { error: "cannot_allocate_code" } };

  const roomId = randomUUID();
  const shareId = randomUUID();
  const createdAt = new Date();
  const expiresAt = addDays(INVITE_EXPIRE_DAYS);
  const token = makeParticipantToken();
  const tokenHash = hashToken(token);
  const participantId = randomUUID();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO rooms(id, code, room_name, theme_key, question_ids_json, share_id, created_client_id, user_id, status, created_at, updated_at, expires_at, deleted_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
      [roomId, code, roomName, themeKey, JSON.stringify(picked), shareId, clientId, userId || null, "created", createdAt, createdAt, expiresAt]
    );
    await conn.query(
      "INSERT INTO participants(id, room_id, role, client_id, nickname, token_hash, created_at, deleted_at) VALUES(?, ?, 'host', ?, ?, ?, ?, NULL)",
      [participantId, roomId, clientId, nickname, tokenHash, createdAt]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return {
    status: 201,
    data: {
      clientId,
      code,
      roomName,
      shareId,
      themeKey,
      questionIds: picked,
      role: "host",
      participantId,
      participantToken: token,
      expiresAt: expiresAt.toISOString()
    }
  };
}

async function joinRoom(pool, code, body, clientIdHeader) {
  const clientId = await ensureClient(pool, clientIdHeader);
  const nickname = validateNickname(body?.nickname) || "Echo";
  const room = await getRoomByCode(pool, code);
  if (!room) return { status: 404, data: { error: "room_not_found" } };
  if (isPast(room.expires_at)) return { status: 410, data: { error: "invite_expired", shareId: room.share_id } };

  const [cntRows] = await pool.query(
    "SELECT COUNT(1) AS c FROM participants WHERE room_id = ? AND role = 'guest' AND deleted_at IS NULL",
    [room.id]
  );
  const guestCount = Number(cntRows?.[0]?.c || 0);
  if (guestCount >= GUEST_LIMIT) return { status: 409, data: { error: "guest_limit_reached" } };

  const token = makeParticipantToken();
  const tokenHash = hashToken(token);
  const participantId = randomUUID();
  const createdAt = new Date();

  await pool.query(
    "INSERT INTO participants(id, room_id, role, client_id, nickname, token_hash, created_at, deleted_at) VALUES(?, ?, 'guest', ?, ?, ?, ?, NULL)",
    [participantId, room.id, clientId, nickname, tokenHash, createdAt]
  );

  return {
    status: 201,
    data: {
      clientId,
      code: room.code,
      shareId: room.share_id,
      themeKey: room.theme_key,
      questionIds: parseJsonSafe(room.question_ids_json, []),
      role: "guest",
      participantId,
      participantToken: token,
      expiresAt: mysqlDateToIso(room.expires_at)
    }
  };
}

async function getRoom(pool, code) {
  const room = await getRoomByCode(pool, code);
  if (!room) return { status: 404, data: { error: "room_not_found" } };
  const status = await getRoomStatus(pool, room);
  return { status: 200, data: status };
}

async function submitAnswers(pool, hub, code, participant, body) {
  let room = await getRoomByCode(pool, code);
  if (!room) return { status: 404, data: { error: "room_not_found" } };
  if (participant.room_id !== room.id) return { status: 403, data: { error: "wrong_room" } };

  const questionIds = parseJsonSafe(room.question_ids_json, []);
  const answers = body?.answers;
  const v = validateAnswers(answers, questionIds.length);
  if (!v.ok) return { status: 400, data: { error: "invalid_answers", reason: v.reason } };

  const submittedAt = new Date();
  await pool.query(
    "INSERT INTO answer_sets(participant_id, room_id, answers_json, submitted_at) VALUES(?, ?, ?, ?) ON DUPLICATE KEY UPDATE answers_json = VALUES(answers_json), submitted_at = VALUES(submitted_at)",
    [participant.id, room.id, JSON.stringify(answers), submittedAt]
  );

  const host = await getHostParticipant(pool, room.id);
  const hostAnswered = Boolean(host && await getAnswerSet(pool, room.id, host.id));
  const guests = await getGuestParticipants(pool, room.id);
  let guestAnsweredCount = 0;
  for (const g of guests) {
    if (await getAnswerSet(pool, room.id, g.id)) guestAnsweredCount += 1;
  }

  const nextStatus =
    hostAnswered && guestAnsweredCount > 0 ? "completed" :
    hostAnswered ? "host_done" :
    guestAnsweredCount > 0 ? "guest_done" :
    "created";

  await pool.query("UPDATE rooms SET status = ?, updated_at = ? WHERE id = ?", [nextStatus, submittedAt, room.id]);
  room = await getRoomByCode(pool, code);

  const roomStatus = await getRoomStatus(pool, room);
  if (roomStatus.ready) {
    const computed = await computeAndPersistRoomResults(pool, room);
    if (computed.ready) hub.send(room.id, "result_updated", { roomCode: room.code, shareId: room.share_id, updatedAt: new Date().toISOString() });
  } else {
    hub.send(room.id, "room_updated", { roomCode: room.code, shareId: room.share_id, updatedAt: new Date().toISOString() });
  }

  return { status: 200, data: { ok: true, room: roomStatus } };
}

async function getRoomResult(pool, code, participant) {
  const room = await getRoomByCode(pool, code);
  if (!room) return { status: 404, data: { error: "room_not_found" } };
  if (participant.room_id !== room.id) return { status: 403, data: { error: "wrong_room" } };

  const status = await getRoomStatus(pool, room);
  if (!status.ready) return { status: 409, data: { error: "result_not_ready", room: status } };

  const host = await getHostParticipant(pool, room.id);
  const [overallRows] = await pool.query("SELECT result_json, computed_at FROM room_results WHERE room_id = ? LIMIT 1", [room.id]);
  let overall = overallRows?.[0]?.result_json ? parseJsonSafe(overallRows[0].result_json, null) : null;
  if (!overall) {
    const computed = await computeAndPersistRoomResults(pool, room);
    if (!computed.ready) return { status: 409, data: { error: "result_not_ready", room: status } };
    const [overallRows2] = await pool.query("SELECT result_json, computed_at FROM room_results WHERE room_id = ? LIMIT 1", [room.id]);
    overall = overallRows2?.[0]?.result_json ? parseJsonSafe(overallRows2[0].result_json, null) : null;
  }

  if (participant.role === "host") {
    const guests = await getGuestParticipants(pool, room.id);
    const perGuest = [];
    for (const g of guests) {
      const [prRows] = await pool.query(
        "SELECT result_json, computed_at FROM pair_results WHERE room_id = ? AND guest_participant_id = ? LIMIT 1",
        [room.id, g.id]
      );
      const pr = prRows?.[0];
      if (!pr) continue;
      perGuest.push({
        guestNickname: g.nickname,
        guestParticipantId: g.id,
        computedAt: mysqlDateToIso(pr.computed_at),
        result: parseJsonSafe(pr.result_json, null)
      });
    }
    return { status: 200, data: { role: "host", shareId: room.share_id, overall, perGuest } };
  }

  const [prRows] = await pool.query(
    "SELECT result_json, computed_at FROM pair_results WHERE room_id = ? AND guest_participant_id = ? LIMIT 1",
    [room.id, participant.id]
  );
  const pr = prRows?.[0];
  return {
    status: 200,
    data: {
      role: "guest",
      shareId: room.share_id,
      hostNickname: host ? host.nickname : null,
      guestNickname: participant.nickname,
      overall,
      self: pr ? { computedAt: mysqlDateToIso(pr.computed_at), result: parseJsonSafe(pr.result_json, null) } : null
    }
  };
}

async function listMyRooms(pool, clientId) {
  if (!clientId) return { created: [], invited: [] };

  const [createdRows] = await pool.query(
    "SELECT r.code, r.share_id, r.theme_key, r.status, r.expires_at FROM rooms r WHERE r.created_client_id = ? AND r.deleted_at IS NULL ORDER BY r.created_at DESC",
    [clientId]
  );

  const [invitedRows] = await pool.query(
    "SELECT p.id AS participant_id, p.nickname AS participant_nickname, p.role AS participant_role, r.code, r.share_id, r.theme_key, r.status, r.expires_at, r.room_name FROM participants p JOIN rooms r ON r.id = p.room_id WHERE p.client_id = ? AND p.role = 'guest' AND p.deleted_at IS NULL AND r.deleted_at IS NULL ORDER BY p.created_at DESC",
    [clientId]
  );

  const created = [];
  for (const r of createdRows) {
    const room = await getRoomByCode(pool, r.code);
    if (!room) continue;
    const s = await getRoomStatus(pool, room);
    const host = await getHostParticipant(pool, room.id);
    created.push({ ...s, role: "host", participantId: host?.id || null, participantNickname: host?.nickname || null, roomName: room.room_name || null });
  }

  const invited = [];
  for (const r of invitedRows) {
    const room = await getRoomByCode(pool, r.code);
    if (!room) continue;
    const s = await getRoomStatus(pool, room);
    invited.push({
      ...s,
      role: "guest",
      participantId: r.participant_id,
      participantNickname: r.participant_nickname,
      roomName: room.room_name || null
    });
  }

  return { created, invited };
}

async function deleteRoomAsHost(pool, code, participant) {
  const room = await getRoomByCode(pool, code);
  if (!room) return { status: 404, data: { error: "room_not_found" } };
  if (participant.room_id !== room.id) return { status: 403, data: { error: "wrong_room" } };
  if (participant.role !== "host") return { status: 403, data: { error: "not_host" } };
  await pool.query("UPDATE rooms SET deleted_at = ? WHERE id = ?", [new Date(), room.id]);
  return { status: 200, data: { ok: true } };
}

async function leaveRoomAsGuest(pool, code, participant) {
  const room = await getRoomByCode(pool, code);
  if (!room) return { status: 404, data: { error: "room_not_found" } };
  if (participant.room_id !== room.id) return { status: 403, data: { error: "wrong_room" } };
  if (participant.role !== "guest") return { status: 403, data: { error: "not_guest" } };
  await pool.query("UPDATE participants SET deleted_at = ? WHERE id = ?", [new Date(), participant.id]);
  return { status: 200, data: { ok: true } };
}

async function updateRoomName(pool, code, participant, body) {
  const room = await getRoomByCode(pool, code);
  if (!room) return { status: 404, data: { error: "room_not_found" } };
  if (participant.room_id !== room.id) return { status: 403, data: { error: "wrong_room" } };
  if (participant.role !== "host") return { status: 403, data: { error: "not_host" } };
  const roomName = String(body?.roomName || "").trim().slice(0, 64);
  await pool.query("UPDATE rooms SET room_name = ?, updated_at = ? WHERE id = ?", [roomName || null, new Date(), room.id]);
  return { status: 200, data: { ok: true, roomName: roomName || null } };
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  submitAnswers,
  getRoomResult,
  listMyRooms,
  deleteRoomAsHost,
  leaveRoomAsGuest,
  updateRoomName
};
