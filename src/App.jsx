import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import "./App.css";
import pandaCorrect from "./panda_correct.svg";
import pandaStreak from "./panda_streak.svg";
import pandaWrong from "./panda_wrong.svg";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1ZQn3vKJH6fPpJIrwJiPYfIvbm9p9-Qq7kiRbUpfIuoY/gviz/tq?tqx=out:csv&sheet=questions";
const HISTORY_BACKUP_URL =
  "https://script.google.com/macros/s/AKfycbyv4WpHkNqQpFwWcebPkiqVgwq6bWr95YoE5gvyrnAwxxUcgqfmxTT8JrmQF2cXoORTyQ/exec";

const CURRENT_USER_KEY = "studyApp.currentUser.v4";
const DEVICE_ID_KEY = "studyApp.deviceId.v1";
const BACKUP_META_KEY = "studyApp.historyBackupMeta.v1";
const BACKUP_QUEUE_KEY = "studyApp.historyBackupQueue.v1";
const CHOICE_DELAY_MS = 1000;
const QUICK_ANSWER_MS = 3500;
const SLOW_ANSWER_MS = 3000;
const SESSION_SIZE = 25;
const HISTORY_BACKUP_INTERVAL_MS = 5 * 60 * 1000;
const HISTORY_BACKUP_EVERY_ANSWERS = 5;
const DEFAULT_USERS = ["IT", "TM", "YK", "HR", "IC", "OT"];
const ANSWER_FORMATS = {
  CHOICE: "choice",
  INPUT: "input",
};

const FALLBACK_QUESTIONS = [
  {
    id: "eng_vocab_t1_a_001",
    subject: "英語",
    unit: "英単語",
    largeCategory: "基礎語彙",
    middleCategory: "日常・学校",
    question: "次の文の空所に入る最も適切な語を選びなさい: The new library is within walking distance, so it is very _____ for students.",
    choices: ["convenient", "confident", "constant", "creative", "ordinary", "distant", "expensive", "familiar"],
    answerIndex: 0,
    tags: ["IT"],
    explanation: "within walking distance から「便利な」を表す convenient が適切です。",
    difficulty: 3,
    enabled: true,
  },
  {
    id: "eng_vocab_t1_a_002",
    subject: "英語",
    unit: "英単語",
    largeCategory: "基礎語彙",
    middleCategory: "IT・情報",
    question: "次の英文の下線部に最も近い意味を選びなさい: The teacher asked us to examine the data carefully.",
    choices: ["look at", "throw away", "wait for", "laugh at", "depend on", "give up", "turn off", "write down"],
    answerIndex: 0,
    tags: ["IT", "経済"],
    explanation: "examine は「詳しく調べる」。文脈上 look at carefully に近い意味です。",
    difficulty: 3,
    enabled: true,
  },
  {
    id: "eng_vocab_t1_b_001",
    subject: "英語",
    unit: "英単語",
    largeCategory: "社会語彙",
    middleCategory: "環境",
    question: "次の文の空所に入る最も適切な語を選びなさい: Many people are concerned about the _____ of plastic waste on marine life.",
    choices: ["impact", "entrance", "schedule", "permission", "habit", "surface", "address", "journey"],
    answerIndex: 0,
    tags: ["環境"],
    explanation: "be concerned about the impact of ... で「...の影響を心配する」という形です。",
    difficulty: 4,
    enabled: true,
  },
  {
    id: "eng_grammar_t1_a_001",
    subject: "英語",
    unit: "英文法",
    largeCategory: "文法",
    middleCategory: "時制",
    question: "次の文が自然な英文になるように選びなさい: I have never seen such a beautiful sunset _____ I visited Okinawa.",
    choices: ["since", "while", "because", "although", "unless", "before", "until", "if"],
    answerIndex: 0,
    tags: ["環境"],
    explanation: "現在完了 have never seen と過去の起点を表す since の組み合わせです。",
    difficulty: 4,
    enabled: true,
  },
  {
    id: "eng_reading_t1_a_001",
    subject: "英語",
    unit: "読解",
    largeCategory: "読解",
    middleCategory: "要旨把握",
    question: "本文要旨問題: A student says that studying with short breaks helped her remember more. What is the main point?",
    choices: [
      "Taking planned breaks can improve learning.",
      "Students should study only at night.",
      "Long classes are always better.",
      "Remembering names is not important.",
      "Teachers should avoid giving homework.",
      "Phones are necessary in every class.",
      "Libraries should close earlier.",
      "Tests are easier than presentations.",
    ],
    answerIndex: 0,
    tags: ["IT", "経済"],
    explanation: "短い休憩を入れることで記憶しやすくなった、という主張が中心です。",
    difficulty: 4,
    enabled: true,
  },
];

function getHistoryKey(userName) {
  return `studyApp.history.v4.${userName}`;
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function pick(row, names, fallback = "") {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
  }
  return fallback;
}

function normalizeTags(value) {
  return String(value || "")
    .split(/[|｜,、;；\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function readTags(row) {
  const values = [
    pick(row, ["tags", "tag", "TAG", "TAGS", "category", "categories"]),
    pick(row, ["tag1", "TAG1", "tag_1"]),
    pick(row, ["tag2", "TAG2", "tag_2"]),
    pick(row, ["tag3", "TAG3", "tag_3"]),
    pick(row, ["tag4", "TAG4", "tag_4"]),
    pick(row, ["tag5", "TAG5", "tag_5"]),
  ];

  return unique(values.flatMap((value) => normalizeTags(value)));
}

const DIRECT_TRANSLATION_HINTS = ["スパークする", "スパーク"];

function cleanLearningText(value) {
  let text = String(value || "");
  text = text.replace(/^次の意味に最も近い英単語を選びなさい[:：]\s*/g, "");
  text = text.replace(/^次の英単語の意味として最も適切なものを選びなさい[:：]\s*/g, "");
  text = text.replace(/^次の文の空所に入る最も適切な語を選びなさい[:：]\s*/g, "");
  text = text.replace(/^次の英文の下線部に最も近い意味を選びなさい[:：]\s*/g, "");
  text = text.replace(/^次の文が自然な英文になるように選びなさい[:：]\s*/g, "");
  text = text.replace(/^本文要旨問題[:：]\s*/g, "");
  text = text.replace(/（[^）]*(?:⇔|⇒|≒|→|←)[^）]*）/g, "");
  text = text.replace(/\([^)]*(?:⇔|⇒|≒|→|←)[^)]*\)/g, "");
  text = text.replace(/(?:⇔|⇒|≒|→|←)[^；;、,\n]*/g, "");

  for (const hint of DIRECT_TRANSLATION_HINTS) {
    if (!text.includes(hint)) continue;
    const parts = text.split(/([；;、,])/);
    text = parts
      .reduce((kept, part, index) => {
        if (index % 2 === 1) return kept;
        const delimiter = parts[index + 1] || "";
        const trimmed = part.trim();
        if (trimmed && !DIRECT_TRANSLATION_HINTS.some((item) => trimmed.includes(item))) {
          kept.push(trimmed + delimiter);
        }
        return kept;
      }, [])
      .join("");
  }

  return text
    .replace("意味の中心を確認し、例文の中で使えるようにしましょう。", "意味の中心を確認しましょう。")
    .replace(/\s+/g, " ")
    .replace(/[；;、,]\s*$/g, "")
    .trim();
}

function questionSizeClass(text) {
  const length = String(text || "").length;
  if (length > 150) return "questionText xlText";
  if (length > 90) return "questionText largeText";
  if (length > 45) return "questionText mediumText";
  return "questionText shortText";
}

function mascotImage(isCorrect, streak) {
  if (!isCorrect) return pandaWrong;
  return streak >= 3 ? pandaStreak : pandaCorrect;
}

function shuffle(values) {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function prepareQuestionForSession(question) {
  const answerChoice = question.choices[question.answerIndex];
  const distractors = question.choices.filter((choice, index) => index !== question.answerIndex && choice);
  const picked = shuffle(distractors).slice(0, 3);
  const displayChoices = shuffle([
    { text: answerChoice, correct: true },
    ...picked.map((text) => ({ text, correct: false })),
  ]);

  return {
    ...question,
    allChoices: question.choices,
    answerText: answerChoice,
    choices: displayChoices.map((choice) => choice.text),
    answerIndex: displayChoices.findIndex((choice) => choice.correct),
  };
}

function normalizeDirectAnswer(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ");
}

function isEnglishAnswerText(value) {
  const text = String(value || "").trim();
  return /[a-zA-Z]/.test(text) && !/[ぁ-んァ-ヶ一-龠]/.test(text);
}

function supportsDirectInput(question) {
  const source = `${question.id || ""} ${question.unit || ""} ${question.largeCategory || ""}`;
  const isVocabQuestion = /英単語|vocab|target1900|commonimportant/i.test(source);
  return isVocabQuestion && isEnglishAnswerText(question.choices?.[question.answerIndex]);
}

function matchesTag(question, selectedTag) {
  return !selectedTag || question.tags?.includes(selectedTag);
}

function matchesDifficulty(question, selectedDifficulty) {
  return !selectedDifficulty || Number(question.difficulty) === Number(selectedDifficulty);
}

function matchesCategory(question, selectedLargeCategory, selectedMiddleCategory) {
  return (
    (!selectedLargeCategory || question.largeCategory === selectedLargeCategory) &&
    (!selectedMiddleCategory || question.middleCategory === selectedMiddleCategory)
  );
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCsvLine(line);
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });

      const originalAnswerIndex = Number(pick(row, ["answer"], "1")) - 1;
      const choiceItems = Array.from({ length: 8 }, (_, index) => ({
        originalIndex: index,
        text: cleanLearningText(pick(row, [`choice${index + 1}`])),
      })).filter((choice) => choice.text);
      const answerIndex = choiceItems.findIndex((choice) => choice.originalIndex === originalAnswerIndex);
      const choices = choiceItems.map((choice) => choice.text);

      return {
        id: pick(row, ["id"]),
        subject: pick(row, ["subject"], "英語"),
        unit: pick(row, ["unit"], "英単語"),
        largeCategory: pick(row, ["largeCategory", "category1", "majorCategory", "term", "semester"], "基礎"),
        middleCategory: pick(row, ["middleCategory", "category2", "minorCategory", "range", "scope"], ""),
        question: cleanLearningText(pick(row, ["question"])),
        choices,
        answerIndex,
        explanation: cleanLearningText(pick(row, ["explanation"])),
        difficulty: Number(pick(row, ["difficulty"], "1")),
        tags: readTags(row),
        enabled: pick(row, ["enabled"], "true").toLowerCase() !== "false",
      };
    })
    .filter((q) => q.id && q.question && q.choices.length >= 4 && q.choices[q.answerIndex] && q.enabled);
}

function loadHistory(userName) {
  if (!userName) return { questions: {}, daily: {} };

  try {
    const raw =
      JSON.parse(localStorage.getItem(getHistoryKey(userName))) ||
      JSON.parse(localStorage.getItem(`studyApp.history.v3.${userName}`));

    if (raw && !raw.questions) return { questions: raw, daily: {} };
    return raw || { questions: {}, daily: {} };
  } catch {
    return { questions: {}, daily: {} };
  }
}

function normalizeHistory(value) {
  return {
    questions: value?.questions && typeof value.questions === "object" ? value.questions : {},
    daily: value?.daily && typeof value.daily === "object" ? value.daily : {},
  };
}

async function loadSpreadsheetHistory(userName) {
  if (!HISTORY_BACKUP_URL || !userName) return { questions: {}, daily: {} };

  const url = new URL(HISTORY_BACKUP_URL);
  url.searchParams.set("userName", userName);
  url.searchParams.set("t", String(Date.now()));

  const payload = await fetchJsonp(url);
  if (payload.ok === false) throw new Error(payload.error || "Googleスプレッドシート履歴の取得に失敗しました");

  return normalizeHistory(payload.history);
}

function fetchJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `studyAppHistory_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Googleスプレッドシート履歴の取得がタイムアウトしました"));
    }, 12000);

    window[callbackName] = (payload) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(payload);
    };

    url.searchParams.set("callback", callbackName);
    script.src = url.toString();
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("Googleスプレッドシート履歴の取得に失敗しました"));
    };
    document.head.appendChild(script);
  });
}

function saveHistory(userName, history, change = null, forceFlush = false) {
  if (!userName) return;
  localStorage.setItem(getHistoryKey(userName), JSON.stringify(history));
  if (change) enqueueHistoryBackup(userName, change);
  backupHistory(userName, history, forceFlush);
}

function getDeviceId() {
  const current = localStorage.getItem(DEVICE_ID_KEY);
  if (current) return current;

  const generated =
    globalThis.crypto?.randomUUID?.() ||
    `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

function loadBackupMeta() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_META_KEY)) || {};
  } catch {
    return {};
  }
}

function saveBackupMeta(meta) {
  localStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta));
}

function loadBackupQueue() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_QUEUE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveBackupQueue(queue) {
  localStorage.setItem(BACKUP_QUEUE_KEY, JSON.stringify(queue));
}

function getQueuedBackups(userName) {
  return loadBackupQueue()[userName] || [];
}

function enqueueHistoryBackup(userName, change) {
  if (!HISTORY_BACKUP_URL || !userName) return;

  const queue = loadBackupQueue();
  queue[userName] = [...(queue[userName] || []), change];
  saveBackupQueue(queue);
  markHistoryBackupPending(userName);
}

function clearQueuedBackups(userName) {
  const queue = loadBackupQueue();
  queue[userName] = [];
  saveBackupQueue(queue);
}

function shouldBackupHistory(userName, force = false) {
  if (!HISTORY_BACKUP_URL || !userName) return false;
  if (force) return true;

  if (getQueuedBackups(userName).length === 0) return false;

  const meta = loadBackupMeta();
  const userMeta = meta[userName] || {};
  const pendingAnswers = userMeta.pendingAnswers || 0;
  const elapsed = Date.now() - (userMeta.lastBackupAt || 0);

  return pendingAnswers >= HISTORY_BACKUP_EVERY_ANSWERS || elapsed >= HISTORY_BACKUP_INTERVAL_MS;
}

function markHistoryBackupPending(userName) {
  if (!HISTORY_BACKUP_URL || !userName) return;

  const meta = loadBackupMeta();
  const userMeta = meta[userName] || {};
  meta[userName] = {
    ...userMeta,
    pendingAnswers: (userMeta.pendingAnswers || 0) + 1,
  };
  saveBackupMeta(meta);
}

function markHistoryBackupDone(userName) {
  const meta = loadBackupMeta();
  meta[userName] = {
    ...(meta[userName] || {}),
    pendingAnswers: 0,
    lastBackupAt: Date.now(),
    lastStatus: "ok",
    lastError: "",
  };
  saveBackupMeta(meta);
}

function markHistoryBackupFailed(userName, error) {
  const meta = loadBackupMeta();
  meta[userName] = {
    ...(meta[userName] || {}),
    lastStatus: "failed",
    lastError: String(error?.message || error || "backup failed"),
  };
  saveBackupMeta(meta);
}

function backupHistory(userName, history, force = false, snapshot = false) {
  if (!shouldBackupHistory(userName, force)) return;
  const changes = getQueuedBackups(userName);
  const fullSnapshot = snapshot
    ? {
        questions: Object.entries(history.questions || {}).map(([questionId, questionHistory]) => ({
          questionId,
          questionHistory,
        })),
        daily: Object.entries(history.daily || {}).map(([date, stats]) => ({ date, stats })),
      }
    : null;

  const payload = {
    type: snapshot ? "history_snapshot" : "history_delta",
    appVersion: "v4",
    userName,
    deviceId: getDeviceId(),
    savedAt: new Date().toISOString(),
    changes,
    fullSnapshot,
  };

  fetch(HISTORY_BACKUP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then(() => {
      clearQueuedBackups(userName);
      markHistoryBackupDone(userName);
    })
    .catch((error) => markHistoryBackupFailed(userName, error));
}

function replaceSpreadsheetHistory(userName, history) {
  if (!HISTORY_BACKUP_URL || !userName) return;

  const payload = {
    type: "history_replace",
    appVersion: "v4",
    userName,
    deviceId: getDeviceId(),
    savedAt: new Date().toISOString(),
    changes: [],
    fullSnapshot: {
      questions: Object.entries(history.questions || {}).map(([questionId, questionHistory]) => ({
        questionId,
        questionHistory,
      })),
      daily: Object.entries(history.daily || {}).map(([date, stats]) => ({ date, stats })),
    },
  };

  fetch(HISTORY_BACKUP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then(() => {
      clearQueuedBackups(userName);
      markHistoryBackupDone(userName);
    })
    .catch((error) => markHistoryBackupFailed(userName, error));
}

function getQuestionHistory(history, questionId) {
  return history.questions?.[questionId];
}

function updateDailyStats(history, isCorrect, meta) {
  const key = todayKey();
  const current = history.daily?.[key] || {
    studied: 0,
    correct: 0,
    wrong: 0,
    quick: 0,
    slow: 0,
    hesitated: 0,
  };

  current.studied += 1;
  if (isCorrect) current.correct += 1;
  else current.wrong += 1;
  if (meta.responseTimeMs <= QUICK_ANSWER_MS) current.quick += 1;
  if (meta.responseTimeMs >= SLOW_ANSWER_MS) current.slow += 1;
  if (meta.hesitated) current.hesitated += 1;

  return {
    ...history,
    daily: {
      ...(history.daily || {}),
      [key]: current,
    },
  };
}

function computeNextSchedule(item, isCorrect, meta) {
  const now = new Date();
  const wrong = item.wrong || 0;
  const streak = item.streak || 0;
  const ease = item.ease ?? 2.2;
  const shakyCorrect = isCorrect && (meta.hesitated || meta.responseTimeMs > 10000);

  if (!isCorrect) {
    return {
      ease: Math.max(1.3, ease - 0.25),
      reviewLevel: 0,
      intervalDays: 0,
      weakWeight: Math.min(240, (item.weakWeight || 0) + 55),
      nextReviewAt: todayKey(now),
      mastered: false,
    };
  }

  const difficultPenalty = Math.min(0.72, wrong * 0.12 + (shakyCorrect ? 0.18 : 0));
  const newEase = Math.min(3.0, ease + (shakyCorrect ? 0.02 : 0.08));
  const newLevel = Math.min(6, (item.reviewLevel || 0) + (shakyCorrect ? 0 : 1));
  const baseIntervals = [1, 1, 3, 7, 14, 30, 60];
  let interval = baseIntervals[newLevel] ?? 60;

  interval = Math.max(1, Math.round(interval * (1 - difficultPenalty)));

  const weakFloor = wrong >= 2 || shakyCorrect ? 25 : 0;
  const newWeakWeight = Math.max(
    weakFloor,
    Math.round((item.weakWeight || 0) * (shakyCorrect ? 0.92 : wrong >= 2 ? 0.86 : 0.62))
  );

  return {
    ease: newEase,
    reviewLevel: newLevel,
    intervalDays: interval,
    weakWeight: newWeakWeight,
    nextReviewAt: todayKey(addDays(now, interval)),
    mastered: streak + 1 >= 3 && wrong <= 1 && !shakyCorrect,
  };
}

function updateHistory(userName, baseHistory, questionId, isCorrect, meta, forceFlush = false) {
  let history = normalizeHistory(baseHistory);
  const current = history.questions?.[questionId] || {
    correct: 0,
    wrong: 0,
    lastResult: null,
    streak: 0,
    bestStreak: 0,
    mastered: false,
    reviewLevel: 0,
    intervalDays: 0,
    ease: 2.2,
    weakWeight: 0,
    nextReviewAt: todayKey(),
    firstAnsweredAt: null,
    lastAnsweredAt: null,
    answeredCount: 0,
    quickCount: 0,
    slowCount: 0,
    lastSlow: false,
    hesitatedCount: 0,
    responseTimeTotalMs: 0,
  };

  const updated = { ...current };
  updated.answeredCount += 1;
  updated.responseTimeTotalMs += meta.responseTimeMs;
  if (meta.hesitated) updated.hesitatedCount += 1;
  if (meta.responseTimeMs <= QUICK_ANSWER_MS) updated.quickCount += 1;
  if (meta.responseTimeMs >= SLOW_ANSWER_MS) updated.slowCount = (updated.slowCount || 0) + 1;
  updated.lastSlow = meta.responseTimeMs >= SLOW_ANSWER_MS;
  if (!updated.firstAnsweredAt) updated.firstAnsweredAt = new Date().toISOString();

  if (isCorrect) {
    updated.correct += 1;
    updated.lastResult = "correct";
    updated.streak += 1;
    updated.bestStreak = Math.max(updated.bestStreak || 0, updated.streak);
  } else {
    updated.wrong += 1;
    updated.lastResult = "wrong";
    updated.streak = 0;
  }

  Object.assign(updated, computeNextSchedule(updated, isCorrect, meta));
  updated.lastAnsweredAt = new Date().toISOString();

  history = {
    ...history,
    questions: {
      ...(history.questions || {}),
      [questionId]: updated,
    },
  };

  history = updateDailyStats(history, isCorrect, meta);
  const dailyKey = todayKey();
  saveHistory(
    userName,
    history,
    {
      answeredAt: updated.lastAnsweredAt,
      questionId,
      questionHistory: updated,
      answer: {
        isCorrect,
        responseTimeMs: meta.responseTimeMs,
        hesitated: meta.hesitated,
      },
      daily: {
        date: dailyKey,
        stats: history.daily?.[dailyKey] || {},
      },
    },
    forceFlush
  );
  return history;
}

function daysUntil(dateKey) {
  if (!dateKey) return 0;
  const today = new Date(todayKey());
  const target = new Date(dateKey);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function isDue(q, history) {
  const h = getQuestionHistory(history, q.id);
  if (!h) return true;
  return daysUntil(h.nextReviewAt) <= 0;
}

function isReviewDue(q, history) {
  const h = getQuestionHistory(history, q.id);
  return Boolean(h) && daysUntil(h.nextReviewAt) <= 0;
}

function isWeakQuestion(q, history) {
  const h = getQuestionHistory(history, q.id);
  if (!h) return false;

  return (
    h.lastResult === "wrong" ||
    (h.weakWeight || 0) >= 25 ||
    (h.hesitatedCount || 0) >= 2 ||
    ((h.wrong || 0) >= 1 && (h.streak || 0) < 3)
  );
}

function isSlowQuestion(q, history) {
  const h = getQuestionHistory(history, q.id);
  if (!h) return false;
  const avgResponseMs = h.answeredCount ? (h.responseTimeTotalMs || 0) / h.answeredCount : 0;
  return h.lastSlow === true || (h.slowCount || 0) >= 2 || avgResponseMs >= SLOW_ANSWER_MS;
}

function scoreQuestion(q, history) {
  const h = getQuestionHistory(history, q.id);
  if (!h) return 95 + (q.difficulty || 0) * 3;

  const due = daysUntil(h.nextReviewAt) <= 0;
  const overdueDays = Math.max(0, -daysUntil(h.nextReviewAt));
  const avgResponseMs = h.answeredCount ? (h.responseTimeTotalMs || 0) / h.answeredCount : 0;

  let score = 0;
  if (due) score += 120;
  score += overdueDays * 10;
  score += (h.weakWeight || 0);
  score += (h.wrong || 0) * 22;
  score += (h.hesitatedCount || 0) * 12;
  score += (h.slowCount || 0) * 10;
  if (h.lastSlow) score += 18;
  if (avgResponseMs >= SLOW_ANSWER_MS) score += 16;
  score += Math.max(0, 3 - (h.streak || 0)) * 10;
  if ((h.wrong || 0) >= 2 && (h.streak || 0) >= 2) score += 35;
  if (!due) score -= 80;
  if (h.mastered) score -= 35;

  return score;
}

function filterByMode(questions, history, mode) {
  if (mode === "weak") {
    return questions
      .filter((q) => isWeakQuestion(q, history))
      .sort((a, b) => scoreQuestion(b, history) - scoreQuestion(a, history));
  }

  if (mode === "new") return questions.filter((q) => !getQuestionHistory(history, q.id));

  if (mode === "slow") {
    return questions
      .filter((q) => isSlowQuestion(q, history))
      .sort((a, b) => scoreQuestion(b, history) - scoreQuestion(a, history));
  }

  if (mode === "review") {
    return questions
      .filter((q) => isReviewDue(q, history))
      .sort((a, b) => scoreQuestion(b, history) - scoreQuestion(a, history));
  }

  return [...questions].sort((a, b) => scoreQuestion(b, history) - scoreQuestion(a, history));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildCalendarDays(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function countStats(list, history) {
  const studied = list.filter((q) => getQuestionHistory(history, q.id));
  const weak = list.filter((q) => isWeakQuestion(q, history));
  const slow = list.filter((q) => isSlowQuestion(q, history));
  const due = list.filter((q) => isReviewDue(q, history));
  const correct = studied.reduce((sum, q) => sum + (getQuestionHistory(history, q.id)?.correct || 0), 0);
  const wrong = studied.reduce((sum, q) => sum + (getQuestionHistory(history, q.id)?.wrong || 0), 0);
  const rate = correct + wrong === 0 ? 0 : Math.round((correct / (correct + wrong)) * 100);

  return { total: list.length, studied: studied.length, weak: weak.length, slow: slow.length, due: due.length, rate };
}

export default function App() {
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState("login");
  const [userName, setUserName] = useState(localStorage.getItem(CURRENT_USER_KEY) || "");
  const [loginInput, setLoginInput] = useState(localStorage.getItem(CURRENT_USER_KEY) || DEFAULT_USERS[0]);
  const [history, setHistory] = useState({ questions: {}, daily: {} });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("");
  const [largeCategory, setLargeCategory] = useState("");
  const [middleCategory, setMiddleCategory] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [mode, setMode] = useState("normal");
  const [answerFormat, setAnswerFormat] = useState(ANSWER_FORMATS.CHOICE);
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [showChoices, setShowChoices] = useState(false);
  const [choiceShownAt, setChoiceShownAt] = useState(Date.now());
  const [answerMeta, setAnswerMeta] = useState(null);
  const [historyCheckpoints, setHistoryCheckpoints] = useState({});
  const [headerVisible, setHeaderVisible] = useState(false);
  const [result, setResult] = useState({ total: 0, correct: 0, wrong: 0 });
  const [sessionStreak, setSessionStreak] = useState(0);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const answerInputRef = useRef(null);

  useEffect(() => {
    fetch(SHEET_CSV_URL)
      .then((res) => {
        if (!res.ok) throw new Error("問題データの取得に失敗しました");
        return res.text();
      })
      .then((text) => {
        const parsed = parseCsv(text);
        setQuestions(parsed.length ? parsed : FALLBACK_QUESTIONS);
      })
      .catch((err) => {
        setError(`${err.message}。内蔵サンプルで起動しています。`);
        setQuestions(FALLBACK_QUESTIONS);
      });
  }, []);

  useEffect(() => {
    if (!userName) return undefined;

    let cancelled = false;
    setHistoryLoading(true);
    setError("");

    loadSpreadsheetHistory(userName)
      .then((spreadsheetHistory) => {
        if (cancelled) return;
        setHistory(spreadsheetHistory);
        localStorage.setItem(getHistoryKey(userName), JSON.stringify(spreadsheetHistory));
        setScreen("home");
      })
      .catch((err) => {
        if (cancelled) return;
        const fallback = loadHistory(userName);
        setHistory(fallback);
        setError(`${err.message}。端末内の履歴を一時表示しています。`);
        setScreen("home");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userName]);

  useEffect(() => {
    if (screen !== "study") return undefined;

    if (answerFormat === ANSWER_FORMATS.INPUT) {
      setShowChoices(true);
      setChoiceShownAt(Date.now());
      return undefined;
    }

    setShowChoices(false);
    const timer = setTimeout(() => {
      setShowChoices(true);
      setChoiceShownAt(Date.now());
    }, CHOICE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [screen, currentIndex, answerFormat]);

  useEffect(() => {
    if (screen === "study" && showChoices && answerFormat === ANSWER_FORMATS.INPUT) {
      focusDirectAnswerInput();
    }
  }, [screen, showChoices, answerFormat, currentIndex]);

  useEffect(() => {
    if (
      screen !== "study" ||
      answerFormat !== ANSWER_FORMATS.INPUT ||
      selectedIndex === null ||
      !answerMeta
    ) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      finishAnswer(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen, answerFormat, selectedIndex, answerMeta, currentIndex, sessionQuestions.length]);

  useEffect(() => {
    let lastY = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;
      if (currentY <= 24) {
        setHeaderVisible(false);
        lastY = currentY;
        return;
      }

      if (currentY < lastY - 6) setHeaderVisible(true);
      if (currentY > lastY + 6) setHeaderVisible(false);
      lastY = currentY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const subjects = useMemo(() => unique(questions.map((q) => q.subject)), [questions]);
  const subjectTags = useMemo(
    () => unique(questions.filter((q) => q.subject === subject).flatMap((q) => q.tags || [])),
    [questions, subject]
  );
  const units = useMemo(
    () => unique(questions.filter((q) => q.subject === subject && matchesTag(q, selectedTag)).map((q) => q.unit)),
    [questions, subject, selectedTag]
  );
  const largeCategories = useMemo(
    () =>
      unique(
        questions
          .filter(
            (q) =>
              q.subject === subject &&
              q.unit === unit &&
              matchesTag(q, selectedTag) &&
              matchesDifficulty(q, selectedDifficulty)
          )
          .map((q) => q.largeCategory)
      ),
    [questions, subject, unit, selectedTag, selectedDifficulty]
  );
  const middleCategories = useMemo(
    () =>
      unique(
        questions
          .filter(
            (q) =>
              q.subject === subject &&
              q.unit === unit &&
              matchesTag(q, selectedTag) &&
              matchesDifficulty(q, selectedDifficulty) &&
              (!largeCategory || q.largeCategory === largeCategory)
          )
          .map((q) => q.middleCategory)
      ),
    [questions, subject, unit, selectedTag, selectedDifficulty, largeCategory]
  );
  const difficultyLevels = useMemo(
    () =>
      unique(
        questions
          .filter((q) => q.subject === subject && q.unit === unit && matchesTag(q, selectedTag))
          .map((q) => String(q.difficulty || 1))
      ).sort((a, b) => Number(a) - Number(b)),
    [questions, subject, unit, selectedTag]
  );
  const dueCount = useMemo(
    () =>
      questions.filter((q) => isReviewDue(q, history)).length,
    [questions, history]
  );
  const backupMeta = userName ? loadBackupMeta()[userName] || {} : {};
  const backupConfigured = Boolean(HISTORY_BACKUP_URL);

  function login(name) {
    const fixedName = String(name || "").trim();
    if (!fixedName) return;

    localStorage.setItem(CURRENT_USER_KEY, fixedName);
    setUserName(fixedName);
    setLoginInput(fixedName);
    setScreen("home");
  }

  function logout() {
    localStorage.removeItem(CURRENT_USER_KEY);
    setUserName("");
    setLoginInput(DEFAULT_USERS[0]);
    setScreen("login");
  }

  function selectSubject(nextSubject) {
    setSubject(nextSubject);
    setUnit("");
    setLargeCategory("");
    setMiddleCategory("");
    setSelectedTag("");
    setSelectedDifficulty("");
    setScreen("units");
  }

  function selectUnit(nextUnit) {
    setUnit(nextUnit);
    setLargeCategory("");
    setMiddleCategory("");
    setSelectedDifficulty("");
    setAnswerFormat(ANSWER_FORMATS.CHOICE);
    setScreen("filters");
  }

  function focusDirectAnswerInput() {
    const focus = () => {
      answerInputRef.current?.focus({ preventScroll: true });
    };

    focus();
    requestAnimationFrame(focus);
    setTimeout(focus, 80);
    setTimeout(focus, 220);
  }

  function startStudy(targetMode = mode) {
    const base = questions.filter(
      (q) =>
        q.subject === subject &&
        q.unit === unit &&
        matchesTag(q, selectedTag) &&
        matchesDifficulty(q, selectedDifficulty) &&
        matchesCategory(q, largeCategory, middleCategory)
    );
    const filtered = filterByMode(base, history, targetMode);
    const list = targetMode === "normal" && filtered.length === 0 ? base : filtered;
    const nextAnswerFormat =
      answerFormat === ANSWER_FORMATS.INPUT && list.every(supportsDirectInput)
        ? ANSWER_FORMATS.INPUT
        : ANSWER_FORMATS.CHOICE;
    if (list.length === 0) {
      alert(targetMode === "review" ? "今日の復習対象はありません。" : "条件に合う問題はありません。");
      return;
    }

    const applyStudyState = () => {
      setMode(targetMode);
      setAnswerFormat(nextAnswerFormat);
      setSessionQuestions(list.slice(0, SESSION_SIZE).map(prepareQuestionForSession));
      setCurrentIndex(0);
      setSelectedIndex(null);
      setTypedAnswer("");
      setAnswerMeta(null);
      setHistoryCheckpoints({});
      setSessionStreak(0);
      setResult({ total: Math.min(list.length, SESSION_SIZE), correct: 0, wrong: 0 });
      setScreen("study");
    };

    if (nextAnswerFormat === ANSWER_FORMATS.INPUT) {
      flushSync(applyStudyState);
      focusDirectAnswerInput();
      return;
    }

    applyStudyState();
  }

  function startAllDueReview() {
    const list = filterByMode(
      questions.filter((q) => matchesTag(q, selectedTag)),
      history,
      "review"
    );
    if (list.length === 0) {
      alert("今日の復習対象はありません。");
      return;
    }

    setSubject("復習");
    setUnit("今日の復習");
    setLargeCategory("");
    setMiddleCategory("");
    setMode("review");
    setAnswerFormat(ANSWER_FORMATS.CHOICE);
    setSessionQuestions(list.slice(0, SESSION_SIZE).map(prepareQuestionForSession));
    setCurrentIndex(0);
    setSelectedIndex(null);
    setTypedAnswer("");
    setAnswerMeta(null);
    setHistoryCheckpoints({});
    setSessionStreak(0);
    setResult({ total: Math.min(list.length, SESSION_SIZE), correct: 0, wrong: 0 });
    setScreen("study");
  }

  function answer(index) {
    if (selectedIndex !== null || !showChoices) return;

    setSelectedIndex(index);
    setAnswerMeta({
      responseTimeMs: Date.now() - choiceShownAt,
    });
  }

  function answerUnknown() {
    if (selectedIndex !== null || !showChoices) return;

    setSelectedIndex(-1);
    setAnswerMeta({
      responseTimeMs: Date.now() - choiceShownAt,
      answerFormat,
      gaveUp: true,
      typedAnswer: "わからない",
    });
  }

  function submitTypedAnswer(event) {
    event.preventDefault();
    if (selectedIndex !== null || !showChoices) return;

    const q = sessionQuestions[currentIndex];
    const userAnswer = typedAnswer.trim();
    if (!userAnswer) return;

    const correctAnswer = q.answerText || q.choices[q.answerIndex];
    const isCorrect = normalizeDirectAnswer(userAnswer) === normalizeDirectAnswer(correctAnswer);

    setSelectedIndex(isCorrect ? q.answerIndex : -1);
    setAnswerMeta({
      responseTimeMs: Date.now() - choiceShownAt,
      answerFormat: ANSWER_FORMATS.INPUT,
      typedAnswer: userAnswer,
    });
  }

  function finishAnswer(markHesitated) {
    if (selectedIndex === null || !answerMeta) return;

    const q = sessionQuestions[currentIndex];
    const isCorrect = selectedIndex === q.answerIndex;
    const meta = {
      ...answerMeta,
      hesitated: markHesitated,
    };
    const isLastQuestion = currentIndex >= sessionQuestions.length - 1;
    setHistoryCheckpoints((prev) => ({
      ...prev,
      [currentIndex]: {
        history,
        result,
        sessionStreak,
      },
    }));
    const newHistory = updateHistory(userName, history, q.id, isCorrect, meta, isLastQuestion);

    setHistory(newHistory);
    setResult((prev) => ({
      ...prev,
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
    }));
    setSessionStreak(isCorrect ? sessionStreak + 1 : 0);

    nextQuestion();
  }

  function goPreviousQuestion() {
    if (currentIndex <= 0) return;

    const previousIndex = currentIndex - 1;
    const checkpoint = historyCheckpoints[previousIndex];

    if (checkpoint) {
      setHistory(checkpoint.history);
      localStorage.setItem(getHistoryKey(userName), JSON.stringify(checkpoint.history));
      replaceSpreadsheetHistory(userName, checkpoint.history);
      setResult(checkpoint.result);
      setSessionStreak(checkpoint.sessionStreak);
      setHistoryCheckpoints((prev) => {
        const next = { ...prev };
        delete next[previousIndex];
        return next;
      });
    }

    setCurrentIndex(previousIndex);
    setSelectedIndex(null);
    setTypedAnswer("");
    setAnswerMeta(null);
    setShowChoices(answerFormat === ANSWER_FORMATS.INPUT);
    setChoiceShownAt(Date.now());
  }

  function nextQuestion() {
    if (currentIndex >= sessionQuestions.length - 1) {
      setScreen("result");
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedIndex(null);
    setTypedAnswer("");
    setAnswerMeta(null);
  }

  function resetHistory() {
    if (!confirm(`${userName} の学習履歴を削除しますか？`)) return;
    localStorage.removeItem(getHistoryKey(userName));
    setHistory({ questions: {}, daily: {} });
    backupHistory(userName, { questions: {}, daily: {} }, true, true);
    alert("学習履歴をリセットしました");
  }

  function manualBackupHistory() {
    if (!backupConfigured) {
      alert("GoogleスプレッドシートのバックアップURLが未設定です。");
      return;
    }

    backupHistory(userName, history, true, true);
    alert("Googleスプレッドシートへバックアップを送信しました。");
  }

  function changeMonth(diff) {
    const next = new Date(calendarDate);
    next.setMonth(next.getMonth() + diff);
    setCalendarDate(next);
  }

  const currentQuestion = sessionQuestions[currentIndex];
  const answered = selectedIndex !== null;
  const isCurrentAnswerCorrect = answered && currentQuestion && selectedIndex === currentQuestion.answerIndex;
  const previewStreak = isCurrentAnswerCorrect ? sessionStreak + 1 : 0;
  const currentLargeCategoryQuestions = currentQuestion
    ? questions.filter(
        (q) =>
          q.subject === currentQuestion.subject &&
          q.unit === currentQuestion.unit &&
          q.largeCategory === currentQuestion.largeCategory &&
          matchesTag(q, selectedTag) &&
          matchesDifficulty(q, selectedDifficulty)
      )
    : [];
  const currentLargeCategoryIndex = currentQuestion
    ? currentLargeCategoryQuestions.findIndex((q) => q.id === currentQuestion.id) + 1
    : 0;
  const percent = result.total === 0 ? 0 : Math.round((result.correct / result.total) * 100);
  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const calendarDays = buildCalendarDays(calendarYear, calendarMonth);

  if (screen !== "login" && questions.length === 0) {
    return (
      <div className="app">
        <div className="brandHeader"><div className="logo">M</div><h1>受験カード</h1></div>
        <div className="panel loading">問題データを読み込み中...</div>
      </div>
    );
  }

  if (screen !== "login" && historyLoading) {
    return (
      <div className="app">
        <div className="brandHeader"><div className="logo">M</div><h1>受験カード</h1></div>
        <div className="panel loading">Googleスプレッドシートの学習履歴を読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className={`brandHeader ${headerVisible ? "isVisible" : ""}`}>
        <button className="miniButton" onClick={() => (userName ? setScreen("home") : setScreen("login"))}>教科</button>
        <div className="brandCenter">
          <div className="logo">M</div>
          <div>
            <h1>受験カード</h1>
            {userName && <p>{userName}</p>}
          </div>
        </div>
        {userName && <button className="miniButton loginBackButton" onClick={logout}>ログイン</button>}
        <button className="miniButton" onClick={() => setScreen("settings")}>設定</button>
      </header>

      {error && <div className="panel error">{error}</div>}

      {screen === "login" && (
        <>
          <section className="hero mikanHero">
            <div className="heroIcon">✓</div>
            <h2>今日の復習を<br />すぐ始めよう</h2>
            <p>忘却曲線を意識して、復習タイミングを自動調整します。</p>
          </section>

          <section className="panel">
            <h2 className="panelTitle">ユーザーログイン</h2>
            <p className="description">履歴はユーザー別にこの端末へ保存します。iPhoneではブラウザのデータ削除やプライベートブラウズで消える場合があります。</p>
            <div className="userChips">
              {DEFAULT_USERS.map((name) => <button key={name} onClick={() => login(name)}>{name}</button>)}
            </div>
            <input className="loginInput" value={loginInput} onChange={(e) => setLoginInput(e.target.value)} placeholder="ユーザー名" />
            <button className="bigPrimary" onClick={() => login(loginInput)}>はじめる</button>
          </section>
        </>
      )}

      {screen === "home" && (
        <>
          <section className="hero">
            <p className="eyebrow">spaced repetition</p>
            <h2>忘れる前に、<br />もう一度。</h2>
            <p>迷い・回答時間・復習日を見て、間違えやすい問題を再出題します。</p>
          </section>

          <button className="reviewNow" onClick={startAllDueReview}>
            <span>今日の復習</span>
            <strong>{dueCount}問</strong>
          </button>
          <button className="calendarButton" onClick={() => setScreen("calendar")}>学習カレンダーを見る</button>
          <button className="loginReturnButton" onClick={logout}>ログイン画面へ戻る</button>

          <h3 className="sectionTitle">教科を選択</h3>
          {subjects.map((s) => {
            const stat = countStats(questions.filter((q) => q.subject === s), history);
            return (
              <button key={s} className="subjectCard" onClick={() => selectSubject(s)}>
                <div>
                  <strong>{s}</strong>
                  <small>{stat.total}問 / 復習 {stat.due}問 / 苦手 {stat.weak}問</small>
                </div>
                <span>›</span>
              </button>
            );
          })}
        </>
      )}

      {screen === "units" && (
        <>
          <div className="pageTitle">
            <button onClick={() => setScreen("home")}>‹</button>
            <h2>{subject}</h2>
          </div>
          {subjectTags.length > 0 && (
            <>
              <h3 className="sectionTitle">TAGを選択</h3>
              <div className="tagFilter">
                <button className={selectedTag === "" ? "active" : ""} onClick={() => setSelectedTag("")}>すべて</button>
                {subjectTags.map((tag) => (
                  <button key={tag} className={selectedTag === tag ? "active" : ""} onClick={() => setSelectedTag(tag)}>
                    {tag}
                  </button>
                ))}
              </div>
            </>
          )}
          <h3 className="sectionTitle">Unitを選択</h3>
          {units.map((u) => {
            const stat = countStats(
              questions.filter((q) => q.subject === subject && q.unit === u && matchesTag(q, selectedTag)),
              history
            );
            return (
              <button key={u} className="unitCard" onClick={() => selectUnit(u)}>
                <div>
                  <strong>{u}</strong>
                  <small>{stat.total}問 / 復習 {stat.due}問 / 苦手 {stat.weak}問 / 遅答 {stat.slow}問 / 正答率 {stat.rate}%</small>
                  <div className="thinBar"><div style={{ width: `${Math.min(100, stat.rate)}%` }} /></div>
                </div>
                <span>›</span>
              </button>
            );
          })}
        </>
      )}

      {screen === "filters" && (
        <>
          <div className="pageTitle">
            <button onClick={() => setScreen("units")}>‹</button>
            <h2>{unit}</h2>
          </div>

          <div className="modeTabs">
            <button className={mode === "normal" ? "active" : ""} onClick={() => setMode("normal")}>おすすめ</button>
            <button className={mode === "review" ? "active" : ""} onClick={() => setMode("review")}>復習</button>
            <button className={mode === "weak" ? "active" : ""} onClick={() => setMode("weak")}>苦手</button>
            <button className={mode === "slow" ? "active" : ""} onClick={() => setMode("slow")}>遅答</button>
            <button className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>未学習</button>
          </div>

          {subjectTags.length > 0 && (
            <>
              <h3 className="sectionTitle">TAG</h3>
              <div className="tagFilter compact">
                <button className={selectedTag === "" ? "active" : ""} onClick={() => setSelectedTag("")}>すべて</button>
                {subjectTags.map((tag) => (
                  <button key={tag} className={selectedTag === tag ? "active" : ""} onClick={() => setSelectedTag(tag)}>
                    {tag}
                  </button>
                ))}
              </div>
            </>
          )}

          {difficultyLevels.length > 0 && (
            <>
              <h3 className="sectionTitle">難易度</h3>
              <div className="tagFilter compact">
                <button className={selectedDifficulty === "" ? "active" : ""} onClick={() => setSelectedDifficulty("")}>すべて</button>
                {difficultyLevels.map((level) => (
                  <button
                    key={level}
                    className={selectedDifficulty === level ? "active" : ""}
                    onClick={() => setSelectedDifficulty(level)}
                  >
                    ★{level}
                  </button>
                ))}
              </div>
            </>
          )}

          <h3 className="sectionTitle">大分類</h3>
          <div className="tagFilter compact">
            <button
              className={largeCategory === "" ? "active" : ""}
              onClick={() => {
                setLargeCategory("");
                setMiddleCategory("");
              }}
            >
              すべて
            </button>
            {largeCategories.map((category) => (
              <button
                key={category}
                className={largeCategory === category ? "active" : ""}
                onClick={() => {
                  setLargeCategory(category);
                  setMiddleCategory("");
                }}
              >
                {category}
              </button>
            ))}
          </div>

          {middleCategories.length > 0 && (
            <>
              <h3 className="sectionTitle">中分類</h3>
              <div className="tagFilter compact">
                <button className={middleCategory === "" ? "active" : ""} onClick={() => setMiddleCategory("")}>すべて</button>
                {middleCategories.map((category) => (
                  <button
                    key={category}
                    className={middleCategory === category ? "active" : ""}
                    onClick={() => setMiddleCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </>
          )}

          {(() => {
            const selectedQuestions = questions.filter(
              (q) =>
                q.subject === subject &&
                q.unit === unit &&
                matchesTag(q, selectedTag) &&
                matchesDifficulty(q, selectedDifficulty) &&
                matchesCategory(q, largeCategory, middleCategory)
            );
            const stat = countStats(selectedQuestions, history);
            const directInputAvailable = selectedQuestions.length > 0 && selectedQuestions.every(supportsDirectInput);
            return (
              <section className="panel">
                <h2 className="panelTitle">出題条件</h2>
                <p className="description">
                  {stat.total}問 / 復習 {stat.due}問 / 苦手 {stat.weak}問 / 遅答 {stat.slow}問 / 正答率 {stat.rate}%
                </p>
                {directInputAvailable && (
                  <div className="answerFormatTabs" aria-label="回答形式">
                    <button
                      className={answerFormat === ANSWER_FORMATS.CHOICE ? "active" : ""}
                      onClick={() => setAnswerFormat(ANSWER_FORMATS.CHOICE)}
                    >
                      4択
                    </button>
                    <button
                      className={answerFormat === ANSWER_FORMATS.INPUT ? "active" : ""}
                      onClick={() => setAnswerFormat(ANSWER_FORMATS.INPUT)}
                    >
                      直接入力
                    </button>
                  </div>
                )}
                <button className="bigPrimary" onClick={() => startStudy()} disabled={stat.total === 0}>
                  25問で開始
                </button>
              </section>
            );
          })()}
        </>
      )}

      {screen === "legacyRangesRemoved" && (
        <>
          {false && subjectTags.length > 0 && (
            <div className="tagFilter compact">
              <button className={selectedTag === "" ? "active" : ""} onClick={() => setSelectedTag("")}>すべて</button>
              {subjectTags.map((tag) => (
                <button key={tag} className={selectedTag === tag ? "active" : ""} onClick={() => setSelectedTag(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          )}

        </>
      )}

      {screen === "study" && currentQuestion && (
        <>
          <div className="studyTop">
            <span>{[subject, unit, largeCategory, middleCategory].filter(Boolean).join(" / ")}</span>
            <div className="studyCounters" aria-label="問題番号">
              <strong>{currentIndex + 1}/{sessionQuestions.length}</strong>
              {currentLargeCategoryIndex > 0 && (
                <small>
                  {currentQuestion.largeCategory} {currentLargeCategoryIndex}/{currentLargeCategoryQuestions.length}
                </small>
              )}
            </div>
          </div>
          <div className="progressBar"><div style={{ width: `${((currentIndex + 1) / sessionQuestions.length) * 100}%` }} /></div>

          <section className="questionPanel">
            <p className="modeLabel">
              {mode === "review"
                ? "復習タイミング"
                : mode === "normal"
                  ? "おすすめ"
                  : mode === "weak"
                    ? "苦手問題"
                    : mode === "slow"
                      ? "遅答問題"
                      : "未学習"}
            </p>
            <h2 className={questionSizeClass(currentQuestion.question)}>{currentQuestion.question}</h2>
            {currentQuestion.tags?.length > 0 && (
              <div className="questionTags">
                {currentQuestion.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
          </section>

          {!showChoices && <div className="thinkingPanel">問題を読んで考えてください...</div>}

          {showChoices && answerFormat === ANSWER_FORMATS.CHOICE && (
            <div className="choiceList">
              {currentQuestion.choices.map((choice, index) => {
                const isCorrect = index === currentQuestion.answerIndex;
                const isSelected = index === selectedIndex;
                let cls = "choiceButton";
                if (answered && isCorrect) cls += " correct";
                if (answered && isSelected && !isCorrect) cls += " wrong";

                return (
                  <button key={index} className={cls} onClick={() => answer(index)}>
                    <span>{index + 1}</span>
                    <b>{choice}</b>
                  </button>
                );
              })}
            </div>
          )}

          {showChoices && answerFormat === ANSWER_FORMATS.INPUT && (
            <form className="directAnswerForm" onSubmit={submitTypedAnswer}>
              <input
                ref={answerInputRef}
                value={typedAnswer}
                onChange={(event) => setTypedAnswer(event.target.value)}
                disabled={answered}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                enterKeyHint="done"
                inputMode="text"
                lang="en"
                spellCheck="false"
                placeholder="英単語を入力"
              />
              <button className="bigPrimary" type="submit" disabled={answered || !typedAnswer.trim()}>
                確定
              </button>
            </form>
          )}

          {showChoices && !answered && (
            <button className="unknownButton" onClick={answerUnknown}>
              わからない
            </button>
          )}

          <button className="bigSecondary" onClick={() => setScreen("result")}>終了する</button>
          <button className="bigSecondary" onClick={goPreviousQuestion} disabled={currentIndex === 0}>
            一つ前に戻る
          </button>

          {answered && (
            <div className="resultModal" role="dialog" aria-modal="true">
              <section className="resultModalContent">
                <strong>{selectedIndex === currentQuestion.answerIndex ? "正解！" : "不正解"}</strong>
                <div
                  className={`mascot ${isCurrentAnswerCorrect ? `energy${Math.min(4, previewStreak)}` : "sad"}`}
                  aria-label={isCurrentAnswerCorrect ? `${previewStreak}問連続正解` : "残念"}
                >
                  <img
                    className="mascotImage"
                    src={mascotImage(isCurrentAnswerCorrect, previewStreak)}
                    alt=""
                  />
                  <div className="mascotShadow" />
                  <p>{isCurrentAnswerCorrect ? `${previewStreak}問連続！` : "次で取り返そう"}</p>
                </div>
                {answerMeta?.answerFormat === ANSWER_FORMATS.INPUT && (
                  <div className="directAnswerResult">
                    <span>入力: {answerMeta.typedAnswer}</span>
                    <strong>正解: {currentQuestion.answerText || currentQuestion.choices[currentQuestion.answerIndex]}</strong>
                  </div>
                )}
                <p>{currentQuestion.explanation}</p>
                <div className="answerMeta">
                  <span>回答 {answerMeta ? (answerMeta.responseTimeMs / 1000).toFixed(1) : "0.0"}秒</span>
                  <span>{isCurrentAnswerCorrect ? "正解" : "不正解"}</span>
                </div>
                <div className={`modalActions ${isCurrentAnswerCorrect ? "" : "single"}`}>
                  {isCurrentAnswerCorrect && (
                    <button
                      className={`bigSecondary ${answerMeta?.responseTimeMs >= SLOW_ANSWER_MS ? "suggested" : ""}`}
                      onClick={() => finishAnswer(true)}
                    >
                      迷った
                    </button>
                  )}
                  <button className="bigPrimary" onClick={() => finishAnswer(false)}>
                    {currentIndex >= sessionQuestions.length - 1 ? "結果を見る" : "次へ"}
                  </button>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {screen === "result" && (
        <>
          <section className="resultPanel">
            {result.total > 0 && result.correct === result.total && (
              <div className="perfectBadge">
                <span>★</span>
                <strong>全問正解！</strong>
                <p>すごい集中力です。この調子でいきましょう。</p>
              </div>
            )}
            <p>今回の結果</p>
            <h2>{percent}%</h2>
            <div className="resultStats">
              <div><strong>{result.total}</strong><small>出題</small></div>
              <div><strong>{result.correct}</strong><small>正解</small></div>
              <div><strong>{result.wrong}</strong><small>不正解</small></div>
            </div>
          </section>
          {dueCount > 0 && (
            <button className="bigPrimary" onClick={startAllDueReview}>今日の復習を続ける</button>
          )}
          <button className="bigSecondary" onClick={() => setScreen("calendar")}>カレンダーを見る</button>
          <button className="bigSecondary" onClick={() => setScreen("home")}>教科へ戻る</button>
        </>
      )}

      {screen === "calendar" && (
        <>
          <div className="pageTitle">
            <button onClick={() => setScreen("home")}>‹</button>
            <h2>学習カレンダー</h2>
          </div>
          <section className="calendarPanel">
            <div className="calendarHeader">
              <button onClick={() => changeMonth(-1)}>‹</button>
              <strong>{calendarYear}年 {calendarMonth + 1}月</strong>
              <button onClick={() => changeMonth(1)}>›</button>
            </div>
            <div className="weekLabels">
              {["日", "月", "火", "水", "木", "金", "土"].map((d) => <span key={d}>{d}</span>)}
            </div>
            <div className="calendarGrid">
              {calendarDays.map((date) => {
                const key = todayKey(date);
                const stats = history.daily?.[key];
                const isThisMonth = date.getMonth() === calendarMonth;
                const level = Math.min(4, Math.ceil((stats?.studied || 0) / 5));
                return (
                  <div key={key} className={`calendarDay ${isThisMonth ? "" : "muted"} level${level}`}>
                    <b>{date.getDate()}</b>
                    {stats && <small>{stats.studied}問</small>}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {screen === "settings" && (
        <>
          <div className="pageTitle">
            <button onClick={() => setScreen(userName ? "home" : "login")}>‹</button>
            <h2>設定</h2>
          </div>
          <section className="panel">
            <h2 className="panelTitle">ログイン中</h2>
            <p className="description">{userName || "未ログイン"}</p>
            {userName && <button className="bigSecondary" onClick={logout}>ログアウト</button>}
          </section>
          <section className="panel">
            <h2 className="panelTitle">保存形式</h2>
            <p className="description">
              学習履歴は端末内の localStorage に即時保存し、Googleスプレッドシートへ定期バックアップします。
              バックアップは5回答ごと、または前回バックアップから5分以上経過した回答時に、回答した問題の差分だけを送信します。
            </p>
            <p className="description">
              保存キー: {userName ? getHistoryKey(userName) : "未ログイン"} / バックアップ: {backupConfigured ? "有効" : "未設定"}
              {backupMeta.lastBackupAt ? ` / 最終送信: ${new Date(backupMeta.lastBackupAt).toLocaleString()}` : ""}
            </p>
          </section>
          <section className="panel">
            <h2 className="panelTitle">学習履歴</h2>
            <button className="bigSecondary" onClick={manualBackupHistory} disabled={!userName || !backupConfigured}>
              今すぐバックアップ
            </button>
            <button className="dangerButton" onClick={resetHistory}>このユーザーの履歴をリセット</button>
          </section>
        </>
      )}
    </div>
  );
}
