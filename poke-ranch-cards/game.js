/* Poké Ranch Cards — a ranch-building roguelike deckbuilder.
   Start with ONE island tile. Every land tile has 12 slots: plant crops, house Pokémon, build buildings.
   Things on the same tile help each other. Sell goods, pay the loan every 5 turns, buy more land. */
'use strict';

const G = 11;                       // world grid G x G, the island starts in the middle
const SLOTS = 12;                   // 4 x 3 grid of slots on every island
const ART = 'assets/';
const portrait = d => `${ART}portraits/${d}.png`;
const icon = d => `${ART}icons/${d}.png`;
const bimg = b => `${ART}buildings/${b}.png`;
const cimg = c => `${ART}crops/${c}.png`;
const simg = s => `${ART}scenery/${s}.png`;

/* ---------- icons: real Pokémon item sprites (pokerogue-assets repo) ---------- */
const ITEM = {
  berry:'oran_berry', wheat:'leek', corn:'sweet_apple', mushroom:'big_mushroom', fish:'mystic_water', ore:'hard_stone',
  milk:'berry_juice_good', wool:'silk_scarf', egg:'common_egg', honey:'flower_sweet', coin:'nugget', bolt:'pp_up',
  basket:'berry_pouch', fert:'miracle_seed', candy:'rare_candy', potion:'potion', notes:'map', sale:'amulet_coin',
  sun:'sun_flute', deed:'mystic_ticket', water_ter:'water_stone', rock_ter:'everstone', grass_ter:'leaf_stone',
};
const SVG = Object.fromEntries(Object.entries(ITEM).map(([k, v]) => [k, `<img class="gimg" src="${ART}items/${v}.png" alt="">`]));
const svgIco = (k, s = 16) => `<span class="ico" style="width:${s}px;height:${s}px">${SVG[k]}</span>`;

/* ---------- goods ---------- */
const RES = {
  berry:{n:'Oran Berries',base:2}, wheat:{n:'Leeks',base:3}, corn:{n:'Sweet Apples',base:4}, mushroom:{n:'Big Mushrooms',base:6},
  fish:{n:'Mystic Water',base:4}, ore:{n:'Hard Stones',base:6}, milk:{n:'Berry Juice',base:5}, wool:{n:'Silk',base:5},
  egg:{n:'Eggs',base:8}, honey:{n:'Sweets',base:9},
};
const RES_KEYS = Object.keys(RES);
const FOOD = ['berry', 'corn', 'wheat', 'mushroom'];

/* ---------- cards ---------- */
// kind: crop | mon | bld | ter | act.  terrain: which land it can go on.
const CARDS = {
  // Crops (grow for a few turns, then harvest every turn)
  wheat:{kind:'crop',name:'Leek Patch',cost:0,rar:'C',terrain:['grass'],img:'leek',grow:2,make:{wheat:2},text:'Ripe in 2 turns, then 2 Leeks every turn.'},
  corn:{kind:'crop',name:'Apple Tree',cost:1,rar:'C',terrain:['grass'],img:'apple',grow:3,make:{corn:3},text:'Ripe in 3 turns, then 3 Sweet Apples every turn.'},
  mushroom:{kind:'crop',name:'Mushroom Patch',cost:1,rar:'U',terrain:['grass','rock'],img:'mushroom',grow:3,make:{mushroom:2},text:'Grows on grass or rock. Ripe in 3 turns, then 2 Big Mushrooms.'},
  oran:{kind:'crop',name:'Oran Tree',cost:1,rar:'C',terrain:['grass'],img:'oran',grow:2,make:{berry:3},text:'Ripe in 2 turns, then 3 Oran Berries every turn.'},
  razz:{kind:'crop',name:'Razz Bush',cost:0,rar:'U',terrain:['grass'],img:'razz',grow:1,make:{berry:2},text:'Ripe next turn, then 2 Oran Berries. Combee love it.'},
  flowers:{kind:'crop',name:'Flower Bed',cost:0,rar:'U',terrain:['grass'],img:'flowers',grow:0,make:{},scenery:true,text:'Makes nothing. Combee +2 Honey each, Pokémon here heal.'},
  // Pokémon
  oddish:{kind:'mon',name:'Oddish',cost:1,rar:'C',terrain:['grass'],line:[[43,'Oddish'],[44,'Gloom'],[45,'Vileplume']],evo:[3,7],prod:{berry:[2,3,4]},text:'Makes Oran Berries.'},
  bulbasaur:{kind:'mon',name:'Bulbasaur',cost:2,rar:'R',terrain:['grass'],line:[[1,'Bulbasaur'],[2,'Ivysaur'],[3,'Venusaur']],evo:[3,7],prod:{berry:[1,2,3]},aura:[1,1,2],text:'Oran Berries. Crops on its island make +1 (Venusaur +2).'},
  psyduck:{kind:'mon',name:'Psyduck',cost:1,rar:'C',terrain:['water'],line:[[54,'Psyduck'],[55,'Golduck']],evo:[4],prod:{fish:[2,4]},text:'Collects Mystic Water.'},
  magikarp:{kind:'mon',name:'Magikarp',cost:1,rar:'U',terrain:['water'],line:[[129,'Magikarp'],[130,'Gyarados']],evo:[5],prod:{fish:[1,8]},text:'Weak... until it becomes Gyarados (8 Mystic Water).'},
  marill:{kind:'mon',name:'Marill',cost:1,rar:'U',terrain:['water'],line:[[183,'Marill'],[184,'Azumarill']],evo:[4],prod:{fish:[1,2]},text:'Mystic Water. Other water Pokémon on its island make +1.'},
  wooper:{kind:'mon',name:'Wooper',cost:1,rar:'C',terrain:['water'],line:[[194,'Wooper'],[195,'Quagsire']],evo:[4],prod:{fish:[1,2],berry:[1,2]},text:'Mystic Water and Oran Berries.'},
  geodude:{kind:'mon',name:'Geodude',cost:1,rar:'C',terrain:['rock'],line:[[74,'Geodude'],[75,'Graveler'],[76,'Golem']],evo:[3,7],prod:{ore:[2,3,5]},text:'Digs up Hard Stones.'},
  diglett:{kind:'mon',name:'Diglett',cost:1,rar:'U',terrain:['grass','rock'],line:[[50,'Diglett'],[51,'Dugtrio']],evo:[4],prod:{ore:[1,2]},till:true,text:'Hard Stones. Tills the soil: crops on its island make +1.'},
  miltank:{kind:'mon',name:'Miltank',cost:2,rar:'C',terrain:['grass'],line:[[241,'Miltank']],evo:[],prod:{milk:[2]},text:'2 Berry Juice, +1 for each Leek Patch on its island.'},
  tauros:{kind:'mon',name:'Tauros',cost:2,rar:'U',terrain:['grass'],line:[[128,'Tauros']],evo:[],prod:{milk:[1]},text:'1 Berry Juice, +2 for each Miltank on its island.'},
  mareep:{kind:'mon',name:'Mareep',cost:1,rar:'C',terrain:['grass'],line:[[179,'Mareep'],[180,'Flaaffy'],[181,'Ampharos']],evo:[3,7],prod:{wool:[1,2,3]},text:'Silk (+1 with Leeks on its island). Ampharos doubles buildings there.'},
  chansey:{kind:'mon',name:'Chansey',cost:2,rar:'U',terrain:['grass'],line:[[113,'Chansey'],[242,'Blissey']],evo:[5],prod:{egg:[1,3]},text:'Eggs, +1 per Apple Tree on its island. Heals its island.'},
  combee:{kind:'mon',name:'Combee',cost:1,rar:'U',terrain:['grass'],line:[[415,'Combee'],[416,'Vespiquen']],evo:[4],prod:{honey:[0,0]},text:'Sweets: +1 per berry tree, +2 per Flower Bed on its island (×2 evolved).'},
  pikachu:{kind:'mon',name:'Pikachu',cost:1,rar:'U',terrain:['grass','rock'],line:[[25,'Pikachu'],[26,'Raichu']],evo:[4],coins:[3,7],text:'Sells electricity: +3 coins a turn (Raichu +7).'},
  meowth:{kind:'mon',name:'Meowth',cost:1,rar:'C',terrain:['grass','rock'],line:[[52,'Meowth'],[53,'Persian']],evo:[4],coins:[1,2],text:'Pay Day: coins for each other Pokémon on its tile and next door.'},
  machop:{kind:'mon',name:'Machop',cost:2,rar:'U',terrain:['grass','rock'],line:[[66,'Machop'],[67,'Machoke'],[68,'Machamp']],evo:[3,7],aura:[1,1,2],text:'Works hard: everything else on its island makes +1 (Machamp +2).'},
  eevee:{kind:'mon',name:'Eevee',cost:2,rar:'R',terrain:['grass'],line:[[133,'Eevee']],evo:[],copy:true,text:'Makes 1 of every good the rest of its island makes.'},
  snorlax:{kind:'mon',name:'Snorlax',cost:3,rar:'R',terrain:['grass'],line:[[143,'Snorlax']],evo:[],coins:[20],food:3,text:'Eats 3 food. Fans pay 20 coins a turn to watch it nap.'},
  // Buildings
  barn:{kind:'bld',name:'Barn',cost:1,rar:'C',terrain:['grass'],img:'barn',text:'Berry Juice, Silk and Egg makers on this island make +1.'},
  tower:{kind:'bld',name:'Water Tower',cost:1,rar:'C',terrain:['grass','rock'],img:'watertower',text:'Crops on this island and the islands next to it make +1.'},
  center:{kind:'bld',name:'Poké Center',cost:2,rar:'U',terrain:['grass','rock'],img:'center',text:'Pokémon on this island eat for free and heal.'},
  mart:{kind:'bld',name:'Poké Mart',cost:2,rar:'U',terrain:['grass','rock'],img:'mart',text:'All goods sell for +20%.'},
  gym:{kind:'bld',name:'Gym',cost:1,rar:'U',terrain:['grass','rock'],img:'gym',text:'Pokémon on this island get +1 XP each turn.'},
  dock:{kind:'bld',name:'Fishing Boat',cost:1,rar:'C',terrain:['water'],img:'dock',make:{fish:2},text:'2 Mystic Water. Water Pokémon on this island make +1.'},
  mine:{kind:'bld',name:'Mine',cost:1,rar:'C',terrain:['rock'],img:'mine',make:{ore:2},text:'2 Hard Stones. Rock Pokémon on this island make +1.'},
  hut:{kind:'bld',name:'Granary',cost:1,rar:'U',terrain:['grass','rock'],img:'hut',text:'Leeks, Apples and Mushrooms sell for +2 each.'},
  house:{kind:'bld',name:'Trainer House',cost:2,rar:'R',terrain:['grass','rock'],img:'house',text:'Draw +1 card every turn.'},
  lighthouse:{kind:'bld',name:'Lighthouse',cost:3,rar:'R',terrain:['grass','rock'],img:'lighthouse',text:'+1 Energy every turn.'},
  market:{kind:'bld',name:'Market Stall',cost:1,rar:'U',terrain:['grass','rock'],img:'market',text:'+3 coins for each different good sold in a turn.'},
  store:{kind:'bld',name:'Dept. Store',cost:2,rar:'R',terrain:['grass','rock'],img:'store',coinsB:3,text:'+3 coins a turn. Card picks show 1 more card.'},
  // Terrain
  pond:{kind:'ter',name:'Dig a Pond',cost:0,rar:'C',to:'water',ico:'water_ter',text:'Turn an empty island into water.'},
  boulder:{kind:'ter',name:'Rock Slide',cost:0,rar:'C',to:'rock',ico:'rock_ter',text:'Turn an empty island into rock.'},
  meadow:{kind:'ter',name:'Meadow',cost:0,rar:'C',to:'grass',ico:'grass_ter',text:'Turn an empty island into grass.'},
  // Actions
  basket:{kind:'act',name:'Berry Basket',cost:0,rar:'C',ico:'basket',text:'Gain 4 Oran Berries.'},
  fert:{kind:'act',name:'Fertilizer',cost:1,rar:'C',ico:'fert',target:'tile',text:'Crops on an island grow 2 turns at once.'},
  candy:{kind:'act',name:'Rare Candy',cost:1,rar:'U',ico:'candy',target:'mon',text:'Pokémon on an island get +3 XP.'},
  potion:{kind:'act',name:'Potion',cost:0,rar:'C',ico:'potion',target:'mon',text:'Fully heal the Pokémon on an island, +1 XP.'},
  notes:{kind:'act',name:"Prof's Notes",cost:1,rar:'C',ico:'notes',text:'Draw 2 cards.'},
  sale:{kind:'act',name:'Sale Day',cost:1,rar:'U',ico:'sale',text:'Goods sell for +50% this turn.'},
  festival:{kind:'act',name:'Harvest Festival',cost:2,rar:'R',ico:'sun',text:'Everything makes double this turn.'},
  deed:{kind:'act',name:'Land Deed',cost:1,rar:'U',ico:'deed',target:'land',text:'Claim a new island tile for free.'},
};
const RAR_W = {C: 60, U: 30, R: 12};

/* ---------- badges ---------- */
const BADGES = {
  boulder:{n:'Boulder Badge',c:'#a68b6a',e:'ribbon_rock',t:'Rock Pokémon make +1.'},
  cascade:{n:'Cascade Badge',c:'#3f9be0',e:'ribbon_water',t:'Water Pokémon make +1.'},
  rainbow:{n:'Rainbow Badge',c:'#6dbb4d',e:'ribbon_grass',t:'Ripe crops make +1.'},
  thunder:{n:'Thunder Badge',c:'#f2c230',e:'ribbon_electric',t:'+1 Energy every turn.'},
  marsh:{n:'Marsh Badge',c:'#b14fd8',e:'ribbon_psychic',t:'Draw +1 card every turn.'},
  volcano:{n:'Volcano Badge',c:'#e25b4b',e:'ribbon_fire',t:'All goods sell for +25%.'},
  earth:{n:'Earth Badge',c:'#3f9d4a',e:'ribbon_ground',t:'New land costs half.'},
  zephyr:{n:'Zephyr Badge',c:'#9ad0f5',e:'ribbon_flying',t:'Pokémon earn double XP.'},
  soul:{n:'Soul Badge',c:'#ff7ab0',e:'ribbon_fairy',t:'Hungry Pokémon never run away.'},
  hive:{n:'Hive Badge',c:'#f2a72e',e:'ribbon_bug',t:'Honey and Egg makers make +2.'},
  plain:{n:'Plain Badge',c:'#f6e7b8',e:'ribbon_normal',t:'Milk and Wool makers make +1.'},
  fog:{n:'Fog Badge',c:'#8b8f99',e:'ribbon_ghost',t:'Card picks show 1 more card.'},
  mineral:{n:'Mineral Badge',c:'#c4ccd8',e:'ribbon_steel',t:'Every building gives +2 coins a turn.'},
  glacier:{n:'Glacier Badge',c:'#bfe8ff',e:'ribbon_ice',t:'Interest: +1 coin per 10 you hold (max +15).'},
  rising:{n:'Rising Badge',c:'#7a5bb5',e:'ribbon_dragon',t:'Crops ripen 1 turn sooner.'},
};

const RENT = [25, 60, 120, 200, 300, 440, 620, 840, 1100, 1450];
const WILD = [16, 19, 10, 13, 161, 263, 396, 399, 403, 531, 162];   // wild Pokémon that wander by

/* ---------- state ---------- */
let S, busy = false, uidc = 1;
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mk = id => ({id, uid: uidc++});
const CENTER = Math.floor(G / 2) * G + Math.floor(G / 2);

function newTile(t) { return {t, owned: false, slots: Array(SLOTS).fill(null), seed: Math.floor(Math.random() * 1e9)}; }

function newRun() {
  const board = [];
  for (let i = 0; i < G * G; i++) board.push(newTile('grass'));
  board[CENTER].owned = true;
  const deck = ['wheat', 'wheat', 'wheat', 'wheat', 'oran', 'razz', 'oddish', 'miltank', 'mareep', 'psyduck', 'basket', 'potion'].map(mk);
  S = {
    turn: 1, coins: 15, energy: 3, deck: shuffle(deck), hand: [], discard: [], board,
    stock: Object.fromEntries(RES_KEYS.map(k => [k, 0])),
    price: Object.fromEntries(RES_KEYS.map(k => [k, 1])),
    prevPrice: Object.fromEntries(RES_KEYS.map(k => [k, 1])),
    hold: Object.fromEntries(RES_KEYS.map(k => [k, false])),
    badges: [], landBought: 0, payIndex: 0, mods: {sale: false, festival: false},
    sel: null, lock: null, log: [], over: false, earned: 0, rerollCost: 5, endless: false, ranAway: 0, evolved: 0,
  };
  S.hold.berry = true;
  walkers.clear(); $('fx').innerHTML = '';
  log('Welcome! You own one little island. Fill its 12 slots, sell what it makes and buy more land.', 'gd');
  startTurn(true);
}

/* ---------- helpers ---------- */
const rc = i => [Math.floor(i / G), i % G];
const nbs = i => { const [r, c] = rc(i), o = []; if (r > 0) o.push(i - G); if (r < G - 1) o.push(i + G); if (c > 0) o.push(i - 1); if (c < G - 1) o.push(i + 1); return o; };
const T = i => S.board[i];
const occs = i => T(i).slots.filter(Boolean);
const kindOf = o => CARDS[o.id].kind;
const monsOn = i => occs(i).filter(o => kindOf(o) === 'mon');
const countOn = (i, id) => occs(i).filter(o => o.id === id).length;
const countB = id => S.board.reduce((a, t) => a + t.slots.filter(o => o && o.id === id).length, 0);
const has = b => S.badges.includes(b);
const stageName = o => CARDS[o.id].line ? CARDS[o.id].line[o.stage][1] : CARDS[o.id].name;
const stageDex = o => CARDS[o.id].line[o.stage][0];
const at = (arr, s) => arr[Math.min(s, arr.length - 1)];
const mainRes = o => { const d = CARDS[o.id]; if (d.prod) return Object.keys(d.prod)[0]; if (d.coins) return 'coins'; if (d.make) return Object.keys(d.make)[0]; return null; };
const foodOf = o => CARDS[o.id].food || 1;
const energyMax = () => 3 + countB('lighthouse') + (has('thunder') ? 1 : 0);
const drawN = () => 5 + countB('house') + (has('marsh') ? 1 : 0);
const owned = () => S.board.map((t, i) => i).filter(i => T(i).owned);
const landCost = () => Math.round((6 + 6 * S.landBought + S.landBought * S.landBought) * (has('earth') ? 0.5 : 1));
const priceMult = () => 1 + 0.2 * countB('mart') + (has('volcano') ? 0.25 : 0) + (S.mods.sale ? 0.5 : 0);
const sellPrice = k => Math.max(1, Math.round(RES[k].base * S.price[k] * priceMult()) + (['wheat', 'corn', 'mushroom'].includes(k) ? 2 * countB('hut') : 0));
const buyable = i => !T(i).owned && nbs(i).some(j => T(j).owned);
const freeSlot = i => T(i).slots.findIndex(s => !s);
const growNeed = o => Math.max(0, CARDS[o.id].grow - (has('rising') ? 1 : 0));
const ripe = o => o.age >= growNeed(o);
const fmt = n => n.toLocaleString();
function log(msg, cls = '') { S.log.unshift({msg, cls}); S.log.length = Math.min(S.log.length, 60); }

/* ---------- production ---------- */
// What one slot makes this turn: {items, coins, why}
function prodOf(i, s) {
  const o = T(i).slots[s], out = {items: {}, coins: 0, why: []};
  if (!o) return out;
  const d = CARDS[o.id], t = T(i).t, here = occs(i).filter(x => x !== o);
  const add = (k, n) => { out.items[k] = (out.items[k] || 0) + n; };
  let bonus = 0; const B = (n, why) => { if (n) { bonus += n; out.why.push(`${why} +${n}`); } };
  const tileAura = () => {
    for (const q of here) if (q.id === 'machop' && !q.hungry) B(at(CARDS.machop.aura, q.stage), stageName(q));
  };

  if (d.kind === 'crop') {
    if (!ripe(o)) { out.why.push(`Growing: ${growNeed(o) - o.age} turn(s) left`); return out; }
    for (const k in d.make) add(k, d.make[k]);
    if (!Object.keys(d.make).length) return out;
    for (const q of here) {
      if (q.id === 'bulbasaur' && !q.hungry) B(at(CARDS.bulbasaur.aura, q.stage), stageName(q));
      if (q.id === 'diglett' && !q.hungry) B(1, 'Diglett tills');
      if (q.id === 'tower') B(1, 'Water Tower');
    }
    const towersNear = nbs(i).reduce((a, j) => a + countOn(j, 'tower'), 0);
    if (towersNear) B(towersNear, 'Water Tower next door');
    tileAura();
    if (has('rainbow')) B(1, 'Rainbow Badge');
  } else if (d.kind === 'bld') {
    if (d.make) for (const k in d.make) add(k, d.make[k]);
    if (d.coinsB) out.coins += d.coinsB;
    if (has('mineral')) { out.coins += 2; out.why.push('Mineral Badge +2 coins'); }
    if (d.make) tileAura();
    if (here.some(q => q.id === 'mareep' && q.stage === 2 && !q.hungry)) {
      const m = mainRes(o); if (m && m !== 'coins' && bonus) { add(m, bonus); bonus = 0; }
      for (const k in out.items) out.items[k] *= 2; out.coins *= 2; out.why.push('Ampharos ×2');
    }
  } else if (d.kind === 'mon') {
    if (o.hungry) { out.why.push('Too hungry to work!'); return out; }
    const st = o.stage;
    if (d.prod) for (const k in d.prod) add(k, at(d.prod[k], st));
    if (d.coins) {
      let n = at(d.coins, st);
      if (o.id === 'meowth') { const c = Math.max(1, here.filter(q => kindOf(q) === 'mon').length + nbs(i).reduce((a, j) => a + monsOn(j).length, 0)); n *= c; out.why.push(`${c} Pokémon around`); }
      out.coins += n;
    }
    if (o.id === 'miltank') B(here.filter(q => q.id === 'wheat').length, 'Leeks to graze');
    if (o.id === 'mareep') B(here.some(q => q.id === 'wheat') ? 1 : 0, 'Leeks to graze');
    if (o.id === 'chansey') B(here.filter(q => q.id === 'corn').length, 'Apples to peck');
    if (o.id === 'tauros') B(2 * here.filter(q => q.id === 'miltank').length, 'Miltank friends');
    if (o.id === 'combee') {
      const n = here.filter(q => ['oran', 'razz'].includes(q.id)).length + 2 * here.filter(q => q.id === 'flowers').length;
      out.items.honey = n * (st + 1); if (n) out.why.push(`${n} from flowers & berries`);
    }
    if (d.copy) { for (const q of here) { const m = mainRes(q); if (m && m !== 'coins' && (kindOf(q) !== 'crop' || ripe(q))) add(m, 1); } }
    const m = mainRes(o), terr = t;
    tileAura();
    for (const q of here) {
      if (q.id === 'barn' && ['milk', 'wool', 'egg'].includes(m)) B(1, 'Barn');
      if (q.id === 'dock' && terr === 'water') B(1, 'Fishing Boat');
      if (q.id === 'mine' && terr === 'rock') B(1, 'Mine');
      if (q.id === 'marill' && terr === 'water' && !q.hungry) B(1, stageName(q));
    }
    if (terr === 'rock' && has('boulder')) B(1, 'Boulder Badge');
    if (terr === 'water' && has('cascade')) B(1, 'Cascade Badge');
    if (['honey', 'egg'].includes(m) && has('hive')) B(2, 'Hive Badge');
    if (['milk', 'wool'].includes(m) && has('plain')) B(1, 'Plain Badge');
  }
  if (bonus) { const m = mainRes(o); if (m === 'coins') out.coins += bonus; else if (m) add(m, bonus); }
  for (const k in out.items) if (out.items[k] <= 0) delete out.items[k];
  if (S.mods.festival) { for (const k in out.items) out.items[k] *= 2; out.coins *= 2; out.why.push('Festival ×2'); }
  return out;
}
function prodTile(i) {
  const r = {items: {}, coins: 0};
  for (let s = 0; s < SLOTS; s++) { const p = prodOf(i, s); r.coins += p.coins; for (const k in p.items) r.items[k] = (r.items[k] || 0) + p.items[k]; }
  return r;
}
function estimateIncome() {
  let coins = 0; const items = {};
  for (const i of owned()) { const p = prodTile(i); coins += p.coins; for (const k in p.items) items[k] = (items[k] || 0) + p.items[k]; }
  let food = allMons().reduce((a, [i, o]) => a + (occs(i).some(q => q.id === 'center') ? 0 : foodOf(o)), 0);
  for (const k of FOOD) { const eat = Math.min(food, (items[k] || 0) + S.stock[k]); food -= eat; items[k] = Math.max(0, (items[k] || 0) - Math.max(0, eat - S.stock[k])); }
  for (const k in items) if (!S.hold[k]) coins += items[k] * sellPrice(k);
  return coins;
}
const allMons = () => { const r = []; for (const i of owned()) for (const o of T(i).slots) if (o && kindOf(o) === 'mon') r.push([i, o]); return r.sort((a, b) => a[1].uid - b[1].uid); };

/* ---------- turn flow ---------- */
function startTurn(first) {
  S.energy = energyMax();
  draw(drawN());
  if (!first) log(`— Turn ${S.turn} —`);
  render();
}
function draw(n) {
  for (let k = 0; k < n; k++) {
    if (!S.deck.length) { if (!S.discard.length) break; S.deck = shuffle(S.discard); S.discard = []; log('Shuffled the discard pile into your deck.'); }
    S.hand.push(S.deck.pop());
  }
}

function endTurn() {
  if (busy || S.over) return;
  busy = true; S.sel = null; render();
  const res = owned().map(i => [i, prodTile(i)]);
  res.forEach(([i, p], n) => {
    const parts = Object.entries(p.items).map(([k, v]) => `+${v}${svgIco(k, 13)}`);
    if (p.coins) parts.push(`+${p.coins}${svgIco('coin', 13)}`);
    if (parts.length) setTimeout(() => floatAt(i, parts.join(' ')), 90 * n);
  });
  setTimeout(() => resolveTurn(res), 1000);
}

function resolveTurn(res) {
  let coins = 0; const made = {};
  res.forEach(([i, p]) => { coins += p.coins; for (const k in p.items) { S.stock[k] += p.items[k]; made[k] = (made[k] || 0) + p.items[k]; } });
  const madeTxt = Object.entries(made).map(([k, n]) => `${n} ${RES[k].n}`).join(', ');
  if (madeTxt) log(`Your ranch made ${madeTxt}.`);

  // crops grow
  for (const i of owned()) for (const o of T(i).slots) if (o && kindOf(o) === 'crop') {
    const was = ripe(o); o.age++; if (!was && ripe(o) && growNeed(o) > 0) log(`${CARDS[o.id].name} is ripe!`, 'gd');
  }

  // feed: berries, then corn, then wheat
  for (const [i, o] of allMons()) {
    const free = occs(i).some(q => q.id === 'center');
    let need = foodOf(o);
    const total = FOOD.reduce((a, k) => a + S.stock[k], 0);
    if (free || total >= need) {
      if (!free) for (const k of FOOD) { const e = Math.min(need, S.stock[k]); S.stock[k] -= e; need -= e; }
      o.hungry = false;
      let xp = 1 + countOn(i, 'gym'); if (has('zephyr')) xp *= 2;
      gainXP(o, xp);
      const heal = (free ? 1 : 0) + occs(i).filter(q => (q.id === 'chansey' && q !== o) || q.id === 'flowers').length;
      o.hearts = Math.min(3, o.hearts + heal);
    } else {
      o.hungry = true; o.hearts -= 1;
      if (o.hearts <= 0) {
        if (has('soul')) { o.hearts = 1; log(`${stageName(o)} is starving but stays (Soul Badge).`, 'bad'); }
        else { log(`${stageName(o)} was too hungry and ran away!`, 'bad'); const t = T(i); t.slots[t.slots.indexOf(o)] = null; S.ranAway++; }
      } else log(`${stageName(o)} went hungry (${o.hearts}♥ left). Grow more food!`, 'bad');
    }
  }

  // sell
  let sold = 0, kinds = 0;
  for (const k of RES_KEYS) {
    if (S.hold[k] || S.stock[k] <= 0) continue;
    sold += S.stock[k] * sellPrice(k); kinds++; S.stock[k] = 0;
  }
  if (kinds) sold += countB('market') * 3 * kinds;
  if (has('glacier')) { const it = Math.min(15, Math.floor(S.coins / 10)); if (it) { coins += it; log(`Glacier interest +${it}.`); } }
  S.coins += coins + sold; S.earned += coins + sold;
  if (coins + sold) log(`Earned ${coins + sold} coins.`, 'gd');

  for (const k of RES_KEYS) { S.prevPrice[k] = S.price[k]; S.price[k] = Math.min(1.8, Math.max(0.5, 0.65 * S.price[k] + 0.35 + rnd(-0.28, 0.28))); }
  S.mods = {sale: false, festival: false};
  S.discard.push(...S.hand); S.hand = [];

  const ended = S.turn; S.turn++;
  const queue = [];
  if (ended % 5 === 0) {
    const due = rentDue();
    if (S.coins >= due) {
      S.coins -= due; S.payIndex++;
      log(`Paid the loan: ${due} coins.`, 'gd');
      if (!S.endless && S.payIndex >= RENT.length) queue.push(showWin);
      queue.push(n => showBadge(due, n));
    } else { busy = false; render(); return gameOver(due); }
  }
  if (ended % 2 === 0) queue.push(showDraft);
  busy = false;
  runQueue(queue, () => startTurn());
}
function rentDue() { return S.payIndex < RENT.length ? RENT[S.payIndex] : Math.round(RENT[RENT.length - 1] * Math.pow(1.35, S.payIndex - RENT.length + 1)); }
function gainXP(o, xp) {
  const d = CARDS[o.id];
  o.xp += xp;
  while (d.evo[o.stage] !== undefined && o.xp >= d.evo[o.stage]) {
    const before = stageName(o); o.stage++; S.evolved++;
    log(`What? ${before} evolved into ${stageName(o)}!`, 'gd');
    const w = walkers.get(o.uid); if (w) w.evolve = 1;
  }
}
function runQueue(q, done) { if (!q.length) { closeModal(); return done(); } const f = q.shift(); f(() => runQueue(q, done)); }

/* ---------- playing cards ---------- */
const canAfford = c => CARDS[c.id].cost <= S.energy;
function validTarget(cardId, i) {
  const d = CARDS[cardId], t = T(i);
  if (['crop', 'mon', 'bld'].includes(d.kind)) return t.owned && freeSlot(i) >= 0 && d.terrain.includes(t.t);
  if (d.kind === 'ter') return t.owned && !occs(i).length && t.t !== d.to;
  if (d.target === 'mon') return t.owned && monsOn(i).length > 0;
  if (d.target === 'tile') return t.owned && occs(i).some(o => kindOf(o) === 'crop');
  if (d.target === 'land') return buyable(i);
  return false;
}
function selectCard(h) {
  if (busy) return;
  const c = S.hand[h], d = CARDS[c.id];
  if (!canAfford(c)) { tipFlash('Not enough PP (energy)'); return; }
  if (d.kind === 'act' && !d.target) { playUntargeted(h); return; }
  S.sel = S.sel === h ? null : h;
  render();
}
function spend(h) { const c = S.hand.splice(h, 1)[0]; S.energy -= CARDS[c.id].cost; S.sel = null; return c; }
function playUntargeted(h) {
  const c = spend(h);
  if (c.id === 'basket') { S.stock.berry += 4; log('Gathered 4 Berries.'); }
  if (c.id === 'notes') { draw(2); log('Drew 2 cards.'); }
  if (c.id === 'sale') { S.mods.sale = true; log('Sale Day! Goods sell for +50% this turn.', 'gd'); }
  if (c.id === 'festival') { S.mods.festival = true; log('Harvest Festival! Everything makes double this turn.', 'gd'); }
  S.discard.push(c); render();
}
function clickTile(i) {
  if (busy || S.over) return;
  if (S.sel !== null) {
    const c = S.hand[S.sel], d = CARDS[c.id];
    if (!validTarget(c.id, i)) { tipFlash(whyNot(c.id, i)); return; }
    spend(S.sel);
    const t = T(i);
    if (['crop', 'mon', 'bld'].includes(d.kind)) {
      const s = freeSlot(i);
      if (d.kind === 'mon') { t.slots[s] = {id: c.id, uid: uidc++, stage: 0, xp: 0, hearts: 3, hungry: false}; log(`${d.name} moved onto your island!`); }
      else if (d.kind === 'crop') { t.slots[s] = {id: c.id, uid: uidc++, age: 0}; log(`Planted ${d.name}.`); }
      else { t.slots[s] = {id: c.id, uid: uidc++}; log(`Built a ${d.name}.`); }
    } else if (d.kind === 'ter') { t.t = d.to; S.discard.push(c); log(`${d.name}: the tile is now ${d.to}.`); }
    else if (c.id === 'candy') { monsOn(i).forEach(o => gainXP(o, 3)); log('Rare Candy for everyone on the tile!'); S.discard.push(c); }
    else if (c.id === 'potion') { monsOn(i).forEach(o => { o.hearts = 3; o.hungry = false; gainXP(o, 1); }); log('Healed the Pokémon on the tile.'); S.discard.push(c); }
    else if (c.id === 'fert') { occs(i).forEach(o => { if (kindOf(o) === 'crop') o.age += 2; }); log('Fertilizer! The crops shot up.'); S.discard.push(c); }
    else if (c.id === 'deed') { S.discard.push(c); return chooseTerrain(i, false); }
    render(); return;
  }
  if (buyable(i)) {
    const cost = landCost();
    if (S.coins < cost) { tipFlash(`New land costs ${cost} coins`); return; }
    return chooseTerrain(i, true);
  }
  if (T(i).owned) {
    if (isPhone()) { S.lock = i; render(); openSheet('side'); return; }   // tap an island to see what is on it
    S.lock = S.lock === i ? null : i; render();
  }
}
function chooseTerrain(i, paid) {
  const opts = shuffle(['grass', 'grass', 'water', 'rock', 'water', 'rock']).filter((v, k, a) => a.indexOf(v) === k);
  const desc = {grass: 'Crops, most Pokémon and buildings.', water: 'Water Pokémon and Fishing Boats.', rock: 'Rock Pokémon, Mines, some buildings.'};
  const tex = {grass: 'grass.png', water: 'water.png', rock: 'rock2.png'};
  openModal(`<h2>New island</h2><p>${paid ? `This land costs <b>${landCost()}</b> coins. ` : ''}What kind of land is it?</p>
    <div class="choices">${opts.map(o => `<div class="terrainpick" data-t="${o}"><div class="sw" style="background-image:url(${ART}ground/${tex[o]})"></div><b>${o[0].toUpperCase() + o.slice(1)}</b><br><span style="font-size:12px">${desc[o]}</span></div>`).join('')}</div>
    <div class="row-btns"><button class="btn grey" id="cancel">${paid ? 'Cancel' : ''}</button></div>`);
  if (!paid) $('cancel').remove(); else $('cancel').onclick = closeModal;
  document.querySelectorAll('.terrainpick').forEach(el => el.onclick = () => {
    if (paid) { S.coins -= landCost(); S.landBought++; }
    const t = T(i); t.owned = true; t.t = el.dataset.t;
    log(`New ${t.t} island claimed!`, 'gd'); closeModal(); render();
  });
}
function whyNot(id, i) {
  const d = CARDS[id], t = T(i);
  if (d.target === 'mon') return 'Pick a tile with a Pokémon';
  if (d.target === 'tile') return 'Pick a tile with crops';
  if (d.target === 'land') return 'Pick a spot next to your island';
  if (!t.owned) return 'That is not your land yet';
  if (d.kind === 'ter') return 'The tile must be empty';
  if (freeSlot(i) < 0) return 'All 12 slots are full';
  if (d.terrain && !d.terrain.includes(t.t)) return `${d.name} needs ${d.terrain.join(' or ')}`;
  return "Can't play there";
}
function release(i, s) {
  const o = T(i).slots[s]; if (!o || busy) return;
  T(i).slots[s] = null;
  log(`${kindOf(o) === 'mon' ? stageName(o) + ' was released into the wild' : CARDS[o.id].name + ' was cleared'}.`);
  render();
}

/* ---------- rendering ---------- */
function cardKindClass(d) {
  if (d.kind === 'bld') return 'c-bld';
  if (d.kind === 'act') return 'c-act';
  if (d.kind === 'ter') return 'c-ter';
  if (d.kind === 'crop') return 'c-crop';
  return d.terrain.length > 1 ? 'c-any' : 'c-' + d.terrain[0];
}
function cropImg(id, stage) { // stage 1..3
  const d = CARDS[id];
  if (id === 'flowers') return simg('flowerbed');
  return cimg(`${d.img}_${stage}`);
}
function cardHTML(id, extra = '') {
  const d = CARDS[id];
  let art, type;
  if (d.kind === 'mon') { art = `<img class="portrait" src="${portrait(d.line[0][0])}" alt="">`; type = `Pokémon · ${d.terrain.join('/')}`; }
  else if (d.kind === 'bld') { art = `<img src="${bimg(d.img)}" alt="">`; type = `Building · ${d.terrain.join('/')}`; }
  else if (d.kind === 'crop') { art = id === 'flowers' ? `<img class="crop" src="${cropImg(id, 3)}" alt="" style="height:auto;width:90px">` : `<img class="crop" src="${cropImg(id, 3)}" alt=""><img class="cropitem" src="${ART}items/${ITEM[Object.keys(d.make)[0]]}.png" alt="">`; type = `Crop · ${d.terrain.join('/')}`; }
  else { art = `<span class="bigico ico">${SVG[d.ico]}</span>`; type = d.kind === 'ter' ? 'Terrain' : d.target ? 'Action · tile' : 'Action'; }
  const rar = {C: '●', U: '◆', R: '★'}[d.rar];
  return `<div class="card ${cardKindClass(d)} ${extra}" data-id="${id}">
    <div class="cost">${d.cost}</div><div class="band">${d.name}</div>
    <div class="art">${art}</div><div class="type">${type}</div><div class="txt">${d.text}</div><div class="rar">${rar}</div></div>`;
}

function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// no scenery sprites on the islands (owner: "remove all sprites from island")
/* Island layout (fractions of the island size): the 4 x 3 slot grid. No scenery sprites on the islands.
   Each Pokémon walks inside its own slot, so no sprite ever overlaps another. */
const GRID = {top: 0.05, side: 0.05, gap: 0.025, cols: 4, rows: 3};   // must match .tile .slots in style.css
function slotRect(s) {
  const {top, side, gap, cols, rows} = GRID;
  const cw = (1 - 2 * side - (cols - 1) * gap) / cols, ch = (1 - 2 * top - (rows - 1) * gap) / rows;
  const col = s % cols, row = Math.floor(s / cols), a = side + col * (cw + gap), y0 = top + row * (ch + gap);
  return {a, b: a + cw, y0, y1: y0 + ch};
}
let view = {c0: 0, r0: 0, T: 170};
// camera: zoom and pan set by fingers (drag / pinch) or the mouse (drag / wheel); 1, 0, 0 = auto-framed
const cam = {zoom: 1, px: 0, py: 0};
function layout() {
  // auto-frame the islands you own; the "+ LAND" spots peek in from the edges
  const cells = owned();
  let r0 = G, r1 = 0, c0 = G, c1 = 0;
  for (const i of cells) { const [r, c] = rc(i); r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
  const wrap = $('boardWrap'), W = wrap.clientWidth, H = wrap.clientHeight, cols = c1 - c0 + 1, rows = r1 - r0 + 1;
  const gap = 1.08;
  const m = 1.6;                                   // islands start small; zoom in with pinch or +
  const fitT = Math.min(W / (cols * gap + m), H / (rows * gap + m), 190);
  const t = Math.round(Math.max(40, Math.min(700, fitT * cam.zoom)));   // pinch / + - to zoom
  view = {c0, r0, T: t, gap: Math.round(t * gap), W, H,
    ox: Math.round((W - cols * t * gap) / 2 + cam.px), oy: Math.round((H - rows * t * gap) / 2 + cam.py)};
  // never lose the ranch: at least a bit of it stays on screen
  const ww = cols * view.gap, hh = rows * view.gap, keep = Math.min(120, t);
  const cx = Math.min(Math.max(view.ox, keep - ww), W - keep), cy = Math.min(Math.max(view.oy, keep - hh), H - keep);
  cam.px += cx - view.ox; cam.py += cy - view.oy; view.ox = cx; view.oy = cy;
  document.documentElement.style.setProperty('--T', t + 'px');
}
const tileXY = i => { const [r, c] = rc(i); return [view.ox + (c - view.c0) * view.gap, view.oy + (r - view.r0) * view.gap]; };

function render() {
  $('coins').textContent = fmt(S.coins);
  $('turn').textContent = S.turn;
  $('energy').textContent = S.energy; $('energyMax').textContent = energyMax();
  $('est').textContent = fmt(estimateIncome());
  const due = rentDue(), left = 5 - ((S.turn - 1) % 5);
  $('rentAmt').textContent = fmt(due);
  $('rentIn').textContent = left === 1 ? 'due THIS turn' : `in ${left} turns`;
  document.querySelector('.stat.rent').classList.toggle('soon', left === 1 && S.coins < due);
  $('badges').innerHTML = S.badges.map(b => `<div class="badge" style="background:${BADGES[b].c}" data-tip="${BADGES[b].n}: ${BADGES[b].t}"><img src="${ART}items/${BADGES[b].e}.png" alt=""></div>`).join('');

  $('marketRows').innerHTML = RES_KEYS.map(k => {
    const p = sellPrice(k), tr = S.price[k] - S.prevPrice[k];
    const arrow = Math.abs(tr) < 0.03 ? '' : tr > 0 ? '<span class="up">▲</span>' : '<span class="down">▼</span>';
    return `<div class="mrow"><span class="ico" style="width:22px;height:22px">${SVG[k]}</span>
      <div><div class="nm">${RES[k].n}</div><div class="st">have ${S.stock[k]}</div></div>
      <div class="pr">${arrow}${p}</div>
      <label><input type="checkbox" data-hold="${k}" ${S.hold[k] ? 'checked' : ''}>hold</label></div>`;
  }).join('');
  const mods = [];
  if (S.mods.sale) mods.push('Sale Day: +50% prices');
  if (S.mods.festival) mods.push('Harvest Festival: double production');
  const pm = priceMult(); if (pm !== 1) mods.push(`Price bonus ×${pm.toFixed(2)}`);
  $('modsBox').innerHTML = mods.map(m => `<div class="mod">${m}</div>`).join('');

  layout();
  const sel = S.sel !== null ? S.hand[S.sel] : null;
  let html = '';
  S.board.forEach((t, i) => {
    const isBuy = buyable(i);
    if (!t.owned && !isBuy) return;
    const [x, y] = tileXY(i);
    let cls = 'tile', inner = '';
    if (t.owned) {
      cls += ' owned ' + t.t + (S.lock === i ? ' locked' : '');
      inner = `<div class="ground"></div><div class="slots">` + t.slots.map((o, s) => slotHTML(o, i, s)).join('') + '</div>';
    } else {
      cls += ' buy';
      inner = sel && CARDS[sel.id].target === 'land' ? '<div class="cost">FREE</div>' : `<div class="cost">+ LAND<span>${svgIco('coin', 14)} ${landCost()}</span></div>`;
    }
    if (sel) cls += validTarget(sel.id, i) ? ' target' : (t.owned ? ' dim' : '');
    html += `<div class="${cls}" data-i="${i}" style="left:${x}px;top:${y}px">${inner}</div>`;
  });
  $('tiles').innerHTML = html;
  syncWalkers();

  $('hand').innerHTML = S.hand.map((c, h) => cardHTML(c.id, (S.sel === h ? 'sel ' : '') + (canAfford(c) ? '' : 'cant')).replace('class="card', `data-h="${h}" class="card`)).join('');
  $('deckN').textContent = S.deck.length; $('discN').textContent = S.discard.length;
  $('log').innerHTML = S.log.map(l => `<div class="${l.cls}">${l.msg}</div>`).join('');
  showInfo(S.lock !== null ? S.lock : hoverTile);
}
function slotHTML(o, i, s) {
  if (!o) return `<div class="slot empty" data-s="${s}"></div>`;
  const d = CARDS[o.id];
  if (d.kind === 'crop') {
    const need = growNeed(o), st = o.id === 'flowers' ? 3 : need === 0 ? 3 : Math.min(3, 1 + Math.floor(o.age * 3 / (need + 1)));
    const wide = o.id === 'flowers' ? ' wide' : '';
    return `<div class="slot crop" data-s="${s}">${o.id === 'flowers' ? '' : `<img class="soil" src="${simg('soil')}" alt="">`}<img class="cropimg${wide}" src="${cropImg(o.id, ripe(o) ? 3 : st)}" alt="">${ripe(o) ? '' : `<span class="grow">${need - o.age}t</span>`}</div>`;
  }
  if (d.kind === 'bld') return `<div class="slot" data-s="${s}"><img class="bld" src="${bimg(d.img)}" alt=""></div>`;
  // a Pokémon's slot stays clear: only the walking Pokémon itself is shown on the island
  return `<div class="slot mon" data-s="${s}"></div>`;
}

let hoverTile = null;
function showInfo(i) {
  const box = $('info');
  if (i === null || i === undefined || !T(i).owned) {
    $('infoTitle').textContent = 'Ranch';
    const mons = allMons().length;
    const food = allMons().reduce((a, [j, o]) => a + (occs(j).some(q => q.id === 'center') ? 0 : foodOf(o)), 0);
    box.innerHTML = `<div class="row"><span>Pokémon</span><b>${mons}</b></div>
      <div class="row"><span>Food eaten / turn</span><b>${food}</b></div>
      <div class="row"><span>Islands</span><b>${owned().length}</b></div>
      <div class="row"><span>Next land costs</span><b>${landCost()}</b></div>
      <div class="row"><span>Total earned</span><b>${fmt(S.earned)}</b></div>
      <div class="why">Click a card, then a glowing island. Each island has 12 slots. Click "+ LAND" to grow. Click an island to see and release what's on it.</div>`;
    return;
  }
  const t = T(i), p = prodTile(i);
  $('infoTitle').textContent = `${t.t[0].toUpperCase() + t.t.slice(1)} island`;
  const makes = [...Object.entries(p.items).map(([k, n]) => `${n}${svgIco(k, 14)}`), p.coins ? `${p.coins}${svgIco('coin', 14)}` : ''].filter(Boolean).join(' ') || 'nothing yet';
  let h = `<div class="row"><span>Makes per turn</span><b>${makes}</b></div>`;
  const empty = t.slots.filter(o => !o).length;
  h += `<div class="row"><span>Slots used</span><b>${SLOTS - empty} / ${SLOTS}</b></div>`;
  t.slots.forEach((o, s) => {
    if (!o) return;
    const d = CARDS[o.id], ps = prodOf(i, s);
    const mk = [...Object.entries(ps.items).map(([k, n]) => `${n}${svgIco(k, 12)}`), ps.coins ? `${ps.coins}${svgIco('coin', 12)}` : ''].filter(Boolean).join(' ');
    let img, name, extra = '';
    if (d.kind === 'mon') {
      img = portrait(stageDex(o)); name = stageName(o);
      const nxt = d.evo[o.stage];
      extra = `${'❤'.repeat(Math.max(0, o.hearts))} · ${nxt !== undefined ? `XP ${o.xp}/${nxt} → ${d.line[o.stage + 1][1]}` : 'fully evolved'}`;
    } else if (d.kind === 'crop') { img = cropImg(o.id, 3); name = d.name; extra = ripe(o) ? 'ripe' : `ripe in ${growNeed(o) - o.age} turn(s)`; }
    else { img = bimg(d.img); name = d.name; }
    h += `<div class="slotrow"><img src="${img}" alt=""><div class="d"><b>${name}</b> ${mk ? '→ ' + mk : ''}<br><span style="color:#7a6c50">${extra}</span>${ps.why.length ? `<br><span style="color:#7a6c50;font-size:11px">${ps.why.join(' · ')}</span>` : ''}</div>${S.lock === i ? `<button data-rel="${i},${s}" title="Remove">✕</button>` : ''}</div>`;
  });
  if (S.lock !== i) h += `<div class="why">Click the island to pin this panel and remove things.</div>`;
  box.innerHTML = h;
}

function floatAt(i, html) {
  const [x, y] = tileXY(i);
  const f = document.createElement('div'); f.className = 'float'; f.innerHTML = html;
  f.style.left = (x + view.T / 2) + 'px'; f.style.top = (y + view.T * 0.35) + 'px';
  $('fx').appendChild(f); setTimeout(() => f.remove(), 1600);
}
let tipT;
function tipFlash(msg) {
  const t = $('tip'); t.textContent = msg; t.classList.remove('hidden');
  t.style.left = Math.min(lastMouse.x + 14, window.innerWidth - 250) + 'px'; t.style.top = Math.max(4, lastMouse.y - 40) + 'px';
  clearTimeout(tipT); tipT = setTimeout(() => t.classList.add('hidden'), 1400);
}

/* ---------- walking Pokémon ---------- */
// Each Pokémon walks inside its own slot on its island (see GRID).
const walkers = new Map();
const DIRS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]; // PMD rows: down, down-right, right, up-right, up, up-left, left, down-left
function walkerEl(dex) {
  const el = document.createElement('div'); el.className = 'walker';
  $('fx').appendChild(el);
  return {el, dex};
}
function setSheet(w, dex) {
  w.dex = dex; const wd = WALK[dex];
  if (!wd) { w.el.classList.add('icon'); w.el.style.backgroundImage = `url(${icon(dex)})`; w.data = null; return; }
  w.el.classList.remove('icon'); w.data = wd;
}
function syncWalkers() {
  const live = new Set();
  for (const i of owned()) T(i).slots.forEach((o, si) => {
    if (!o || kindOf(o) !== 'mon') return;
    live.add(o.uid);
    let w = walkers.get(o.uid);
    if (!w) { w = walkerEl(stageDex(o)); setSheet(w, stageDex(o)); w.fx = -1; w.wait = Math.random() * 2; w.t = 0; w.dir = 0; walkers.set(o.uid, w); }
    if (w.dex !== stageDex(o)) setSheet(w, stageDex(o));
    w.lane = slotRect(si);                       // it walks inside its own slot
    if (w.fx < w.lane.a || w.fx > w.lane.b) { w.fx = (w.lane.a + w.lane.b) / 2; w.tx = w.fx; }
    w.tile = i; w.o = o; w.water = T(i).t === 'water';
  });
  for (const [k, w] of walkers) if (!live.has(k)) { w.el.remove(); walkers.delete(k); }
}
let lastT = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (S) {
    const Tp = view.T;
    for (const [, w] of walkers) {
      if (!T(w.tile) || !T(w.tile).owned || !w.lane) continue;
      const ln = w.lane, moving = w.wait <= 0 && !(w.o && w.o.hungry);
      if (moving) {
        const dx = w.tx - w.fx, sp = 0.1 * dt;
        if (Math.abs(dx) < sp) { w.fx = w.tx; w.wait = rnd(0.8, 3.2); w.tx = rnd(ln.a, ln.b); }
        else { w.fx += Math.sign(dx) * sp; w.dir = dx > 0 ? 2 : 6; }
      } else { w.wait -= dt; if (w.wait < 0.6) w.dir = 0; }
      w.t += dt;
      const [x0, y0] = tileXY(w.tile);
      const anim = w.data ? (moving ? w.data.walk : (w.data.idle || w.data.walk)) : {w: 40, h: 30, n: 1, rows: 1, dur: [1]};
      // the sprite is sized to fit inside its lane, then kept inside it
      const laneW = (ln.b - ln.a) * Tp, laneH = (ln.y1 - ln.y0) * Tp;
      const sc = Math.min(2.4, laneH * 1.0 / anim.h, laneW * 1.0 / anim.w);
      const sw = anim.w * sc, sh = anim.h * sc;
      const cx = Math.min(Math.max(w.fx * Tp, ln.a * Tp + sw / 2), ln.b * Tp - sw / 2);
      const left = x0 + cx - sw / 2, topPx = y0 + ln.y1 * Tp - sh, py = topPx + sh;
      w.el.style.width = sw + 'px'; w.el.style.height = sh + 'px';
      w.el.style.left = left + 'px'; w.el.style.top = topPx + 'px';
      if (w.data) {
        const total = anim.dur.reduce((p, q) => p + q, 0), f60 = Math.floor(w.t * 60) % total;
        let fr = 0, acc = 0; for (; fr < anim.n; fr++) { acc += anim.dur[fr]; if (f60 < acc) break; }
        const row = Math.min(w.dir, anim.rows - 1);
        const sheet = `${ART}walk/${w.dex}_${anim === w.data.walk ? 'walk' : 'idle'}.png`;
        if (w.sheet !== sheet) { w.el.style.backgroundImage = `url(${sheet})`; w.sheet = sheet; }
        w.el.style.backgroundSize = `${anim.w * anim.n * sc}px ${anim.h * anim.rows * sc}px`;
        w.el.style.backgroundPosition = `${-fr * anim.w * sc}px ${-row * anim.h * sc}px`;
      }
      w.el.style.zIndex = 10 + Math.round(py);
      w.el.style.opacity = w.water ? 0.92 : 1;
      if (w.evolve) { w.evolve -= dt * 0.8; w.el.style.filter = w.evolve > 0 ? `brightness(${1 + 2 * w.evolve})` : ''; if (w.evolve <= 0) w.evolve = 0; }
      else w.el.style.filter = w.o && w.o.hungry ? 'grayscale(.8)' : '';
    }
  }
  requestAnimationFrame(tick);
}

/* ---------- modals ---------- */
function openModal(html) { $('modalBox').innerHTML = html; $('modal').classList.remove('hidden'); }
function closeModal() { $('modal').classList.add('hidden'); }
function rollCards(n) {
  const ids = Object.keys(CARDS), out = [];
  while (out.length < n) {
    const tot = ids.reduce((a, id) => a + RAR_W[CARDS[id].rar], 0);
    let r = Math.random() * tot, chosen = ids[0];
    for (const id of ids) { r -= RAR_W[CARDS[id].rar]; if (r <= 0) { chosen = id; break; } }
    if (!out.includes(chosen)) out.push(chosen);
  }
  return out;
}
function showDraft(next) {
  const n = 3 + countB('store') + (has('fog') ? 1 : 0);
  const opts = rollCards(n);
  openModal(`<h2>A trainer offers you a card</h2><p>Pick one to add to your deck.</p>
    <div class="choices">${opts.map(id => cardHTML(id)).join('')}</div>
    <div class="row-btns"><button class="btn grey" id="reroll" ${S.coins < S.rerollCost ? 'disabled' : ''}>Reroll (${S.rerollCost} coins)</button><button class="btn grey" id="skip">Skip (+5 coins)</button></div>`);
  document.querySelectorAll('#modalBox .card').forEach(el => el.onclick = () => { S.discard.push(mk(el.dataset.id)); log(`Added ${CARDS[el.dataset.id].name} to your deck.`, 'gd'); next(); });
  $('reroll').onclick = () => { S.coins -= S.rerollCost; S.rerollCost += 2; render(); showDraft(next); };
  $('skip').onclick = () => { S.coins += 5; render(); next(); };
}
function showBadge(due, next) {
  const pool = shuffle(Object.keys(BADGES).filter(b => !S.badges.includes(b))).slice(0, 3);
  if (!pool.length) return next();
  openModal(`<h2>Loan paid!</h2><p>You paid <b>${due}</b> coins. Next payment: <b>${rentDue()}</b> in 5 turns.<br>The Ranch League awards you a badge. Choose one:</p>
    <div class="choices">${pool.map(b => `<div class="bchoice" data-b="${b}"><div class="badge" style="background:${BADGES[b].c}"><img src="${ART}items/${BADGES[b].e}.png" alt=""></div><b>${BADGES[b].n}</b><span>${BADGES[b].t}</span></div>`).join('')}</div>`);
  document.querySelectorAll('.bchoice').forEach(el => el.onclick = () => { S.badges.push(el.dataset.b); log(`Earned the ${BADGES[el.dataset.b].n}!`, 'gd'); render(); next(); });
}
function saveBest() {
  try {
    const b = JSON.parse(localStorage.getItem('pokeRanchBest') || '{}');
    const nb = {turn: Math.max(b.turn || 0, S.turn), earned: Math.max(b.earned || 0, S.earned)};
    localStorage.setItem('pokeRanchBest', JSON.stringify(nb)); return nb;
  } catch (e) { return {turn: S.turn, earned: S.earned}; }
}
function gameOver(due) {
  S.over = true; const best = saveBest();
  openModal(`<h2>The bank took the ranch…</h2><p>The loan payment was <b>${due}</b> coins but you only had <b>${S.coins}</b>.</p>
    <p>You lasted <b>${S.turn - 1}</b> turns on <b>${owned().length}</b> islands, paid <b>${S.payIndex}</b> loan payments and earned <b>${fmt(S.earned)}</b> coins.<br>${S.evolved} evolutions · ${S.ranAway} Pokémon ran away.</p>
    <p style="color:#7a6c50">Best: ${best.turn - 1} turns · ${fmt(best.earned)} coins earned</p>
    <div class="row-btns"><button class="btn" id="again">New Ranch</button></div>`);
  $('again').onclick = () => { closeModal(); newRun(); };
}
function showWin(next) {
  saveBest();
  openModal(`<h2>The loan is paid off!</h2><p>The ranch is yours, forever. You earned <b>${fmt(S.earned)}</b> coins in ${S.turn - 1} turns.</p>
    <p>Keep going in <b>Endless mode</b>: the bank keeps asking for more each time.</p>
    <div class="row-btns"><button class="btn" id="endless">Keep farming</button><button class="btn grey" id="again">New Ranch</button></div>`);
  $('endless').onclick = () => { S.endless = true; next(); };
  $('again').onclick = () => { closeModal(); newRun(); };
}
function showHelp() {
  openModal(`<h2>How to play</h2><div class="help"><ul>
    <li>You start with <b>one island</b>. Every island has <b>12 slots</b> for crops, Pokémon and buildings.</li>
    <li>Each turn you draw 5 cards and have 3 ${svgIco('bolt')} energy. Click a card, then a glowing island to put it in a free slot.</li>
    <li><b>Crops</b> (Leeks, Apple Trees, Oran Trees, Mushrooms…) grow for a few turns, then harvest every turn.</li>
    <li><b>Pokémon</b> live on the island and make goods. Each eats 1 food (Oran Berries, then Apples, then Leeks, then Mushrooms) or loses a heart. At 0 hearts it runs away. Fed Pokémon gain XP and <b>evolve</b>.</li>
    <li>Things on the <b>same island</b> help each other: Miltank grazes Leeks, Combee loves flowers, Machop helps everyone, a Barn boosts animals…</li>
    <li>Goods sell at the end of each turn. Prices move, so tick <b>hold</b> to wait for a better price.</li>
    <li>Click <b>+ LAND</b> to buy a new island next to yours. You choose grass, water or rock.</li>
    <li>Every <b>5 turns</b> pay the loan. Can't pay = game over. Each payment earns a <b>badge</b>. Every 2 turns you pick a new card.</li></ul></div>
    <div class="row-btns"><button class="btn" id="ok">Let's farm!</button></div>`);
  $('ok').onclick = closeModal;
}

/* ---------- input ---------- */
const lastMouse = {x: 0, y: 0};
document.addEventListener('pointerdown', e => { lastMouse.x = e.clientX; lastMouse.y = e.clientY; });
document.addEventListener('mousemove', e => {
  lastMouse.x = e.clientX; lastMouse.y = e.clientY;
  const b = e.target.closest('[data-tip]'), tip = $('tip');
  if (b) { tip.textContent = b.dataset.tip; tip.classList.remove('hidden'); tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; }
});
document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('[data-tip]')) $('tip').classList.add('hidden'); });
$('tiles').addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) clickTile(+t.dataset.i); });
$('boardWrap').addEventListener('click', e => { if (!e.target.closest('.tile') && S.lock !== null) { S.lock = null; render(); } });
$('tiles').addEventListener('mouseover', e => { const t = e.target.closest('.tile'); if (t && hoverTile !== +t.dataset.i) { hoverTile = +t.dataset.i; if (S.lock === null) showInfo(hoverTile); } });
$('tiles').addEventListener('mouseleave', () => { hoverTile = null; if (S.lock === null) showInfo(null); });
$('info').addEventListener('click', e => { const b = e.target.closest('[data-rel]'); if (b) { const [i, s] = b.dataset.rel.split(',').map(Number); release(i, s); } });
$('hand').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) selectCard(+c.dataset.h); });
$('market').addEventListener('change', e => { const k = e.target.dataset.hold; if (k) { S.hold[k] = e.target.checked; render(); } });
$('endBtn').onclick = () => { closeSheets(); endTurn(); };
$('helpBtn').onclick = showHelp;
document.addEventListener('keydown', e => {
  const open = !$('modal').classList.contains('hidden');
  if (e.key === 'Escape') { S.sel = null; S.lock = null; render(); }
  if (e.key === ' ' && !open) { e.preventDefault(); endTurn(); }
  if (/^[1-9]$/.test(e.key) && !open && S.hand[+e.key - 1]) selectCard(+e.key - 1);
});
document.addEventListener('contextmenu', e => { if (S && S.sel !== null) { e.preventDefault(); S.sel = null; render(); } });
function fit() { if (S) render(); }


/* ---------- move the map with your finger: drag to pan, pinch (or mouse wheel) to zoom ---------- */
const gesture = {pts: new Map(), drag: false, start: null, s: 1, dx: 0, dy: 0};
function worldTransform() { $('world').style.transform = `translate(${gesture.dx}px,${gesture.dy}px) scale(${gesture.s})`; }
function commitGesture() {
  // turn the live CSS transform into a real camera change, then redraw crisp
  if (gesture.s === 1 && !gesture.dx && !gesture.dy) return;
  const ox = gesture.dx + gesture.s * view.ox, oy = gesture.dy + gesture.s * view.oy, z = cam.zoom * gesture.s;
  cam.zoom = Math.max(0.45, Math.min(3.5, z));
  gesture.s = 1; gesture.dx = 0; gesture.dy = 0; worldTransform();
  const px = cam.px, py = cam.py; cam.px = 0; cam.py = 0; layout();
  cam.px = ox - view.ox; cam.py = oy - view.oy;
  render();
}
function wrapPoint(e) { const r = $('boardWrap').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
const bw = $('boardWrap');
// one set of gesture steps, fed by touch events (phones) and mouse pointer events (computers)
function gDown(id, p) {
  gesture.pts.set(id, p);
  if (gesture.pts.size === 1) { gesture.start = {p, dx: gesture.dx, dy: gesture.dy}; gesture.drag = false; }
  if (gesture.pts.size === 2) {
    const [a, b] = [...gesture.pts.values()];
    gesture.pinch = {d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s: gesture.s, dx: gesture.dx, dy: gesture.dy};
    gesture.drag = true;
  }
}
function gMove(id, p) {
  if (!gesture.pts.has(id)) return;
  gesture.pts.set(id, p);
  if (gesture.pts.size >= 2 && gesture.pinch) {
    const [a, b] = [...gesture.pts.values()], P = gesture.pinch;
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = Math.max(0.45 / cam.zoom, Math.min(3.5 / cam.zoom, P.s * d / P.d));
    // keep the point between the fingers under the fingers
    gesture.dx = mid[0] - (P.mid[0] - P.dx) * s / P.s; gesture.dy = mid[1] - (P.mid[1] - P.dy) * s / P.s; gesture.s = s;
    worldTransform(); return;
  }
  const st = gesture.start; if (!st) return;
  const mx = p[0] - st.p[0], my = p[1] - st.p[1];
  if (!gesture.drag && Math.hypot(mx, my) > 8) gesture.drag = true;
  if (gesture.drag) { gesture.dx = st.dx + mx; gesture.dy = st.dy + my; worldTransform(); }
}
function gUp(id) {
  if (!gesture.pts.has(id)) return;
  gesture.pts.delete(id);
  if (gesture.pts.size === 1) { const [p] = gesture.pts.values(); gesture.start = {p, dx: gesture.dx, dy: gesture.dy}; gesture.pinch = null; return; }
  if (gesture.pts.size === 0) {
    gesture.pinch = null; gesture.start = null;
    if (gesture.drag) { gesture.justDragged = true; setTimeout(() => { gesture.justDragged = false; }, 350); }
    commitGesture();
  }
}
// phones: real touch events, so the browser never steals the pinch for page zoom (works on iPhone Safari and Android Chrome)
const touchPt = t => { const r = bw.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
bw.addEventListener('touchstart', e => {
  if (e.target.closest('#recenter, .zoombtn')) return;
  for (const t of e.changedTouches) gDown('t' + t.identifier, touchPt(t));
  if (e.touches.length > 1) e.preventDefault();
}, {passive: false});
bw.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) gMove('t' + t.identifier, touchPt(t));
  e.preventDefault();                       // no page scroll / page zoom while moving the map
}, {passive: false});
const touchEnd = e => { for (const t of e.changedTouches) gUp('t' + t.identifier); };
bw.addEventListener('touchend', touchEnd);
bw.addEventListener('touchcancel', touchEnd);
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault(), {passive: false}));  // iOS page zoom
// computers: the mouse
bw.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('#recenter, .zoombtn')) return;
  gDown('m', wrapPoint(e));
});
window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') gMove('m', wrapPoint(e)); });
window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') gUp('m'); });
// a drag is not a tap: swallow the click that follows it
bw.addEventListener('click', e => { if (gesture.justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
bw.addEventListener('wheel', e => {
  e.preventDefault();
  const [x, y] = wrapPoint(e), f = Math.exp(-e.deltaY * 0.0015);
  const z = Math.max(0.45, Math.min(3.5, cam.zoom * f)), k = z / cam.zoom;
  gesture.dx = x - (x - gesture.dx) * k; gesture.dy = y - (y - gesture.dy) * k; gesture.s *= k;
  commitGesture();
}, {passive: false});
$('recenter').onclick = e => { e.stopPropagation(); cam.zoom = 1; cam.px = 0; cam.py = 0; render(); };
// + / - buttons zoom around the middle of the map
function zoomBy(f) {
  const x = view.W / 2, y = view.H / 2, z = Math.max(0.45, Math.min(3.5, cam.zoom * f)), k = z / cam.zoom;
  gesture.dx = x - (x - gesture.dx) * k; gesture.dy = y - (y - gesture.dy) * k; gesture.s *= k;
  commitGesture();
}
$('zoomIn').onclick = e => { e.stopPropagation(); zoomBy(1.3); };
$('zoomOut').onclick = e => { e.stopPropagation(); zoomBy(1 / 1.3); };
/* ---------- phone: market and info open as slide-up sheets ---------- */
const isPhone = () => window.matchMedia('(max-width: 820px), (max-height: 520px)').matches;
function openSheet(id) {
  closeSheets();
  $(id).classList.add('open'); $('sheetShade').classList.remove('hidden');
}
function closeSheets() {
  $('market').classList.remove('open'); $('side').classList.remove('open'); $('sheetShade').classList.add('hidden');
}
$('mktBtn').onclick = () => $('market').classList.contains('open') ? closeSheets() : openSheet('market');
$('infoBtn').onclick = () => { if ($('side').classList.contains('open')) return closeSheets(); showInfo(S.lock); openSheet('side'); };
$('sheetShade').onclick = closeSheets;
$('badges').addEventListener('click', e => { const b = e.target.closest('[data-tip]'); if (b) tipFlash(b.dataset.tip); });
window.addEventListener('resize', fit);
document.querySelector('#top .ico.coin').innerHTML = SVG.coin;
document.querySelector('#top .ico.bolt').innerHTML = SVG.bolt;
newRun();
showHelp();
requestAnimationFrame(tick);
