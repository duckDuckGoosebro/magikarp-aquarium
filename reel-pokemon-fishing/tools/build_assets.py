"""Builds sprites + data for REEL POKEMON FISHING from the shared sprite folder (FISH TANK 2/sprites).
Every fish in the game is a real Pokemon sprite from that folder - nothing is generated.
Run:  python tools/build_assets.py     (needs Pillow)
Writes: sprites/<id>.png (+ <id>_s.png shiny), data.js, icons.
"""
import json
import os
import re
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
SRC = os.path.join(os.path.dirname(OUT), "FISH TANK 2", "sprites")
RIGHT_ROW = 2
os.makedirs(os.path.join(OUT, "sprites"), exist_ok=True)

# id  height(m)  weight(kg)  rarity(1-6)  habit(s=surface m=mid b=bottom)  activity(d/n/a)  [condition]
TABLE = """
magikarp 0.9 10 1 m a
goldeen 0.6 15 1 m a
poliwag 0.6 12.4 1 m a
azurill 0.2 2 1 s a
marill 0.4 8.5 1 m a
wooper 0.4 8.5 1 b a
lotad 0.5 2.6 1 s a
surskit 0.5 1.7 1 s d
psyduck 0.8 19.6 2 m a
barboach 0.4 1.9 1 b a
buizel 0.7 29.5 2 m a
shellos 0.3 6.3 1 b a
tympole 0.5 4.5 1 m a
ducklett 0.5 5.5 1 s d
dewpider 0.3 4 1 s a
mudkip 0.4 7.6 1 b a
squirtle 0.5 9 1 m a
slowpoke 1.2 36 1 b a
bibarel 1.0 31.5 2 b a
politoed 1.1 33.9 4 m a
seaking 1.3 39 2 m a
poliwhirl 1.0 20 2 m a
golduck 1.7 76.6 3 m a
whiscash 0.9 23.6 3 b a
quagsire 1.4 75 2 b a
floatzel 1.1 33.5 3 m a
corphish 0.6 11.5 1 b a
crawdaunt 1.1 32.8 3 b a
basculin 1.0 18 2 m a
palpitoad 0.8 17 2 m a
lombre 1.2 32.5 2 s a
croconaw 1.1 25 3 m a
carvanha 0.8 20.8 2 m n
froakie 0.3 7 2 m a
frogadier 0.6 10.9 3 m a
dratini 1.8 3.3 4 m a
marshtomp 0.7 28 2 b a
swanna 1.3 24.2 3 s d
seismitoad 1.5 62 3 m a
araquanid 1.8 82 4 s a
totodile 0.6 9.5 1 m a
oshawott 0.5 5.9 1 m a
dewott 0.8 24.5 2 m a
wartortle 1.0 22.5 2 m a
piplup 0.4 5.2 1 s a
prinplup 0.8 23 2 s a
popplio 0.4 7.5 1 s a
brionne 1.0 17.5 2 m a
sobble 0.3 4 1 m a
drizzile 0.7 11.5 2 m a
quaxly 0.5 6.1 1 s a
quaxwell 0.7 16.5 2 s a
wingull 0.6 9.5 1 s d
pelipper 1.2 28 2 s d
cramorant 0.8 18 2 s d
krabby 0.4 6.5 1 b a
kingler 1.3 60 3 b a
shellder 0.3 4 1 b a
staryu 0.8 34.5 2 b n
horsea 0.4 8 1 m a
tentacool 0.9 45.5 1 m a
remoraid 0.6 12 1 m a
chinchou 0.5 12 2 m n
finneon 0.4 7 2 s n
wishiwashi 0.2 0.3 1 m a
qwilfish 0.5 3.9 3 m a
corsola 0.6 5 2 b d
clamperl 0.4 52.5 3 b a
seel 1.1 90 2 m a
luvdisc 0.6 8.7 3 m a
mareanie 0.4 8 2 b a
finizen 1.3 60.2 2 m a
arrokuda 0.5 1 2 m a
binacle 0.5 31 2 b a
clauncher 0.5 8.3 2 m a
tatsugiri 0.3 8 3 m a
spheal 0.8 39.5 1 s a
wimpod 0.5 12 1 b a
golisopod 2.0 108 4 b a
pyukumuku 0.3 1.2 2 b a
skrelp 0.5 7.3 2 s a
barraskewda 1.3 30 3 m a
mantyke 1.0 65 2 s a
sharpedo 1.8 88.8 4 m n
wailmer 2.0 130 3 s a
lanturn 1.2 22.5 3 m n
octillery 0.9 28.5 3 b a
mantine 2.1 220 4 m a
huntail 1.7 27 4 b a
gorebyss 1.8 22.6 4 m a
relicanth 1.0 23.4 5 b a
dewgong 1.7 120 3 m a
cloyster 1.5 132.5 4 b a
seadra 1.2 25 3 m a
starmie 1.1 80 4 b n
tentacruel 1.6 55 3 m a
wailord 14.5 398 6 s a
lapras 2.5 220 5 m a
gyarados 6.5 235 5 m a
kingdra 1.8 152 5 b a
sealeo 1.1 87.6 3 m a
walrein 1.4 150.6 4 m a
vaporeon 1.0 29 5 m a
palafin 1.3 60.2 4 m a
veluza 2.5 90 4 m a
dondozo 12.0 220 6 m a
toxapex 0.7 14.5 4 b a
bruxish 0.9 19 3 m a
jellicent 2.2 135 4 m n
alomomola 1.2 31.6 4 m a
lumineon 1.2 24 3 s n
omanyte 0.4 7.5 3 b a
omastar 1.0 35 4 b a
kabuto 0.5 11.5 3 b a
kabutops 1.3 40.5 4 b a
lileep 1.0 23.8 3 b a
feebas 0.6 7.4 3 b a
clawitzer 1.3 35.3 3 m a
dragalge 1.8 81.5 4 b a
eelektrik 1.2 22 3 m n
eelektross 2.1 80.5 4 m n
slowbro 1.6 78.5 3 b a
slowking 2.0 79.5 4 b a
chewtle 0.3 8.5 1 b a
drednaw 1.0 115.5 3 b a
clobbopus 0.6 7.5 2 b a
glimmora 1.5 45 5 b n
milotic 6.2 162 5 m a
manaphy 0.3 1.4 6 m a
phione 0.4 3.1 4 s a
dragonair 4.0 16.5 4 m a
greninja 1.5 40 5 m n
swampert 1.5 81.9 4 b a
inteleon 1.9 45.2 5 m a
primarina 1.8 44 5 m a
blastoise 1.6 85.5 5 m a
feraligatr 2.3 88.8 5 m a
empoleon 1.7 84.5 5 m a
samurott 1.5 94.6 5 m a
basculegion 3.0 110 5 m a
arctovish 2.0 175 5 b a
dracovish 2.3 215 5 b a
quaquaval 1.8 61.9 5 m a
suicune 2.0 187 6 s a dawn
lugia 5.2 216 6 m a night
kyogre 4.5 352 6 m a rain
tapufini 1.3 76 6 m a cloud
volcanion 1.7 195 6 m a dusk
walkingwake 3.5 280 6 m a night
"""

NAMES = {"tapufini": "Tapu Fini", "walkingwake": "Walking Wake", "wishiwashi": "Wishiwashi", "mrmime": "Mr. Mime"}

POOLS = {
    "pond": "magikarp:3 goldeen:2 poliwag:2 azurill marill wooper lotad surskit psyduck barboach buizel shellos tympole ducklett dewpider mudkip squirtle slowpoke bibarel:0.6 politoed:0.25",
    "river": "seaking poliwhirl golduck whiscash quagsire floatzel corphish crawdaunt basculin palpitoad lombre mudkip croconaw carvanha froakie frogadier politoed:0.6 dratini:0.5 marshtomp swanna bibarel seismitoad araquanid:0.5 totodile oshawott wartortle dewott magikarp:2 goldeen barboach tympole ducklett piplup:0.5 psyduck",
    "coast": "wingull:2 pelipper krabby:2 kingler shellder staryu horsea tentacool:2 remoraid chinchou finneon wishiwashi qwilfish corsola clamperl seel luvdisc mareanie finizen arrokuda binacle clauncher tatsugiri cramorant piplup popplio spheal squirtle magikarp wimpod golisopod:0.5 pyukumuku dewgong:0.6 sealeo:0.6 sharpedo:0.35 wailmer:0.4 mantyke gyarados:0.15 prinplup:0.5 brionne:0.5 sobble drizzile:0.5 quaxly quaxwell:0.5 skrelp barraskewda:0.5",
    "cave": "omanyte omastar:0.7 kabuto kabutops:0.7 lileep relicanth:0.5 barboach whiscash feebas clauncher clawitzer skrelp dragalge:0.7 eelektrik eelektross:0.7 slowpoke:2 slowbro slowking:0.6 chewtle:2 drednaw clobbopus pyukumuku glimmora:0.4 lanturn chinchou mareanie toxapex:0.6 tatsugiri wooper quagsire",
    "deep": "sharpedo wailmer lanturn octillery mantine mantyke huntail gorebyss relicanth:0.6 dewgong cloyster seadra starmie tentacruel wailord:0.5 lapras:0.7 gyarados:0.7 kingdra:0.6 sealeo walrein vaporeon:0.5 palafin veluza dondozo:0.4 toxapex bruxish jellicent alomomola barraskewda mareanie tentacool chinchou lumineon corsola remoraid qwilfish clawitzer horsea blastoise:0.2",
    "legend": "milotic:0.8 manaphy:0.3 phione dragonair greninja:0.7 swampert inteleon:0.7 primarina:0.7 blastoise:0.7 feraligatr:0.8 empoleon:0.8 samurott:0.8 basculegion:0.7 arctovish:0.6 dracovish:0.6 quaquaval:0.7 wartortle dewott brionne drizzile prinplup croconaw quaxwell suicune:1 lugia:1 kyogre:1 tapufini:1 volcanion:1 walkingwake:1",
}


def anim_meta(folder, name):
    txt = open(os.path.join(folder, "AnimData.xml"), encoding="utf-8").read()
    for m in re.finditer(r"<Anim>(.*?)</Anim>", txt, re.S):
        b = m.group(1)
        n = re.search(r"<Name>(\w+)</Name>", b)
        if n and n.group(1) == name:
            fw, fh = re.search(r"<FrameWidth>(\d+)", b), re.search(r"<FrameHeight>(\d+)", b)
            if fw and fh:
                return int(fw.group(1)), int(fh.group(1)), [int(x) for x in re.findall(r"<Duration>(\d+)", b)]
    return None


def strip(folder, anim, fw, fh):
    p = os.path.join(folder, anim + "-Anim.png")
    if not os.path.exists(p):
        return None
    sheet = Image.open(p).convert("RGBA")
    n = max(1, sheet.width // fw)
    return sheet.crop((0, RIGHT_ROW * fh, n * fw, (RIGHT_ROW + 1) * fh)), n


species = {}
for line in TABLE.strip().splitlines():
    p = line.split()
    sid, h, kg, rar, hab, act = p[0], float(p[1]), float(p[2]), int(p[3]), p[4], p[5]
    cond = p[6] if len(p) > 6 else ""
    folder = os.path.join(SRC, sid)
    if not os.path.isdir(folder):
        print("MISSING sprite folder:", sid)
        continue
    anim = "Walk"
    meta = anim_meta(folder, anim)
    if not meta or not os.path.exists(os.path.join(folder, "Walk-Anim.png")):
        anim = "Idle"
        meta = anim_meta(folder, anim)
    fw, fh, durs = meta
    row, n = strip(folder, anim, fw, fh)
    x0, y0, x1, y1 = 10 ** 6, 10 ** 6, 0, 0
    for i in range(n):
        bb = row.crop((i * fw, 0, (i + 1) * fw, fh)).getbbox()
        if bb:
            x0, y0, x1, y1 = min(x0, bb[0]), min(y0, bb[1]), max(x1, bb[2]), max(y1, bb[3])
    row.save(os.path.join(OUT, "sprites", sid + ".png"), optimize=True)
    shiny = False
    sh = strip(os.path.join(folder, "shiny"), anim, fw, fh) if os.path.isdir(os.path.join(folder, "shiny")) else None
    if sh:
        sh[0].save(os.path.join(OUT, "sprites", sid + "_s.png"), optimize=True)
        shiny = True
    species[sid] = dict(name=NAMES.get(sid, sid.capitalize()), h=h, kg=kg, rar=rar, hab=hab, act=act, cond=cond, fw=fw, fh=fh, n=n,
                        d=(durs + [6] * n)[:n], bb=[x0, y0, x1, y1], shiny=shiny)

pools = {}
for spot, txt in POOLS.items():
    lst = []
    for tok in txt.split():
        sid, _, w = tok.partition(":")
        if sid not in species:
            print("pool", spot, "unknown species", sid)
            continue
        lst.append([sid, float(w) if w else 1.0])
    pools[spot] = lst

for sid in sorted(species):
    if not any(sid == s for lst in pools.values() for s, _ in lst):
        print("NOTE: species in no pool:", sid)

# icons
m = Image.open(os.path.join(OUT, "sprites", "magikarp.png"))
fw, fh = species["magikarp"]["fw"], species["magikarp"]["fh"]
base = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
base.paste(m.crop((0, 0, fw, fh)))
bb = base.getbbox()
base = base.crop(bb)
for size, name in ((180, "icon-180.png"), (512, "icon-512.png")):
    bg = Image.new("RGB", (size, size), (14, 78, 130))
    k = int(size * 0.62 / max(base.size))
    sp_ = base.resize((base.width * k, base.height * k), Image.NEAREST)
    bg.paste(sp_, ((size - sp_.width) // 2, (size - sp_.height) // 2), sp_)
    bg.save(os.path.join(OUT, name))

with open(os.path.join(OUT, "data.js"), "w", encoding="utf-8") as f:
    f.write("const SPECIES = " + json.dumps(species, separators=(",", ":")) + ";\n")
    f.write("const POOLS = " + json.dumps(pools, separators=(",", ":")) + ";\n")
print("species:", len(species), "data.js bytes:", os.path.getsize(os.path.join(OUT, "data.js")))
