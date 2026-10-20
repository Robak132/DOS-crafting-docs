from pathlib import Path
import runpy
import unittest

m=runpy.run_path(str(Path(__file__).resolve().parents[2]/'scripts/item-tag-rules.py'))

class ItemTagRulesTest(unittest.TestCase):
    def test_equipment_subtype_comes_from_game_fields(self):
        self.assertEqual(m['type_tags']({'WeaponType':'Wand'},'Weapon'),['Typ/Bron','Typ/Bron/Rozdzki'])
        self.assertEqual(m['type_tags']({'WeaponType':'Knife'},'Weapon'),['Typ/Bron','Typ/Bron/Sztylety'])
        self.assertEqual(m['type_tags']({'Slot':'Boots'},'Armor'),['Typ/Pancerz','Typ/Pancerz/Buty'])
        self.assertEqual(m['type_tags']({'Slot':'Shield'},'Weapon'),['Typ/Pancerz','Typ/Pancerz/Tarcze'])
        self.assertEqual(m['type_tags']({'Slot':'Amulet'},'Armor'),['Typ/Amulety'])

    def test_tags_distinguish_damage_resistance_and_inflicted_status(self):
        tags,_=m['effect_tags']({'Damage Type':'Water','Water':'15','WaterSpecialist':'1','ExtraProperties':'WET,100,1'},'Weapon',label=lambda s:('Wet','Mokry') if s=='WET' else None)
        for tag in ['Cechy/Obrażenia-magiczne/wody','Cechy/Odporność-na-wodę','Cechy/Umiejetnosci/Hydrosophia','Efekty/Statusy/WET']:self.assertIn(tag,tags)

    def test_negative_attributes_are_affected_traits_not_fabricated_immunities(self):
        tags,_=m['effect_tags']({'FinesseBoost':'-1','MemoryBoost':'1','ExtraProperties':'CreateSurface,1,1,Source,100'},'Weapon')
        self.assertIn('Cechy/Zręczność',tags)
        self.assertIn('Cechy/Pamięć',tags)
        self.assertIn('Efekty/Powierzchnie/Source',tags)

    def test_object_flags_do_not_become_player_buffs(self):
        tags,_=m['effect_tags']({'Flags':'BleedingImmunity;PoisonImmunity','Constitution':'1'},'Object')
        self.assertEqual(tags,[])

    def test_rune_tags_include_slot_dependent_effects(self):
        entries={'weapon':{'Damage Type':'Fire','DamageFromBase':'9'},'armour':{'Fire':'5'}}
        tags,_=m['effect_tags']({'RuneEffectWeapon':'weapon','RuneEffectUpperbody':'armour'},'Object',lookup=lambda s:entries[s])
        self.assertIn('Cechy/Obrażenia-magiczne/ognia',tags)
        self.assertIn('Cechy/Odporność-na-ogień',tags)

    def test_combat_ability_tags_include_their_parent_groups(self):
        tags,_=m['effect_tags']({'SingleHanded':'1','Leadership':'1','AirSpecialist':'1'},'Armor')
        for group,leaf in [('Bieglosci-broni','Jednoręczna'),('Bieglosci-obrony','Przywództwo'),('Umiejetnosci','Aeroteurgia')]:
            self.assertIn('Cechy/'+group,tags)
            self.assertIn('Cechy/'+group+'/'+leaf,tags)
        self.assertNotIn('Cechy/Przywództwo',tags)

    def test_weapon_ability_tags_require_positive_ability_bonuses(self):
        for kind,fields in [('Weapon',{'IsTwoHanded':'Yes','WeaponType':'Sword'}),('Armor',{'TwoHanded':'0'}),('Armor',{'TwoHanded':'-1'})]:
            tags,_=m['effect_tags'](fields,kind)
            self.assertFalse(any(t.startswith('Cechy/Bieglosci-broni') for t in tags))
        for field,suffix in [('SingleHanded','Jednoręczna'),('TwoHanded','Dwuręczna'),('DualWielding','Walka-dwoma-broniami'),('Ranged','Dystansowa')]:
            for kind in ['Weapon','Armor','Potion']:
                tags,_=m['effect_tags']({field:'1'},kind)
                self.assertIn('Cechy/Bieglosci-broni/'+suffix,tags)
                self.assertIn('Cechy/Bieglosci-broni',tags)

    def test_armour_profile_uses_an_inclusive_75_percent_threshold(self):
        for physical,magical,expected in [(75,25,'physical'),(25,75,'magical'),(74,26,'balanced'),(26,74,'balanced'),(55,35,'balanced'),(55,55,'balanced'),(90,15,'physical'),(15,90,'magical'),(100,0,'physical'),(0,100,'magical'),(0,0,None)]:
            fields={'Armor Defense Value':str(physical),'Magic Armor Value':str(magical)}
            self.assertEqual(m['armour_profile'](fields),expected)
            tags,_=m['effect_tags'](fields,'Armor')
            self.assertEqual('Cechy/Pancerz-fizyczny' in tags,physical>0 and expected!='magical')
            self.assertEqual('Cechy/Pancerz-magiczny' in tags,magical>0 and expected!='physical')
            self.assertEqual('Cechy/Pancerz-zbalansowany' in tags,expected=='balanced')

    def test_armour_profile_does_not_hide_potion_or_rune_effects(self):
        tags,_=m['effect_tags']({'Armor':'50','MagicArmor':'50'},'Potion')
        self.assertIn('Cechy/Pancerz-fizyczny',tags)
        self.assertIn('Cechy/Pancerz-magiczny',tags)
        self.assertNotIn('Cechy/Pancerz-zbalansowany',tags)
        tags,_=m['effect_tags']({'Armor Defense Value':'15','Magic Armor Value':'90','ArmorBoost':'10'},'Armor')
        self.assertNotIn('Cechy/Pancerz-fizyczny',tags)

if __name__=='__main__':unittest.main()
