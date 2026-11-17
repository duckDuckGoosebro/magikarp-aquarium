'use strict';
const SAVE_KEY = 'reel_pokemon_fishing_v1';
function defaultSave() {
  return { money: 250, rod: 'old', lure: 'worm', rods: { old: 1 }, lures: { worm: 1 }, dex: {}, tour: {}, stats: { caught: 0, earned: 0, sold: 0, released: 0, snapped: 0, big: 0 }, sound: true, music: true };
}
let SAVE = defaultSave();
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { const o = JSON.parse(raw); SAVE = Object.assign(defaultSave(), o); SAVE.stats = Object.assign(defaultSave().stats, o.stats || {}); }
  } catch (e) { }
  if (!SAVE.rods.old) SAVE.rods.old = 1;
  if (!SAVE.lures.worm) SAVE.lures.worm = 1;
  window.GFX_4K = SAVE.gfx4k !== false; fitCanvas(); Snd.on = SAVE.sound !== false; Snd.musicOn = SAVE.music !== false;
}
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } }
function resetSave() { SAVE = defaultSave(); saveGame(); }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
const dexCount = () => Object.keys(SAVE.dex).length;
const dexTotal = () => Object.keys(SPECIES).length;
function spotUnlocked(s) { return dexCount() >= s.unlock; }
