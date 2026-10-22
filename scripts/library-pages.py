"""Item pages: data/library/pages/{dos1,dos2,dos2-co}.json; a page shared by several games is copied into each."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / 'data/library/pages'
GAME_FILES = {'DOS1': 'dos1.json', 'DOS2': 'dos2.json', 'DOS2-CO': 'dos2-co.json'}
FIELDS = ('slug', 'title', 'titlePl', 'tags')


def load_pages():
    pages = {}
    for game, name in GAME_FILES.items():
        data = json.loads((PAGES / name).read_text(encoding='utf-8'))
        for page in data['pages']:
            if page['slug'] in pages and pages[page['slug']] != page:
                raise ValueError(f"{page['slug']}: copies in the game files differ")
            pages[page['slug']] = page
    return pages


def save_pages(pages):
    for game, name in GAME_FILES.items():
        entries = [
            {field: page[field] for field in FIELDS if field in page}
            for slug, page in sorted(pages.items())
            if game in page['tags']
        ]
        (PAGES / name).write_text(
            json.dumps({'game': game, 'pages': entries}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
