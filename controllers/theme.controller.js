const { getQuestionsByTheme } = require("../services/question.service");

async function health(pool) {
  let dbOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch {}
  return { ok: true, db: dbOk };
}

async function getThemes(THEMES) {
  return { themes: THEMES };
}

async function getThemeQuestions(pool, themeKey) {
  const questions = await getQuestionsByTheme(pool, themeKey);
  return { themeKey, questions };
}

module.exports = {
  health,
  getThemes,
  getThemeQuestions
};
