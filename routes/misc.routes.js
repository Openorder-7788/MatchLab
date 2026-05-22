const { health, getThemes, getThemeQuestions } = require("../controllers/theme.controller");
const { validateThemeKey } = require("../utils/helpers");

function registerMiscRoutes(app, pool, THEMES) {
  app.get("/api/health", async () => health(pool));

  app.get("/api/themes", async () => getThemes(THEMES));

  app.get("/api/themes/:themeKey/questions", async (req, reply) => {
    const themeKey = validateThemeKey(req.params.themeKey, THEMES);
    if (!themeKey) return reply.code(404).send({ error: "theme_not_found" });
    return getThemeQuestions(pool, themeKey);
  });
}

module.exports = { registerMiscRoutes };
