"""Save equipment subtypes and effect-based tags from item-effects-audit.json.
Run after export-item-effects.py. Does not create ingredient groups or aliases.
Tags are English leaf names; each item stores only its most specific tags, and the hierarchy
(data/recipeTagHierarchy.json) holds every parent.
"""
from collections import defaultdict
import json
from pathlib import Path
import runpy

ROOT=Path(__file__).resolve().parents[1]
rules=runpy.run_path(str(ROOT/'scripts/item-tag-rules.py'))
tree=runpy.run_path(str(ROOT/'scripts/tag_tree.py'))
key=runpy.run_path(str(ROOT/'scripts/export-item-icons.py'))['key']
GAME_MARKER={'dos1':'DOS1','dos2':'DOS2','dos2-overhaul':'DOS2-CO'}
SURFACE_TAGS={tag for tag,_ in rules['SURFACES'].values()}
STATS=set(rules['ATTRIBUTES'].values())


def kind(tag):
    if tag in SURFACE_TAGS:return 'surface'
    if tree['is_status'](tag,STATS):return 'status'
    return 'trait'


def main():
    audit=json.loads((ROOT/'reports/item-effects-audit.json').read_text(encoding='utf-8'))
    labels=json.loads((ROOT/'data/tagLabels.json').read_text(encoding='utf-8'))
    hierarchy=json.loads((ROOT/'data/recipeTagHierarchy.json').read_text(encoding='utf-8'))
    weapons=dict.fromkeys(tag for tag,_ in rules['WEAPONS'].values())
    armour=dict.fromkeys(tag for slot,(tag,_) in rules['SLOTS'].items() if slot not in ['Amulet','Ring','Belt'])
    for tag,name in [*rules['WEAPONS'].values(),*rules['SLOTS'].values()]:labels.setdefault(tag,name)
    effect_tags=set()
    for data_audit in audit['catalogs'].values():
        for item in data_audit['items']:
            for identity in item['identities']:effect_tags.update(identity['effect_tags'])
    # New effect tags get a readable label until the game localisation provides one.
    for tag in sorted(effect_tags|STATS):labels.setdefault(tag,tag.replace('-',' '))
    structural={'Weapons','Armour','Amulets','Rings','Belts'}
    # Effect, status and surface tags: anything the hierarchy files outside the item categories.
    is_property=lambda t: t in effect_tags or (t in tree['PARENTS'] and not tree['is_category'](t))
    pages=defaultdict(set);counts={}
    for game,data_audit in audit['catalogs'].items():
        by_name={item.get('data_key',key(item['name'])):item for item in data_audit['items']}
        path=ROOT/'data/library/recipes'/f'{game}.json';data=json.loads(path.read_text(encoding='utf-8'));changes=[]
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
                new=[t for t in new if not is_property(t)]
                new+=sorted(effects)
            types={tuple(m['type_tags']) for m in identities}
            resolved=list(next(iter(types))) if len(types)==1 else []
            if not resolved:
                candidates={rules['CATEGORY_TYPES'][c] for c in [*item.get('craftingCategories',[]),item.get('selectorTag','')] if c in rules['CATEGORY_TYPES']}
                if len(candidates)==1:resolved=[next(iter(candidates))]
            if resolved:
                # Structural type tags are replaced together, while material,
                # magic, seasonal and other independent roles are preserved.
                new=[t for t in new if not any(tree['within'](t,s) for s in structural)]
                new+=resolved
            if any(tree['is_category'](t) for t in new):
                new=[t for t in new if t not in tree['MARKERS']]+[GAME_MARKER[game]]
            new=tree['most_specific'](new)
            if before!=new:changes.append({'name':item['name'],'recipe':recipe_id,'before':before,'after':new})
            item['tags']=new
            if item.get('slug') and not item.get('selectorTag'):pages[item['slug']].update(new)
        for row in data['recipes']:
            refresh(row['result'],row['id'])
            for item in row['ingredients']:refresh(item)
            row['tags']=list(row['result']['tags'])
        for item in data.get('items',[]):refresh(item)
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
        counts[game]={'changed_references':len(changes),'changed_names':len({c['name'] for c in changes}),'changes':changes}
        print(game,counts[game]['changed_names'],'items tagged',flush=True)
    library_pages=runpy.run_path(str(ROOT/'scripts/library-pages.py'));library=library_pages['load_pages']()
    for slug,tags in pages.items():
        if slug in library:library[slug]['tags']=tree['most_specific'](sorted(tags))
    library_pages['save_pages'](library)
    roots={node['tag']:node for node in hierarchy['hierarchy']}
    for category in roots['Category']['children']:
        subtypes={'Weapons':weapons,'Armour':armour}.get(category['tag'])
        if subtypes is not None:
            current=[c['tag'] for c in category['children']]
            category['children']=[{'tag':t,'label':labels[t],'children':[]} for t in current+[t for t in subtypes if t not in current]]
    known=set(tree['load_parents'](hierarchy))
    for tag in sorted(effect_tags|STATS):
        if tag not in known and kind(tag)=='trait':roots['Other-Traits']['children'].append({'tag':tag,'label':labels[tag],'children':[]})
    for root,wanted in [('Statuses','status'),('Surfaces','surface')]:
        current=[c['tag'] for c in roots[root]['children']]
        found=sorted(t for t in effect_tags if kind(t)==wanted and t not in current)
        roots[root]['children']=[{'tag':t,'label':labels.get(t,t),'children':[]} for t in sorted(current+found)]
    def localize_nodes(nodes):
        for node in nodes:
            node['label']=labels.get(node['tag'],node.get('label',node['tag']))
            localize_nodes(node.get('children',[]))
    localize_nodes(hierarchy['hierarchy'])
    for file,data in [('data/tagLabels.json',labels),('data/recipeTagHierarchy.json',hierarchy),('reports/effect-tags-audit.json',{'scope':'Equipment types from game slot/WeaponType; property tags from verified game effects. Existing ingredient groups unchanged. Generic ambiguous ingredients use only properties common to all matching identities.','catalogs':counts})]:
        (ROOT/file).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')


if __name__=='__main__':main()
