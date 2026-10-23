"""Export DOS2 liquid "sources" (ItemComboProperties) and fixed object sets as crafting groups.

Usage: python3 scripts/export-combo-properties.py ITEM_COMBO_PROPERTIES_TXT
The file comes from DOS2 Definitive Edition Shared.pak:
Public/Shared/Stats/Generated/ItemComboProperties.txt. A recipe slot of type
"Property" accepts any listed object (or any item of a listed category).

Object groups come from mod recipes that the game defines once per accepted
object (e.g. Crafting Overhaul melts each piece of gold tableware into a Gold
Bar with its own ItemCombination); the group lists every object those recipes take.
Each group keeps the accepted Stats IDs ("stats"), which decide membership; the
names ("members") only label items that have no Stats ID.
"""
import json
import re
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# group id → (label, game layers, ItemCombination id pattern)
OBJECT_GROUPS = {
    'Gold-Object': ('Gold Object', ['dos2', 'overhaul'], r'^HammerAnvil_Craft_Goldbar_\d+$'),
}


def primary_name(audit, index, stats, skip=frozenset()):
    """The game name of a Stats entry: its root template's name, else its only other name."""
    root = index.templates.get(index.fields(stats).get('RootTemplate'))
    if root:
        resolved = index.template(root)
        name = index.strings.get(resolved.get('DisplayNameHandle'), resolved.get('DisplayName'))
        if name:
            return audit['plain'](name)
    names = sorted(name for name in index.stat_names.get(stats, []) if audit['key'](name) not in skip)
    return names[0] if len(names) == 1 else None


def object_groups(audit):
    """Members of each fixed object set: the slot that differs between its recipes."""
    current = ROOT / '.pak-work/audit-current'
    groups = {}
    for group, (label, layers, pattern) in OBJECT_GROUPS.items():
        index = audit['GameIndex'](layers)
        for directory in [current / 'dos2', *sorted(current.glob('dos2-Patch*'), key=lambda p: int(re.search(r'Patch(\d+)', p.name)[1]))]:
            index.add_dos2(directory)
        if 'overhaul' in layers:
            index.add_dos2(current / 'overhaul')
        combos = [combo for name, combo in sorted(index.combos.items(), key=lambda item: item[1]['line']) if re.match(pattern, name)]
        if len(combos) < 2:
            raise SystemExit(f'{group}: expected several recipes matching {pattern}')
        slots = [field for field in combos[0]['fields'] if re.fullmatch(r'Object \d+', field)]
        varying = [field for field in slots if len({combo['fields'].get(field) for combo in combos}) > 1]
        if len(varying) != 1:
            raise SystemExit(f'{group}: expected exactly one varying slot, got {varying}')
        objects = [combo['fields'][varying[0]] for combo in combos]
        # A stats entry can also back fixed scenery (Source Fountain shares the gold glass stats).
        scenery = sorted({audit['plain'](name) for template in index.templates.values()
                          for resolved in [index.template(template)] if resolved.get('Stats') in objects
                          and resolved.get('CanBePickedUp') != 'True'
                          for name in [index.strings.get(resolved.get('DisplayNameHandle'), resolved.get('DisplayName'))] if name})
        fixed = {audit['key'](name) for name in scenery}
        members, unnamed = [], []
        for stats in objects:
            name = primary_name(audit, index, stats, fixed)
            if name is None:
                unnamed.append(stats)
            elif name not in members:
                members.append(name)
        groups[group] = {'group': group, 'label': label, 'members': members, 'stats': objects, 'unnamed': unnamed,
                         # Scenery on the same Stats entry, which cannot be picked up.
                         'fixed': scenery,
                         'combos': [combo['id'] for combo in combos]}
    return groups


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
            properties[name] = {'group': f'{name}-Source', 'label': label if label.endswith('Source') else f'{name} Source', 'members': [], 'stats': [], 'categories': []}
        elif fields.get('Type') == 'Category':
            category = fields['ObjectID']
            properties[current]['categories'].append(category)
            # Resolve the category to the items that carry it, so the group lists real items.
            for stats in sorted(index.stats):
                if audit['key'](category) in index.categories.get(stats, set()):
                    properties[current]['stats'].append(stats)
                    # Skip disguised items (masked poisoned healing potions share the real potions' names).
                    names = sorted(n for n in index.stat_names.get(stats, []) if all(
                        audit['key'](category) in index.categories.get(other, set()) for other in index.names[audit['key'](n)]))
                    properties[current]['members'].extend(n for n in names if n not in properties[current]['members'])
        else:
            properties[current]['stats'].append(fields['ObjectID'])
            names = sorted(index.stat_names.get(fields['ObjectID'], []))
            properties[current]['members'].extend(n for n in names if n not in properties[current]['members'])
    for liquid in properties.values():
        seen = set()
        liquid['members'] = [n for n in liquid['members'] if not (audit['key'](n) in seen or seen.add(audit['key'](n)))]
        liquid['stats'] = sorted(set(liquid['stats']))
    output = {
        'source': 'DefEd/Data/Shared.pak → Public/Shared/Stats/Generated/ItemComboProperties.txt',
        'properties': properties,
        'objectGroups': object_groups(audit),
    }
    destination = ROOT / 'data/itemComboProperties.json'
    destination.write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(destination, ', '.join([*properties, *output['objectGroups']]))


if __name__ == '__main__':
    main()
