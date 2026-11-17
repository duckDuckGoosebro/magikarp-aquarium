"""Builds the web version's data + sprites from the Python game (FISH TANK 2).
Run:  python tools/build_assets.py      (from the FISH TANK WEB folder; needs Pillow)
Writes: data.js (all game tables), sprites/*.png (right-facing frame strips), fx/, env/, icons.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
SRC = os.path.join(os.path.dirname(OUT), "FISH TANK 2")
sys.path.insert(0, SRC)
from PIL import Image  # noqa: E402
import fishtank2 as ft  # noqa: E402

SPR = os.path.join(SRC, "sprites")
os.makedirs(os.path.join(OUT, "sprites"), exist_ok=True)
os.makedirs(os.path.join(OUT, "fx"), exist_ok=True)
os.makedirs(os.path.join(OUT, "env"), exist_ok=True)

# ------------------------------------------------------------------ the shop
BASE_PRICE = {"guppy": 100, "carn": 1000, "remo": 600, "star": 600, "hunt": 450, "relic": 1500, "clam": 700, "luv": 1200, "shark": 1800, "mantine": 900,
              "sea": 650, "coral": 800, "poison": 1400, "healer": 1000, "wailord": 2500, "milotic": 1500, "psy": 700, "slow": 800, "azu": 1100,
              "dew": 1300, "craw": 1200, "lumi": 900, "lap": 2000, "toad": 1800}
shop = {}
for key in ft.FISH_ORDER:
    if key.startswith("evo_"):
        continue
    if key in ft.EXTRA:
        kind, sp = ft.KIND_OF[key], ft.SP_OF[key]
        name, price = ft.EXTRA[key][1], ft.EXTRA[key][3]
        baby = ft.MOM_BABY.get(sp, "")
        sub = ("mom: gives birth to %s" % baby.capitalize()) if kind == "mom" else ft.ARCH_TEXT[kind]
    elif key in ft.WALL_ITEMS:
        kind, sp = ft.SHOP_BASE[key]
        name, sub, price = ft.WALL_ITEMS[key]
    else:
        kind, sp = ft.SHOP_BASE.get(key, (key, ft.SPECIES.get(key)))
        name, price = ft.FISH_NAMES.get(key, key), BASE_PRICE[key]
        sub = ft.ARCH_TEXT.get(kind, "")
    rule = ft.WALL_RULES.get(key)
    wall = None
    if rule:
        conds = rule[1] if isinstance(rule[1], list) else [(rule[1], rule[2])]
        wall = {"text": rule[0], "conds": [list(c) for c in conds]}
    shop[key] = dict(name=name, sub=sub, price=price, kind=kind, sp=sp, lvl=ft.UNLOCK_LEVEL[key], wall=wall, legend=key in ft.LEGEND_KEYS)

species = set()
for v in shop.values():
    species.add(v["sp"])
for a, (b, _k, _c) in ft.EVOLUTIONS.items():
    species.update((a, b))
for a, lst in ft.ALT_EVOLUTIONS.items():
    species.add(a)
    species.update(o[0] for o in lst)
species.update(ft.MOM_BABY.values())
species.update(ft.MOM_BABY.keys())
species.update(ft.STARTERS)
species.update(d[0] for d in ft.BOSSES.values())
species.update(ft.GUN)
species.update(("magikarp", "gyarados", "goldeen", "seaking", "feebas", "milotic", "azurill", "marill", "carvanha", "sharpedo", "wailmer", "wailord"))
species = sorted(s for s in species if s and os.path.isdir(os.path.join(SPR, s)))

# ------------------------------------------------------------------ sprites: right-facing frame strips (Idle / Walk / Attack), plus the shiny sheet
RIGHT_ROW = ft.RIGHT_ROW
meta = {}


def anim_meta(folder):
    txt = open(os.path.join(folder, "AnimData.xml"), encoding="utf-8").read()
    out = {}
    for m in re.finditer(r"<Anim>(.*?)</Anim>", txt, re.S):
        b = m.group(1)
        n, fw, fh = re.search(r"<Name>(\w+)</Name>", b), re.search(r"<FrameWidth>(\d+)", b), re.search(r"<FrameHeight>(\d+)", b)
        if n and fw and fh:
            out[n.group(1)] = (int(fw.group(1)), int(fh.group(1)), [int(x) for x in re.findall(r"<Duration>(\d+)", b)])
    return out


def strip(folder, anim, fw, fh):
    p = os.path.join(folder, anim + "-Anim.png")
    if not os.path.exists(p):
        return None
    sheet = Image.open(p).convert("RGBA")
    n = max(1, sheet.width // fw)
    row = sheet.crop((0, RIGHT_ROW * fh, n * fw, (RIGHT_ROW + 1) * fh))
    return row, n


for sp in species:
    folder = os.path.join(SPR, sp)
    try:
        am = anim_meta(folder)
    except OSError:
        continue
    entry = {}
    top, bot = 10 ** 6, 0
    for anim in ("Idle", "Walk", "Attack"):
        if anim not in am:
            continue
        fw, fh, durs = am[anim]
        got = strip(folder, anim, fw, fh)
        if not got:
            continue
        row, n = got
        row.save(os.path.join(OUT, "sprites", "%s_%s.png" % (sp, anim)), optimize=True)
        entry[anim] = dict(fw=fw, fh=fh, n=n, d=(durs + [6] * n)[:n])
        if anim == "Idle":
            for i in range(n):
                bb = row.crop((i * fw, 0, (i + 1) * fw, fh)).getbbox()
                if bb:
                    top, bot = min(top, bb[1]), max(bot, bb[3])
        sh = os.path.join(folder, "shiny")
        if os.path.exists(os.path.join(sh, anim + "-Anim.png")):
            g2 = strip(sh, anim, fw, fh)
            if g2:
                g2[0].save(os.path.join(OUT, "sprites", "%s_shiny_%s.png" % (sp, anim)), optimize=True)
                entry["shiny"] = True
    if "Idle" in entry or "Walk" in entry:
        entry["h"] = max(8, bot - top) if bot else 40
        meta[sp] = entry

# ------------------------------------------------------------------ fx + env
for f in os.listdir(os.path.join(SPR, "fx")):
    Image.open(os.path.join(SPR, "fx", f)).save(os.path.join(OUT, "fx", f), optimize=True)
for name in ("coin_silver", "coin_gold", "coin_diamond", "coin_pearl", "coin_spearl", "coin_trophy", "coin_treasure", "pellet", "bubble"):
    Image.open(os.path.join(SPR, "env", name + ".png")).convert("RGBA").resize((48, 48), Image.LANCZOS).save(os.path.join(OUT, "env", name + ".png"), optimize=True)
for th in ft.TANK_THEMES:
    Image.open(os.path.join(SPR, "env", "tank_%s.png" % th)).convert("RGB").resize((1200, 800), Image.LANCZOS).save(os.path.join(OUT, "env", "tank_%s.jpg" % th), quality=72)
ic = Image.open(os.path.join(OUT, "sprites", "magikarp_Idle.png"))
fw = meta["magikarp"]["Idle"]["fw"]
fh = meta["magikarp"]["Idle"]["fh"]
base = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
base.paste(ic.crop((0, 0, fw, fh)))
for size, name in ((180, "icon-180.png"), (512, "icon-512.png")):
    bg = Image.new("RGB", (size, size), (16, 70, 120))
    sp_ = base.resize((int(fw * size / 40 * 0.7), int(fh * size / 40 * 0.7)), Image.NEAREST)
    bg.paste(sp_, ((size - sp_.width) // 2, (size - sp_.height) // 2), sp_)
    bg.save(os.path.join(OUT, name))

# ------------------------------------------------------------------ data.js
data = dict(
    sprites=meta, shop=shop, order=[k for k in ft.FISH_ORDER if k in shop], tankOrder=ft.TANK_ORDER,
    spH=ft.SP_H, targetH=ft.TARGET_H, scale=ft.SCALE, evoMult=ft.EVO_MULT, guppyScale=ft.GUPPY_SCALE, speed=ft.SPEED,
    hungerRate=ft.HUNGER_RATE, hungryAt=ft.HUNGRY_AT, reach=ft.REACH, pets=sorted(ft.PETS), ground=sorted(ft.GROUND_SPECIES), still=sorted(ft.STILL_SPECIES),
    eaters=list(ft.EATERS), coins={k: v[0] for k, v in ft.COINS.items()}, gun=ft.GUN, shinyAbility=ft.SHINY_ABILITY, shinyTiers={str(k): v for k, v in ft.SHINY_TIERS.items()},
    shinyTierWeights=ft.SHINY_TIER_WEIGHTS, tierDamage={str(k): v for k, v in ft.TIER_DAMAGE.items()}, stageUnlock=ft.STAGE_UNLOCK, stagesPerTank=ft.STAGES_PER_TANK,
    momBaby=ft.MOM_BABY, babyTrait=ft.BABY_TRAIT, starters=ft.STARTERS, eggCosts=ft.EGG_COSTS, floorRaiders=list(ft.FLOOR_RAIDERS), bossChasers=list(ft.BOSS_CHASERS),
    bossCd=ft.BOSS_CD, bossReach=ft.BOSS_REACH, bosses=ft.BOSSES, legends=sorted(ft.LEGENDS), legendKeys=list(ft.LEGEND_KEYS), grabbers=list(ft.GRABBERS),
    evolutions={a: list(v) for a, v in ft.EVOLUTIONS.items() if a in meta and v[0] in meta}, altEvolutions={a: [list(o) for o in lst if o[0] in meta] for a, lst in ft.ALT_EVOLUTIONS.items()},
    sizeClasses=[c[1] for c in ft.SIZE_CLASSES], sizeWeights=ft.SIZE_WEIGHTS, legendShiny=ft.LEGEND_SHINY_CHANCE, themes=ft.TANK_THEMES, growNeed=ft.GROW_NEED,
)
with open(os.path.join(OUT, "data.js"), "w", encoding="utf-8") as fh_:
    fh_.write("const DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
print("species:", len(meta), "shop:", len(shop), "data.js bytes:", os.path.getsize(os.path.join(OUT, "data.js")))
