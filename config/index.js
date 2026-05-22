require("dotenv").config();

const APP_PORT = Number(process.env.PORT || 8787);
const MYSQL_HOST = process.env.MYSQL_HOST || "localhost";
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "social_match";
const MYSQL_POOL_SIZE = Number(process.env.MYSQL_POOL_SIZE || 10);
const INVITE_EXPIRE_DAYS = 15;
const GUEST_LIMIT = 10;

module.exports = {
  APP_PORT,
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE,
  MYSQL_POOL_SIZE,
  INVITE_EXPIRE_DAYS,
  GUEST_LIMIT
};
