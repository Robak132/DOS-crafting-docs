"""Export inventory descriptions from the same converted resources as icons.
Usage: python3 scripts/export-item-descriptions.py RESOURCES DOS1_POLISH_XML DOS2_POLISH_XML
Not required for building or deployment. Polish strings are paired by contentuid.
"""
import html
import json
import re
import runpy
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
helpers = runpy.run_path(str(ROOT / 'scripts/export-item-icons.py'))


def plain(value):
    value = html.unescape(value)
    value = re.sub(r'<br\s*/?>', '\n', value, flags=re.I)
    return re.sub(r'<[^>]+>', '', value).strip()


def collect_descriptions(templates, strings, translations, provenance=None, stats=None, catalog_stats=None):
    """Use inventory names first, after removing game rich-text markup."""
    def inherit(template, seen=None):
        seen = set() if seen is None else seen
        parent = template.get('ParentTemplateId')
        if parent in templates and parent not in seen:
            seen.add(parent)
            resolved = {**inherit(templates[parent], seen), **{k: v for k, v in template.items() if v}}
            for field in ['DisplayName', 'Description']:
                if template.get(field) and not template.get(field + 'Handle'):
                    resolved.pop(field + 'Handle', None)
            return resolved
        return template

    provenance = provenance or {}
    stats = stats or {}
    def root_for(stat, seen=None):
        seen = set() if seen is None else seen
        if stat in seen:
            return None
        seen.add(stat)
        entry = stats.get(stat, {})
        return entry.get('fields', {}).get('RootTemplate') or root_for(entry.get('parent'), seen)
    primary, fallback = defaultdict(set), defaultdict(set)
    identities = {field: defaultdict(set) for field in ['template', 'stats', 'icon']}
    for template in templates.values():
        item = inherit(template)
        if item.get('Type', 'item') != 'item':
            continue
        english = plain(item.get('Description') or strings.get(item.get('DescriptionHandle'), ''))
        if not english:
            continue
        polish = plain(translations.get(item.get('DescriptionHandle'), ''))
        candidate = (english, polish, template.get('MapKey', ''), item.get('Stats', ''), item.get('Icon', ''))
        for field, index in [('template', 2), ('stats', 3), ('icon', 4)]:
            if candidate[index]:
                identities[field][candidate[index]].add(candidate)
        display = item.get('DisplayName') or strings.get(item.get('DisplayNameHandle'), '')
        display_key = helpers['key'](plain(display)) if display else ''
        for name, target in [(display, primary), (strings.get(item.get('Stats')), fallback), (strings.get(item.get('Name')), fallback)]:
            if name:
                normalized = helpers['key'](plain(name))
                # Stats labels can name a different item (e.g. Phase Capacitor
                # retains Eternal Artefact's Stats label).
                if normalized and (target is primary or not display_key or normalized == display_key):
                    target[normalized].add(candidate)
    output = {}
    for name in sorted(primary.keys() | fallback.keys() | provenance.keys()):
        candidates = primary.get(name, fallback.get(name, set()))
        if not candidates or len({candidate[0] for candidate in candidates}) > 1:
            evidence = provenance.get(name, {})
            pool = primary.get(name, set()) | fallback.get(name, set())
            if not pool:
                for field in ['template', 'stats', 'icon']:
                    if evidence.get(field):
                        pool = identities[field].get(evidence[field], set())
                        if pool:
                            break
            verified = False
            for field, index in [('template', 2), ('stats', 3), ('icon', 4)]:
                if evidence.get(field):
                    matching = {candidate for candidate in pool if candidate[index] == evidence[field]}
                    if matching:
                        pool = matching
                        verified = True
            stat_ids = {evidence['stats']} if evidence.get('stats') else {candidate[3] for candidate in pool if candidate[3]}
            if len(stat_ids) == 1:
                root = root_for(next(iter(stat_ids)))
                canonical = {candidate for candidate in pool if root and candidate[2] == root}
                if canonical:
                    pool = canonical
                    verified = True
            if verified:
                candidates = pool
        english = {candidate[0] for candidate in candidates}
        polish = {candidate[1] for candidate in candidates if candidate[1]}
        if len(english) == 1:
            output[name] = {'en': next(iter(english)), **({'pl': next(iter(polish))} if len(polish) == 1 else {})}
    # Catalog items with a game Stats ID are described by that entry, preferring its root template.
    for stat, name in (catalog_stats or {}).items():
        pool = identities['stats'].get(stat, set())
        root = root_for(stat)
        pool = {candidate for candidate in pool if candidate[2] == root} or pool
        english = {candidate[0] for candidate in pool}
        polish = {candidate[1] for candidate in pool if candidate[1]}
        if len(english) == 1:
            output[helpers['key'](stat)] = {'en': next(iter(english)), **({'pl': next(iter(polish))} if len(polish) == 1 else {})}
        elif name and helpers["key"](name) in output:
            # The entry alone is not conclusive: use its name's, which no other catalog item shares.
            output[helpers['key'](stat)] = output[helpers['key'](name)]
    return dict(sorted(output.items()))


def catalog_stats(game):
    """Stats IDs that key catalog items (see assignDataKeys), each with its name key when no
    other catalog item carries that name. Reads the generated catalog (npm run generate:data)."""
    catalog = json.loads((ROOT / 'dist/data' / f'catalog-{game}.json').read_text(encoding='utf-8'))
    items = [item for row in catalog['recipes'] for item in [row['result'], *row.get('extraResults', []), *row['result'].get('pool', []), *row['ingredients']]]
    items += [member for group in catalog.get('groups', {}).values() for member in group['members']]
    keys_by_name = defaultdict(set)
    for item in items:
        if not item.get('selectorTag'):
            keys_by_name[helpers['key'](item['name'])].add(item.get('dataKey') or helpers['key'](item['name']))
    found = {}
    for item in items:
        stats = item.get('statsId')
        if stats and item.get('dataKey') == helpers['key'](stats):
            name_key = helpers['key'](item['name'])
            found[stats] = name_key if keys_by_name[name_key] == {item['dataKey']} else None
    return dict(sorted(found.items()))


def main():
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    source = Path(sys.argv[1])
    translations = {}
    for game, file in zip(['dos1', 'dos2'], sys.argv[2:]):
        translations[game] = {e.get('contentuid'): ''.join(e.itertext()) for e in ET.parse(file).iter('content')}
    provenance = json.loads((ROOT / 'data/itemIcons.provenance.json').read_text(encoding='utf-8'))
    resources = {game: helpers['resources'](source / game) for game in ['dos1', 'dos2', 'overhaul']}
    output = {}
    for game in ['dos1', 'dos2', 'dos2-overhaul']:
        layers = ['dos1'] if game == 'dos1' else ['dos2', 'overhaul'] if game == 'dos2-overhaul' else ['dos2']
        templates, strings, stats = {}, {}, {}
        for layer in layers:
            _, tt, ss = resources[layer]
            templates.update(tt); strings.update(ss)
            stats.update(helpers['stat_entries'](source / layer))
            if layer == 'dos2':
                current = ROOT / '.pak-work/audit-current'
                for directory in [current / 'dos2', *sorted(current.glob('dos2-Patch*'), key=lambda p: int(re.search(r'Patch(\d+)', p.name)[1]))]:
                    for module in sorted((directory / 'Public').glob('*'), key=lambda p: p.name != 'Shared'):
                        stats.update(helpers['stat_entries'](module))
        output[game] = collect_descriptions(templates, strings, translations['dos1' if game == 'dos1' else 'dos2'], provenance.get(game, {}), stats, catalog_stats(game))
        print(game, len(output[game]), 'descriptions')
    (ROOT / 'data/itemDescriptions.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
