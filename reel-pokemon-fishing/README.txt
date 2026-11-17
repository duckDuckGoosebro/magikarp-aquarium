REEL POKEMON FISHING
====================
A Reel Fishing (PS1) inspired game. Every fish is a real Pokemon sprite taken from the
shared sprite folder (FISH TANK 2/sprites). Nothing about the fish is generated.
The map, rods, lures, angler and scenery are drawn in code.

PLAY
  Double-click PLAY.bat (opens http://localhost:8792 and prints the phone address),
  or just open index.html in a browser. Saves live in the browser (localStorage).

CONTROLS (PlayStation style - Reel Fishing feel, first-person from behind your rod)
  LEFT / RIGHT (A D) ....... aim the cast; during a fight tilt the rod against the fish
  X  (Space, hold) ......... charge and release to cast (or tap the water to cast there); hold to reel
  UP / DOWN (W S) .......... lure depth
  O  (J) ................... jerk the lure; HOOK the fish when HIT! flashes
  Q E ...................... change lure     SQUARE / Esc ..... menu
  Lure cam (bottom left) shows your lure underwater; the sonar (top right) shows fish blips.
  When a fish is hooked the whole screen dives underwater for the fight.

GAME
  6 spots (unlock by discovering different Pokemon): Lilypad Pond, Rushing River, Sunny Shore,
  Crystal Cavern, Abyss Trench, Mythic Spring.   149 Pokemon fish, size-varied, 1-in-40 shinies.
  6 rods (Old -> Rainbow) with line strength / cast distance / reel speed.
  9 lures with different dive/sink behaviour and which depth they tempt.
  Day / night / dusk / dawn and rain change which Pokemon bite. Legendaries (Suicune, Lugia, Kyogre,
  Tapu Fini, Volcanion, Walking Wake) only show up in the Mythic Spring under special conditions.
  Fight system: line tension gauge, fish stamina, runs, jumps, line snaps.
  Journal (dex), tackle shop, sell or release, 3-minute tournaments with rivals and prizes.

GRAPHICS - PS1 style
  The 3D lake is software-rendered at 384x216 with 15-bit colour and ordered dithering, then blown
  up with nearest-neighbour (chunky PlayStation look). Menus use RPG-style blue windows and pixel fonts
  (Press Start 2P / VT323 from Google Fonts). Day/night, rain, lightning, sun glints, fish jumping out of
  the water, an underwater lure cam and an underwater fight view. Pokemon sprites stay untouched.

FOLDERS
  js/        game code (core, defs, gfx = painted backdrops, actors = lures, ps1 = PS1 renderer, save, spot, spotdraw, menus, main)
  sprites/   right-facing Pokemon strips + shiny strips (built by tools/build_assets.py)
  data.js    species + spot fish pools (built by tools/build_assets.py)
  tools/     build_assets.py - re-run after changing the fish table / pools

Sprites: PMDCollab SpriteCollab, CC BY-NC 4.0 (credit the artists, non-commercial use).

HOOK FIX
  The lure/hook now meets the fish's MOUTH, not its middle or tail: tools/add_mouths.py stores a mouth point ("mo") for every species in data.js
  (run it again after tools/build_assets.py), the fish swims so its mouth reaches the lure, and the line ends at the mouth while you fight it.
  A copy of the game from before this fix is in ../REEL POKEMON FISHING (no hook fix). Magikarp's sprite strip was also flipped right-side-up.
