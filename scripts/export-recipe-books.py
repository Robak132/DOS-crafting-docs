"""Write the in-game recipe books into recipe sources (offline, not needed by CI).
Run after scripts/audit-recipes.py: python3 scripts/export-recipe-books.py

Books teach recipes the same way in every game: a book is read (OnUse action 11 with a BookId, DOS2 and
Crafting Overhaul) or carries the recipes itself (action 30, "RecipeID"), and Story/Journal/recipes_prototypes
lists, per book, the ItemCombination IDs it unlocks (DOS1 names the book by its Stats ID in "Title").
DOS2 and Overhaul recipes are matched to ItemCombinations by the recipe audit; DOS1 ones by ItemComboPreviews
(result Stats ID and ingredients). Recipes no book teaches keep the source they have.

Prepared resources (see README): .pak-work/icons (RootTemplates, localisation), .pak-work/dos2-journal
(Origins.pak Story/Journal), .pak-work/extracted/crafting (the mod), .pak-work/dos1-story (DOS1 Main.pak
Story/Journal and Stats/ItemComboPreviews.lsx).
"""
from collections import defaultdict
import glob
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / '.pak-work'


def texts(path):
    return {n.get('contentuid'): re.sub(r'<[^>]+>', '', ''.join(n.itertext())) for n in ET.parse(path).iter('content')}


def prototypes(path):
    """Book (RecipeID, or DOS1 Title) → the ItemCombination IDs it unlocks."""
    source = Path(path).read_text(encoding='utf-8')
    books = {}
    for block in re.findall(r'<node id ?="Recipe">(.*?)</node>', source, re.S):
        fields = dict(re.findall(r'id="([^"]+)" value="([^"]*)"', block))
        recipes = [entry for entry in re.split(r'[;,]', fields.get('Recipes', '')) if entry]
        for key in filter(None, [fields.get('RecipeID'), fields.get('Title')]):
            books.setdefault(key, []).extend(recipes)
    return books


def template_books(files, en, pl, journal):
    """ItemCombination ID → {English book name: Polish name} from DOS2-style book templates."""
    taught = defaultdict(dict)
    for file in files:
        for node in ET.parse(file).iter('node'):
            if node.get('id') != 'GameObjects':
                continue
            values = {a.get('id'): a for a in node.iter('attribute')}
            name = next((a for a in node.findall('attribute') if a.get('id') == 'DisplayName'), None)
            if name is None:
                continue
            english = en.get(name.get('handle')) or name.get('value')
            if not english:
                continue
            combos = [a.get('value') for a in node.iter('attribute') if a.get('id') == 'RecipeID']
            combos = ';'.join(combos).split(';')
            book = values.get('BookId')
            if book is not None:
                combos += journal.get(book.get('value'), [])
            for combo in filter(None, combos):
                taught[combo][english] = pl.get(name.get('handle')) or english
    return taught


def write_sources(path, rows_books):
    data = json.loads(path.read_text(encoding='utf-8'))
    changed = 0
    for row in data['recipes']:
        found = rows_books(row)
        if not found:
            continue
        source, source_pl = '; '.join(sorted(found)), '; '.join(found[name] for name in sorted(found))
        if (row.get('source'), row.get('sourcePl')) != (source, source_pl):
            row['source'], row['sourcePl'] = source, source_pl
            changed += 1
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return changed


def audit_combos(audit, game):
    combos = defaultdict(set)
    for finding in audit['catalogs'][game]['findings']:
        if finding['status'] == 'matched':
            combos[finding['id']].update(evidence['id'] for evidence in finding['evidence'])
    return combos


def by_combos(taught, combos):
    def books(row):
        found = {}
        for combo in sorted(combos.get(row['id'], ())):
            found.update(taught.get(combo, {}))
        return found
    return books


def dos1():
    story = WORK / 'dos1-story'
    journal = prototypes(story / 'Mods/Main/Story/Journal/recipes_prototypes.lsx')
    pl = texts(WORK / 'extracted/dos1-ee/polish/Localization/Polish/polish.xml')
    names = {}
    for node in ET.parse(WORK / 'extracted/dos1-ee/shared-loca-xml/Stats.lsx').iter('node'):
        if node.get('id') != 'TranslatedStringKey':
            continue
        values = {a.get('id'): a for a in node.findall('attribute')}
        uuid, content = values.get('UUID'), values.get('Content')
        if uuid is not None and content is not None:
            english = content.get('value')
            names[uuid.get('value')] = (english, pl.get(content.get('handle')) or english)
    combos = defaultdict(list)
    for file in story.glob('Main/Public/*/Stats/ItemComboPreviews.lsx'):
        for block in re.findall(r'<node id="Combo">(.*?)</node>', file.read_text(encoding='utf-8'), re.S):
            fields = dict(re.findall(r'id="([^"]+)" value="([^"]*)"', block))
            if fields.get('CombinationID') and fields.get('StatsID'):
                combos[fields['CombinationID']].append(fields)
    # Result Stats ID → [(inputs, {English book: Polish})]
    teaches = defaultdict(list)
    for book, ids in journal.items():
        if book not in names:
            continue
        english, polish = names[book]
        for combo in ids:
            for fields in combos.get(combo, []):
                inputs = [fields.get(key) for key in ['Object1', 'Object2', 'Category1', 'Category2'] if fields.get(key)]
                teaches[fields['StatsID']].append((inputs, {english: polish}))

    def books(row):
        result = row['result'].get('statsId')
        found, any_input = {}, {}
        for inputs, book in teaches.get(result, []):
            any_input.update(book)
            # Each input of the game's combination must be one of the recipe's ingredients.
            if all(any(value in (item.get('statsId'), item.get('selectorTag'), *item.get('craftingCategories', [])) for item in row['ingredients']) for value in inputs):
                found.update(book)
        # Ingredients without game identities cannot be compared; one book for the result is still certain.
        return found or (any_input if len(any_input) == 1 else {})

    return write_sources(ROOT / 'data/library/recipes/dos1.json', books)


def main():
    audit = json.loads((ROOT / 'reports/recipe-audit.json').read_text(encoding='utf-8'))
    en = texts(WORK / 'icons/dos2/localization/English/english.xml')
    pl = texts(WORK / 'extracted/polish/Localization/Polish/polish.xml')
    dos2_files = [WORK / 'icons/dos2/Public/Shared/RootTemplates/_merged.lsx', *map(Path, glob.glob(str(WORK / 'icons/dos2/Public/DivinityOrigins_*/RootTemplates/_merged.lsx')))]
    dos2_journal = prototypes(next(WORK.glob('dos2-journal/Origins/Mods/*/Story/Journal/recipes_prototypes.lsx')))
    dos2_books = template_books(dos2_files, en, pl, dos2_journal)
    mod_files = sorted(WORK.glob('icons/overhaul/Public/Crafting_Overhaul_*/RootTemplates/*.lsx'))
    mod_journal = prototypes(next(WORK.glob('extracted/crafting/Mods/*/Story/Journal/recipes_prototypes.lsx')))
    mod_books = template_books(mod_files, en, pl, mod_journal)
    counts = {
        'dos1': dos1(),
        'dos2': write_sources(ROOT / 'data/library/recipes/dos2.json', by_combos(dos2_books, audit_combos(audit, 'dos2'))),
        'dos2-overhaul': write_sources(ROOT / 'data/library/recipes/dos2-overhaul.json', by_combos({**dos2_books, **mod_books}, audit_combos(audit, 'dos2-overhaul'))),
    }
    print('recipe sources updated:', counts)


if __name__ == '__main__':
    main()
