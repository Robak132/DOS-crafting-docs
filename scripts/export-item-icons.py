"""Export catalog icons from extracted game resources (offline, not needed by CI).

Usage: python3 scripts/export-item-icons.py EXTRACTED_DIRECTORY
Requires Pillow. EXTRACTED_DIRECTORY contains dos1/, dos2/, overhaul/ with
original Public/... paths, GUI LSX + DDS atlases, RootTemplates converted to LSX,
and Localization/Stats.lsx. DOS2 resources must come from Definitive Edition.
Run npm run generate:data first. See README for the resource preparation steps.
"""
import html
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def key(name):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', name.lower()).replace('ł', 'l'))


def attributes(node):
    return {a.get('id'): a.get('value', '') for a in node.findall('attribute')}


def resources(directory):
    atlases, templates, strings = {}, {}, {}
    string_handles = {}
    for file in sorted(directory.rglob('*.lsx')):
        if '/GUI/' not in str(file) and '/RootTemplates/' not in str(file) and 'localization' not in str(file).lower():
            continue
        tree = ET.parse(file)
        if '/GUI/' in str(file):
            texture = tree.find(".//node[@id='TextureAtlasPath']/attribute[@id='Path']")
            if texture is None:
                continue
            dds = directory / texture.get('value')
            if not dds.exists():
                dds = file.parent.parent / texture.get('value')
            if not dds.exists():
                continue
            for node in tree.findall(".//node[@id='IconUV']"):
                a = attributes(node)
                atlases[a['MapKey']] = (dds, tuple(float(a[c].replace(',', '.')) for c in ['U1', 'V1', 'U2', 'V2']))
        else:
            for node in tree.iter('node'):
                a = attributes(node)
                if node.get('id') == 'GameObjects' and a.get('MapKey'):
                    display_name = node.find("attribute[@id='DisplayName']")
                    if display_name is not None:
                        a['DisplayNameHandle'] = display_name.get('handle', '')
                    description = node.find("attribute[@id='Description']")
                    if description is not None:
                        a['DescriptionHandle'] = description.get('handle', '')
                    templates[a['MapKey']] = a
                if a.get('UUID') and a.get('Content'):
                    strings[a['UUID']] = a['Content']
                    content = node.find("attribute[@id='Content']")
                    if content is not None and content.get('handle'):
                        string_handles[a['UUID']] = content.get('handle')
    localization_files = set(directory.rglob("english.xml")) | {directory / "Localization/Reference" / name for name in ["DEFAULT.xml", "ROOTTEMPLATES.xml", "LOCALIZATION.xml"] if (directory / "Localization/Reference" / name).exists()}
    for file in sorted(localization_files):
        for entry in ET.parse(file).iter("content"):
            if entry.get("contentuid"):
                value = "".join(entry.itertext()).strip()
                if value:
                    strings[entry.get("contentuid")] = value
    for uuid, handle in string_handles.items():
        strings[uuid] = strings.get(handle, strings[uuid])
    return atlases, templates, strings


def plain_name(name):
    return html.unescape(re.sub(r'<[^>]*>', '', name))


def index_names(atlases, templates, strings, clean_markup=False):
    primary, aliases = defaultdict(set), defaultdict(set)
    def inherited(template, seen=None):
        seen = set() if seen is None else seen
        parent = template.get('ParentTemplateId')
        if parent and parent in templates and parent not in seen:
            seen.add(parent)
            return {**inherited(templates[parent], seen), **{k: v for k, v in template.items() if v}}
        return template
    for template in templates.values():
        a = inherited(template)
        icon = a.get('Icon')
        if icon not in atlases or a.get('Type', 'item') != 'item':
            continue
        display_name = strings.get(a.get('DisplayNameHandle'), a.get('DisplayName'))
        for name, target in [(display_name, primary), (strings.get(a.get('Stats')), aliases), (strings.get(a.get('Name')), aliases)]:
            if name:
                target[key(plain_name(name) if clean_markup else name)].add(icon)
    # Inventory display names take priority over legacy Stats labels. A cooked
    # ingredient can retain the raw ingredient's old Stats label (e.g. frog legs).
    names = {**aliases, **primary}
    return {name: next(iter(icons)) for name, icons in names.items() if len(icons) == 1}


def stat_entries(directory):
    entries = {}
    for file in sorted(directory.rglob('*.txt')):
        if '/Stats/Generated/' not in str(file):
            continue
        text = file.read_text(encoding='utf-8-sig')
        blocks = list(re.finditer(r'^new (\w+) "([^"\r\n]+)"', text, re.M))
        for i, block in enumerate(blocks):
            if block[1] not in ['entry', 'ItemCombinationResult']:
                continue
            body = text[block.end():blocks[i + 1].start() if i + 1 < len(blocks) else len(text)]
            parent = re.search(r'^using "([^"]+)"', body, re.M)
            entries[block[2]] = {
                'kind': block[1],
                'fields': dict(re.findall(r'^data "([^"]+)" "([^"\r\n]*)"', body, re.M)),
                'parent': parent[1] if parent else None,
            }
    return entries


def stats_icon_index(atlases, templates, entries, strings):
    by_stats = defaultdict(set)
    def template_icon(template, seen=None):
        seen = set() if seen is None else seen
        if template.get('Icon'):
            return template['Icon']
        parent = template.get('ParentTemplateId')
        if parent in templates and parent not in seen:
            seen.add(parent)
            return template_icon(templates[parent], seen)
        return None
    for template in templates.values():
        icon = template_icon(template)
        if icon in atlases and template.get('Stats'):
            by_stats[template['Stats']].add(icon)
    def resolve(stats, seen=None):
        seen = set() if seen is None else seen
        if stats in seen:
            return set()
        seen.add(stats)
        entry = entries.get(stats, {})
        fields = entry.get('fields', {})
        root = fields.get('RootTemplate')
        if root in templates:
            icon = template_icon(templates[root])
            if icon in atlases:
                return {icon}
        if stats in by_stats:
            return by_stats[stats]
        if fields.get('Icon') in atlases:
            return {fields['Icon']}
        parent = entry.get('parent')
        return resolve(parent, seen) if parent else set()
    candidates = defaultdict(list)
    for stats, entry in entries.items():
        if entry['kind'] == 'ItemCombinationResult':
            targets = [v for k, v in entry['fields'].items() if re.fullmatch(r'Result \d+', k) and v]
            if len(set(targets)) != 1:
                continue
            target = targets[0]
        else:
            target = stats
        preview = entry['fields'].get('PreviewIcon') if entry['kind'] == 'ItemCombinationResult' else None
        name = strings.get(stats) or (entry['fields'].get('PreviewTooltip') if entry['kind'] == 'ItemCombinationResult' else None)
        icons = {preview} if preview in atlases else resolve(target)
        if name and len(icons) == 1:
            candidates[key(plain_name(name))].append({'icon': next(iter(icons)), 'stats': target, 'localizationKey': stats})
    names = {name: values[0] for name, values in candidates.items() if len({value['icon'] for value in values}) == 1}
    return names, resolve


def combo_preview_index(directories, atlases, strings):
    candidates = defaultdict(list)
    for directory in directories:
        for file in sorted(directory.rglob('ItemComboPreviews.lsx')):
            for node in ET.parse(file).findall(".//node[@id='Combo']"):
                fields = attributes(node)
                tooltip = node.find("attribute[@id='Tooltip']")
                name = strings.get(tooltip.get('handle'), fields.get('Tooltip')) if tooltip is not None else None
                icon = fields.get('Icon')
                if name and icon in atlases:
                    candidates[key(plain_name(name))].append({
                        'icon': icon,
                        'previewSource': file.relative_to(directory).as_posix(),
                        **{k: fields[k] for k in ['Category', 'CombinationID'] if k in fields},
                    })
        for file in sorted(directory.rglob('*ItemComboPreviewData.txt')):
            text = file.read_text(encoding='utf-8-sig')
            for block in re.split(r'^new CraftingPreviewData ', text, flags=re.M)[1:]:
                fields = dict(re.findall(r'^data "([^"]+)" "([^"\r\n]*)"', block, re.M))
                icon, name = fields.get('Icon'), fields.get('Tooltip')
                if name and icon in atlases:
                    candidates[key(plain_name(name))].append({
                        'icon': icon,
                        'previewSource': file.relative_to(directory).as_posix(),
                        **{k: fields[k] for k in ['Category'] if k in fields},
                    })
    return {name: values[0] for name, values in candidates.items() if len({v['icon'] for v in values}) == 1}


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    source = Path(sys.argv[1])
    base = {game: resources(source / game) for game in ['dos1', 'dos2', 'overhaul']}
    catalogs = ROOT / '.generated/build/data'
    destination = ROOT / 'assets/item-icons'
    destination.mkdir(parents=True, exist_ok=True)
    provenance_file = ROOT / "data/itemIcons.provenance.json"
    existing = json.loads(provenance_file.read_text()) if provenance_file.exists() else {}
    mapping, provenance, report, images, written = {}, {}, {}, {}, set()
    for game in ['dos1', 'dos2', 'dos2-overhaul']:
        layers = ['dos1'] if game == 'dos1' else ['dos2', 'overhaul'] if game == 'dos2-overhaul' else ['dos2']
        atlases, templates, strings = {}, {}, {}
        for layer in layers:
            aa, tt, ss = base[layer]
            atlases.update(aa); templates.update(tt); strings.update(ss)
        names = index_names(atlases, templates, strings, clean_markup=game == 'dos2-overhaul')
        evidence = {}
        entries = {}
        for layer in layers:
            entries.update(stat_entries(source / layer))
        extra, _ = stats_icon_index(atlases, templates, entries, strings)
        # A localized recipe label must not override an ambiguous item label.
        direct = defaultdict(set)
        for template in templates.values():
            label, icon = strings.get(template.get('DisplayNameHandle'), template.get('DisplayName')), template.get('Icon')
            if label and icon in atlases:
                direct[key(plain_name(label))].add(icon)
        for label, match in extra.items():
            if label not in names and len(direct[label]) <= 1:
                names[label] = match['icon']
                evidence[label] = match
        previews = combo_preview_index([source / layer for layer in layers], atlases, strings)
        for label, match in previews.items():
            if label not in names:
                names[label] = match['icon']
                evidence[label] = match
        catalog = json.loads((catalogs / f'catalog-{game}.json').read_text())
        items = {key(item.get('statsId') or item['name']): item for row in catalog['recipes'] for item in [row['result'], *row['ingredients']] if not item.get('selectorTag')}
        # Preserve all mod dye variants, including colors absent from the recipe catalog.
        catalog_names = set(items)
        if game == 'dos2-overhaul':
            for template in templates.values():
                label = plain_name(template.get('DisplayName', ''))
                if template.get('Stats', '').startswith('TOOL_Dye_') and key(label) in names:
                    items.setdefault(key(label), {'name': label})
        mapping[game], provenance[game], missing = {}, {}, []
        results = {key(r['result'].get('statsId') or r['result']['name']) for r in catalog['recipes']}
        for item_key in sorted(items):
            name = items[item_key]['name']
            icon = names.get(key(name))
            # Preserve verified assignments in the exported data: several templates
            # may reuse a label for a different item or potion size.
            previous = existing.get(game, {}).get(item_key, {})
            if previous.get('icon') in atlases:
                icon = previous['icon']
                evidence[item_key] = {k: previous[k] for k in ['stats', 'template', 'localizationKey', 'previewSource', 'Category', 'CombinationID'] if k in previous}
            if icon is None:
                missing.append(name)
                continue
            dds, uv = atlases[icon]
            if dds not in images:
                images[dds] = Image.open(dds).convert('RGBA')
            image = images[dds]
            # UVs point at pixel centers, inset by half a pixel. Include the full cell.
            box = tuple(round(v * (image.width if i % 2 == 0 else image.height) + (-0.5 if i < 2 else 0.5)) for i, v in enumerate(uv))
            crop = image.crop(box)
            layer = dds.relative_to(source).parts[0]
            asset_name = name + ('-' + items[item_key]['statsId'] if items[item_key].get('statsId') else '')
            slug = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', asset_name.lower()).replace('ł', 'l')).strip('-')
            filename = f'{layer}/{slug}.webp'
            (destination / layer).mkdir(exist_ok=True)
            if filename not in written:
                crop.save(destination / filename, 'WEBP', lossless=True)
                written.add(filename)
            mapping[game][item_key] = f'data/icons/{filename}'
            provenance[game][item_key] = {'name': name, 'icon': icon, 'atlas': str(dds.relative_to(source)), 'box': box, **evidence.get(item_key, evidence.get(key(name), {}))}
        matched_results = len([n for n in results if n in mapping[game]])
        report[game] = {'matched': len(catalog_names) - len(missing), 'total': len(catalog_names), 'matchedResults': matched_results, 'totalResults': len(results), 'unmatched': missing}
        print(f'{game}: {len(catalog_names)-len(missing)}/{len(catalog_names)} catalog items; results {matched_results}/{len(results)}')
    for file in destination.rglob('*.webp'):
        if file.relative_to(destination).as_posix() not in written:
            file.unlink()
    (ROOT / 'data/itemIcons.json').write_text(json.dumps(mapping, indent=2, ensure_ascii=False) + '\n')
    (ROOT / 'data/itemIcons.provenance.json').write_text(json.dumps(provenance, indent=2, ensure_ascii=False) + '\n')
    (ROOT / 'data/itemIcons.report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(f'{len(written)} images, {sum(p.stat().st_size for p in destination.rglob("*.webp")) / 1024:.0f} KiB')


if __name__ == '__main__':
    main()
