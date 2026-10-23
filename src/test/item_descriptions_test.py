"""Run: python3 -m unittest discover -s src/test -p 'item_descriptions_test.py'."""
from pathlib import Path
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[2]
module = runpy.run_path(str(ROOT / 'scripts/export-item-descriptions.py'))
collect = module['collect_descriptions']


class ItemDescriptionTest(unittest.TestCase):
    def test_an_item_with_a_stats_id_is_described_by_that_entrys_root_template(self):
        templates = {'gold': {'MapKey': 'gold', 'Stats': 'ITEM_Gold_Plate', 'Description': 'Pretty. Sell it.'},
                     'fountain': {'MapKey': 'fountain', 'DisplayName': 'Fountain', 'Stats': 'ITEM_Gold_Plate', 'Description': 'Source bubbles.'},
                     'ceramic': {'MapKey': 'ceramic', 'DisplayName': 'Plate', 'Stats': 'ITEM_Ceramic_Plate', 'Description': 'Plain.'}}
        stats = {'ITEM_Gold_Plate': {'fields': {'RootTemplate': 'gold'}}}
        result = collect(templates, {}, {}, {}, stats, {'ITEM_Gold_Plate': None, 'ITEM_Ceramic_Plate': 'plate'})
        self.assertEqual(result['itemgoldplate'], {'en': 'Pretty. Sell it.'})
        self.assertEqual(result['itemceramicplate'], {'en': 'Plain.'})

    def test_mod_color_markup_does_not_become_part_of_the_lookup_key(self):
        result = collect({'red': {'DisplayName': '<font color="#de5d5d">Pastel Red Dye</font>', 'Description': 'A kiss of red pepper, the brightest burnishing for your equipment.'}}, {}, {})
        self.assertEqual(result['pastelreddye']['en'], 'A kiss of red pepper, the brightest burnishing for your equipment.')
        self.assertEqual(list(result), ['pastelreddye'])

    def test_localization_handles_work_without_inline_english_and_preserve_polish(self):
        result = collect({'item': {'DisplayNameHandle': 'name', 'DescriptionHandle': 'desc'}}, {'name': '<font>Blue Dye</font>', 'desc': 'English description'}, {'desc': 'Polski opis'})
        self.assertEqual(result['bluedye'], {'en': 'English description', 'pl': 'Polski opis'})

    def test_inline_inventory_name_takes_precedence_over_a_shared_localization_handle(self):
        result = collect({'item': {'DisplayName': 'Artillery Plant Scroll', 'DisplayNameHandle': 'shared-name', 'Description': 'Scroll description'}}, {'shared-name': 'Poisonous Plant'}, {})
        self.assertEqual(result, {'artilleryplantscroll': {'en': 'Scroll description'}})

    def test_inherited_description_uses_the_child_name_and_not_its_parents_name_handle(self):
        result = collect({'parent': {'DisplayName': 'Parent', 'DisplayNameHandle': 'parent-name', 'Description': 'Inherited', 'DescriptionHandle': 'desc'}, 'child': {'ParentTemplateId': 'parent', 'DisplayName': '<font>Child</font>'}}, {'parent-name': 'Localized parent'}, {'desc': 'Dziedziczony'})
        self.assertEqual(result['child'], {'en': 'Inherited', 'pl': 'Dziedziczony'})

    def test_inventory_names_take_precedence_over_another_items_stats_label(self):
        result = collect({'raw': {'DisplayName': 'Meat', 'Description': 'Raw'}, 'cooked': {'DisplayName': 'Dinner', 'Stats': 'old-meat', 'Description': 'Cooked'}}, {'old-meat': 'Meat'}, {})
        self.assertEqual(result['meat']['en'], 'Raw')
        self.assertEqual(result['dinner']['en'], 'Cooked')

    def test_a_different_inventory_name_does_not_pollute_the_stats_label(self):
        result = collect({'artifact': {'Stats': 'Artifact', 'Description': 'Artifact description'}, 'quest': {'DisplayName': 'Phase Capacitor', 'Stats': 'Artifact', 'Description': 'Quest description'}}, {'Artifact': 'Eternal Artefact'}, {})
        self.assertEqual(result['eternalartefact']['en'], 'Artifact description')
        self.assertEqual(result['phasecapacitor']['en'], 'Quest description')

    def test_missing_polish_does_not_discard_an_identical_english_description(self):
        result = collect({'one': {'DisplayName': 'Item', 'Description': 'Same'}, 'two': {'DisplayName': 'Item', 'Description': 'Same', 'DescriptionHandle': 'translated'}}, {}, {'translated': 'Tłumaczenie'})
        self.assertEqual(result['item'], {'en': 'Same', 'pl': 'Tłumaczenie'})

    def test_verified_game_stats_resolve_same_name_description_conflicts(self):
        templates = {'food': {'DisplayName': 'Eggs', 'Stats': 'FoodEgg', 'Description': 'Food'}, 'quest': {'DisplayName': 'Eggs', 'Stats': 'QuestEgg', 'Description': 'Quest'}}
        result = collect(templates, {}, {}, {'eggs': {'stats': 'FoodEgg'}})
        self.assertEqual(result['eggs']['en'], 'Food')

    def test_verified_identity_finds_descriptions_when_inventory_and_recipe_names_differ(self):
        templates = {'egg': {'DisplayName': 'Egg', 'Stats': 'FoodEgg', 'Icon': 'egg-icon', 'Description': 'Food'}}
        result = collect(templates, {}, {}, {'eggs': {'stats': 'FoodEgg'}, 'recipeegg': {'icon': 'egg-icon'}})
        self.assertEqual(result['eggs']['en'], 'Food')
        self.assertEqual(result['recipeegg']['en'], 'Food')

    def test_a_shared_icon_cannot_choose_between_different_descriptions(self):
        templates = {'one': {'DisplayName': 'One', 'Icon': 'shared', 'Description': 'First'}, 'two': {'DisplayName': 'Two', 'Icon': 'shared', 'Description': 'Second'}}
        result = collect(templates, {}, {}, {'recipeitem': {'icon': 'shared'}})
        self.assertNotIn('recipeitem', result)

    def test_stats_root_template_selects_the_description_used_by_the_game(self):
        templates = {'food': {'MapKey': 'food', 'DisplayName': 'Eggs', 'Stats': 'Egg', 'Description': 'Food'}, 'quest': {'MapKey': 'quest', 'DisplayName': 'Eggs', 'Stats': 'Egg', 'Description': 'Quest'}}
        result = collect(templates, {}, {}, {}, {'Egg': {'fields': {'RootTemplate': 'food'}}})
        self.assertEqual(result['eggs']['en'], 'Food')

    def test_conflicting_english_and_empty_descriptions_are_omitted(self):
        result = collect({'one': {'DisplayName': 'Item', 'Description': 'One'}, 'two': {'DisplayName': 'Item', 'Description': 'Two'}, 'empty': {'DisplayName': 'Empty', 'Description': '<font></font>'}}, {}, {})
        self.assertEqual(result, {})

    def test_encoded_markup_is_decoded_and_line_breaks_preserved(self):
        result = collect({'item': {'DisplayName': '&lt;font&gt;Item&lt;/font&gt;', 'Description': '<i>First</i><br>Second &amp; third'}}, {}, {})
        self.assertEqual(result['item']['en'], 'First\nSecond & third')


if __name__ == '__main__': unittest.main()
