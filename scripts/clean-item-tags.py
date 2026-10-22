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


def category_for_identity(stats, fields):
    """Return only recognized inventory families, not spell/effect Stats entries."""
    category = fields.get('ObjectCategory', '').lower()
    slot = fields.get('Slot', '').lower()
    if re.search(r'(?:Empty|_Oil)(?:_|$)', stats, re.I) and stats.startswith(('CON_', 'ITEM_')):
        return 'Skladniki'
    if stats.startswith(('SKILLBOOK_', 'BOOK_Skill')): return 'Ksiegi-umiejetnosci'
    if stats.startswith(('SCROLL_', 'BOOK_Scroll')) or category == 'scroll': return 'Zwoje'
    if stats.startswith(('GRN_', 'Stats_Arrow', 'WPN_Arrow')): return 'Strzaly-i-granaty'
    if 'amulet' in stats.lower(): return 'Amulety'
    if 'magicbelt' in stats.lower(): return 'Pasy'
    if slot == 'amulet': return 'Amulety'
    if slot == 'ring': return 'Pierscienie'
    if slot == 'belt': return 'Pasy'
    if 'shield' in stats.lower() and stats.startswith(('WPN_', 'ARM_')): return 'Pancerz'
    if stats.startswith('WPN_'): return 'Bron'
    if stats.startswith('ARM_'): return 'Pancerz'
    if stats.startswith('TOOL_Dye'): return 'Barwniki'
    if stats.startswith(('LOOT_Rune', 'LOOT_Frame')): return 'Magia'
    if stats.startswith(('CON_Potion', 'POTION_', 'CON_Food', 'FOOD_', 'CON_Drink')): return 'Mikstury-i-jedzenie'
    if stats.startswith('LTS_'): return 'Stanowiska-i-pojemniki'
    if stats.startswith('CONT_Backpack'): return 'Wyposazenie'
    if stats.startswith('CONT_'): return None
    if stats.startswith('TOOL_') and re.search(r'Hammer|Pickaxe|Tongs|Whetstone|Scissors|Shovel|TrapDisarm|IdentifyGlass|Spyglass', stats, re.I): return 'Narzedzia'
    if stats.startswith(('LOOT_', 'HAR_', 'ITEM_', 'CON_Ingred', 'Corpse_Part_')): return 'Skladniki'
    return None


def classify(name, old_tags, identities=()):
    """Name rules cover explicit item families; ambiguous identities stay unchanged."""
    text = name.lower().strip().lstrip('#')
    old = {t.removeprefix('Typ/') for t in old_tags if t.startswith('Typ/')}
    if text.startswith(('boosted ', 'elemental boosted ', 'add ')) or 'Ulepszenia' in old:
        return 'Ulepszenia', 'recipe modification rather than a new inventory item'
    if text.startswith('colored '): return 'Barwniki', 'dye transformation result'
    if text in ['battered cooking pot']: return 'Pancerz', 'wearable cooking-pot helmet'
    if text in ['wood pile', 'huge rock', 'cooking station', 'mobile kitchen', 'well']: return 'Stanowiska-i-pojemniki', 'existing environmental crafting object'
    if text in ['mortar and pestle']: return 'Narzedzia', 'crafting tool'
    if re.search(r'\b(ink ?pot|needle and thread)\b', text): return 'Wyposazenie', 'writing or sewing equipment'
    if text in ['branch','short stick','long branch','wood chips','bonedust','bone dust','moondust','moon dust','intestines']:
        return 'Skladniki', 'crafting resource'
    if re.search(r'^(small|minor|medium|large|huge|giant) (magic|physical) armou?r$', text):
        return 'Mikstury-i-jedzenie', 'abbreviated armor-potion name'
    if re.search(r'\b(bag|backpack|chest|crate|barrel|bookcase|workbench|altar|anvil|campfire|oven|furnace|wheel|machine|pump)\b', text):
        if text == 'barrel armor': return 'Pancerz', 'wearable barrel armor'
        if text == 'backpack': return 'Wyposazenie', 'portable inventory container'
        if text.startswith(('leather chest','metal chest')): return 'Pancerz', 'chest armor category'
        return 'Stanowiska-i-pojemniki', 'station or storage container'

    if re.search(r'\b(empty|blank)\b', text) and re.search(r'\b(bottle|vial|flask|canister|grenade|cylinder)\b', text):
        return 'Skladniki', 'empty container ingredient'
    if re.search(r'\b(skillbook|skill book)\b', text): return 'Ksiegi-umiejetnosci', 'explicit skillbook name'
    if re.search(r'\bscroll\b', text): return 'Zwoje', 'explicit scroll name'
    if re.search(r'\b(scraps|sinew|bowstring|arrow shaft|arrowhead)\b', text):
        return ('Strzaly-i-granaty' if 'arrowhead' in text else 'Skladniki'), 'crafting material, not wearable equipment'
    if re.search(r'\b(essence|pixie dust|star dust|stardust|tormented soul)\b', text):
        return 'Skladniki', 'crafting resource'
    if re.search(r'\b(hammer|pickaxe|scissors|whetstone)\b', text): return 'Narzedzia', 'crafting tool'
    if re.search(r'\bdye\b', text): return 'Barwniki', 'dye item'
    if re.search(r'\bpotion\b', text): return 'Mikstury-i-jedzenie', 'consumable potion'
    if re.search(r'\b(grenade|arrow|balloon)\b', text): return 'Strzaly-i-granaty', 'ammunition or grenade'
    if re.search(r'\brune\b', text): return 'Magia', 'rune'
    if re.search(r'\b(amulet|amulets)\b', text): return 'Amulety', 'explicit amulet name'
    if re.search(r'\bring\b', text): return 'Pierscienie', 'explicit ring name'
    if re.search(r'\bbelt\b', text): return 'Pasy', 'explicit belt name'
    families = {category_for_identity(stat, fields) for stat, fields in identities} - {None}
    if len(families) == 1:
        result = next(iter(families))
        if result == 'Narzedzia' and 'Wyposazenie' in old: result = 'Wyposazenie'
        return result, 'consistent game Stats inventory family'
    # Explicit equipment names also cover custom entries without localized Stats labels.
    if re.search(r'\b(shield|boots|gloves|helmet|helm|pants|lowerbody|upperbody|torso|robe|cape|armour|armor)\b', text):
        return 'Pancerz', 'explicit wearable armor name'
    if re.search(r'\b(bow|crossbow|sword|axe|mace|dagger|knife|spear|staff|wand|scythe|sabre|harpoon|arbalest)\b', text):
        return 'Bron', 'explicit weapon name'
    # Keep a single established type when neither identities nor names resolve it.
    old -= {'Przedmioty-wydarzen', 'Specjalne'}
    if len(old) == 1:
        result = next(iter(old))
        result = {'Mikstury':'Mikstury-i-jedzenie','Jedzenie-i-picie':'Mikstury-i-jedzenie','Strzaly':'Strzaly-i-granaty','Granaty':'Strzaly-i-granaty'}.get(result,result)
        return result, 'existing unambiguous category retained'
    return None, 'requires manual classification'


def invalid_type_tags(name):
    """Remove specific classification mistakes, never impose one type per item."""
    text = name.lower().strip()
    invalid = set()
    if re.search(r'\b(scraps|sinew|bowstring)\b', text):
        invalid.update(['Typ/Bron', 'Typ/Pancerz'])
    if re.search(r'\b(empty|blank)\b', text) and re.search(r'\b(bottle|vial|flask|canister|grenade|cylinder)\b', text):
        invalid.update(['Typ/Mikstury-i-jedzenie', 'Typ/Barwniki', 'Typ/Strzaly-i-granaty'])
    if 'shield' in text:
        invalid.add('Typ/Bron')
    if re.search(r'\b(hammer|pickaxe|whetstone)\b', text):
        invalid.update(['Typ/Pancerz', 'Typ/Stanowiska-i-pojemniki'])
    if text == 'mortar and pestle':
        invalid.add('Typ/Mikstury-i-jedzenie')
    if text == 'silver ore':
        invalid.add('Typ/Strzaly-i-granaty')
    return invalid


def normalized_tags(tags, category, game_tag, removed=()):
    tags = list(dict.fromkeys(t.strip() for t in tags if t.strip()))
    # Cechy-* entries describe sidebar headings, not additional item properties.
    canonical = {'Zrecznosc': 'Cechy/Zręczność', 'Percepcja': 'Cechy/Percepcja', 'Charyzma': 'Cechy/Charyzma'}
    other = [canonical.get(t, t) for t in tags if not (t == 'Typ' or t.startswith(('Typ/', 'Cechy-')) or t in ['DOS1','DOS2','DOS2-CO'])]
    types = [t for t in tags if t.startswith('Typ/') and t not in removed and t != 'Typ/Jedzenie-i-picie']
    if 'Typ/Jedzenie-i-picie' in tags:
        types.append('Typ/Mikstury-i-jedzenie')
    if category is not None and 'Typ/' + category not in removed:
        types.append('Typ/' + category)
    return list(dict.fromkeys(['Typ', *types, *other, game_tag]))


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
            if selector and not any(t.startswith('Typ/') for t in tags): continue
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
