const { randomUUID } = require("crypto");
const { DataClient } = require("datadid-sdk-js");

const dataClient = DataClient.production();

async function sendEmailCode(email) {
  await dataClient.sendEmailCode(email);
}

async function loginWithEmail(email, code) {
  const tokens = await dataClient.loginWithEmail(email, code, "Web");
  const me = await dataClient.getMe();
  const userInfo = await dataClient.getUserInfo();
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    uid: me.uid,
    email: me.email || email,
    username: userInfo.name || me.username || me.email,
    avatarUrl: userInfo.icon || null,
    did: userInfo.did || null,
    walletAddress: userInfo.address || null
  };
}

async function registerWithEmail(email, code, password) {
  const tokens = await dataClient.registerWithEmail(email, code, password, "Web");
  dataClient.setAccessToken(tokens.accessToken);
  const me = await dataClient.getMe();
  const userInfo = await dataClient.getUserInfo();
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    uid: me.uid,
    email: me.email || email,
    username: userInfo.name || me.username || me.email,
    avatarUrl: userInfo.icon || null,
    did: userInfo.did || null,
    walletAddress: userInfo.address || null
  };
}

async function loginWithEmailPassword(email, password) {
  const tokens = await dataClient.loginWithEmailPassword(email, password);
  dataClient.setAccessToken(tokens.accessToken);
  const me = await dataClient.getMe();
  const userInfo = await dataClient.getUserInfo();
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    uid: me.uid,
    email: me.email || email,
    username: userInfo.name || me.username || me.email,
    avatarUrl: userInfo.icon || null,
    did: userInfo.did || null,
    walletAddress: userInfo.address || null
  };
}

async function getEvmChallenge(address, chainId, origin) {
  if (!origin) throw new Error("origin is required for EVM challenge");
  const message = await dataClient.getEvmChallenge(address, chainId || 985, origin);
  return message;
}

async function loginWithEvm(message, signature) {
  const result = await dataClient.loginWithEvm(message, signature, "Web");
  const accessToken = result.accessToken;
  dataClient.setAccessToken(accessToken);
  const me = await dataClient.getMe();
  const userInfo = await dataClient.getUserInfo();
  return {
    accessToken,
    refreshToken: result.refreshToken || null,
    uid: me.uid,
    email: me.email || null,
    username: userInfo.name || me.username || me.uid,
    avatarUrl: userInfo.icon || null,
    did: result.did || userInfo.did || null,
    walletAddress: userInfo.address || null
  };
}

async function verifyAccessToken(accessToken) {
  const tempClient = new DataClient({
    baseURL: "https://data-api.memolabs.net",
    disableAutoToken: true
  });
  tempClient.setAccessToken(accessToken);
  try {
    const me = await tempClient.getMe();
    const userInfo = await tempClient.getUserInfo();
    return {
      uid: me.uid,
      email: me.email || null,
      username: userInfo.name || me.username || null,
      avatarUrl: userInfo.icon || null,
      did: userInfo.did || null,
      walletAddress: userInfo.address || null
    };
  } catch {
    return null;
  }
}

async function findOrCreateUser(pool, profile) {
  const uid = String(profile.uid || "").trim();
  if (!uid) return null;

  const [existing] = await pool.query("SELECT * FROM users WHERE datadid_uid = ? LIMIT 1", [uid]);
  if (existing && existing.length > 0) {
    const user = existing[0];
    const now = new Date();
    await pool.query(
      "UPDATE users SET email = ?, username = ?, avatar_url = ?, did = ?, wallet_address = ?, access_token = ?, refresh_token = ?, updated_at = ? WHERE id = ?",
      [
        profile.email || user.email,
        profile.username || user.username,
        profile.avatarUrl || user.avatar_url,
        profile.did || user.did,
        profile.walletAddress || user.wallet_address,
        profile.accessToken || user.access_token,
        profile.refreshToken || user.refresh_token,
        now,
        user.id
      ]
    );
    return { ...user, email: profile.email || user.email, username: profile.username || user.username, avatar_url: profile.avatarUrl || user.avatar_url, did: profile.did || user.did, wallet_address: profile.walletAddress || user.wallet_address };
  }

  const id = randomUUID();
  const now = new Date();
  await pool.query(
    "INSERT INTO users(id, datadid_uid, email, username, avatar_url, did, wallet_address, access_token, refresh_token, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, uid, profile.email || null, profile.username || null, profile.avatarUrl || null, profile.did || null, profile.walletAddress || null, profile.accessToken || null, profile.refreshToken || null, now, now]
  );
  return { id, datadid_uid: uid, email: profile.email || null, username: profile.username || null, avatar_url: profile.avatarUrl || null, did: profile.did || null, wallet_address: profile.walletAddress || null };
}

async function getUserById(pool, userId) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
  return rows?.[0] || null;
}

async function getUserByDataDidUid(pool, uid) {
  const [rows] = await pool.query("SELECT * FROM users WHERE datadid_uid = ? LIMIT 1", [uid]);
  return rows?.[0] || null;
}

module.exports = {
  sendEmailCode,
  loginWithEmail,
  registerWithEmail,
  loginWithEmailPassword,
  getEvmChallenge,
  loginWithEvm,
  verifyAccessToken,
  findOrCreateUser,
  getUserById,
  getUserByDataDidUid
};
