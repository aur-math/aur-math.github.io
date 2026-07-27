"use strict";

const state = {
  settings: null,
  questions: [],
  startedAt: 0,
  endedAt: 0,
  totalSeconds: 0,
  remainingSeconds: 0,
  timerId: null,
  finished: false,
  latestRecord: null,
  currentUser: null,
  adminUsers: [],
  heartbeatId: null,
  historyPage: 1,
  historyTotalPages: 1,
  historyRenderId: 0
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const setupView = $("#setup-view");
const examView = $("#exam-view");
const resultView = $("#result-view");
const loginView = $("#login-view");
const adminView = $("#admin-view");
const userBar = $("#user-bar");
const form = $("#exam-form");
const countRange = $("#question-count");
const timeRange = $("#exam-time");
const countOutput = $("#count-output");
const timeOutput = $("#time-output");
const previewCount = $("#preview-count");
const questionList = $("#question-list");
const questionTemplate = $("#question-template");
const timer = $("#timer");
const progress = $("#time-progress");
const canvas = $("#scratch-canvas");
const ctx = canvas.getContext("2d");
const historyList = $("#history-list");
const legacyHistoryStorageKey = "kidmath-exam-history";
const visitorStorageKey = "kidmath-visitor-id";
const languageStorageKey = "kidmath-language";
const legacyAuthTokenStorageKey = "kidmath-auth-token";
const apiBaseUrl = String(window.KIDMATH_API_URL || "").replace(/\/$/, "");
const supportedLanguages = ["zh", "en", "fr"];
const languageLocales = {
  zh: "zh-CN",
  en: "en-CA",
  fr: "fr-CA"
};
const translations = {
  zh: {
    languageLabel: "语言选择",
    appTitle: "数学小测",
    paperPreview: "试卷预览",
    questionUnit: "题",
    gradeLevel: "年级难度",
    grade1: "一年级",
    grade2: "二年级",
    grade3: "三年级",
    grade4: "四年级",
    grade5: "五年级",
    operations: "计算方法",
    questionCount: "题目数量",
    examTime: "考试时间",
    minuteValue: "{count} 分钟",
    startExam: "开始考试",
    historyTitle: "历史记录",
    clearHistory: "清空记录",
    examInProgress: "正在考试",
    remaining: "剩余",
    questions: "题目",
    scratchArea: "草稿区域",
    scratchPaper: "草稿纸",
    clearScratch: "清空草稿",
    submitExam: "交卷",
    results: "成绩",
    points: "分",
    tryAnother: "再做一张",
    home: "主页",
    answerAria: "第 {id} 题答案",
    correctSummary: "答对 {correct} / {total} 题",
    timeSummary: "已用 {used}，剩余 {remaining}",
    noAnswer: "未作答",
    yourAnswer: "你的答案：{answer}",
    correctAnswer: "正确答案：{answer}",
    noDetails: "这条记录没有题目明细",
    snapshotTitle: "KIDmath 数学小测",
    scoreLabel: "{score} 分",
    wrongSummary: "错题 {wrong} 题",
    gradeMeta: "{grade} 年级  {ops}  {total} 题",
    noHistory: "还没有考试记录",
    historyLoadFailed: "历史记录暂时无法加载，请稍后重试。",
    screenshotAlt: "{date} 成绩截图",
    historyAria: "查看 {score} 分的试卷明细",
    historyMeta: "{date} · {grade} 年级 · {total} 题",
    historyDetail: "答对 {correct} 题，错题 {wrong} 题，已用 {used}",
    reviewLabel: "查看试卷",
    loginTitle: "登录",
    loginIntro: "使用管理员创建的账号进入数学小测。",
    username: "用户名",
    password: "密码",
    loginAction: "登录",
    invalidLogin: "用户名或密码不正确。",
    loginFailed: "暂时无法登录，请稍后重试。",
    admin: "管理员",
    logout: "退出",
    signedInAs: "{username} · {role}",
    userManagement: "用户管理",
    addUser: "添加用户",
    role: "权限",
    regularUser: "普通用户",
    administrator: "管理员",
    userList: "用户列表",
    refresh: "刷新",
    loginCount: "登录次数",
    usageDuration: "使用时长",
    lastLogin: "最近登录",
    actions: "操作",
    resetPassword: "重置密码",
    deleteUser: "删除",
    passwordPrompt: "请输入 {username} 的新密码（至少 8 个字符）",
    deleteConfirm: "确定删除用户 {username} 吗？该账号会立即退出。",
    userAdded: "用户已添加。",
    passwordReset: "密码已重置，该用户需要重新登录。",
    userDeleted: "用户已删除。",
    usernameExists: "这个用户名已经存在。",
    invalidUser: "用户名需为 2–32 个字符，密码至少 8 个字符。",
    cannotDeleteSelf: "不能删除当前登录的管理员账号。",
    lastAdmin: "必须至少保留一个管理员。",
    adminError: "操作失败，请重试。",
    never: "从未登录",
    sessionExpired: "登录已失效，请重新登录。"
  },
  en: {
    languageLabel: "Language",
    appTitle: "Math Quiz",
    paperPreview: "Test preview",
    questionUnit: "questions",
    gradeLevel: "Grade level",
    grade1: "Grade 1",
    grade2: "Grade 2",
    grade3: "Grade 3",
    grade4: "Grade 4",
    grade5: "Grade 5",
    operations: "Operations",
    questionCount: "Number of questions",
    examTime: "Test time",
    minuteValue: "{count} min",
    startExam: "Start test",
    historyTitle: "Test history",
    clearHistory: "Clear history",
    examInProgress: "Test in progress",
    remaining: "remaining",
    questions: "Questions",
    scratchArea: "Scratch area",
    scratchPaper: "Scratch paper",
    clearScratch: "Clear scratch paper",
    submitExam: "Submit test",
    results: "Results",
    points: "points",
    tryAnother: "Try another",
    home: "Home",
    answerAria: "Answer for question {id}",
    correctSummary: "Correct {correct} / {total}",
    timeSummary: "Used {used}, remaining {remaining}",
    noAnswer: "Not answered",
    yourAnswer: "Your answer: {answer}",
    correctAnswer: "Correct answer: {answer}",
    noDetails: "No question details are available for this test.",
    snapshotTitle: "KIDmath Math Quiz",
    scoreLabel: "{score} points",
    wrongSummary: "Incorrect: {wrong}",
    gradeMeta: "Grade {grade}  {ops}  {total} questions",
    noHistory: "No tests yet",
    historyLoadFailed: "History is temporarily unavailable. Please try again.",
    screenshotAlt: "Score snapshot from {date}",
    historyAria: "View the test scored {score} points",
    historyMeta: "{date} · Grade {grade} · {total} questions",
    historyDetail: "{correct} correct, {wrong} incorrect, used {used}",
    reviewLabel: "View test",
    loginTitle: "Sign in",
    loginIntro: "Use an account created by the administrator.",
    username: "Username",
    password: "Password",
    loginAction: "Sign in",
    invalidLogin: "The username or password is incorrect.",
    loginFailed: "Unable to sign in right now. Please try again.",
    admin: "Admin",
    logout: "Sign out",
    signedInAs: "{username} · {role}",
    userManagement: "User management",
    addUser: "Add user",
    role: "Role",
    regularUser: "User",
    administrator: "Administrator",
    userList: "Users",
    refresh: "Refresh",
    loginCount: "Sign-ins",
    usageDuration: "Usage time",
    lastLogin: "Last sign-in",
    actions: "Actions",
    resetPassword: "Reset password",
    deleteUser: "Delete",
    passwordPrompt: "Enter a new password for {username} (at least 8 characters)",
    deleteConfirm: "Delete {username}? This account will be signed out immediately.",
    userAdded: "User added.",
    passwordReset: "Password reset. The user must sign in again.",
    userDeleted: "User deleted.",
    usernameExists: "That username already exists.",
    invalidUser: "Use a 2–32 character username and a password of at least 8 characters.",
    cannotDeleteSelf: "You cannot delete the administrator account currently signed in.",
    lastAdmin: "At least one administrator must remain.",
    adminError: "The operation failed. Please try again.",
    never: "Never",
    sessionExpired: "Your session expired. Please sign in again."
  },
  fr: {
    languageLabel: "Langue",
    appTitle: "Quiz de maths",
    paperPreview: "Aperçu du test",
    questionUnit: "questions",
    gradeLevel: "Niveau scolaire",
    grade1: "1re année",
    grade2: "2e année",
    grade3: "3e année",
    grade4: "4e année",
    grade5: "5e année",
    operations: "Opérations",
    questionCount: "Nombre de questions",
    examTime: "Durée du test",
    minuteValue: "{count} min",
    startExam: "Commencer le test",
    historyTitle: "Historique des tests",
    clearHistory: "Effacer l’historique",
    examInProgress: "Test en cours",
    remaining: "restant",
    questions: "Questions",
    scratchArea: "Zone de brouillon",
    scratchPaper: "Brouillon",
    clearScratch: "Effacer le brouillon",
    submitExam: "Remettre le test",
    results: "Résultats",
    points: "points",
    tryAnother: "Refaire un test",
    home: "Accueil",
    answerAria: "Réponse à la question {id}",
    correctSummary: "Bonnes réponses : {correct} / {total}",
    timeSummary: "Temps utilisé : {used}, restant : {remaining}",
    noAnswer: "Sans réponse",
    yourAnswer: "Ta réponse : {answer}",
    correctAnswer: "Bonne réponse : {answer}",
    noDetails: "Aucun détail n’est disponible pour ce test.",
    snapshotTitle: "KIDmath · Quiz de maths",
    scoreLabel: "{score} points",
    wrongSummary: "Erreurs : {wrong}",
    gradeMeta: "Niveau {grade}  {ops}  {total} questions",
    noHistory: "Aucun test pour le moment",
    historyLoadFailed: "L’historique est temporairement indisponible. Réessaie plus tard.",
    screenshotAlt: "Capture du résultat du {date}",
    historyAria: "Voir le test ayant obtenu {score} points",
    historyMeta: "{date} · Niveau {grade} · {total} questions",
    historyDetail: "{correct} bonnes réponses, {wrong} erreurs, durée {used}",
    reviewLabel: "Voir le test",
    loginTitle: "Connexion",
    loginIntro: "Utilise un compte créé par l’administrateur.",
    username: "Nom d’utilisateur",
    password: "Mot de passe",
    loginAction: "Se connecter",
    invalidLogin: "Le nom d’utilisateur ou le mot de passe est incorrect.",
    loginFailed: "Connexion impossible pour le moment. Réessaie plus tard.",
    admin: "Admin",
    logout: "Déconnexion",
    signedInAs: "{username} · {role}",
    userManagement: "Gestion des utilisateurs",
    addUser: "Ajouter un utilisateur",
    role: "Rôle",
    regularUser: "Utilisateur",
    administrator: "Administrateur",
    userList: "Utilisateurs",
    refresh: "Actualiser",
    loginCount: "Connexions",
    usageDuration: "Temps d’utilisation",
    lastLogin: "Dernière connexion",
    actions: "Actions",
    resetPassword: "Réinitialiser le mot de passe",
    deleteUser: "Supprimer",
    passwordPrompt: "Entre un nouveau mot de passe pour {username} (au moins 8 caractères)",
    deleteConfirm: "Supprimer {username} ? Ce compte sera immédiatement déconnecté.",
    userAdded: "Utilisateur ajouté.",
    passwordReset: "Mot de passe réinitialisé. L’utilisateur doit se reconnecter.",
    userDeleted: "Utilisateur supprimé.",
    usernameExists: "Ce nom d’utilisateur existe déjà.",
    invalidUser: "Le nom doit contenir 2 à 32 caractères et le mot de passe au moins 8 caractères.",
    cannotDeleteSelf: "Tu ne peux pas supprimer le compte administrateur actuellement connecté.",
    lastAdmin: "Il faut conserver au moins un administrateur.",
    adminError: "L’opération a échoué. Réessaie.",
    never: "Jamais",
    sessionExpired: "La session a expiré. Reconnecte-toi."
  }
};
const storedLanguage = localStorage.getItem(languageStorageKey);
let currentLanguage = supportedLanguages.includes(storedLanguage) ? storedLanguage : "zh";

function t(key, values = {}) {
  const template = translations[currentLanguage][key] || translations.zh[key] || key;
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    template
  );
}

function normalizedStoredAnswer(value) {
  const answer = String(value || "").trim();
  const emptyLabels = Object.values(translations).map((language) => language.noAnswer);
  return emptyLabels.includes(answer) ? "" : answer;
}

function apiUrl(path) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(apiUrl(path), { ...options, headers, credentials: "include" });
  const payload =
    response.status === 204
      ? null
      : await response.json().catch(() => ({ error: "INVALID_RESPONSE" }));
  if (!response.ok) {
    const error = new Error(payload?.error || "REQUEST_FAILED");
    error.code = payload?.error || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return payload;
}

function historyStorageKey() {
  return state.currentUser
    ? `${legacyHistoryStorageKey}-${state.currentUser.id}`
    : `${legacyHistoryStorageKey}-anonymous`;
}

async function migrateLegacyHistory() {
  if (!state.currentUser) return;
  const legacyHistory = localStorage.getItem(legacyHistoryStorageKey);
  if (legacyHistory && !localStorage.getItem(historyStorageKey())) {
    localStorage.setItem(historyStorageKey(), legacyHistory);
  }
  const migrationKey = `kidmath-cloud-history-migrated-${state.currentUser.id}`;
  if (localStorage.getItem(migrationKey)) return;
  const records = loadHistory().slice(0, 30).reverse();
  try {
    for (const record of records) {
      await apiRequest("/api/history", {
        method: "POST",
        body: JSON.stringify(record)
      });
    }
    localStorage.setItem(migrationKey, new Date().toISOString());
    localStorage.removeItem(historyStorageKey());
    localStorage.removeItem(legacyHistoryStorageKey);
    await renderHistory(1);
  } catch (error) {
    console.error("Unable to migrate local exam history", error);
  }
}

function roleLabel(role) {
  return t(role === "admin" ? "administrator" : "regularUser");
}

function updateCurrentUserDisplay() {
  if (!state.currentUser) return;
  $("#current-user").textContent = t("signedInAs", {
    username: state.currentUser.username,
    role: roleLabel(state.currentUser.role)
  });
  $("#open-admin").classList.toggle("hidden", state.currentUser.role !== "admin");
}

function showLogin(messageKey = "") {
  clearInterval(state.heartbeatId);
  state.currentUser = null;
  state.adminUsers = [];
  localStorage.removeItem(legacyAuthTokenStorageKey);
  $("#login-password").value = "";
  [setupView, examView, resultView, adminView].forEach((view) => view.classList.add("hidden"));
  userBar.classList.add("hidden");
  loginView.classList.remove("hidden");
  const message = $("#login-error");
  message.textContent = messageKey ? t(messageKey) : "";
  message.classList.toggle("hidden", !messageKey);
}

function startHeartbeat() {
  clearInterval(state.heartbeatId);
  const heartbeat = () => {
    if (!state.currentUser || document.visibilityState !== "visible") return;
    apiRequest("/api/usage/heartbeat", { method: "POST" }).catch((error) => {
      if (error.status === 401) showLogin("sessionExpired");
    });
  };
  state.heartbeatId = setInterval(heartbeat, 30000);
}

function showAuthenticatedApp(user) {
  state.currentUser = user;
  migrateLegacyHistory();
  loginView.classList.add("hidden");
  userBar.classList.remove("hidden");
  updateCurrentUserDisplay();
  switchView(setupView);
  startHeartbeat();
}

async function restoreSession() {
  localStorage.removeItem(legacyAuthTokenStorageKey);
  try {
    const result = await apiRequest("/api/auth/me");
    showAuthenticatedApp(result.user);
  } catch {
    showLogin("sessionExpired");
  }
}

async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch {}
  showLogin();
}

function formatUsage(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function adminMessageKey(errorCode) {
  const messages = {
    USERNAME_EXISTS: "usernameExists",
    INVALID_USER: "invalidUser",
    INVALID_PASSWORD: "invalidUser",
    CANNOT_DELETE_SELF: "cannotDeleteSelf",
    LAST_ADMIN: "lastAdmin"
  };
  return messages[errorCode] || "adminError";
}

function showAdminMessage(key, isError = false) {
  const message = $("#admin-message");
  message.textContent = t(key);
  message.classList.remove("hidden");
  message.classList.toggle("error-message", isError);
}

function renderAdminUsers() {
  const list = $("#user-list");
  list.textContent = "";
  state.adminUsers.forEach((user) => {
    const row = document.createElement("tr");
    const username = document.createElement("td");
    const role = document.createElement("td");
    const loginCount = document.createElement("td");
    const usage = document.createElement("td");
    const lastLogin = document.createElement("td");
    const actions = document.createElement("td");
    const roleBadge = document.createElement("span");
    const resetButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    username.textContent = user.username;
    roleBadge.className = "role-badge";
    roleBadge.textContent = roleLabel(user.role);
    role.appendChild(roleBadge);
    loginCount.textContent = String(user.loginCount || 0);
    usage.textContent = formatUsage(user.usageSeconds);
    lastLogin.textContent = user.lastLogin ? formatDateTime(user.lastLogin) : t("never");
    actions.className = "table-actions";

    resetButton.className = "table-action";
    resetButton.type = "button";
    resetButton.textContent = t("resetPassword");
    resetButton.addEventListener("click", () => resetUserPassword(user));

    deleteButton.className = "table-action danger";
    deleteButton.type = "button";
    deleteButton.textContent = t("deleteUser");
    deleteButton.disabled = user.id === state.currentUser?.id;
    deleteButton.addEventListener("click", () => deleteUser(user));

    actions.append(resetButton, deleteButton);
    row.append(username, role, loginCount, usage, lastLogin, actions);
    list.appendChild(row);
  });
}

async function loadAdminUsers() {
  try {
    const result = await apiRequest("/api/admin/users");
    state.adminUsers = result.users;
    renderAdminUsers();
  } catch (error) {
    if (error.status === 401) showLogin("sessionExpired");
    else showAdminMessage("adminError", true);
  }
}

async function resetUserPassword(user) {
  const password = window.prompt(t("passwordPrompt", { username: user.username }));
  if (password === null) return;
  if (password.length < 8) {
    showAdminMessage("invalidUser", true);
    return;
  }
  try {
    await apiRequest(`/api/admin/users/${encodeURIComponent(user.id)}/password`, {
      method: "PUT",
      body: JSON.stringify({ password })
    });
    showAdminMessage("passwordReset");
    if (user.id === state.currentUser?.id) {
      showLogin("sessionExpired");
    } else {
      await loadAdminUsers();
    }
  } catch (error) {
    showAdminMessage(adminMessageKey(error.code), true);
  }
}

async function deleteUser(user) {
  if (!window.confirm(t("deleteConfirm", { username: user.username }))) return;
  try {
    await apiRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, {
      method: "DELETE"
    });
    showAdminMessage("userDeleted");
    await loadAdminUsers();
  } catch (error) {
    showAdminMessage(adminMessageKey(error.code), true);
  }
}

function applyLanguage(language) {
  currentLanguage = supportedLanguages.includes(language) ? language : "zh";
  localStorage.setItem(languageStorageKey, currentLanguage);
  document.documentElement.lang = languageLocales[currentLanguage];
  document.title = `KIDmath · ${t("appTitle")}`;

  $$("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  $$("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });
  $$("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === currentLanguage));
  });
  $$(".answer-input").forEach((input) => {
    input.setAttribute("aria-label", t("answerAria", { id: input.dataset.id }));
  });

  updateRangeLabels();
  updateCurrentUserDisplay();
  renderHistory();
  renderAdminUsers();
  if (!resultView.classList.contains("hidden") && state.latestRecord) {
    renderResultRecord(state.latestRecord);
  } else {
    $("#result-summary").textContent = t("correctSummary", { correct: 0, total: 0 });
    $("#time-summary").textContent = t("timeSummary", { used: "00:00", remaining: "00:00" });
  }
}

function recordVisit() {
  let visitorId = localStorage.getItem(visitorStorageKey);
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(visitorStorageKey, visitorId);
  }

  fetch(apiUrl("/api/visit"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId }),
    keepalive: true
  }).catch(() => {});
}

const operatorLabel = {
  "+": "+",
  "-": "-",
  "*": "×",
  "/": "÷"
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) {
  return items[randomInt(0, items.length - 1)];
}

function updateRangeLabels() {
  countOutput.value = countRange.value;
  previewCount.textContent = countRange.value;
  timeOutput.value = t("minuteValue", { count: timeRange.value });
}

function getSettings() {
  const grade = Number(new FormData(form).get("grade"));
  const ops = $$("input[name='ops']:checked").map((input) => input.value);
  return {
    grade,
    ops: ops.length ? ops : ["+"],
    count: Number(countRange.value),
    minutes: Number(timeRange.value)
  };
}

function rangeForGrade(grade, op) {
  const ranges = {
    1: { "+": [1, 20], "-": [1, 20], "*": [1, 5], "/": [1, 5] },
    2: { "+": [1, 100], "-": [1, 100], "*": [2, 9], "/": [2, 9] },
    3: { "+": [10, 300], "-": [10, 300], "*": [2, 12], "/": [2, 12] },
    4: { "+": [100, 999], "-": [100, 999], "*": [10, 99], "/": [2, 20] },
    5: { "+": [200, 3000], "-": [200, 3000], "*": [12, 125], "/": [2, 25] }
  };
  return ranges[grade][op];
}

function createQuestion(settings, index) {
  const op = pick(settings.ops);
  const [min, max] = rangeForGrade(settings.grade, op);
  let left;
  let right;
  let answer;

  if (op === "+") {
    left = randomInt(min, max);
    right = randomInt(min, max);
    answer = left + right;
  }

  if (op === "-") {
    left = randomInt(min, max);
    right = randomInt(min, max);
    if (left < right) [left, right] = [right, left];
    answer = left - right;
  }

  if (op === "*") {
    const multiplierMax = settings.grade >= 4 ? 12 : max;
    left = randomInt(min, max);
    right = randomInt(2, multiplierMax);
    answer = left * right;
  }

  if (op === "/") {
    right = randomInt(min, max);
    answer = randomInt(2, settings.grade <= 2 ? 9 : settings.grade <= 4 ? 20 : 50);
    left = right * answer;
  }

  return {
    id: index + 1,
    left,
    right,
    op,
    answer,
    userAnswer: "",
    text: `${left} ${operatorLabel[op]} ${right} =`
  };
}

function generatePaper(settings) {
  return Array.from({ length: settings.count }, (_, index) => createQuestion(settings, index));
}

function switchView(view) {
  [setupView, examView, resultView, adminView].forEach((item) => item.classList.add("hidden"));
  view.classList.remove("hidden");
  if (view === setupView) renderHistory();
}

function renderQuestions() {
  questionList.textContent = "";
  state.questions.forEach((question) => {
    const node = questionTemplate.content.firstElementChild.cloneNode(true);
    const text = node.querySelector(".question-text");
    const input = node.querySelector(".answer-input");
    text.textContent = `${question.id}. ${question.text}`;
    input.dataset.id = question.id;
    input.setAttribute("aria-label", t("answerAria", { id: question.id }));
    questionList.appendChild(node);
  });
}

function formatSeconds(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function updateTimer() {
  const elapsed = Math.min(state.totalSeconds, Math.floor((Date.now() - state.startedAt) / 1000));
  state.remainingSeconds = Math.max(0, state.totalSeconds - elapsed);
  timer.textContent = formatSeconds(state.remainingSeconds);
  const ratio = state.totalSeconds ? state.remainingSeconds / state.totalSeconds : 0;
  progress.style.transform = `scaleX(${Math.max(0, ratio)})`;

  if (state.remainingSeconds <= 0) {
    finishExam();
  }
}

function startTimer() {
  clearInterval(state.timerId);
  state.totalSeconds = state.settings.minutes * 60;
  state.remainingSeconds = state.totalSeconds;
  state.startedAt = Date.now();
  state.endedAt = 0;
  updateTimer();
  state.timerId = setInterval(updateTimer, 1000);
}

function normalizeAnswer(value) {
  const cleaned = String(value).trim().replace("，", ".").replace(",", ".");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function collectAnswers() {
  $$(".answer-input").forEach((input) => {
    const id = Number(input.dataset.id);
    const question = state.questions.find((item) => item.id === id);
    question.userAnswer = input.value;
  });
}

async function finishExam() {
  if (state.finished) return;
  state.finished = true;
  state.endedAt = Date.now();
  clearInterval(state.timerId);
  const elapsed = Math.min(state.totalSeconds, Math.ceil((state.endedAt - state.startedAt) / 1000));
  state.remainingSeconds = Math.max(0, state.totalSeconds - elapsed);
  collectAnswers();
  const record = renderResults(elapsed, state.remainingSeconds);
  try {
    await saveHistoryRecord(record);
  } catch (error) {
    console.error("Unable to sync exam history", error);
  }
  state.settings = record.settings;
  switchView(resultView);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderResults(usedSeconds, remainingSeconds) {
  const results = state.questions.map((question) => {
    const userNumber = normalizeAnswer(question.userAnswer);
    const correct = userNumber === question.answer;
    return { ...question, userNumber, correct };
  });
  const correctCount = results.filter((item) => item.correct).length;
  const score = Math.round((correctCount / results.length) * 100);

  $("#score-value").textContent = score;
  $("#result-summary").textContent = t("correctSummary", {
    correct: correctCount,
    total: results.length
  });
  $("#time-summary").textContent = t("timeSummary", {
    used: formatSeconds(usedSeconds),
    remaining: formatSeconds(remainingSeconds)
  });

  const reviewList = $("#review-list");
  reviewList.textContent = "";
  results.forEach((item) => {
    const article = document.createElement("article");
    const question = document.createElement("strong");
    const answer = document.createElement("span");
    const correctAnswer = document.createElement("span");
    article.className = `review-item${item.correct ? "" : " wrong"}`;
    const answerText = item.userAnswer.trim() || t("noAnswer");
    question.textContent = `${item.id}. ${item.text}`;
    answer.textContent = t("yourAnswer", { answer: answerText });
    correctAnswer.className = "correct-answer";
    correctAnswer.textContent = t("correctAnswer", { answer: item.answer });
    article.append(question, answer, correctAnswer);
    reviewList.appendChild(article);
  });

  state.latestRecord = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    settings: { ...state.settings },
    score,
    correctCount,
    totalCount: results.length,
    wrongCount: results.length - correctCount,
    usedSeconds,
    remainingSeconds,
    results: results.map((item) => ({
      id: item.id,
      text: item.text,
      answer: item.answer,
      userAnswer: item.userAnswer.trim(),
      correct: item.correct
    }))
  };
  state.latestRecord.snapshot = createResultSnapshot(state.latestRecord);
  return state.latestRecord;
}

function renderResultRecord(record) {
  state.latestRecord = record;
  state.settings = record.settings;
  $("#score-value").textContent = record.score;
  $("#result-summary").textContent = t("correctSummary", {
    correct: record.correctCount,
    total: record.totalCount
  });
  $("#time-summary").textContent = t("timeSummary", {
    used: formatSeconds(record.usedSeconds),
    remaining: formatSeconds(record.remainingSeconds)
  });

  const reviewList = $("#review-list");
  reviewList.textContent = "";
  const results = Array.isArray(record.results) ? record.results : [];

  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = t("noDetails");
    reviewList.appendChild(empty);
    return;
  }

  results.forEach((item) => {
    const article = document.createElement("article");
    const question = document.createElement("strong");
    const answer = document.createElement("span");
    const correctAnswer = document.createElement("span");
    article.className = `review-item${item.correct ? "" : " wrong"}`;
    question.textContent = `${item.id}. ${item.text}`;
    const answerText = normalizedStoredAnswer(item.userAnswer) || t("noAnswer");
    answer.textContent = t("yourAnswer", { answer: answerText });
    correctAnswer.className = "correct-answer";
    correctAnswer.textContent = t("correctAnswer", { answer: item.answer });
    article.append(question, answer, correctAnswer);
    reviewList.appendChild(article);
  });
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(historyStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(records) {
  localStorage.setItem(historyStorageKey(), JSON.stringify(records));
}

async function saveHistoryRecord(record) {
  await apiRequest("/api/history", {
    method: "POST",
    body: JSON.stringify(record)
  });
  state.historyPage = 1;
  await renderHistory();
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(languageLocales[currentLanguage], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function describeOps(ops) {
  return ops.map((op) => operatorLabel[op]).join(" ");
}

function createResultSnapshot(record) {
  const snapshotCanvas = document.createElement("canvas");
  const snapshotCtx = snapshotCanvas.getContext("2d");
  snapshotCanvas.width = 720;
  snapshotCanvas.height = 460;

  snapshotCtx.fillStyle = "#fffaf0";
  snapshotCtx.fillRect(0, 0, snapshotCanvas.width, snapshotCanvas.height);
  snapshotCtx.fillStyle = "#ffffff";
  snapshotCtx.strokeStyle = "#ded7c9";
  snapshotCtx.lineWidth = 4;
  snapshotCtx.beginPath();
  snapshotCtx.roundRect(30, 30, 660, 400, 24);
  snapshotCtx.fill();
  snapshotCtx.stroke();

  snapshotCtx.fillStyle = "#286c5b";
  snapshotCtx.font = "700 30px system-ui, sans-serif";
  snapshotCtx.fillText(t("snapshotTitle"), 64, 88);

  snapshotCtx.fillStyle = "#174c41";
  snapshotCtx.font = "900 96px system-ui, sans-serif";
  snapshotCtx.fillText(t("scoreLabel", { score: record.score }), 64, 190);

  snapshotCtx.fillStyle = "#202124";
  snapshotCtx.font = "700 34px system-ui, sans-serif";
  snapshotCtx.fillText(t("correctSummary", {
    correct: record.correctCount,
    total: record.totalCount
  }), 64, 252);

  snapshotCtx.fillStyle = record.wrongCount ? "#b43c36" : "#2e7d54";
  snapshotCtx.fillText(t("wrongSummary", { wrong: record.wrongCount }), 64, 304);

  snapshotCtx.fillStyle = "#6d6a60";
  snapshotCtx.font = "650 26px system-ui, sans-serif";
  snapshotCtx.fillText(t("timeSummary", {
    used: formatSeconds(record.usedSeconds),
    remaining: formatSeconds(record.remainingSeconds)
  }), 64, 358);
  snapshotCtx.fillText(t("gradeMeta", {
    grade: record.settings.grade,
    ops: describeOps(record.settings.ops),
    total: record.totalCount
  }), 64, 396);

  return snapshotCanvas.toDataURL("image/png");
}

async function loadHistoryPage(page = 1) {
  return apiRequest(`/api/history?page=${page}`);
}

async function loadHistoryRecord(id) {
  const response = await apiRequest(`/api/history/${encodeURIComponent(id)}`);
  return response.record;
}

async function renderHistory(page = state.historyPage) {
  const renderId = ++state.historyRenderId;
  historyList.textContent = "";
  const pagination = $("#history-pagination");
  pagination.classList.add("hidden");
  let response;
  try {
    response = await loadHistoryPage(page);
  } catch {
    if (renderId !== state.historyRenderId) return;
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = t("historyLoadFailed");
    historyList.appendChild(empty);
    return;
  }
  if (renderId !== state.historyRenderId) return;
  const records = response.records;
  state.historyPage = response.page;
  state.historyTotalPages = response.totalPages;

  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = t("noHistory");
    historyList.appendChild(empty);
    return;
  }

  records.forEach((record) => {
    const item = document.createElement("article");
    const image = document.createElement("img");
    const body = document.createElement("div");
    const title = document.createElement("button");
    const meta = document.createElement("span");
    const detail = document.createElement("span");

    item.className = "history-item";
    image.src = createResultSnapshot(record);
    image.alt = t("screenshotAlt", { date: formatDateTime(record.createdAt) });
    body.className = "history-body";
    title.className = "history-score-button";
    title.type = "button";
    title.setAttribute("aria-label", t("historyAria", { score: record.score }));
    title.dataset.reviewLabel = t("reviewLabel");
    title.textContent = t("scoreLabel", { score: record.score });
    meta.textContent = t("historyMeta", {
      date: formatDateTime(record.createdAt),
      grade: record.settings.grade,
      total: record.totalCount
    });
    detail.textContent = t("historyDetail", {
      correct: record.correctCount,
      wrong: record.wrongCount,
      used: formatSeconds(record.usedSeconds)
    });
    title.addEventListener("click", async () => {
      title.disabled = true;
      try {
        const fullRecord = await loadHistoryRecord(record.id);
        renderResultRecord(fullRecord);
        switchView(resultView);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } finally {
        title.disabled = false;
      }
    });
    body.append(title, meta, detail);
    item.append(image, body);
    historyList.appendChild(item);
  });

  $("#history-page-status").textContent = `${response.page} / ${response.totalPages}`;
  $("#history-previous").disabled = response.page <= 1;
  $("#history-next").disabled = response.page >= response.totalPages;
  pagination.classList.toggle("hidden", response.totalPages <= 1);
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const snapshot = document.createElement("canvas");
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  snapshot.getContext("2d").drawImage(canvas, 0, 0);

  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#202124";

  if (snapshot.width && snapshot.height) {
    ctx.drawImage(snapshot, 0, 0, snapshot.width / ratio, snapshot.height / ratio);
  }
}

function setupCanvas() {
  let drawing = false;
  let lastPoint = null;

  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    lastPoint = pointFromEvent(event);
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const point = pointFromEvent(event);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint = point;
  });

  const stopDrawing = () => {
    drawing = false;
    lastPoint = null;
  };

  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);
  $("#clear-canvas").addEventListener("click", clearCanvas);
  window.addEventListener("resize", resizeCanvas);
}

function startExam(settings) {
  state.settings = settings;
  state.questions = generatePaper(settings);
  state.finished = false;
  state.latestRecord = null;
  renderQuestions();
  switchView(examView);
  resizeCanvas();
  clearCanvas();
  startTimer();
  const firstInput = $(".answer-input");
  if (firstInput) firstInput.focus({ preventScroll: true });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  startExam(getSettings());
});

countRange.addEventListener("input", updateRangeLabels);
timeRange.addEventListener("input", updateRangeLabels);

$("#finish-exam").addEventListener("click", finishExam);
$("#retry-same").addEventListener("click", () => startExam(state.settings));
$("#back-setup").addEventListener("click", () => {
  clearInterval(state.timerId);
  switchView(setupView);
});

$("#clear-history").addEventListener("click", async () => {
  await apiRequest("/api/history", { method: "DELETE" });
  state.historyPage = 1;
  await renderHistory();
});

$("#history-previous").addEventListener("click", () => {
  if (state.historyPage > 1) renderHistory(state.historyPage - 1);
});

$("#history-next").addEventListener("click", () => {
  if (state.historyPage < state.historyTotalPages) renderHistory(state.historyPage + 1);
});

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("#login-submit");
  const message = $("#login-error");
  submit.disabled = true;
  message.classList.add("hidden");
  try {
    const result = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("#login-username").value,
        password: $("#login-password").value
      })
    });
    $("#login-password").value = "";
    showAuthenticatedApp(result.user);
  } catch (error) {
    message.textContent = t(error.code === "INVALID_CREDENTIALS" ? "invalidLogin" : "loginFailed");
    message.classList.remove("hidden");
  } finally {
    submit.disabled = false;
  }
});

$("#logout").addEventListener("click", logout);

$("#open-admin").addEventListener("click", () => {
  if (state.currentUser?.role !== "admin") return;
  switchView(adminView);
  $("#admin-message").classList.add("hidden");
  loadAdminUsers();
});

$("#admin-home").addEventListener("click", () => switchView(setupView));
$("#refresh-users").addEventListener("click", loadAdminUsers);

$("#create-user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const createUserForm = event.currentTarget;
  const input = new FormData(createUserForm);
  try {
    await apiRequest("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        username: input.get("username"),
        password: input.get("password"),
        role: input.get("role")
      })
    });
    createUserForm.reset();
    showAdminMessage("userAdded");
    await loadAdminUsers();
  } catch (error) {
    showAdminMessage(adminMessageKey(error.code), true);
  }
});

$$("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !state.currentUser) return;
  apiRequest("/api/usage/heartbeat", { method: "POST" }).catch((error) => {
    if (error.status === 401) showLogin("sessionExpired");
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

setupCanvas();
applyLanguage(currentLanguage);
recordVisit();
restoreSession();
