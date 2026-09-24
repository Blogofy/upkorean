# Orders the NIKL graded vocabulary into course days: vocab/nikl/*.xlsx (+ vocab/uz.tsv) -> vocab/plan.tsv,
# plus vocab/plan.xlsx, the same table one sheet per level for reading in Excel (not tracked by git).
#
# The graded list says which words belong to which grade, but inside a grade it is alphabetical — a day of
# nothing but 가- words. This puts each grade in the order a learner should meet it:
#
#   1. Grade first: 1급 before 2급, and so on. Two grades make one app level (see LEVELS below).
#   2. Frequency: the words people use most come first. Two corpus counts, each normalised per million,
#      averaged in log space; a word neither corpus counted sits at its grade's median.
#   3. Theme: a 10-word block (one sitting in the app, BLOCK_SIZE in packages/shared/srs.js) is built around
#      one situation — shopping, the weather — from the words that are near the front anyway. Words met
#      in one scene support each other.
#   4. No look-alikes together: synonyms, antonyms and same-spelled homonyms are kept GAP blocks apart, and a
#      block takes at most SEM_CAP words of one semantic set (colours, numbers, weekdays). Words that differ
#      only by a detail get mixed up when learnt side by side (Tinkham 1993, Waring 1997, Nakata & Suzuki 2019).
#   5. A mix of parts of speech, so every block can make sentences: at most NOUN_CAP nouns in ten.
#
# Rerun after changing any input; the output is deterministic. Needs Python 3 and openpyxl.
import csv
import math
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl
import openpyxl.styles
import openpyxl.utils

ROOT = Path(__file__).resolve().parent.parent
NIKL = ROOT / "vocab" / "nikl"
UZ_FILE = ROOT / "vocab" / "uz.tsv"
OUT_FILE = ROOT / "vocab" / "plan.tsv"
XLSX_FILE = ROOT / "vocab" / "plan.xlsx"

LEVELS = {"b": ["1급", "2급"], "m": ["3급", "4급"], "a": ["5급", "6급"]}
BLOCK = 10       # words per sitting
PER_DAY = 30     # words per course day: three sittings
WINDOW = 40      # how far down the frequency order a block may reach for words of its theme
THEME_CAP = 7    # theme words per block; the rest follow plain frequency so nothing waits for its theme
NOUN_CAP = 7
SEM_CAP = 2
GAP = 3          # blocks between a word and its synonym, antonym or homonym


def parts(key):
    """'있다01/있다02' -> ['있다01', '있다02']: one entry of the graded list may stand for several headwords."""
    return [part.strip() for part in re.split(r"[/∙·‧]", str(key)) if part.strip()]


def form(key):
    """'가격02' -> '가격', '크다01/크다02' -> '크다', '$헤아리다' -> '헤아리다'."""
    first = (parts(key) or [""])[0]
    return re.sub(r"\d+$", "", first.lstrip("$ ")).strip()


def cells(value):
    return [form(part) for part in str(value or "").split("\n") if form(part)]


def number(value):
    """A corpus count: 2835, '2,835', or '253/18,202' for an entry that joins two headwords; '없음' is none."""
    if isinstance(value, (int, float)):
        return value if value > 0 else None
    total = sum(int(part.replace(",", "")) for part in str(value or "").split("/") if part.replace(",", "").strip().isdigit())
    return total or None


def read_info():
    """Frequency, theme, semantic set and related words per headword, merged over its sense rows."""
    rows = list(openpyxl.load_workbook(NIKL / "info.xlsx", read_only=True).worksheets[0].iter_rows(values_only=True))[2:]
    info = defaultdict(lambda: {"counts": [None, None], "theme": None, "sem": None, "related": set()})
    for r in rows:
        if not r[1]:
            continue
        entry = info[str(r[1]).strip()]
        for source, col in enumerate((4, 5)):  # 조남호(2002), 강범모 외(2009); every sense row repeats the count
            entry["counts"][source] = entry["counts"][source] or number(r[col])
        entry["theme"] = entry["theme"] or r[21]
        entry["sem"] = entry["sem"] or (r[24] and f"{r[23]}/{r[24]}")
        for col in (8, 9, 10, 11):  # synonyms and antonyms, from the basic dictionary and beyond
            entry["related"].update(cells(r[col]))
    totals = [sum(entry["counts"][source] or 0 for entry in info.values()) for source in (0, 1)]
    return info, totals


def read_grades():
    ws = openpyxl.load_workbook(NIKL / "grades.xlsx", read_only=True)["어휘"]
    return [
        {"grade": r[2], "key": str(r[3]).strip(), "word": form(r[3]), "pos": r[4], "hint": (r[5] or "").strip()}
        for r in list(ws.iter_rows(values_only=True))[1:]
        if r[3]
    ]


def read_uz():
    if not UZ_FILE.exists():
        return {}
    with UZ_FILE.open(encoding="utf-8", newline="") as f:
        return {row[0]: row[1] for row in csv.reader(f, delimiter="\t") if len(row) >= 2 and not row[0].startswith("#")}


def score(words, info, totals):
    for w in words:
        # The info file keeps a joined entry ('있다01/있다02') under the joined key; failing that, its parts.
        entries = [info[w["key"]]] if w["key"] in info else [info[part] for part in parts(w["key"]) if part in info]
        w["theme"] = next((e["theme"] for e in entries if e["theme"]), None)
        w["sem"] = next((e["sem"] for e in entries if e["sem"]), None)
        w["related"] = set().union(*(e["related"] for e in entries)) - {w["word"]}
        counts = [sum(e["counts"][source] or 0 for e in entries) for source in (0, 1)]
        logs = [math.log(count / total * 1e6) for count, total in zip(counts, totals) if count]
        w["freq"] = statistics.mean(logs) if logs else None
    # The dictionary records a pair on one side only (중 lists 안, 안 does not list 중); keep them apart both ways.
    by_form = defaultdict(list)
    for w in words:
        by_form[w["word"]].append(w)
    for w in words:
        for other in [o for r in w["related"] for o in by_form.get(r, [])]:
            other["related"] = other["related"] | {w["word"]}
    for grade in {w["grade"] for w in words}:
        known = [w["freq"] for w in words if w["grade"] == grade and w["freq"] is not None]
        median = statistics.median(known)
        for w in words:
            if w["grade"] == grade and w["freq"] is None:
                w["freq"] = median
            # An affix's count is every word built with it (-적: 경제적, 사회적…), not how often it is met as a
            # thing to learn; it waits until the grade's ordinary words have given it examples.
            if w["grade"] == grade and "접사" in str(w["pos"]):
                w["freq"] = min(w["freq"], median)


def plan_level(words, grades):
    """Cuts one level's words into blocks. Returns the blocks, each a list of words in frequency order."""
    remaining = sorted(words, key=lambda w: (grades.index(w["grade"]), -w["freq"], w["key"]))
    placed = {}  # word form -> block index
    blocks = []
    while remaining:
        b = len(blocks)
        block = []

        def fits(w, caps=True):
            if w["word"] in {x["word"] for x in block}:
                return False
            if any(b - placed[r] < GAP for r in w["related"] | {w["word"]} if r in placed):
                return False
            if any(r in w["related"] for r in (x["word"] for x in block)) or any(w["word"] in x["related"] for x in block):
                return False
            if not caps:
                return True
            if w["pos"] == "명사" and sum(x["pos"] == "명사" for x in block) >= NOUN_CAP:
                return False
            return not w["sem"] or sum(x["sem"] == w["sem"] for x in block) < SEM_CAP

        def take(w):
            block.append(w)
            remaining.remove(w)

        seed = next((w for w in remaining if fits(w)), remaining[0])
        take(seed)
        window = remaining[:WINDOW]
        theme = seed["theme"] or next(iter(Counter(w["theme"] for w in window if w["theme"]).most_common(1)), (None,))[0]
        for w in window:
            if len(block) >= THEME_CAP:
                break
            if theme and w["theme"] == theme and fits(w):
                take(w)
        # The rest in plain frequency order; the caps give way before a block goes short, the look-alike rule
        # only at the very end of a level, when nothing else is left.
        for relaxed in (False, True, None):
            for w in list(remaining):
                if len(block) >= BLOCK:
                    break
                if relaxed is None or fits(w, caps=not relaxed):
                    take(w)
            if len(block) >= BLOCK:
                break
        for w in block:
            placed[w["word"]] = b
        block.sort(key=lambda w: -w["freq"])
        # A block is named after its theme only when the theme is really there.
        shared = Counter(w["theme"] for w in block if w["theme"]).most_common(1)
        blocks.append((shared[0][0] if shared and shared[0][1] >= 3 else None, block))
    return blocks


def write_xlsx(out):
    columns = [("day", "Kun", 6), ("block", "Blok", 6), ("n", "№", 6), ("grade", "Daraja", 7), ("word", "So'z", 14),
               ("uz", "O'zbekcha", 30), ("pos", "Turkum", 12), ("hint", "Qo'llanish", 22), ("block_theme", "Blok mavzusi", 22),
               ("theme", "So'z mavzusi", 22), ("sem", "Ma'no guruhi", 22), ("freq", "Chastota", 9), ("key", "NIKL kaliti", 16)]
    names = {"b": "초급 (1-2급)", "m": "중급 (3-4급)", "a": "고급 (5-6급)"}
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for level in LEVELS:
        ws = wb.create_sheet(names[level])
        ws.append([title for _, title, _ in columns])
        for r in (r for r in out if r["level"] == level):
            ws.append([float(r[k]) if k == "freq" else int(r[k]) if k in ("day", "block", "n") else r[k] for k, _, _ in columns])
        for i, (_, _, width) in enumerate(columns):
            ws.column_dimensions[openpyxl.utils.get_column_letter(i + 1)].width = width
        for cell in ws[1]:
            cell.font = openpyxl.styles.Font(bold=True)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
    try:
        wb.save(XLSX_FILE)
    except PermissionError:
        print(f"{XLSX_FILE.name} Excel'da ochiq — yopib, qayta ishga tushiring")


def main():
    info, totals = read_info()
    words = read_grades()
    score(words, info, totals)
    uz = read_uz()

    out = []
    for level, grades in LEVELS.items():
        for b, (theme, block) in enumerate(plan_level([w for w in words if w["grade"] in grades], grades)):
            for i, w in enumerate(block):
                n = b * BLOCK + i
                out.append({
                    "level": level, "day": n // PER_DAY + 1, "block": b + 1, "n": n + 1,
                    "grade": w["grade"], "key": w["key"], "word": w["word"], "pos": w["pos"], "hint": w["hint"],
                    "theme": w["theme"] or "", "block_theme": theme or "", "sem": w["sem"] or "",
                    "freq": f"{w['freq']:.2f}", "uz": uz.get(w["key"], ""),
                })

    with OUT_FILE.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(out[0]), delimiter="\t", lineterminator="\n")
        writer.writeheader()
        writer.writerows(out)

    write_xlsx(out)

    for level in LEVELS:
        rows = [r for r in out if r["level"] == level]
        done = sum(bool(r["uz"]) for r in rows)
        print(f"{level}: {len(rows)} so'z, {rows[-1]['day']} kun, o'zbekcha {done}/{len(rows)}")
    missing = len(words) - len(out)
    if missing:
        sys.exit(f"{missing} so'z rejaga tushmadi")


if __name__ == "__main__":
    main()
