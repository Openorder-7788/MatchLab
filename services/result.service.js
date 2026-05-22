const { parseJsonSafe, mysqlDateToIso } = require("../utils/helpers");
const { computePairResult, computeRoomAggregate } = require("./match.service");

const DIMENSION_LABELS = {
  life: "Lifestyle Sync",
  emotion: "Emotional Fit",
  fun: "Playfulness Chemistry"
};

async function computeAndPersistRoomResults(pool, room) {
  const { getHostParticipant, getGuestParticipants, getAnswerSet, getQuestionsForRoom } = require("./room.service");
  const roomId = room.id;
  const host = await getHostParticipant(pool, roomId);
  if (!host) return { ready: false };
  const hostAnsRow = await getAnswerSet(pool, roomId, host.id);
  if (!hostAnsRow) return { ready: false };

  const questionIds = parseJsonSafe(room.question_ids_json, []);
  const questions = await getQuestionsForRoom(pool, room.theme_key, questionIds);
  const hostAnswers = parseJsonSafe(hostAnsRow.answers_json, []);

  const guests = await getGuestParticipants(pool, roomId);
  const perGuest = [];
  for (const g of guests) {
    const gAnsRow = await getAnswerSet(pool, roomId, g.id);
    if (!gAnsRow) continue;
    const guestAnswers = parseJsonSafe(gAnsRow.answers_json, []);
    const pair = computePairResult(questions, hostAnswers, guestAnswers, DIMENSION_LABELS);
    perGuest.push({ guestParticipantId: g.id, guestNickname: g.nickname, pair });
  }

  if (perGuest.length === 0) return { ready: false };

  const overall = computeRoomAggregate(perGuest.map((x) => x.pair), DIMENSION_LABELS);
  const computedAt = new Date();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO room_results(room_id, result_json, computed_at) VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE result_json = VALUES(result_json), computed_at = VALUES(computed_at)",
      [roomId, JSON.stringify(overall), computedAt]
    );
    for (const x of perGuest) {
      await conn.query(
        "INSERT INTO pair_results(room_id, guest_participant_id, result_json, match_index, computed_at) VALUES(?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE result_json = VALUES(result_json), match_index = VALUES(match_index), computed_at = VALUES(computed_at)",
        [roomId, x.guestParticipantId, JSON.stringify(x.pair), x.pair.matchIndex, computedAt]
      );
    }
    await conn.query("UPDATE rooms SET updated_at = ? WHERE id = ?", [computedAt, roomId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return { ready: true, overall, perGuest };
}

module.exports = {
  DIMENSION_LABELS,
  computeAndPersistRoomResults
};
