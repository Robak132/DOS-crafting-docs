"""Audit or refresh saved item tags from local game identities; never used by CI.
Run: python3 scripts/clean-item-tags.py [--write]
Uses DOS1 EE, DOS2 DE and Workshop resources prepared for audit-recipes.py.
"""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import re
import runpy

ROOT = Path(__file__).resolve().parents[1]
tree = runpy.run_path(str(ROOT / 'scripts/tag_tree.py'))


def category_for_identity(stats, fields):
    """Return only recognized inventory families, not spell/effect Stats entries."""
    category = fields.get('ObjectCategory', '').lower()
    slot = fields.get('Slot', '').lower()
    if re.search(r'(?:Empty|_Oil)(?:_|$)', stats, re.I) and stats.startswith(('CON_', 'ITEM_')):
        return 'Ingredients'
    if stats.startswith(('SKILLBOOK_', 'BOOK_Skill')): return 'Skillbooks'
    if stats.startswith(('SCROLL_', 'BOOK_Scroll')) or category == 'scroll': return 'Scrolls'
    if stats.startswith(('GRN_', 'Stats_Arrow', 'WPN_Arrow')): return 'Arrows-And-Grenades'
    if 'amulet' in stats.lower(): return 'Amulets'
    if 'magicbelt' in stats.lower(): return 'Belts'
    if slot == 'amulet': return 'Amulets'
    if slot == 'ring': return 'Rings'
    if slot == 'belt': return 'Belts'
    if 'shield' in stats.lower() and stats.startswith(('WPN_', 'ARM_')): return 'Armour'
    if stats.startswith('WPN_'): return 'Weapons'
    if stats.startswith('ARM_'): return 'Armour'
    if stats.startswith('TOOL_Dye'): return 'Dyes'
    if stats.startswith(('LOOT_Rune', 'LOOT_Frame')): return 'Magic'
    if stats.startswith(('CON_Potion', 'POTION_', 'CON_Food', 'FOOD_', 'CON_Drink')): return 'Potions-And-Food'
    if stats.startswith('LTS_'): return 'Stations-And-Containers'
    if stats.startswith('CONT_Backpack'): return 'Equipment'
    if stats.startswith('CONT_'): return None
    if stats.startswith('TOOL_') and re.search(r'Hammer|Pickaxe|Tongs|Whetstone|Scissors|Shovel|TrapDisarm|IdentifyGlass|Spyglass', stats, re.I): return 'Tools'
    if stats.startswith(('LOOT_', 'HAR_', 'ITEM_', 'CON_Ingred', 'Corpse_Part_')): return 'Ingredients'
    return None


def classify(name, old_tags, identities=()):
    """Name rules cover explicit item families; ambiguous identities stay unchanged."""
    text = name.lower().strip().lstrip('#')
    old = {t for t in old_tags if tree['is_category'](t)}
    if text.startswith(('boosted ', 'elemental boosted ', 'add ')) or 'Upgrades' in old:
        return 'Upgrades', 'recipe modification rather than a new inventory item'
    if text.startswith('colored '): return 'Dyes', 'dye transformation result'
    if text in ['battered cooking pot']: return 'Armour', 'wearable cooking-pot helmet'
    if text in ['wood pile', 'huge rock', 'cooking station', 'mobile kitchen', 'well']: return 'Stations-And-Containers', 'existing environmental crafting object'
    if text in ['mortar and pestle']: return 'Tools', 'crafting tool'
    if re.search(r'\b(ink ?pot|needle and thread)\b', text): return 'Equipment', 'writing or sewing equipment'
    if text in ['branch','short stick','long branch','wood chips','bonedust','bone dust','moondust','moon dust','intestines']:
        return 'Ingredients', 'crafting resource'
    if re.search(r'^(small|minor|medium|large|huge|giant) (magic|physical) armou?r$', text):
        return 'Potions-And-Food', 'abbreviated armor-potion name'
    if re.search(r'\b(bag|backpack|chest|crate|barrel|bookcase|workbench|altar|anvil|campfire|oven|furnace|wheel|machine|pump)\b', text):
        if text == 'barrel armor': return 'Armour', 'wearable barrel armor'
        if text == 'backpack': return 'Equipment', 'portable inventory container'
        if text.startswith(('leather chest','metal chest')): return 'Armour', 'chest armor category'
        return 'Stations-And-Containers', 'station or storage container'

    if re.search(r'\b(empty|blank)\b', text) and re.search(r'\b(bottle|vial|flask|canister|grenade|cylinder)\b', text):
        return 'Ingredients', 'empty container ingredient'
    if re.search(r'\b(skillbook|skill book)\b', text): return 'Skillbooks', 'explicit skillbook name'
    if re.search(r'\bscroll\b', text): return 'Scrolls', 'explicit scroll name'
    if re.search(r'\b(scraps|sinew|bowstring|arrow shaft|arrowhead)\b', text):
        return ('Arrows-And-Grenades' if 'arrowhead' in text else 'Ingredients'), 'crafting material, not wearable equipment'
    if re.search(r'\b(essence|pixie dust|star dust|stardust|tormented soul)\b', text):
        return 'Ingredients', 'crafting resource'
    if re.search(r'\b(hammer|pickaxe|scissors|whetstone)\b', text): return 'Tools', 'crafting tool'
    if re.search(r'\bdye\b', text): return 'Dyes', 'dye item'
    if re.search(r'\bpotion\b', text): return 'Potions-And-Food', 'consumable potion'
    if re.search(r'\b(grenade|arrow|balloon)\b', text): return 'Arrows-And-Grenades', 'ammunition or grenade'
    if re.search(r'\brune\b', text): return 'Magic', 'rune'
    if re.search(r'\b(amulet|amulets)\b', text): return 'Amulets', 'explicit amulet name'
    if re.search(r'\bring\b', text): return 'Rings', 'explicit ring name'
    if re.search(r'\bbelt\b', text): return 'Belts', 'explicit belt name'
    families = {category_for_identity(stat, fields) for stat, fields in identities} - {None}
    if len(families) == 1:
        result = next(iter(families))
        if result == 'Tools' and 'Equipment' in old: result = 'Equipment'
        return result, 'consistent game Stats inventory family'
    # Explicit equipment names also cover custom entries without localized Stats labels.
    if re.search(r'\b(shield|boots|gloves|helmet|helm|pants|lowerbody|upperbody|torso|robe|cape|armour|armor)\b', text):
        return 'Armour', 'explicit wearable armor name'
    if re.search(r'\b(bow|crossbow|sword|axe|mace|dagger|knife|spear|staff|wand|scythe|sabre|harpoon|arbalest)\b', text):
        return 'Weapons', 'explicit weapon name'
    # Keep a single established type when neither identities nor names resolve it.
    old -= {'Seasonal-Items', 'Special'}
    if len(old) == 1:
        result = next(iter(old))
        result = {'Potions':'Potions-And-Food','Food-And-Drink':'Potions-And-Food','Arrows':'Arrows-And-Grenades','Grenades':'Arrows-And-Grenades'}.get(result,result)
        return result, 'existing unambiguous category retained'
    return None, 'requires manual classification'


def invalid_type_tags(name):
    """Remove specific classification mistakes, never impose one type per item."""
    text = name.lower().strip()
    invalid = set()
    if re.search(r'\b(scraps|sinew|bowstring)\b', text):
        invalid.update(['Weapons', 'Armour'])
    if re.search(r'\b(empty|blank)\b', text) and re.search(r'\b(bottle|vial|flask|canister|grenade|cylinder)\b', text):
        invalid.update(['Potions-And-Food', 'Dyes', 'Arrows-And-Grenades'])
    if 'shield' in text:
        invalid.add('Weapons')
    if re.search(r'\b(hammer|pickaxe|whetstone)\b', text):
        invalid.update(['Armour', 'Stations-And-Containers'])
    if text == 'mortar and pestle':
        invalid.add('Potions-And-Food')
    if text == 'silver ore':
        invalid.add('Arrows-And-Grenades')
    return invalid


def normalized_tags(tags, category, game_tag, removed=()):
    tags = list(dict.fromkeys(t.strip() for t in tags if t.strip()))
    # Category tags come from the hierarchy; the game marker is re-added for the catalog being cleaned.
    other = [t for t in tags if not (tree['is_category'](t) or t in tree['MARKERS'] or t in tree['ROOTS'])]
    types = [t for t in tags if tree['is_category'](t) and not any(tree['within'](t, r) for r in removed) and t != 'Food-And-Drink']
    if 'Food-And-Drink' in tags:
        types.append('Potions-And-Food')
    if category is not None and category not in removed:
        types.append(category)
    return tree['most_specific']([*types, *other, game_tag])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    helpers = runpy.run_path(str(ROOT / 'scripts/audit-recipes.py'))
    key = helpers['key']
    provenance = json.loads((ROOT/'data/itemIcons.provenance.json').read_text(encoding='utf-8'))
    report = {'scope':'Saved item types, normalized game tags and consistent references. DOS1 EE / DOS2 DE / Crafting Overhaul. No new ingredient groups.', 'catalogs':{}, 'page_changes':[]}
    page_tags = defaultdict(set)
    for game,layers,game_tag in [('dos1',['dos1'],'DOS1'),('dos2',['dos2'],'DOS2'),('dos2-overhaul',['dos2','overhaul'],'DOS2-CO')]:
        index = helpers['GameIndex'](layers)
        current = ROOT/'.pak-work/audit-current'
        if game == 'dos1': index.add_dos1(current/'dos1')
        else:
            index.add_dos2(current/'dos2')
            for directory in sorted(current.glob('dos2-Patch*'),key=lambda p:int(re.search(r'Patch(\d+)',p.name)[1])): index.add_dos2(directory)
            if game == 'dos2-overhaul': index.add_dos2(current/'overhaul')
        path = ROOT/'data/library/recipes'/f'{game}.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        references = defaultdict(list)
        for item in [i for row in data['recipes'] for i in [row['result'],*row['ingredients']]] + data.get('items',[]):
            # A category reference is independent of a concrete item with the same name.
            references[(key(item['name']), item.get('selectorTag',''))].append(item)
        changes=[]
        for (name_key,selector),items in references.items():
            tags=list(dict.fromkeys(t for i in items for t in i['tags']))
            if selector and not any(tree['is_category'](t) for t in tags): continue
            evidence=provenance.get(game,{}).get(name_key,{})
            ids={evidence['stats']} if evidence.get('stats') else index.names.get(name_key,set())
            identities=[(stat,index.fields(stat)) for stat in sorted(ids)]
            category,reason=classify(items[0]['name'],tags,identities)
            new=normalized_tags(tags,category,game_tag,invalid_type_tags(items[0]['name']))
            for item in items:
                if item['tags']!=new:
                    changes.append({'name':item['name'],'selector':selector or None,'before':item['tags'],'after':new,'reason':reason,'stats':sorted(ids)})
                    item['tags']=new
                if item.get('slug') and not selector: page_tags[item['slug']].update(new)
        for row in data['recipes']:row['tags']=list(row['result']['tags'])
        report['catalogs'][game]={'changed_references':len(changes),'changed_names':len({c['name'] for c in changes}),'changes':changes}
        if args.write:path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
        print(game,len(changes),'reference corrections',flush=True)
    library_pages=runpy.run_path(str(ROOT/'scripts/library-pages.py'));pages=library_pages['load_pages']()
    for slug,tags in page_tags.items():
        page=pages.get(slug)
        if not page:continue
        new=[t for t in page['tags'] if t in tags] + sorted(tags - set(page['tags']))
        if page['tags']!=new:
            report['page_changes'].append({'slug':slug,'before':page['tags'],'after':new})
            page['tags']=new
    if args.write:library_pages['save_pages'](pages)
    report['applied']=args.write
    (ROOT/'reports/item-tags-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')


if __name__ == '__main__':main()
