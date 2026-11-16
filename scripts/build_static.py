"""Publish only public assets; database files and Python sources stay private."""
from pathlib import Path
from shutil import copyfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public'
OUTPUT.mkdir(exist_ok=True)
for name in ('index.html', 'account.js', 'practice-sync.js', 'questions.json', 'questions.csv'):
    copyfile(ROOT / name, OUTPUT / name)
print('Built five public assets')
