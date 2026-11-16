"""FISH TANK 3 - a roguelike card game in an Insaniquarium-style fish tank (fish Pokemon sprites only).

A RUN is a climb through floors. Each floor you must earn a coin QUOTA (every 5th floor also has an ELITE Gyarados to beat).
Coins give XP. Every level-up you are shown 4 CARDS and must take one: upgrades, trade-offs, or curses that pay you back.
Lose all your fish and the run is over - then start a new run with new cards.

  Magikarp = guppy (baby > medium > large, drops coins once grown)   Seaking = breeder (gives birth to Goldeen)
  Gyarados = carnivore (eats babies, drops diamonds)   Remoraid = pet (grabs coins, shoots the boss)   Relicanth = pet (pearls)
Left click: pick up coins / hit the raging Gyarados / otherwise drop food.   F11 = fullscreen.   1-4 = pick a card.
Needs python 3 + Pillow. Run START_FISH_TANK_3.bat or:  python fishtank3.py
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
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import cards as cd  # noqa: E402

SPRITES = os.path.join(HERE, "sprites")
SAVE = os.path.join(HERE, "save.json")

BASE_W, BASE_H = 900, 600
W, H = BASE_W, BASE_H
FPS = 30
SAND_Y = H - 60
TOP, BOT = 70, SAND_Y - 30
RIGHT_ROW, LEFT_ROW = 2, 6
MAX_FISH = 18

SPECIES = {"guppy": "magikarp", "breeder": "seaking", "carn": "gyarados", "remo": "remoraid", "relic": "relicanth", "boss": "gyarados"}
SCALE = {"breeder": 1.7, "carn": 1.0, "remo": 1.7, "relic": 1.9, "boss": 1.5}
GUPPY_SCALE = [1.1, 1.6, 2.2]
SPEED = {"guppy": 55, "breeder": 60, "carn": 75, "remo": 80, "relic": 40, "boss": 70}
GROW_NEED = [5, 7]
COINS = {"silver": (15, "#d9e1e8", "#8a98a6"), "gold": (35, "#ffd34d", "#a67c00"), "diamond": (200, "#7fe9ff", "#1b8fb0"),
         "pearl": (250, "#fff0f6", "#c78aa6"), "trophy": (100, "#ffb347", "#a35a00")}
BASE_QUOTA, QUOTA_GROWTH = 180, 1.3


def money(n):
    return "$%d" % n


def xp_needed(level):
    return int(45 * 1.35 ** (level - 1))


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
            if tint:
                r, g, b, a = fr.split()
                fr = Image.merge("RGBA", (b, g, r, a) if tint == "red" else (b, r, g, a))
            if dead:
                fr = fr.transpose(Image.FLIP_TOP_BOTTOM).convert("LA").convert("RGBA")
            fr = fr.resize((max(1, int(fw * scale)), max(1, int(fh * scale))), Image.NEAREST)
            frames.append(ImageTk.PhotoImage(fr))
        res = (frames, (durs + [6] * n)[:n])
        self.cache[key] = res
        return res


# ----------------------------------------------------------------------------------------------- entities
class E:
    def __init__(self, kind, x=None, y=None, stage=0, species=None):
        self.kind = kind
        self.species = species or SPECIES[kind]
        self.x = x if x is not None else random.uniform(80, W - 80)
        self.y = y if y is not None else random.uniform(TOP, BOT)
        self.tx, self.ty = self.x, self.y
        self.right = random.random() < 0.5
        self.mode = "idle"
        self.timer = random.uniform(0.2, 2)
        self.frame, self.ftime = 0, 0.0
        self.hunger = 100.0 if kind != "guppy" else random.uniform(70, 100)
        self.stage = stage
        self.growth = 0
        self.coin_t = random.uniform(5, 10)
        self.spawn_t = random.uniform(10, 18)
        self.dead = 0.0
        self.is_dead = False
        self.hp = 0
        self.max_hp = 1
        self.elite = False
        self.cool = 0.0
        self.shoot = 0.0
        self.shake = 0.0
        self.img = None

    @property
    def pet(self):
        return self.kind in ("remo", "relic")

    @property
    def scale(self):
        if self.kind == "guppy":
            return GUPPY_SCALE[self.stage]
        if self.kind == "boss" and self.elite:
            return 2.1
        return SCALE[self.kind]

    @property
    def tint(self):
        return ("violet" if self.elite else "red") if self.kind == "boss" else None

    def size(self, sheets, S=1.0):
        fr, _ = sheets.get(self.species, "Idle", True, self.scale * S, self.tint)
        return fr[0].width(), fr[0].height()


class Game:
    def __init__(self, root):
        self.root = root
        root.title("FISH TANK 3 - roguelike")
        root.configure(bg="#0b1d2e")
        root.resizable(False, False)
        self.sheets = Sheets()
        self.S = 1.0
        self.fullscreen = False
        self.ov_func = None
        self.ov_widgets = []
        self.card_boxes, self.card_rects, self.offer = [], [], []
        self.state = "title"
        self.shop = tk.Frame(root, bg="#102a43")
        self.shop.grid(row=0, column=0, sticky="ew")
        self.canvas = tk.Canvas(root, width=W, height=H, highlightthickness=0, bg="#0b1d2e")
        self.canvas.grid(row=1, column=0)
        self.stats = dict(best_floor=0, best_level=0, runs=0, seen=[])
        self.load()
        self.reset_run_state()
        self.build_shop()
        self.draw_static()
        self.canvas.bind("<Button-1>", self.on_click)
        self.canvas.bind("<Motion>", self.on_motion)
        root.bind("<F11>", lambda e: self.toggle_fullscreen())
        root.bind("<Escape>", lambda e: self.toggle_fullscreen(False) if self.fullscreen else None)
        for i in range(4):
            root.bind(str(i + 1), lambda e, i=i: self.pick_card(i) if self.state == "cards" else None)
        root.protocol("WM_DELETE_WINDOW", self.quit)
        self.show_title()
        self.last = time.time()
        self.tick()

    # ---------------------------------------------------------------- run state
    def reset_run_state(self):
        self.mods = dict(cd.DEFAULT_MODS)
        self.cards = {}
        self.cash = 150
        self.floor = 1
        self.plevel = 1
        self.xp = 0.0
        self.pending = 0
        self.rerolls = 1
        self.total_earned = 0
        self.food_lvl = self.qual_lvl = self.weap_lvl = 0
        self.autofeed = False
        self.auto_t = 0.0
        self.fish = [E("guppy"), E("guppy")]
        self.pellets, self.coins, self.floaters, self.bubbles, self.shots = [], [], [], [], []
        self.boss = None
        self.elite_dead = False
        self.t = 0.0
        self.msg, self.msg_t = "", 0.0
        self.new_floor(first=True)

    def new_floor(self, first=False):
        if not first:
            self.floor += 1
        self.floor_cash = 0
        self.quota = int(BASE_QUOTA * QUOTA_GROWTH ** (self.floor - 1) * self.mods["quota_mult"])
        self.is_elite = self.floor % 5 == 0
        self.elite_dead = False
        self.pellets, self.coins = [], []
        if self.boss and self.boss in self.fish:
            self.fish.remove(self.boss)
        self.boss = None
        base = 8.0 if self.is_elite else max(15.0, 46 - 3 * self.floor)
        self.boss_clock = base * self.mods["boss_clock"]
        for f in self.fish:
            if not f.is_dead:
                f.hunger = 100.0
        self.say("Floor %d - earn %s%s" % (self.floor, money(self.quota), "  (ELITE boss!)" if self.is_elite else ""))

    def start_run(self):
        self.reset_run_state()
        self.stats["runs"] += 1
        self.save()
        self.offer_cards(starter=True)

    def say(self, text, secs=4.0):
        self.msg, self.msg_t = text, secs

    # ---------------------------------------------------------------- save
    def load(self):
        try:
            d = json.load(open(SAVE, encoding="utf-8"))
            for k in ("best_floor", "best_level", "runs"):
                self.stats[k] = int(d.get(k, 0))
            self.stats["seen"] = [s for s in d.get("seen", []) if s in cd.BY_ID]
        except Exception:
            pass

    def save(self):
        try:
            with open(SAVE + ".tmp", "w", encoding="utf-8") as fh:
                json.dump(self.stats, fh)
            os.replace(SAVE + ".tmp", SAVE)
        except OSError:
            pass

    def quit(self):
        self.save()
        self.root.destroy()

    # ---------------------------------------------------------------- economy helpers
    def capacity(self):
        return MAX_FISH + self.mods["max_fish"]

    def n_fish(self):
        return sum(1 for f in self.fish if not f.is_dead and f.kind != "boss")

    def food_cost(self):
        return max(1, int(self.mods["food_cost"]))

    def food_limit(self):
        return 1 + self.food_lvl + self.mods["food_limit"]

    def gain_cash(self, n):
        self.cash += n
        self.total_earned += max(0, n)

    def spawn(self, kind, species=None):
        if self.n_fish() >= self.capacity():
            self.say("Tank is full - the free fish swam away!")
            return None
        f = E(kind, random.uniform(100, W - 100), TOP, 0, species)
        self.fish.append(f)
        return f

    def sacrifice(self):
        babies = [f for f in self.fish if f.kind == "guppy" and not f.is_dead]
        if babies:
            v = min(babies, key=lambda f: f.stage)
            self.fish.remove(v)
            self.floaters.append([v.x, v.y, "goodbye...", "#ff9a9a", 1.5])

    def add_xp(self, n, raw=False):
        n = n if raw else n * self.mods["xp_mult"]
        self.xp += n
        while self.xp >= xp_needed(self.plevel):
            self.xp -= xp_needed(self.plevel)
            self.plevel += 1
            self.pending += 1
            self.say("LEVEL UP!  Level %d" % self.plevel, 3.0)
            self.stats["best_level"] = max(self.stats["best_level"], self.plevel)

    # ---------------------------------------------------------------- shop
    def items(self):
        sm = self.mods["shop_mult"]
        full = self.n_fish() >= self.capacity()
        p = lambda base: int(base * sm)
        fl = 200 + 100 * self.food_lvl
        out = [
            ("guppy", "Magikarp", "baby, grows & makes coins", p(100), not full),
            ("breeder", "Seaking", "gives birth to Goldeen", p(250), not full),
            ("carn", "Gyarados", "eats babies, drops diamonds", p(1000), not full),
            ("remo", "Remoraid", "grabs coins, shoots boss", p(600), not full),
            ("relic", "Relicanth", "makes pearls ($250)", p(1500), not full),
            ("food", "More Food  (%d)" % self.food_limit(), "max food in the water", p(fl) if self.food_lvl < 7 else None, self.food_lvl < 7),
            ("qual", "Food Quality  (%d)" % (self.qual_lvl + 1), "more growth per food", p(300 + 300 * self.qual_lvl) if self.qual_lvl < 2 else None, self.qual_lvl < 2),
            ("weap", "Weapon  (%d)" % (self.weap_lvl + 1), "more damage per click", p(500 + 300 * self.weap_lvl) if self.weap_lvl < 4 else None, self.weap_lvl < 4),
            ("auto", "Auto Feeder", "feeds hungry fish", p(400) if not self.autofeed else None, not self.autofeed and self.mods["auto_feed"] < 1),
        ]
        return out

    def build_shop(self):
        self.btns = {}
        keys = [k for k, *_r in self.items()] + ["deck"]
        for i, key in enumerate(keys):
            b = tk.Button(self.shop, command=lambda k=key: self.buy(k), bg="#1f4b73", fg="white", activebackground="#2d6aa3", activeforeground="white",
                          relief="flat", font=("Segoe UI", 8), width=19, height=3, cursor="hand2", justify="center", disabledforeground="#7d8c9b")
            b.grid(row=i // 5, column=i % 5, padx=2, pady=2, sticky="nsew")
            self.btns[key] = b
        self.fs_btn = tk.Button(self.shop, text="⛶ Fullscreen\n(F11)", command=self.toggle_fullscreen, bg="#2d6aa3", fg="white", activebackground="#3b7fc0",
                                activeforeground="white", relief="flat", font=("Segoe UI", 9, "bold"), width=12, cursor="hand2")
        self.fs_btn.grid(row=0, column=5, rowspan=2, padx=2, pady=2, sticky="nsew")
        for c in range(5):
            self.shop.grid_columnconfigure(c, weight=1)

    def refresh_shop(self):
        playing = self.state == "play"
        for key, title, sub, price, enabled in self.items():
            can = playing and enabled and price is not None and self.cash >= price
            self.btns[key].config(text="%s\n%s\n%s" % (title, money(price) if price is not None else "-", sub), state="normal" if can else "disabled",
                                  bg="#1f4b73" if can else "#25313d", fg="white" if can else "#7d8c9b")
        n = sum(self.cards.values())
        self.btns["deck"].config(text="Your Cards\n%d taken\nclick to view" % n, state="normal" if playing else "disabled",
                                 bg="#5a3d8a" if playing else "#25313d", fg="white" if playing else "#7d8c9b")

    def buy(self, key):
        if self.state != "play":
            return
        if key == "deck":
            return self.show_deck()
        price = next(p for k, _t, _s, p, _e in self.items() if k == key)
        if price is None or self.cash < price:
            return
        if key in ("guppy", "breeder", "carn", "remo", "relic"):
            if self.spawn(key) is None:
                return
        elif key == "food":
            self.food_lvl += 1
        elif key == "qual":
            self.qual_lvl += 1
        elif key == "weap":
            self.weap_lvl += 1
        elif key == "auto":
            self.autofeed = True
        self.cash -= price
        self.refresh_shop()

    # ---------------------------------------------------------------- overlays
    def clear_overlay(self):
        self.canvas.delete("ov")
        for w in self.ov_widgets:
            try:
                w.destroy()
            except tk.TclError:
                pass
        self.ov_widgets = []

    def ov_button(self, text, cmd, x, y, bg="#2d6aa3", state="normal"):
        b = tk.Button(self.root, text=text, command=cmd, bg=bg, fg="white", relief="flat", font=("Segoe UI", max(10, int(12 * self.S)), "bold"),
                      padx=20, pady=6, cursor="hand2", state=state, disabledforeground="#9aa7b4")
        self.canvas.create_window(x, y, window=b, tags="ov")
        self.ov_widgets.append(b)
        return b

    def ov_backdrop(self):
        self.clear_overlay()
        self.canvas.create_rectangle(0, 0, W, H, fill="#000", stipple="gray50", outline="", tags="ov")

    def ov_panel(self, w, h, y_off=0):
        S = self.S
        self.canvas.create_rectangle(W / 2 - w * S / 2, H / 2 - h * S / 2 + y_off, W / 2 + w * S / 2, H / 2 + h * S / 2 + y_off,
                                     fill="#102a43", outline="#7fd1ff", width=3, tags="ov")

    def show_title(self):
        self.state = "title"
        self.ov_func = self.show_title
        S = self.S
        c = self.canvas
        self.ov_backdrop()
        self.ov_panel(560, 420)
        fs = lambda n: max(8, int(n * S))
        c.create_text(W / 2, H / 2 - 170 * S, text="FISH TANK 3", fill="#ffd34d", font=("Segoe UI", fs(30), "bold"), tags="ov")
        c.create_text(W / 2, H / 2 - 132 * S, text="a roguelike card run", fill="#7fd1ff", font=("Segoe UI", fs(13)), tags="ov")
        how = ("Each floor: earn the coin quota (every 5th floor has an ELITE Gyarados).\n"
               "Coins give XP. Every level-up, pick 1 of 4 cards:\n"
               "upgrades, trade-offs, or curses that pay you back.\n"
               "Click coins, click the raging Gyarados, click water to feed.\n"
               "Lose all your fish and the run ends.")
        c.create_text(W / 2, H / 2 - 40 * S, text=how, fill="white", font=("Segoe UI", fs(11)), justify="center", tags="ov")
        st = self.stats
        c.create_text(W / 2, H / 2 + 60 * S, text="Best floor %d    Best level %d    Runs %d    Cards found %d/%d" %
                      (st["best_floor"], st["best_level"], st["runs"], len(st["seen"]), len(cd.CARDS)), fill="#ffe9a6", font=("Segoe UI", fs(11)), tags="ov")
        self.ov_button("Start run", self.start_run, W / 2, H / 2 + 130 * S)
        self.refresh_shop()

    def show_deck(self):
        self.state = "deck"
        self.ov_func = self.show_deck
        S = self.S
        c = self.canvas
        fs = lambda n: max(7, int(n * S))
        self.ov_backdrop()
        self.ov_panel(760, 500)
        c.create_text(W / 2, H / 2 - 225 * S, text="YOUR CARDS", fill="#ffd34d", font=("Segoe UI", fs(20), "bold"), tags="ov")
        owned = sorted(self.cards.items(), key=lambda kv: (cd.BY_ID[kv[0]].kind, cd.BY_ID[kv[0]].name))
        if not owned:
            c.create_text(W / 2, H / 2, text="No cards yet - level up to get some!", fill="white", font=("Segoe UI", fs(13)), tags="ov")
        per_col = 8
        for i, (cid, n) in enumerate(owned[:per_col * 2]):
            card = cd.BY_ID[cid]
            col, row = divmod(i, per_col)
            x = W / 2 - 350 * S + col * 360 * S
            y = H / 2 - 190 * S + row * 44 * S
            c.create_rectangle(x, y, x + 6 * S, y + 36 * S, fill=cd.KIND_COLOR[card.kind], outline="", tags="ov")
            c.create_text(x + 14 * S, y + 2 * S, anchor="nw", text="%s%s" % (card.name, "  x%d" % n if n > 1 else ""), fill=cd.RARITY_COLOR[card.rarity],
                          font=("Segoe UI", fs(10), "bold"), tags="ov")
            c.create_text(x + 14 * S, y + 19 * S, anchor="nw", text="; ".join(t for t, _g in card.lines)[:62], fill="#cfd9e3", font=("Segoe UI", fs(8)), tags="ov")
        m = self.mods
        c.create_text(W / 2, H / 2 + 190 * S, text="Coins x%.2f   XP x%.2f   Hunger x%.2f   Shop x%.2f   Click dmg %d" %
                      (m["coin_mult"], m["xp_mult"], m["hunger_mult"], m["shop_mult"], 1 + self.weap_lvl + m["click_dmg"]), fill="#bfe6ff", font=("Segoe UI", fs(10)), tags="ov")
        self.ov_button("Close", self.close_deck, W / 2, H / 2 + 228 * S)

    def close_deck(self):
        self.state = "play"
        self.ov_func = None
        self.clear_overlay()
        self.refresh_shop()

    def show_floor_clear(self, lines):
        self.state = "between"
        self.ov_func = lambda: self.show_floor_clear(lines)
        S = self.S
        fs = lambda n: max(8, int(n * S))
        self.ov_backdrop()
        self.ov_panel(480, 300)
        self.canvas.create_text(W / 2, H / 2 - 100 * S, text="FLOOR %d CLEARED!" % self.floor, fill="#ffd34d", font=("Segoe UI", fs(24), "bold"), tags="ov")
        self.canvas.create_text(W / 2, H / 2 - 15 * S, text="\n".join(lines), fill="white", font=("Segoe UI", fs(12)), justify="center", tags="ov")
        self.ov_button("Next floor >", self.next_floor, W / 2, H / 2 + 100 * S)
        self.refresh_shop()

    def next_floor(self):
        self.new_floor()
        self.state = "play"
        self.ov_func = None
        self.clear_overlay()
        self.refresh_shop()

    def show_game_over(self):
        self.state = "lost"
        self.ov_func = self.show_game_over
        S = self.S
        fs = lambda n: max(8, int(n * S))
        self.stats["best_floor"] = max(self.stats["best_floor"], self.floor)
        self.stats["best_level"] = max(self.stats["best_level"], self.plevel)
        self.save()
        self.ov_backdrop()
        self.ov_panel(520, 340)
        c = self.canvas
        c.create_text(W / 2, H / 2 - 120 * S, text="RUN OVER", fill="#ff6b6b", font=("Segoe UI", fs(28), "bold"), tags="ov")
        c.create_text(W / 2, H / 2 - 20 * S, justify="center", fill="white", font=("Segoe UI", fs(12)), tags="ov",
                      text="You reached floor %d  (best %d)\nLevel %d   %d cards taken\n%s earned this run" %
                      (self.floor, self.stats["best_floor"], self.plevel, sum(self.cards.values()), money(self.total_earned)))
        self.ov_button("New run", self.start_run, W / 2, H / 2 + 110 * S)
        self.refresh_shop()

    # ---------------------------------------------------------------- cards
    def offer_cards(self, starter=False):
        self.starter = starter
        self.offer = cd.draw(self.cards, self.floor, starter)
        for c in self.offer:
            if c.id not in self.stats["seen"]:
                self.stats["seen"].append(c.id)
        self.state = "cards"
        self.show_cards()

    def show_cards(self):
        self.ov_func = self.show_cards
        c = self.canvas
        S = self.S
        fs = lambda n: max(7, int(n * S))
        self.ov_backdrop()
        n = len(self.offer)
        gap = 18 * S
        cw = min(230 * S, (W - 60 * S - gap * (n - 1)) / n)
        ch = min(H - 190 * S, 340 * S)
        x0 = (W - (cw * n + gap * (n - 1))) / 2
        y0 = (H - ch) / 2 - 8 * S
        title = "Choose your first card" if self.starter else "LEVEL %d  -  choose a card" % self.plevel
        c.create_text(W / 2, y0 - 38 * S, text=title, fill="#ffd34d", font=("Segoe UI", fs(22), "bold"), tags="ov")
        if self.pending > 1:
            c.create_text(W / 2, y0 - 12 * S, text="(%d more level-ups waiting)" % (self.pending - 1), fill="#bfe6ff", font=("Segoe UI", fs(10)), tags="ov")
        self.card_boxes, self.card_rects = [], []
        for i, card in enumerate(self.offer):
            x = x0 + i * (cw + gap)
            rar = cd.RARITY_COLOR[card.rarity]
            rect = c.create_rectangle(x, y0, x + cw, y0 + ch, fill="#0f2740", outline=rar, width=max(3, int(4 * S)), tags="ov")
            c.create_rectangle(x, y0, x + cw, y0 + 28 * S, fill=cd.KIND_COLOR[card.kind], outline="", tags="ov")
            c.create_text(x + cw / 2, y0 + 14 * S, text=cd.KIND_LABEL[card.kind], fill="white", font=("Segoe UI", fs(10), "bold"), tags="ov")
            c.create_text(x + cw / 2, y0 + 58 * S, text=card.name, fill="white", font=("Segoe UI", fs(15), "bold"), width=cw - 16 * S, justify="center", tags="ov")
            c.create_text(x + cw / 2, y0 + 88 * S, text=card.rarity.upper(), fill=rar, font=("Segoe UI", fs(9), "bold"), tags="ov")
            c.create_line(x + 14 * S, y0 + 106 * S, x + cw - 14 * S, y0 + 106 * S, fill="#27506f", tags="ov")
            y = y0 + 120 * S
            cpl = max(8, int((cw - 28 * S) / (0.62 * fs(11))))
            for text, good in card.lines:
                c.create_text(x + 14 * S, y, anchor="nw", text=text if text[0] in "+-" else ("+ " if good else "- ") + text, fill="#7dffa9" if good else "#ff8a8a", font=("Segoe UI", fs(11)),
                              width=cw - 28 * S, tags="ov")
                y += (math.ceil((len(text) + 2) / cpl)) * fs(11) * 1.9 + 8 * S
            owned = self.cards.get(card.id, 0)
            if owned:
                c.create_text(x + cw / 2, y0 + ch - 34 * S, text="you have x%d" % owned, fill="#9db4c8", font=("Segoe UI", fs(9)), tags="ov")
            c.create_text(x + cw / 2, y0 + ch - 14 * S, text="[ %d ]" % (i + 1), fill="#9db4c8", font=("Segoe UI", fs(10), "bold"), tags="ov")
            self.card_boxes.append((x, y0, x + cw, y0 + ch))
            self.card_rects.append((rect, rar))
        self.ov_button("Reroll  (%d left)" % self.rerolls, self.reroll, W / 2, y0 + ch + 40 * S, bg="#8a5a1f" if self.rerolls > 0 else "#3a4452",
                       state="normal" if self.rerolls > 0 else "disabled")

    def reroll(self):
        if self.state != "cards" or self.rerolls <= 0:
            return
        self.rerolls -= 1
        self.offer = cd.draw(self.cards, self.floor, self.starter)
        for c in self.offer:
            if c.id not in self.stats["seen"]:
                self.stats["seen"].append(c.id)
        self.show_cards()

    def on_motion(self, e):
        if self.state != "cards":
            return
        for i, (x1, y1, x2, y2) in enumerate(self.card_boxes):
            rect, col = self.card_rects[i]
            hot = x1 <= e.x <= x2 and y1 <= e.y <= y2
            self.canvas.itemconfig(rect, outline="#ffffff" if hot else col)

    def pick_card(self, i):
        if self.state != "cards" or i >= len(self.offer):
            return
        card = self.offer[i]
        card.apply(self)
        self.cards[card.id] = self.cards.get(card.id, 0) + 1
        if not self.starter:
            self.pending = max(0, self.pending - 1)
        self.say("%s!" % card.name, 3.0)
        self.save()
        self.starter = False
        self.clear_overlay()
        self.ov_func = None
        if self.pending > 0:
            self.offer_cards()
        else:
            self.state = "play"
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
        for w in self.ov_widgets:
            try:
                w.destroy()
            except tk.TclError:
                pass
        self.ov_widgets = []
        self.draw_static()
        if self.ov_func and self.state != "play":
            self.ov_func()

    def toggle_fullscreen(self, on=None):
        self.fullscreen = (not self.fullscreen) if on is None else on
        self.root.attributes("-fullscreen", self.fullscreen)
        self.root.update_idletasks()
        if self.fullscreen:
            self.root.resizable(True, True)
            self.root.update_idletasks()
            self.set_size(self.root.winfo_screenwidth(), self.root.winfo_screenheight() - self.shop.winfo_reqheight() - 2)
            self.fs_btn.config(text="⛶ Exit\nfullscreen (Esc)")
        else:
            self.set_size(BASE_W, BASE_H)
            self.root.resizable(False, False)
            self.fs_btn.config(text="⛶ Fullscreen\n(F11)")

    # ---------------------------------------------------------------- input
    def on_click(self, e):
        if self.state == "cards":
            for i, (x1, y1, x2, y2) in enumerate(self.card_boxes):
                if x1 <= e.x <= x2 and y1 <= e.y <= y2:
                    return self.pick_card(i)
            return
        if self.state != "play":
            return
        for co in sorted(self.coins, key=lambda c: -c["y"]):
            if math.hypot(co["x"] - e.x, co["y"] - e.y) < 24 * self.S * self.mods["magnet"]:
                self.collect(co)
                return
        b = self.boss
        if b:
            w, h = b.size(self.sheets, self.S)
            if abs(b.x - e.x) < w / 2 and abs(b.y - e.y) < h / 2:
                self.hit_boss(1 + self.weap_lvl + self.mods["click_dmg"])
                self.shots.append((e.x, e.y, 0.15, "click"))
                return
        cost = self.food_cost()
        if e.y > 20 and self.cash >= cost and len(self.pellets) < self.food_limit():
            self.cash -= cost
            self.pellets.append(dict(x=e.x, y=e.y, vy=0, life=7.0))
            self.refresh_shop()

    def collect(self, co):
        val = co["val"]
        self.gain_cash(val)
        self.floor_cash += val
        self.add_xp(val * 0.6)
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
            for _ in range(5 if b.elite else 3):
                self.drop_coin(b.x + random.uniform(-30, 30), b.y, "trophy")
            self.add_xp((60 if b.elite else 25) + 12 * self.floor)
            self.fish.remove(b)
            self.boss = None
            if b.elite:
                self.elite_dead = True
                self.say("The elite Gyarados is defeated!")
            else:
                self.boss_clock = (55 + random.uniform(0, 15)) * self.mods["boss_clock"]
                self.say("The raging Gyarados is gone!")

    def drop_coin(self, x, y, kind):
        m = self.mods
        mult = m["coin_mult"] * {"diamond": m["diamond_mult"], "pearl": m["pearl_mult"], "trophy": m["boss_trophy"]}.get(kind, 1.0)
        n = 2 if random.random() < m["lucky"] else 1
        for i in range(n):
            self.coins.append(dict(x=x + i * 14 * self.S, y=y, kind=kind, age=0.0, val=max(1, int(COINS[kind][0] * mult))))

    # ---------------------------------------------------------------- simulation
    def alive_fish(self):
        return [f for f in self.fish if not f.is_dead and f.kind != "boss"]

    def update(self, dt):
        if self.state != "play":
            return
        m = self.mods
        self.t += dt
        if self.msg_t > 0:
            self.msg_t -= dt
        if not self.boss and not (self.is_elite and self.elite_dead):
            self.boss_clock -= dt
            if self.boss_clock <= 0:
                self.spawn_boss()
        if random.random() < dt * 3:
            self.bubbles.append(dict(x=random.choice([0.04, 0.9, 0.62]) * W + random.uniform(-12, 12), y=SAND_Y, r=random.uniform(2, 6), sp=random.uniform(30, 70)))
        for b in self.bubbles[:]:
            b["y"] -= b["sp"] * self.S * dt
            b["x"] += math.sin(b["y"] / 14) * 12 * dt
            if b["y"] < 0:
                self.bubbles.remove(b)
        if self.autofeed or m["auto_feed"] > 0:
            self.auto_t -= dt
            hungry = [f for f in self.alive_fish() if f.kind in ("guppy", "breeder") and f.hunger < 55]
            if self.auto_t <= 0 and hungry and self.cash >= self.food_cost() and len(self.pellets) < self.food_limit():
                self.auto_t = 4.0
                self.cash -= self.food_cost()
                f = random.choice(hungry)
                self.pellets.append(dict(x=max(30, min(W - 30, f.x + random.uniform(-40, 40))), y=25 * self.S, vy=0, life=7.0))
                self.refresh_shop()
        for p in self.pellets[:]:
            p["vy"] = min(45 * self.S, p["vy"] + 60 * self.S * dt)
            p["y"] += p["vy"] * dt
            if p["y"] >= SAND_Y + 4:
                p["y"] = SAND_Y + 4
                p["life"] -= dt
                if p["life"] <= 0:
                    self.pellets.remove(p)
        life = 14 * m["coin_life"]
        for co in self.coins[:]:
            if co["y"] < SAND_Y - 8 * self.S:
                co["y"] += 45 * self.S * dt
            co["age"] += dt
            if co["age"] > life:
                self.coins.remove(co)
        for f in self.fish[:]:
            self.update_fish(f, dt)
        self.shots = [(x, y, t - dt, k) for x, y, t, k in self.shots if t - dt > 0]
        for ft in self.floaters[:]:
            ft[1] -= 30 * self.S * dt
            ft[4] -= dt
            if ft[4] <= 0:
                self.floaters.remove(ft)
        # floor cleared?
        if self.floor_cash >= self.quota:
            if not self.is_elite or self.elite_dead:
                self.clear_floor()
                return
            if self.msg_t <= 0:
                self.say("Quota reached - now defeat the ELITE Gyarados!", 2.5)
        # run lost?
        if not any(f.kind in ("guppy", "breeder", "carn") and not f.is_dead for f in self.fish) and self.cash < 100 and not self.coins:
            if m["revives"] > 0:
                m["revives"] -= 1
                for _ in range(3):
                    self.fish.append(E("guppy", random.uniform(100, W - 100), TOP))
                self.cash += 100
                self.say("SECOND WIND! Three babies and $100 appear.", 4)
            else:
                self.show_game_over()
                return
        if self.pending > 0:
            self.offer_cards()

    def spawn_boss(self):
        b = E("boss", random.choice([40, W - 40]), random.uniform(TOP, BOT))
        b.elite = self.is_elite
        hp = (14 + 6 * self.floor) * self.mods["boss_hp"] * (2.0 if b.elite else 1.0)
        b.hp = b.max_hp = max(1, int(hp))
        b.cool = 3.0
        self.boss = b
        self.fish.append(b)
        self.say("THE ELITE GYARADOS HAS ARRIVED!" if b.elite else "A raging Gyarados appears! Click it!")

    def clear_floor(self):
        m = self.mods
        lines = []
        leftover = sum(co["val"] for co in self.coins)
        if leftover:
            self.gain_cash(leftover)
            lines.append("Leftover coins collected: +%s" % money(leftover))
        bonus = 60 + 20 * self.floor
        self.add_xp(bonus, raw=True)
        lines.append("Floor bonus: +%d XP" % bonus)
        if m["interest"] > 0:
            inter = int(min(250, self.cash * m["interest"]))
            if inter:
                self.gain_cash(inter)
                lines.append("Savings Account: +%s" % money(inter))
        lines.append("All fish fed and refreshed.")
        self.stats["best_floor"] = max(self.stats["best_floor"], self.floor + 1)
        self.save()
        self.show_floor_clear(lines)

    def move(self, f, dt, boost=1.0):
        dx, dy = f.tx - f.x, f.ty - f.y
        dist = math.hypot(dx, dy)
        if dist > 4:
            v = SPEED[f.kind] * boost * self.S
            f.x += dx / dist * min(v * dt, dist)
            f.y += dy / dist * min(v * dt, dist)
            if abs(dx) > 4:
                f.right = dx > 0
        f.y = max(TOP - 30 * self.S, min(SAND_Y - 12 * self.S, f.y))
        f.x = max(25, min(W - 25, f.x))
        return dist

    def wander(self, f, dt):
        if f.mode == "idle":
            f.timer -= dt
            if f.timer <= 0:
                f.tx, f.ty = random.uniform(50, W - 50), random.uniform(TOP, BOT)
                f.mode = "swim"
        elif self.move(f, dt) <= 6:
            f.mode = "idle"
            f.timer = random.uniform(0.5, 3)

    def update_fish(self, f, dt):
        m = self.mods
        f.shake = max(0, f.shake - dt)
        f.shoot = max(0, f.shoot - dt)
        if f.is_dead:
            f.dead -= dt
            f.y = min(SAND_Y - 4, f.y + 25 * self.S * dt)
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
                spd = (1 + 0.04 * self.floor) * m["boss_speed"]
                if self.move(f, dt, spd) < 38 * self.S and f.cool <= 0:
                    f.cool = 2.6 * m["boss_cd"] * (0.8 if f.elite else 1.0)
                    self.floaters.append([tgt.x, tgt.y, "CHOMP!", "#ff6b6b", 1.0])
                    self.kill(tgt)
            else:
                self.wander(f, dt)
        elif k == "relic":
            f.coin_t -= dt
            if f.coin_t <= 0:
                f.coin_t = 60
                self.drop_coin(f.x, f.y, "pearl")
            self.wander(f, dt)
        elif k == "remo":
            b = self.boss
            if b:
                f.tx, f.ty = b.x + (-140 * self.S if f.x < b.x else 140 * self.S), b.y
                f.mode = "swim"
                if math.hypot(b.x - f.x, b.y - f.y) < 220 * self.S:
                    f.mode = "idle"
                    f.right = b.x > f.x
                    f.cool -= dt
                    if f.cool <= 0:
                        f.cool = 1.2
                        f.shoot = 0.4
                        self.shots.append((f.x, f.y, 0.2, (b.x, b.y)))
                        self.hit_boss(1 + self.weap_lvl // 2 + m["remo_dmg"])
                else:
                    self.move(f, dt)
            elif self.coins:
                co = min(self.coins, key=lambda c: math.hypot(c["x"] - f.x, c["y"] - f.y))
                f.tx, f.ty = co["x"], co["y"]
                f.mode = "swim"
                if self.move(f, dt, 1.4) < 24 * self.S:
                    self.collect(co)
            else:
                self.wander(f, dt)
        else:
            self.update_eater(f, dt)
        if f.shoot > 0:
            anim = "Shoot"
        self.animate(f, dt, anim)

    def update_eater(self, f, dt):
        m = self.mods
        k = f.kind
        drain = (2.9 if k == "carn" else 2.5) * m["hunger_mult"] * (1 + 0.02 * (self.floor - 1))
        f.hunger -= dt * drain
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
            f.tx, f.ty = tx, min(ty, SAND_Y - 14 * self.S)
            f.mode = "swim"
            self.move(f, dt, 1.7)
            if math.hypot(tx - f.x, ty - f.y) < (26 if k != "carn" else 40) * self.S:
                if isinstance(target, E):
                    self.fish.remove(target)
                else:
                    self.pellets.remove(target)
                f.hunger = 100
                if k == "guppy":
                    f.growth += 1 + self.qual_lvl + m["growth_bonus"]
                    need = max(2, GROW_NEED[f.stage] + m["grow_delta"]) if f.stage < 2 else 0
                    if f.stage < 2 and f.growth >= need:
                        f.stage += 1
                        f.growth = 0
                        self.floaters.append([f.x, f.y - 30 * self.S, "grew!", "#a6ffcb", 1.2])
        else:
            self.wander(f, dt)
        ci = m["coin_interval"]
        if k == "guppy" and f.stage >= 1:                 # babies never drop coins; they must grow first
            f.coin_t -= dt
            if f.coin_t <= 0:
                f.coin_t = random.uniform(8, 12) * ci
                self.drop_coin(f.x, f.y, "silver" if f.stage == 1 else "gold")
        elif k == "carn":
            f.coin_t -= dt
            if f.coin_t <= 0:
                f.coin_t = random.uniform(11, 15) * ci
                self.drop_coin(f.x, f.y, "diamond")
        elif k == "breeder" and f.hunger > 40:
            f.spawn_t -= dt
            if f.spawn_t <= 0:
                f.spawn_t = random.uniform(16, 22) * m["breed_mult"]
                if self.n_fish() < self.capacity():
                    self.fish.append(E("guppy", f.x, f.y, 0, "goldeen"))
                    self.floaters.append([f.x, f.y - 30 * self.S, "a baby Goldeen!", "#ffc6e0", 1.2])

    def kill(self, f):
        if not f.is_dead:
            f.is_dead = True
            f.dead = 5.0

    def animate(self, f, dt, anim):
        frames, durs = self.sheets.get(f.species, anim, f.right, f.scale * self.S, f.tint, f.is_dead)
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
                bw = (46 if f.elite else 30) * S
                c.create_rectangle(f.x - bw, top - 12 * S, f.x + bw, top - 6 * S, fill="#400", outline="white", tags="dyn")
                c.create_rectangle(f.x - bw, top - 12 * S, f.x - bw + 2 * bw * max(0, f.hp) / f.max_hp, top - 6 * S, fill="#ff4d4d", outline="", tags="dyn")
                if f.elite:
                    c.create_text(f.x, top - 24 * S, text="ELITE", fill="#e0a6ff", font=("Segoe UI", fs(10), "bold"), tags="dyn")
            elif not f.pet and f.hunger < (60 if f.kind == "carn" else 55):
                c.create_text(f.x, top - 8 * S, text="!", fill="#ff4d4d" if f.hunger < 25 else "#ffd34d", font=("Segoe UI", fs(14), "bold"), tags="dyn")
        for x, y, tleft, tgt in self.shots:
            if isinstance(tgt, tuple):
                c.create_line(x, y, tgt[0], tgt[1], fill="#7fe9ff", width=max(3, int(4 * S)), tags="dyn")
            else:
                r = 14 * S
                c.create_oval(x - r, y - r, x + r, y + r, outline="#fff36b", width=3, tags="dyn")
        life = 14 * self.mods["coin_life"]
        for co in self.coins:
            val, fill, edge = COINS[co["kind"]]
            if co["age"] > life - 3 and int(co["age"] * 8) % 2 == 0:
                continue
            x, y = co["x"], co["y"]
            if co["kind"] == "diamond":
                c.create_polygon(x, y - 14 * S, x + 12 * S, y, x, y + 14 * S, x - 12 * S, y, fill=fill, outline=edge, width=2, tags="dyn")
            else:
                r = (11 if co["kind"] in ("silver", "gold") else 14) * S
                c.create_oval(x - r, y - r, x + r, y + r, fill=fill, outline=edge, width=2, tags="dyn")
                c.create_text(x, y, text="$", fill=edge, font=("Segoe UI", fs(10), "bold"), tags="dyn")
        for x, y, text, color, life_left in self.floaters:
            c.create_text(x, y, text=text, fill=color, font=("Segoe UI", fs(12), "bold"), tags="dyn")
        self.draw_hud(c, S, fs)
        c.tag_raise("ov")

    def draw_hud(self, c, S, fs):
        c.create_text(14 * S, 8 * S, anchor="nw", text=money(self.cash), fill="#fff", font=("Segoe UI", fs(24), "bold"), tags="dyn")
        # floor quota bar
        bw, bh = 240 * S, 14 * S
        x, y = 16 * S, 46 * S
        c.create_text(x, y, anchor="nw", text="Floor %d%s   quota %s / %s" % (self.floor, " (ELITE)" if self.is_elite else "", self.floor_cash, self.quota),
                      fill="#bfe6ff" if not self.is_elite else "#e0a6ff", font=("Segoe UI", fs(10), "bold"), tags="dyn")
        y += 20 * S
        c.create_rectangle(x, y, x + bw, y + bh, fill="#0b2a44", outline="#7fd1ff", tags="dyn")
        c.create_rectangle(x, y, x + bw * min(1.0, self.floor_cash / max(1, self.quota)), y + bh, fill="#35c46a", outline="", tags="dyn")
        # xp bar
        y += 24 * S
        need = xp_needed(self.plevel)
        c.create_text(x, y, anchor="nw", text="Level %d   XP %d / %d" % (self.plevel, self.xp, need), fill="#ffe9a6", font=("Segoe UI", fs(10), "bold"), tags="dyn")
        y += 20 * S
        c.create_rectangle(x, y, x + bw, y + bh, fill="#2a1c44", outline="#c77dff", tags="dyn")
        c.create_rectangle(x, y, x + bw * min(1.0, self.xp / need), y + bh, fill="#c77dff", outline="", tags="dyn")
        c.create_text(W - 14 * S, 10 * S, anchor="ne", text="fish %d/%d" % (self.n_fish(), self.capacity()), fill="#bfe6ff", font=("Segoe UI", fs(11)), tags="dyn")
        if self.rerolls:
            c.create_text(W - 14 * S, 30 * S, anchor="ne", text="rerolls %d" % self.rerolls, fill="#ffb347", font=("Segoe UI", fs(10)), tags="dyn")
        if self.msg_t > 0:
            c.create_text(W / 2, 22 * S, text=self.msg, fill="#ffd34d", font=("Segoe UI", fs(14), "bold"), tags="dyn")

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
