const { sendEmailCode, loginWithEmail, registerWithEmail, loginWithEmailPassword, getEvmChallenge, loginWithEvm, verifyAccessToken, findOrCreateUser, getUserById } = require("../services/auth.service");
const { hashToken } = require("../db/pool");

function makeSessionToken(userId) {
  const { randomUUID } = require("crypto");
  return `smu_${userId}_${randomUUID().replace(/-/g, "")}`;
}

async function handleSendCode(pool, body) {
  const email = String(body?.email || "").trim();
  if (!email || !email.includes("@")) return { status: 400, data: { error: "invalid_email" } };
  try {
    await sendEmailCode(email);
    return { status: 200, data: { ok: true } };
  } catch (e) {
    return { status: 502, data: { error: "send_code_failed", message: e.message } };
  }
}

async function handleLoginWithEmail(pool, body) {
  const email = String(body?.email || "").trim();
  const code = String(body?.code || "").trim();
  if (!email || !code) return { status: 400, data: { error: "missing_fields" } };
  try {
    const profile = await loginWithEmail(email, code);
    const user = await findOrCreateUser(pool, profile);
    if (!user) return { status: 500, data: { error: "user_create_failed" } };
    const sessionToken = makeSessionToken(user.id);
    return {
      status: 200,
      data: {
        ok: true,
        sessionToken,
        user: { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatar_url, did: user.did, walletAddress: user.wallet_address }
      }
    };
  } catch (e) {
    return { status: 401, data: { error: "login_failed", message: e.message } };
  }
}

async function handleRegister(pool, body) {
  const email = String(body?.email || "").trim();
  const code = String(body?.code || "").trim();
  const password = String(body?.password || "");
  if (!email || !code || !password) return { status: 400, data: { error: "missing_fields" } };
  if (password.length < 6) return { status: 400, data: { error: "password_too_short" } };
  try {
    const profile = await registerWithEmail(email, code, password);
    const user = await findOrCreateUser(pool, profile);
    if (!user) return { status: 500, data: { error: "user_create_failed" } };
    const sessionToken = makeSessionToken(user.id);
    return {
      status: 200,
      data: {
        ok: true,
        sessionToken,
        user: { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatar_url, did: user.did, walletAddress: user.wallet_address }
      }
    };
  } catch (e) {
    return { status: 401, data: { error: "register_failed", message: e.message } };
  }
}

async function handleLoginWithPassword(pool, body) {
  const email = String(body?.email || "").trim();
  const password = String(body?.password || "");
  if (!email || !password) return { status: 400, data: { error: "missing_fields" } };
  try {
    const profile = await loginWithEmailPassword(email, password);
    const user = await findOrCreateUser(pool, profile);
    if (!user) return { status: 500, data: { error: "user_create_failed" } };
    const sessionToken = makeSessionToken(user.id);
    return {
      status: 200,
      data: {
        ok: true,
        sessionToken,
        user: { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatar_url, did: user.did, walletAddress: user.wallet_address }
      }
    };
  } catch (e) {
    return { status: 401, data: { error: "login_failed", message: e.message } };
  }
}

async function handleLoginWithAppList(pool, body) {
  const accessToken = String(body?.token || "").trim();
  if (!accessToken) return { status: 400, data: { error: "missing_token" } };
  try {
    const profile = await verifyAccessToken(accessToken);
    if (!profile) return { status: 401, data: { error: "invalid_token" } };
    const user = await findOrCreateUser(pool, { ...profile, accessToken, refreshToken: null });
    if (!user) return { status: 500, data: { error: "user_create_failed" } };
    const sessionToken = makeSessionToken(user.id);
    return {
      status: 200,
      data: {
        ok: true,
        sessionToken,
        user: { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatar_url, did: user.did, walletAddress: user.wallet_address }
      }
    };
  } catch {
    return { status: 502, data: { error: "applist_login_failed" } };
  }
}

async function handleEvmChallenge(pool, body) {
  const address = String(body?.address || "").trim();
  if (!address || !address.startsWith("0x") || address.length < 10) return { status: 400, data: { error: "invalid_address" } };
  const chainId = Number(body?.chainId) || 985;
  let origin = String(body?.origin || "").trim() || null;
  if (origin) origin = origin.replace("://127.0.0.1:", "://localhost:");
  try {
    const message = await getEvmChallenge(address, chainId, origin);
    return { status: 200, data: { ok: true, message } };
  } catch (e) {
    return { status: 502, data: { error: "evm_challenge_failed", message: e.message } };
  }
}

async function handleLoginWithEvm(pool, body) {
  const message = String(body?.message || "");
  const signature = String(body?.signature || "").trim();
  if (!message || !signature) return { status: 400, data: { error: "missing_fields" } };
  try {
    const profile = await loginWithEvm(message, signature);
    const user = await findOrCreateUser(pool, profile);
    if (!user) return { status: 500, data: { error: "user_create_failed" } };
    const sessionToken = makeSessionToken(user.id);
    return {
      status: 200,
      data: {
        ok: true,
        sessionToken,
        user: { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatar_url, did: user.did, walletAddress: user.wallet_address }
      }
    };
  } catch (e) {
    return { status: 401, data: { error: "evm_login_failed", message: e.message } };
  }
}

async function handleGetMe(pool, userId) {
  const user = await getUserById(pool, userId);
  if (!user) return { status: 404, data: { error: "user_not_found" } };
  return {
    status: 200,
    data: {
      id: user.id,
      datadidUid: user.datadid_uid,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatar_url,
      did: user.did,
      walletAddress: user.wallet_address
    }
  };
}

module.exports = {
  handleSendCode,
  handleLoginWithEmail,
  handleRegister,
  handleLoginWithPassword,
  handleLoginWithAppList,
  handleEvmChallenge,
  handleLoginWithEvm,
  handleGetMe
};
