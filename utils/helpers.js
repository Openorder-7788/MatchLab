function parseJsonSafe(val, fallback) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function mysqlDateToIso(dtStr) {
  if (!dtStr) return null;
  const s = String(dtStr);
  if (s.includes("T")) return s;
  return s.replace(" ", "T") + "Z";
}

function isPast(mysqlDatetimeStr) {
  const iso = mysqlDateToIso(mysqlDatetimeStr);
  return iso ? new Date(iso).getTime() < Date.now() : false;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeRoomCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `MATCH-${num}`;
}

function validateNickname(n) {
  const s = String(n || "").trim();
  if (!s) return "";
  return s.length > 16 ? s.slice(0, 16) : s;
}

function validateThemeKey(themeKey, themes) {
  const k = String(themeKey || "").trim();
  if (!k) return "";
  const ok = themes.some((t) => t.key === k);
  return ok ? k : "";
}

function validateAnswers(answers, expectedLen) {
  if (!Array.isArray(answers)) return { ok: false, reason: "answers must be an array" };
  if (answers.length !== expectedLen) return { ok: false, reason: `answers length must be ${expectedLen}` };
  for (const v of answers) {
    if (!Number.isInteger(v) || v < 0 || v > 3) return { ok: false, reason: "answers must be integers 0..3" };
  }
  return { ok: true };
}

module.exports = {
  parseJsonSafe,
  mysqlDateToIso,
  isPast,
  addDays,
  shuffleInPlace,
  makeRoomCode,
  validateNickname,
  validateThemeKey,
  validateAnswers
};
