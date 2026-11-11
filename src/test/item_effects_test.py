from pathlib import Path
import runpy
import unittest

render = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/export-item-effects.py'))['render_effect']


class ItemEffectsTest(unittest.TestCase):
    def test_scaling_coefficients_are_not_displayed_as_final_healing_or_armour(self):
        effect, used, _ = render({'Vitality': '400', 'MagicArmor': '50'}, 'Potion')
        self.assertIn('scales with item level', effect['en'])
        self.assertNotIn('400', effect['en'])
        self.assertNotIn('50', effect['en'])
        self.assertEqual(used, ['MagicArmor', 'Vitality'])

    def test_food_and_ingredients_keep_fixed_bonuses_and_duration(self):
        effect, _, _ = render({'Strength': '1', 'VitalityPercentage': '10', 'Duration': '3'}, 'Potion')
        self.assertIn('+1 Strength', effect['en'])
        self.assertIn('Restores 10% vitality', effect['en'])
        self.assertIn('Duration: 3 turns', effect['en'])
        self.assertIn('+1 Siła', effect['pl'])

    def test_equipment_bonuses_under_edition_specific_fields_are_shown(self):
        effect, _, _ = render({'Charisma': '1', 'SightBoost': '1', 'Luck': '1', 'FireResistanceBoost': '2'}, 'Armor')
        for part in ['+1 Charisma', '+1 Sight', '+1 Lucky Charm', '+2% fire resistance']:
            self.assertIn(part, effect['en'])

    def test_dos2_weapons_get_a_tag_for_the_attribute_they_scale_with(self):
        tags = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/item-tag-rules.py'))['effect_tags']
        fields = {'Requirements': 'Intelligence 12', 'Damage Type': 'Air'}
        found, labels = tags(fields, 'Weapon', scales=True)
        self.assertIn('Scales-With-Intelligence', found)
        self.assertEqual(labels['Scales-With-Intelligence'], 'Skaluje się z Inteligencją')
        self.assertNotIn('Scales-With-Intelligence', tags(fields, 'Weapon')[0])
        self.assertNotIn('Scales', render(fields, 'Weapon')[0]['en'])

    def test_object_durability_flags_are_not_player_immunities(self):
        effect, _, _ = render({'Constitution': '1', 'Flags': 'PoisonImmunity;SleepingImmunity', 'Weight': '1000'}, 'Object')
        self.assertIsNone(effect)

    def test_weapon_bonus_skill_and_status_are_kept(self):
        effect, _, _ = render({'WaterSpecialist': '1', 'Water': '15', 'Skills': 'Ice', 'ExtraProperties': 'WET,100,1'}, 'Weapon', lambda _: ('Ice Breaker', 'Lodołamacz'))
        self.assertIn('+15% water resistance', effect['en'])
        self.assertIn('Wet (100%), turns: 1', effect['en'])
        self.assertIn('Lodołamacz', effect['pl'])

    def test_skillbooks_teach_while_grenades_apply_their_spell_status(self):
        action={'ActionType': '13', 'SkillID': 'Fireball'}
        effect, _, _ = render({}, 'Object', lambda _: ('Fireball', 'Kula Ognia'), [action])
        self.assertEqual(effect['en'], 'Teaches skill: Fireball')
        effect, _, _ = render({}, 'Object', lambda _: ('Love Grenade', 'Granat miłości'), [{'ActionType':'12','SkillID':'Love'}], skill_fields=lambda _: {'SkillProperties':'CHARMED,100,2'})
        self.assertIn('Charmed (100%), turns: 2', effect['en'])
        self.assertIn('Zauroczenie', effect['pl'])

    def test_unknown_effects_are_reported_without_displaying_internal_identifiers(self):
        effect, _, unknown = render({'ExtraProperties':'Self:OnEquip:TALENT_Unknown'}, 'Armor')
        self.assertIsNone(effect)
        self.assertEqual(unknown, [{'field':'ExtraProperties','value':'Self:OnEquip:TALENT_Unknown'}])

    def test_dos1_status_spelling_is_normalized(self):
        effect, _, _ = render({'ExtraProperties':'Poison,100,1'}, 'Potion')
        self.assertIn('Poisoned', effect['en'])
        self.assertIn('Zatrucie', effect['pl'])

    def test_runes_keep_separate_weapon_armour_and_amulet_bonuses(self):
        entries={'weapon':{'Damage Type':'Fire','DamageFromBase':'9'},'armour':{'Fire':'5'},'amulet':{'CriticalChance':'3'}}
        effect, _, _ = render({'RuneEffectWeapon':'weapon','RuneEffectUpperbody':'armour','RuneEffectAmulet':'amulet'},'Object',skill_fields=lambda name: entries[name])
        self.assertIn('Weapon: +9% fire damage based on weapon damage',effect['en'])
        self.assertIn('Armour: +5% fire resistance',effect['en'])
        self.assertIn('Amulet: +3% Critical chance',effect['en'])

    def test_equipment_attribute_boosts_and_source_surface_are_exported(self):
        effect, _, unknown = render({'FinesseBoost':'-1','MemoryBoost':'1','ExtraProperties':'CreateSurface,1,1,Source,100'},'Weapon')
        self.assertIn('-1 Finesse',effect['en'])
        self.assertIn('+1 Memory',effect['en'])
        self.assertIn('Creates a Source surface',effect['en'])
        self.assertIn('Tworzy powierzchnię Źródła',effect['pl'])
        self.assertEqual(unknown,[])


if __name__ == '__main__':
    unittest.main()
