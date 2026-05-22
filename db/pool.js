const mysql = require("mysql2/promise");
const { randomUUID, createHash } = require("crypto");
const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_POOL_SIZE } = require("../config");

function sha256Hex(input) {
  return createHash("sha256").update(String(input)).digest("hex");
}

function makeParticipantToken() {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
}

function hashToken(token) {
  return sha256Hex("sm:" + token);
}

function getMysqlConfig() {
  return {
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    connectionLimit: MYSQL_POOL_SIZE,
    timezone: "Z",
    dateStrings: true,
    supportBigNumbers: true
  };
}

async function ensureDatabaseExists() {
  const cfg = getMysqlConfig();
  const { database, ...serverCfg } = cfg;
  const conn = await mysql.createConnection({
    ...serverCfg,
    multipleStatements: true
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await conn.end();
}

async function openPool() {
  await ensureDatabaseExists();
  const cfg = getMysqlConfig();
  const pool = mysql.createPool({ ...cfg, multipleStatements: true });
  return { pool, config: cfg };
}

async function migrate(pool) {
  const charset = "utf8mb4";
  const collate = "utf8mb4_0900_ai_ci";

  const statements = [
    {
      name: "clients",
      sql: `CREATE TABLE IF NOT EXISTS clients (id CHAR(36) PRIMARY KEY, created_at DATETIME(3) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collate};`
    },
    {
      name: "rooms",
      sql: `CREATE TABLE IF NOT EXISTS rooms (
        id CHAR(36) PRIMARY KEY,
        code VARCHAR(16) NOT NULL,
        room_name VARCHAR(64) DEFAULT NULL,
        theme_key VARCHAR(32) NOT NULL,
        question_ids_json JSON NOT NULL,
        share_id CHAR(36) NOT NULL,
        created_client_id CHAR(36) NOT NULL,
        user_id CHAR(36) DEFAULT NULL,
        status VARCHAR(16) NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        deleted_at DATETIME(3) NULL,
        UNIQUE KEY uq_rooms_code (code),
        UNIQUE KEY uq_rooms_share_id (share_id),
        KEY idx_rooms_created_client (created_client_id),
        KEY idx_rooms_updated_at (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collate};`
    },
    {
      name: "participants",
      sql: `CREATE TABLE IF NOT EXISTS participants (
        id CHAR(36) PRIMARY KEY,
        room_id CHAR(36) NOT NULL,
        role VARCHAR(8) NOT NULL,
        client_id CHAR(36) NOT NULL,
        nickname VARCHAR(16) NOT NULL,
        token_hash CHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL,
        deleted_at DATETIME(3) NULL,
        UNIQUE KEY uq_participants_token_hash (token_hash),
        KEY idx_participants_room_active (room_id, deleted_at),
        KEY idx_participants_client_active (client_id, deleted_at),
        CONSTRAINT fk_participants_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        CONSTRAINT fk_participants_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collate};`
    },
    {
      name: "answer_sets",
      sql: `CREATE TABLE IF NOT EXISTS answer_sets (
        participant_id CHAR(36) PRIMARY KEY,
        room_id CHAR(36) NOT NULL,
        answers_json JSON NOT NULL,
        submitted_at DATETIME(3) NOT NULL,
        KEY idx_answer_sets_room (room_id),
        CONSTRAINT fk_answer_sets_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
        CONSTRAINT fk_answer_sets_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collate};`
    },
    {
      name: "room_results",
      sql: `CREATE TABLE IF NOT EXISTS room_results (
        room_id CHAR(36) PRIMARY KEY,
        result_json JSON NOT NULL,
        computed_at DATETIME(3) NOT NULL,
        CONSTRAINT fk_room_results_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collate};`
    },
    {
      name: "pair_results",
      sql: `CREATE TABLE IF NOT EXISTS pair_results (
        room_id CHAR(36) NOT NULL,
        guest_participant_id CHAR(36) NOT NULL,
        result_json JSON NOT NULL,
        match_index INT NOT NULL,
        computed_at DATETIME(3) NOT NULL,
        PRIMARY KEY (room_id, guest_participant_id),
        KEY idx_pair_results_room (room_id),
        CONSTRAINT fk_pair_results_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        CONSTRAINT fk_pair_results_guest FOREIGN KEY (guest_participant_id) REFERENCES participants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collate};`
    },
    {
      name: "questions",
      sql: `CREATE TABLE IF NOT EXISTS questions (
        theme_key VARCHAR(32) NOT NULL,
        question_id VARCHAR(32) NOT NULL,
        prompt TEXT NOT NULL,
        options_json JSON NOT NULL,
        dimension VARCHAR(16) NOT NULL,
        type VARCHAR(16) NOT NULL,
        scores_json JSON NOT NULL,
        is_active TINYINT(1) NOT NULL,
        created_at DATETIME(3) NOT NULL,
        PRIMARY KEY (theme_key, question_id),
        KEY idx_questions_theme_active (theme_key, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collate};`
    },
    {
      name: "users",
      sql: `CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        datadid_uid VARCHAR(128) NOT NULL,
        email VARCHAR(255) DEFAULT NULL,
        username VARCHAR(64) DEFAULT NULL,
        avatar_url TEXT DEFAULT NULL,
        did VARCHAR(255) DEFAULT NULL,
        wallet_address VARCHAR(128) DEFAULT NULL,
        access_token TEXT DEFAULT NULL,
        refresh_token TEXT DEFAULT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        UNIQUE KEY uq_users_datadid_uid (datadid_uid),
        KEY idx_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collate};`
    }
  ];

  for (const s of statements) {
    try {
      await pool.query(s.sql);
    } catch (e) {
      const err = new Error(`migrate_failed:${s.name}`);
      err.cause = e;
      throw err;
    }
  }

  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM rooms LIKE 'room_name'");
    if (!cols || cols.length === 0) {
      await pool.query("ALTER TABLE rooms ADD COLUMN room_name VARCHAR(64) DEFAULT NULL AFTER code");
    }
  } catch {}

  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM rooms LIKE 'user_id'");
    if (!cols || cols.length === 0) {
      await pool.query("ALTER TABLE rooms ADD COLUMN user_id CHAR(36) DEFAULT NULL AFTER created_client_id");
    }
  } catch {}
}

async function ensureClient(pool, clientIdMaybe) {
  const id = String(clientIdMaybe || "").trim() || randomUUID();
  const [rows] = await pool.query("SELECT id FROM clients WHERE id = ? LIMIT 1", [id]);
  if (!rows || rows.length === 0) {
    await pool.query("INSERT INTO clients(id, created_at) VALUES(?, ?)", [id, new Date()]);
  }
  return id;
}

async function seedQuestionsFromFile(pool, questionBankPath) {
  const fs = require("fs");
  const path = require("path");
  const [rows] = await pool.query("SELECT COUNT(1) AS c FROM questions");
  const c = rows?.[0]?.c || 0;
  if (Number(c) > 0) return;

  const raw = fs.readFileSync(path.resolve(questionBankPath), "utf8");
  const parsed = JSON.parse(raw);
  const questionBank = parsed?.questionBank || {};
  const ts = new Date();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [themeKey, arr] of Object.entries(questionBank)) {
      for (const q of arr) {
        await conn.query(
          "INSERT INTO questions(theme_key, question_id, prompt, options_json, dimension, type, scores_json, is_active, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            themeKey,
            String(q.id),
            String(q.question),
            JSON.stringify(q.options || []),
            String(q.dimension),
            String(q.type),
            JSON.stringify(q.scores || []),
            1,
            ts
          ]
        );
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  openPool,
  migrate,
  ensureClient,
  seedQuestionsFromFile,
  makeParticipantToken,
  hashToken
};
