# Magikarp Aquarium

A silly tank game based on Insaniquarium, made with fish Pokémon sprites (Magikarp, Goldeen, Gyarados, Remoraid, Relicanth).
Feed your fish, collect their coins, fend off the raging red Gyarados, and buy the three egg pieces to finish each level.

## Download and play (Windows, nothing to install)
| Version | Download |
|---|---|
| **Classic** - Insaniquarium-style tank | [MagikarpAquarium-Classic-Windows.zip](https://github.com/duckDuckGoosebro/magikarp-aquarium/raw/main/downloads/MagikarpAquarium-Classic-Windows.zip) |
| **Rogue** - roguelike card run | [MagikarpAquarium-Rogue-Windows.zip](https://github.com/duckDuckGoosebro/magikarp-aquarium/raw/main/downloads/MagikarpAquarium-Rogue-Windows.zip) |

Unzip, then double-click the `.exe`. Windows may show a "Windows protected your PC" warning because the app isn't code-signed: click **More info > Run anyway**.
Your progress is saved in a `save.json` next to the `.exe`. To build the `.exe` files yourself, run `build_windows.bat`.

## Versions
- **Classic version** (this folder's `fishtank2.py`): the Insaniquarium-style tank. Feed fish, collect coins, buy the egg pieces.
- **Rogue version** ([`rogue-version/`](rogue-version)): a roguelike card run. Climb floors, earn XP, and pick 1 of 4 upgrade / trade-off / curse cards every level-up.
  Run it with `cd rogue-version` then `python fishtank3.py` (or double-click `START_FISH_TANK_3.bat`). See `rogue-version/README.txt`.

## Run it
```
pip install pillow
python fishtank2.py
```
(On Windows you can double-click `START_FISH_TANK_2.bat`.) Needs Python 3 with tkinter, which ships with Python.

See `README.txt` for the full rules and prices.

## Credits / disclaimer
Unofficial, non-commercial fan project. Not affiliated with Nintendo, Game Freak, The Pokémon Company or PopCap.
Sprites come from [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab) (CC BY-NC 4.0) — credit goes to the artists there.
