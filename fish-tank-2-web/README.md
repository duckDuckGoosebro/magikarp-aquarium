# Fish Tank (web / iPhone)

Insaniquarium-style game made of fish Pokemon sprites. Touch controls, works offline once loaded.

**Play on iPhone:** open the hosted page in Safari > Share > *Add to Home Screen* (runs fullscreen, saves progress on the phone).

Tap water = drop food ($5) | tap coin = collect | tap raider = hit | tap a fish showing "evolve" = evolve.
MENU has Select tank, Wall of unlocks, Settings and Debug (UNLOCK EVERYTHING).

Rebuild data + sprites from the desktop game: `python tools/build_assets.py` (needs ../FISH TANK 2 and Pillow).
Local test: `python -m http.server 8765` then open http://localhost:8765

Sprites: PMDCollab SpriteCollab (CC BY-NC 4.0). Non-commercial use only; credit the sprite artists.
