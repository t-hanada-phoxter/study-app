import { useEffect, useMemo, useState } from "react";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1ZQn3vKJH6fPpJIrwJiPYfIvbm9p9-Qq7kiRbUpfIuoY/gviz/tq?tqx=out:csv&sheet=questions";

const HISTORY_KEY = "studyHistory.v1";

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

  return lines.slice(1).map((line) => {
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
  }).filter((q) => q.id && q.enabled);
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};
  } catch {
    return {};
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function updateHistory(questionId, isCorrect) {
  const history = loadHistory();
  const item = history[questionId] || {
    correct: 0,
    wrong: 0,
    lastResult: null,
    streak: 0,
    lastAnsweredAt: null,
  };

  if (isCorrect) {
    item.correct += 1;
    item.lastResult = "correct";
    item.streak += 1;
  } else {
    item.wrong += 1;
    item.lastResult = "wrong";
    item.streak = 0;
  }

  item.lastAnsweredAt = new Date().toISOString();
  history[questionId] = item;
  saveHistory(history);
  return history;
}

function scoreQuestion(q, history) {
  const h = history[q.id];
  if (!h) return 30;
  let score = 0;
  if (h.lastResult === "wrong") score += 100;
  score += h.wrong * 15;
  score -= h.streak * 8;
  score += Math.max(0, 5 - h.correct);
  return score;
}

function filterByMode(questions, history, mode) {
  if (mode === "weak") {
    return questions.filter((q) => {
      const h = history[q.id];
      return h && (h.lastResult === "wrong" || (h.wrong > 0 && h.streak < 3));
    });
  }

  if (mode === "new") {
    return questions.filter((q) => !history[q.id]);
  }

  return [...questions].sort((a, b) => scoreQuestion(b, history) - scoreQuestion(a, history));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export default function App() {
  const [questions, setQuestions] = useState([]);
  const [history, setHistory] = useState(loadHistory());
  const [screen, setScreen] = useState("home");
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("");
  const [mode, setMode] = useState("normal");
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [result, setResult] = useState({ total: 0, correct: 0, wrong: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(SHEET_CSV_URL)
      .then((res) => {
        if (!res.ok) throw new Error("CSV取得に失敗しました");
        return res.text();
      })
      .then((text) => {
        const data = parseCsv(text);
        setQuestions(data);
      })
      .catch((err) => {
        setError(err.message);
      });
  }, []);

  const subjects = useMemo(() => unique(questions.map((q) => q.subject)), [questions]);
  const units = useMemo(
    () => unique(questions.filter((q) => q.subject === subject).map((q) => q.unit)),
    [questions, subject]
  );

  function getUnitStats(targetSubject, targetUnit) {
    const list = questions.filter((q) => q.subject === targetSubject && q.unit === targetUnit);
    const studied = list.filter((q) => history[q.id]);
    const weak = list.filter((q) => {
      const h = history[q.id];
      return h && (h.lastResult === "wrong" || (h.wrong > 0 && h.streak < 3));
    });

    const correct = studied.reduce((sum, q) => sum + (history[q.id]?.correct || 0), 0);
    const wrong = studied.reduce((sum, q) => sum + (history[q.id]?.wrong || 0), 0);
    const rate = correct + wrong === 0 ? 0 : Math.round((correct / (correct + wrong)) * 100);

    return { total: list.length, weak: weak.length, rate };
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

  function answer(index) {
    if (selectedIndex !== null) return;

    const q = sessionQuestions[currentIndex];
    const isCorrect = index === q.answerIndex;
    const newHistory = updateHistory(q.id, isCorrect);

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
    localStorage.removeItem(HISTORY_KEY);
    setHistory({});
    alert("学習履歴をリセットしました");
  }

  if (error) {
    return (
      <div className="app">
        <h1>受験カード</h1>
        <div className="card error">{error}</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="app">
        <h1>受験カード</h1>
        <div className="card">問題データを読み込み中...</div>
      </div>
    );
  }

  const currentQuestion = sessionQuestions[currentIndex];
  const answered = selectedIndex !== null;
  const percent = result.total === 0 ? 0 : Math.round((result.correct / result.total) * 100);

  return (
    <div className="app">
      <header className="header">
        <button className="linkButton" onClick={() => setScreen("home")}>教科</button>
        <h1>受験カード</h1>
        <button className="linkButton" onClick={() => setScreen("settings")}>設定</button>
      </header>

      {screen === "home" && (
        <>
          <section className="hero">
            <h2>短時間で苦手をつぶす</h2>
            <p>間違えた問題は自動で復習候補に残ります。</p>
          </section>

          <h3 className="sectionTitle">教科を選択</h3>
          {subjects.map((s) => {
            const count = questions.filter((q) => q.subject === s).length;
            return (
              <button key={s} className="selectCard" onClick={() => selectSubject(s)}>
                <span>
                  <strong>{s}</strong>
                  <small>{count}問</small>
                </span>
                <b>›</b>
              </button>
            );
          })}
        </>
      )}

      {screen === "units" && (
        <>
          <h3 className="sectionTitle">{subject} / 単元選択</h3>

          <div className="modeTabs">
            <button className={mode === "normal" ? "active" : ""} onClick={() => setMode("normal")}>通常</button>
            <button className={mode === "weak" ? "active" : ""} onClick={() => setMode("weak")}>苦手</button>
            <button className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>未学習</button>
          </div>

          {units.map((u) => {
            const stat = getUnitStats(subject, u);
            return (
              <button key={u} className="selectCard" onClick={() => startStudy(u)}>
                <span>
                  <strong>{u}</strong>
                  <small>{stat.total}問 / 苦手 {stat.weak}問 / 正答率 {stat.rate}%</small>
                </span>
                <b>開始</b>
              </button>
            );
          })}
        </>
      )}

      {screen === "study" && currentQuestion && (
        <>
          <div className="studyTop">
            <span>{subject} / {unit}</span>
            <span>{currentIndex + 1}/{sessionQuestions.length}</span>
          </div>

          <div className="bar">
            <div style={{ width: `${((currentIndex + 1) / sessionQuestions.length) * 100}%` }} />
          </div>

          <section className="questionCard">
            <p className="modeLabel">
              {mode === "normal" ? "通常学習" : mode === "weak" ? "苦手問題" : "未学習"}
            </p>
            <h2>{currentQuestion.question}</h2>
          </section>

          <div className="choices">
            {currentQuestion.choices.map((choice, index) => {
              const isCorrect = index === currentQuestion.answerIndex;
              const isSelected = index === selectedIndex;
              let cls = "choice";
              if (answered && isCorrect) cls += " correct";
              if (answered && isSelected && !isCorrect) cls += " wrong";

              return (
                <button key={index} className={cls} onClick={() => answer(index)}>
                  <span>{index + 1}</span>
                  {choice}
                </button>
              );
            })}
          </div>

          {answered && (
            <section className="explanation">
              <strong>{selectedIndex === currentQuestion.answerIndex ? "正解！" : "不正解"}</strong>
              <p>{currentQuestion.explanation}</p>
            </section>
          )}

          {answered && (
            <button className="primary" onClick={nextQuestion}>
              {currentIndex >= sessionQuestions.length - 1 ? "結果を見る" : "次の問題へ"}
            </button>
          )}

          <button className="secondary" onClick={() => setScreen("result")}>終了する</button>
        </>
      )}

      {screen === "result" && (
        <>
          <section className="resultCard">
            <p>今回の結果</p>
            <h2>{percent}%</h2>
            <div className="stats">
              <div><strong>{result.total}</strong><small>出題</small></div>
              <div><strong>{result.correct}</strong><small>正解</small></div>
              <div><strong>{result.wrong}</strong><small>不正解</small></div>
            </div>
          </section>

          <button className="primary" onClick={() => startStudy(unit, "weak")}>苦手問題を復習</button>
          <button className="secondary" onClick={() => setScreen("units")}>単元へ戻る</button>
          <button className="secondary" onClick={() => setScreen("home")}>教科へ戻る</button>
        </>
      )}

      {screen === "settings" && (
        <>
          <h3 className="sectionTitle">設定</h3>
          <section className="card">
            <h2>学習履歴</h2>
            <p>この端末のブラウザに保存された正解・不正解履歴を削除します。</p>
            <button className="danger" onClick={resetHistory}>履歴をリセット</button>
          </section>
          <section className="card">
            <h2>問題データ</h2>
            <p>問題はGoogleスプレッドシートから読み込んでいます。更新後はページを再読み込みしてください。</p>
          </section>
        </>
      )}
    </div>
  );
}
