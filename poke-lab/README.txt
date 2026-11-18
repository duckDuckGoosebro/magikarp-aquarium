POKE LAB - walk through 14 connected towns. ALL ART IS POKEMON GBA (FireRed tiles, Emerald walking sprites).

PLAY
  Double-click PLAY.bat (or open index.html). Online: https://duckduckgoosebro.github.io/magikarp-aquarium/poke-lab/
  PC:    arrows / WASD walk, Space or Z talks, M = world map, Esc closes boxes.
  Phone: on-screen pad walks, A talks, MAP opens the world map.
  Your lead Pokemon follows you. P (or PKMN button) = your party with stats and moves. Progress is saved in the browser.

BATTLES (battle.js, data in pokedata.js)
  Walk through tall grass on routes: wild Pokemon jump out (levels go up route by route).
  You can also SEE wild Pokemon walking around on routes (Sword & Shield style): aggressive ones spot you (!) and attack,
  passive ones just wander (walk up to them to battle). The Pokemon you fought is gone after the fight and a new one shows up later.
  The fight screen is drawn like the GBA games (health boxes, FIGHT/BAG/POKéMON/RUN, move list with PP and type).
  FIGHT (real moves, types, STAB, critical hits, stat changes, sleep/poison/burn/paralysis/confusion),
  BAG (Poke Balls to catch, Potions), PKMN (switch), RUN. Win = EXP, level ups, new moves and evolution.
  Up to 6 in the party, extras go to the PC box. Pokemon Center doors heal everyone, Mart doors refill the bag.
  If every Pokemon faints you wake up in Birchfield, healed.
  Stats/moves/types/learnsets/evolutions come from Pokemon Essentials (pokemon-essentials/PBS), battle sprites are GBA FireRed.
  Rebuild the data with:  python "POKE LAB/tools/build_pokedata.py"   (run after build_world.py)

THE WORLD  (14 towns, 18 winding routes, every map joined to its neighbours)
  Press M for the world map. Start in BIRCHFIELD (science lab, Sunny the clown).
  Towns: Birchfield, Meadowvale, Pinewood, Frostpeak, Cragton, Summit, Stonegate, Crownport, Lakehaven, Marshby,
         Emberisle, Sandport, Tidewell, Dunmoor.
  Each town uses a different FireRed tileset, and every building in a town is DIFFERENT (no copies).
  Town layouts are new and organic: winding sand roads from each exit to a plaza, a little path to every door,
  plus lakes / sea coast / rocks / woods / ponds depending on the town. Small towns are smaller maps.
  The only person is Sunny; the rest of the life is wandering Pokemon.

FILES
  index.html, game.js     the game
  battle.js, pokedata.js  party, stats screen and wild battles; pokedata.js is MADE BY tools/build_pokedata.py (tile walking, map switching, follower, Sunny, signs, world map)
  world.js                MADE BY tools/build_world.py - sizes, collision, connections, signs, people, wandering Pokemon
  assets/maps/            one picture per map (bottom layer + top layer for roofs/treetops)
  assets/overview.png     the world map picture
  assets/trainers/        brendan.png (player), sunny.png (made by tools/make_sunny.py from an Emerald girl sprite)
  assets/followers/       GBA-style follower sheets for the wandering Pokemon
  tools/fr_auto.py        finds every different building in the real FireRed maps -> tools/buildings.json
  tools/build_world.py    builds every town and route, CHECKS everything is reachable (re-rolls a town if not), draws them
  tools/gba_render.py     draws GBA metatiles, using the real layer types (flowers/ground under the player, roofs over)
  tools/_old_*.py, _not_gba/   earlier versions. Not used.

CHANGE THE WORLD
  Edit tools/build_world.py (TOWNS, ROUTES, MONS), then run:  python "POKE LAB/tools/build_world.py"

SPRITE SOURCES (personal use only; Nintendo / Game Freak art)
  Tiles + buildings: sprites/gba_firered (pret/pokefirered tilesets, attributes and layouts)
  Player: sprites/trainers_walking/emerald (pret/pokeemerald)
  Pokemon: sprites/trainers_walking/followers_baptiste (GBA-style follower sheets)

POKEMON ESSENTIALS (downloaded)
  pokemon-essentials/   github.com/Maruno17/pokemon-essentials (shallow clone, ~61 MB). An RPG Maker XP kit (Ruby + Windows .exe) -
  it does not run in the browser game. Useful parts: PBS/*.txt = Pokemon stats, moves, types, abilities, items, encounters, trainers.
  Not copied to GitHub Pages. Update with:  git -C "POKE LAB/pokemon-essentials" pull
