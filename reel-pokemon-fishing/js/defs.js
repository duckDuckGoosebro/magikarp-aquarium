'use strict';
// ---------------------------------------------------------------- rods, lures, spots (all drawn in code)
const RODS = [
  { id: 'old', name: 'Old Rod', line: 36, cast: 24, reel: 1.0, price: 0, c1: '#8a5a2b', c2: '#d9b26b', desc: 'A wobbly bamboo stick. Fine for small fry.' },
  { id: 'good', name: 'Good Rod', line: 55, cast: 30, reel: 1.2, price: 400, c1: '#2e7d4a', c2: '#b6f0c0', desc: 'Green fibreglass. A stronger line and a longer cast.' },
  { id: 'super', name: 'Super Rod', line: 80, cast: 38, reel: 1.45, price: 2000, c1: '#2a62c4', c2: '#cfe5ff', desc: 'Blue graphite. Handles the river bruisers.' },
  { id: 'ultra', name: 'Ultra Rod', line: 110, cast: 46, reel: 1.7, price: 7500, c1: '#262626', c2: '#ffd23f', desc: 'Carbon and gold. Built for deep water giants.' },
  { id: 'master', name: 'Master Rod', line: 150, cast: 54, reel: 2.0, price: 20000, c1: '#7b2fbe', c2: '#ff7ad9', desc: 'Glows faintly. Rumoured to calm legendary Pokémon.' },
  { id: 'rainbow', name: 'Rainbow Rod', line: 200, cast: 64, reel: 2.4, price: 45000, c1: '#ffffff', c2: '#ffd23f', desc: 'The ultimate rod. Nothing in the water can snap it easily.' },
];
// hab multipliers: how much fish living at surface / mid / bottom like this lure
const LURES = [
  { id: 'worm', name: 'Wiggle Worm', price: 0, size: 1, sink: 0.9, dive: 0, speed: 1.0, app: 0.9, hab: { s: 0.6, m: 1, b: 1 }, desc: 'Plain old bait. Works on small fish near the bottom.' },
  { id: 'spinner', name: 'Silver Spinner', price: 150, size: 2, sink: 0.5, dive: -0.35, speed: 1.1, app: 1.1, hab: { s: 1.3, m: 1.2, b: 0.4 }, desc: 'Flashy blade. Rises as you reel. Great for shallows.' },
  { id: 'popper', name: 'Splash Popper', price: 300, size: 3, sink: 0, dive: 0, speed: 1.0, app: 1.1, hab: { s: 2.4, m: 0.35, b: 0 }, desc: 'Floats on top. JERK to make it pop. Surface fish only.' },
  { id: 'crank', name: 'Deep Crank', price: 600, size: 3, sink: -0.5, dive: 1.5, speed: 1.0, app: 1.0, hab: { s: 0.4, m: 1.5, b: 1.1 }, desc: 'Dives when reeled, floats up when you stop.' },
  { id: 'jig', name: 'Lead Jig', price: 800, size: 2, sink: 2.4, dive: 0, speed: 0.9, app: 1.0, hab: { s: 0.1, m: 0.8, b: 1.9 }, desc: 'Sinks like a rock. Bottom dwellers love it.' },
  { id: 'spoon', name: 'Gold Spoon', price: 1200, size: 3, sink: 1.2, dive: 0.2, speed: 1.15, app: 1.15, hab: { s: 0.6, m: 1.7, b: 1.0 }, desc: 'Wobbles like a hurt fish. Big mid-water fish bite it.' },
  { id: 'shrimp', name: 'Soft Shrimp', price: 2000, size: 2, sink: 1.0, dive: 0, speed: 1.0, app: 1.3, hab: { s: 1.1, m: 1.3, b: 1.3 }, desc: 'Smells delicious. The best all-rounder.' },
  { id: 'glow', name: 'Glow Lure', price: 4000, size: 3, sink: 1.1, dive: 0.1, speed: 1.0, app: 1.2, hab: { s: 0.7, m: 1.4, b: 1.6 }, night: 1.8, desc: 'Shines in the dark. Doubly good at night and in caves.' },
  { id: 'rainbow', name: 'Rainbow Lure', price: 12000, size: 4, sink: 1.0, dive: 0.1, speed: 1.1, app: 1.6, hab: { s: 1.4, m: 1.6, b: 1.6 }, rare: 2.2, desc: 'Shimmers every colour. Rare Pokémon cannot resist it.' },
];
const SPOTS = [
  { id: 'pond', name: 'Lilypad Pond', W: 40, D: 8, unlock: 0, fc: 15, tour: 38, ent: 150, water: ['#7fe0c0', '#1b6a60'], env: 'pond', cave: false, desc: 'A calm green pond. Perfect for learning the ropes.' },
  { id: 'river', name: 'Rushing River', W: 50, D: 11, unlock: 8, fc: 17, tour: 95, ent: 300, water: ['#8fd5ff', '#1a5a96'], env: 'river', cave: false, desc: 'Fast, cold water with strong swimmers.' },
  { id: 'coast', name: 'Sunny Shore', W: 56, D: 16, unlock: 20, fc: 19, tour: 150, ent: 600, water: ['#6fe3ff', '#0d5f9e'], env: 'coast', cave: false, desc: 'Sandy beach and open sea. Salty Pokémon everywhere.' },
  { id: 'cave', name: 'Crystal Cavern', W: 46, D: 14, unlock: 34, fc: 18, tour: 230, ent: 1000, water: ['#5fd0c8', '#0b2f56'], env: 'cave', cave: true, desc: 'A dark underground lake full of ancient fish.' },
  { id: 'deep', name: 'Abyss Trench', W: 70, D: 40, unlock: 48, fc: 30, tour: 520, ent: 2000, water: ['#3aa6e8', '#04153a'], env: 'deep', cave: false, desc: 'Fish from a boat over the deep. Giants lurk below.' },
  { id: 'legend', name: 'Mythic Spring', W: 60, D: 24, unlock: 66, fc: 26, tour: 700, ent: 4000, water: ['#9cf0ff', '#2a2f8a'], env: 'legend', cave: false, desc: 'A sacred spring. Legendary Pokémon wake here.' },
];
const SPOT_BY = {}; SPOTS.forEach(s => SPOT_BY[s.id] = s);
const ROD_BY = {}; RODS.forEach(r => ROD_BY[r.id] = r);
const LURE_BY = {}; LURES.forEach(l => LURE_BY[l.id] = l);
const RAIN_LOVERS = new Set(['poliwag', 'poliwhirl', 'politoed', 'tympole', 'palpitoad', 'seismitoad', 'froakie', 'frogadier', 'greninja', 'lotad', 'lombre', 'ducklett', 'swanna', 'psyduck', 'golduck', 'wooper', 'quagsire', 'kyogre']);

