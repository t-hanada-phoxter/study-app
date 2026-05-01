import { useEffect, useState } from "react";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1ZQn3vKJH6fPpJIrwJiPYfIvbm9p9-Qq7kiRbUpfIuoY/gviz/tq?tqx=out:csv&sheet=questions";

function parseCsv(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    const values = line.split(",");

    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() ?? "";
    });

    return {
      id: row.id,
      subject: row.subject,
      unit: row.unit,
      question: row.question,
      choices: [row.choice1, row.choice2, row.choice3, row.choice4],
      answerIndex: Number(row.answer) - 1,
      explanation: row.explanation,
    };
  });
}

export default function App() {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);

  useEffect(() => {
    fetch(SHEET_CSV_URL)
      .then((res) => res.text())
      .then((text) => {
        const data = parseCsv(text);
        setQuestions(data);
      })
      .catch((err) => {
        console.error("Failed to load sheet:", err);
      });
  }, []);

  if (questions.length === 0) {
    return <div style={styles.container}>Loading...</div>;
  }

  const question = questions[currentIndex];
  const answered = selectedIndex !== null;

  function answer(index) {
    if (answered) return;
    setSelectedIndex(index);
  }

  function next() {
    setSelectedIndex(null);
    setCurrentIndex((prev) => (prev + 1) % questions.length);
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>受験カード</h1>

      <div style={styles.card}>
        <div style={styles.meta}>
          {question.subject} / {question.unit}
        </div>

        <h2 style={styles.question}>{question.question}</h2>

        {question.choices.map((choice, index) => {
          const isCorrect = index === question.answerIndex;
          const isSelected = index === selectedIndex;

          let background = "#fff";
          if (answered && isCorrect) background = "#dcfce7";
          if (answered && isSelected && !isCorrect) background = "#fee2e2";

          return (
            <button
              key={index}
              onClick={() => answer(index)}
              style={{ ...styles.choice, background }}
            >
              {index + 1}. {choice}
            </button>
          );
        })}

        {answered && (
          <div style={styles.explanation}>
            {selectedIndex === question.answerIndex ? "正解！" : "不正解"}
            <br />
            {question.explanation}
          </div>
        )}

        {answered && (
          <button onClick={next} style={styles.nextButton}>
            次の問題へ
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 420,
    margin: "0 auto",
    padding: 20,
    fontFamily: "system-ui, sans-serif",
    background: "#f6f7fb",
    minHeight: "100vh",
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
  },
  meta: {
    color: "#666",
    fontSize: 14,
    marginBottom: 12,
  },
  question: {
    fontSize: 24,
    marginBottom: 20,
  },
  choice: {
    width: "100%",
    padding: 16,
    marginBottom: 10,
    borderRadius: 14,
    border: "1px solid #ddd",
    fontSize: 16,
    textAlign: "left",
  },
  explanation: {
    marginTop: 16,
    padding: 14,
    background: "#f1f5f9",
    borderRadius: 12,
    lineHeight: 1.6,
  },
  nextButton: {
    width: "100%",
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
};