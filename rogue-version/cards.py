"""The card deck of FISH TANK 3.

Every time you level up you are shown 4 cards and must take ONE. There are three kinds:
  up    - pure upgrades
  trade - a good effect with a bad side effect
  curse - a debuff that pays you back with a reward (cash, XP, rerolls...)
A card changes the run's "mods" (see DEFAULT_MODS) or does something right away (free fish, cash, XP...).
To add a card: append a Card(...) to CARDS. `lines` is what the player reads: (text, True) is shown green (good), (text, False) red (bad).
"""
import random

DEFAULT_MODS = dict(
    coin_mult=1.0,        # value of every coin
    xp_mult=1.0,          # XP you earn
    hunger_mult=1.0,      # how fast fish get hungry (bigger = worse)
    food_cost=5,          # price of one food pellet
    growth_bonus=0,       # extra growth points per pellet
    grow_delta=0,         # change to the food needed to grow (negative = faster)
    click_dmg=0,          # extra damage per click on the raging Gyarados
    remo_dmg=0,           # extra damage per Remoraid shot
    magnet=1.0,           # coin pick-up radius
    lucky=0.0,            # chance a coin drops twice
    shop_mult=1.0,        # shop prices
    coin_life=1.0,        # how long coins stay in the water
    boss_cd=1.0,          # time between boss bites (bigger = slower biting)
    boss_hp=1.0,
    boss_speed=1.0,
    boss_trophy=1.0,      # value of the coins a defeated boss drops
    boss_clock=1.0,       # time until the boss arrives (smaller = sooner)
    max_fish=0,           # extra tank capacity
    food_limit=0,         # extra pellets allowed in the water
    pearl_mult=1.0,
    diamond_mult=1.0,
    interest=0.0,         # share of your cash gained when a floor is cleared
    revives=0,            # second winds
    quota_mult=1.0,       # floor quota
    auto_feed=0,          # fish feed themselves
    coin_interval=1.0,    # time between a fish's coins (smaller = faster)
    breed_mult=1.0,       # time between Seaking births (smaller = faster)
)

RARITY_COLOR = {"common": "#aab7c4", "rare": "#4da3ff", "epic": "#c77dff"}
RARITY_WEIGHT = {"common": 60, "rare": 30, "epic": 10}
KIND_LABEL = {"up": "UPGRADE", "trade": "TRADE-OFF", "curse": "CURSE"}
KIND_COLOR = {"up": "#2e9e5b", "trade": "#c28f1a", "curse": "#b8323a"}


class Card:
    def __init__(self, cid, name, rarity, kind, lines, apply, maxn=3):
        self.id, self.name, self.rarity, self.kind, self.lines, self.apply, self.maxn = cid, name, rarity, kind, lines, apply, maxn


def add(key, v):
    return lambda g: g.mods.__setitem__(key, g.mods[key] + v)


def mul(key, v):
    return lambda g: g.mods.__setitem__(key, g.mods[key] * v)


def do(*fs):
    def run(g):
        for f in fs:
            f(g)
    return run


def cash(n):
    return lambda g: g.gain_cash(n)


def xp(n):
    return lambda g: g.add_xp(n, raw=True)


def rerolls(n):
    return lambda g: setattr(g, "rerolls", g.rerolls + n)


def spawn(kind, n=1, species=None):
    return lambda g: [g.spawn(kind, species) for _ in range(n)]


G, B = True, False   # good / bad line colours

CARDS = [
    # ------------------------------------------------------------------ pure upgrades
    Card("fat_pellets", "Fat Pellets", "common", "up", [("+1 growth from every food", G)], add("growth_bonus", 1)),
    Card("deep_pockets", "Deep Pockets", "common", "up", [("+$120 right now", G)], cash(120), 99),
    Card("slow_metabolism", "Slow Metabolism", "common", "up", [("Fish get hungry 15% slower", G)], mul("hunger_mult", 0.85)),
    Card("second_helping", "Second Helping", "common", "up", [("+1 food allowed in the water", G)], add("food_limit", 1)),
    Card("sharp_clicks", "Sharp Clicks", "common", "up", [("+1 click damage to the raging Gyarados", G)], add("click_dmg", 1)),
    Card("magnet_hands", "Magnet Hands", "common", "up", [("+40% coin pick-up range", G)], mul("magnet", 1.4)),
    Card("coupon", "Coupon Book", "common", "up", [("Shop prices -12%", G)], mul("shop_mult", 0.88)),
    Card("cheap_eats", "Cheap Eats", "common", "up", [("Food costs $1 less", G)], add("food_cost", -1)),
    Card("growth_spurt", "Growth Spurt", "common", "up", [("Fish need 1 less food to grow", G)], add("grow_delta", -1)),
    Card("bigger_tank", "Bigger Tank", "common", "up", [("+4 tank capacity", G)], add("max_fish", 4)),
    Card("study_fish", "Study Fish", "common", "up", [("+25% XP", G)], mul("xp_mult", 1.25)),
    Card("fresh_fry", "Fresh Fry", "common", "up", [("Get 3 baby Magikarp", G)], spawn("guppy", 3), 99),
    Card("reroll_voucher", "Reroll Voucher", "common", "up", [("+2 card rerolls", G)], rerolls(2), 99),
    Card("auto_feeder", "Auto Feeder", "common", "up", [("Hungry fish get fed automatically", G)], add("auto_feed", 1), 1),
    Card("quick_fins", "Quick Fins", "common", "up", [("Fish make coins 12% faster", G)], mul("coin_interval", 0.88)),
    # ------------------------------------------------------------------ rare upgrades
    Card("rich_coins", "Rich Coins", "rare", "up", [("+20% coin value", G)], mul("coin_mult", 1.2)),
    Card("lucky_fin", "Lucky Fin", "rare", "up", [("15% chance a coin drops twice", G)], add("lucky", 0.15)),
    Card("remoraid_pals", "Remoraid Pals", "rare", "up", [("Get a free Remoraid", G), ("+1 Remoraid damage", G)], do(spawn("remo"), add("remo_dmg", 1))),
    Card("pearl_polish", "Pearl Polish", "rare", "up", [("Pearls are worth 50% more", G), ("Get a free Relicanth", G)], do(mul("pearl_mult", 1.5), spawn("relic"))),
    Card("diamond_cut", "Diamond Cut", "rare", "up", [("Diamonds are worth 50% more", G)], mul("diamond_mult", 1.5)),
    Card("thick_scales", "Thick Scales", "rare", "up", [("The raging Gyarados bites 50% slower", G)], mul("boss_cd", 1.5)),
    Card("interest", "Savings Account", "rare", "up", [("Floor clear: +8% of your cash (max $250)", G)], add("interest", 0.08)),
    Card("seaking_egg", "Seaking Egg", "rare", "up", [("Get a free Seaking", G)], spawn("breeder"), 99),
    Card("breeding_season", "Breeding Season", "rare", "up", [("Seaking give birth 30% faster", G)], mul("breed_mult", 0.7)),
    Card("second_wind", "Second Wind", "rare", "up", [("If every fish dies, get 3 babies and keep going", G)], add("revives", 1)),
    # ------------------------------------------------------------------ epic upgrades
    Card("golden_age", "Golden Age", "epic", "up", [("+50% coin value", G)], mul("coin_mult", 1.5)),
    Card("laser_eyes", "Laser Eyes", "epic", "up", [("+3 click damage", G), ("+1 Remoraid damage", G)], do(add("click_dmg", 3), add("remo_dmg", 1))),
    Card("apex_predator", "Apex Predator", "epic", "up", [("Get a free Gyarados", G), ("Diamonds worth 25% more", G)], do(spawn("carn"), mul("diamond_mult", 1.25)), 2),
    Card("time_dilation", "Time Dilation", "epic", "up", [("Fish get hungry 40% slower", G)], mul("hunger_mult", 0.6), 2),
    Card("xp_surge", "XP Surge", "epic", "up", [("+60% XP", G)], mul("xp_mult", 1.6), 2),
    # ------------------------------------------------------------------ trade-offs (good AND bad)
    Card("glass_cannon", "Glass Cannon", "rare", "trade", [("+3 click damage", G), ("Fish get hungry 25% faster", B)], do(add("click_dmg", 3), mul("hunger_mult", 1.25))),
    Card("greedy_coins", "Greedy Coins", "rare", "trade", [("+50% coin value", G), ("Coins vanish 40% sooner", B)], do(mul("coin_mult", 1.5), mul("coin_life", 0.6))),
    Card("crowded_tank", "Crowded Tank", "common", "trade", [("+6 tank capacity", G), ("Fish get hungry 15% faster", B)], do(add("max_fish", 6), mul("hunger_mult", 1.15))),
    Card("blood_moon", "Blood Moon", "rare", "trade", [("Boss trophies worth 3x", G), ("The boss arrives twice as soon", B)], do(mul("boss_trophy", 3.0), mul("boss_clock", 0.5))),
    Card("junk_food", "Junk Food", "common", "trade", [("Food costs $3 less", G), ("Fish get hungry 30% faster", B)], do(add("food_cost", -3), mul("hunger_mult", 1.3))),
    Card("speed_demons", "Speed Demons", "rare", "trade", [("Fish make coins 25% faster", G), ("Boss is 30% faster, 20% tougher", B)], do(mul("coin_interval", 0.75), mul("boss_speed", 1.3), mul("boss_hp", 1.2))),
    Card("high_stakes", "High Stakes", "epic", "trade", [("+40% coin value, +50% XP", G), ("Floor quotas +35%", B)], do(mul("coin_mult", 1.4), mul("xp_mult", 1.5), mul("quota_mult", 1.35)), 2),
    Card("slow_and_steady", "Slow and Steady", "common", "trade", [("Fish get hungry 25% slower", G), ("Fish make coins 20% slower", B)], do(mul("hunger_mult", 0.75), mul("coin_interval", 1.2))),
    # ------------------------------------------------------------------ curses (debuffs that pay you back)
    Card("famine", "Famine", "common", "curse", [("Fish get hungry 35% faster", B), ("+$350 now", G), ("+60 XP", G)], do(mul("hunger_mult", 1.35), cash(350), xp(60)), 2),
    Card("cursed_coin", "Cursed Coin", "rare", "curse", [("Coins worth 20% less", B), ("+80% XP", G)], do(mul("coin_mult", 0.8), mul("xp_mult", 1.8)), 2),
    Card("angry_waters", "Angry Waters", "rare", "curse", [("Boss is 40% tougher and 25% faster", B), ("+$200 now", G), ("+2 rerolls", G)], do(mul("boss_hp", 1.4), mul("boss_speed", 1.25), cash(200), rerolls(2)), 2),
    Card("sacrifice", "Sacrifice", "rare", "curse", [("Lose a random baby fish", B), ("+$250 now", G), ("+90 XP", G)], do(lambda g: g.sacrifice(), cash(250), xp(90)), 99),
    Card("skinflint_tax", "Skinflint Tax", "common", "curse", [("Shop prices +25%", B), ("+40% XP", G)], do(mul("shop_mult", 1.25), mul("xp_mult", 1.4)), 2),
    Card("heavy_quota", "Heavy Quota", "rare", "curse", [("Floor quotas +25%", B), ("Coins worth 25% more", G), ("+1 reroll", G)], do(mul("quota_mult", 1.25), mul("coin_mult", 1.25), rerolls(1)), 2),
]
BY_ID = {c.id: c for c in CARDS}


def weighted_pick(pool, floor):
    w = []
    for c in pool:
        base = RARITY_WEIGHT[c.rarity]
        if c.rarity == "epic":
            base += floor * 1.5
        elif c.rarity == "common":
            base = max(25, base - floor)
        w.append(base)
    return random.choices(pool, weights=w, k=1)[0]


def draw(owned, floor, starter=False):
    """4 distinct cards: 2 upgrades, 1 trade-off and a wild card (usually a curse or a trade-off)."""
    def pool(kind):
        return [c for c in CARDS if c.kind == kind and owned.get(c.id, 0) < c.maxn]
    out = []

    def take(kind):
        p = [c for c in pool(kind) if c not in out]
        if not p:
            p = [c for c in CARDS if c not in out and owned.get(c.id, 0) < c.maxn]
        if p:
            out.append(weighted_pick(p, floor))

    if starter:
        for _ in range(4):
            take("up")
    else:
        take("up")
        take("up")
        take("trade")
        take(random.choices(["curse", "up", "trade"], weights=[55, 20, 25], k=1)[0])
    random.shuffle(out)
    return out
