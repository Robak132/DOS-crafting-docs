"""Read-only recipe audit against locally extracted DOS1 EE / DOS2 DE / Workshop definitions.
Usage: python3 scripts/audit-recipes.py [--output reports/recipe-audit]
Requires the prepared .pak-work/icons resources and freshly extracted
.pak-work/audit-current ItemCombos files. Never modifies catalog data.
"""
import argparse
from collections import Counter, defaultdict
from functools import lru_cache
import hashlib
import itertools
import json
from pathlib import Path
import re
import runpy

ROOT = Path(__file__).resolve().parents[1]
helpers = runpy.run_path(str(ROOT / 'scripts/export-item-icons.py'))
key = helpers['key']
plain = helpers['plain_name']

def blocks(file):
    text = file.read_text(encoding='utf-8-sig')
    markers = list(re.finditer(r'^new (\w+) "([^"\r\n]+)"', text, re.M))
    for i, marker in enumerate(markers):
        body = text[marker.end():markers[i + 1].start() if i + 1 < len(markers) else len(text)]
        yield marker[1], marker[2], dict(re.findall(r'^data "([^"]+)" "([^"\r\n]*)"', body, re.M)), str(file.relative_to(ROOT)), text[:marker.start()].count('\n') + 1

class GameIndex:
    def __init__(self, layers):
        self.templates, self.strings, self.stats = {}, {}, {}
        for layer in layers:
            directory = ROOT / '.pak-work/icons' / layer
            _, templates, strings = helpers['resources'](directory)
            self.templates.update(templates); self.strings.update(strings)
            self.stats.update(helpers['stat_entries'](directory))
            if layer == 'dos2':
                current = ROOT / '.pak-work/audit-current'
                for resource in [current / 'dos2', *sorted(current.glob('dos2-Patch*'), key=lambda p: int(re.search(r'Patch(\d+)', p.name)[1]))]:
                    for module in sorted((resource / 'Public').glob('*'), key=lambda p: p.name != 'Shared'):
                        self.stats.update(helpers['stat_entries'](module))
        self.names, self.categories = defaultdict(set), defaultdict(set)
        self.stat_names = defaultdict(set)
        for stat in self.stats:
            name = self.strings.get(stat)
            if name:
                self.names[key(plain(name))].add(stat); self.stat_names[stat].add(plain(name))
            for field in ['ComboCategory', 'ObjectCategory']:
                self.categories[stat].update(key(x.strip()) for x in re.split(r'[,;]', self.fields(stat).get(field, '')) if x.strip())
        for template in self.templates.values():
            resolved = self.template(template)
            stat = resolved.get('Stats')
            name = self.strings.get(resolved.get('DisplayNameHandle'), resolved.get('DisplayName'))
            if stat and name:
                self.names[key(plain(name))].add(stat); self.stat_names[stat].add(plain(name))
        # A generated Stats entry may spawn a template whose own Stats ID differs.
        for stat in self.stats:
            root = self.fields(stat).get('RootTemplate')
            if root in self.templates:
                template = self.template(self.templates[root])
                name = self.strings.get(template.get('DisplayNameHandle'), template.get('DisplayName'))
                if name:
                    self.names[key(plain(name))].add(stat); self.stat_names[stat].add(plain(name))
        self.category_names = defaultdict(set)
        for layer in layers:
            for file in (ROOT / '.pak-work/icons' / layer).rglob('ObjectCategoriesItemComboPreviewData.txt'):
                for kind, name, fields, _, _ in blocks(file):
                    if fields.get('Category') and fields.get('Tooltip'):
                        self.category_names[key(self.strings.get(fields['Tooltip'], fields['Tooltip']))].add(key(fields['Category']))
        self.combos, self.stations = {}, {}
        self.resolved, self.fit_cache = {}, {}

    @lru_cache(None)
    def fields(self, stat, chain=()):
        if stat in chain: return {}
        entry = self.stats.get(stat, {})
        parent = entry.get('parent')
        return {**(self.fields(parent, chain + (stat,)) if parent else {}), **entry.get('fields', {})}

    def template(self, template, chain=()):
        parent = template.get('ParentTemplateId')
        return {**(self.template(self.templates[parent], chain + (parent,)) if parent in self.templates and parent not in chain else {}), **{k: v for k, v in template.items() if v}}

    def item_ids(self, item, provenance):
        name_key = key(item['name'])
        if name_key in self.resolved: return self.resolved[name_key]
        ids = set(self.names[name_key])
        evidence = provenance.get(key(item['name']), {})
        if evidence.get('stats'): ids.add(evidence['stats'])
        template = self.templates.get(evidence.get('template'))
        if template and template.get('Stats'): ids.add(template['Stats'])
        self.resolved[name_key] = ids
        return ids

    def add_dos2(self, directory, optional=False):
        results = {}
        for file in sorted(directory.rglob('*ItemCombo*.txt')):
            # Gift Bag modules are optional and not part of the default catalogs.
            if not optional and not any('/' + module + '/' in file.as_posix() for module in ['Shared', 'DivinityOrigins_1301db3d-1f54-4e98-9be5-5094030916e4', 'Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117']): continue
            for kind, name, fields, source, line in blocks(file):
                if kind == 'ItemCombination':
                    self.combos[name] = {'id': name, 'fields': fields, 'file': source, 'line': line, 'outputs': []}
                elif kind == 'ItemCombinationResult':
                    results[name] = fields
                    result_stats = fields.get('Result 1')
                    tooltip = fields.get('PreviewTooltip')
                    if result_stats and tooltip and not fields.get('Result 2'):
                        display = plain(self.strings.get(tooltip, tooltip))
                        self.names[key(display)].add(result_stats)
                        self.stat_names[result_stats].add(display)
                elif kind == 'CraftingPreviewData' and fields.get('Station'):
                    self.stations[fields['Station']] = fields.get('StatsID', '')
        # Patches may replace only a result, so retain the previous combination body.
        for name, fields in results.items():
            parent = re.sub(r'_\d+$', '', name)
            if parent in self.combos:
                combo = self.combos[parent]
                combo.setdefault('result_blocks', {})[name] = fields
        for combo in self.combos.values():
            combo['outputs'] = [(f[f'Result {i}'], int(f.get(f'ResultAmount {i}', '1'))) for f in combo.get('result_blocks', {}).values() for i in range(1, 5) if f.get(f'Result {i}')]

    def add_dos1(self, directory):
        for file in sorted(directory.rglob('ItemCombos.txt')):
            text = file.read_text(encoding='utf-8-sig')
            transforms = dict(re.findall(r'start transform code (\w+)\n(.*?)end transform code', text, re.S))
            for number, line in enumerate(text.splitlines(), 1):
                m = re.match(r'use (object|category) (\S+) on (object|category) (\S+) with transform code (\w+) parameters (\S+)(.*)', line)
                if not m: continue
                kind1, obj1, kind2, obj2, code, params, tail = m.groups()
                values = params.split(',')
                body = transforms.get(code, '')
                indices = [int(x) - 1 for x in re.findall(r'(?:set transforms|create object) param(\d+)', body)]
                outputs = [(values[i], None) for i in indices if i < len(values) and values[i] != '0']
                fields = {'Type 1': kind1.title(), 'Object 1': obj1, 'Type 2': kind2.title(), 'Object 2': obj2, 'Code': code, 'Requires': '; '.join(re.findall(r'requires (\w+ \d+)', tail))}
                name = f'{file.parent.parent.parent.name}:{number}'
                self.combos[name] = {'id': name, 'fields': fields, 'outputs': outputs, 'file': str(file.relative_to(ROOT)), 'line': number, 'raw': line}

    def fits(self, item, kind, target, provenance):
        signature = (item['name'], item.get('selectorTag'), kind, target)
        if signature not in self.fit_cache: self.fit_cache[signature] = self._fits(item, kind, target, provenance)
        return self.fit_cache[signature]

    def _fits(self, item, kind, target, provenance):
        ids = self.item_ids(item, provenance)
        if kind == 'Object': return target in ids
        if kind == 'Station':
            if self.stations.get(target) in ids: return True
            return key(item['name']) == key(target)
        if kind == 'Property':
            if key(item['name']) == key(target): return True
            return any(key(target) in {key(x.strip()) for x in re.split(r'[,;]', self.fields(stat).get('ComboProperties', '')) if x.strip()} for stat in ids)
        if kind == 'Category':
            if key(item.get('selectorTag', '')) == key(target): return True
            if item.get('selectorTag') and key(target) in self.category_names.get(key(item['name']), set()): return True
            return any(key(target) in self.categories[stat] for stat in ids)
        return False

    def ingredients_fit(self, row, combo, provenance):
        f = combo['fields']
        slots = [(f.get(f'Type {i}'), f[f'Object {i}']) for i in range(1, 6) if f.get(f'Object {i}')]
        if f.get('CraftingStation') and f['CraftingStation'] != 'None': slots.append(('Station', f['CraftingStation']))
        items = []
        for item in row['ingredients']:
            qty = item.get('quantity', '')
            m = re.fullmatch(r'(?:x|×)?\s*(\d+)', qty)
            if qty and not m: return False
            items.extend([item] * (int(m[1]) if m else 1))
        if len(items) != len(slots): return False
        return any(all(self.fits(item, kind, target, provenance) for item, (kind, target) in zip(items, order)) for order in itertools.permutations(slots))

    def output_fit(self, row, combo, provenance):
        ids = self.item_ids(row['result'], provenance)
        return [(stat, count) for stat, count in combo['outputs'] if stat in ids]


def audit(game, rows, index, provenance):
    findings = []
    for row in rows:
        ingredients = [combo for combo in index.combos.values() if index.ingredients_fit(row, combo, provenance)]
        matches = [combo for combo in ingredients if index.output_fit(row, combo, provenance)]
        unresolved = [item['name'] for item in [row['result'], *row['ingredients']] if not index.item_ids(item, provenance) and not item.get('selectorTag')]
        status = 'unresolved' if unresolved else 'not_found'
        details = []
        if matches:
            checks = []
            for combo in matches:
                quantities = [count for _, count in index.output_fit(row, combo, provenance)]
                if combo.get('result_blocks'):
                    ids = index.item_ids(row['result'], provenance)
                    counts = [sum(int(fields.get(f'ResultAmount {i}', '1')) for i in range(1, 5) if fields.get(f'Result {i}') in ids) for fields in combo['result_blocks'].values()]
                    counts = [count for count in counts if count > 0]
                else:
                    counts = [sum(quantities)] if all(q is not None for q in quantities) else []
                raw = row['result'].get('quantity', '')
                m = re.fullmatch(r'(?:x|×)?\s*(\d+)', raw)
                expected = int(m[1]) if m else 1 if not raw else None
                requirement = combo['fields'].get('Requires', '')
                docs_req = set(re.findall(r'(Crafting|Blacksmithing)\s+(\d+)', row['requirements']))
                game_req = set(re.findall(r'(Crafting|Blacksmithing)\s+(\d+)', requirement))
                issues = []
                if counts and expected is not None and expected not in counts: issues.append(f'quantity: catalog={expected}, game={sorted(set(counts))}')
                if game == 'dos1' and docs_req != game_req: issues.append(f'requirements: catalog={row["requirements"] or "none"}, game={requirement or "none"}')
                checks.append((combo, issues))
            good = [c for c, issues in checks if not issues]
            status = 'matched' if good else 'mismatch'
            details = [issue for _, issues in checks for issue in issues]
        elif ingredients and index.item_ids(row['result'], provenance):
            status = 'different_result' if all(combo['outputs'] for combo in ingredients) else 'transformation_needs_review'
            if ',' in row['result']['name'] or any(not index.stat_names.get(stat) for combo in ingredients for stat, _ in combo['outputs']): status = 'result_needs_review'
        result_candidates = [combo for combo in index.combos.values() if index.output_fit(row, combo, provenance)] if not ingredients else []
        if not ingredients and result_candidates and not unresolved: status = 'ingredients_not_confirmed'
        evidence = matches or ingredients or result_candidates[:6]
        findings.append({'id': row['id'], 'result': row['result']['name'], 'ingredients': [dict(name=i['name'], quantity=i.get('quantity', ''), selector=i.get('selectorTag')) for i in row['ingredients']], 'status': status, 'details': sorted(set(details)), 'unresolved_names': unresolved, 'evidence': [{'id': c['id'], 'file': c['file'], 'line': c['line'], 'inputs': {k: v for k, v in c['fields'].items() if k.startswith(('Object ', 'Type ', 'CraftingStation', 'Requires', 'Code'))}, 'outputs': [{'stats': stat, 'names': sorted(index.stat_names.get(stat, [])), 'quantity': count} for stat, count in c['outputs']]} for c in evidence]})
    return {'catalog_recipes': len(rows), 'game_definitions': len(index.combos), 'summary': dict(Counter(f['status'] for f in findings)), 'findings': findings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='reports/recipe-audit')
    args = parser.parse_args()
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    provenance = json.loads((ROOT / 'data/itemIcons.provenance.json').read_text())
    root = ROOT / '.pak-work/audit-current'
    report = {'scope': 'Audyt źródłowych JSON-ów, przed rozwinięciem grup w widoku. Overhaul obejmuje bazowe DOS2 i dodatki moda. Dopasowania używają nazw gry, Stats ID i kategorii, bez podobieństwa tekstowego. Dopasowanie oznacza znalezienie zgodnej definicji, a nie pełną weryfikację działania gry. Ilości DOS1, efekty, zużywanie narzędzi, losowe wyniki i ulepszenia wyposażenia nie są w pełni sprawdzane. Brak dopasowania nie oznacza błędu. Opcjonalne Gift Bagi pominięto. Różne wyniki są kandydatami do oceny, nie automatycznym dowodem błędu.', 'catalogs': {}}
    for game, layers in [('dos1', ['dos1']), ('dos2', ['dos2']), ('dos2-overhaul', ['dos2', 'overhaul'])]:
        index = GameIndex(layers)
        if game == 'dos1': index.add_dos1(root / 'dos1')
        else:
            index.add_dos2(root / 'dos2')
            for directory in sorted(root.glob('dos2-Patch*'), key=lambda p: int(re.search(r'Patch(\d+)', p.name)[1])): index.add_dos2(directory)
            if game == 'dos2-overhaul': index.add_dos2(root / 'overhaul')
        rows = json.loads((ROOT / 'data/library/recipes' / f'{game}.json').read_text())['recipes']
        if game == 'dos2-overhaul':
            rows = json.loads((ROOT / 'data/library/recipes/dos2.json').read_text())['recipes'] + rows
        result = audit(game, rows, index, provenance.get(game, {}))
        report['catalogs'][game] = result
        print(game, result['catalog_recipes'], result['game_definitions'], result['summary'], flush=True)
    report['sources'] = json.loads((root / 'sources.json').read_text())
    report['files'] = [{'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(root.rglob('*.txt'))]
    output.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    lines = ['# Audyt receptur na podstawie plików gry', '', report['scope'], '', '| Katalog | Wpisy źródłowe | Definicje gry | Dopasowane | Rozbieżne ilości/wymagania | Inny wynik | Pozostałe do sprawdzenia |', '|---|---:|---:|---:|---:|---:|---:|']
    for game, data in report['catalogs'].items():
        counts = data['summary']; handled = sum(counts.get(k, 0) for k in ['matched', 'mismatch', 'different_result'])
        lines.append(f'| {game} | {data["catalog_recipes"]} | {data["game_definitions"]} | {counts.get("matched", 0)} | {counts.get("mismatch", 0)} | {counts.get("different_result", 0)} | {data["catalog_recipes"] - handled} |')
    for game, data in report['catalogs'].items():
        lines += ['', f'## {game}: przypadki do oceny', '']
        for finding in [f for f in data['findings'] if f['status'] in ['mismatch', 'different_result']][:35]:
            lines += [f'- **{finding["result"]}**: ' + ' + '.join(i['name'] for i in finding['ingredients']) + f' — `{finding["status"]}`. ' + '; '.join(finding['details'])]
            for evidence in finding['evidence'][:2]:
                lines += [f'  - `{evidence["file"]}:{evidence["line"]}` (`{evidence["id"]}`). Wyniki: ' + ', '.join('/'.join(x['names']) or x['stats'] for x in evidence['outputs'])]
    output.with_suffix('.md').write_text('\n'.join(lines) + '\n')

if __name__ == '__main__': main()
