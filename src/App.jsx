import { useEffect, useState } from "react";

const URL = "https://docs.google.com/spreadsheets/d/1ZQn3vKJH6fPpJIrwJiPYfIvbm9p9-Qq7kiRbUpfIuoY/edit?usp=sharing";

export default function App() {
  const [q, setQ] = useState([]);
  const [i, setI] = useState(0);
  const [sel, setSel] = useState(null);
  const [showChoices, setShowChoices] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    fetch(URL)
      .then((r) => r.text())
      .then((t) => {
        const lines = t.split("\n").slice(1);
        setQ(
          lines.map((x) => {
            const v = x.split(",");
            return {
              question: v[8],
              choices: [v[9], v[10], v[11], v[12]],
              answer: Number(v[13]) - 1,
            };
          })
        );
      });
  }, []);

  useEffect(() => {
    setShowChoices(false);
    setTimeout(() => setShowChoices(true), 1000);
    setStartTime(Date.now());
  }, [i]);

  if (!q.length) return <div style={styles.loading}>Loading...</div>;

  const cur = q[i];

  const answer = (idx) => {
    if (sel !== null) return;
    setSel(idx);
    setElapsed(((Date.now() - startTime) / 1000).toFixed(1));
  };

  const next = () => {
    setSel(null);
    setI((prev) => (prev + 1) % q.length);
  };

  return (
    <div style={styles.container}>
      {/* 進捗バー */}
      <div style={styles.progress}>
        <div
          style={{
            ...styles.progressBar,
            width: `${((i + 1) / q.length) * 100}%`,
          }}
        />
      </div>

      <div style={styles.card}>
        <div style={styles.question}>{cur.question}</div>

        {!showChoices && <div style={styles.wait}>考えてください...</div>}

        {showChoices &&
          cur.choices.map((c, idx) => {
            const isCorrect = idx === cur.answer;
            const isSelected = idx === sel;

            let bg = "#fff";
            if (sel !== null && isCorrect) bg = "#d1fae5";
            if (sel !== null && isSelected && !isCorrect) bg = "#fee2e2";

            return (
              <button
                key={idx}
                onClick={() => answer(idx)}
                style={{ ...styles.choice, background: bg }}
              >
                {c}
              </button>
            );
          })}
      </div>

      {/* ポップアップ */}
      {sel !== null && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2>{sel === cur.answer ? "正解！" : "不正解"}</h2>
            <p>回答時間: {elapsed}s</p>

            <button onClick={next} style={styles.next}>
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 420,
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui",
    background: "#f6f7fb",
    minHeight: "100vh",
  },
  loading: {
    textAlign: "center",
    marginTop: 100,
  },
  progress: {
    height: 6,
    background: "#ddd",
    borderRadius: 10,
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    background: "#4f46e5",
    borderRadius: 10,
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
  },
  question: {
    fontSize: 22,
    marginBottom: 20,
  },
  wait: {
    textAlign: "center",
    color: "#888",
    marginBottom: 20,
  },
  choice: {
    width: "100%",
    padding: 16,
    marginBottom: 10,
    fontSize: 18,
    borderRadius: 14,
    border: "1px solid #ddd",
  },
  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    background: "#fff",
    padding: 30,
    borderRadius: 20,
    textAlign: "center",
    width: 300,
  },
  next: {
    marginTop: 20,
    padding: 14,
    width: "100%",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 18,
  },
};