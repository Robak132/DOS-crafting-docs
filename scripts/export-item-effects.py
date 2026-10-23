"""Extract missing item effects from prepared DOS1 EE / DOS2 DE / Overhaul resources.
Run after npm run generate:data: python3 scripts/export-item-effects.py
Writes data/itemEffects.json and reports/item-effects-audit.json. Offline only;
Steam resources are not required for the application build or GitHub Actions.
"""
from collections import Counter, defaultdict
import json
from pathlib import Path
import re
import runpy
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]

# These are character-facing bonuses. Value, weight, durability, vendor levels,
# object immunities and damage coefficients are deliberately not character buffs.
BONUSES = {
 'ArmorBoost':('Physical armour','Pancerz fizyczny'), 'MagicArmorBoost':('Magic armour','Pancerz magiczny'),
 'StrengthBoost':('Strength','Siła'), 'FinesseBoost':('Finesse','Zręczność'), 'IntelligenceBoost':('Intelligence','Inteligencja'),
 'ConstitutionBoost':('Constitution','Kondycja'), 'MemoryBoost':('Memory','Pamięć'), 'WitsBoost':('Wits','Bystrość'),
 'Strength':('Strength','Siła'), 'Finesse':('Finesse','Zręczność'),
 'Dexterity':('Dexterity','Zwinność'), 'Intelligence':('Intelligence','Inteligencja'),
 'Constitution':('Constitution','Kondycja'), 'Wits':('Wits','Bystrość'),
 'Perception':('Perception','Percepcja'), 'Speed':('Speed','Szybkość'),
 'Initiative':('Initiative','Inicjatywa'), 'Memory':('Memory','Pamięć'),
 'Leadership':('Leadership','Przywództwo'), 'LuckyCharm':('Lucky Charm','Szczęście'),
 'Loremaster':('Loremaster','Znawca'), 'Telekinesis':('Telekinesis','Telekineza'),
 'Sneaking':('Sneaking','Skradanie'), 'Thievery':('Thievery','Złodziejstwo'),
 'Bartering':('Bartering','Handel'), 'Persuasion':('Persuasion','Perswazja'),
 'Lockpicking':('Lockpicking','Otwieranie zamków'), 'Pickpocket':('Pickpocketing','Kradzież kieszonkowa'),
 'Crafting':('Crafting','Wytwarzanie'), 'Blacksmithing':('Blacksmithing','Kowalstwo'),
 'WaterSpecialist':('Hydrosophist','Hydrozofia'), 'FireSpecialist':('Pyrokinetic','Pirokineza'),
 'AirSpecialist':('Aerotheurge','Aeroturgia'), 'EarthSpecialist':('Geomancer','Geomancja'),
 'Necromancy':('Necromancer','Nekromancja'), 'Summoning':('Summoning','Przywoływanie'),
 'Polymorph':('Polymorph','Polimorfia'), 'WarriorLore':('Warfare','Sztuka wojny'),
 'RangerLore':('Huntsman','Łowiectwo'), 'RogueLore':('Scoundrel','Szelmostwo'),
 'TwoHanded':('Two-Handed','Broń dwuręczna'), 'SingleHanded':('Single-Handed','Broń jednoręczna'),
 'DualWielding':('Dual Wielding','Walka dwiema broniami'), 'Ranged':('Ranged','Broń dystansowa'),
 'Defense':('Defence','Obrona'), 'BodyBuilding':('Body Building','Krzepa'), 'Willpower':('Willpower','Siła woli'),
 'AccuracyBoost':('Accuracy','Celność'), 'ChanceToHitBoost':('Chance to hit','Szansa trafienia'),
 'DodgeBoost':('Dodge','Unik'), 'CriticalChance':('Critical chance','Szansa na trafienie krytyczne'),
 'DamageBoost':('Damage','Obrażenia'), 'VitalityBoost':('Vitality','Żywotność'),
 'APRecovery':('AP recovery','Odnawianie PA'), 'APStart':('Starting AP','Początkowe PA'),
 'APMaximum':('Maximum AP','Maksymalne PA'),
}
PERCENT = {'AccuracyBoost','ChanceToHitBoost','DodgeBoost','CriticalChance','DamageBoost','VitalityBoost','ArmorBoost','MagicArmorBoost'}
ELEMENTS = {'Fire':('fire','ogień'),'Water':('water','wodę'),'Air':('air','powietrze'),'Earth':('earth','ziemię'),'Poison':('poison','truciznę'),'Physical':('physical','obrażenia fizyczne'),'Piercing':('piercing','obrażenia przeszywające'),'Shadow':('shadow','cień')}
DAMAGE_PL = {'Fire':'Obrażenia od ognia','Water':'Obrażenia od wody','Air':'Obrażenia od powietrza','Earth':'Obrażenia od ziemi','Poison':'Obrażenia od trucizny','Physical':'Obrażenia fizyczne','Piercing':'Obrażenia przeszywające','Shadow':'Obrażenia od cienia'}
STATUSES = {
 'WET':('Wet','Mokry'), 'BURNING':('Burning','Podpalenie'), 'POISONED':('Poisoned','Zatrucie'),
 'FROZEN':('Frozen','Zamrożenie'),'STUNNED':('Stunned','Ogłuszenie'),'KNOCKED_DOWN':('Knocked down','Powalenie'),
 'KNOCKDOWN':('Knocked down','Powalenie'),'CHARMED':('Charmed','Zauroczenie'),'BLEEDING':('Bleeding','Krwawienie'),
 'CRIPPLED':('Crippled','Okaleczenie'),'SLOWED':('Slowed','Spowolnienie'),'BLIND':('Blind','Oślepienie'),
 'FEAR':('Fear','Strach'),'SLEEPING':('Sleeping','Sen'),'INVISIBLE':('Invisible','Niewidzialność'),
 'HASTED':('Hasted','Przyspieszenie'),'HEALING':('Healing','Leczenie'),'RESTED':('Rested','Wypoczęcie'),
 'DRUNK':('Drunk','Upicie'),'WARM':('Warm','Ciepło'),'CHILLED':('Chilled','Wychłodzenie'),
 'FORTIFIED':('Fortified','Fortyfikacja'),'MAGIC_SHELL':('Magic Shell','Magiczna powłoka'),
 'CLEAR_MINDED':('Clear-minded','Jasność umysłu'),'DISEASED':('Diseased','Choroba'),
 'DECAYING_TOUCH':('Decaying','Rozkład'),'SILENCED':('Silenced','Uciszenie'),'PETRIFIED':('Petrified','Skamienienie'),
}


def number(value):
    try: return float(value)
    except (ValueError, TypeError): return 0


def render_effect(fields, kind, skill_name=lambda name: None, on_use=(), status_name=lambda name: None, skill_fields=lambda name: {}):
    """Only render known semantics; leave unresolved formulas and IDs in the audit."""
    result = [[], []]
    used = set()
    unknown = []
    def add(en, pl, field):
        result[0].append(en); result[1].append(pl); used.add(field)
    def properties(raw, field):
        for prop in filter(None, raw.split(';')):
            parts=prop.split(',');status=parts[0]
            status={'Poison':'POISONED','Slowed':'SLOWED','Diseased':'DISEASED'}.get(status,status.upper())
            if parts[0]=='CreateSurface' and len(parts)>3:
                surfaces={'Fire':('fire','ognistą'),'Water':('water','wodną'),'WaterFrozen':('ice','lodową'),'Poison':('poison','zatrutą'),'Oil':('oil','oleistą'),'Blood':('blood','krwawą'),'Source':('Source','Źródła')}
                if parts[3] in surfaces:
                    en,pl=surfaces[parts[3]];add('Creates a '+en+' surface','Tworzy powierzchnię '+pl,field);continue
            label=STATUSES.get(status) or status_name(status)
            if label:
                en,pl=label;chance=number(parts[1]) if len(parts)>1 else 0;duration=number(parts[2]) if len(parts)>2 else 0
                add(en+(f' ({chance:g}%)' if chance else '')+(f', turns: {duration:g}' if duration>0 else ''),pl+(f' ({chance:g}%)' if chance else '')+(f', tury: {duration:g}' if duration>0 else ''),field)
            else:unknown.append({'field':field,'value':prop})
    for rune_field,en_slot,pl_slot in [('RuneEffectWeapon','Weapon','Broń'),('RuneEffectUpperbody','Armour','Pancerz'),('RuneEffectAmulet','Amulet','Amulet')]:
        if not fields.get(rune_field):continue
        nested=dict(skill_fields(fields[rune_field]))
        damage=nested.pop('Damage Type',None)
        for field in ['RuneEffectWeapon','RuneEffectUpperbody','RuneEffectAmulet']:nested.pop(field,None)
        nested_effect,_,nested_unknown=render_effect(nested,'Weapon' if rune_field=='RuneEffectWeapon' else 'Armor',skill_name,status_name=status_name,skill_fields=skill_fields)
        if damage in ELEMENTS and number(nested.get('DamageFromBase')):
            amount=number(nested['DamageFromBase'])
            add(f'{en_slot}: +{amount:g}% {ELEMENTS[damage][0]} damage based on weapon damage',f'{pl_slot}: +{amount:g}% — '+DAMAGE_PL[damage].lower()+' (od obrażeń broni)',rune_field)
        if nested_effect:add(en_slot+': '+nested_effect['en'],pl_slot+': '+nested_effect['pl'],rune_field)
        unknown.extend(nested_unknown)
    active = kind in ['Armor','Weapon','Potion']
    if active:
        for field, labels in BONUSES.items():
            value = number(fields.get(field))
            if value:
                suffix = '%' if field in PERCENT else ''
                add(f'{value:+g}{suffix} {labels[0]}', f'{value:+g}{suffix} {labels[1]}', field)
        for element, labels in ELEMENTS.items():
            field = element + 'Resistance' if kind == 'Potion' else element
            value = number(fields.get(field))
            if value:add(f'{value:+g}% {labels[0]} resistance', f'{value:+g}% odporności na {labels[1]}', field)
        if kind == 'Potion':
            value = number(fields.get('VitalityPercentage'))
            if value:add(f'Restores {value:g}% vitality', f'Przywraca {value:g}% żywotności', 'VitalityPercentage')
            # Vitality/Armor/MagicArmor in Stats are scaling inputs, not the final
            # values shown by the game. Do not present 400 as 400 HP of healing.
            for field,en,pl in [('Vitality','Restores vitality','Przywraca żywotność'),('Armor','Grants physical armour','Zwiększa pancerz fizyczny'),('MagicArmor','Grants magic armour','Zwiększa pancerz magiczny')]:
                if number(fields.get(field))>0:add(en+' (amount scales with item level)',pl+'',field)
        if kind == 'Weapon' and fields.get('Damage Type') in ELEMENTS:
            en,pl=ELEMENTS[fields['Damage Type']]
            add(f'Deals {en} damage (scales with item level)',DAMAGE_PL[fields['Damage Type']]+'','Damage Type')
        if kind == 'Armor':
            for field,en,pl in [('Armor Defense Value','Physical armour','Pancerz fizyczny'),('Magic Armor Value','Magic armour','Pancerz magiczny')]:
                if number(fields.get(field))>0:add(en+' (scales with item level)',pl+'',field)
        slots=number(fields.get('RuneSlots'))
        if slots>0:add(f'Rune slots: {slots:g}',f'Gniazda run: {slots:g}','RuneSlots')
        for flag in fields.get('Flags','').split(';'):
            if flag.endswith('Immunity'):
                name=re.sub(r'(?<!^)(?=[A-Z])',' ',flag[:-8])
                label=STATUSES.get(flag[:-8].upper(),(name,name))
                add('Immune to '+label[0],'Niewrażliwość: '+label[1],'Flags')
        properties(fields.get('ExtraProperties',''),'ExtraProperties')
    for skill in filter(None,fields.get('Skills','').split(';')) if kind in ['Armor','Weapon'] else []:
        name=skill_name(skill)
        if name:add('Grants skill: '+name[0],'Zapewnia umiejętność: '+name[1],'Skills')
        else:unknown.append({'field':'Skills','value':skill})
    for action in on_use:
        if action.get('SkillID'):
            skill=skill_name(action['SkillID'])
            if skill:
                verb=('Teaches skill: ','Uczy umiejętności: ') if action.get('ActionType')=='13' else ('Use: ','Użycie: ')
                add(verb[0]+skill[0],verb[1]+skill[1],'OnUseActions')
                if action.get('ActionType')!='13':
                    action_fields=skill_fields(action['SkillID'])
                    properties(action_fields.get('SkillProperties',''),'OnUseSkillProperties')
                    damage=action_fields.get('DamageType')
                    if damage in ELEMENTS:
                        add('Deals '+ELEMENTS[damage][0]+' damage (scales with level)',DAMAGE_PL[damage]+' (wartość zależy od poziomu)','OnUseDamageType')
            else:unknown.append({'field':'OnUseActions','value':action['SkillID']})
    duration=number(fields.get('Duration'))
    if result[0] and kind=='Potion' and duration>0 and used - {'ExtraProperties','OnUseActions','OnUseSkillProperties'}:add(f'Duration: {duration:g} turns',f'Czas trwania: {duration:g} tur','Duration')
    return ({'en':'; '.join(dict.fromkeys(result[0])),'pl':'; '.join(dict.fromkeys(result[1]))} if result[0] else None), sorted(used), unknown


def action_index(directories):
    actions={}
    for directory in directories:
        for file in sorted(directory.rglob('*.lsx')):
            if '/RootTemplates/' not in str(file):continue
            for node in ET.parse(file).findall('.//node[@id="GameObjects"]'):
                attrs={a.get('id'):a.get('value','') for a in node.findall('attribute')}
                found=[]
                for section in ['OnUsePeaceActions','OnUseActions']:
                    for action in node.findall(f'./children/node[@id="{section}"]/children/node[@id="Action"]'):
                        values={a.get('id'):a.get('value','') for a in action.findall('attribute')+action.findall('./children/node[@id="Attributes"]/attribute')}
                        found.append(values)
                if found:actions[attrs['MapKey']]=found
    return actions


def main():
    helpers=runpy.run_path(str(ROOT/'scripts/audit-recipes.py')); key=helpers['key']; plain=helpers['plain']
    recipe_audit=json.loads((ROOT/'reports/recipe-audit.json').read_text(encoding='utf-8'))
    provenance=json.loads((ROOT/'data/itemIcons.provenance.json').read_text(encoding='utf-8'))
    tag_rules=runpy.run_path(str(ROOT/'scripts/item-tag-rules.py'))
    tag_localisation=json.loads((ROOT/'data/tagLocalisation.json').read_text(encoding='utf-8'))
    base_statuses=dict(STATUSES)
    output={}; report={'scope':'All concrete recipe results and ingredients, including items with existing recipe effects; Stats are also used as the base for property tags. DOS1 EE / DOS2 DE + patches / DOS2 DE + Crafting Overhaul. Known groups and upgrade labels excluded. Unknown identities and unsupported effects remain unresolved; stat scaling coefficients are never shown as final HP, damage or armour values.','catalogs':{}}
    # Pair official localized skill names by string handle; no invented translations.
    translations={}
    for game,enfile,plfile in [('dos1','.pak-work/icons/dos1/Localization/Reference/DEFAULT.xml','.pak-work/extracted/dos1-ee/polish/Localization/Polish/polish.xml'),('dos2','.pak-work/icons/dos2/localization/English/english.xml','.pak-work/extracted/polish/Localization/Polish/polish.xml')]:
        en={n.get('contentuid'):''.join(n.itertext()) for n in ET.parse(ROOT/enfile).iter('content')};pl={n.get('contentuid'):''.join(n.itertext()) for n in ET.parse(ROOT/plfile).iter('content')}
        translations[game]={plain(v):plain(pl[k]) for k,v in en.items() if k in pl}
    for game,layers in [('dos1',['dos1']),('dos2',['dos2']),('dos2-overhaul',['dos2','overhaul'])]:
        for status,original in base_statuses.items():
            entry=tag_localisation[game].get(status)
            STATUSES[status]=(original[0],(entry.get('pl') or entry['en']) if entry else original[1])
        index=helpers['GameIndex'](layers);directories=[ROOT/'.pak-work/icons'/layer for layer in layers]
        # Read the same DE patch order as GameIndex. Restrict optional modules.
        if game!='dos1':
            for directory in [ROOT/'.pak-work/audit-current/dos2',*sorted((ROOT/'.pak-work/audit-current').glob('dos2-Patch*'),key=lambda p:int(re.search(r'Patch(\d+)',p.name)[1]))]:
                directories += sorted((directory/'Public').glob('*'),key=lambda p:p.name!='Shared')
        kinds={}
        for directory in directories:
            for file in sorted(directory.rglob('*.txt')):
                if '/Stats/Generated/' not in str(file):continue
                for stat,kind in re.findall(r'^new entry "([^"\r\n]+)"\s+type "([^"\r\n]+)"',file.read_text(encoding='utf-8-sig'),re.M):kinds[stat]=kind
        actions=action_index(directories[:len(layers)])
        template_by_stats=defaultdict(list)
        for template in index.templates.values():
            resolved=index.template(template)
            if resolved.get('Stats'):template_by_stats[resolved['Stats']].append(resolved)
        def kind_for(stat,seen=()):
            if stat in seen:return ''
            return kinds.get(stat) or kind_for(index.stats.get(stat,{}).get('parent'),(*seen,stat)) if stat else ''
        def skill_name(stat):
            fields=index.fields(stat);raw=index.strings.get(fields.get('DisplayName')) or fields.get('DisplayNameRef','').strip('|')
            if not raw or raw==fields.get('DisplayName') and '_' in raw:return None
            name=plain(raw);return name,translations['dos1' if game=='dos1' else 'dos2'].get(name,name)
        data=json.loads((ROOT/'dist/data'/f'catalog-{game}.json').read_text(encoding='utf-8'))
        existing={key(row['result']['name']) for row in data['recipes'] if row.get('notes','').strip() not in ['','-']}
        items={key(i.get('statsId') or i['name']):i for row in data['recipes'] for i in [row['result'],*row['ingredients']] if not i.get('selectorTag') and not i.get('groupId') and 'Upgrades' not in i['tags']}
        verified_outputs=defaultdict(set)
        verified_recipes=defaultdict(dict)
        current_ids={row['id'] for row in data['recipes']}
        for finding in recipe_audit['catalogs'][game]['findings']:
            if finding['status']=='matched' and finding['id'] in current_ids:
                for evidence in finding['evidence']:
                    if len(evidence['outputs'])==1:
                        verified_outputs[key(finding['result'])].add(evidence['outputs'][0]['stats'])
                        verified_recipes[key(finding['result'])][finding['id']]=evidence['outputs'][0]['stats']
        output[game]={};audit=[]
        for item_key,item in sorted(items.items()):
            ev=provenance.get(game,{}).get(item_key,{})
            ids={item['statsId']} if item.get('statsId') else {ev['stats']} if ev.get('stats') else set(index.names.get(item_key,set()))
            if not item.get('statsId') and not ev.get('stats') and ev.get('template') in index.templates:ids={index.template(index.templates[ev['template']]).get('Stats')} - {None,''}
            if not item.get('statsId') and not ev.get('stats') and not ev.get('template') and len(verified_outputs[item_key])==1:
                ids=set(verified_outputs[item_key])
            ids={stat for stat in ids if index.stats.get(stat,{}).get('kind')=='entry'}
            # A recipe label can also be a status name or a combination ID.
            # Prefer actual inventory templates, corroborated by the saved icon.
            inventory_ids={stat for stat in ids if any(t.get('Type','item')=='item' and (not ev.get('icon') or t.get('Icon')==ev['icon']) for t in template_by_stats.get(stat,[]))}
            if inventory_ids:ids=inventory_ids
            matches=[]
            for stat in sorted(ids):
                fields=index.fields(stat);kind=kind_for(stat)
                roots=template_by_stats.get(stat,[])
                if fields.get('RootTemplate') in index.templates:roots=[index.template(index.templates[fields['RootTemplate']])]
                if ev.get('template') in index.templates:roots=[index.template(index.templates[ev['template']])]
                action_sets=[]
                for template in roots:
                    action_sets.append(actions.get(template['MapKey'],[]))
                on_use=action_sets[0] if action_sets and all(a==action_sets[0] for a in action_sets) else []
                effect,used,unknown=render_effect(fields,kind,skill_name,on_use,skill_name,index.fields)
                if effect:
                    for field,(_,old_label) in BONUSES.items():
                        suffix=tag_rules['ATTRIBUTES'].get(field)
                        localized=tag_localisation[game].get(suffix) if suffix else None
                        if localized:
                            new_label=localized.get('pl') or localized['en']
                            effect['pl']=re.sub(r'([+-]\d+(?:\.\d+)?%? )'+re.escape(old_label)+r'(?!\w)',lambda m:m[1]+new_label,effect['pl'])
                tags,tag_labels=tag_rules['effect_tags'](fields,kind,index.fields,lambda status: STATUSES.get(status) or skill_name(status))
                for action in on_use:
                    skill=action.get('SkillID')
                    if not skill:continue
                    field='Teaches-Skill' if action.get('ActionType')=='13' else 'Casts-Spell'
                    tags.append(field);tag_labels[field]='Uczy umiejętności' if action.get('ActionType')=='13' else 'Rzuca zaklęcie'
                    schools={'Fire':'Pyrokinetic','Water':'Hydrosophist','Air':'Aerotheurge','Earth':'Geomancer','Necromancy':'Necromancer','Summoning':'Summoning','Polymorph':'Polymorph','Warrior':'Warfare','Ranger':'Huntsman','Rogue':'Scoundrel'}
                    ability=index.fields(skill).get('Ability')
                    if ability in schools:tags.append(schools[ability])
                    if action.get('ActionType')!='13':
                        def add_action(tag,name=None):
                            tags.append(tag)
                            if name:tag_labels[tag]=name
                        tag_rules['properties'](index.fields(skill).get('SkillProperties',''),add_action,lambda status: STATUSES.get(status) or skill_name(status))
                matches.append({'stats':stat,'type':kind,'effect':effect,'effect_tags':sorted(set(tags)),'tag_labels':tag_labels,'type_tags':tag_rules['type_tags'](fields,kind),'fields':{k:fields[k] for k in used if k in fields},'on_use':on_use,'unhandled':unknown})
            effects={json.dumps(m['effect'],sort_keys=True,ensure_ascii=False) for m in matches}
            effect=matches[0]['effect'] if len(effects)==1 else None
            status='exported' if effect else 'identity_unresolved' if not matches else 'ambiguous_effects' if len(effects)>1 else 'no_supported_effect'
            if effect:output[game][item_key]=effect
            elif len(effects)>1:
                by_stat={m['stats']:m['effect'] for m in matches}
                variants={recipe_id:by_stat[stat] for recipe_id,stat in verified_recipes[item_key].items() if by_stat.get(stat)}
                if variants:
                    output[game][item_key]={'recipes':variants}
                    status='exported_per_recipe'

            audit.append({'data_key':item_key,'name':item['name'],'had_recipe_effect':item_key in existing,'recipe_stats':verified_recipes[item_key],'status':status,'identities':matches})
        counts=dict(Counter(r['status'] for r in audit));report['catalogs'][game]={'total_items':len(items),'already_has_recipe_effect':len(set(items)&existing),'audited_items':len(audit),'audited_without_effect':len(audit)-len(set(items)&existing),'summary':counts,'items':audit}
        print(game,counts,flush=True)
    (ROOT/'data/itemEffects.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
    (ROOT/'reports/item-effects-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')


if __name__=='__main__':main()
