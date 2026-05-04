import csv
import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
UKARU_HTML = ROOT / "tmp" / "ukaru.html"
MOTITOWN_JSON = ROOT / "tmp" / "motitown_book_44.json"

TAG_WORDS = {
    "環境": {
        "environment",
        "species",
        "waste",
        "plastic",
        "chemical",
        "resource",
        "region",
        "agriculture",
        "climate",
        "pollution",
        "preserve",
        "protect",
        "conserve",
        "recycle",
        "sustain",
        "sustainable",
        "energy",
        "fuel",
        "carbon",
        "emission",
        "weather",
        "temperature",
        "disaster",
        "ecology",
        "ecosystem",
        "habitat",
        "forest",
        "ocean",
        "marine",
        "reduce",
        "damage",
        "impact",
        "adapt",
        "prevent",
    },
    "IT": {
        "technology",
        "digital",
        "mobile",
        "device",
        "access",
        "site",
        "link",
        "data",
        "image",
        "display",
        "function",
        "system",
        "software",
        "network",
        "online",
        "internet",
        "media",
        "communicate",
        "search",
        "connect",
        "process",
        "information",
        "database",
        "platform",
        "automatic",
        "automate",
        "innovation",
        "monitor",
        "screen",
        "virtual",
        "electronic",
        "computer",
        "web",
    },
    "経済": {
        "economy",
        "economic",
        "financial",
        "income",
        "trade",
        "company",
        "corporation",
        "industry",
        "budget",
        "fee",
        "expense",
        "debt",
        "loan",
        "account",
        "market",
        "cost",
        "price",
        "profit",
        "benefit",
        "value",
        "investment",
        "invest",
        "employ",
        "customer",
        "client",
        "supply",
        "demand",
        "produce",
        "manufacture",
        "consume",
        "policy",
        "business",
        "contract",
        "rent",
        "earn",
        "tax",
        "welfare",
        "resource",
    },
}

GENERIC_TAGS = ["環境", "IT", "経済"]
FIELDNAMES = [
    "id",
    "subject",
    "unit",
    "largeCategory",
    "middleCategory",
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


def clean_text(value):
    value = html.unescape(re.sub(r"<[^>]+>", "", str(value)))
    return re.sub(r"\s+", " ", value).strip()


def normalize_word(word):
    word = clean_text(word)
    return re.sub(r"^[^A-Za-z]+|[^A-Za-z\- ]+$", "", word).strip()


def choose_tags(word, meaning=""):
    text = f"{word} {meaning}".lower()
    tags = [tag for tag, keys in TAG_WORDS.items() if any(key in text for key in keys)]
    return tags or [GENERIC_TAGS[sum(ord(char) for char in word) % len(GENERIC_TAGS)]]


def large_category_for_index(index, total):
    ratio = index / max(total, 1)
    if ratio < 1 / 3:
        return "基礎"
    if ratio < 2 / 3:
        return "標準"
    return "発展"


def difficulty_for_index(index, total):
    return min(5, max(2, 2 + int(index / max(total, 1) * 4)))


def make_question(meaning, source_name, word):
    hint = clean_text(meaning)
    if len(hint) > 90:
        hint = hint[:90].rstrip() + "..."
    if hint:
        return f"次の意味に最も近い英単語を選びなさい: {hint}"
    return f"{source_name} の語彙リストにある英単語を選びなさい: {word}"


def build_rows(items, prefix, source_name, unit):
    words = [item["word"] for item in items]
    rows = []
    total = len(items)

    for index, item in enumerate(items):
        word = item["word"]
        meaning = item.get("meaning", "")
        distractors = []
        step = 7
        cursor = (index + step) % total

        while len(distractors) < 7 and total > 1:
            candidate = words[cursor]
            if candidate != word and candidate not in distractors:
                distractors.append(candidate)
            cursor = (cursor + step) % total
            step += 4

        while len(distractors) < 7:
            distractors.append(f"dummy{len(distractors) + 1}")

        rows.append(
            {
                "id": f"{prefix}_{index + 1:04d}",
                "subject": "英語",
                "unit": unit,
                "largeCategory": large_category_for_index(index, total),
                "middleCategory": "",
                "question": make_question(meaning, source_name, word),
                "choice1": word,
                "choice2": distractors[0],
                "choice3": distractors[1],
                "choice4": distractors[2],
                "choice5": distractors[3],
                "choice6": distractors[4],
                "choice7": distractors[5],
                "choice8": distractors[6],
                "answer": "1",
                "explanation": f"{word} が正解です。意味の中心を確認し、例文の中で使えるようにしましょう。",
                "tags": ",".join(choose_tags(word, meaning)),
                "difficulty": str(difficulty_for_index(index, total)),
                "enabled": "true",
            }
        )

    return rows


def build_translation_rows(items, prefix, source_name, unit):
    meanings = [clean_text(item.get("meaning", "")) or item["word"] for item in items]
    rows = []
    total = len(items)

    for index, item in enumerate(items):
        word = item["word"]
        meaning = clean_text(item.get("meaning", "")) or word
        distractors = []
        step = 11
        cursor = (index + step) % total

        while len(distractors) < 7 and total > 1:
            candidate = meanings[cursor]
            if candidate != meaning and candidate not in distractors:
                distractors.append(candidate)
            cursor = (cursor + step) % total
            step += 6

        while len(distractors) < 7:
            distractors.append(f"別の意味{len(distractors) + 1}")

        rows.append(
            {
                "id": f"{prefix}_ja_{index + 1:04d}",
                "subject": "英語",
                "unit": f"{unit} 和訳",
                "largeCategory": large_category_for_index(index, total),
                "middleCategory": "",
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
                "explanation": f"{word} は「{meaning}」という意味で使われます。",
                "tags": ",".join(choose_tags(word, meaning)),
                "difficulty": str(difficulty_for_index(index, total)),
                "enabled": "true",
            }
        )

    return rows


def load_ukaru_items():
    source = UKARU_HTML.read_text(encoding="utf-8", errors="ignore")
    pattern = re.compile(
        r"<tr[^>]*>\s*<td[^>]*>.*?</td>\s*<td[^>]*>(\d+)</td>\s*"
        r"<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*</tr>",
        re.S,
    )
    items = []
    for number, word_html, meaning_html in pattern.findall(source):
        word = normalize_word(word_html)
        meaning = clean_text(meaning_html)
        if word and re.search(r"[A-Za-z]", word):
            items.append({"number": int(number), "word": word, "meaning": meaning})

    items.sort(key=lambda item: item["number"])
    seen = set()
    return [item for item in items if not (item["word"].lower() in seen or seen.add(item["word"].lower()))]


def load_motitown_items():
    source = json.loads(MOTITOWN_JSON.read_text(encoding="utf-8-sig"))
    items = []
    for row in source:
        word = normalize_word(row.get("english", ""))
        meaning = clean_text(row.get("translation", ""))
        if word and re.search(r"[A-Za-z]", word):
            items.append({"word": word, "meaning": meaning})

    seen = set()
    return [item for item in items if not (item["word"].lower() in seen or seen.add(item["word"].lower()))]


def write_csv(path, rows):
    with path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def main():
    ukaru_items = load_ukaru_items()
    motitown_items = load_motitown_items()

    ukaru_rows = build_rows(ukaru_items, "target1900", "ターゲット1900参考", "英単語 Target1900")
    motitown_rows = build_rows(motitown_items, "commonimportant", "共通テスト頻出語参考", "英単語 共通テスト頻出")
    ukaru_translation_rows = build_translation_rows(
        ukaru_items,
        "target1900",
        "ターゲット1900参考",
        "英単語 Target1900",
    )
    motitown_translation_rows = build_translation_rows(
        motitown_items,
        "commonimportant",
        "共通テスト頻出語参考",
        "英単語 共通テスト頻出",
    )

    write_csv(ROOT / "public" / "questions_target1900_generic_all.csv", ukaru_rows)
    write_csv(ROOT / "public" / "questions_common_important_generic_all.csv", motitown_rows)
    write_csv(ROOT / "public" / "questions_vocab_generic_all_sources.csv", ukaru_rows + motitown_rows)
    write_csv(ROOT / "public" / "questions_target1900_translation_generic_all.csv", ukaru_translation_rows)
    write_csv(ROOT / "public" / "questions_common_important_translation_generic_all.csv", motitown_translation_rows)
    write_csv(
        ROOT / "public" / "questions_vocab_translation_generic_all_sources.csv",
        ukaru_translation_rows + motitown_translation_rows,
    )
    write_csv(
        ROOT / "public" / "questions_vocab_generic_all_sources_with_translation.csv",
        ukaru_rows + motitown_rows + ukaru_translation_rows + motitown_translation_rows,
    )

    print(f"target1900={len(ukaru_rows)}")
    print(f"common_important={len(motitown_rows)}")
    print(f"combined={len(ukaru_rows) + len(motitown_rows)}")
    print(f"target1900_translation={len(ukaru_translation_rows)}")
    print(f"common_important_translation={len(motitown_translation_rows)}")
    print(f"combined_translation={len(ukaru_translation_rows) + len(motitown_translation_rows)}")
    print(
        "combined_with_translation="
        f"{len(ukaru_rows) + len(motitown_rows) + len(ukaru_translation_rows) + len(motitown_translation_rows)}"
    )


if __name__ == "__main__":
    main()
