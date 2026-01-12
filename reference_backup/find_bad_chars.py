import pathlib
root = pathlib.Path('backend/src/modules/business-case')
for p in root.rglob('*.js'):
    text = p.read_text(encoding='latin-1')
    bad = sorted(set(ch for ch in text if ord(ch) > 127 and ch not in '\n\r\t'))
    if bad:
        print(f"{p}: {''.join(bad)}")
