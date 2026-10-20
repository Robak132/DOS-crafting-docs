from pathlib import Path
import runpy
import unittest

module = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/clean-item-tags.py'))
classify = module['classify']
normalize = module['normalized_tags']


class ItemTagsTest(unittest.TestCase):
    def test_magic_equipment_uses_its_inventory_type(self):
        self.assertEqual(classify('Air Bow', ['Typ/Magia'], [('WPN_Bow_Air', {})])[0], 'Bron')
        self.assertEqual(classify('Acid Spores Scroll', ['Typ/Skladniki'])[0], 'Zwoje')
        self.assertEqual(classify('Blank Air Skillbook', ['Typ/Skladniki'])[0], 'Ksiegi-umiejetnosci')

    def test_materials_and_empty_containers_are_not_equipment_or_consumables(self):
        for name in ['Plate Scraps', 'Sinew', 'Bone Dust', 'Intestines', 'Empty Potion Bottle', 'Empty vial']:
            self.assertEqual(classify(name, ['Typ/Skladniki', 'Typ/Bron'])[0], 'Skladniki', name)

    def test_container_names_do_not_inherit_the_types_of_their_contents(self):
        for name in ['Skillbook & Scrolls Bag', 'Skillbook Scroll Chest', 'Arrow & Grenade Bag', 'Dye Making Machine']:
            self.assertEqual(classify(name, ['Typ/Stanowiska-i-pojemniki'])[0], 'Stanowiska-i-pojemniki', name)

    def test_equipment_potions_and_wearable_containers_are_distinguished(self):
        self.assertEqual(classify('Giant Magic Armor', ['Typ/Mikstury-i-jedzenie'])[0], 'Mikstury-i-jedzenie')
        self.assertEqual(classify('Battered Cooking Pot', ['Typ/Pancerz'])[0], 'Pancerz')
        self.assertEqual(classify('Barrel Armor', ['Typ/Przedmioty-wydarzen'])[0], 'Pancerz')

    def test_mode_and_sidebar_markers_are_normalized_without_losing_properties(self):
        tags = normalize(['Typ', 'Typ/Bron', 'Typ/Skladniki', 'Cechy', 'Cechy-podstawowe', 'Cechy/Leczenie', 'DOS1', 'DOS2', 'Typ/Przedmioty-wydarzen'], 'Mikstury-i-jedzenie', 'DOS2-CO')
        self.assertEqual(tags, ['Typ', 'Typ/Bron', 'Typ/Skladniki', 'Typ/Przedmioty-wydarzen', 'Typ/Mikstury-i-jedzenie', 'Cechy', 'Cechy/Leczenie', 'DOS2-CO'])

    def test_magic_weapon_keeps_multiple_types(self):
        self.assertEqual(normalize(['Typ/Magia', 'Typ/Skladniki'], 'Bron', 'DOS2-CO'),
                         ['Typ', 'Typ/Magia', 'Typ/Skladniki', 'Typ/Bron', 'DOS2-CO'])

    def test_only_explicit_wrong_tags_are_removed(self):
        tags = normalize(['Typ/Pancerz', 'Typ/Skladniki', 'Typ/Magia'], 'Skladniki', 'DOS2',
                         module['invalid_type_tags']('Plate Scraps'))
        self.assertEqual(tags, ['Typ', 'Typ/Skladniki', 'Typ/Magia', 'DOS2'])


if __name__ == '__main__': unittest.main()
