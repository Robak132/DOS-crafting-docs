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
        source = json.loads(path.read_text(encoding='utf-8'))
        for item in source.get("items", []):
            candidates.add(item["name"])
        for recipe in source["recipes"]:
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
    # The game spells some names twice, differing only in capitals ("Esencja Ziemi" / "Esencja ziemi"):
    # that is one translation, written as Polish item names are, with a capital first letter only.
    def single(values):
        if len(values) == 1:
            return next(iter(values))
        if len({value.casefold() for value in values}) == 1:
            return min(values, key=lambda value: sum(letter.isupper() for letter in value))
        return None
    names = {name: single(values) for name, values in pairs.items() if single(values)}
    # Ambiguous names resolved by hand; the choice must be one of the game's own translations.
    chosen = {"Water Barrel": "Beczka wody"}
    for name, translation in chosen.items():
        assert translation in pairs.get(name, set()), name
        names[name] = translation
    # A person and the magic school share an English label, but not a Polish one.
    contexts = {
        "names": ("hc31d0294g1668g4d16g9222g07537f41e87d", "Nekromanta"),
        "selectors": ("hb7ea4cc5g2a18g416bg9b95g51d928a60398", "Nekromancja"),
    }
    selectors = {}
    for context, (uid, expected) in contexts.items():
        assert english[uid] == "Necromancer" and polish[uid] == expected
        (names if context == "names" else selectors)["Necromancer"] = polish[uid]
    # Game-defined groups (data/itemComboProperties.json). The game labels Wine and Milk
    # without "Source", so their group labels follow the Polish pattern of the others;
    # object groups have no in-game label at all.
    by_english = defaultdict(set)
    for uid, name in english.items():
        if polish.get(uid):
            by_english[name].add(polish[uid])
    manual = {"Wine Source": "Źródło wina", "Milk Source": "Źródło mleka", "Gold Object": "Złoty przedmiot", "Bones": "Kości",
              "Voidwoken Fish": "Skażona Pustką ryba", "Eternal Artefact": "Artefakt Odwiecznych",
              # Rune sizes follow the game's rune names ("Mała runa płomienia", "Potężna mała runa…").
              **{f"{kind}{size} Rune{power}": f"{prefix}{pl} runa".capitalize() for size, pl in
                 [("Small", "mała"), ("Medium", "średnia"), ("Large", "duża"), ("Giant", "ogromna")]
                 for kind, power, prefix in [("", "", ""), ("Mystical ", "", "Mistyczna "), ("", " Of Power", "Potężna ")]}}
    # Selectors are written with dashes ("Cutting-Tool"); reuse the item name's translation.
    for path in (ROOT / "data/library/recipes").glob("*.json"):
        for recipe in json.loads(path.read_text(encoding="utf-8"))["recipes"]:
            for item in recipe["ingredients"]:
                tag = item.get("selectorTag")
                name = item["name"].lstrip("#").replace("-", " ")
                if tag and tag not in selectors and names.get(name):
                    selectors[tag] = names[name]
    combo_groups = json.loads((ROOT / "data/itemComboProperties.json").read_text(encoding="utf-8"))
    for liquid in [*combo_groups["properties"].values(), *combo_groups["objectGroups"].values()]:
        if liquid["group"] in selectors or liquid["group"].startswith("DOS1-"):
            continue
        values = by_english.get(liquid["label"], set())
        label = single(values) if values and single(values) else manual.get(liquid["label"])
        if label:
            selectors[liquid["group"]] = label
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
