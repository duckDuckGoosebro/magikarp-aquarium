FISH TANK 2 - Insaniquarium-style (fish Pokemon sprites only)
============================================================
Double-click START_FISH_TANK_2.bat (python + Pillow). The original idle version is untouched in ../FISH TANK.

Goal: buy the 3 egg pieces (top-right shop button) to finish the level. Each level costs more and the raging Gyarados comes sooner and tougher.

Click: coin = pick it up | raging red Gyarados = hit it | water = drop food ($5)

Fish (shop buttons)
  Magikarp  $100  guppy: eat food, grow small > medium > large, drop silver then gold coins
  Seaking   $250  breeder: gives birth to baby Goldeen (they grow and drop coins like Magikarp)
  Gyarados  $1000 carnivore: eats baby Magikarp, drops diamonds ($200)
  Remoraid  $600  pet: collects coins by itself, shoots the raging Gyarados
  Relicanth $1500 pet: makes a pearl ($250) every minute
Fish with a "!" are hungry. Hungry fish only eat when hungry; a fish that reaches 0 starves.
Upgrades: More Food (max pellets on screen), Food Quality (more growth), Weapon (click damage), Auto Feeder (idle helper, pays $5 per food).
Coins vanish after ~14s. Lose all fish and you can't afford a new one = game over (try again).

Sprites: ./sprites/<name>/ (copied from ../sprites/pmd; PMDCollab, CC BY-NC 4.0). The boss is Gyarados with swapped colour channels.
Progress (level reached) is saved in save.json.
