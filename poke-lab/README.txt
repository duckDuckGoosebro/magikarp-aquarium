POKE LAB - walk through 14 connected towns. ALL ART IS POKEMON GBA (FireRed tiles, Emerald walking sprites).

PLAY
  Double-click PLAY.bat (or open index.html). Online: https://duckduckgoosebro.github.io/magikarp-aquarium/poke-lab/
  PC:    arrows / WASD walk, Space or Z talks, M = world map, Esc closes boxes.
  Phone: on-screen pad walks, A talks, MAP opens the world map.
  Your Porygon follows you. Progress (which towns you've visited) is saved in the browser.

THE WORLD  (14 towns, 18 winding routes, every map joined to its neighbours)
  Press M for the world map. Start in BIRCHFIELD (science lab, Sunny the clown).
  Towns: Birchfield, Meadowvale, Pinewood, Frostpeak, Cragton, Summit, Stonegate, Crownport, Lakehaven, Marshby,
         Emberisle, Sandport, Tidewell, Dunmoor.
  Each town uses a different FireRed tileset, and every building in a town is DIFFERENT (no copies).
  Town layouts are new and organic: winding sand roads from each exit to a plaza, a little path to every door,
  plus lakes / sea coast / rocks / woods / ponds depending on the town. Small towns are smaller maps.
  The only person is Sunny; the rest of the life is wandering Pokemon.

FILES
  index.html, game.js     the game (tile walking, map switching, follower, Sunny, signs, world map)
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
