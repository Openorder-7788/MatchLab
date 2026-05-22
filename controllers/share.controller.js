const { parseJsonSafe, mysqlDateToIso } = require("../utils/helpers");
const { getRoomByShareId, getHostParticipant, getGuestParticipants, getAnswerSet, getRoomStatus } = require("../services/room.service");
const { computeAndPersistRoomResults } = require("../services/result.service");

async function getShareResult(pool, shareId, participant) {
  const room = await getRoomByShareId(pool, shareId);
  if (!room) return { status: 404, data: { error: "share_not_found" } };

  if (participant && participant.room_id === room.id) {
    const status = await getRoomStatus(pool, room);
    if (!status.ready) return { status: 409, data: { error: "result_not_ready", room: status } };

    const host = await getHostParticipant(pool, room.id);
    const [overallRows] = await pool.query("SELECT result_json, computed_at FROM room_results WHERE room_id = ? LIMIT 1", [room.id]);
    let overall = overallRows?.[0]?.result_json ? parseJsonSafe(overallRows[0].result_json, null) : null;
    if (!overall) {
      const computed = await computeAndPersistRoomResults(pool, room);
      if (!computed.ready) return { status: 409, data: { error: "result_not_ready", room: status } };
      const [overallRows2] = await pool.query("SELECT result_json FROM room_results WHERE room_id = ? LIMIT 1", [room.id]);
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

  const [overallRows] = await pool.query("SELECT result_json, computed_at FROM room_results WHERE room_id = ? LIMIT 1", [room.id]);
  const overall = overallRows?.[0]?.result_json ? parseJsonSafe(overallRows[0].result_json, null) : null;
  if (!overall) return { status: 409, data: { error: "result_not_ready" } };

  return {
    status: 200,
    data: {
      shareId: room.share_id,
      themeKey: room.theme_key,
      updatedAt: mysqlDateToIso(overallRows[0].computed_at),
      overall
    }
  };
}

module.exports = { getShareResult };
