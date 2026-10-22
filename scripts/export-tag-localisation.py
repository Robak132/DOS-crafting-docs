"""Pair tag labels with official game localization by contentuid; keep game scopes.
Run: python3 scripts/export-tag-localisation.py
Saves data/tagLocalisation.json and reports/tag-localisation-audit.json.
"""
from collections import defaultdict
import json
from pathlib import Path
import runpy
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
effects=runpy.run_path(str(ROOT/'scripts/export-item-effects.py'))
rules=runpy.run_path(str(ROOT/'scripts/item-tag-rules.py'))
TERMS={
 'Typ/Bron':'Weapons','Typ/Pancerz':'Armour',
 'Typ/Bron/Miecze':'Swords','Typ/Bron/Topory':'Axes','Typ/Bron/Bulawy':'Maces','Typ/Bron/Sztylety':'Daggers','Typ/Bron/Wlocznie':'Spears','Typ/Bron/Luki':'Bows','Typ/Bron/Kusze':'Crossbows','Typ/Bron/Rozdzki':'Wands','Typ/Bron/Kostury':'Staff',
 'Typ/Pancerz/Helmy':'Helmet','Typ/Pancerz/Napiersniki':'Chest Armour','Typ/Pancerz/Rekawice':'Gloves','Typ/Pancerz/Spodnie':'Leggings','Typ/Pancerz/Buty':'Boots','Typ/Pancerz/Tarcze':'Shields',
 'Typ/Amulety':'Amulet','Typ/Pierscienie':'Ring','Typ/Pasy':'Belt',
}
for field,suffix in rules['ATTRIBUTES'].items():
 if field in effects['BONUSES']:TERMS[rules['attribute_tag'](suffix)]=effects['BONUSES'][field][0]
TERMS.update({'Cechy/HP':'Vitality','Cechy/Leczenie':'Healing','Cechy/Pancerz-fizyczny':'Physical Armour','Cechy/Pancerz-magiczny':'Magic Armour','Cechy/Umiejetnosci/Łowiectwo':'Huntsman','Cechy/Umiejetnosci/Nekromancja':'Necromancer','Cechy/Umiejetnosci/Wojna':'Warfare','Cechy/Umiejetnosci/Łobuz':'Scoundrel'})
PREFERRED={'Armour':'Pancerze','Boots':'Buty','Necromancer':'Nekromancja','Huntsman':'Myślistwo','Magic Armour':'Pancerz Magiczny'}


def main():
 labels=json.loads((ROOT/'data/tagLabels.json').read_text(encoding='utf-8'));data={};report={}
 for tag in labels:
  if tag.startswith('Efekty/Statusy/'):
   status=tag.rsplit('/',1)[-1]
   if status in effects['STATUSES']:TERMS[tag]=effects['STATUSES'][status][0]
 for game,enfiles,plfile in [
  ('dos1',[ROOT/'.pak-work/extracted/dos1-ee/reference/Localization/Reference'/name for name in ['DEFAULT.xml','UI.xml','UISKILLTREETEXTS.xml','STATUSHIT.xml','LOCALIZATION.xml']],ROOT/'.pak-work/extracted/dos1-ee/polish/Localization/Polish/polish.xml'),
  ('dos2',[ROOT/'.pak-work/icons/dos2/localization/English/english.xml'],ROOT/'.pak-work/extracted/polish/Localization/Polish/polish.xml')]:
  en={n.get('contentuid'):''.join(n.itertext()).strip() for p in enfiles for n in ET.parse(p).iter('content')};pl={n.get('contentuid'):''.join(n.itertext()).strip() for n in ET.parse(plfile).iter('content')}
  pairs=defaultdict(list)
  for handle,text in en.items():
   if text and pl.get(handle):pairs[text.casefold()].append((pl[handle],handle))
  data[game]={};report[game]=[]
  terms=dict(TERMS)
  if game=='dos1':
   terms.update({'Cechy/Zwinność':'Dexterity','Cechy/Szybkość':'Speed','Cechy/Percepcja':'Perception','Cechy/Umiejetnosci/Wojna':'Man-at-Arms','Cechy/Umiejetnosci/Łowiectwo':'Expert Marksman','Cechy/Umiejetnosci/Nekromancja':'Witchcraft'})
  for tag,term in terms.items():
   matches=pairs.get(term.casefold(),[]);choices={name for name,_ in matches}
   chosen=next(iter(choices)) if len(choices)==1 else PREFERRED.get(term) if PREFERRED.get(term) in choices else labels.get(tag) if labels.get(tag) in choices else None
   data[game][tag]={'en':term,**({'pl':chosen} if chosen else {})}
   report[game].append({'tag':tag,'en':term,'pl':chosen,'contentuid':[h for v,h in matches if v==chosen],'untranslated':chosen is None})
 data['dos2-overhaul']=dict(data['dos2'])
 (ROOT/'data/tagLocalisation.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
 (ROOT/'reports/tag-localisation-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
 print({g:sum('pl' in v for v in entries.values()) for g,entries in data.items()})


if __name__=='__main__':main()
