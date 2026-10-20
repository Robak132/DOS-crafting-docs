"""Save equipment subtypes and effect-based tags from item-effects-audit.json.
Run after export-item-effects.py. Does not create ingredient groups or aliases.
"""
from collections import defaultdict, Counter
import json
from pathlib import Path
import runpy

ROOT=Path(__file__).resolve().parents[1]
rules=runpy.run_path(str(ROOT/'scripts/item-tag-rules.py'))
key=runpy.run_path(str(ROOT/'scripts/export-item-icons.py'))['key']


def main():
    audit=json.loads((ROOT/'reports/item-effects-audit.json').read_text())
    labels=json.loads((ROOT/'data/tagLabels.json').read_text())
    hierarchy=json.loads((ROOT/'data/recipeTagHierarchy.json').read_text())
    for slug,name in set(rules['WEAPONS'].values()):labels['Typ/Bron/'+slug]=name
    for slot,(slug,name) in rules['SLOTS'].items():
        if slot not in ['Amulet','Ring','Belt']:labels['Typ/Pancerz/'+slug]=name
    labels.update({'Cechy/Spryt':'Bystrość','Cechy/Zwinność':'Zwinność','Cechy/Umiejetnosci/Pyrokinetyka':'Pirokineza','Cechy/Umiejetnosci/Hydrosophia':'Hydrozofia','Cechy/Umiejetnosci/Aeroteurgia':'Aeroturgia'})
    # New numeric-property tags get human labels instead of falling back to IDs.
    for suffix in rules['ATTRIBUTES'].values():labels.setdefault(rules['attribute_tag'](suffix),suffix.replace('-',' '))
    for _,(_,damage) in rules['ELEMENTS'].items():labels.setdefault(rules['damage_tag'](damage),'Obrażenia od '+damage)
    labels.update({'Cechy/Krytyk':'Szansa na trafienie krytyczne','Cechy/Obrażenia':'Bonus obrażeń','Cechy/Odporność-na-obrażenia-fizyczne':'Odporność na obrażenia fizyczne','Cechy/Odporność-na-obrażenia-przeszywające':'Odporność na obrażenia przeszywające','Cechy/Obrażenia-fizyczne':'Obrażenia fizyczne','Cechy/Obrażenia-przeszywające':'Obrażenia przeszywające'})
    pages=defaultdict(set);counts={}
    for game,data_audit in audit['catalogs'].items():
        by_name={item.get('data_key',key(item['name'])):item for item in data_audit['items']}
        path=ROOT/'data/library/recipes'/f'{game}.json';data=json.loads(path.read_text());changes=[]
        def refresh(item,recipe_id=None):
            before=item['tags'];record=by_name.get(key(item.get('statsId') or item['name']));identities=record['identities'] if record and not item.get('selectorTag') else []
            if recipe_id and record:
                selected=record.get('recipe_stats',{}).get(recipe_id)
                narrowed=[m for m in identities if m['stats']==selected]
                if narrowed:identities=narrowed
            new=list(before)
            # Only replace property tags when we have a verified game identity.
            # Multiple variants contribute only their common properties to a
            # generic ingredient; each recipe result uses its own identity.
            if identities:
                effects=set.intersection(*(set(m['effect_tags']) for m in identities))
                for m in identities:labels.update(m['tag_labels'])
                new=[t for t in new if t!='Cechy' and not t.startswith(('Cechy/','Efekty/','Cechy-'))]
                new+=sorted(effects)
                if any(t.startswith('Cechy/') for t in new):new.append('Cechy')
            types={tuple(m['type_tags']) for m in identities}
            resolved=list(next(iter(types))) if len(types)==1 else []
            if not resolved:
                candidates={rules['CATEGORY_TYPES'][c] for c in [*item.get('craftingCategories',[]),item.get('selectorTag','')] if c in rules['CATEGORY_TYPES']}
                if len(candidates)==1:
                    leaf=next(iter(candidates));resolved=['/'.join(leaf.split('/')[:2]),leaf]
            if resolved:
                # Structural type tags are replaced together, while material,
                # magic, seasonal and other independent roles are preserved.
                new=[t for t in new if not (t in ['Typ/Bron','Typ/Pancerz','Typ/Amulety','Typ/Pierscienie','Typ/Pasy'] or t.startswith(('Typ/Bron/','Typ/Pancerz/')))]
                new+=resolved
            if any(t.startswith('Typ/') for t in new):
                new=[t for t in new if t not in ['DOS1','DOS2','DOS2-CO']]
                new+=['Typ',{'dos1':'DOS1','dos2':'DOS2','dos2-overhaul':'DOS2-CO'}[game]]
            new+=rules['combat_parents'](new)
            new=list(dict.fromkeys(new))
            if before!=new:changes.append({'name':item['name'],'recipe':recipe_id,'before':before,'after':new})
            item['tags']=new
            if item.get('slug') and not item.get('selectorTag'):pages[item['slug']].update(new)
        for row in data['recipes']:
            refresh(row['result'],row['id'])
            for item in row['ingredients']:refresh(item)
            row['tags']=list(row['result']['tags'])
        for item in data.get('items',[]):refresh(item)
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        counts[game]={'changed_references':len(changes),'changed_names':len({c['name'] for c in changes}),'changes':changes}
        print(game,counts[game]['changed_names'],'items tagged',flush=True)
    for slug,tags in pages.items():
        path=ROOT/'data/library/pages'/(slug+'.json')
        if path.exists():
            page=json.loads(path.read_text());page['tags']=sorted(tags);path.write_text(json.dumps(page,ensure_ascii=False,indent=2)+'\n')
    for node in hierarchy['hierarchy']:
        if node['tag']=='Typ':
            for category in node['children']:
                if category['tag'] in ['Typ/Bron','Typ/Pancerz']:
                    prefix=category['tag']+'/';category['label']=labels[category['tag']]
                    category['children']=[{'tag':t,'label':label,'children':[]} for t,label in labels.items() if t.startswith(prefix)]
    def all_tags(nodes):
        return {node['tag'] for node in nodes}|set().union(*(all_tags(node.get('children',[])) for node in nodes)) if nodes else set()
    known=all_tags(hierarchy['hierarchy']);extra=next(n for n in hierarchy['hierarchy'] if n['tag']=='Cechy-inne')
    for tag,label in sorted(labels.items()):
        if tag.startswith('Cechy/') and tag not in known:extra['children'].append({'tag':tag,'label':label,'children':[]})
    for prefix,title,root in [('Efekty/Statusy/','Nakładane statusy','Cechy-statusy'),('Efekty/Powierzchnie/','Tworzone powierzchnie','Cechy-powierzchnie')]:
        hierarchy['hierarchy']=[n for n in hierarchy['hierarchy'] if n['tag']!=root]
        hierarchy['hierarchy'].append({'tag':root,'label':title,'children':[{'tag':t,'label':v,'children':[]} for t,v in sorted(labels.items()) if t.startswith(prefix)]})
    def localize_nodes(nodes):
        for node in nodes:
            node['label']=labels.get(node['tag'],node.get('label',node['tag']))
            localize_nodes(node.get('children',[]))
    localize_nodes(hierarchy['hierarchy'])
    for file,data in [('data/tagLabels.json',labels),('data/recipeTagHierarchy.json',hierarchy),('reports/effect-tags-audit.json',{'scope':'Equipment types from game slot/WeaponType; property tags from verified game effects. Existing ingredient groups unchanged. Generic ambiguous ingredients use only properties common to all matching identities.','catalogs':counts})]:
        (ROOT/file).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':main()
