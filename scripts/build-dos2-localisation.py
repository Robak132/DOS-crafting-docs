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


HAND_SELECTORS = {
    "Armor-With-Empty-Rune-Socket": "Pancerz z pustym gniazdem na runę",
    "Trinket-With-Empty-Rune-Socket": "Ozdoba z pustym gniazdem na runę",
    "Weapon-With-Empty-Rune-Socket": "Broń z pustym gniazdem na runę",
    "Shoes-Or-Boots": "Obuwie lub buty",
    "Boots": "Buty",
    "Pants": "Nogawice",
    "Upperbody armor": "Napierśnik",
    "Body Armor": "Napierśnik",
    "Lowerbody Armor": "Nogawice",
    "Armor": "Pancerz",
    "Boot-Armor": "Buty",
    "Glove-Armor": "Rękawice",
    "Helmet-Armor": "Hełm",
    "Dye": "Farba",
    "Cape": "Peleryna",
    "Armor Belt": "Pas",
    "Mage Gloves": "Rękawice maga",
    "Warrior Pants": "Nogawice wojownika",
    "Finesse Based Armor": "Pancerz zręcznościowy",
    "Intelligence Based Armor": "Pancerz inteligencji",
    "Strength Based Armor": "Pancerz siłowy",
    "Mage Body Armor": "Napierśnik maga",
    "Light Body Armor": "Lekki napierśnik",
    "Warrior Body Armor": "Napierśnik wojownika",
    "Warrior Boots": "Buty wojownika",
    "Light Boots": "Lekkie buty",
    "Light Gloves": "Lekkie rękawice",
    "Warrior Gloves": "Rękawice wojownika",
    "Warrior Helmet": "Hełm wojownika",
    "Light Pants": "Lekkie nogawice",
    "Mage Pants": "Nogawice maga",
    "Two Handed Axe": "Topór dwuręczny",
    "Two Handed Mace": "Buława dwuręczna",
    "Two Handed Sword": "Miecz dwuręczny"
}
HAND_NAMES = {
    "weapon (except of wands and staves)": "broń (oprócz różdżek i kosturów)",
    "Mage Helmet": "Hełm maga",
    "Two Handed Sword": "Miecz dwuręczny"
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
        re.sub(r"\((?:x\d+|\d+x)\)$", "", value.rstrip(), flags=re.I).rstrip()
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
    recipe_selectors = [
        (item["selectorTag"], item["name"].lstrip("#"))
        for path in (ROOT / "data/library/recipes").glob("*.json")
        for recipe in json.loads(path.read_text(encoding="utf-8"))["recipes"]
        for item in recipe["ingredients"] if item.get("selectorTag")
    ]
    # Selectors are written with dashes ("Cutting-Tool"); reuse the item name's translation.
    for tag, label in recipe_selectors:
        name = label.replace("-", " ")
        if tag not in selectors and names.get(name):
            selectors[tag] = names[name]
    combo_groups = json.loads((ROOT / "data/itemComboProperties.json").read_text(encoding="utf-8"))
    for liquid in [*combo_groups["properties"].values(), *combo_groups["objectGroups"].values()]:
        if liquid["group"] in selectors or liquid["group"].startswith("DOS1-"):
            continue
        values = by_english.get(liquid["label"], set())
        label = single(values) if values and single(values) else manual.get(liquid["label"])
        if label:
            selectors[liquid["group"]] = label
    # A selector shown under the game's label ("#Aerotheurge-Skillbook" for SkillbookAir) is looked up by that label.
    for tag, label in recipe_selectors:
        if tag in selectors and label not in selectors and not names.get(label):
            selectors[label] = selectors[tag]
    # Groups and Overhaul items the game's Polish files do not name; written by hand.
    selectors.update({k: v for k, v in HAND_SELECTORS.items() if k not in selectors})
    names.update({k: v for k, v in HAND_NAMES.items() if k not in names})
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
