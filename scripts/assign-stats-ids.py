"""Give every catalog item its game Stats ID, so items link by identity, not by name.

Usage: python3 scripts/assign-stats-ids.py [--check]
Uses the game files in .pak-work/audit-current (see audit-recipes.py). For each
recipe the matching game ItemCombination decides which Stats ID an item is: the
object in the recipe slot it fills, or the recipe's output, also when our name
differs from the game's (a Corpse Harvester result is the creature's corpse part). Without a matching
recipe an item gets an ID only when its game name belongs to exactly one Stats
entry. Items keep an ID they already have. Selectors (groups) and names that are
several game objects at once, or none (e.g. corpses, "Random X"), stay without one.
Occurrences of one item page (slug) share the ID found for that page.
Pages that share a Stats ID are reported: the entry is either generic (one
"WPN_Sword_1H" behind several sword templates) or the same item listed twice.
With --check nothing is written; the script fails if an ID could be added.
"""
import json
import re
import runpy
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAMES = [('dos1', ['dos1']), ('dos2', ['dos2']), ('dos2-overhaul', ['dos2', 'overhaul'])]


def load_index(audit, game, layers):
    current = ROOT / '.pak-work/audit-current'
    index = audit['GameIndex'](layers)
    if game == 'dos1':
        index.add_dos1(current / 'dos1')
        return index
    for directory in [current / 'dos2', *sorted(current.glob('dos2-Patch*'), key=lambda p: int(re.search(r'Patch(\d+)', p.name)[1]))]:
        index.add_dos2(directory)
    if 'overhaul' in layers:
        index.add_dos2(current / 'overhaul')
    return index


def recipe_items(recipe):
    yield 'result', recipe['result']
    # A random result lists every item it can roll.
    for item in recipe['result'].get('pool', []):
        yield 'result', item
    for item in recipe.get('extraResults', []):
        yield 'result', item
    for item in recipe['ingredients']:
        yield 'ingredient', item


def game_output(index, recipe, provenance):
    """The one Stats ID that the game recipes taking these ingredients make, whatever our name."""
    if recipe.get('extraResults') or recipe['result'].get('pool'):
        return None
    combos = [combo for combo in index.combos.values() if index.ingredients_fit(recipe, combo, provenance)]
    outputs = {stats for combo in combos for stats, _ in combo['outputs']}
    return next(iter(outputs)) if len(outputs) == 1 else None


def resolve(index, recipe, provenance):
    combos = [combo for combo in index.combos.values()
              if index.ingredients_fit(recipe, combo, provenance) and index.output_fit(recipe, combo, provenance)]
    objects = {value for combo in combos for field, value in combo['fields'].items() if re.fullmatch(r'Object \d+', field)}
    outputs = {stats for combo in combos for stats, _ in combo['outputs']}
    made = None if combos else game_output(index, recipe, provenance)
    for role, item in recipe_items(recipe):
        if item.get('selectorTag') or item.get('statsId'):
            continue
        candidates = index.item_ids(item, provenance)
        # Our name can differ from the game's (e.g. "Large Healing Potion" for its "Healing Potion").
        if role == 'result' and item is recipe['result'] and made:
            yield item, made, candidates
            continue
        chosen = candidates & (outputs if role == 'result' else objects) if combos else set()
        # Crafting Overhaul's Corpse Harvester is no ItemCombination; harvesting gives the corpse part.
        if not combos and role == 'result' and any(re.search(r'\bcorpse$', i['name'], re.I) for i in recipe['ingredients']):
            chosen = {stats for stats in candidates if stats.startswith('Corpse_Part_')}
        if len(chosen) != 1:
            chosen = candidates if len(candidates) == 1 else set()
        yield item, next(iter(chosen)) if chosen else None, candidates


def main():
    check = '--check' in sys.argv[1:]
    sys_argv, sys.argv = sys.argv, [sys.argv[0]]
    audit = runpy.run_path(str(ROOT / 'scripts/audit-recipes.py'))
    sys.argv = sys_argv
    provenance = json.loads((ROOT / 'data/itemIcons.provenance.json').read_text(encoding='utf-8'))
    pending, page_ids = 0, {}
    for game, layers in GAMES:
        path = ROOT / 'data/library/recipes' / f'{game}.json'
        raw = path.read_text(encoding='utf-8')
        source = json.loads(raw)
        index = load_index(audit, game, layers)
        added, unresolved, slugs = 0, defaultdict(set), defaultdict(set)
        # The Overhaul catalog includes the base game's items under the same pages.
        for slug, ids in (page_ids.get('dos2', {}) if game == 'dos2-overhaul' else {}).items():
            slugs[slug].update(ids)
        for recipe in source['recipes']:
            for item, stats, candidates in resolve(index, recipe, provenance.get(game, {})):
                if stats:
                    item['statsId'] = stats
                    added += 1
                else:
                    unresolved[item['name']].update(candidates)
        for item in source.get('items', []):
            candidates = index.item_ids(item, provenance.get(game, {}))
            if not item.get('statsId') and len(candidates) == 1:
                item['statsId'] = next(iter(candidates))
                added += 1
            elif not item.get('statsId'):
                unresolved[item['name']].update(candidates)
        everything = [item for recipe in source['recipes'] for _, item in recipe_items(recipe)] + source.get('items', [])
        for item in everything:
            if item.get('slug') and item.get('statsId'):
                slugs[item['slug']].add(item['statsId'])
        # One page is one item: an occurrence the game data left open takes the ID its page has elsewhere.
        for item in everything:
            ids = slugs.get(item.get('slug'), set())
            if not item.get('statsId') and not item.get('selectorTag') and len(ids) == 1:
                item['statsId'] = next(iter(ids))
                added += 1
        unresolved = {name: candidates for name, candidates in unresolved.items()
                      if any(item['name'] == name and not item.get('statsId') for item in everything)}
        page_ids[game] = slugs
        pending += added
        print(f'{game}: {added} IDs added, {len(unresolved)} names without one')
        for name, candidates in sorted(unresolved.items()):
            print(f'  - {name}: ' + (', '.join(sorted(candidates)) if candidates else 'not a game item'))
        for slug, ids in sorted(slugs.items()):
            if len(ids) > 1:
                print(f'  ! page {slug} covers several game items: {", ".join(sorted(ids))}')
        pages_by_stats = defaultdict(set)
        for slug, ids in slugs.items():
            for stats in ids:
                pages_by_stats[stats].add(slug)
        for stats, pages in sorted((stats, pages) for stats, pages in pages_by_stats.items() if len(pages) > 1):
            print(f'  = {stats} is behind several pages: {", ".join(sorted(pages))}')
        if added and not check:
            path.write_text(json.dumps(source, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    if check and pending:
        raise SystemExit(f'{pending} items could get a Stats ID; run scripts/assign-stats-ids.py')


if __name__ == '__main__':
    main()
