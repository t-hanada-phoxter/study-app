import { useEffect, useMemo, useState } from "react";
import "./App.css";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1ZQn3vKJH6fPpJIrwJiPYfIvbm9p9-Qq7kiRbUpfIuoY/gviz/tq?tqx=out:csv&sheet=questions";

const CURRENT_USER_KEY = "studyApp.currentUser.v3";

function getHistoryKey(userName) {
  return `studyApp.history.v3.${userName}`;
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
        id: row.id,
        subject: row.subject,
        unit: row.unit,
        question: row.question,
        choices: [row.choice1, row.choice2, row.choice3, row.choice4],
        answerIndex: Number(row.answer || "1") - 1,
        explanation: row.explanation,
        difficulty: Number(row.difficulty || "1"),
        enabled: row.enabled === "" || row.enabled?.toLowerCase() === "true",
      };
    })
    .filter((q) => q.id && q.enabled);
}

function loadHistory(userName) {
  if (!userName) return { questions: {}, daily: {} };

  try {
    const raw = JSON.parse(localStorage.getItem(getHistoryKey(userName)));

    // v2互換
    if (raw && !raw.questions) {
      return {
        questions: raw,
        daily: {},
      };
    }

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

function updateDailyStats(history, isCorrect) {
  const key = todayKey();
  const current = history.daily?.[key] || {
    studied: 0,
    correct: 0,
    wrong: 0,
  };

  current.studied += 1;
  if (isCorrect) current.correct += 1;
  else current.wrong += 1;

  return {
    ...history,
    daily: {
      ...(history.daily || {}),
      [key]: current,
    },
  };
}

/**
 * 忘却曲線・間隔反復を意識した簡易スケジューリング。
 *
 * 方針:
 * - 間違えた問題は短期復習: 今日〜明日へすぐ再出題。
 * - ただし間違い回数が多い問題は、直後に連続正解しても簡単に卒業させない。
 * - 正解が続くほど nextReviewAt を 1日→3日→7日→14日→30日へ広げる。
 * - wrong が多い問題は interval を短くし、weakWeight を残す。
 */
function computeNextSchedule(item, isCorrect) {
  const now = new Date();

  const wrong = item.wrong || 0;
  const streak = item.streak || 0;
  const ease = item.ease ?? 2.2;

  if (!isCorrect) {
    return {
      ease: Math.max(1.3, ease - 0.25),
      reviewLevel: 0,
      intervalDays: 0,
      weakWeight: Math.min(200, (item.weakWeight || 0) + 45),
      nextReviewAt: todayKey(now),
      mastered: false,
    };
  }

  // 間違いが多い問題は、連続正解しても弱点重みを急に下げない。
  const difficultPenalty = Math.min(0.65, wrong * 0.12);
  const newEase = Math.min(3.0, ease + 0.08);
  const newLevel = Math.min(6, (item.reviewLevel || 0) + 1);

  const baseIntervals = [1, 1, 3, 7, 14, 30, 60];
  let interval = baseIntervals[newLevel] ?? 60;

  // 失敗履歴が多い問題ほど復習間隔を短めにする。
  interval = Math.max(1, Math.round(interval * (1 - difficultPenalty)));

  // 直近で間違えやすい問題は、3連続正解でも同日には完全に弱点解除しない。
  const newWeakWeight =
    wrong >= 2
      ? Math.max(25, Math.round((item.weakWeight || 0) * 0.86))
      : Math.max(0, Math.round((item.weakWeight || 0) * 0.62));

  return {
    ease: newEase,
    reviewLevel: newLevel,
    intervalDays: interval,
    weakWeight: newWeakWeight,
    nextReviewAt: todayKey(addDays(now, interval)),
    mastered: streak + 1 >= 3 && wrong <= 1,
  };
}

function updateHistory(userName, questionId, isCorrect) {
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
  };

  const updated = { ...current };
  updated.answeredCount += 1;
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

  Object.assign(updated, computeNextSchedule(updated, isCorrect));
  updated.lastAnsweredAt = new Date().toISOString();

  history = {
    ...history,
    questions: {
      ...(history.questions || {}),
      [questionId]: updated,
    },
  };

  history = updateDailyStats(history, isCorrect);

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
    ((h.wrong || 0) >= 1 && (h.streak || 0) < 3)
  );
}

function scoreQuestion(q, history) {
  const h = getQuestionHistory(history, q.id);

  // 未学習は初回学習対象
  if (!h) return 95;

  const due = daysUntil(h.nextReviewAt) <= 0;
  const overdueDays = Math.max(0, -daysUntil(h.nextReviewAt));

  let score = 0;
  if (due) score += 120;
  score += overdueDays * 10;
  score += (h.weakWeight || 0);
  score += (h.wrong || 0) * 22;
  score += Math.max(0, 3 - (h.streak || 0)) * 10;

  // 短期間に連続正解しても、間違えやすい問題はスコアを下げすぎない
  if ((h.wrong || 0) >= 2 && (h.streak || 0) >= 2) score += 35;

  // まだ復習日でない場合は出しすぎない
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

  if (mode === "new") {
    return questions.filter((q) => !getQuestionHistory(history, q.id));
  }

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

const DEFAULT_USERS = ["user1", "user2", "user3"];

export default function App() {
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState("login");

  const [userName, setUserName] = useState(localStorage.getItem(CURRENT_USER_KEY) || "");
  const [loginInput, setLoginInput] = useState(localStorage.getItem(CURRENT_USER_KEY) || "user1");

  const [history, setHistory] = useState(() => loadHistory(localStorage.getItem(CURRENT_USER_KEY) || ""));
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("");
  const [mode, setMode] = useState("normal");
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [result, setResult] = useState({ total: 0, correct: 0, wrong: 0 });
  const [calendarDate, setCalendarDate] = useState(new Date());

  useEffect(() => {
    fetch(SHEET_CSV_URL)
      .then((res) => {
        if (!res.ok) throw new Error("問題データの取得に失敗しました");
        return res.text();
      })
      .then((text) => setQuestions(parseCsv(text)))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (userName) {
      setHistory(loadHistory(userName));
      setScreen("home");
    }
  }, [userName]);

  const subjects = useMemo(() => unique(questions.map((q) => q.subject)), [questions]);

  const units = useMemo(
    () => unique(questions.filter((q) => q.subject === subject).map((q) => q.unit)),
    [questions, subject]
  );

  const dueCount = useMemo(
    () => questions.filter((q) => isDue(q, history) && getQuestionHistory(history, q.id)).length,
    [questions, history]
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

  function getSubjectStats(targetSubject) {
    const list = questions.filter((q) => q.subject === targetSubject);
    const studied = list.filter((q) => getQuestionHistory(history, q.id));
    const weak = list.filter((q) => isWeakQuestion(q, history));
    const due = list.filter((q) => isDue(q, history) && getQuestionHistory(history, q.id));
    return { total: list.length, studied: studied.length, weak: weak.length, due: due.length };
  }

  function getUnitStats(targetSubject, targetUnit) {
    const list = questions.filter((q) => q.subject === targetSubject && q.unit === targetUnit);
    const studied = list.filter((q) => getQuestionHistory(history, q.id));
    const weak = list.filter((q) => isWeakQuestion(q, history));
    const due = list.filter((q) => isDue(q, history) && getQuestionHistory(history, q.id));

    const correct = studied.reduce((sum, q) => sum + (getQuestionHistory(history, q.id)?.correct || 0), 0);
    const wrong = studied.reduce((sum, q) => sum + (getQuestionHistory(history, q.id)?.wrong || 0), 0);
    const rate = correct + wrong === 0 ? 0 : Math.round((correct / (correct + wrong)) * 100);

    return { total: list.length, studied: studied.length, weak: weak.length, due: due.length, rate };
  }

  function selectSubject(nextSubject) {
    setSubject(nextSubject);
    setScreen("units");
  }

  function startStudy(targetUnit, targetMode = mode) {
    const base = questions.filter((q) => q.subject === subject && q.unit === targetUnit);
    const filtered = filterByMode(base, history, targetMode);
    const list = filtered.length > 0 ? filtered : base;

    setUnit(targetUnit);
    setMode(targetMode);
    setSessionQuestions(list.slice(0, 10));
    setCurrentIndex(0);
    setSelectedIndex(null);
    setResult({ total: Math.min(list.length, 10), correct: 0, wrong: 0 });
    setScreen("study");
  }

  function startAllDueReview() {
    const list = filterByMode(questions, history, "review");
    if (list.length === 0) {
      alert("今日の復習対象はありません。");
      return;
    }

    setSubject("復習");
    setUnit("今日の復習");
    setMode("review");
    setSessionQuestions(list.slice(0, 10));
    setCurrentIndex(0);
    setSelectedIndex(null);
    setResult({ total: Math.min(list.length, 10), correct: 0, wrong: 0 });
    setScreen("study");
  }

  function answer(index) {
    if (selectedIndex !== null) return;

    const q = sessionQuestions[currentIndex];
    const isCorrect = index === q.answerIndex;
    const newHistory = updateHistory(userName, q.id, isCorrect);

    setSelectedIndex(index);
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

  if (error) {
    return (
      <div className="app">
        <div className="brandHeader"><div className="logo">M</div><h1>受験カード</h1></div>
        <div className="panel error">{error}</div>
      </div>
    );
  }

  if (screen !== "login" && questions.length === 0) {
    return (
      <div className="app">
        <div className="brandHeader"><div className="logo">M</div><h1>受験カード</h1></div>
        <div className="panel loading">問題データを読み込み中...</div>
      </div>
    );
  }

  const currentQuestion = sessionQuestions[currentIndex];
  const answered = selectedIndex !== null;
  const percent = result.total === 0 ? 0 : Math.round((result.correct / result.total) * 100);
  const currentQHistory = currentQuestion ? getQuestionHistory(history, currentQuestion.id) : null;

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const calendarDays = buildCalendarDays(calendarYear, calendarMonth);

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

      {screen === "login" && (
        <>
          <section className="hero mikanHero">
            <div className="heroIcon">✓</div>
            <h2>今日の復習を<br />すぐ始めよう</h2>
            <p>忘却曲線を意識して、復習タイミングを自動調整します。</p>
          </section>

          <section className="panel">
            <h2 className="panelTitle">ユーザーログイン</h2>
            <p className="description">確認用の簡易ログインです。履歴はユーザー別にこの端末へ保存します。</p>

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
            <p>間違えやすい問題は、連続正解しても一定期間後に再出題します。</p>
          </section>

          <button className="reviewNow" onClick={startAllDueReview}>
            <span>今日の復習</span>
            <strong>{dueCount}問</strong>
          </button>

          <button className="calendarButton" onClick={() => setScreen("calendar")}>
            学習カレンダーを見る
          </button>

          <h3 className="sectionTitle">教科を選択</h3>

          {subjects.map((s) => {
            const stat = getSubjectStats(s);
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

          <div className="modeTabs">
            <button className={mode === "normal" ? "active" : ""} onClick={() => setMode("normal")}>おすすめ</button>
            <button className={mode === "review" ? "active" : ""} onClick={() => setMode("review")}>復習</button>
            <button className={mode === "weak" ? "active" : ""} onClick={() => setMode("weak")}>苦手</button>
            <button className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>未学習</button>
          </div>

          {units.map((u) => {
            const stat = getUnitStats(subject, u);
            return (
              <button key={u} className="unitCard" onClick={() => startStudy(u)}>
                <div>
                  <strong>{u}</strong>
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
            <span>{subject} / {unit}</span>
            <strong>{currentIndex + 1}/{sessionQuestions.length}</strong>
          </div>

          <div className="progressBar"><div style={{ width: `${((currentIndex + 1) / sessionQuestions.length) * 100}%` }} /></div>

          <section className="questionPanel">
            <p className="modeLabel">
              {mode === "review" ? "復習タイミング" : mode === "normal" ? "おすすめ" : mode === "weak" ? "苦手問題" : "未学習"}
            </p>
            <h2>{currentQuestion.question}</h2>
          </section>

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

          {answered && (
            <section className="answerPanel">
              <strong>{selectedIndex === currentQuestion.answerIndex ? "正解！" : "不正解"}</strong>
              <p>{currentQuestion.explanation}</p>
              {currentQHistory && (
                <small>
                  次回復習: {currentQHistory.nextReviewAt || "今日"} / 連続正解: {currentQHistory.streak || 0} / 不正解累計: {currentQHistory.wrong || 0}
                </small>
              )}
            </section>
          )}

          {answered && (
            <button className="bigPrimary" onClick={nextQuestion}>
              {currentIndex >= sessionQuestions.length - 1 ? "結果を見る" : "次へ"}
            </button>
          )}

          <button className="bigSecondary" onClick={() => setScreen("result")}>終了する</button>
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

          <section className="panel">
            <h2 className="panelTitle">見方</h2>
            <p className="description">色が濃いほど、その日に多く学習しています。正解・不正解は端末内のユーザー別履歴に蓄積されます。</p>
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
            <h2 className="panelTitle">復習ロジック</h2>
            <p className="description">
              間違えた問題は weakWeight を増やし、短期復習対象にします。正解が続くと復習間隔を 1日→3日→7日→14日→30日 のように広げます。
            </p>
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
