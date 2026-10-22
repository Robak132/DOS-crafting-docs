"""Run with: python3 -m unittest discover -s src/test -p 'audit_recipes_test.py'."""
from collections import defaultdict
from pathlib import Path
import runpy
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
audit_module = runpy.run_path(str(ROOT / 'scripts/audit-recipes.py'))
GameIndex = audit_module['GameIndex']
audit = audit_module['audit']


def index():
    result = GameIndex.__new__(GameIndex)
    result.templates, result.strings, result.stats = {}, {}, {}
    result.names, result.categories, result.stat_names = defaultdict(set), defaultdict(set), defaultdict(set)
    for name in ['A', 'B', 'C', 'Oven']:
        result.names[name.lower()].add(name)
        result.stat_names[name].add(name)
    result.category_names = defaultdict(set)
    result.combos, result.stations, result.resolved, result.fit_cache = {}, {'Oven': 'Oven'}, {}, {}
    return result


def scratch_root():
    # The audit records paths relative to the repository, so fixtures must live inside it.
    folder = ROOT / '.generated'
    folder.mkdir(exist_ok=True)
    return folder


def recipe(quantity=''):
    return {'id': 'example', 'result': {'name': 'C', 'quantity': quantity}, 'ingredients': [{'name': 'B'}, {'name': 'A'}], 'requirements': ''}


class RecipeAuditTest(unittest.TestCase):
    def test_order_categories_and_station(self):
        game = index()
        game.categories['A'].add('herb')
        combo = {'fields': {'Type 1': 'Category', 'Object 1': 'Herb', 'Type 2': 'Object', 'Object 2': 'B', 'CraftingStation': 'Oven'}}
        row = recipe()
        self.assertFalse(game.ingredients_fit(row, combo, {}))
        row['ingredients'].append({'name': 'Oven'})
        self.assertTrue(game.ingredients_fit(row, combo, {}))
        row['ingredients'][0]['quantity'] = 'x2'
        self.assertFalse(game.ingredients_fit(row, combo, {}))

    def test_game_preview_labels_resolve_categories_without_fuzzy_matching(self):
        game = index()
        game.category_names['fish'].add('foodfish')
        self.assertTrue(game.fits({'name': '#Fish', 'selectorTag': 'Fish'}, 'Category', 'FoodFish', {}))
        self.assertFalse(game.fits({'name': '#Fish', 'selectorTag': 'Fish'}, 'Category', 'FoodVoidwokenFish', {}))
        self.assertTrue(game.fits({'name': 'Water'}, 'Property', 'Water', {}))
        self.assertFalse(game.fits({'name': 'A'}, 'Property', 'Water', {}))

    def test_quantities_add_repeated_outputs_and_detect_mismatch(self):
        game = index()
        game.combos['combo'] = {'id': 'combo', 'file': 'game.txt', 'line': 1, 'fields': {'Type 1': 'Object', 'Object 1': 'A', 'Type 2': 'Object', 'Object 2': 'B'}, 'outputs': [('C', 2), ('C', 1)]}
        self.assertEqual(audit('dos2', [recipe('x3')], game, {})['summary'], {'matched': 1})
        finding = audit('dos2', [recipe()], game, {})['findings'][0]
        self.assertEqual(finding['status'], 'mismatch')
        self.assertIn('catalog=1, game=[3]', finding['details'][0])

    def test_alternative_result_blocks_do_not_sum_into_multiple_items(self):
        game = index()
        game.combos['combo'] = {'id': 'combo', 'file': 'game.txt', 'line': 1,
            'fields': {'Type 1': 'Object', 'Object 1': 'A', 'Type 2': 'Object', 'Object 2': 'B'},
            'outputs': [('C', 1), ('C', 1)],
            'result_blocks': {'combo_1': {'Result 1': 'C'}, 'combo_2': {'Result 1': 'C'}}}
        self.assertEqual(audit('dos2', [recipe()], game, {})['summary'], {'matched': 1})

    def test_unresolved_names_are_not_claimed_incorrect(self):
        game = index()
        row = recipe()
        row['ingredients'][0]['name'] = 'Unknown'
        self.assertEqual(audit('dos2', [row], game, {})['summary'], {'unresolved': 1})

    def test_patches_override_results_without_discarding_combination(self):
        game = index()
        with tempfile.TemporaryDirectory(dir=scratch_root()) as folder:
            directory = Path(folder)
            source = directory / 'Public/Shared/Stats/Generated/ItemCombos.txt'
            source.parent.mkdir(parents=True)
            source.write_text('new ItemCombination "combo"\ndata "Type 1" "Object"\ndata "Object 1" "A"\nnew ItemCombinationResult "combo_1"\ndata "Result 1" "B"\n')
            game.add_dos2(directory)
            source.write_text('new ItemCombinationResult "combo_1"\ndata "Result 1" "C"\ndata "ResultAmount 1" "2"\n')
            game.add_dos2(directory)
            self.assertEqual(game.combos['combo']['fields']['Object 1'], 'A')
            self.assertEqual(game.combos['combo']['outputs'], [('C', 2)])

    def test_dos1_transform_outputs_and_requirements(self):
        game = index()
        with tempfile.TemporaryDirectory(dir=scratch_root()) as folder:
            source = Path(folder) / 'Public/Shared/Stats/ItemCombos.txt'
            source.parent.mkdir(parents=True)
            source.write_text('start transform code TransformBoth\n  set transforms param1\n  set transforms param2\nend transform code\nuse object A on object B with transform code TransformBoth parameters C,A,0,0,0,0,1,1 requires Crafting 2 autolevel 0 autoValue 0\n')
            game.add_dos1(Path(folder))
            self.assertEqual(next(iter(game.combos.values()))['outputs'], [('C', None), ('A', None)])
            self.assertEqual(audit('dos1', [recipe()], game, {})['summary'], {'mismatch': 1})
            row = recipe()
            row['requirements'] = 'Crafting 2'
            self.assertEqual(audit('dos1', [row], game, {})['summary'], {'matched': 1})


if __name__ == '__main__': unittest.main()
