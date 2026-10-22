"""Build the project name dictionary from DOS2 Definitive Edition EN/PL XML files.

Usage: python3 scripts/build-dos2-localisation.py ENGLISH_XML POLISH_XML
Strings are paired by contentuid. Ambiguous names are omitted unless their
meaning has an explicit, verified context below. No other game's dictionary
is used as a translation source.
"""
import json
import re
import runpy
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def strings(path):
    return {
        element.attrib["contentuid"]: "".join(element.itertext())
        for element in ET.parse(path).getroot().findall("content")
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    english, polish = map(strings, sys.argv[1:])
    candidates = set(json.loads((ROOT / "data/itemLocalisation.en-pl.json").read_text(encoding='utf-8')))
    for page in runpy.run_path(str(ROOT / "scripts/library-pages.py"))["load_pages"]().values():
        candidates.update(value for value in [page.get("title"), page.get("titlePl")] if value)
        candidates.update(page.get("tags", []))
    for path in (ROOT / "data/library/recipes").glob("*.json"):
        for recipe in json.loads(path.read_text(encoding='utf-8'))["recipes"]:
            for item in [recipe["result"], *recipe["ingredients"]]:
                candidates.add(item["name"].lstrip("#"))
                if item.get("namePl"):
                    candidates.add(item["namePl"].lstrip("#"))
    candidates.update({"Accuracy", "Wits", "Poison Potion", "Amulet", "Metal"})
    normalized = {
        re.sub(r"\s*\((?:x\d+|\d+x)\)\s*$", "", value, flags=re.I)
        .rsplit("/", 1)[-1].strip(' "\'').casefold()
        for value in candidates
    }
    pairs = defaultdict(set)
    for uid, name in english.items():
        translation = polish.get(uid)
        if translation and (name.casefold() in normalized or translation.casefold() in normalized):
            pairs[name].add(translation)
    names = {name: next(iter(values)) for name, values in pairs.items() if len(values) == 1}
    # A person and the magic school share an English label, but not a Polish one.
    contexts = {
        "names": ("hc31d0294g1668g4d16g9222g07537f41e87d", "Nekromanta"),
        "selectors": ("hb7ea4cc5g2a18g416bg9b95g51d928a60398", "Nekromancja"),
    }
    selectors = {}
    for context, (uid, expected) in contexts.items():
        assert english[uid] == "Necromancer" and polish[uid] == expected
        (names if context == "names" else selectors)["Necromancer"] = polish[uid]
    output = {
        "source": {
            "edition": "Divinity Original Sin 2 Definitive Edition",
            "english": "DefEd/Data/Localization/English.pak → Localization/English/english.xml",
            "polish": "DefEd/Data/Localization/Polish/Polish.pak → Localization/Polish/polish.xml",
            "matching": "contentuid",
            "contextHandles": {context: uid for context, (uid, _) in contexts.items()},
        },
        "names": dict(sorted(names.items())),
        "selectors": selectors,
    }
    destination = ROOT / "data/itemLocalisation.dos2-de.en-pl.json"
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
    print(f"{destination}: {len(names)} names, {len(selectors)} contextual selector")


if __name__ == "__main__":
    main()
