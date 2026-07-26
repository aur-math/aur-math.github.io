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
  latestRecord: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const setupView = $("#setup-view");
const examView = $("#exam-view");
const resultView = $("#result-view");
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
const historyStorageKey = "kidmath-exam-history";
const visitorStorageKey = "kidmath-visitor-id";

function recordVisit() {
  let visitorId = localStorage.getItem(visitorStorageKey);
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(visitorStorageKey, visitorId);
  }

  fetch("/api/visit", {
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
  timeOutput.value = `${timeRange.value} 分钟`;
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
  [setupView, examView, resultView].forEach((item) => item.classList.add("hidden"));
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
    input.setAttribute("aria-label", `第 ${question.id} 题答案`);
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

function finishExam() {
  if (state.finished) return;
  state.finished = true;
  state.endedAt = Date.now();
  clearInterval(state.timerId);
  const elapsed = Math.min(state.totalSeconds, Math.ceil((state.endedAt - state.startedAt) / 1000));
  state.remainingSeconds = Math.max(0, state.totalSeconds - elapsed);
  collectAnswers();
  const record = renderResults(elapsed, state.remainingSeconds);
  saveHistoryRecord(record);
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
  $("#result-summary").textContent = `答对 ${correctCount} / ${results.length} 题`;
  $("#time-summary").textContent = `已用 ${formatSeconds(usedSeconds)}，剩余 ${formatSeconds(remainingSeconds)}`;

  const reviewList = $("#review-list");
  reviewList.textContent = "";
  results.forEach((item) => {
    const article = document.createElement("article");
    const question = document.createElement("strong");
    const answer = document.createElement("span");
    const correctAnswer = document.createElement("span");
    article.className = `review-item${item.correct ? "" : " wrong"}`;
    const answerText = item.userAnswer.trim() || "未作答";
    question.textContent = `${item.id}. ${item.text}`;
    answer.textContent = `你的答案：${answerText}`;
    correctAnswer.className = "correct-answer";
    correctAnswer.textContent = `正确答案：${item.answer}`;
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
      userAnswer: item.userAnswer.trim() || "未作答",
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
  $("#result-summary").textContent = `答对 ${record.correctCount} / ${record.totalCount} 题`;
  $("#time-summary").textContent = `已用 ${formatSeconds(record.usedSeconds)}，剩余 ${formatSeconds(record.remainingSeconds)}`;

  const reviewList = $("#review-list");
  reviewList.textContent = "";
  const results = Array.isArray(record.results) ? record.results : [];

  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "这条记录没有题目明细";
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
    answer.textContent = `你的答案：${item.userAnswer || "未作答"}`;
    correctAnswer.className = "correct-answer";
    correctAnswer.textContent = `正确答案：${item.answer}`;
    article.append(question, answer, correctAnswer);
    reviewList.appendChild(article);
  });
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(historyStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(records) {
  localStorage.setItem(historyStorageKey, JSON.stringify(records));
}

function saveHistoryRecord(record) {
  const records = loadHistory();
  records.unshift(record);
  saveHistory(records.slice(0, 50));
  renderHistory();
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
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
  snapshotCtx.fillText("KIDmath 数学小测", 64, 88);

  snapshotCtx.fillStyle = "#174c41";
  snapshotCtx.font = "900 96px system-ui, sans-serif";
  snapshotCtx.fillText(`${record.score} 分`, 64, 190);

  snapshotCtx.fillStyle = "#202124";
  snapshotCtx.font = "700 34px system-ui, sans-serif";
  snapshotCtx.fillText(`答对 ${record.correctCount} / ${record.totalCount} 题`, 64, 252);

  snapshotCtx.fillStyle = record.wrongCount ? "#b43c36" : "#2e7d54";
  snapshotCtx.fillText(`错题 ${record.wrongCount} 题`, 64, 304);

  snapshotCtx.fillStyle = "#6d6a60";
  snapshotCtx.font = "650 26px system-ui, sans-serif";
  snapshotCtx.fillText(`已用 ${formatSeconds(record.usedSeconds)}  剩余 ${formatSeconds(record.remainingSeconds)}`, 64, 358);
  snapshotCtx.fillText(`${record.settings.grade} 年级  ${describeOps(record.settings.ops)}  ${record.totalCount} 题`, 64, 396);

  return snapshotCanvas.toDataURL("image/png");
}

function renderHistory() {
  const records = loadHistory();
  historyList.textContent = "";

  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "还没有考试记录";
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
    image.src = record.snapshot;
    image.alt = `${formatDateTime(record.createdAt)} 成绩截图`;
    body.className = "history-body";
    title.className = "history-score-button";
    title.type = "button";
    title.setAttribute("aria-label", `查看 ${record.score} 分的试卷明细`);
    title.textContent = `${record.score} 分`;
    meta.textContent = `${formatDateTime(record.createdAt)} · ${record.settings.grade} 年级 · ${record.totalCount} 题`;
    detail.textContent = `答对 ${record.correctCount} 题，错题 ${record.wrongCount} 题，已用 ${formatSeconds(record.usedSeconds)}`;
    title.addEventListener("click", () => {
      renderResultRecord(record);
      switchView(resultView);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    body.append(title, meta, detail);
    item.append(image, body);
    historyList.appendChild(item);
  });
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

$("#clear-history").addEventListener("click", () => {
  localStorage.removeItem(historyStorageKey);
  renderHistory();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

updateRangeLabels();
setupCanvas();
renderHistory();
recordVisit();
