const { createRoom, joinRoom, getRoom, submitAnswers, getRoomResult, listMyRooms, deleteRoomAsHost, leaveRoomAsGuest, updateRoomName } = require("../controllers/room.controller");
const { requireParticipant } = require("../middleware/auth");
const { getRoomStatus } = require("../services/room.service");
const { getRoomByCode } = require("../services/room.service");

function registerRoomRoutes(app, pool, hub, THEMES) {
  app.post("/api/rooms", async (req, reply) => {
    const sessionToken = String(req.headers["x-session-token"] || "").trim();
    let userId = null;
    if (sessionToken.startsWith("smu_")) {
      userId = sessionToken.split("_")[1] || null;
    }
    const result = await createRoom(pool, THEMES, req.body, req.headers["x-client-id"], userId);
    return reply.code(result.status).send(result.data);
  });

  app.post("/api/rooms/:code/join", async (req, reply) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const result = await joinRoom(pool, code, req.body, req.headers["x-client-id"]);
    return reply.code(result.status).send(result.data);
  });

  app.get("/api/rooms/:code", async (req, reply) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const result = await getRoom(pool, code);
    return reply.code(result.status).send(result.data);
  });

  app.post("/api/rooms/:code/answers", async (req, reply) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const { participant } = await requireParticipant(pool, req);
    if (!participant) return reply.code(401).send({ error: "unauthorized" });
    const result = await submitAnswers(pool, hub, code, participant, req.body);
    return reply.code(result.status).send(result.data);
  });

  app.get("/api/rooms/:code/result", async (req, reply) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const { participant } = await requireParticipant(pool, req);
    if (!participant) return reply.code(401).send({ error: "unauthorized" });
    const result = await getRoomResult(pool, code, participant);
    return reply.code(result.status).send(result.data);
  });

  app.get("/api/rooms/:code/events", async (req, reply) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const { participant } = await requireParticipant(pool, req);
    if (!participant) return reply.code(401).send({ error: "unauthorized" });
    const room = await getRoomByCode(pool, code);
    if (!room) return reply.code(404).send({ error: "room_not_found" });
    if (participant.room_id !== room.id) return reply.code(403).send({ error: "wrong_room" });

    reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders?.();

    const initial = await getRoomStatus(pool, room);
    reply.raw.write(`event: room_snapshot\ndata: ${JSON.stringify(initial)}\n\n`);
    hub.add(room.id, reply);

    req.raw.on("close", () => {
      hub.remove(room.id, reply);
    });

    return reply;
  });

  app.get("/api/my/rooms", async (req, reply) => {
    const clientId = String(req.headers["x-client-id"] || "").trim();
    const data = await listMyRooms(pool, clientId);
    return reply.code(200).send(data);
  });

  app.delete("/api/rooms/:code", async (req, reply) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const { participant } = await requireParticipant(pool, req);
    if (!participant) return reply.code(401).send({ error: "unauthorized" });
    const result = await deleteRoomAsHost(pool, code, participant);
    return reply.code(result.status).send(result.data);
  });

  app.delete("/api/rooms/:code/me", async (req, reply) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const { participant } = await requireParticipant(pool, req);
    if (!participant) return reply.code(401).send({ error: "unauthorized" });
    const result = await leaveRoomAsGuest(pool, code, participant);
    return reply.code(result.status).send(result.data);
  });

  app.patch("/api/rooms/:code/name", async (req, reply) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const { participant } = await requireParticipant(pool, req);
    if (!participant) return reply.code(401).send({ error: "unauthorized" });
    const result = await updateRoomName(pool, code, participant, req.body);
    return reply.code(result.status).send(result.data);
  });
}

module.exports = { registerRoomRoutes };
