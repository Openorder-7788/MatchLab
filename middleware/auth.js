function getToken(req) {
  const raw = String(req.headers.authorization || "");
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (m && m[1]) return m[1].trim();
  const q = String(req.query?.token || "").trim();
  return q || "";
}

async function requireParticipant(pool, req) {
  const token = getToken(req);
  if (!token) return { participant: null, token: "" };
  const { hashToken } = require("../db/pool");
  const h = hashToken(token);
  const [rows] = await pool.query(
    "SELECT * FROM participants WHERE token_hash = ? AND deleted_at IS NULL LIMIT 1",
    [h]
  );
  return { participant: rows?.[0] || null, token };
}

module.exports = {
  getToken,
  requireParticipant
};
