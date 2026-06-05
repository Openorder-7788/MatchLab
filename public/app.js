const App = (() => {
  const PAGES = ["Login", "Home", "Create", "Quiz", "Wait", "Result", "Poster", "MyRooms"];
  const STORAGE_CLIENT_ID = "sm_client_id_v1";
  const STORAGE_TOKENS = "sm_tokens_v2";
  const STORAGE_ROOM_META = "sm_room_meta_v1";
  const STORAGE_SESSION = "sm_session_v1";
  const DATADID_LANGUAGES = ["en", "zh", "zh-TW", "ja", "ko", "fr", "es", "ru", "ar"];
  const APP_SUPPORTED_LANGUAGES = ["en"];

  const DIMENSIONS = {
    life: { key: "life", label: "Lifestyle Sync", icon: "🏠" },
    emotion: { key: "emotion", label: "Emotional Fit", icon: "❤️" },
    fun: { key: "fun", label: "Playfulness Chemistry", icon: "⭐" }
  };

  const THEMES = {
    soulmate: { key: "soulmate", label: "Soulmate Sync" },
    food: { key: "food", label: "Food Buddy" },
    travel: { key: "travel", label: "Travel Buddy" }
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const el = {
    brandHome: $("#brandHome"),
    toast: $("#toast"),
    userPill: $("#userPill"),
    userAvatar: $("#userAvatar"),
    userDisplayName: $("#userDisplayName"),
    btnLogout: $("#btnLogout"),

    pages: {
      Login: $("#pageLogin"),
      Home: $("#pageHome"),
      Create: $("#pageCreate"),
      Quiz: $("#pageQuiz"),
      Wait: $("#pageWait"),
      Result: $("#pageResult"),
      Poster: $("#pagePoster"),
      MyRooms: $("#pageMyRooms")
    },

    loginTabs: $("#loginTabs"),
    loginPanelCode: $("#loginPanelCode"),
    loginPanelPassword: $("#loginPanelPassword"),
    loginPanelRegister: $("#loginPanelRegister"),
    loginEmail1: $("#loginEmail1"),
    loginCode: $("#loginCode"),
    btnSendCode: $("#btnSendCode"),
    btnLoginCode: $("#btnLoginCode"),
    loginEmail2: $("#loginEmail2"),
    loginPassword: $("#loginPassword"),
    btnLoginPassword: $("#btnLoginPassword"),
    regEmail: $("#regEmail"),
    regCode: $("#regCode"),
    regPassword: $("#regPassword"),
    btnSendCodeReg: $("#btnSendCodeReg"),
    btnRegister: $("#btnRegister"),
    walletStatus: $("#walletStatus"),
    btnConnectWallet: $("#btnConnectWallet"),

    btnCreate: $("#btnCreate"),
    btnJoin: $("#btnJoin"),
    btnMyRooms: $("#btnMyRooms"),

    roomNameInput: $("#roomNameInput"),
    themeSelect: $("#themeSelect"),
    nicknameInput: $("#nicknameInput"),
    btnStartQuiz: $("#btnStartQuiz"),
    btnBackHome1: $("#btnBackHome1"),

    quizCount: $("#quizCount"),
    quizRoom: $("#quizRoom"),
    quizRolePill: $("#quizRolePill"),
    quizQuestion: $("#quizQuestion"),
    quizOptions: $("#quizOptions"),
    btnNext: $("#btnNext"),
    btnPrev: $("#btnPrev"),
    progressBar: $("#progressBar"),

    inviteCodeText: $("#inviteCodeText"),
    inviteThemePill: $("#inviteThemePill"),
    inviteLinkText: $("#inviteLinkText"),
    btnCopyLink: $("#btnCopyLink"),
    btnCheckOutcomes: $("#btnCheckOutcomes"),
    btnBackHome2: $("#btnBackHome2"),

    roomOverallPill: $("#roomOverallPill"),
    participantSelector: $("#participantSelector"),

    resultNames: $("#resultNames"),
    resultScore: $("#resultScore"),
    resultBadge: $("#resultBadge"),
    resultSub: $("#resultSub"),
    resultDesc: $("#resultDesc"),
    metrics: $("#metrics"),
    listStrengths: $("#listStrengths"),
    listFrictions: $("#listFrictions"),
    adviceText: $("#adviceText"),
    btnPoster: $("#btnPoster"),
    btnRetry: $("#btnRetry"),

    posterTitleChip: $("#posterTitleChip"),
    posterNames: $("#posterNames"),
    posterScore: $("#posterScore"),
    posterBadge: $("#posterBadge"),
    posterQuote: $("#posterQuote"),
    btnSavePoster: $("#btnSavePoster"),
    btnBackResult: $("#btnBackResult"),

    myRoomsCreated: $("#myRoomsCreated"),
    myRoomsInvited: $("#myRoomsInvited"),
    btnRefreshMyRooms: $("#btnRefreshMyRooms"),
    btnBackHomeMyRooms: $("#btnBackHomeMyRooms"),

    joinModal: $("#joinModal"),
    joinCodeInput: $("#joinCodeInput"),
    joinNicknameInput: $("#joinNicknameInput"),
    btnCloseJoin: $("#btnCloseJoin"),
    btnCancelJoin: $("#btnCancelJoin"),
    btnConfirmJoin: $("#btnConfirmJoin")
  };

  const state = {
    page: "Login",
    mode: "host",
    themeKey: "soulmate",
    roomCode: "",
    roomName: "",
    shareId: "",
    nickname: "",
    participantId: "",
    participantToken: "",
    questionIds: [],
    questions: [],
    quizIndex: 0,
    answers: [],
    lastSelected: null,
    displayResult: null,
    displayNames: [],
    allGuestResults: [],
    selectedGuestIndex: -1,
    hostNickname: "",
    sse: null,
    sessionToken: "",
    currentUser: null,
    sendCodeCooldown: 0
  };

  const cache = {
    questionsByTheme: new Map()
  };

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => el.toast.classList.remove("show"), 1800);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function normalizeCode(str) {
    return String(str || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/—/g, "-");
  }

  function safeName(name) {
    const s = String(name || "").trim();
    if (!s) return "";
    return s.length > 16 ? s.slice(0, 16) : s;
  }

  function normalizeDataDidLanguage(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    const dataDidLanguage =
      lower === "zh-tw" || lower === "zh-hant" || lower === "zh-hk"
        ? "zh-TW"
        : lower === "zh-cn" || lower === "zh-hans"
          ? "zh"
          : DATADID_LANGUAGES.find((language) => language.toLowerCase() === lower) || null;
    if (!dataDidLanguage) return null;
    return APP_SUPPORTED_LANGUAGES.includes(dataDidLanguage) ? dataDidLanguage : null;
  }

  function applyAppListLanguage(value) {
    const language = normalizeDataDidLanguage(value);
    if (!language) return null;
    document.documentElement.setAttribute("lang", language);
    return language;
  }

  function consumeAppListRedirectParams() {
    const url = new URL(window.location.href);
    const tokenParam = url.searchParams.get("token");
    const langParam = url.searchParams.get("lang");
    const accessToken = String(tokenParam || "").trim();
    const language = applyAppListLanguage(langParam);

    if (tokenParam !== null || langParam !== null) {
      url.searchParams.delete("token");
      url.searchParams.delete("lang");
      window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
    }

    return {
      accessToken,
      language,
      consumedToken: Boolean(accessToken),
      consumedParams: tokenParam !== null || langParam !== null
    };
  }

  function goto(page) {
    state.page = page;
    for (const k of Object.keys(el.pages)) el.pages[k].classList.toggle("active", k === page);
  }

  function getClientId() {
    const existing = String(localStorage.getItem(STORAGE_CLIENT_ID) || "").trim();
    if (existing) return existing;
    const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + String(Math.random()).slice(2);
    localStorage.setItem(STORAGE_CLIENT_ID, id);
    return id;
  }

  function setClientId(id) {
    if (!id) return;
    localStorage.setItem(STORAGE_CLIENT_ID, String(id));
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_SESSION);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function saveSession(session) {
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_SESSION);
    state.sessionToken = "";
    state.currentUser = null;
  }

  function loadTokenStore() {
    try {
      const raw = localStorage.getItem(STORAGE_TOKENS);
      if (!raw) return { byParticipantId: {}, byRoom: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { byParticipantId: {}, byRoom: {} };
      if (parsed.byParticipantId && parsed.byRoom) return parsed;

      const legacy = parsed;
      const byParticipantId = {};
      const byRoom = {};
      for (const [code, token] of Object.entries(legacy)) {
        const fakeId = `legacy_${String(code)}`;
        byParticipantId[fakeId] = String(token);
        byRoom[String(code)] = { hostParticipantId: null, guestParticipantIds: [], activeParticipantId: fakeId };
      }
      return { byParticipantId, byRoom };
    } catch {
      return { byParticipantId: {}, byRoom: {} };
    }
  }

  function saveTokenStore(store) {
    localStorage.setItem(STORAGE_TOKENS, JSON.stringify(store));
  }

  function ensureRoomTokenState(store, code) {
    const k = String(code);
    if (!store.byRoom[k]) {
      store.byRoom[k] = { hostParticipantId: null, guestParticipantIds: [], activeParticipantId: null };
    }
    if (!Array.isArray(store.byRoom[k].guestParticipantIds)) store.byRoom[k].guestParticipantIds = [];
    return store.byRoom[k];
  }

  function saveParticipantToken(code, role, participantId, nickname, token) {
    const store = loadTokenStore();
    store.byParticipantId[String(participantId)] = String(token);
    const roomState = ensureRoomTokenState(store, code);
    roomState.activeParticipantId = String(participantId);
    if (role === "host") {
      roomState.hostParticipantId = String(participantId);
    } else {
      if (!roomState.guestParticipantIds.includes(String(participantId))) {
        roomState.guestParticipantIds.push(String(participantId));
      }
    }
    saveTokenStore(store);
    setRoomMeta(code, { lastRole: role, lastParticipantId: participantId, lastNickname: nickname || null });
  }

  function getTokenByParticipantId(participantId) {
    const store = loadTokenStore();
    return String(store.byParticipantId[String(participantId)] || "");
  }

  function clearStoredParticipant(participantId) {
    const store = loadTokenStore();
    delete store.byParticipantId[String(participantId)];
    for (const r of Object.values(store.byRoom)) {
      if (!r) continue;
      if (r.hostParticipantId === participantId) r.hostParticipantId = null;
      r.guestParticipantIds = Array.isArray(r.guestParticipantIds) ? r.guestParticipantIds.filter((id) => id !== participantId) : [];
      if (r.activeParticipantId === participantId) r.activeParticipantId = r.hostParticipantId || r.guestParticipantIds[0] || null;
    }
    saveTokenStore(store);
  }

  function loadRoomMeta() {
    try {
      const raw = localStorage.getItem(STORAGE_ROOM_META);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    } catch { return {}; }
  }

  function saveRoomMeta(map) {
    localStorage.setItem(STORAGE_ROOM_META, JSON.stringify(map));
  }

  function setRoomMeta(code, meta) {
    const m = loadRoomMeta();
    m[String(code)] = { ...(m[String(code)] || {}), ...(meta || {}) };
    saveRoomMeta(m);
  }

  function getRoomMeta(code) {
    const m = loadRoomMeta();
    return m[String(code)] || null;
  }

  function authHeaders() {
    const h = { "X-Client-Id": getClientId() };
    if (state.sessionToken) h["X-Session-Token"] = state.sessionToken;
    return h;
  }

  async function fetchJson(url, init) {
    const res = await fetch(url, init);
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    if (!res.ok) {
      const err = new Error("request_failed");
      err.status = res.status;
      err.body = parsed;
      throw err;
    }
    return parsed;
  }

  async function apiSendCode(email) {
    return fetchJson("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
  }

  async function apiLoginWithEmail(email, code) {
    return fetchJson("/api/auth/login/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });
  }

  async function apiLoginWithPassword(email, password) {
    return fetchJson("/api/auth/login/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
  }

  async function apiLoginWithAppListToken(token) {
    return fetchJson("/api/auth/login/applist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
  }

  function normalizeOriginForDataDid(origin) {
    const o = String(origin || "").trim();
    return o.replace("://127.0.0.1:", "://localhost:");
  }

  async function apiEvmChallenge(address, chainId, origin) {
    return fetchJson("/api/auth/evm/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, chainId: chainId || 985, origin: normalizeOriginForDataDid(origin || window.location.origin) })
    });
  }

  async function apiLoginWithEvm(message, signature) {
    return fetchJson("/api/auth/login/evm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, signature })
    });
  }

  async function apiGetMe() {
    return fetchJson("/api/auth/me", { headers: authHeaders() });
  }

  async function apiCreateRoom(themeKey, nickname, roomName) {
    const clientId = getClientId();
    const body = JSON.stringify({ themeKey, nickname, roomName: roomName || null });
    const data = await fetchJson("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body
    });
    if (data?.clientId) setClientId(data.clientId);
    return data;
  }

  async function apiJoinRoom(code, nickname) {
    const clientId = getClientId();
    const body = JSON.stringify({ nickname });
    const data = await fetchJson(`/api/rooms/${encodeURIComponent(code)}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body
    });
    if (data?.clientId) setClientId(data.clientId);
    return data;
  }

  async function apiGetRoomStatus(code) {
    return fetchJson(`/api/rooms/${encodeURIComponent(code)}`);
  }

  async function apiSubmitAnswers(code, token, answers) {
    const body = JSON.stringify({ answers });
    return fetchJson(`/api/rooms/${encodeURIComponent(code)}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body
    });
  }

  async function apiGetResult(code, token) {
    return fetchJson(`/api/rooms/${encodeURIComponent(code)}/result`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async function apiListMyRooms() {
    const clientId = getClientId();
    return fetchJson("/api/my/rooms", { headers: { "X-Client-Id": clientId, ...(state.sessionToken ? { "X-Session-Token": state.sessionToken } : {}) } });
  }

  async function apiDeleteRoomAsHost(code, token) {
    return fetchJson(`/api/rooms/${encodeURIComponent(code)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async function apiLeaveRoomAsGuest(code, token) {
    return fetchJson(`/api/rooms/${encodeURIComponent(code)}/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async function apiUpdateRoomName(code, token, roomName) {
    return fetchJson(`/api/rooms/${encodeURIComponent(code)}/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ roomName })
    });
  }

  async function ensureThemeQuestions(themeKey) {
    const k = String(themeKey || "").trim() || "soulmate";
    if (cache.questionsByTheme.has(k)) return cache.questionsByTheme.get(k);
    const data = await fetchJson(`/api/themes/${encodeURIComponent(k)}/questions`);
    const byId = new Map();
    for (const q of (data?.questions || [])) byId.set(String(q.id), q);
    cache.questionsByTheme.set(k, byId);
    return byId;
  }

  function roleLabel(mode) {
    return mode === "host" ? "You (Host)" : "You (Guest)";
  }

  function setQuestionsFromIds(themeKey, questionIds) {
    const byId = cache.questionsByTheme.get(themeKey) || new Map();
    const qs = [];
    for (const id of questionIds) {
      const q = byId.get(String(id));
      if (q) qs.push(q);
    }
    state.questions = qs;
  }

  function renderQuiz() {
    const qs = state.questions;
    const q = qs[state.quizIndex];
    if (!q) return;

    el.quizCount.textContent = `${state.quizIndex + 1} / ${qs.length}`;
    el.quizRoom.textContent = state.roomCode ? `Room: ${state.roomCode}` : "Room: —";
    el.quizRolePill.textContent = roleLabel(state.mode);
    el.quizQuestion.textContent = q.question;
    el.quizOptions.innerHTML = "";
    state.lastSelected = null;

    q.options.forEach((text, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opt";
      btn.textContent = text;
      btn.addEventListener("click", () => selectOption(idx));
      el.quizOptions.appendChild(btn);
    });

    const progress = (state.quizIndex / qs.length) * 100;
    el.progressBar.style.width = `${progress}%`;

    const existing = state.answers[state.quizIndex];
    const hasExisting = Number.isInteger(existing);
    if (hasExisting) {
      state.lastSelected = existing;
      $$("#quizOptions .opt").forEach((node, idx) => node.classList.toggle("selected", idx === existing));
    }

    el.btnPrev.disabled = state.quizIndex <= 0;
    el.btnPrev.style.opacity = el.btnPrev.disabled ? 0.78 : 1;

    el.btnNext.disabled = !hasExisting;
    el.btnNext.style.opacity = el.btnNext.disabled ? 0.85 : 1;
  }

  function selectOption(optionIndex) {
    state.lastSelected = optionIndex;
    state.answers[state.quizIndex] = optionIndex;
    $$("#quizOptions .opt").forEach((node, idx) => node.classList.toggle("selected", idx === optionIndex));
    el.btnNext.disabled = false;
    el.btnNext.style.opacity = 1;
  }

  async function nextQuestion() {
    const qs = state.questions;
    if (state.lastSelected == null) {
      const existing = state.answers[state.quizIndex];
      if (Number.isInteger(existing)) state.lastSelected = existing;
    }
    if (state.lastSelected == null) {
      showToast("Pick an option first.");
      return;
    }

    const isLast = state.quizIndex >= qs.length - 1;
    if (!isLast) {
      state.quizIndex += 1;
      renderQuiz();
      return;
    }
    el.progressBar.style.width = "100%";
    await submitMyAnswersAndProceed();
  }

  function previousQuestion() {
    if (state.quizIndex <= 0) return;
    state.quizIndex -= 1;
    renderQuiz();
  }

  function currentInviteLink(code) {
    const base = location.href.split("?")[0].split("#")[0];
    return `${base}?room=${encodeURIComponent(code)}`;
  }

  async function renderWait() {
    const code = state.roomCode;
    if (!code) return;
    const status = await apiGetRoomStatus(code);
    el.inviteCodeText.textContent = status.code;
    el.inviteThemePill.textContent = THEMES[status.themeKey]?.label || "Soulmate Sync";
    const link = currentInviteLink(status.code);
    el.inviteLinkText.textContent = `Invite link: ${link}`;

    el.btnCheckOutcomes.disabled = !status.ready;
    el.btnCheckOutcomes.classList.toggle("warn", Boolean(status.ready));
    el.btnCheckOutcomes.classList.toggle("locked", !status.ready);
  }

  function closeSse() {
    if (state.sse) {
      try { state.sse.close(); } catch {}
      state.sse = null;
    }
  }

  function openSseForRoom(code) {
    closeSse();
    const token = state.participantToken || "";
    if (!token) return;
    const url = `/api/rooms/${encodeURIComponent(code)}/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    state.sse = es;
    es.addEventListener("room_snapshot", (e) => {
      try {
        const snapshot = JSON.parse(e.data);
        if (state.page === "Wait") {
          el.btnCheckOutcomes.disabled = !snapshot.ready;
          el.btnCheckOutcomes.classList.toggle("warn", Boolean(snapshot.ready));
          el.btnCheckOutcomes.classList.toggle("locked", !snapshot.ready);
        }
      } catch {}
    });
    es.addEventListener("room_updated", () => {
      if (state.page === "Wait") renderWait().catch(() => {});
    });
    es.addEventListener("result_updated", () => {
      if (state.page === "Wait") renderWait().catch(() => {});
      if (state.page === "Result") loadAndRenderResult(code).catch(() => {});
    });
  }

  async function submitMyAnswersAndProceed() {
    const code = state.roomCode;
    const token = state.participantToken || "";
    if (!code || !token) {
      showToast("Room not ready.");
      goto("Home");
      return;
    }
    const allAnswered = state.answers.every((v) => Number.isInteger(v) && v >= 0 && v <= 3);
    if (!allAnswered) {
      showToast("Please answer all questions.");
      return;
    }
    await apiSubmitAnswers(code, token, state.answers.slice());
    await renderWait();
    goto("Wait");
    openSseForRoom(code);
    if (state.mode === "guest") {
      try {
        const status = await apiGetRoomStatus(code);
        if (status.ready) {
          await loadAndRenderResult(code);
          goto("Result");
        }
      } catch {}
    }
  }

  function animateNumber(elNode, toValue, durationMs) {
    const fromValue = Number(elNode.textContent) || 0;
    const start = performance.now();
    const dur = Math.max(260, durationMs || 900);
    function step(now) {
      const t = clamp((now - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(fromValue + (toValue - fromValue) * eased);
      elNode.textContent = String(v);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function scoreIcon(score) {
    if (score >= 80) return `<span class="scoreIcon"><span class="heart">❤️</span> ${score}%</span>`;
    if (score >= 50) return `<span class="scoreIcon"><span class="star">⭐</span> ${score}%</span>`;
    return `<span class="scoreIcon">${score}%</span>`;
  }

  function renderMetrics(dimScores) {
    const items = [
      { key: "life", label: DIMENSIONS.life.label, icon: DIMENSIONS.life.icon, value: dimScores.life, grad: "--g2" },
      { key: "emotion", label: DIMENSIONS.emotion.label, icon: DIMENSIONS.emotion.icon, value: dimScores.emotion, grad: "--g1" },
      { key: "fun", label: DIMENSIONS.fun.label, icon: DIMENSIONS.fun.icon, value: dimScores.fun, grad: "--g3" }
    ];
    el.metrics.innerHTML = "";
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "metric";
      row.innerHTML = `
        <div class="label">${item.icon} ${item.label}</div>
        <div class="value">${scoreIcon(item.value)}</div>
        <div class="meter"><i style="background: var(${item.grad});"></i></div>
      `;
      el.metrics.appendChild(row);
      const bar = row.querySelector(".meter > i");
      window.setTimeout(() => { bar.style.width = `${clamp(item.value, 0, 100)}%`; }, 60);
    }
  }

  function setResultNames(names) {
    el.resultNames.innerHTML = "";
    for (const n of names) {
      const tag = document.createElement("div");
      tag.className = "nameTag";
      tag.textContent = n;
      el.resultNames.appendChild(tag);
    }
  }

  function renderDisplayResult(displayResult) {
    if (!displayResult) return;
    el.resultBadge.textContent = displayResult.title || "—";
    el.resultSub.textContent = displayResult.subtitle || "—";
    el.resultDesc.textContent = displayResult.description || "—";
    el.resultScore.textContent = "0";
    animateNumber(el.resultScore, Number(displayResult.matchIndex || 0), 980);
    renderMetrics(displayResult.dimScores || { life: 0, emotion: 0, fun: 0 });
    el.listStrengths.innerHTML = (displayResult.strengths || []).map((t) => `<li>⭐ ${t}</li>`).join("");
    el.listFrictions.innerHTML = (displayResult.frictions || []).map((t) => `<li>⚡ ${t}</li>`).join("");
    el.adviceText.textContent = displayResult.advice || "—";
  }

  function setOverallPill(overall) {
    if (!overall) {
      el.roomOverallPill.style.display = "none";
      return;
    }
    el.roomOverallPill.style.display = "inline-flex";
    el.roomOverallPill.innerHTML = `❤️ Room Overall: <strong style="font-size:14px;margin-left:4px;">${overall.matchIndex}%</strong>`;
  }

  async function loadAndRenderResult(code) {
    const token = state.participantToken || "";
    if (!token) {
      showToast("Missing token for this room on this device.");
      return;
    }
    const data = await apiGetResult(code, token);
    state.shareId = data.shareId || "";
    setRoomMeta(code, { shareId: state.shareId, themeKey: state.themeKey });

    if (data.role === "host") {
      const status = await apiGetRoomStatus(code);
      state.hostNickname = status.host?.nickname || "Host";
      state.allGuestResults = data.perGuest || [];
      state.selectedGuestIndex = -1;
      setOverallPill(data.overall);
      renderParticipantSelector();
      selectParticipant(-1);
      return;
    }

    el.participantSelector.innerHTML = "";
    setOverallPill(data.overall);
    const selfResult = data.self?.result || null;
    setResultNames([data.hostNickname || "Host", data.guestNickname || "You"]);
    renderDisplayResult(selfResult || data.overall);
    state.displayResult = selfResult || data.overall;
    state.displayNames = [data.hostNickname || "Host", data.guestNickname || "You"];
  }

  function renderParticipantSelector() {
    el.participantSelector.innerHTML = "";
    const overallChip = document.createElement("div");
    overallChip.className = "participantChip active";
    overallChip.dataset.index = "-1";
    overallChip.innerHTML = `🏠 Overall <span class="chipScore">${state.allGuestResults.length > 0 ? "Avg" : ""}</span>`;
    overallChip.addEventListener("click", () => selectParticipant(-1));
    el.participantSelector.appendChild(overallChip);

    for (let i = 0; i < state.allGuestResults.length; i++) {
      const g = state.allGuestResults[i];
      const score = g?.result?.matchIndex;
      const chip = document.createElement("div");
      chip.className = "participantChip";
      chip.dataset.index = String(i);
      chip.innerHTML = `👤 ${g.guestNickname || "Guest"} <span class="chipScore">${Number.isInteger(score) ? `${score}%` : ""}</span>`;
      chip.addEventListener("click", () => selectParticipant(i));
      el.participantSelector.appendChild(chip);
    }
  }

  function selectParticipant(index) {
    state.selectedGuestIndex = index;
    $$(".participantChip").forEach((chip) => {
      chip.classList.toggle("active", Number(chip.dataset.index) === index);
    });

    if (index === -1) {
      setResultNames([state.hostNickname, "Room"]);
      const overall = state.allGuestResults.length > 0
        ? computeOverallFromGuests(state.allGuestResults)
        : null;
      if (overall) renderDisplayResult(overall);
    } else {
      const g = state.allGuestResults[index];
      if (!g) return;
      setResultNames([state.hostNickname, g.guestNickname || "Guest"]);
      if (g.result) renderDisplayResult(g.result);
    }
  }

  function computeOverallFromGuests(perGuest) {
    if (!perGuest || perGuest.length === 0) return null;
    let totalScore = 0;
    let count = 0;
    const dimTotals = { life: 0, emotion: 0, fun: 0 };
    const allStrengths = [];
    const allFrictions = [];

    for (const g of perGuest) {
      if (!g.result) continue;
      totalScore += g.result.matchIndex || 0;
      count++;
      if (g.result.dimScores) {
        dimTotals.life += g.result.dimScores.life || 0;
        dimTotals.emotion += g.result.dimScores.emotion || 0;
        dimTotals.fun += g.result.dimScores.fun || 0;
      }
      if (g.result.strengths) allStrengths.push(...g.result.strengths);
      if (g.result.frictions) allFrictions.push(...g.result.frictions);
    }

    if (count === 0) return null;
    const avgScore = Math.round(totalScore / count);
    const uniqueStrengths = [...new Set(allStrengths)].slice(0, 5);
    const uniqueFrictions = [...new Set(allFrictions)].slice(0, 5);

    return {
      matchIndex: avgScore,
      title: avgScore >= 80 ? "Soulmate Vibes" : avgScore >= 50 ? "Good Chemistry" : "Room for Growth",
      subtitle: `${count} participant${count > 1 ? "s" : ""} · Average match`,
      description: `Average compatibility across ${count} test taker${count > 1 ? "s" : ""}.`,
      dimScores: {
        life: Math.round(dimTotals.life / count),
        emotion: Math.round(dimTotals.emotion / count),
        fun: Math.round(dimTotals.fun / count)
      },
      strengths: uniqueStrengths,
      frictions: uniqueFrictions,
      advice: count > 1 ? "Click each person to see your unique dynamic." : "Invite more people to see group dynamics."
    };
  }

  function renderPoster(themeKey, names, displayResult) {
    el.posterTitleChip.textContent = THEMES[themeKey]?.label || "Soulmate Sync";
    el.posterNames.innerHTML = "";
    for (const n of names) {
      const tag = document.createElement("div");
      tag.className = "nameTag";
      tag.textContent = n;
      el.posterNames.appendChild(tag);
    }
    el.posterScore.textContent = `${Number(displayResult?.matchIndex || 0)}%`;
    el.posterBadge.textContent = displayResult?.title || "—";
    el.posterQuote.textContent = displayResult?.subtitle || "—";
  }

  async function openResultForRoom(code, participantId, role) {
    const pid = String(participantId || state.participantId || "").trim();
    const token = pid ? getTokenByParticipantId(pid) : (state.participantToken || "");
    if (!token) {
      showToast("This room is not available on this device.");
      return;
    }
    state.roomCode = code;
    state.participantId = pid || state.participantId;
    state.participantToken = token;
    if (role) state.mode = role;
    const meta = getRoomMeta(code);
    state.shareId = meta?.shareId || "";
    state.themeKey = meta?.themeKey || state.themeKey;
    closeSse();
    await loadAndRenderResult(code);
    goto("Result");
    openSseForRoom(code);
  }

  function clearRoomLocal(code, participantId) {
    if (participantId) clearStoredParticipant(String(participantId));
    const meta = loadRoomMeta();
    delete meta[String(code)];
    saveRoomMeta(meta);
  }

  function renderMyRoomCard(container, r, kind) {
    const card = document.createElement("div");
    card.className = "guestResultItem";
    card.style.marginBottom = "10px";

    const roomLabel = r.roomName ? r.roomName : r.code;
    const statusLabel = r.ready ? "✅ Ready" : "⏳ Waiting";
    const guestInfo = `${r.guests?.answered || 0}/${r.guests?.total || 0} answered`;

    card.innerHTML = `
      <div class="guestResultHeader">
        <div class="guestResultHeaderLeft">
          <span class="guestResultName">${roomLabel}</span>
          <span style="font-size:12px;color:rgba(255,255,255,.55);">${statusLabel} · ${guestInfo}</span>
        </div>
        <span class="guestResultArrow">▼</span>
      </div>
      <div class="guestResultBody"></div>
    `;
    container.appendChild(card);

    const body = card.querySelector(".guestResultBody");

    if (kind === "created") {
      const nameEdit = document.createElement("div");
      nameEdit.className = "roomNameEdit";
      nameEdit.style.marginBottom = "8px";
      const nameSpan = document.createElement("span");
      nameSpan.className = "roomNameText";
      nameSpan.textContent = r.roomName || "Tap to name this room";
      nameSpan.addEventListener("click", () => {
        const input = document.createElement("input");
        input.className = "roomNameInput";
        input.value = r.roomName || "";
        input.maxLength = 64;
        const saveBtn = document.createElement("button");
        saveBtn.className = "roomNameSave";
        saveBtn.textContent = "Save";
        nameEdit.innerHTML = "";
        nameEdit.appendChild(input);
        nameEdit.appendChild(saveBtn);
        input.focus();
        saveBtn.addEventListener("click", async () => {
          const newName = String(input.value || "").trim().slice(0, 64);
          const pid = String(r.participantId || "").trim();
          const token = pid ? getTokenByParticipantId(pid) : "";
          if (token) {
            try {
              await apiUpdateRoomName(r.code, token, newName);
              r.roomName = newName;
              showToast("Room name updated.");
            } catch {
              showToast("Failed to update name.");
            }
          }
          nameEdit.innerHTML = "";
          nameSpan.textContent = newName || "Tap to name this room";
          nameEdit.appendChild(nameSpan);
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") saveBtn.click();
        });
      });
      nameEdit.appendChild(nameSpan);
      body.appendChild(nameEdit);
    }

    const btnWrap = document.createElement("div");
    btnWrap.style.display = "grid";
    btnWrap.style.gridTemplateColumns = "1fr 1fr";
    btnWrap.style.gap = "10px";
    btnWrap.style.marginTop = "8px";

    const btnOpen = document.createElement("button");
    btnOpen.type = "button";
    btnOpen.className = `btn ${r.ready ? "warn" : "locked"}`;
    btnOpen.textContent = "Check outcomes";
    btnOpen.disabled = !r.ready;
    btnOpen.addEventListener("click", () => openResultForRoom(r.code, r.participantId || "", r.role || (kind === "created" ? "host" : "guest")).catch(() => {}));

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.className = "btn ghost";
    btnDelete.textContent = "Delete";
    btnDelete.addEventListener("click", async () => {
      const pid = String(r.participantId || "").trim();
      const token = pid ? getTokenByParticipantId(pid) : "";
      if (!token) {
        clearRoomLocal(r.code, pid);
        await renderMyRooms();
        return;
      }
      try {
        if (kind === "created") await apiDeleteRoomAsHost(r.code, token);
        else await apiLeaveRoomAsGuest(r.code, token);
      } catch (e) {
        showToast("Delete failed.");
        return;
      }
      clearRoomLocal(r.code, pid);
      await renderMyRooms();
    });

    btnWrap.appendChild(btnOpen);
    btnWrap.appendChild(btnDelete);
    body.appendChild(btnWrap);

    card.querySelector(".guestResultHeader").addEventListener("click", () => {
      card.classList.toggle("open");
    });
  }

  async function renderMyRooms() {
    const data = await apiListMyRooms();
    const created = Array.isArray(data?.created) ? data.created : [];
    const invited = Array.isArray(data?.invited) ? data.invited : [];

    el.myRoomsCreated.innerHTML = "";
    el.myRoomsInvited.innerHTML = "";

    if (created.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No rooms yet.";
      el.myRoomsCreated.appendChild(empty);
    } else {
      for (const r of created) {
        setRoomMeta(r.code, { shareId: r.shareId, themeKey: r.themeKey, roomName: r.roomName || null });
        renderMyRoomCard(el.myRoomsCreated, r, "created");
      }
    }

    if (invited.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No invited rooms yet.";
      el.myRoomsInvited.appendChild(empty);
    } else {
      for (const r of invited) {
        setRoomMeta(r.code, { shareId: r.shareId, themeKey: r.themeKey, roomName: r.roomName || null });
        renderMyRoomCard(el.myRoomsInvited, r, "invited");
      }
    }
  }

  function openJoinModal(codePrefill) {
    el.joinModal.classList.add("show");
    el.joinModal.setAttribute("aria-hidden", "false");
    el.joinCodeInput.value = codePrefill ? String(codePrefill) : "";
    el.joinNicknameInput.value = "";
    window.setTimeout(() => el.joinCodeInput.focus(), 60);
  }

  function closeJoinModal() {
    el.joinModal.classList.remove("show");
    el.joinModal.setAttribute("aria-hidden", "true");
  }

  function updateUserPill() {
    if (state.currentUser) {
      el.userPill.style.display = "flex";
      el.userDisplayName.textContent = state.currentUser.username || state.currentUser.email || "User";
      if (state.currentUser.avatarUrl) {
        el.userAvatar.src = state.currentUser.avatarUrl;
        el.userAvatar.style.display = "block";
      } else {
        el.userAvatar.style.display = "none";
      }
    } else {
      el.userPill.style.display = "none";
    }
  }

  function handleLoginSuccess(data) {
    state.sessionToken = data.sessionToken;
    state.currentUser = data.user;
    saveSession({ sessionToken: data.sessionToken, user: data.user });
    updateUserPill();
    goto("Home");
    showToast(`Welcome, ${data.user.username || data.user.email || "User"}!`);
  }

  function startCooldown(btn, seconds) {
    btn.disabled = true;
    let remaining = seconds;
    const originalText = btn.textContent;
    btn.textContent = `${remaining}s`;
    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.textContent = originalText;
      } else {
        btn.textContent = `${remaining}s`;
      }
    }, 1000);
  }

  async function tryRestoreSession() {
    const saved = loadSession();
    if (!saved || !saved.sessionToken) {
      goto("Login");
      return false;
    }
    state.sessionToken = saved.sessionToken;
    try {
      const me = await apiGetMe();
      state.currentUser = me;
      saveSession({ sessionToken: saved.sessionToken, user: me });
      updateUserPill();
      goto("Home");
      return true;
    } catch {
      clearSession();
      goto("Login");
      return false;
    }
  }

  async function tryAppListRedirectLogin() {
    const redirect = consumeAppListRedirectParams();
    if (!redirect.consumedToken) return redirect;

    clearSession();
    updateUserPill();
    try {
      const data = await apiLoginWithAppListToken(redirect.accessToken);
      if (data?.ok) {
        handleLoginSuccess(data);
        return { ...redirect, loggedIn: true };
      }
    } catch (e) {
      clearSession();
      updateUserPill();
      goto("Login");
      showToast(e?.status === 401 ? "AppList session expired. Please sign in again." : "AppList login failed.");
      return { ...redirect, loggedIn: false };
    }

    clearSession();
    updateUserPill();
    goto("Login");
    showToast("AppList login failed.");
    return { ...redirect, loggedIn: false };
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }

  function bindEvents() {
    el.brandHome.addEventListener("click", () => {
      closeSse();
      if (state.currentUser) goto("Home");
      else goto("Login");
    });
    el.brandHome.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        closeSse();
        if (state.currentUser) goto("Home");
        else goto("Login");
      }
    });

    el.btnLogout.addEventListener("click", () => {
      clearSession();
      updateUserPill();
      goto("Login");
      showToast("Logged out.");
    });

    el.loginTabs.addEventListener("click", (e) => {
      const tab = e.target.closest(".loginTab");
      if (!tab) return;
      const target = tab.dataset.tab;
      $$(".loginTab").forEach((t) => t.classList.toggle("active", t === tab));
      el.loginPanelCode.style.display = target === "code" ? "block" : "none";
      el.loginPanelPassword.style.display = target === "password" ? "block" : "none";
      el.loginPanelRegister.style.display = target === "wallet" ? "block" : "none";
    });

    el.btnSendCode.addEventListener("click", async () => {
      const email = String(el.loginEmail1.value || "").trim();
      if (!email) { showToast("Enter your email."); return; }
      try {
        await apiSendCode(email);
        showToast("Code sent! Check your inbox.");
        startCooldown(el.btnSendCode, 60);
      } catch (e) {
        showToast(e?.body?.message || "Failed to send code.");
      }
    });

    el.btnLoginCode.addEventListener("click", async () => {
      const email = String(el.loginEmail1.value || "").trim();
      const code = String(el.loginCode.value || "").trim();
      if (!email || !code) { showToast("Enter email and code."); return; }
      try {
        const data = await apiLoginWithEmail(email, code);
        if (data.ok) handleLoginSuccess(data);
        else showToast(data.error || "Login failed.");
      } catch (e) {
        showToast(e?.body?.message || "Login failed.");
      }
    });

    el.btnLoginPassword.addEventListener("click", async () => {
      const email = String(el.loginEmail2.value || "").trim();
      const password = String(el.loginPassword.value || "");
      if (!email || !password) { showToast("Enter email and password."); return; }
      try {
        const data = await apiLoginWithPassword(email, password);
        if (data.ok) handleLoginSuccess(data);
        else showToast(data.error || "Login failed.");
      } catch (e) {
        showToast(e?.body?.message || "Login failed.");
      }
    });

    el.btnConnectWallet.addEventListener("click", async () => {
      if (!window.ethereum) {
        showToast("Please install MetaMask first.");
        return;
      }
      try {
        el.btnConnectWallet.disabled = true;
        el.walletStatus.textContent = "Requesting wallet access...";
        el.walletStatus.style.display = "block";
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        let address = accounts[0];
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        const chainIdNum = parseInt(chainId, 16) || 985;

        el.walletStatus.textContent = "Getting challenge from DataDID...";
        let challenge = await apiEvmChallenge(address, chainIdNum);

        const siweAddress = extractAddressFromSiwe(challenge.message);
        if (siweAddress && siweAddress.toLowerCase() === address.toLowerCase() && siweAddress !== address) {
          address = siweAddress;
          el.walletStatus.textContent = "Re-syncing address format...";
          challenge = await apiEvmChallenge(address, chainIdNum);
        }

        const loginResult = await performEvmSignAndLogin(address, challenge.message, chainIdNum);
        if (loginResult) handleLoginSuccess(loginResult);
      } catch (e) {
        if (e.code === 4001) {
          showToast("Wallet connection rejected.");
        } else {
          showToast(e?.body?.message || "Wallet connection failed.");
        }
      } finally {
        el.walletStatus.style.display = "none";
        el.btnConnectWallet.disabled = false;
      }
    });

    async function performEvmSignAndLogin(address, message, chainIdNum, isRetry) {
      el.walletStatus.textContent = "Please sign the message in MetaMask...";
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, address]
      });
      el.walletStatus.textContent = "Verifying with DataDID...";
      try {
        const data = await apiLoginWithEvm(message, signature);
        if (data.ok) return data;
        showToast(data.error || "Wallet login failed.");
        return null;
      } catch (e) {
        const errBody = e?.body;
        const isNonceExpired = errBody?.message && /1014|login.failed|expired/i.test(errBody.message);
        if (isNonceExpired && !isRetry) {
          el.walletStatus.textContent = "Session expired, retrying...";
          const newChallenge = await apiEvmChallenge(address, chainIdNum);
          return performEvmSignAndLogin(address, newChallenge.message, chainIdNum, true);
        }
        throw e;
      }
    }

    function extractAddressFromSiwe(message) {
      const match = message.match(/0x[0-9a-fA-F]{40}/);
      return match ? match[0] : null;
    }

    el.btnCreate.addEventListener("click", () => {
      closeSse();
      state.mode = "host";
      state.roomCode = "";
      state.nickname = "";
      state.themeKey = "soulmate";
      el.themeSelect.value = "soulmate";
      el.themeSelect.disabled = false;
      el.nicknameInput.value = "";
      el.roomNameInput.value = "";
      goto("Create");
    });

    el.btnJoin.addEventListener("click", () => openJoinModal(""));
    el.btnMyRooms.addEventListener("click", async () => {
      closeSse();
      goto("MyRooms");
      try { await renderMyRooms(); } catch { showToast("Failed to load rooms."); }
    });

    el.btnRefreshMyRooms.addEventListener("click", async () => {
      try { await renderMyRooms(); } catch { showToast("Failed to load rooms."); }
    });

    el.btnBackHomeMyRooms.addEventListener("click", () => goto("Home"));

    el.btnBackHome1.addEventListener("click", () => goto("Home"));
    el.btnBackHome2.addEventListener("click", () => {
      closeSse();
      goto("Home");
    });

    el.btnStartQuiz.addEventListener("click", async () => {
      const themeKey = el.themeSelect.value || "soulmate";
      const nickname = safeName(el.nicknameInput.value) || "Nova";
      const roomName = String(el.roomNameInput.value || "").trim().slice(0, 64) || null;
      state.themeKey = themeKey;
      state.nickname = nickname;
      state.mode = "host";
      state.answers = [];
      state.quizIndex = 0;
      state.roomCode = "";
      state.questionIds = [];
      state.questions = [];
      closeSse();

      try {
        await ensureThemeQuestions(themeKey);
        const room = await apiCreateRoom(themeKey, nickname, roomName);
        state.roomCode = room.code;
        state.roomName = room.roomName || roomName || "";
        state.shareId = room.shareId;
        state.questionIds = room.questionIds || [];
        state.participantId = room.participantId || "";
        state.participantToken = room.participantToken || "";
        if (state.participantId && state.participantToken) {
          saveParticipantToken(room.code, "host", state.participantId, nickname, state.participantToken);
        }
        setRoomMeta(room.code, { shareId: room.shareId, themeKey: room.themeKey, roomName: state.roomName });
        setQuestionsFromIds(themeKey, state.questionIds);
        state.answers = new Array(state.questions.length).fill(null);
        renderQuiz();
        goto("Quiz");
      } catch (e) {
        showToast("Create room failed. Check server & DB.");
      }
    });

    el.btnNext.addEventListener("click", () => nextQuestion().catch(() => {}));
    el.btnPrev.addEventListener("click", () => previousQuestion());

    el.btnCopyLink.addEventListener("click", async () => {
      if (!state.roomCode) return;
      const link = currentInviteLink(state.roomCode);
      const ok = await copyText(link);
      showToast(ok ? "Invite link copied." : "Copy failed. Try manually.");
    });

    el.btnCheckOutcomes.addEventListener("click", async () => {
      if (!state.roomCode) return;
      try { await openResultForRoom(state.roomCode); } catch { showToast("Result not ready."); }
    });

    el.btnPoster.addEventListener("click", () => {
      renderPoster(state.themeKey, state.displayNames || [], state.displayResult);
      goto("Poster");
    });

    el.btnRetry.addEventListener("click", () => {
      closeSse();
      goto("Home");
    });

    el.btnSavePoster.addEventListener("click", () => showToast("Demo: real saving is not supported yet."));
    el.btnBackResult.addEventListener("click", () => goto("Result"));

    el.btnCloseJoin.addEventListener("click", () => closeJoinModal());
    el.btnCancelJoin.addEventListener("click", () => closeJoinModal());
    el.joinModal.addEventListener("click", (e) => { if (e.target === el.joinModal) closeJoinModal(); });

    el.btnConfirmJoin.addEventListener("click", async () => {
      const code = normalizeCode(el.joinCodeInput.value);
      const nickname = safeName(el.joinNicknameInput.value) || "Echo";
      if (!code) { showToast("Enter an invite code."); return; }
      closeSse();
      try {
        const joined = await apiJoinRoom(code, nickname);
        state.mode = "guest";
        state.roomCode = joined.code;
        state.shareId = joined.shareId;
        state.themeKey = joined.themeKey || "soulmate";
        state.nickname = nickname;
        state.questionIds = joined.questionIds || [];
        state.participantId = joined.participantId || "";
        state.participantToken = joined.participantToken || "";
        if (state.participantId && state.participantToken) {
          saveParticipantToken(joined.code, "guest", state.participantId, nickname, state.participantToken);
        }
        setRoomMeta(joined.code, { shareId: joined.shareId, themeKey: joined.themeKey, roomName: joined.roomName || null });
        await ensureThemeQuestions(state.themeKey);
        setQuestionsFromIds(state.themeKey, state.questionIds);
        state.answers = new Array(state.questions.length).fill(null);
        state.quizIndex = 0;
        closeJoinModal();
        renderQuiz();
        goto("Quiz");
      } catch (e) {
        if (e?.status === 410) { showToast("Invite expired."); closeJoinModal(); return; }
        if (e?.status === 409) { showToast("Guest limit reached."); closeJoinModal(); return; }
        showToast("Join failed.");
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeJoinModal();
    });
  }

  function bootFromUrl() {
    const params = new URLSearchParams(location.search || "");
    const code = normalizeCode(params.get("room"));
    if (code) {
      openJoinModal(code);
      showToast("Invite loaded. Enter a nickname to start.");
    }
  }

  async function init() {
    bindEvents();
    const appList = await tryAppListRedirectLogin();
    if (!appList.consumedToken) await tryRestoreSession();
    bootFromUrl();
  }

  return { init };
})();

App.init();
