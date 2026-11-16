"""FISH TANK 2 - an Insaniquarium-style game made only of fish Pokemon sprites.

Feed your fish, collect the coins they drop, fend off the raging red Gyarados, and buy the three egg pieces to finish the level.
  Magikarp  = guppy      (eats food, grows small > medium > large, babies drop nothing; grown ones drop silver / gold coins)
  Seaking   = breeder    (gives birth to baby Goldeen)
  Gyarados  = carnivore  (eats baby Magikarp, drops diamonds)
  Remoraid  = pet        (collects coins for you and shoots the raging Gyarados)
  Relicanth = pet        (makes a pearl now and then)
Left click: pick up coins / hit the raging Gyarados / otherwise drop food ($5).
Needs python 3 + Pillow. Run START_FISH_TANK_2.bat or:  python fishtank2.py
"""
import json
import math
import os
import random
import re
import sys
import time
import tkinter as tk

from PIL import Image, ImageTk

HERE = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, "frozen", False):       # built as a Windows .exe: sprites are packed inside, saves go next to the .exe
    DATA_DIR, SAVE_DIR = sys._MEIPASS, os.path.dirname(sys.executable)
else:
    DATA_DIR = SAVE_DIR = HERE
SPRITES = os.path.join(DATA_DIR, "sprites")
SAVE = os.path.join(SAVE_DIR, "save.json")

BASE_W, BASE_H = 900, 600      # the size the game is designed for; fullscreen enlarges the tank and everything in it
W, H = BASE_W, BASE_H
FPS = 30
SAND_Y = H - 60
TOP, BOT = 70, SAND_Y - 30
RIGHT_ROW, LEFT_ROW = 2, 6
MAX_FISH = 22

SPECIES = {"guppy": "magikarp", "breeder": "seaking", "carn": "gyarados", "remo": "remoraid", "relic": "relicanth", "boss": "gyarados"}
SCALE = {"breeder": 1.7, "carn": 1.0, "remo": 1.7, "relic": 1.9, "boss": 1.5}
GUPPY_SCALE = [1.1, 1.6, 2.2]
SPEED = {"guppy": 55, "breeder": 60, "carn": 75, "remo": 80, "relic": 40, "boss": 70}
GROW_NEED = [5, 7]                      # food points to go small>medium, medium>large
COINS = {"silver": (15, "#d9e1e8", "#8a98a6"), "gold": (35, "#ffd34d", "#a67c00"), "diamond": (200, "#7fe9ff", "#1b8fb0"),
         "pearl": (250, "#fff0f6", "#c78aa6"), "trophy": (100, "#ffb347", "#a35a00")}
FOOD_COST = 5
EGG_COSTS = [500, 1000, 1800]


def money(n):
    return "$%d" % n


# ----------------------------------------------------------------------------------------------- sprites
class Sheets:
    def __init__(self):
        self.cache, self.meta = {}, {}

    def parse(self, folder):
        if folder in self.meta:
            return self.meta[folder]
        txt = open(os.path.join(SPRITES, folder, "AnimData.xml"), encoding="utf-8").read()
        out = {}
        for m in re.finditer(r"<Anim>(.*?)</Anim>", txt, re.S):
            b = m.group(1)
            n, fw, fh = re.search(r"<Name>(\w+)</Name>", b), re.search(r"<FrameWidth>(\d+)", b), re.search(r"<FrameHeight>(\d+)", b)
            if n and fw and fh:
                out[n.group(1)] = (int(fw.group(1)), int(fh.group(1)), [int(x) for x in re.findall(r"<Duration>(\d+)", b)])
        self.meta[folder] = out
        return out

    def get(self, folder, anim, right, scale, tint=None, dead=False):
        key = (folder, anim, right, round(scale, 2), tint, dead)
        if key in self.cache:
            return self.cache[key]
        meta = self.parse(folder)
        if anim not in meta or not os.path.exists(os.path.join(SPRITES, folder, anim + "-Anim.png")):
            anim = "Idle"
        fw, fh, durs = meta[anim]
        sheet = Image.open(os.path.join(SPRITES, folder, anim + "-Anim.png")).convert("RGBA")
        row = RIGHT_ROW if right else LEFT_ROW
        n = max(1, sheet.width // fw)
        frames = []
        for i in range(n):
            fr = sheet.crop((i * fw, row * fh, (i + 1) * fw, (row + 1) * fh))
            if tint == "red":
                r, g, b, a = fr.split()
                fr = Image.merge("RGBA", (b, g, r, a))
            if dead:
                fr = fr.transpose(Image.FLIP_TOP_BOTTOM)
                grey = fr.convert("LA").convert("RGBA")
                fr = grey
            fr = fr.resize((max(1, int(fw * scale)), max(1, int(fh * scale))), Image.NEAREST)
            frames.append(ImageTk.PhotoImage(fr))
        res = (frames, (durs + [6] * n)[:n])
        self.cache[key] = res
        return res


# ----------------------------------------------------------------------------------------------- entities
class E:
    def __init__(self, kind, x=None, y=None, stage=0, species=None):
        self.kind = kind
        self.species = species or SPECIES[kind]       # sprite folder: guppies may be Magikarp or Goldeen
        self.x = x if x is not None else random.uniform(80, W - 80)
        self.y = y if y is not None else random.uniform(TOP, BOT)
        self.tx, self.ty = self.x, self.y
        self.right = random.random() < 0.5
        self.mode = "idle"
        self.timer = random.uniform(0.2, 2)
        self.frame, self.ftime = 0, 0.0
        self.hunger = 100.0 if kind not in ("guppy",) else random.uniform(70, 100)
        self.stage = stage
        self.growth = 0
        self.coin_t = random.uniform(5, 10)
        self.spawn_t = random.uniform(10, 18)
        self.dead = 0.0          # >0 : seconds left floating belly-up
        self.is_dead = False
        self.hp = 0
        self.cool = 0.0
        self.shoot = 0.0
        self.shake = 0.0
        self.img = None

    @property
    def pet(self):
        return self.kind in ("remo", "relic")

    @property
    def scale(self):
        return GUPPY_SCALE[self.stage] if self.kind == "guppy" else SCALE[self.kind]

    def size(self, sheets, S=1.0):
        fr, _ = sheets.get(self.species, "Idle", True, self.scale * S, "red" if self.kind == "boss" else None)
        return fr[0].width(), fr[0].height()


class Game:
    def __init__(self, root):
        self.root = root
        root.title("FISH TANK 2")
        root.configure(bg="#0b1d2e")
        root.resizable(False, False)
        self.sheets = Sheets()
        self.S = 1.0
        self.fullscreen = False
        self.ov_args = None
        self.shop = tk.Frame(root, bg="#102a43")
        self.shop.grid(row=0, column=0, sticky="ew")
        self.canvas = tk.Canvas(root, width=W, height=H, highlightthickness=0, bg="#0b1d2e")
        self.canvas.grid(row=1, column=0)
        self.best = 0
        self.level = 1
        self.load()
        self.fish, self.cash, self.eggs, self.autofeed, self.state = [], 0, 0, False, "play"
        self.food_lvl = self.qual_lvl = self.weap_lvl = 0
        self.build_shop()
        self.draw_static()
        self.canvas.bind("<Button-1>", self.on_click)
        root.bind("<F11>", lambda e: self.toggle_fullscreen())
        root.bind("<Escape>", lambda e: self.toggle_fullscreen(False) if self.fullscreen else None)
        self.root.protocol("WM_DELETE_WINDOW", self.quit)
        self.new_level()
        self.last = time.time()
        self.tick()

    # ---------------------------------------------------------------- level / state
    def new_level(self, keep_level=True):
        L = self.level
        self.cash = 150
        self.fish = [E("guppy"), E("guppy")]
        self.pellets, self.coins, self.floaters, self.bubbles, self.shots = [], [], [], [], []
        self.food_lvl, self.qual_lvl, self.weap_lvl = 0, 0, 0
        self.eggs = 0
        self.autofeed = False
        self.auto_t = 0.0
        self.boss = None
        self.boss_clock = max(20.0, 50 - 4 * L)
        self.t = 0.0
        self.state = "play"
        self.msg, self.msg_t = "Level %d - buy the 3 egg pieces!" % L, 5.0
        self.clear_overlay()
        self.refresh_shop()

    def egg_cost(self):
        return int(EGG_COSTS[self.eggs] * (1 + 0.3 * (self.level - 1)))

    def say(self, text):
        self.msg, self.msg_t = text, 3.5

    def load(self):
        try:
            d = json.load(open(SAVE, encoding="utf-8"))
            self.level = max(1, int(d.get("level", 1)))
            self.best = max(1, int(d.get("best", self.level)))
        except Exception:
            pass

    def save(self):
        try:
            with open(SAVE + ".tmp", "w", encoding="utf-8") as fh:
                json.dump(dict(level=self.level, best=max(self.best, self.level)), fh)
            os.replace(SAVE + ".tmp", SAVE)
        except OSError:
            pass

    def quit(self):
        self.save()
        self.root.destroy()

    # ---------------------------------------------------------------- shop
    def items(self):
        """(key, title, subtitle, price or None, enabled)"""
        n_guppy = sum(1 for f in self.fish if not f.is_dead)
        out = [
            ("guppy", "Magikarp", "baby, grows & makes coins", 100, n_guppy < MAX_FISH),
            ("breeder", "Seaking", "gives birth to Goldeen", 250, n_guppy < MAX_FISH),
            ("carn", "Gyarados", "eats babies, drops diamonds", 1000, n_guppy < MAX_FISH),
            ("remo", "Remoraid", "grabs coins, shoots boss", 600, True),
            ("relic", "Relicanth", "makes pearls ($250)", 1500, True),
        ]
        fl = 200 + 100 * self.food_lvl
        out.append(("food", "More Food  (%d)" % (1 + self.food_lvl), "max food on screen", fl if self.food_lvl < 7 else None, self.food_lvl < 7))
        ql = 300 + 300 * self.qual_lvl
        out.append(("qual", "Food Quality  (%d)" % (self.qual_lvl + 1), "more growth per food", ql if self.qual_lvl < 2 else None, self.qual_lvl < 2))
        wl = 500 + 300 * self.weap_lvl
        out.append(("weap", "Weapon  (%d)" % (self.weap_lvl + 1), "more damage per click", wl if self.weap_lvl < 4 else None, self.weap_lvl < 4))
        out.append(("auto", "Auto Feeder", "feeds hungry fish ($5 each)", 400 if not self.autofeed else None, not self.autofeed))
        out.append(("egg", "Egg Piece  %d/3" % self.eggs, "finish the level!", self.egg_cost() if self.eggs < 3 else None, self.eggs < 3))
        return out

    def build_shop(self):
        self.btns = {}
        for i, (key, *_r) in enumerate(self.items()):
            b = tk.Button(self.shop, command=lambda k=key: self.buy(k), bg="#1f4b73", fg="white", activebackground="#2d6aa3", activeforeground="white",
                          relief="flat", font=("Segoe UI", 8), width=19, height=3, cursor="hand2", justify="center", disabledforeground="#7d8c9b")
            b.grid(row=i // 5, column=i % 5, padx=2, pady=2, sticky="nsew")
            self.btns[key] = b
        self.fs_btn = tk.Button(self.shop, text="\u26f6 Fullscreen\n(F11)", command=self.toggle_fullscreen, bg="#2d6aa3", fg="white",
                                activebackground="#3b7fc0", activeforeground="white", relief="flat", font=("Segoe UI", 9, "bold"), width=12, cursor="hand2")
        self.fs_btn.grid(row=0, column=5, rowspan=2, padx=2, pady=2, sticky="nsew")
        for c in range(5):
            self.shop.grid_columnconfigure(c, weight=1)

    def refresh_shop(self):
        for key, title, sub, price, enabled in self.items():
            can = self.state == "play" and enabled and price is not None and self.cash >= price
            self.btns[key].config(text="%s\n%s\n%s" % (title, money(price) if price is not None else "-", sub), state="normal" if can else "disabled",
                                  bg="#1f4b73" if can else "#25313d", fg="white" if can else "#7d8c9b")

    def buy(self, key):
        if self.state != "play":
            return
        price = next(p for k, _t, _s, p, _e in self.items() if k == key)
        if price is None or self.cash < price:
            return
        self.cash -= price
        if key in ("guppy", "breeder", "carn", "remo", "relic"):
            f = E(key, random.uniform(100, W - 100), TOP)
            self.fish.append(f)
        elif key == "food":
            self.food_lvl += 1
        elif key == "qual":
            self.qual_lvl += 1
        elif key == "weap":
            self.weap_lvl += 1
        elif key == "auto":
            self.autofeed = True
        elif key == "egg":
            self.eggs += 1
            self.say("Egg piece %d/3!" % self.eggs)
            if self.eggs >= 3:
                self.win()
        self.refresh_shop()

    # ---------------------------------------------------------------- overlay
    def clear_overlay(self):
        self.canvas.delete("ov")
        if self.state == "play":
            self.ov_args = None

    def overlay(self, title, lines, button, command):
        c = self.canvas
        self.ov_args = (title, lines, button, command)
        self.clear_overlay()
        c.create_rectangle(0, 0, W, H, fill="#000", stipple="gray50", outline="", tags="ov")
        c.create_rectangle(W / 2 - 230, H / 2 - 130, W / 2 + 230, H / 2 + 130, fill="#102a43", outline="#7fd1ff", width=3, tags="ov")
        c.create_text(W / 2, H / 2 - 90, text=title, fill="#ffd34d", font=("Segoe UI", 24, "bold"), tags="ov")
        c.create_text(W / 2, H / 2 - 10, text="\n".join(lines), fill="white", font=("Segoe UI", 12), justify="center", tags="ov")
        b = tk.Button(self.root, text=button, command=command, bg="#2d6aa3", fg="white", relief="flat", font=("Segoe UI", 12, "bold"), padx=20, pady=6, cursor="hand2")
        c.create_window(W / 2, H / 2 + 85, window=b, tags="ov")

    def win(self):
        self.state = "won"
        self.best = max(self.best, self.level)
        left = sum(1 for f in self.fish if not f.is_dead)
        self.overlay("LEVEL %d COMPLETE!" % self.level, ["The egg hatches!", "Time %d:%02d   Fish alive: %d   Cash left: %s" % (self.t // 60, self.t % 60, left, money(self.cash))],
                     "Next level >", self.next_level)
        self.level += 1
        self.save()

    def next_level(self):
        self.new_level()

    def lose(self):
        self.state = "lost"
        self.overlay("ALL FISH LOST", ["Your fish starved or were eaten.", "Level %d is waiting for you." % self.level], "Try again", self.new_level)
        self.refresh_shop()

    # ---------------------------------------------------------------- scene
    def draw_static(self):
        c = self.canvas
        S = self.S
        steps = 40
        for i in range(steps):
            f = i / steps
            c.create_rectangle(0, i * H / steps, W, (i + 1) * H / steps + 1, fill="#%02x%02x%02x" % (int(20 + 10 * f), int(110 - 60 * f), int(170 - 70 * f)), outline="")
        for i in range(max(5, int(W / 180))):
            x = 100 * S + i * 190 * S
            c.create_polygon(x, 0, x + 60 * S, 0, x + 160 * S, SAND_Y, x + 40 * S, SAND_Y, fill="#2f8cc0", stipple="gray12", outline="")
        c.create_rectangle(0, SAND_Y, W, H, fill="#d9c28a", outline="")
        for _ in range(int(80 * W / BASE_W)):
            x, y = random.randint(0, int(W)), random.randint(int(SAND_Y) + 4, int(H) - 3)
            c.create_oval(x, y, x + random.randint(2, 5) * S, y + 2 * S, fill=random.choice(["#c4ac72", "#e9d9a6", "#b99f66"]), outline="")
        self.weed = [(fx * W, random.randint(60, 120) * S, random.random() * 6) for fx in (0.03, 0.08, 0.2, 0.5, 0.62, 0.9, 0.95)]
        self.weed_ids = [c.create_line(0, 0, 0, 0, width=max(4, int(6 * S)), fill="#2e9e5b", smooth=True, capstyle="round") for _ in self.weed]

    def set_size(self, nw, nh):
        """Resize the tank (window or fullscreen) and keep everything in it in the same relative place."""
        global W, H, SAND_Y, TOP, BOT
        ow, oh = W, H
        W, H = int(nw), int(nh)
        self.S = max(0.5, min(3.0, round(H / BASE_H, 2)))
        SAND_Y, TOP, BOT = H - 60 * self.S, 70 * self.S, H - 60 * self.S - 30 * self.S
        rx, ry = W / ow, H / oh
        for f in self.fish:
            f.x, f.y, f.tx, f.ty = f.x * rx, f.y * ry, f.tx * rx, f.ty * ry
        for lst in (self.pellets, self.coins, self.bubbles):
            for o in lst:
                o["x"], o["y"] = o["x"] * rx, o["y"] * ry
        self.shots = []
        self.canvas.config(width=W, height=H)
        self.canvas.delete("all")
        self.draw_static()
        if self.ov_args and self.state != "play":
            self.overlay(*self.ov_args)

    def toggle_fullscreen(self, on=None):
        self.fullscreen = (not self.fullscreen) if on is None else on
        self.root.attributes("-fullscreen", self.fullscreen)
        self.root.update_idletasks()
        if self.fullscreen:
            self.root.resizable(True, True)
            self.root.update_idletasks()
            self.set_size(self.root.winfo_screenwidth(), self.root.winfo_screenheight() - self.shop.winfo_reqheight() - 2)
            self.fs_btn.config(text="\u26f6 Exit\nfullscreen (Esc)")
        else:
            self.set_size(BASE_W, BASE_H)
            self.root.resizable(False, False)
            self.fs_btn.config(text="\u26f6 Fullscreen\n(F11)")

    # ---------------------------------------------------------------- input
    def on_click(self, e):
        if self.state != "play":
            return
        # coins first
        for co in sorted(self.coins, key=lambda c: -c["y"]):
            if math.hypot(co["x"] - e.x, co["y"] - e.y) < 24 * self.S:
                self.collect(co)
                return
        # boss
        b = self.boss
        if b:
            w, h = b.size(self.sheets, self.S)
            if abs(b.x - e.x) < w / 2 and abs(b.y - e.y) < h / 2:
                self.hit_boss(1 + self.weap_lvl)
                self.shots.append((e.x, e.y, 0.15, "click"))
                return
        # food
        if e.y > 20 and self.cash >= FOOD_COST and len(self.pellets) < 1 + self.food_lvl:
            self.cash -= FOOD_COST
            self.pellets.append(dict(x=e.x, y=e.y, vy=0, life=7.0))
            self.refresh_shop()

    def collect(self, co):
        val = COINS[co["kind"]][0]
        self.cash += val
        self.floaters.append([co["x"], co["y"], "+%d" % val, COINS[co["kind"]][1], 1.0])
        self.coins.remove(co)
        self.refresh_shop()

    def hit_boss(self, dmg):
        b = self.boss
        if not b:
            return
        b.hp -= dmg
        b.shake = 0.15
        if b.hp <= 0:
            self.floaters.append([b.x, b.y, "DEFEATED!", "#ffd34d", 1.8])
            for _ in range(3):
                self.coins.append(dict(x=b.x + random.uniform(-30, 30), y=b.y, val=100, kind="trophy", age=0.0))
            self.fish.remove(b)
            self.boss = None
            self.boss_clock = 55 + random.uniform(0, 15)
            self.say("The raging Gyarados is gone!")

    def drop_coin(self, x, y, kind):
        self.coins.append(dict(x=x, y=y, kind=kind, age=0.0))

    # ---------------------------------------------------------------- simulation
    def alive_fish(self):
        return [f for f in self.fish if not f.is_dead and f.kind != "boss"]

    def update(self, dt):
        if self.state != "play":
            return
        self.t += dt
        if self.msg_t > 0:
            self.msg_t -= dt
        # boss spawn
        if not self.boss:
            self.boss_clock -= dt
            if self.boss_clock <= 0:
                b = E("boss", random.choice([40, W - 40]), random.uniform(TOP, BOT))
                b.hp = 22 + 10 * self.level
                b.cool = 3.0
                self.boss = b
                self.fish.append(b)
                self.say("A raging Gyarados appears! Click it!")
        # bubbles
        if random.random() < dt * 3:
            self.bubbles.append(dict(x=random.choice([40, 820, 560]) + random.uniform(-12, 12), y=SAND_Y, r=random.uniform(2, 6), sp=random.uniform(30, 70)))
        for b in self.bubbles[:]:
            b["y"] -= b["sp"] * dt
            b["x"] += math.sin(b["y"] / 14) * 12 * dt
            if b["y"] < 0:
                self.bubbles.remove(b)
        # auto feeder
        if self.autofeed:
            self.auto_t -= dt
            hungry = [f for f in self.alive_fish() if not f.pet and f.kind in ("guppy", "breeder") and f.hunger < 55]
            if self.auto_t <= 0 and hungry and self.cash >= FOOD_COST and len(self.pellets) < 1 + self.food_lvl:
                self.auto_t = 4.0
                self.cash -= FOOD_COST
                f = random.choice(hungry)
                self.pellets.append(dict(x=max(30, min(W - 30, f.x + random.uniform(-40, 40))), y=25, vy=0, life=7.0))
                self.refresh_shop()
        # food
        for p in self.pellets[:]:
            p["vy"] = min(45 * self.S, p["vy"] + 60 * self.S * dt)
            p["y"] += p["vy"] * dt
            if p["y"] >= SAND_Y + 4:
                p["y"] = SAND_Y + 4
                p["life"] -= dt
                if p["life"] <= 0:
                    self.pellets.remove(p)
        # coins
        for co in self.coins[:]:
            if co["y"] < SAND_Y - 8:
                co["y"] += 45 * self.S * dt
            co["age"] += dt
            if co["age"] > 14:
                self.coins.remove(co)
        # fish
        for f in self.fish[:]:
            self.update_fish(f, dt)
        self.shots = [(x, y, t - dt, k) for x, y, t, k in self.shots if t - dt > 0]
        for ft in self.floaters[:]:
            ft[1] -= 30 * dt
            ft[4] -= dt
            if ft[4] <= 0:
                self.floaters.remove(ft)
        # lose check
        if not self.alive_fish() or not any(not f.is_dead and not f.pet and f.kind in ("guppy", "breeder", "carn") for f in self.fish):
            if self.cash < 100 and not self.coins:
                self.lose()

    def move(self, f, dt, boost=1.0):
        dx, dy = f.tx - f.x, f.ty - f.y
        dist = math.hypot(dx, dy)
        if dist > 4:
            v = SPEED[f.kind] * boost * self.S
            f.x += dx / dist * min(v * dt, dist)
            f.y += dy / dist * min(v * dt, dist)
            if abs(dx) > 4:
                f.right = dx > 0
        f.y = max(TOP - 30, min(SAND_Y - 12, f.y))
        f.x = max(25, min(W - 25, f.x))
        return dist

    def wander(self, f, dt):
        if f.mode == "idle":
            f.timer -= dt
            if f.timer <= 0:
                f.tx, f.ty = random.uniform(50, W - 50), random.uniform(TOP, BOT)
                f.mode = "swim"
        else:
            if self.move(f, dt) <= 6:
                f.mode = "idle"
                f.timer = random.uniform(0.5, 3)

    def update_fish(self, f, dt):
        f.shake = max(0, f.shake - dt)
        f.shoot = max(0, f.shoot - dt)
        if f.is_dead:
            f.dead -= dt
            f.y = min(SAND_Y - 4, f.y + 25 * dt)
            if f.dead <= 0:
                self.fish.remove(f)
            self.animate(f, dt, "Idle")
            return
        k = f.kind
        anim = "Walk" if f.mode == "swim" else "Idle"
        if k == "boss":
            f.cool -= dt
            targets = [o for o in self.alive_fish() if not o.pet]
            if targets:
                tgt = min(targets, key=lambda o: math.hypot(o.x - f.x, o.y - f.y))
                f.tx, f.ty = tgt.x, tgt.y
                f.mode = "swim"
                if self.move(f, dt, 1 + 0.04 * self.level) < 38 and f.cool <= 0:
                    f.cool = 2.6
                    self.floaters.append([tgt.x, tgt.y, "CHOMP!", "#ff6b6b", 1.0])
                    self.kill(tgt)
            else:
                self.wander(f, dt)
        elif k in ("remo", "relic"):
            if k == "relic":
                f.coin_t -= dt
                if f.coin_t <= 0:
                    f.coin_t = 60
                    self.drop_coin(f.x, f.y, "pearl")
                self.wander(f, dt)
            else:
                b = self.boss
                if b:
                    f.tx, f.ty = b.x + (-140 if f.x < b.x else 140), b.y
                    f.mode = "swim"
                    d = math.hypot(b.x - f.x, b.y - f.y)
                    if d < 220:
                        f.mode = "idle"
                        f.right = b.x > f.x
                        f.cool -= dt
                        if f.cool <= 0:
                            f.cool = 1.2
                            f.shoot = 0.4
                            self.shots.append((f.x, f.y, 0.2, (b.x, b.y)))
                            self.hit_boss(1 + self.weap_lvl // 2)
                    else:
                        self.move(f, dt)
                elif self.coins:
                    co = min(self.coins, key=lambda c: math.hypot(c["x"] - f.x, c["y"] - f.y))
                    f.tx, f.ty = co["x"], co["y"]
                    f.mode = "swim"
                    if self.move(f, dt, 1.4) < 24:
                        self.collect(co)
                else:
                    self.wander(f, dt)
        else:
            self.update_eater(f, dt)
        if f.shoot > 0:
            anim = "Shoot"
        self.animate(f, dt, anim)

    def update_eater(self, f, dt):
        k = f.kind
        f.hunger -= dt * (2.9 if k == "carn" else 2.5)
        if f.hunger <= 0:
            self.kill(f)
            return
        hungry = f.hunger < (60 if k == "carn" else 55)
        target = None
        if hungry:
            if k == "carn":
                prey = [o for o in self.fish if o.kind == "guppy" and o.stage == 0 and not o.is_dead]
                if prey:
                    target = min(prey, key=lambda o: math.hypot(o.x - f.x, o.y - f.y))
            elif self.pellets:
                target = min(self.pellets, key=lambda p: math.hypot(p["x"] - f.x, p["y"] - f.y))
        if target is not None:
            tx, ty = (target.x, target.y) if isinstance(target, E) else (target["x"], target["y"])
            f.tx, f.ty = tx, min(ty, SAND_Y - 14)
            f.mode = "swim"
            d = self.move(f, dt, 1.7)
            reach = 26 if k != "carn" else 40
            if math.hypot(tx - f.x, ty - f.y) < reach:
                if isinstance(target, E):
                    self.fish.remove(target)
                else:
                    self.pellets.remove(target)
                f.hunger = 100
                if k == "guppy":
                    f.growth += 1 + self.qual_lvl
                    if f.stage < 2 and f.growth >= GROW_NEED[f.stage]:
                        f.stage += 1
                        f.growth = 0
                        self.floaters.append([f.x, f.y - 30, "grew!", "#a6ffcb", 1.2])
        else:
            self.wander(f, dt)
        # production
        if k == "guppy" and f.stage >= 1:          # babies (stage 0) never drop coins; they must grow first
            f.coin_t -= dt
            if f.coin_t <= 0:
                f.coin_t = random.uniform(8, 12)
                self.drop_coin(f.x, f.y, "silver" if f.stage == 1 else "gold")
        elif k == "carn":
            f.coin_t -= dt
            if f.coin_t <= 0:
                f.coin_t = random.uniform(11, 15)
                self.drop_coin(f.x, f.y, "diamond")
        elif k == "breeder" and f.hunger > 40:
            f.spawn_t -= dt
            if f.spawn_t <= 0:
                f.spawn_t = random.uniform(16, 22)
                if len(self.alive_fish()) < MAX_FISH:
                    self.fish.append(E("guppy", f.x, f.y, 0, "goldeen"))
                    self.floaters.append([f.x, f.y - 30, "a baby Goldeen!", "#ffc6e0", 1.2])

    def kill(self, f):
        if f.is_dead:
            return
        f.is_dead = True
        f.dead = 5.0

    def animate(self, f, dt, anim):
        tint = "red" if f.kind == "boss" else None
        frames, durs = self.sheets.get(f.species, anim, f.right, f.scale * self.S, tint, f.is_dead)
        f.ftime += dt * 60
        f.frame %= len(frames)
        while f.ftime >= max(1, durs[f.frame]):
            f.ftime -= max(1, durs[f.frame])
            f.frame = (f.frame + 1) % len(frames)
        f.img = frames[f.frame]

    # ---------------------------------------------------------------- drawing
    def draw(self):
        c = self.canvas
        S = self.S
        fs = lambda n: max(6, int(n * S))
        c.delete("dyn")
        t = time.time()
        for i, (x, h, ph) in enumerate(self.weed):
            pts = []
            for k in range(6):
                pts += [x + math.sin(t * 1.3 + ph + k * 0.7) * (k * 3.2 * S), SAND_Y + 6 * S - k * h / 5]
            c.coords(self.weed_ids[i], *pts)
        for b in self.bubbles:
            r = b["r"] * S
            c.create_oval(b["x"] - r, b["y"] - r, b["x"] + r, b["y"] + r, outline="#cdeeff", tags="dyn")
        for p in self.pellets:
            r = 4 * S
            c.create_oval(p["x"] - r, p["y"] - r, p["x"] + r, p["y"] + r, fill="#c98a3a", outline="#7a4f1c", tags="dyn")
        for f in sorted(self.fish, key=lambda f: f.y):
            if not f.img:
                continue
            ox = random.uniform(-3, 3) * S if f.shake > 0 else 0
            c.create_image(f.x + ox, f.y + math.sin(t * 2 + f.x / 50) * 2 * S, image=f.img, tags="dyn")
            top = f.y - f.img.height() / 2
            if f.is_dead:
                continue
            if f.kind == "boss":
                m = 22 + 10 * self.level
                c.create_rectangle(f.x - 30 * S, top - 12 * S, f.x + 30 * S, top - 6 * S, fill="#400", outline="white", tags="dyn")
                c.create_rectangle(f.x - 30 * S, top - 12 * S, f.x - 30 * S + 60 * S * max(0, f.hp) / m, top - 6 * S, fill="#ff4d4d", outline="", tags="dyn")
            elif not f.pet and f.hunger < (60 if f.kind == "carn" else 55):
                col = "#ff4d4d" if f.hunger < 25 else "#ffd34d"
                c.create_text(f.x, top - 8 * S, text="!", fill=col, font=("Segoe UI", fs(14), "bold"), tags="dyn")
        for x, y, tleft, tgt in self.shots:
            if isinstance(tgt, tuple):
                c.create_line(x, y, tgt[0], tgt[1], fill="#7fe9ff", width=max(3, int(4 * S)), tags="dyn")
            else:
                r = 14 * S
                c.create_oval(x - r, y - r, x + r, y + r, outline="#fff36b", width=3, tags="dyn")
        for co in self.coins:
            val, fill, edge = COINS[co["kind"]]
            if co["age"] > 11 and int(co["age"] * 8) % 2 == 0:
                continue
            x, y = co["x"], co["y"]
            if co["kind"] == "diamond":
                c.create_polygon(x, y - 14 * S, x + 12 * S, y, x, y + 14 * S, x - 12 * S, y, fill=fill, outline=edge, width=2, tags="dyn")
            else:
                r = (11 if co["kind"] in ("silver", "gold") else 14) * S
                c.create_oval(x - r, y - r, x + r, y + r, fill=fill, outline=edge, width=2, tags="dyn")
                c.create_text(x, y, text="$", fill=edge, font=("Segoe UI", fs(10), "bold"), tags="dyn")
        for x, y, text, color, life in self.floaters:
            c.create_text(x, y, text=text, fill=color, font=("Segoe UI", fs(12), "bold"), tags="dyn")
        c.create_text(14 * S, 10 * S, anchor="nw", text=money(self.cash), fill="#fff", font=("Segoe UI", fs(24), "bold"), tags="dyn")
        c.create_text(16 * S, 46 * S, anchor="nw", text="Level %d    Egg %s    Best level %d" % (self.level, "\u25cf" * self.eggs + "\u25cb" * (3 - self.eggs), self.best),
                      fill="#bfe6ff", font=("Segoe UI", fs(11)), tags="dyn")
        if self.msg_t > 0:
            c.create_text(W / 2, 20 * S, text=self.msg, fill="#ffd34d", font=("Segoe UI", fs(14), "bold"), tags="dyn")
        c.tag_raise("ov")

    def tick(self):
        now = time.time()
        dt = min(0.1, now - self.last)
        self.last = now
        self.update(dt)
        self.draw()
        if int(now * 2) != int((now - dt) * 2):
            self.refresh_shop()
        self.root.after(int(1000 / FPS), self.tick)


def main():
    root = tk.Tk()
    Game(root)
    root.mainloop()


if __name__ == "__main__":
    main()
