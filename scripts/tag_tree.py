"""Tags are leaf names; data/recipeTagHierarchy.json alone defines each tag's parent.
Python twin of src/main/domain/tagTree.ts for the offline tag tools."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKERS = {'DOS1', 'DOS2', 'DOS2-CO'}


def load_parents(hierarchy=None):
    hierarchy = hierarchy or json.loads((ROOT / 'data/recipeTagHierarchy.json').read_text(encoding='utf-8'))
    parents = {}
    def walk(node, up=None):
        parents[node['tag']] = up
        for child in node.get('children', []): walk(child, node['tag'])
    for node in hierarchy['hierarchy']: walk(node)
    return parents


PARENTS = load_parents()
# "Category" and the trait sections of the sidebar: headings, never tags an item should carry.
ROOTS = {tag for tag, parent in PARENTS.items() if parent is None}


def ancestors(tag):
    out, tag = [], PARENTS.get(tag)
    while tag: out.append(tag); tag = PARENTS.get(tag)
    return out


def within(tag, ancestor):
    return tag == ancestor or ancestor in ancestors(tag)


def is_category(tag):
    return within(tag, 'Category')


def is_status(tag, stats=()):
    """Game status ids are upper case (POISONED, ARCANE_STITCH); stat names such as HP are not statuses."""
    return bool(re.fullmatch(r'[A-Z][A-Z0-9_]+', tag)) and tag not in stats


def most_specific(tags):
    tags = list(dict.fromkeys(tags))
    implied = {parent for tag in tags for parent in ancestors(tag)}
    return [tag for tag in tags if tag not in implied]
