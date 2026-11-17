"""Copies/cuts every picture Poke Ranch Cards uses out of ../sprites into ../assets.
Run from anywhere:  python "POKE RANCH CARDS/tools/build_assets.py"
Writes assets/walkdata.js (frame sizes of the walking sheets) too."""
import os, re, json, shutil, glob
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
ROOT = os.path.dirname(GAME)
SPR = os.path.join(ROOT, 'sprites')
OUT = os.path.join(GAME, 'assets')
OB = os.path.join(SPR, 'overworld_buildings')
HG = os.path.join(OB, 'community__jls-dchrn__HGSS_pokemon_tileset/Buildings/Fused_with_basics/outside_with_bured_tower.png')
PMD = os.path.join(OB, 'from_ai_folder/agent enviroment/scenery')
BERRY = os.path.join(OB, 'pokeplatinum/res/graphics/field_sprites/berry_trees')

DEX = [43,44,45,54,55,129,130,74,75,76,241,179,180,181,113,242,415,416,25,26,1,2,3,52,53,66,67,68,
       50,51,194,195,133,143,128,183,184,
       # extra wild visitors that wander the island
       16,19,10,13,161,162,263,396,399,403,531]

def mk(d): os.makedirs(os.path.join(OUT, d), exist_ok=True)
for d in ['walk', 'ground', 'scenery', 'crops', 'portraits', 'icons']: mk(d)

# ---- walking sheets (PMD SpriteCollab) ----
walk = {}
for n in DEX:
    src = os.path.join(SPR, 'spritecollab_full/sprite/%04d' % n)
    xml = os.path.join(src, 'AnimData.xml')
    if not os.path.exists(xml):
        print('no walk sheet for', n); continue
    s = open(xml, encoding='utf-8').read()
    info = {}
    for name in ('Walk', 'Idle'):
        m = re.search(r'<Name>%s</Name>(.*?)</Anim>' % name, s, re.S)
        if not m: continue
        body = m.group(1)
        copy = re.search(r'<CopyOf>(\w+)</CopyOf>', body)
        if copy:
            m = re.search(r'<Name>%s</Name>(.*?)</Anim>' % copy.group(1), s, re.S); body = m.group(1); fname = copy.group(1)
        else:
            fname = name
        w = int(re.search(r'<FrameWidth>(\d+)', body).group(1)); h = int(re.search(r'<FrameHeight>(\d+)', body).group(1))
        dur = [int(x) for x in re.findall(r'<Duration>(\d+)</Duration>', body)]
        png = os.path.join(src, fname + '-Anim.png')
        if not os.path.exists(png): continue
        im = Image.open(png)
        rows = im.height // h
        shutil.copy(png, os.path.join(OUT, 'walk', '%d_%s.png' % (n, name.lower())))
        info[name.lower()] = {'w': w, 'h': h, 'n': len(dur), 'dur': dur, 'rows': rows}
    if 'walk' in info: walk[n] = info
    p = os.path.join(SPR, 'spritecollab_full/portrait/%04d/Normal.png' % n)
    if os.path.exists(p): shutil.copy(p, os.path.join(OUT, 'portraits', '%d.png' % n))
open(os.path.join(OUT, 'walkdata.js'), 'w').write('const WALK = ' + json.dumps(walk) + ';\n')
print('walk sheets', len(walk))

# ---- ground textures ----
hg = Image.open(HG).convert('RGBA')
hg.crop((48, 0, 64, 16)).save(os.path.join(OUT, 'ground/grass.png'))
hg.crop((224, 0, 256, 32)).save(os.path.join(OUT, 'scenery/tallgrass_hg.png'))
hg.crop((224, 96, 256, 128)).save(os.path.join(OUT, 'scenery/flowers_hg.png'))
for sub, f, name in [('beach', '289', 'sand'), ('beach', '368', 'water'), ('beach', '327', 'water_edge'), ('summit', '279', 'rock'),
                     ('volcano', '517', 'rock2'), ('meadow', '1', 'meadow')]:
    shutil.copy(os.path.join(PMD, sub, f + '.png'), os.path.join(OUT, 'ground', name + '.png'))

# ---- scenery objects ----
crops = {  # name: box in the HGSS sheet
    'tree_yellow': (0, 2128, 96, 2240), 'tree_yellow2': (96, 2128, 192, 2240),
    'tree_big': (0, 2318, 96, 2433), 'tree_big2': (96, 2318, 192, 2433),
}
for k, b in crops.items():
    im = hg.crop(b); bb = im.getbbox()
    if bb: im = im.crop(bb)
    im.save(os.path.join(OUT, 'scenery', k + '.png'))
for sub, f, name in [('meadow', '21', 'tallgrass'), ('meadow', '4', 'flowerbush'), ('meadow', '13', 'bush'), ('meadow', '14', 'bush2'),
                     ('meadow', '468', 'bigbush'), ('summit', '504', 'boulder'), ('summit', '505', 'boulder2'),
                     ('cave', '798', 'crystal'), ('cave', '806', 'ruby')]:
    shutil.copy(os.path.join(PMD, sub, f + '.png'), os.path.join(OUT, 'scenery', name + '.png'))
# small HGSS objects (pine trees, rocks, sign, flowers...) are cut by find_objects() below

# ---- crops: Platinum berry trees (every crop grows through real berry-tree stages) ----
CROP_TREES = {'oran': 'oran', 'razz': 'razz', 'leek': 'pinap', 'apple': 'aspear', 'mushroom': 'rawst'}
for crop, tree in CROP_TREES.items():
    for n, stage in enumerate(['growing', 'blooming', 'fruit'], 1):
        im = Image.open(os.path.join(BERRY, '%s_%s.png' % (tree, stage))).convert('RGBA')
        im.crop((0, 0, 16, 32)).save(os.path.join(OUT, 'crops', '%s_%d.png' % (crop, n)))
im = Image.open(os.path.join(BERRY, 'berry_sprout.png')).convert('RGBA'); im.crop((0, 0, 16, 32)).save(os.path.join(OUT, 'crops', 'sprout.png'))
# soft soil patch under crops (HGSS tileset)
# ---- item icons: pokerogue-assets repo (goods, actions, coins, energy, ribbons as badges, Poke Ball card back) ----
ITEMS = os.path.join(os.path.dirname(ROOT), 'agent enviroment/pokerogue-assets/images/items')
mk('items')
for it in ['oran_berry', 'leek', 'sweet_apple', 'big_mushroom', 'mystic_water', 'hard_stone', 'berry_juice_good', 'silk_scarf',
           'common_egg', 'flower_sweet', 'nugget', 'pp_up', 'berry_pouch', 'miracle_seed', 'rare_candy', 'potion', 'map',
           'amulet_coin', 'sun_flute', 'mystic_ticket', 'water_stone', 'everstone', 'leaf_stone', 'pb',
           'ribbon_rock', 'ribbon_water', 'ribbon_grass', 'ribbon_electric', 'ribbon_psychic', 'ribbon_fire', 'ribbon_ground',
           'ribbon_flying', 'ribbon_fairy', 'ribbon_bug', 'ribbon_normal', 'ribbon_ghost', 'ribbon_steel', 'ribbon_ice', 'ribbon_dragon']:
    shutil.copy(os.path.join(ITEMS, it + '.png'), os.path.join(OUT, 'items', it + '.png'))
print('done')
