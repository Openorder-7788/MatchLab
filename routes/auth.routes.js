const { handleSendCode, handleLoginWithEmail, handleRegister, handleLoginWithPassword, handleEvmChallenge, handleLoginWithEvm, handleVerifyAccessToken, handleGetMe } = require("../controllers/auth.controller");

function registerAuthRoutes(app, pool) {
  app.post("/api/auth/send-code", async (req, reply) => {
    const result = await handleSendCode(pool, req.body);
    return reply.code(result.status).send(result.data);
  });

  app.post("/api/auth/login/email", async (req, reply) => {
    const result = await handleLoginWithEmail(pool, req.body);
    return reply.code(result.status).send(result.data);
  });

  app.post("/api/auth/register", async (req, reply) => {
    const result = await handleRegister(pool, req.body);
    return reply.code(result.status).send(result.data);
  });

  app.post("/api/auth/login/password", async (req, reply) => {
    const result = await handleLoginWithPassword(pool, req.body);
    return reply.code(result.status).send(result.data);
  });

  app.post("/api/auth/evm/challenge", async (req, reply) => {
    const result = await handleEvmChallenge(pool, req.body);
    return reply.code(result.status).send(result.data);
  });

  app.post("/api/auth/login/evm", async (req, reply) => {
    const result = await handleLoginWithEvm(pool, req.body);
    return reply.code(result.status).send(result.data);
  });

  app.post("/api/auth/verify-token", async (req, reply) => {
    const result = await handleVerifyAccessToken(pool, req.body);
    return reply.code(result.status).send(result.data);
  });

  app.get("/api/auth/me", async (req, reply) => {
    const sessionToken = String(req.headers["x-session-token"] || req.query?.sessionToken || "").trim();
    if (!sessionToken || !sessionToken.startsWith("smu_")) return reply.code(401).send({ error: "unauthorized" });
    const userId = sessionToken.split("_")[1];
    if (!userId) return reply.code(401).send({ error: "unauthorized" });
    const result = await handleGetMe(pool, userId);
    return reply.code(result.status).send(result.data);
  });
}

module.exports = { registerAuthRoutes };
