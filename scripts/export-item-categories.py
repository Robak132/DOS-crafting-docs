"""Enrich source items with crafting categories from converted game resources.
Usage: python3 scripts/export-item-categories.py EXTRACTED_DIRECTORY
Only needed when refreshing game data; CI uses saved source JSON.
"""
import json
import runpy
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
m = runpy.run_path(str(ROOT / 'scripts/export-item-icons.py'))
source = Path(sys.argv[1])
provenance = json.loads((ROOT / 'data/itemIcons.provenance.json').read_text())
base = {g: m['resources'](source / g) for g in ['dos1', 'dos2', 'overhaul']}
for game, layers in [('dos1', ['dos1']), ('dos2', ['dos2']), ('dos2-overhaul', ['dos2', 'overhaul'])]:
    templates, strings, entries = {}, {}, {}
    for layer in layers:
        _, tt, ss = base[layer]
        templates.update(tt); strings.update(ss)
        entries.update(m['stat_entries'](source / layer))
        if layer == 'dos2':
            current = ROOT / '.pak-work/audit-current'
            for directory in [current / 'dos2', *sorted(current.glob('dos2-Patch*'), key=lambda p: int(re.search(r'Patch(\d+)', p.name)[1]))]:
                for module in sorted((directory / 'Public').glob('*'), key=lambda p: p.name != 'Shared'):
                    entries.update(m['stat_entries'](module))
    def inherit(stats, seen=None):
        seen = set() if seen is None else seen
        if stats in seen: return {}
        seen.add(stats)
        entry = entries.get(stats, {})
        return {**inherit(entry.get('parent'), seen), **entry.get('fields', {})} if entry else {}
    categories = defaultdict(set)
    icon_categories = defaultdict(set)
    for template in templates.values():
        stats = template.get('Stats', '')
        fields = inherit(stats)
        values = set()
        for field in ['ComboCategory', 'ObjectCategory', 'Slot']:
            values.update(v.strip() for v in fields.get(field, '').split(',') if v.strip())
        if stats.startswith(('ARM_', 'WPN_')): values.add('Armor' if stats.startswith('ARM_') else 'Weapon')
        if 'Essence' in stats: values.add('Essence')
        for name in [strings.get(template.get('DisplayNameHandle'), template.get('DisplayName')), strings.get(stats)]:
            if name:
                name_key = m['key'](m['plain_name'](name))
                categories[name_key].update(values)
                icon_categories[(name_key, template.get('Icon', ''))].update(values)
    path = ROOT / 'data/library/recipes' / (game + '.json')
    data = json.loads(path.read_text())
    count = 0
    for row in data['recipes']:
        for item in [row['result'], *row['ingredients']]:
            name_key = m['key'](item['name'])
            icon = provenance.get(game, {}).get(name_key, {}).get('icon')
            values = icon_categories.get((name_key, icon), categories[name_key])
            if values and not item.get('selectorTag'):
                item['craftingCategories'] = sorted(values)
                count += 1
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    print(game, count, 'categorized item references')
