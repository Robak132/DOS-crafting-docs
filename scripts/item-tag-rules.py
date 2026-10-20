"""Pure game-Stats to inventory/effect tag rules used by the offline exporters."""
import re

ATTRIBUTES = {
 'Strength':'Siła','Finesse':'Zręczność','Dexterity':'Zwinność','Intelligence':'Inteligencja',
 'Constitution':'Kondycja','Memory':'Pamięć','Wits':'Spryt','Perception':'Percepcja','Speed':'Szybkość',
 'Initiative':'Inicjatywa','AccuracyBoost':'Celność','ChanceToHitBoost':'Celność','CriticalChance':'Krytyk',
 'DodgeBoost':'Unik','ArmorBoost':'Pancerz-fizyczny','MagicArmorBoost':'Pancerz-magiczny',
 'Armor':'Pancerz-fizyczny','MagicArmor':'Pancerz-magiczny','Armor Defense Value':'Pancerz-fizyczny','Magic Armor Value':'Pancerz-magiczny',
 'VitalityBoost':'HP','Vitality':'Leczenie','VitalityPercentage':'Leczenie','DamageBoost':'Obrażenia',
 'Leadership':'Przywództwo','LuckyCharm':'Szczęście','Loremaster':'Znawca','Telekinesis':'Telekineza',
 'Sneaking':'Skradanie','Thievery':'Złodziejstwo','Bartering':'Handel','Persuasion':'Perswazja',
 'Lockpicking':'Otwieranie-zamków','Pickpocket':'Kradzież-kieszonkowa','Crafting':'Wytwarzanie','Blacksmithing':'Kowalstwo',
 'WaterSpecialist':'Hydrosophia','FireSpecialist':'Pyrokinetyka','AirSpecialist':'Aeroteurgia','EarthSpecialist':'Geomancja',
 'Necromancy':'Nekromancja','Summoning':'Przyzywanie','Polymorph':'Polimorfia','WarriorLore':'Wojna','RangerLore':'Łowiectwo','RogueLore':'Łobuz',
 'SingleHanded':'Jednoręczna','TwoHanded':'Dwuręczna','DualWielding':'Walka-dwoma-broniami','Ranged':'Dystansowa',
 'APRecovery':'Odnawianie-PA','APStart':'Początkowe-PA','APMaximum':'Maksymalne-PA',
 'BodyBuilding':'Krzepa','Willpower':'Siła-woli','Defense':'Obrona',
}
ELEMENTS={'Fire':('ogień','ognia'),'Water':('wodę','wody'),'Air':('powietrze','powietrza'),'Earth':('ziemię','ziemi'),'Poison':('truciznę','trucizny'),'Physical':('obrażenia-fizyczne','fizyczne'),'Piercing':('obrażenia-przeszywające','przeszywające'),'Shadow':('cień','cienia')}
WEAPONS={'Sword':('Miecze','Miecze'),'Axe':('Topory','Topory'),'Club':('Bulawy','Buławy i młoty'),'Mace':('Bulawy','Buławy i młoty'),'Dagger':('Sztylety','Sztylety'),'Knife':('Sztylety','Sztylety'),'Spear':('Wlocznie','Włócznie'),'Spears':('Wlocznie','Włócznie'),'Bow':('Luki','Łuki'),'Crossbow':('Kusze','Kusze'),'Staff':('Kostury','Kostury'),'Wand':('Rozdzki','Różdżki')}
SLOTS={'Helmet':('Helmy','Hełmy'),'Breast':('Napiersniki','Napierśniki'),'Chest':('Napiersniki','Napierśniki'),'Gloves':('Rekawice','Rękawice'),'Boots':('Buty','Buty'),'Leggings':('Spodnie','Spodnie'),'Shield':('Tarcze','Tarcze'),'Amulet':('Amulety','Amulety'),'Ring':('Pierscienie','Pierścienie'),'Belt':('Pasy','Pasy')}
CATEGORY_TYPES={
 'Sword':'Typ/Bron/Miecze','TwoHandedSword':'Typ/Bron/Miecze','Axe':'Typ/Bron/Topory','TwoHandedAxe':'Typ/Bron/Topory','Club':'Typ/Bron/Bulawy','Hammer':'Typ/Bron/Bulawy','TwoHandedMaces':'Typ/Bron/Bulawy','Dagger':'Typ/Bron/Sztylety','Knife':'Typ/Bron/Sztylety','Spear':'Typ/Bron/Wlocznie','Spears':'Typ/Bron/Wlocznie','Bow':'Typ/Bron/Luki','Bows':'Typ/Bron/Luki','Crossbow':'Typ/Bron/Kusze','Crossbows':'Typ/Bron/Kusze','Wand':'Typ/Bron/Rozdzki','Wands':'Typ/Bron/Rozdzki','Staff':'Typ/Bron/Kostury','Staves':'Typ/Bron/Kostury',
 'Helmet':'Typ/Pancerz/Helmy','Boots':'Typ/Pancerz/Buty','Gloves':'Typ/Pancerz/Rekawice','Leggings':'Typ/Pancerz/Spodnie','Pants':'Typ/Pancerz/Spodnie','Lowerbody':'Typ/Pancerz/Spodnie','Upperbody':'Typ/Pancerz/Napiersniki','UpperBody':'Typ/Pancerz/Napiersniki','Breast':'Typ/Pancerz/Napiersniki','Shield':'Typ/Pancerz/Tarcze','Shields':'Typ/Pancerz/Tarcze','Amulet':'Typ/Pancerz/Amulety','Ring':'Typ/Pancerz/Pierscienie','Belt':'Typ/Pancerz/Pasy',
}


def type_tags(fields,kind):
    slot=fields.get('Slot','');weapon=fields.get('WeaponType','')
    if slot=='Shield' or weapon=='Shield':return ['Typ/Pancerz','Typ/Pancerz/Tarcze']
    if kind=='Armor' and slot in ['Amulet','Ring','Belt']:return [{'Amulet':'Typ/Amulety','Ring':'Typ/Pierscienie','Belt':'Typ/Pasy'}[slot]]
    if kind=='Armor' and slot in SLOTS:return ['Typ/Pancerz','Typ/Pancerz/'+SLOTS[slot][0]]
    if kind=='Weapon' and weapon in WEAPONS:return ['Typ/Bron','Typ/Bron/'+WEAPONS[weapon][0]]
    return []


COMBAT_GROUPS = {'Bieglosci-broni': ['Jednoręczna', 'Dwuręczna', 'Walka-dwoma-broniami', 'Dystansowa'], 'Bieglosci-obrony': ['Przywództwo', 'Wytrwałość', 'Odbicie', 'Krzepa', 'Siła-woli', 'Obrona'], 'Umiejetnosci': ['Wojna', 'Łowiectwo', 'Łobuz', 'Pyrokinetyka', 'Hydrosophia', 'Geomancja', 'Aeroteurgia', 'Nekromancja', 'Przyzywanie', 'Polimorfia']}

def attribute_tag(suffix):
    for group, suffixes in COMBAT_GROUPS.items():
        if suffix in suffixes:return "Cechy/"+group+"/"+suffix
    return "Cechy/"+suffix

def combat_parents(tags):
    return ["Cechy/"+group for group in COMBAT_GROUPS if any(tag.startswith("Cechy/"+group+"/") for tag in tags)]


def damage_tag(suffix):
    return ('Cechy/Obrażenia-' if suffix in ['fizyczne', 'przeszywające'] else 'Cechy/Obrażenia-magiczne/') + suffix


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


def effect_tags(fields,kind,lookup=lambda _: {},label=lambda _:None,seen=()):
    tags=set();labels={}
    def add(tag,name=None):
        tags.add(tag)
        if name:labels[tag]=name
    if kind in ['Armor','Weapon','Potion']:
        for field,suffix in ATTRIBUTES.items():
            for candidate in [field,field+'Boost'] if field in ['Strength','Finesse','Intelligence','Constitution','Memory','Wits'] else [field]:
                try:
                    value=float(fields.get(candidate,'0'))
                    active=value>0 if suffix in COMBAT_GROUPS['Bieglosci-broni'] else value!=0
                except ValueError:active=False
                if active:add(attribute_tag(suffix))
        if kind=='Armor':
            profile=armour_profile(fields)
            if profile=='magical':tags.discard('Cechy/Pancerz-fizyczny')
            elif profile=='physical':tags.discard('Cechy/Pancerz-magiczny')
            elif profile=='balanced':add('Cechy/Pancerz-zbalansowany','Pancerz zbalansowany')
        for element,(resist,damage) in ELEMENTS.items():
            field=element+'Resistance' if kind=='Potion' else element
            try:active=float(fields.get(field,'0'))!=0
            except ValueError:active=False
            if active:add('Cechy/Odporność-na-'+resist)
        if kind=='Weapon':
            if fields.get('Damage Type') in ELEMENTS:add(damage_tag(ELEMENTS[fields['Damage Type']][1]))
        if float(fields.get('RuneSlots','0') or 0)>0:add('Cechy/Gniazda-run','Gniazda run')
        immunities={'Burn':'ogień','Burning':'ogień','Freeze':'zamrożenie','Frozen':'zamrożenie','Stun':'ogłuszenie','Stunned':'ogłuszenie','Blind':'oślepienie','Bleeding':'krwawienie','Acid':'kwas','Knockdown':'potrącenie','KnockedDown':'potrącenie','Slowed':'spowolnienie','Charm':'urok','Fear':'strach','Poison':'truciznę','Sleeping':'sen','Crippled':'okaleczenie'}
        for flag in fields.get('Flags','').split(';'):
            if flag.endswith('Immunity') and flag[:-8] in immunities:
                suffix=immunities[flag[:-8]];add('Cechy/Immunitet-na-'+suffix,'Niewrażliwość na '+suffix)
        properties(fields.get('ExtraProperties',''),add,label)
        if fields.get('Skills'):
            add('Cechy/Zapewnia-umiejetnosc','Zapewnia umiejętność')
    for field in ['RuneEffectWeapon','RuneEffectUpperbody','RuneEffectAmulet']:
        stat=fields.get(field)
        if stat and stat not in seen:
            nested=lookup(stat);sub,sub_labels=effect_tags(nested,'Weapon' if field=='RuneEffectWeapon' else 'Armor',lookup,label,(*seen,stat));tags.update(sub);labels.update(sub_labels)
    if any(tag.startswith('Cechy/Obrażenia-magiczne/') for tag in tags):add('Cechy/Obrażenia-magiczne','Obrażenia magiczne')
    tags.update(combat_parents(tags))
    return sorted(tags),labels


def properties(raw,add,label):
    for prop in filter(None,raw.split(';')):
        parts=prop.split(',');status=parts[0]
        if status=='CreateSurface' and len(parts)>3:
            surface=parts[3];names={'Fire':'Ogień','Water':'Woda','WaterFrozen':'Lód','Source':'Źródło','Poison':'Trucizna','Oil':'Olej','Blood':'Krew'}
            if surface in names:add('Efekty/Powierzchnie/'+surface,'Powierzchnia: '+names[surface])
        else:
            status={'Poison':'POISONED','Slowed':'SLOWED','Diseased':'DISEASED'}.get(status,status.upper())
            name=label(status)
            if name:add('Efekty/Statusy/'+status,name[1])
