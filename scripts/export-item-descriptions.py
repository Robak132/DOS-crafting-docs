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
    return html.unescape(re.sub(r'<[^>]+>', '', value)).strip()


def main():
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    source = Path(sys.argv[1])
    translations = {}
    for game, file in zip(['dos1', 'dos2'], sys.argv[2:]):
        translations[game] = {e.get('contentuid'): ''.join(e.itertext()) for e in ET.parse(file).iter('content')}
    resources = {game: helpers['resources'](source / game) for game in ['dos1', 'dos2', 'overhaul']}
    output = {}
    for game in ['dos1', 'dos2', 'dos2-overhaul']:
        layers = ['dos1'] if game == 'dos1' else ['dos2', 'overhaul'] if game == 'dos2-overhaul' else ['dos2']
        templates, strings = {}, {}
        for layer in layers:
            _, tt, ss = resources[layer]
            templates.update(tt); strings.update(ss)
        def inherit(a, seen=None):
            seen = set() if seen is None else seen
            parent = a.get('ParentTemplateId')
            if parent in templates and parent not in seen:
                seen.add(parent)
                return {**inherit(templates[parent], seen), **{k: v for k, v in a.items() if v}}
            return a
        candidates = defaultdict(set)
        for template in templates.values():
            a = inherit(template)
            if a.get('Type', 'item') != 'item' or not a.get('Description'):
                continue
            english = plain(a['Description'])
            polish = plain(translations['dos1' if game == 'dos1' else 'dos2'].get(a.get('DescriptionHandle'), ''))
            for name in [a.get('DisplayName'), strings.get(a.get('Stats')), strings.get(a.get('Name'))]:
                if name and english:
                    candidates[helpers['key'](name)].add((english, polish))
        output[game] = {key: {'en': next(iter(values))[0], **({'pl': next(iter(values))[1]} if next(iter(values))[1] else {})} for key, values in sorted(candidates.items()) if len(values) == 1}
        print(game, len(output[game]), 'descriptions')
    (ROOT / 'data/itemDescriptions.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
