require("dotenv").config();

const path = require("path");
const fs = require("fs");
const Fastify = require("fastify");
const fastifyStatic = require("@fastify/static");
const fastifyCors = require("@fastify/cors");

const { APP_PORT } = require("./config");
const { openPool, migrate, seedQuestionsFromFile } = require("./db/pool");
const { createSseHub } = require("./utils/sseHub");
const { registerMiscRoutes } = require("./routes/misc.routes");
const { registerRoomRoutes } = require("./routes/room.routes");
const { registerShareRoutes } = require("./routes/share.routes");
const { registerAuthRoutes } = require("./routes/auth.routes");
const { registerTestRoutes } = require("./routes/test");

const QUESTION_BANK_FILE = process.env.QUESTION_BANK_FILE || path.join(__dirname, "question-bank.json");

async function main() {
  const questionBankRaw = fs.readFileSync(QUESTION_BANK_FILE, "utf8");
  const questionBankParsed = JSON.parse(questionBankRaw);
  const THEMES = Array.isArray(questionBankParsed?.themes) ? questionBankParsed.themes : [];

  const { pool } = await openPool();
  await migrate(pool);
  await seedQuestionsFromFile(pool, QUESTION_BANK_FILE);

  const app = Fastify({ logger: true });
  const hub = createSseHub();

  app.register(fastifyCors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Client-Id", "X-Session-Token"],
    credentials: true
  });

  const publicDir = path.join(__dirname, "public");
  app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/",
    decorateReply: false
  });

  app.get("/", async (req, reply) => {
    const htmlPath = path.join(publicDir, "index.html");
    return reply.type("text/html").send(fs.readFileSync(htmlPath, "utf8"));
  });

  registerMiscRoutes(app, pool, THEMES);
  registerRoomRoutes(app, pool, hub, THEMES);
  registerShareRoutes(app, pool);
  registerAuthRoutes(app, pool);
  registerTestRoutes(app);

  await app.listen({ port: APP_PORT, host: "0.0.0.0" });
  console.log(`Server running at http://localhost:${APP_PORT}`);
  console.log(`Local access: http://127.0.0.1:${APP_PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
