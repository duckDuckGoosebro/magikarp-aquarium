FISH TANK 3 - roguelike card run (fish Pokemon sprites only)
============================================================
Double-click START_FISH_TANK_3.bat (python + Pillow). Versions 1 and 2 are untouched in ../FISH TANK and ../FISH TANK 2.

A RUN
- You climb FLOORS. Each floor: collect enough coins to reach the QUOTA (it grows every floor).
- Every 5th floor is an ELITE floor: you must also beat the big purple Gyarados.
- Clearing a floor: bonus XP, leftover coins collected, all fish refreshed. Cash, fish and cards carry over.
- Lose every fish (and be unable to buy one) = RUN OVER. Start a new run with a fresh deck.

XP + CARDS
- Coins give XP (60% of their value), bosses and floors give more. Every LEVEL UP you must pick 1 of 4 cards (keys 1-4 or click).
- Card kinds:  UPGRADE (green: only good)   TRADE-OFF (gold: good + bad)   CURSE (red: a debuff that pays you back)
- Rarity: common / rare / epic (epics get likelier on deeper floors). Reroll the offer with rerolls (you start with 1; cards give more).
- "Your Cards" button (shop bar) shows everything you took. cards.py is the whole deck: 44 cards, easy to edit/add.

THE TANK (same as Fish Tank 2)
- Click: coin = pick up | raging red Gyarados = hit it | water = drop food (food costs money).
- Magikarp (baby > medium > large, drops silver then gold once grown), Seaking (gives birth to Goldeen),
  Gyarados (eats baby fish, drops diamonds), Remoraid (grabs coins, shoots the boss), Relicanth (pearls).
- Hungry fish show "!" and starve at 0. Shop upgrades: More Food, Food Quality, Weapon, Auto Feeder.
- F11 = fullscreen, Esc = leave fullscreen.

Files: fishtank3.py (game), cards.py (deck + modifiers), sprites/ (PMDCollab, CC BY-NC 4.0), save.json (best floor/level, cards found; auto-made).
