const { handleValidationKey } = require("../controllers/testController");

function registerTestRoutes(app) {
  app.get("/validation-key.txt", async (req, reply) => {
    const result = await handleValidationKey();
    return reply.code(result.status).type("text/plain").send(result.data);
  });
}

module.exports = { registerTestRoutes };
