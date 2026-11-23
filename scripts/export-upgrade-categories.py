"""Record which game item categories each DOS1 upgrade applies to, from the game's ItemCombos.

Usage: python3 scripts/export-upgrade-categories.py [--check]
Reads .pak-work/audit-current/dos1/Public/*/Stats/ItemCombos.txt and writes `targetCategories`
(the game's ComboCategory values) into the upgrades of data/library/recipes/dos1.json.
Only needed when refreshing game data; CI uses the saved source JSON.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMBOS = ROOT / '.pak-work/audit-current/dos1/Public'
LIBRARY = ROOT / 'data/library/recipes/dos1.json'

# Game objects (or "category:" combo categories) behind each upgrade ingredient's catalog name.
INGREDIENTS = {
    'Air Essence': ['LOOT_Essence_Air_A'],
    'Earth Essence': ['LOOT_Essence_Earth_A'],
    'Fire Essence': ['LOOT_Essence_Fire_A'],
    'Water Essence': ['LOOT_Essence_Water_A'],
    'Shadow Essence': ['LOOT_Essence_Shadow_A'],
    'Ruby': ['category:Ruby'],
    'Pearl': ['category:Pearl', 'HAR_Pearl_A'],
    'Mobile Kitchen': ['FUR_BoilingPot_A'],
    'Leather Scraps': ['LOOT_Scraps_Leather_A'],
    'Metal Scraps': ['LOOT_Scraps_Metal_A'],
    'Plate Scraps': ['LOOT_Scraps_Plate_A'],
    'Scale Scraps': ['LOOT_Scraps_Scale_A'],
    'Anvil': ['category:Anvil'],
    'Whetstone': ['LOOT_Stone_A_Whet_A'],
    'Whetstone Wheel': ['LOOT_WhetStone_Wheel_A'],
    'Bowstring': ['LOOT_String_Bow_A'],
    'Moonstone': ['LOOT_Moonstone_A'],
    'Scope': ['TOOL_Scope_A'],
    'Nine Inch Nails': ['ITEM_Nails'],
    'Bottle Filled With Oil': ['ITEM_BottleWithOil'],
    'Cup of Oil': ['CON_Drink_Cup_A_Oil'],
    'Poison Bottle': ['category:PotionPoison'],
    'Tormented Soul': ['LOOT_Soul_Tormented_A'],
    'Tenebrium Bar': ['LOOT_OreBar_A_BlackRock_A'],
    'Fabric Dye (Purple, Green)': ['TOOL_Dye_Purple', 'TOOL_Dye_Green'],
    'Fabric Dye (White, Yellow, Red)': ['TOOL_Dye_White', 'TOOL_Dye_Yellow', 'TOOL_Dye_Red'],
    'Fabric Dye (Black)': ['TOOL_Dye_Black'],
    'Fabric Dye (Blue)': ['TOOL_Dye_Blue'],
    "Grumio's Cotton Candy Dye": ['TOOL_DLC_Dye_Candy'],
    'Golden Grail': ['UNI_HolyGrail_DLC_A'],
}
# The catalog calls the Blackrock skill Tenebrium.
SKILLS = {'Tenebrium': 'Blackrock'}
# The catalog slots each game category belongs to.
SLOTS = {
    'ArmorScale': 'Chest-Armour', 'ArmorLeather': 'Chest-Armour', 'ClothArmor': 'Chest-Armour',
    'RobeArmor': 'Chest-Armour', 'Garment': 'Leggings', 'ArmorBelt': 'Belts', 'ArmorGloves': 'Gloves',
    'ArmorHelmet': 'Helmets', 'LeatherHelmet': 'Helmets', 'ArmorShoes': 'Boots',
    'ShieldMetal': 'Shields', 'ShieldWood': 'Shields',
    'Axe': 'Weapons', 'Bow': 'Weapons', 'Club': 'Weapons', 'Crossbow': 'Weapons', 'Dagger': 'Weapons',
    'Knife': 'Weapons', 'Spear': 'Weapons', 'Staff': 'Weapons', 'Sword': 'Weapons',
    'TwoHandedAxe': 'Weapons', 'TwoHandedSword': 'Weapons',
}
WEAPON_TAGS = {
    'Axe': 'One-Handed-Axes', 'Bow': 'Bows', 'Club': 'One-Handed-Maces', 'Crossbow': 'Crossbows',
    'Dagger': 'Daggers', 'Knife': 'Daggers', 'Spear': 'Spears', 'Staff': 'Staves',
    'Sword': 'One-Handed-Swords', 'TwoHandedAxe': 'Two-Handed-Axes', 'TwoHandedSword': 'Two-Handed-Swords',
}
# A material its target names keeps an upgrade to that material's categories: the game has separate
# combos of one ingredient for cloth and leather armour ("Cloth Chest" and "Leather Chest" + Metal Scraps).
MATERIALS = {
    'cloth': {'ClothArmor', 'RobeArmor', 'Garment'},
    'leather': {'ArmorLeather', 'LeatherHelmet', 'ArmorBelt', 'ArmorGloves', 'ArmorHelmet'},
}
COMBO = re.compile(
    r'use (object|category) (\S+) on (object|category) (\S+) with transform code (\S+) parameters (\S+)'
    r'(?: requires (\w+) (\d+))?'
)


def combos():
    for path in sorted(COMBOS.glob('*/Stats/ItemCombos.txt')):
        for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
            match = COMBO.match(line)
            if not match:
                continue
            kind1, first, kind2, second, code, parameters, skill, level = match.groups()
            # Only boosts of a category's item, in either order; a craft turning it into another item is no upgrade.
            if 'Boost' not in code or 'Transform2' in code or 'TransformBoth' in code:
                continue
            spec = lambda kind, name: name if kind == 'object' else 'category:' + name
            if kind2 == 'category':
                yield spec(kind1, first), second, skill, level
            if kind1 == 'category':
                yield spec(kind2, second), first, skill, level


def fits(category, target_tags):
    slot = SLOTS.get(category)
    if slot == 'Weapons':
        return 'Weapons' in target_tags or WEAPON_TAGS[category] in target_tags
    return slot in target_tags


def main(check):
    rows = list(combos())
    library = json.loads(LIBRARY.read_text(encoding='utf-8'))
    changed = []
    for upgrade in library['upgrades']:
        name = upgrade['ingredients'][0]['name']
        specs = INGREDIENTS[name]
        requirement = upgrade['requirements'].split()
        skill, level = (SKILLS.get(requirement[0], requirement[0]), requirement[1]) if requirement else (None, None)
        categories = sorted({
            category for spec, category, row_skill, row_level in rows
            if spec in specs and category in SLOTS and fits(category, upgrade['targetTags'])
            and (skill is None or (row_skill, row_level) == (skill, level))
        })
        for word, kept in MATERIALS.items():
            if re.search(rf'\b{word}\b', upgrade['target']['name'].replace('-', ' '), re.I):
                categories = [category for category in categories if category in kept]
        assert categories, f'No game combo for {upgrade["id"]}'
        if upgrade.get('targetCategories') != categories:
            changed.append(upgrade['id'])
            upgrade['targetCategories'] = categories
        print(f'{upgrade["target"]["name"]:44} + {name:32} {upgrade["requirements"]:16} -> {", ".join(categories)}')
    if check:
        assert not changed, f'Outdated targetCategories: {changed}'
        return
    LIBRARY.write_text(json.dumps(library, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(len(changed), 'upgrades updated')


if __name__ == '__main__':
    main('--check' in sys.argv)
