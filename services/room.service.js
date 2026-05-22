const { parseJsonSafe, mysqlDateToIso } = require("../utils/helpers");

async function getRoomByCode(pool, code) {
  const [rows] = await pool.query("SELECT * FROM rooms WHERE code = ? AND deleted_at IS NULL LIMIT 1", [code]);
  return rows?.[0] || null;
}

async function getRoomByShareId(pool, shareId) {
  const [rows] = await pool.query("SELECT * FROM rooms WHERE share_id = ? AND deleted_at IS NULL LIMIT 1", [shareId]);
  return rows?.[0] || null;
}

async function getHostParticipant(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT * FROM participants WHERE room_id = ? AND role = 'host' AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1",
    [roomId]
  );
  return rows?.[0] || null;
}

async function getGuestParticipants(pool, roomId) {
  const [rows] = await pool.query(
    "SELECT * FROM participants WHERE room_id = ? AND role = 'guest' AND deleted_at IS NULL ORDER BY created_at ASC",
    [roomId]
  );
  return rows || [];
}

async function getAnswerSet(pool, roomId, participantId) {
  const [rows] = await pool.query(
    "SELECT * FROM answer_sets WHERE room_id = ? AND participant_id = ? LIMIT 1",
    [roomId, participantId]
  );
  return rows?.[0] || null;
}

async function getQuestionsForRoom(pool, themeKey, questionIds) {
  const out = [];
  for (const qid of questionIds) {
    const [rows] = await pool.query(
      "SELECT question_id, prompt, options_json, dimension, type, scores_json FROM questions WHERE theme_key = ? AND question_id = ? AND is_active = 1 LIMIT 1",
      [themeKey, qid]
    );
    const row = rows?.[0];
    if (!row) continue;
    out.push({
      id: row.question_id,
      prompt: row.prompt,
      options: parseJsonSafe(row.options_json, []),
      dimension: row.dimension,
      type: row.type,
      scores: parseJsonSafe(row.scores_json, [])
    });
  }
  return out;
}

async function getRoomStatus(pool, room) {
  const { isPast } = require("../utils/helpers");
  const roomId = room.id;
  const host = await getHostParticipant(pool, roomId);
  const hostAnswered = Boolean(host && await getAnswerSet(pool, roomId, host.id));
  const guests = await getGuestParticipants(pool, roomId);
  let guestAnsweredCount = 0;
  for (const g of guests) {
    if (await getAnswerSet(pool, roomId, g.id)) guestAnsweredCount += 1;
  }
  const ready = hostAnswered && guestAnsweredCount > 0;
  const [rr] = await pool.query("SELECT computed_at FROM room_results WHERE room_id = ? LIMIT 1", [roomId]);
  return {
    code: room.code,
    roomName: room.room_name || null,
    shareId: room.share_id,
    themeKey: room.theme_key,
    status: room.status,
    createdAt: mysqlDateToIso(room.created_at),
    updatedAt: mysqlDateToIso(room.updated_at),
    expiresAt: mysqlDateToIso(room.expires_at),
    inviteExpired: isPast(room.expires_at),
    host: host ? { nickname: host.nickname, answered: hostAnswered } : null,
    guestLimit: require("../config").GUEST_LIMIT,
    guests: { total: guests.length, answered: guestAnsweredCount },
    ready,
    lastComputedAt: rr?.[0]?.computed_at ? mysqlDateToIso(rr[0].computed_at) : null
  };
}

module.exports = {
  getRoomByCode,
  getRoomByShareId,
  getHostParticipant,
  getGuestParticipants,
  getAnswerSet,
  getQuestionsForRoom,
  getRoomStatus
};
