import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'content'
STATIC = ROOT / 'static'

img_re = re.compile(r"!\[[^\]]*\]\((<?)([^)>]+)(>?)\)")

moved = []
for md in CONTENT.rglob('*.md'):
    text = md.read_text(encoding='utf-8')
    changed = False
    def repl(m):
        nonlocal changed
        prefix = m.group(1)
        path = m.group(2).strip()
        suffix = m.group(3)
        if path.startswith('http') or path.startswith('/'):
            return m.group(0)
        # resolve source path relative to markdown file
        src = (md.parent / path).resolve()
        if not src.exists():
            return m.group(0)
        # destination path under static preserving path after content/
        try:
            rel_after_content = src.relative_to(CONTENT)
        except Exception:
            rel_after_content = src.name
        dest = STATIC / rel_after_content
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        new_path = '/' + str(rel_after_content).replace('\\', '/')
        moved.append((str(src), str(dest)))
        changed = True
        return f"![{m.group(0).split('](')[0][2:-1]}]({new_path})"
    new_text = img_re.sub(repl, text)
    if changed and new_text != text:
        md.write_text(new_text, encoding='utf-8')

print('Copied {} images.'.format(len(moved)))
for s,d in moved:
    print(s,'->',d)
