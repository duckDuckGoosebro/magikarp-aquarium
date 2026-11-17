POKE LAB - walk through 8 connected cities. ALL ART IS POKEMON GBA (Emerald / FireRed).

PLAY
  Double-click PLAY.bat (or open index.html).
  PC:    arrows / WASD walk, Space or Z talks, M = world map, Esc closes boxes.
  Phone: on-screen pad walks, A talks, MAP opens the world map.
  Your Porygon follows you. Progress (which towns you've visited) is saved in the browser.

THE WORLD  (8 cities, 10 winding routes, every map joined to its neighbours)
  Press M in the game for the painted world map (made from the same GBA tiles). Roads on it follow the real routes.
  BIRCHFIELD (start, science lab) - R1 - MEADOWVALE - R2 - PINEWOOD - R3 - CRAGTON
  Birchfield also goes south (R4) to LAKEHAVEN; Meadowvale south (R5) to STONEGATE; Lakehaven east (R6) to SANDPORT;
  Sandport east (R7) to Stonegate; Pinewood south (R8) to Stonegate; Stonegate east (R9) to CROWNPORT; Cragton south (R10) to Crownport.
  Routes bend and wander; towns have 2-4 exits. Roads are plain sand (no green edges) and everything sits on the 16px tile grid.
  Walk off a map edge through the sand-road gap and the next map loads.

FILES
  index.html, game.js     the game (tile walking, map switching, followers, people, signs, world map)
  world.js                MADE BY tools/build_world.py - sizes, collision, connections, signs, people, wandering Pokemon
  assets/maps/            one picture per map (bottom layer + top layer for roofs/treetops), drawn from real FireRed tilesets
  assets/overview.png     the painted world map (press M)
  assets/trainers/        GBA walking sheets (Emerald overworld): player = Brendan, plus townspeople and scientists
  assets/followers/       GBA-style follower sheets for the Pokemon that wander (4 frames x 4 directions)
  tools/gba_render.py     draws maps from GBA metatiles (Emerald in sprites/gba, FireRed in sprites/gba_firered)
  tools/build_world.py    LAYOUT of every city and route; also CHECKS that all maps are reachable, every exit/door/sign can be walked to
  tools/fr_data.py        where each building sits inside the real FireRed town layouts (check with tools/check_stamps.py)
  _not_gba/, tools/_old_emerald_build_world.py   earlier attempts (hand-drawn lab, HGSS tiles, Emerald-look towns). Not used.

LOOK
  Every city uses a different FireRed town tileset so the towns look different from each other and from Emerald:
  Birchfield = Pallet Town (red roofs + Oak's lab as the science lab), Meadowvale = Viridian, Pinewood and Stonegate = Pewter,
  Cragton = Lavender, Lakehaven = Cerulean, Sandport = Vermilion, Crownport = Celadon. The layouts are new, not the real towns.

CHANGE THE WORLD
  Edit tools/build_world.py (CITIES = what sits in each town quarter, TEXT = what people say, MONS = which Pokemon wander),
  then run:  python "POKE LAB/tools/build_world.py"   (it stops with a list of problems if a map would be cut off)

SPRITE SOURCES (personal use only; Nintendo / Game Freak art)
  Towns/tiles/buildings: sprites/gba_firered (pret/pokefirered tilesets + town layouts, fetched by fetch.py)
  People: sprites/trainers_walking/emerald (pret/pokeemerald)
  Pokemon: sprites/trainers_walking/followers_baptiste (GBA-style follower sheets)
