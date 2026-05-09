import csv
import html
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[0]
TMP = ROOT.parent / "tmp"
LEAP_HTML = TMP / "leap.html"
GOGENGO_ROOTS_HTML = TMP / "gogengo_roots.html"
ETYMOLOGY_CSV = ROOT.parent / "語源.csv"

FIELDNAMES = [
    "id",
    "subject",
    "unit",
    "term",
    "range",
    "question",
    "choice1",
    "choice2",
    "choice3",
    "choice4",
    "choice5",
    "choice6",
    "choice7",
    "choice8",
    "answer",
    "explanation",
    "tags",
    "difficulty",
    "enabled",
]

TAG_WORDS = {
    "環境": {
        "environment",
        "nature",
        "natural",
        "climate",
        "weather",
        "resource",
        "waste",
        "energy",
        "pollution",
        "species",
        "plant",
        "animal",
        "earth",
        "ocean",
        "forest",
        "agriculture",
        "farm",
        "water",
        "sustain",
    },
    "IT": {
        "technology",
        "information",
        "data",
        "digital",
        "computer",
        "system",
        "media",
        "network",
        "device",
        "online",
        "internet",
        "communicate",
        "research",
        "search",
        "image",
        "software",
        "web",
    },
    "経済": {
        "economy",
        "economic",
        "company",
        "business",
        "trade",
        "market",
        "price",
        "cost",
        "budget",
        "fee",
        "wealth",
        "capital",
        "earn",
        "customer",
        "produce",
        "profit",
        "value",
        "money",
        "tax",
        "industry",
    },
}

GENERIC_TAGS = ["環境", "IT", "経済"]


def clean_text(value):
    text = html.unescape(re.sub(r"<[^>]+>", "", str(value)))
    return re.sub(r"\s+", " ", text).strip()


def normalize_word(value):
    word = clean_text(value)
    word = re.sub(r"^[^A-Za-z]+|[^A-Za-z\-\s]+$", "", word)
    return re.sub(r"\s+", " ", word).strip()


def clean_meaning(value):
    meaning = clean_text(value)
    meaning = re.sub(r"\[[^\]]+\]", "", meaning)
    meaning = meaning.replace("（－s）", "（複数形）")
    return re.sub(r"\s+", " ", meaning).strip()


def load_leap_items():
    source = LEAP_HTML.read_text(encoding="utf-8", errors="ignore")
    pattern = re.compile(
        r"<tr[^>]*>\s*<td[^>]*>\s*(\d+)\s*</td>\s*"
        r"<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*</tr>",
        re.S,
    )
    items = []
    for number, word_html, meaning_html in pattern.findall(source):
        word = normalize_word(word_html)
        meaning = clean_meaning(meaning_html)
        if word and meaning and re.search(r"[A-Za-z]", word):
            items.append({"number": int(number), "word": word, "meaning": meaning})

    items.sort(key=lambda item: item["number"])
    seen = set()
    deduped = []
    for item in items:
        key = item["word"].lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def load_roots():
    source = GOGENGO_ROOTS_HTML.read_text(encoding="utf-8", errors="ignore")
    pattern = re.compile(r"<td><a href=\"/roots/\d+\">(.*?)</a></td>\s*<td>(.*?)</td>", re.S)
    roots = []
    for spelling_html, meaning_html in pattern.findall(source):
        meaning = clean_text(meaning_html)
        spellings = clean_text(spelling_html).split(",")
        for spelling in spellings:
            spelling = spelling.strip()
            if not spelling:
                continue
            bare = spelling.strip("-").lower()
            if len(bare) < 3:
                continue
            if spelling.startswith("-") and len(bare) < 4:
                continue
            if not spelling.startswith("-") and not spelling.endswith("-") and len(bare) < 4:
                continue
            roots.append(
                {
                    "spelling": spelling,
                    "bare": bare,
                    "meaning": meaning,
                    "kind": "suffix" if spelling.startswith("-") else "prefix" if spelling.endswith("-") else "root",
                }
            )
    return roots


def read_text_with_fallback(path):
    for encoding in ("utf-8-sig", "utf-8", "cp932"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="replace")


def load_etymology_notes():
    if not ETYMOLOGY_CSV.exists():
        return {}

    notes = {}
    source = read_text_with_fallback(ETYMOLOGY_CSV)
    reader = csv.reader(source.splitlines(), delimiter="\t")
    for row in reader:
        if len(row) < 4:
            continue
        word = normalize_word(row[1]).lower()
        note = clean_text(row[3])
        if word and note:
            notes[word] = note
    return notes


def etymology_note(word, roots, etymology_notes):
    csv_note = etymology_notes.get(word.lower())
    if csv_note:
        return f"語源メモ: {csv_note}。"

    normalized = word.lower().replace("-", "")
    matches = []
    for root in roots:
        bare = root["bare"].replace("-", "")
        if root["kind"] == "prefix" and normalized.startswith(bare):
            score = len(bare) + 2
        elif root["kind"] == "suffix" and normalized.endswith(bare):
            score = len(bare) + 1
        elif root["kind"] == "root" and (normalized.startswith(bare) or normalized.endswith(bare)):
            score = len(bare)
        else:
            continue
        matches.append((score, root))

    if not matches:
        return ""

    selected = []
    seen = set()
    for _, root in sorted(matches, key=lambda item: (-item[0], item[1]["spelling"])):
        key = root["spelling"]
        if key in seen:
            continue
        seen.add(key)
        selected.append(f"{root['spelling']}「{root['meaning']}」")
        if len(selected) >= 3:
            break

    return "語源メモ: " + "、".join(selected) + "。"


def choose_tags(word, meaning):
    text = f"{word} {meaning}".lower()
    tags = [tag for tag, keys in TAG_WORDS.items() if any(key in text for key in keys)]
    if tags:
        return tags
    return [GENERIC_TAGS[sum(ord(char) for char in word) % len(GENERIC_TAGS)]]


def term_for_index(index, total):
    ratio = index / max(total, 1)
    if ratio < 1 / 3:
        return "1学期"
    if ratio < 2 / 3:
        return "2学期"
    return "3学期"


def range_for_index(index):
    return f"範囲{chr(ord('A') + (index % 5))}"


def difficulty_for_index(index, total):
    return str(min(5, max(2, 2 + int(index / max(total, 1) * 4))))


def make_distractors(values, index, total):
    distractors = []
    step = 7
    cursor = (index + step) % total
    while len(distractors) < 7 and total > 1:
        candidate = values[cursor]
        if candidate != values[index] and candidate not in distractors:
            distractors.append(candidate)
        cursor = (cursor + step) % total
        step += 4
    while len(distractors) < 7:
        distractors.append(f"選択肢{len(distractors) + 1}")
    return distractors


def build_english_rows(items, roots, etymology_notes):
    words = [item["word"] for item in items]
    rows = []
    total = len(items)
    for index, item in enumerate(items):
        word = item["word"]
        meaning = item["meaning"]
        distractors = make_distractors(words, index, total)
        note = etymology_note(word, roots, etymology_notes)
        explanation = f"{word} が正解です。意味は「{meaning}」。"
        if note:
            explanation += f" {note}"
        rows.append(
            {
                "id": f"leap_en_{index + 1:04d}",
                "subject": "英語",
                "unit": "英単語 LEAP 英訳",
                "term": term_for_index(index, total),
                "range": range_for_index(index),
                "question": f"次の意味に最も近い英単語を選びなさい: {meaning}",
                "choice1": word,
                "choice2": distractors[0],
                "choice3": distractors[1],
                "choice4": distractors[2],
                "choice5": distractors[3],
                "choice6": distractors[4],
                "choice7": distractors[5],
                "choice8": distractors[6],
                "answer": "1",
                "explanation": explanation,
                "tags": ",".join(choose_tags(word, meaning)),
                "difficulty": difficulty_for_index(index, total),
                "enabled": "true",
            }
        )
    return rows


def build_japanese_rows(items, roots, etymology_notes):
    meanings = [item["meaning"] for item in items]
    rows = []
    total = len(items)
    for index, item in enumerate(items):
        word = item["word"]
        meaning = item["meaning"]
        distractors = make_distractors(meanings, index, total)
        note = etymology_note(word, roots, etymology_notes)
        explanation = f"{word} は「{meaning}」という意味で使われます。"
        if note:
            explanation += f" {note}"
        rows.append(
            {
                "id": f"leap_ja_{index + 1:04d}",
                "subject": "英語",
                "unit": "英単語 LEAP 和訳",
                "term": term_for_index(index, total),
                "range": range_for_index(index),
                "question": f"次の英単語の意味として最も適切なものを選びなさい: {word}",
                "choice1": meaning,
                "choice2": distractors[0],
                "choice3": distractors[1],
                "choice4": distractors[2],
                "choice5": distractors[3],
                "choice6": distractors[4],
                "choice7": distractors[5],
                "choice8": distractors[6],
                "answer": "1",
                "explanation": explanation,
                "tags": ",".join(choose_tags(word, meaning)),
                "difficulty": difficulty_for_index(index, total),
                "enabled": "true",
            }
        )
    return rows


def write_csv(path, rows):
    with path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def main():
    items = load_leap_items()
    roots = load_roots()
    etymology_notes = load_etymology_notes()
    english_rows = build_english_rows(items, roots, etymology_notes)
    japanese_rows = build_japanese_rows(items, roots, etymology_notes)

    write_csv(ROOT / "questions_leap_english_all.csv", english_rows)
    write_csv(ROOT / "questions_leap_japanese_all.csv", japanese_rows)
    write_csv(ROOT / "questions_leap_all.csv", english_rows + japanese_rows)

    notes = sum(1 for row in english_rows if "語源メモ:" in row["explanation"])
    csv_notes = sum(1 for item in items if item["word"].lower() in etymology_notes)
    print(f"leap_words={len(items)}")
    print(f"english_questions={len(english_rows)}")
    print(f"japanese_questions={len(japanese_rows)}")
    print(f"combined_questions={len(english_rows) + len(japanese_rows)}")
    print(f"etymology_notes={notes}")
    print(f"etymology_csv_matches={csv_notes}")


if __name__ == "__main__":
    main()
