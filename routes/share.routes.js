const { getShareResult } = require("../controllers/share.controller");
const { requireParticipant } = require("../middleware/auth");

function registerShareRoutes(app, pool) {
  app.get("/api/share/:shareId/result", async (req, reply) => {
    const shareId = String(req.params.shareId || "").trim();
    const { participant } = await requireParticipant(pool, req);
    const result = await getShareResult(pool, shareId, participant);
    return reply.code(result.status).send(result.data);
  });
}

module.exports = { registerShareRoutes };
