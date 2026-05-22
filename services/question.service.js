const { parseJsonSafe } = require("../utils/helpers");

async function getQuestionsByTheme(pool, themeKey) {
  const [rows] = await pool.query(
    "SELECT question_id, prompt, options_json, dimension, type FROM questions WHERE theme_key = ? AND is_active = 1 ORDER BY question_id ASC",
    [themeKey]
  );
  return (rows || []).map((r) => ({
    id: r.question_id,
    question: r.prompt,
    options: parseJsonSafe(r.options_json, []),
    dimension: r.dimension,
    type: r.type
  }));
}

async function getActiveQuestionIds(pool, themeKey) {
  const [qRows] = await pool.query("SELECT question_id FROM questions WHERE theme_key = ? AND is_active = 1", [themeKey]);
  return (qRows || []).map((r) => r.question_id);
}

module.exports = {
  getQuestionsByTheme,
  getActiveQuestionIds
};
