"""Pure game-Stats to inventory/effect tag rules used by the offline exporters."""
import re

# Game Stats field -> English tag id (Polish appears only as its label in data/tagLabels.json).
ATTRIBUTES = {
 'Strength':'Strength','Finesse':'Finesse','Dexterity':'Dexterity','Intelligence':'Intelligence',
 'Constitution':'Constitution','Memory':'Memory','Wits':'Wits','Perception':'Perception','Speed':'Speed',
 'Initiative':'Initiative','AccuracyBoost':'Accuracy','ChanceToHitBoost':'Accuracy','CriticalChance':'Critical-Chance',
 'DodgeBoost':'Dodge','ArmorBoost':'Physical-Armour','MagicArmorBoost':'Magic-Armour',
 'Armor':'Physical-Armour','MagicArmor':'Magic-Armour','Armor Defense Value':'Physical-Armour','Magic Armor Value':'Magic-Armour',
 'VitalityBoost':'Vitality','Vitality':'Healing','VitalityPercentage':'Healing',
 'Leadership':'Leadership','LuckyCharm':'Lucky-Charm','Loremaster':'Loremaster','Telekinesis':'Telekinesis',
 'Sneaking':'Sneaking','Thievery':'Thievery','Bartering':'Bartering','Persuasion':'Persuasion',
 'Lockpicking':'Lockpicking','Pickpocket':'Pickpocketing','Crafting':'Crafting','Blacksmithing':'Blacksmithing',
 'WaterSpecialist':'Hydrosophist','FireSpecialist':'Pyrokinetic','AirSpecialist':'Aerotheurge','EarthSpecialist':'Geomancer',
 'Necromancy':'Necromancer','Summoning':'Summoning','Polymorph':'Polymorph','WarriorLore':'Warfare','RangerLore':'Huntsman','RogueLore':'Scoundrel',
 'SingleHanded':'Single-Handed','TwoHanded':'Two-Handed','DualWielding':'Dual-Wielding','Ranged':'Ranged',
 'APRecovery':'AP-Recovery','APStart':'Starting-AP','APMaximum':'Max-AP',
 'BodyBuilding':'Bodybuilding','Willpower':'Willpower','Defense':'Defence',
}
SCALING={'Strength':'Skaluje się z Siłą','Finesse':'Skaluje się ze Zręcznością','Intelligence':'Skaluje się z Inteligencją'}
# Element -> (resistance tag, damage tag)
ELEMENTS={'Fire':('Fire-Resistance','Fire-Damage'),'Water':('Water-Resistance','Water-Damage'),'Air':('Air-Resistance','Air-Damage'),'Earth':('Earth-Resistance','Earth-Damage'),'Poison':('Poison-Resistance','Poison-Damage'),'Physical':('Physical-Resistance','Physical-Damage'),'Piercing':('Piercing-Resistance','Piercing-Damage'),'Shadow':('Shadow-Resistance','Shadow-Damage')}
WEAPONS={'Sword':('Swords','Miecze'),'Axe':('Axes','Topory'),'Club':('Maces','Buławy i młoty'),'Mace':('Maces','Buławy i młoty'),'Dagger':('Daggers','Sztylety'),'Knife':('Daggers','Sztylety'),'Spear':('Spears','Włócznie'),'Spears':('Spears','Włócznie'),'Bow':('Bows','Łuki'),'Crossbow':('Crossbows','Kusze'),'Staff':('Staves','Kostury'),'Wand':('Wands','Różdżki')}
SLOTS={'Helmet':('Helmets','Hełmy'),'Breast':('Chest-Armour','Napierśniki'),'Chest':('Chest-Armour','Napierśniki'),'Gloves':('Gloves','Rękawice'),'Boots':('Boots','Buty'),'Leggings':('Leggings','Spodnie'),'Shield':('Shields','Tarcze'),'Amulet':('Amulets','Amulety'),'Ring':('Rings','Pierścienie'),'Belt':('Belts','Pasy')}
HANDED={'Swords':('One-Handed-Swords','Two-Handed-Swords'),'Axes':('One-Handed-Axes','Two-Handed-Axes'),'Maces':('One-Handed-Maces','Two-Handed-Maces')}
CATEGORY_TYPES={
 'Sword':'One-Handed-Swords','TwoHandedSword':'Two-Handed-Swords','Axe':'One-Handed-Axes','TwoHandedAxe':'Two-Handed-Axes','Club':'One-Handed-Maces','TwoHandedMaces':'Two-Handed-Maces','Dagger':'Daggers','Knife':'Daggers','Spear':'Spears','Spears':'Spears','Bow':'Bows','Bows':'Bows','Crossbow':'Crossbows','Crossbows':'Crossbows','Wand':'Wands','Wands':'Wands','Staff':'Staves','Staves':'Staves',
 'Helmet':'Helmets','Boots':'Boots','Gloves':'Gloves','Leggings':'Leggings','Pants':'Leggings','Lowerbody':'Leggings','Upperbody':'Chest-Armour','UpperBody':'Chest-Armour','Breast':'Chest-Armour','Shield':'Shields','Shields':'Shields','Amulet':'Amulets','Ring':'Rings','Belt':'Belts',
}


def type_tags(fields,kind):
    slot=fields.get('Slot','');weapon=fields.get('WeaponType','')
    if slot=='Shield' or weapon=='Shield':return ['Shields']
    if kind=='Armor' and slot in ['Amulet','Ring','Belt']:return [{'Amulet':'Amulets','Ring':'Rings','Belt':'Belts'}[slot]]
    if kind=='Armor' and slot in SLOTS:return [SLOTS[slot][0]]
    if kind=='Weapon' and weapon in WEAPONS:
        tag=WEAPONS[weapon][0]
        # Swords, axes and maces come in both hands; the game's IsTwoHanded flag decides which.
        if tag in HANDED and fields.get('IsTwoHanded') in ('Yes','No'):return [HANDED[tag][fields['IsTwoHanded']=='Yes']]
        return [tag]
    return []


# Game surface -> (tag id, Polish label)
SURFACES={'Fire':('Fire-Surface','Ogień'),'Water':('Water-Surface','Woda'),'WaterFrozen':('Ice-Surface','Lód'),'Source':('Source-Surface','Źródło'),'Poison':('Poison-Surface','Trucizna'),'Oil':('Oil-Surface','Olej'),'Blood':('Blood-Surface','Krew')}

# Weapon abilities count only as a bonus, never as the weapon's own handedness.
WEAPON_ABILITIES = ['Single-Handed', 'Two-Handed', 'Dual-Wielding', 'Ranged']
IMMUNITIES={'Burn':('Burning-Immunity','ogień'),'Burning':('Burning-Immunity','ogień'),'Freeze':('Freezing-Immunity','zamrożenie'),'Frozen':('Freezing-Immunity','zamrożenie'),'Stun':('Stun-Immunity','ogłuszenie'),'Stunned':('Stun-Immunity','ogłuszenie'),'Blind':('Blind-Immunity','oślepienie'),'Bleeding':('Bleeding-Immunity','krwawienie'),'Acid':('Acid-Immunity','kwas'),'Knockdown':('Knockdown-Immunity','potrącenie'),'KnockedDown':('Knockdown-Immunity','potrącenie'),'Slowed':('Slow-Immunity','spowolnienie'),'Charm':('Charm-Immunity','urok'),'Fear':('Fear-Immunity','strach'),'Poison':('Poison-Immunity','truciznę'),'Sleeping':('Sleep-Immunity','sen'),'Crippled':('Crippled-Immunity','okaleczenie')}



def armour_profile(fields):
    """Classify base armour coefficients; a dominant component is at least 75%."""
    try:
        physical=max(0,float(fields.get('Armor Defense Value','0') or 0))
        magical=max(0,float(fields.get('Magic Armor Value','0') or 0))
    except (TypeError,ValueError):return None
    total=physical+magical
    if total<=0:return None
    if physical*4>=total*3:return 'physical'
    if magical*4>=total*3:return 'magical'
    return 'balanced'


def effect_tags(fields,kind,lookup=lambda _: {},label=lambda _:None,seen=(),scales=False):
    tags=set();labels={}
    def add(tag,name=None):
        tags.add(tag)
        if name:labels[tag]=name
    if kind in ['Armor','Weapon','Potion']:
        for field,suffix in ATTRIBUTES.items():
            for candidate in [field,field+'Boost'] if field in ['Strength','Finesse','Intelligence','Constitution','Memory','Wits'] else [field]:
                try:
                    value=float(fields.get(candidate,'0'))
                    active=value>0 if suffix in WEAPON_ABILITIES else value!=0
                except ValueError:active=False
                if active:add(suffix)
        if kind=='Armor':
            profile=armour_profile(fields)
            if profile=='magical':tags.discard('Physical-Armour')
            elif profile=='physical':tags.discard('Magic-Armour')
        for element,(resist,damage) in ELEMENTS.items():
            field=element+'Resistance' if kind=='Potion' else element
            try:active=float(fields.get(field,'0'))!=0
            except ValueError:active=False
            if active:add(resist)
        if kind == 'Weapon' and fields.get('Damage Type') in ELEMENTS:
            add(ELEMENTS[fields['Damage Type']][1])
        # DOS2 weapons deal damage by the attribute they require.
        attribute=(fields.get('Requirements') or '').split(' ')[0]
        if kind == 'Weapon' and scales and attribute in SCALING:
            add('Scales-With-'+attribute,SCALING[attribute])
        for flag in fields.get('Flags','').split(';'):
            if flag.endswith('Immunity') and flag[:-8] in IMMUNITIES:
                tag,what=IMMUNITIES[flag[:-8]];add(tag,'Niewrażliwość na '+what)
        properties(fields.get('ExtraProperties',''),add,label)
    for field in ['RuneEffectWeapon','RuneEffectUpperbody','RuneEffectAmulet']:
        stat=fields.get(field)
        if stat and stat not in seen:
            nested=lookup(stat);sub,sub_labels=effect_tags(nested,'Weapon' if field=='RuneEffectWeapon' else 'Armor',lookup,label,(*seen,stat));tags.update(sub);labels.update(sub_labels)
    return sorted(tags),labels


def properties(raw,add,label):
    for prop in filter(None,raw.split(';')):
        parts=prop.split(',');status=parts[0]
        if status=='CreateSurface' and len(parts)>3:
            surface=parts[3]
            if surface in SURFACES:add(SURFACES[surface][0],'Powierzchnia: '+SURFACES[surface][1])
        else:
            status={'Poison':'POISONED','Slowed':'SLOWED','Diseased':'DISEASED'}.get(status,status.upper())
            name=label(status)
            if name:add(status,name[1])
