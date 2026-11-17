"""Publish only public assets; database files and Python sources stay private."""
from pathlib import Path
from shutil import copyfile, copytree

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public'
OUTPUT.mkdir(exist_ok=True)
for name in ('index.html', 'account.js', 'learning.js', 'practice-sync.js', 'math-format.js', 'question-revisions.js', 'questions.json', 'questions.csv'):
    copyfile(ROOT / name, OUTPUT / name)
copytree(ROOT / 'vendor', OUTPUT / 'vendor', dirs_exist_ok=True)
print('Built public assets with locally hosted KaTeX')
