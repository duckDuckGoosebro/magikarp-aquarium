POKE RANCH CARDS - a ranch-building roguelike deckbuilder with Pokemon.

Play: double-click PLAY.bat (or open index.html in a browser). No install needed.

How it plays
  You start with ONE island tile. Every island has 12 slots (4 x 3). Put crops (Leek Patch, Apple Tree, Oran Tree, Razz Bush,
  Mushroom Patch, Flower Bed), Pokemon and buildings in the slots. Things on the same island help each other.
  Buy more islands next to yours (you choose grass, water or rock).
  Terracards-style rules: Wells make Water (5 each, water islands 2); every land crop drinks Water each turn (Apple Tree 2, water crops 0; shown on the card)
  or does nothing. Same crops side by side make +1. Wells and Fences cost 1 coin upkeep a turn.
  Taxes every 10 turns; coins below zero at the end of a day ends the run. Card picks every 3 turns,
  3 free rerolls to start and +1 for each turn you don't reroll. The Well is in the starting deck.
  Tap the exact square to plant or build. Pokemon must go in a Fence (2 per fence) and walk inside it.
  Workshops: Furnace (Hard Stones -> Metal Coats), Bakery (Leeks + Oran Berry -> Old Gateau), Well, Lab,
  Day Care, Bank. Water islands: Lotus Root, Clam Bed, Ferry Port, Lotad, Corsola, Slowpoke, Lapras.

Files
  index.html   page layout
  style.css    look of the board, cards, panels
  game.js      all rules: cards (CARDS), badges (BADGES), loan amounts (RENT), wild visitors (WILD)
  tools/build_assets.py   copies/cuts the pictures below out of ../sprites and writes assets/walkdata.js
  assets/walk/<dex>_walk.png, _idle.png  walking sheets   (sprites/spritecollab_full/sprite/<dex>, PMDCollab, CC BY-NC 4.0)
  assets/portraits/<dex>.png  card art                    (sprites/spritecollab_full/portrait/<dex>/Normal.png, PMDCollab)
  assets/icons/<dex>.png      little icon in a Pokemon's slot (pokerogue icons in sprites/collected_from_ai_folder)
  assets/buildings/*.png      buildings cut from sprites/overworld_buildings/community__jls-dchrn__HGSS_pokemon_tileset
  assets/ground/*.png         grass (HGSS tileset), water/sand/rock (PMD dungeon tiles in .../agent enviroment/scenery)
  assets/scenery/*.png        trees, rocks, flowers, signs, lamps (HGSS tileset + PMD tiles)
  assets/crops/*.png          every crop grows through Platinum berry-tree stages (sprites/.../pokeplatinum berry_trees)
  assets/items/*.png          goods, coins (Nugget), energy (PP Up), action cards, badges (type Ribbons), card back (Poke Ball):
                              item sprites from the pokerogue-assets repo (ai/agent enviroment/pokerogue-assets/images/items)
  assets/scenery/soil.png     HGSS soft-soil patch under crops

Every picture comes from a Pokemon game or fan-game repo, except the Fence pen (assets/buildings/pen.png),
which is drawn by tools/draw_fence.py (owner asked for a custom wooden fence).

Add a Pokemon: add its dex number to DEX in tools/build_assets.py, run it, copy its icon into assets/icons,
then add an entry to CARDS in game.js.
