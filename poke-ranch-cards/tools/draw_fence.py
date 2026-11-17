"""Draws the wooden fence pen (assets/buildings/pen.png) as pixel art: a square pen with wooden posts and
two rails on the top and bottom, side rails, and a clear middle where 2 Pokemon walk.
Run: python "POKE RANCH CARDS/tools/draw_fence.py""""
import os
from PIL import Image

W, H = 48, 40
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'buildings')
INK = (58, 34, 16, 255)        # outline
DARK = (132, 80, 36, 255)      # shaded wood
WOOD = (184, 120, 60, 255)     # wood
LIGHT = (226, 170, 98, 255)    # sunlit edge
KNOT = (110, 64, 28, 255)

im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
px = im.load()

def rect(x0, y0, x1, y1, c):
    for y in range(max(0, y0), min(H, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)):
            px[x, y] = c

def plank_h(x0, x1, y):            # horizontal rail, 3 px thick with outline
    rect(x0, y - 1, x1, y + 3, INK)
    rect(x0, y, x1, y + 2, WOOD)
    rect(x0, y, x1, y, LIGHT)
    rect(x0, y + 2, x1, y + 2, DARK)
    for k in range(x0 + 5, x1, 9):
        px[k, y + 1] = KNOT

def plank_v(x, y0, y1):            # vertical side rail, 2 px wide with outline
    rect(x - 1, y0, x + 2, y1, INK)
    rect(x, y0, x + 1, y1, WOOD)
    rect(x, y0, x, y1, LIGHT)

def post(x, y0, y1):               # 4 px post with a rounded cap
    rect(x - 1, y0, x + 4, y1, INK)
    rect(x, y0 + 1, x + 3, y1 - 1, WOOD)
    rect(x, y0 + 1, x, y1 - 1, LIGHT)
    rect(x + 3, y0 + 1, x + 3, y1 - 1, DARK)
    px[x - 1, y0] = (0, 0, 0, 0); px[x + 4, y0] = (0, 0, 0, 0)
    rect(x, y0 + 1, x + 3, y0 + 1, LIGHT)

# side rails first (behind the posts)
plank_v(2, 6, 34)
plank_v(W - 4, 6, 34)
# top and bottom fences: two rails each
for y in (2, 5):
    plank_h(1, W - 2, y)
for y in (31, 34):
    plank_h(1, W - 2, y)
# posts on the corners and in the middle of the top and bottom
for x in (1, 22, W - 6):
    post(x, 0, 9)
    post(x, 29, 39)
# a post halfway down each side
post(1, 15, 24)
post(W - 6, 15, 24)

im.save(os.path.join(OUT, 'pen.png'))

print('pen.png', im.size)
