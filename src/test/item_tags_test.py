from pathlib import Path
import runpy
import unittest

module = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/clean-item-tags.py'))
classify = module['classify']
normalize = module['normalized_tags']


class ItemTagsTest(unittest.TestCase):
    def test_magic_equipment_uses_its_inventory_type(self):
        self.assertEqual(classify('Air Bow', ['Magic'], [('WPN_Bow_Air', {})])[0], 'Weapons')
        self.assertEqual(classify('Acid Spores Scroll', ['Ingredients'])[0], 'Scrolls')
        self.assertEqual(classify('Blank Air Skillbook', ['Ingredients'])[0], 'Skillbooks')

    def test_materials_and_empty_containers_are_not_equipment_or_consumables(self):
        for name in ['Plate Scraps', 'Sinew', 'Bone Dust', 'Intestines', 'Empty Potion Bottle', 'Empty vial']:
            self.assertEqual(classify(name, ['Ingredients', 'Weapons'])[0], 'Ingredients', name)

    def test_container_names_do_not_inherit_the_types_of_their_contents(self):
        for name in ['Skillbook & Scrolls Bag', 'Skillbook Scroll Chest', 'Arrow & Grenade Bag', 'Dye Making Machine']:
            self.assertEqual(classify(name, ['Stations-And-Containers'])[0], 'Stations-And-Containers', name)

    def test_equipment_potions_and_wearable_containers_are_distinguished(self):
        self.assertEqual(classify('Giant Magic Armor', ['Potions'])[0], 'Potions')
        self.assertEqual(classify('Battered Cooking Pot', ['Armour'])[0], 'Armour')
        self.assertEqual(classify('Barrel Armor', ['Seasonal-Items'])[0], 'Armour')

    def test_markers_and_sidebar_headings_are_normalized_without_losing_properties(self):
        tags = normalize(['Category', 'Weapons', 'Ingredients', 'Attributes', 'Healing', 'DOS1', 'DOS2', 'Seasonal-Items'], 'Potions', 'DOS2-CO')
        self.assertEqual(tags, ['Weapons', 'Ingredients', 'Seasonal-Items', 'Potions', 'Healing', 'DOS2-CO'])

    def test_weapon_keeps_multiple_types_and_only_the_most_specific_tags(self):
        self.assertEqual(normalize(['Scrolls', 'Ingredients', 'Bows'], 'Weapons', 'DOS2-CO'), ['Scrolls', 'Ingredients', 'Bows', 'DOS2-CO'])

    def test_only_explicit_wrong_tags_are_removed(self):
        tags = normalize(['Armour', 'Ingredients', 'Scrolls'], 'Ingredients', 'DOS2', module['invalid_type_tags']('Plate Scraps'))
        self.assertEqual(tags, ['Ingredients', 'Scrolls', 'DOS2'])


if __name__ == '__main__': unittest.main()
