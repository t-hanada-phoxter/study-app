import { useEffect, useMemo, useState } from "react";
import "./App.css";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1ZQn3vKJH6fPpJIrwJiPYfIvbm9p9-Qq7kiRbUpfIuoY/gviz/tq?tqx=out:csv&sheet=questions";

const CURRENT_USER_KEY = "studyApp.currentUser.v4";
const CHOICE_DELAY_MS = 1000;
const QUICK_ANSWER_MS = 3500;
const DEFAULT_USERS = ["user1", "user2", "user3", "user4", "user5"];

const FALLBACK_QUESTIONS = [
  {
    id: "eng_vocab_t1_a_001",
    subject: "英語",
    unit: "英単語",
    term: "1学期",
    range: "範囲A",
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
    term: "1学期",
    range: "範囲A",
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
    term: "1学期",
    range: "範囲B",
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
    term: "1学期",
    range: "範囲A",
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
    term: "1学期",
    range: "範囲A",
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
    choices: displayChoices.map((choice) => choice.text),
    answerIndex: displayChoices.findIndex((choice) => choice.correct),
  };
}

function matchesTag(question, selectedTag) {
  return !selectedTag || question.tags?.includes(selectedTag);
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

      return {
        id: pick(row, ["id"]),
        subject: pick(row, ["subject"], "英語"),
        unit: pick(row, ["unit"], "英単語"),
        term: pick(row, ["term", "semester", "period", "gradeTerm"], "1学期"),
        range: pick(row, ["range", "scope", "section", "area"], "範囲A"),
        question: pick(row, ["question"]),
        choices: Array.from({ length: 8 }, (_, index) => pick(row, [`choice${index + 1}`])).filter(Boolean),
        answerIndex: Number(pick(row, ["answer"], "1")) - 1,
        explanation: pick(row, ["explanation"]),
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

function saveHistory(userName, history) {
  if (!userName) return;
  localStorage.setItem(getHistoryKey(userName), JSON.stringify(history));
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
    hesitated: 0,
    confidenceTotal: 0,
  };

  current.studied += 1;
  if (isCorrect) current.correct += 1;
  else current.wrong += 1;
  if (meta.responseTimeMs <= QUICK_ANSWER_MS) current.quick += 1;
  if (meta.hesitated) current.hesitated += 1;
  current.confidenceTotal += meta.confidence;

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
  const shakyCorrect = isCorrect && (meta.hesitated || meta.confidence <= 2 || meta.responseTimeMs > 10000);

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

function updateHistory(userName, questionId, isCorrect, meta) {
  let history = loadHistory(userName);
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
    hesitatedCount: 0,
    confidenceTotal: 0,
    responseTimeTotalMs: 0,
  };

  const updated = { ...current };
  updated.answeredCount += 1;
  updated.responseTimeTotalMs += meta.responseTimeMs;
  updated.confidenceTotal += meta.confidence;
  if (meta.hesitated) updated.hesitatedCount += 1;
  if (meta.responseTimeMs <= QUICK_ANSWER_MS) updated.quickCount += 1;
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
  saveHistory(userName, history);
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

function scoreQuestion(q, history) {
  const h = getQuestionHistory(history, q.id);
  if (!h) return 95 + (q.difficulty || 0) * 3;

  const due = daysUntil(h.nextReviewAt) <= 0;
  const overdueDays = Math.max(0, -daysUntil(h.nextReviewAt));
  const avgConfidence = h.answeredCount ? (h.confidenceTotal || 0) / h.answeredCount : 3;
  const avgResponseMs = h.answeredCount ? (h.responseTimeTotalMs || 0) / h.answeredCount : 0;

  let score = 0;
  if (due) score += 120;
  score += overdueDays * 10;
  score += (h.weakWeight || 0);
  score += (h.wrong || 0) * 22;
  score += (h.hesitatedCount || 0) * 12;
  score += Math.max(0, 3 - avgConfidence) * 12;
  if (avgResponseMs > 10000) score += 14;
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

  if (mode === "review") {
    return questions
      .filter((q) => isDue(q, history))
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
  const due = list.filter((q) => isDue(q, history) && getQuestionHistory(history, q.id));
  const correct = studied.reduce((sum, q) => sum + (getQuestionHistory(history, q.id)?.correct || 0), 0);
  const wrong = studied.reduce((sum, q) => sum + (getQuestionHistory(history, q.id)?.wrong || 0), 0);
  const rate = correct + wrong === 0 ? 0 : Math.round((correct / (correct + wrong)) * 100);

  return { total: list.length, studied: studied.length, weak: weak.length, due: due.length, rate };
}

export default function App() {
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState("login");
  const [userName, setUserName] = useState(localStorage.getItem(CURRENT_USER_KEY) || "");
  const [loginInput, setLoginInput] = useState(localStorage.getItem(CURRENT_USER_KEY) || "user1");
  const [history, setHistory] = useState(() => loadHistory(localStorage.getItem(CURRENT_USER_KEY) || ""));
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("");
  const [term, setTerm] = useState("");
  const [range, setRange] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [mode, setMode] = useState("normal");
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showChoices, setShowChoices] = useState(false);
  const [choiceShownAt, setChoiceShownAt] = useState(Date.now());
  const [answerMeta, setAnswerMeta] = useState(null);
  const [hesitated, setHesitated] = useState(false);
  const [confidence, setConfidence] = useState(3);
  const [result, setResult] = useState({ total: 0, correct: 0, wrong: 0 });
  const [calendarDate, setCalendarDate] = useState(new Date());

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
    if (userName) {
      setHistory(loadHistory(userName));
      setScreen("home");
    }
  }, [userName]);

  useEffect(() => {
    if (screen !== "study") return undefined;

    setShowChoices(false);
    const timer = setTimeout(() => {
      setShowChoices(true);
      setChoiceShownAt(Date.now());
    }, CHOICE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [screen, currentIndex]);

  const subjects = useMemo(() => unique(questions.map((q) => q.subject)), [questions]);
  const allTags = useMemo(() => unique(questions.flatMap((q) => q.tags || [])), [questions]);
  const units = useMemo(
    () => unique(questions.filter((q) => q.subject === subject && matchesTag(q, selectedTag)).map((q) => q.unit)),
    [questions, subject, selectedTag]
  );
  const terms = useMemo(
    () =>
      unique(
        questions
          .filter((q) => q.subject === subject && q.unit === unit && matchesTag(q, selectedTag))
          .map((q) => q.term)
      ),
    [questions, subject, unit, selectedTag]
  );
  const ranges = useMemo(
    () =>
      unique(
        questions
          .filter((q) => q.subject === subject && q.unit === unit && q.term === term && matchesTag(q, selectedTag))
          .map((q) => q.range)
      ),
    [questions, subject, unit, term, selectedTag]
  );
  const dueCount = useMemo(
    () =>
      questions.filter((q) => matchesTag(q, selectedTag) && isDue(q, history) && getQuestionHistory(history, q.id))
        .length,
    [questions, history, selectedTag]
  );

  function login(name) {
    const fixedName = String(name || "").trim();
    if (!fixedName) return;

    localStorage.setItem(CURRENT_USER_KEY, fixedName);
    setUserName(fixedName);
    setLoginInput(fixedName);
    setHistory(loadHistory(fixedName));
    setScreen("home");
  }

  function logout() {
    localStorage.removeItem(CURRENT_USER_KEY);
    setUserName("");
    setLoginInput("user1");
    setScreen("login");
  }

  function selectSubject(nextSubject) {
    setSubject(nextSubject);
    setUnit("");
    setTerm("");
    setRange("");
    setScreen("units");
  }

  function selectUnit(nextUnit) {
    setUnit(nextUnit);
    setTerm("");
    setRange("");
    setScreen("terms");
  }

  function selectTerm(nextTerm) {
    setTerm(nextTerm);
    setRange("");
    setScreen("ranges");
  }

  function startStudy(targetRange, targetMode = mode) {
    const base = questions.filter(
      (q) =>
        q.subject === subject &&
        q.unit === unit &&
        q.term === term &&
        q.range === targetRange &&
        matchesTag(q, selectedTag)
    );
    const filtered = filterByMode(base, history, targetMode);
    const list = filtered.length > 0 ? filtered : base;

    setRange(targetRange);
    setMode(targetMode);
    setSessionQuestions(list.slice(0, 10).map(prepareQuestionForSession));
    setCurrentIndex(0);
    setSelectedIndex(null);
    setAnswerMeta(null);
    setHesitated(false);
    setConfidence(3);
    setResult({ total: Math.min(list.length, 10), correct: 0, wrong: 0 });
    setScreen("study");
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
    setTerm("");
    setRange("");
    setMode("review");
    setSessionQuestions(list.slice(0, 10).map(prepareQuestionForSession));
    setCurrentIndex(0);
    setSelectedIndex(null);
    setAnswerMeta(null);
    setHesitated(false);
    setConfidence(3);
    setResult({ total: Math.min(list.length, 10), correct: 0, wrong: 0 });
    setScreen("study");
  }

  function answer(index) {
    if (selectedIndex !== null || !showChoices) return;

    const q = sessionQuestions[currentIndex];
    const isCorrect = index === q.answerIndex;
    const meta = {
      responseTimeMs: Date.now() - choiceShownAt,
      hesitated,
      confidence,
    };
    const newHistory = updateHistory(userName, q.id, isCorrect, meta);

    setSelectedIndex(index);
    setAnswerMeta(meta);
    setHistory(newHistory);
    setResult((prev) => ({
      ...prev,
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
    }));
  }

  function nextQuestion() {
    if (currentIndex >= sessionQuestions.length - 1) {
      setScreen("result");
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedIndex(null);
    setAnswerMeta(null);
    setHesitated(false);
    setConfidence(3);
  }

  function resetHistory() {
    if (!confirm(`${userName} の学習履歴を削除しますか？`)) return;
    localStorage.removeItem(getHistoryKey(userName));
    setHistory({ questions: {}, daily: {} });
    alert("学習履歴をリセットしました");
  }

  function changeMonth(diff) {
    const next = new Date(calendarDate);
    next.setMonth(next.getMonth() + diff);
    setCalendarDate(next);
  }

  const currentQuestion = sessionQuestions[currentIndex];
  const answered = selectedIndex !== null;
  const percent = result.total === 0 ? 0 : Math.round((result.correct / result.total) * 100);
  const currentQHistory = currentQuestion ? getQuestionHistory(history, currentQuestion.id) : null;
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

  return (
    <div className="app">
      <header className="brandHeader">
        <button className="miniButton" onClick={() => (userName ? setScreen("home") : setScreen("login"))}>教科</button>
        <div className="brandCenter">
          <div className="logo">M</div>
          <div>
            <h1>受験カード</h1>
            {userName && <p>{userName}</p>}
          </div>
        </div>
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
            <p>迷い・自信度・回答時間も見て、間違えやすい問題を再出題します。</p>
          </section>

          <button className="reviewNow" onClick={startAllDueReview}>
            <span>今日の復習</span>
            <strong>{dueCount}問</strong>
          </button>
          <button className="calendarButton" onClick={() => setScreen("calendar")}>学習カレンダーを見る</button>

          {allTags.length > 0 && (
            <div className="tagFilter">
              <button className={selectedTag === "" ? "active" : ""} onClick={() => setSelectedTag("")}>すべて</button>
              {allTags.map((tag) => (
                <button key={tag} className={selectedTag === tag ? "active" : ""} onClick={() => setSelectedTag(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          )}

          <h3 className="sectionTitle">教科を選択</h3>
          {subjects.map((s) => {
            const stat = countStats(questions.filter((q) => q.subject === s && matchesTag(q, selectedTag)), history);
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
          {units.map((u) => {
            const stat = countStats(
              questions.filter((q) => q.subject === subject && q.unit === u && matchesTag(q, selectedTag)),
              history
            );
            return (
              <button key={u} className="unitCard" onClick={() => selectUnit(u)}>
                <div>
                  <strong>{u}</strong>
                  <small>{stat.total}問 / 復習 {stat.due}問 / 苦手 {stat.weak}問 / 正答率 {stat.rate}%</small>
                  <div className="thinBar"><div style={{ width: `${Math.min(100, stat.rate)}%` }} /></div>
                </div>
                <span>›</span>
              </button>
            );
          })}
        </>
      )}

      {screen === "terms" && (
        <>
          <div className="pageTitle">
            <button onClick={() => setScreen("units")}>‹</button>
            <h2>{unit}</h2>
          </div>
          {terms.map((t) => {
            const stat = countStats(
              questions.filter((q) => q.subject === subject && q.unit === unit && q.term === t && matchesTag(q, selectedTag)),
              history
            );
            return (
              <button key={t} className="unitCard" onClick={() => selectTerm(t)}>
                <div>
                  <strong>{t}</strong>
                  <small>{stat.total}問 / 復習 {stat.due}問 / 苦手 {stat.weak}問 / 正答率 {stat.rate}%</small>
                  <div className="thinBar"><div style={{ width: `${Math.min(100, stat.rate)}%` }} /></div>
                </div>
                <span>›</span>
              </button>
            );
          })}
        </>
      )}

      {screen === "ranges" && (
        <>
          <div className="pageTitle">
            <button onClick={() => setScreen("terms")}>‹</button>
            <h2>{term}</h2>
          </div>

          <div className="modeTabs">
            <button className={mode === "normal" ? "active" : ""} onClick={() => setMode("normal")}>おすすめ</button>
            <button className={mode === "review" ? "active" : ""} onClick={() => setMode("review")}>復習</button>
            <button className={mode === "weak" ? "active" : ""} onClick={() => setMode("weak")}>苦手</button>
            <button className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>未学習</button>
          </div>

          {allTags.length > 0 && (
            <div className="tagFilter compact">
              <button className={selectedTag === "" ? "active" : ""} onClick={() => setSelectedTag("")}>すべて</button>
              {allTags.map((tag) => (
                <button key={tag} className={selectedTag === tag ? "active" : ""} onClick={() => setSelectedTag(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          )}

          {ranges.map((r) => {
            const stat = countStats(
              questions.filter(
                (q) =>
                  q.subject === subject &&
                  q.unit === unit &&
                  q.term === term &&
                  q.range === r &&
                  matchesTag(q, selectedTag)
              ),
              history
            );
            return (
              <button key={r} className="unitCard" onClick={() => startStudy(r)}>
                <div>
                  <strong>{r}</strong>
                  <small>{stat.total}問 / 復習 {stat.due}問 / 苦手 {stat.weak}問 / 正答率 {stat.rate}%</small>
                  <div className="thinBar"><div style={{ width: `${Math.min(100, stat.rate)}%` }} /></div>
                </div>
                <span>開始</span>
              </button>
            );
          })}
        </>
      )}

      {screen === "study" && currentQuestion && (
        <>
          <div className="studyTop">
            <span>{[subject, unit, term, range].filter(Boolean).join(" / ")}</span>
            <strong>{currentIndex + 1}/{sessionQuestions.length}</strong>
          </div>
          <div className="progressBar"><div style={{ width: `${((currentIndex + 1) / sessionQuestions.length) * 100}%` }} /></div>

          <section className="questionPanel">
            <p className="modeLabel">
              {mode === "review" ? "復習タイミング" : mode === "normal" ? "おすすめ" : mode === "weak" ? "苦手問題" : "未学習"}
            </p>
            <h2>{currentQuestion.question}</h2>
            {currentQuestion.tags?.length > 0 && (
              <div className="questionTags">
                {currentQuestion.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
          </section>

          <section className="studyControls">
            <button className={hesitated ? "active" : ""} onClick={() => setHesitated((v) => !v)}>迷った</button>
            <label>
              自信度
              <input type="range" min="1" max="5" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
              <strong>{confidence}</strong>
            </label>
          </section>

          {!showChoices && <div className="thinkingPanel">問題を読んで考えてください...</div>}

          {showChoices && (
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

          <button className="bigSecondary" onClick={() => setScreen("result")}>終了する</button>

          {answered && (
            <div className="resultModal" role="dialog" aria-modal="true">
              <section className="resultModalContent">
                <strong>{selectedIndex === currentQuestion.answerIndex ? "正解！" : "不正解"}</strong>
                <p>{currentQuestion.explanation}</p>
                <div className="answerMeta">
                  <span>回答 {answerMeta ? (answerMeta.responseTimeMs / 1000).toFixed(1) : "0.0"}秒</span>
                  <span>{answerMeta?.hesitated ? "迷った" : "迷いなし"}</span>
                  <span>自信度 {answerMeta?.confidence}</span>
                </div>
                {currentQHistory && (
                  <small>
                    次回復習: {currentQHistory.nextReviewAt || "今日"} / 連続正解: {currentQHistory.streak || 0} / 不正解累計: {currentQHistory.wrong || 0}
                  </small>
                )}
                <button className="bigPrimary" onClick={nextQuestion}>
                  {currentIndex >= sessionQuestions.length - 1 ? "結果を見る" : "次へ"}
                </button>
              </section>
            </div>
          )}
        </>
      )}

      {screen === "result" && (
        <>
          <section className="resultPanel">
            <p>今回の結果</p>
            <h2>{percent}%</h2>
            <div className="resultStats">
              <div><strong>{result.total}</strong><small>出題</small></div>
              <div><strong>{result.correct}</strong><small>正解</small></div>
              <div><strong>{result.wrong}</strong><small>不正解</small></div>
            </div>
          </section>
          <button className="bigPrimary" onClick={startAllDueReview}>今日の復習を続ける</button>
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
            <p className="description">学習履歴は `localStorage` にユーザー別キーで保存します。最大5人の固定ユーザーを想定し、各ユーザーの履歴は分離しています。</p>
          </section>
          <section className="panel">
            <h2 className="panelTitle">学習履歴</h2>
            <button className="dangerButton" onClick={resetHistory}>このユーザーの履歴をリセット</button>
          </section>
        </>
      )}
    </div>
  );
}
