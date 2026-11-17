"""Adds a "mo" (mouth) point to every species in data.js, so the lure / hook / line meets the fish's MOUTH, not its tail.

The sprite strips in ../sprites are right-facing, so the mouth is at the front (right-hand) edge of the visible art. For every frame we
take the right-most visible columns, average where those pixels are vertically, and average that over all frames:
    "mo": [x, y]   in sprite-frame pixels (same units as "bb" and "fw"/"fh")
Run this AFTER tools/build_assets.py (which rewrites data.js):   python tools/add_mouths.py
"""
import json
import os
import re

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data.js")

txt = open(DATA, encoding="utf-8").read()
m = re.search(r"const SPECIES = (\{.*?\});\n", txt, re.S)
species = json.loads(m.group(1))
done = 0
for sid, S in species.items():
    path = os.path.join(ROOT, "sprites", sid + ".png")
    if not os.path.exists(path):
        continue
    sheet = Image.open(path).convert("RGBA")
    fw, fh, n = S["fw"], S["fh"], S["n"]
    xs, ys = [], []
    for i in range(n):
        fr = sheet.crop((i * fw, 0, (i + 1) * fw, fh))
        px = fr.load()
        cols = [x for x in range(fw) if any(px[x, y][3] > 128 for y in range(fh))]
        if not cols:
            continue
        xr = max(cols)
        pts = [(x, y) for x in range(max(0, xr - 1), xr + 1) for y in range(fh) if px[x, y][3] > 128]
        xs.append(xr + 1)                                   # the very front edge of the art
        ys.append(sum(y for _x, y in pts) / len(pts) + 0.5)
    if xs:
        S["mo"] = [round(sum(xs) / len(xs), 1), round(sum(ys) / len(ys), 1)]
        done += 1
new = "const SPECIES = " + json.dumps(species, separators=(",", ":")) + ";\n"
open(DATA, "w", encoding="utf-8").write(txt[:m.start()] + new + txt[m.end():])
print("mouth points added for", done, "of", len(species), "species")
