"""Audit exported icon coverage after `npm run generate:data`.

Run: python3 scripts/audit-item-icons.py
Reads generated DOS1 EE / DOS2 DE / combined Overhaul catalogs. Known groups
and upgrade labels are counted separately, since they need no item icon.
Writes reports/item-icon-coverage.json. No Steam files or network required.
"""
from collections import defaultdict
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]


def key(name):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', name.lower()).replace('ł', 'l'))


def main():
    icons = json.loads((ROOT / 'data/itemIcons.json').read_text(encoding='utf-8'))
    report = {
        'scope': 'DOS1 EE; DOS2 Definitive Edition; DOS2 DE + Crafting Overhaul. Combined mode includes base DOS2. Counts use game Stats identities when available, otherwise unique English names among recipe results and ingredients; no icon is invented for an unresolved name.',
        'catalogs': {},
    }
    for game, mapping in icons.items():
        catalog = json.loads((ROOT / 'dist/data' / f'catalog-{game}.json').read_text(encoding='utf-8'))
        items, groups, upgrades = {}, set(), set()
        roles = defaultdict(set)
        for recipe in catalog['recipes']:
            for role, item in [('result', recipe['result']), *[('ingredient', i) for i in recipe['ingredients']]]:
                name = item['name']
                if item.get('selectorTag') or item.get('groupId'):
                    groups.add(name)
                    continue
                if 'Upgrades' in item['tags']:
                    upgrades.add(name)
                    continue
                identity = key(item.get('statsId') or name)
                items[identity] = item
                roles[identity].add(role)
        missing = [{'name': item['name'], 'roles': sorted(roles[identity])} for identity, item in sorted(items.items(), key=lambda pair: pair[1]['name']) if identity not in mapping]
        broken = sorted({icon for icon in mapping.values() if not (ROOT / icon.replace('data/icons/', 'assets/item-icons/')).is_file()})
        report['catalogs'][game] = {
            'items': len(items), 'with_icon': len(items) - len(missing),
            'without_icon': len(missing), 'groups_excluded': len(groups),
            'upgrades_excluded': len(upgrades), 'broken_assigned_files': broken,
            'unresolved': missing,
        }
        print(f'{game}: {len(items) - len(missing)}/{len(items)} with icons; {len(missing)} unresolved; {len(broken)} broken files')
    (ROOT / 'reports/item-icon-coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
