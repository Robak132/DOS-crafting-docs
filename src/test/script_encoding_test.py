"""Run with: python3 -m unittest discover -s src/test -p 'script_encoding_test.py'.

Without an explicit encoding, Python on a Polish Windows reads and writes these
UTF-8 JSON/XML files as cp1250, garbling names such as "Żelazna sztaba".
"""
import ast
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
TEXT_CALLS = {'read_text', 'write_text', 'open'}


def unencoded_calls(path):
    tree = ast.parse(path.read_text(encoding='utf-8'), str(path))
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.attr if isinstance(func, ast.Attribute) else func.id if isinstance(func, ast.Name) else None
        if name not in TEXT_CALLS:
            continue
        # Image.open(...) and similar library calls are not text file access.
        if isinstance(func, ast.Attribute) and name == 'open' and isinstance(func.value, ast.Name) and func.value.id != 'Path':
            continue
        modes = [arg.value for arg in node.args[1:2] if isinstance(arg, ast.Constant)]
        modes += [kw.value.value for kw in node.keywords if kw.arg == 'mode' and isinstance(kw.value, ast.Constant)]
        if any('b' in str(mode) for mode in modes):
            continue
        if not any(kw.arg == 'encoding' for kw in node.keywords):
            yield node.lineno


class ScriptEncodingTest(unittest.TestCase):
    def test_every_text_file_access_names_utf8(self):
        problems = [f'{path.relative_to(ROOT)}:{line}' for path in sorted((ROOT / 'scripts').glob('*.py')) for line in unencoded_calls(path)]
        self.assertEqual(problems, [])


if __name__ == '__main__':
    unittest.main()
