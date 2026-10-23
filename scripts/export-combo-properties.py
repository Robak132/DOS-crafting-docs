"""Export DOS2 liquid "sources" (ItemComboProperties) as crafting groups.

Usage: python3 scripts/export-combo-properties.py ITEM_COMBO_PROPERTIES_TXT
The file comes from DOS2 Definitive Edition Shared.pak:
Public/Shared/Stats/Generated/ItemComboProperties.txt. A recipe slot of type
"Property" accepts any listed object (or any item of a listed category).
"""
import json
import re
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    sys_argv, sys.argv = sys.argv, [sys.argv[0]]
    audit = runpy.run_path(str(ROOT / 'scripts/audit-recipes.py'))
    sys.argv = sys_argv
    index = audit['GameIndex'](['dos2'])
    text = Path(sys.argv[1]).read_text(encoding='utf-8-sig')
    properties, current = {}, None
    for kind, name, body in re.findall(r'^new (ItemComboProperty|ItemComboPropertyEntry)(?: "([^"]+)")?\s*\n((?:data .*\n?)*)', text, re.M):
        fields = dict(re.findall(r'data "([^"]+)" "([^"]*)"', body))
        if kind == 'ItemComboProperty':
            current = name
            # The game names most properties "X Source"; Wine and Milk only "Wine"/"Milk".
            label = fields.get('PreviewTooltip', name)
            properties[name] = {'group': f'{name}-Source', 'label': label if label.endswith('Source') else f'{name} Source', 'members': [], 'categories': []}
        elif fields.get('Type') == 'Category':
            category = fields['ObjectID']
            properties[current]['categories'].append(category)
            # Resolve the category to the items that carry it, so the group lists real items.
            for stats in sorted(index.stats):
                if audit['key'](category) in index.categories.get(stats, set()):
                    # Skip disguised items (masked poisoned healing potions share the real potions' names).
                    names = sorted(n for n in index.stat_names.get(stats, []) if all(
                        audit['key'](category) in index.categories.get(other, set()) for other in index.names[audit['key'](n)]))
                    properties[current]['members'].extend(n for n in names if n not in properties[current]['members'])
        else:
            names = sorted(index.stat_names.get(fields['ObjectID'], []))
            properties[current]['members'].extend(n for n in names if n not in properties[current]['members'])
    for liquid in properties.values():
        seen = set()
        liquid['members'] = [n for n in liquid['members'] if not (audit['key'](n) in seen or seen.add(audit['key'](n)))]
    output = {
        'source': 'DefEd/Data/Shared.pak → Public/Shared/Stats/Generated/ItemComboProperties.txt',
        'properties': properties,
    }
    destination = ROOT / 'data/itemComboProperties.json'
    destination.write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(destination, ', '.join(properties))


if __name__ == '__main__':
    main()
