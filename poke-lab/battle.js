/* Poké Lab: your party, stats and wild battles.
   Data: pokedata.js (made from Pokémon Essentials PBS files). Sprites: assets/battle/<dex>f.png / <dex>b.png (GBA FireRed).
   Wild Pokémon jump out of tall grass on routes. FIGHT / BAG (Poké Ball, Potion) / PKMN / RUN. EXP, level ups, new moves, evolution.
   Pokémon Centers heal, Marts refill your bag. */
(function () {
const $ = id => document.getElementById(id);
const rnd = n => Math.floor(Math.random() * n);

/* ---------- styles ---------- */
const css = document.createElement('style');
css.textContent = `
#party { position: fixed; inset: 0; z-index: 8; display: none; font-family: var(--font); color: #303030; user-select: none; }
#battle { position: fixed; inset: 0; z-index: 8; display: none; background: #000; align-items: center; justify-content: center; }
#battle canvas { width: min(100vw, 150vh); height: auto; image-rendering: pixelated; touch-action: none; }
#battle .plat { position: absolute; border-radius: 50%; background: #78b858; box-shadow: inset 0 -6px 0 #589840; }
#battle img.mon { position: absolute; image-rendering: pixelated; width: min(30vw, 30vh, 230px); transition: transform .25s, opacity .3s; }
#battle .box { position: absolute; background: #f8f8d8; border: 4px solid #506850; border-radius: 10px 2px 10px 2px; padding: 8px 12px; font-size: clamp(9px, 1.6vw, 13px); width: min(44vw, 300px); box-shadow: 4px 4px 0 #30483088; }
#battle .box b { font-weight: normal; } #battle .box span { float: right; }
#battle .bar { margin-top: 6px; height: 8px; background: #405040; border-radius: 4px; padding: 2px; position: relative; }
#battle .bar i { display: block; height: 100%; border-radius: 3px; background: #58d080; transition: width .4s; }
#battle .bar i.mid { background: #f8d040; } #battle .bar i.low { background: #f05848; }
#battle .xbar { margin-top: 5px; height: 4px; background: #405040; } #battle .xbar i { display: block; height: 100%; background: #48a8f8; transition: width .4s; }
#battle .hpt { text-align: right; margin-top: 4px; }
#battle .st { font-size: .8em; color: #fff; background: #c05050; padding: 1px 4px; border-radius: 3px; margin-left: 6px; }
#bMsg { position: absolute; left: 0; right: 0; bottom: 0; height: 28%; background: #283848; border-top: 6px solid #c8a048; color: #fff; padding: 18px 22px; box-sizing: border-box;
        font-size: clamp(11px, 2vw, 16px); line-height: 1.7; white-space: pre-line; }
#bMenu { position: absolute; right: 8px; bottom: 8px; width: min(62vw, 520px); display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
#bMenu button, #party button { font: inherit; font-size: clamp(10px, 1.7vw, 14px); background: #f8f8f8; border: 4px solid #686868; border-radius: 8px; padding: 10px 8px; text-align: left; color: #303030; cursor: pointer; }
#bMenu button:focus, #bMenu button:hover, #party button:focus, #party button:hover { border-color: #e05040; outline: none; background: #fff8e0; }
#bMenu button small { display: block; font-size: .75em; color: #707070; margin-top: 3px; }
#bMenu button:disabled { opacity: .45; }
#party { background: #405880f4; overflow: auto; padding: 14px; box-sizing: border-box; color: #fff; }
#party h2 { font-size: 14px; margin: 4px 0 12px; } #party .hint { font-size: 9px; opacity: .8; margin-bottom: 10px; }
#party .card { background: #f8f8f8; color: #303030; border-radius: 10px; padding: 10px; margin-bottom: 10px; display: grid; grid-template-columns: 72px 1fr; gap: 10px; font-size: 10px; line-height: 1.8; }
#party .card img { width: 72px; image-rendering: pixelated; }
#party .card.lead { box-shadow: 0 0 0 4px #f8d040; }
#party .stats { display: grid; grid-template-columns: repeat(3, auto); gap: 0 14px; }
#party .moves { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
#party .ty { display: inline-block; padding: 0 5px; border-radius: 3px; color: #fff; font-size: 8px; margin-right: 4px; }
`;
document.head.appendChild(css);
const TYPE_COL = {NORMAL: '#a8a878', FIRE: '#f08030', WATER: '#6890f0', GRASS: '#78c850', ELECTRIC: '#d8b020', ICE: '#98d8d8', FIGHTING: '#c03028', POISON: '#a040a0',
  GROUND: '#d8b860', FLYING: '#a890f0', PSYCHIC: '#f85888', BUG: '#a8b820', ROCK: '#b8a038', GHOST: '#705898', DRAGON: '#7038f8', DARK: '#705848', STEEL: '#a8a8c0', FAIRY: '#e890b0'};

/* ---------- Pokémon maths (Gen 3 style) ---------- */
const GROW = {Medium: n => n ** 3, Fast: n => Math.floor(4 * n ** 3 / 5), Slow: n => Math.floor(5 * n ** 3 / 4),
  Parabolic: n => Math.max(0, Math.floor(6 / 5 * n ** 3 - 15 * n * n + 100 * n - 140)), Erratic: n => n ** 3, Fluctuating: n => n ** 3};
const expFor = (dex, l) => l <= 1 ? 0 : (GROW[DEX[dex].growth] || GROW.Medium)(l);
const STAT_NAMES = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'];
function stats(p) {
  return DEX[p.dex].base.map((b, i) => i === 0 ? Math.floor((2 * b + p.iv) * p.lvl / 100) + p.lvl + 10 : Math.floor((2 * b + p.iv) * p.lvl / 100) + 5);
}
function makeMon(dex, lvl, iv) {
  const p = {dex, lvl, iv: iv == null ? 15 : iv, exp: expFor(dex, lvl), moves: [], status: null, sleep: 0, gender: DEX[dex].female < 0 ? null : Math.random() < DEX[dex].female ? 'F' : 'M'};
  const known = [];
  for (const [l, m] of DEX[dex].learn) if (l <= lvl && !known.includes(m)) known.push(m);
  p.moves = known.slice(-4).map(id => ({id, pp: MOVES[id].pp}));
  if (!p.moves.length) p.moves = [{id: 'TACKLE', pp: 35}];
  p.hp = stats(p)[0];
  return p;
}
const name = p => DEX[p.dex].name;

/* ---------- party / bag (saved with the game) ---------- */
function persist() { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) {} }
if (!save.party || !save.party.length) {                  // you start with the redesigned Fighting/Dark Abra line
  save.party = [makeMon(63, 5), makeMon(64, 16), makeMon(65, 36)];
  save.party[0].gender = 'M'; save.party[1].gender = 'M'; save.party[2].gender = 'M';
}
if (!save.bag) save.bag = {ball: 10, potion: 5};
if (!save.box) save.box = [];
for (const p of save.party.concat(save.box)) if (DEX[p.dex] && DEX[p.dex].female < 0) p.gender = null;
persist();
window.leadMon = () => save.party.find(p => p.hp > 0) || save.party[0];
function healAll() { for (const p of save.party) { p.hp = stats(p)[0]; p.status = null; p.sleep = 0; for (const m of p.moves) m.pp = MOVES[m.id] ? MOVES[m.id].pp : 10; } persist(); }

window.onDoor = text => {
  if (text.startsWith('POKéMON CENTER')) { healAll(); GAME.hud(); return 'Your Pokémon are fully healed! See you again!'; }
  if (text.startsWith('POKé MART')) {
    save.bag.ball = Math.max(save.bag.ball, 10); save.bag.potion = Math.max(save.bag.potion, 5); persist();
    return 'Your bag was filled up: ' + save.bag.ball + ' Poké Balls, ' + save.bag.potion + ' Potions.';
  }
  return '';
};

/* ---------- wild encounters ---------- */
let calm = 0;                                     // a few safe steps right after a battle
window.onStep = (mapId, x, y) => {
  if (calm > 0) { calm--; return; }
  const m = WORLD.maps[mapId], w = WILD[mapId];
  if (!w || !m.grass || m.grass[y][x] !== '1') return;
  if (Math.random() < (window.ENCOUNTER_RATE || 0.12)) {
    const dex = w.mons[rnd(w.mons.length)], lvl = w.min + rnd(w.max - w.min + 1);
    wildBattle(dex, lvl);
  }
};

/* ---------- battle screen: drawn like the GBA games, on a 240x160 canvas scaled up ---------- */
const B = $('battle');
B.innerHTML = '<canvas id="bCan"></canvas>';
const CAN = $('bCan'), K = 3;                     // drawn at 3x the GBA size so the text stays sharp
CAN.width = 240 * K; CAN.height = 160 * K;
const g = CAN.getContext('2d');
let E = null, Pb = null, Eb = null;               // the wild Pokémon and the two battlers (with their stat changes)
const battler = mon => ({mon, st: {atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0}, conf: 0, flinch: false});
const V = {text: '', mode: 'text', items: [], cursor: 0, back: false, eAlpha: 1, eScale: 1, eHP: 0, pHP: 0, pEXP: 0, hits: [], t0: 0};
const SPR = {};
function spr(src) { if (!SPR[src]) { const im = new Image(); im.src = src; SPR[src] = im; } return SPR[src]; }
const FONT = n => `${n * K}px "Pixelify Sans", "Press Start 2P", monospace`;
const C = {ink: '#404040', shadow: '#d8d0b0', white: '#f8f8f8', dark: '#283040'};

function rr(x, y, w, h, r, fill, stroke, lw) {        // rounded box in GBA units
  g.beginPath(); g.roundRect(x * K, y * K, w * K, h * K, r * K);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = (lw || 1) * K; g.strokeStyle = stroke; g.stroke(); }
}
function txt(s, x, y, size, col, shadow, align) {
  g.font = FONT(size); g.textAlign = align || 'left'; g.textBaseline = 'top';
  if (shadow) { g.fillStyle = shadow; g.fillText(s, (x + .6) * K, (y + .6) * K); }
  g.fillStyle = col; g.fillText(s, x * K, y * K);
}
function genderMark(p, x, y) {
  if (!p.gender) return;
  txt(p.gender === 'F' ? '♀' : '♂', x, y, 9, p.gender === 'F' ? '#f06070' : '#4080f0', C.shadow);
}
function hpBar(x, y, w, frac) {
  rr(x - 13, y - 1, w + 15, 6, 2, '#484848');
  txt('HP', x - 12, y - 1.6, 6, '#f8b030');
  g.fillStyle = '#e8e8e8'; g.fillRect(x * K, y * K, w * K, 3 * K);
  g.fillStyle = frac > .5 ? '#70f8a8' : frac > .2 ? '#f8e038' : '#f85838';
  g.fillRect(x * K, y * K, Math.max(0, w * frac) * K, 3 * K);
  g.fillStyle = frac > .5 ? '#58d080' : frac > .2 ? '#c8a808' : '#a84048';
  g.fillRect(x * K, (y + 2) * K, Math.max(0, w * frac) * K, 1 * K);
}
function statusTag(p, x, y) {
  if (!p.status) return;
  const col = {PAR: '#c0a000', PSN: '#a040a0', BRN: '#e05030', SLP: '#808080'}[p.status] || '#888';
  rr(x, y, 18, 7, 2, col); txt(p.status, x + 9, y + .3, 6, '#fff', null, 'center');
}
function wrap(s, w, size) {
  g.font = FONT(size); const out = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (g.measureText(t).width / K > w && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}
function render() {
  if (!window.BATTLE_OPEN || !E) return;
  g.imageSmoothingEnabled = false;
  // background: pale sky, two oval platforms
  g.fillStyle = '#f8f8f0'; g.fillRect(0, 0, 240 * K, 112 * K);
  g.fillStyle = '#e8f0d0'; g.fillRect(0, 48 * K, 240 * K, 64 * K);
  const oval = (cx, cy, rx, ry, a, b) => { g.beginPath(); g.ellipse(cx * K, cy * K, rx * K, ry * K, 0, 0, Math.PI * 2); g.fillStyle = a; g.fill(); g.beginPath(); g.ellipse(cx * K, (cy - 1) * K, (rx - 4) * K, (ry - 3) * K, 0, 0, Math.PI * 2); g.fillStyle = b; g.fill(); };
  oval(176, 70, 60, 12, '#c8c8b8', '#e0e0d0');
  oval(64, 108, 66, 13, '#c8c8b8', '#e0e0d0');
  // Pokémon
  const P = Pb.mon, es = stats(E), ps = stats(P);
  const ef = spr(`assets/battle/${E.dex}f.png?v=16`), pb = spr(`assets/battle/${P.dex}b.png?v=16`);
  const bob = Math.round(Math.sin(performance.now() / 260) * 1);
  if (ef.complete && V.eAlpha > 0) {
    g.globalAlpha = V.eAlpha; const s = 64 * V.eScale;
    g.drawImage(ef, (144 + (64 - s) / 2) * K, (6 + (64 - s)) * K, s * K, s * K); g.globalAlpha = 1;
  }
  if (pb.complete) g.drawImage(pb, 40 * K, (52 + bob) * K, 64 * K, 64 * K);
  // smooth HP / EXP bars
  V.eHP += (E.hp - V.eHP) * .2; V.pHP += (P.hp - V.pHP) * .2;
  const a = expFor(P.dex, P.lvl), b = expFor(P.dex, P.lvl + 1), xf = Math.min(1, (P.exp - a) / Math.max(1, b - a)); V.pEXP += (xf - V.pEXP) * .2;
  // enemy box
  rr(13, 15, 100, 30, 6, '#f8f8d8', '#405058', 2); rr(15, 17, 96, 26, 4, null, '#a8b0a0', 1);
  txt(name(E).toUpperCase(), 20, 18, 9, C.ink, C.shadow); genderMark(E, 20 + g.measureText(name(E).toUpperCase()).width / K + 2, 18);
  txt('Lv' + E.lvl, 106, 18, 9, C.ink, C.shadow, 'right'); statusTag(E, 20, 36);
  hpBar(58, 32, 48, Math.max(0, V.eHP / es[0]));
  // player box
  rr(126, 72, 106, 38, 6, '#f8f8d8', '#405058', 2); rr(128, 74, 102, 34, 4, null, '#a8b0a0', 1);
  txt(name(P).toUpperCase(), 134, 75, 9, C.ink, C.shadow); genderMark(P, 134 + g.measureText(name(P).toUpperCase()).width / K + 2, 75);
  txt('Lv' + P.lvl, 224, 75, 9, C.ink, C.shadow, 'right'); statusTag(P, 134, 95);
  hpBar(174, 88, 48, Math.max(0, V.pHP / ps[0]));
  txt(`${Math.max(0, Math.round(V.pHP))}/ ${ps[0]}`, 224, 93, 9, C.ink, C.shadow, 'right');
  g.fillStyle = '#404040'; g.fillRect(150 * K, 105 * K, 74 * K, 2 * K);
  g.fillStyle = '#40c8f8'; g.fillRect(150 * K, 105 * K, 74 * V.pEXP * K, 2 * K);
  txt('EXP', 134, 102.5, 6, '#f8b030');
  // bottom: text box (and menu box)
  V.hits = [];
  g.fillStyle = '#284860'; g.fillRect(0, 112 * K, 240 * K, 48 * K);
  const textW = V.mode === 'main' ? 118 : V.mode === 'text' ? 228 : 0;
  if (textW) {
    rr(2, 114, textW + 6, 44, 4, '#304868', '#c8a050', 2); rr(4, 116, textW + 2, 40, 3, null, '#887050', 1);
    wrap(V.text, textW - 10, 10).slice(V.page * 2, V.page * 2 + 2).forEach((l, i) => txt(l, 10, 121 + i * 16, 10, C.white, '#506878'));
    if (V.mode === 'text' && V.waiting && Math.floor(performance.now() / 350) % 2) { g.fillStyle = '#f85838'; g.beginPath(); g.moveTo(224 * K, 146 * K); g.lineTo(230 * K, 146 * K); g.lineTo(227 * K, 150 * K); g.fill(); }
  }
  const arrow = (x, y) => { g.fillStyle = '#404040'; g.beginPath(); g.moveTo(x * K, y * K); g.lineTo((x + 5) * K, (y + 4) * K); g.lineTo(x * K, (y + 8) * K); g.fill(); };
  if (V.mode === 'main') {                                    // ▶FIGHT  BAG / POKéMON  RUN
    rr(124, 114, 114, 44, 4, C.white, '#704860', 2); rr(126, 116, 110, 40, 3, null, '#a8a8a8', 1);
    V.items.forEach((it, i) => {
      const x = 138 + (i % 2) * 54, y = 122 + Math.floor(i / 2) * 16;
      txt(it.label === 'PKMN' ? 'POKéMON' : it.label, x, y, 10, C.ink, C.shadow);
      if (i === V.cursor) arrow(x - 8, y + 1.5);
      V.hits.push([x - 10, y - 3, 54, 15, i]);
    });
  } else if (V.mode === 'moves' || V.mode === 'list') {
    const moves = V.mode === 'moves';
    rr(2, 114, moves ? 158 : 236, 44, 4, C.white, '#704860', 2);
    const cols = 2, rows = Math.ceil(V.items.length / cols), lh = rows > 2 ? 40 / rows : 16;
    V.items.forEach((it, i) => {
      const x = 14 + (i % cols) * (moves ? 74 : 112), y = 119 + Math.floor(i / cols) * lh;
      txt(it.label, x, y, rows > 2 ? 8 : 10, it.disabled ? '#a8a8a8' : C.ink, C.shadow);
      if (i === V.cursor) arrow(x - 9, y + 1);
      V.hits.push([x - 10, y - 2, moves ? 72 : 110, lh, i]);
    });
    if (moves) {                                              // PP and type of the move under the cursor
      rr(162, 114, 76, 44, 4, C.white, '#704860', 2);
      const it = V.items[V.cursor];
      if (it && it.value !== 'back') {
        const mv = MOVES[it.value], slot = Pb.mon.moves.find(m => m.id === it.value);
        txt('PP', 170, 121, 10, C.ink, C.shadow); txt(`${slot ? slot.pp : '-'}/${mv ? mv.pp : '-'}`, 230, 121, 10, slot && slot.pp <= (mv ? mv.pp / 4 : 0) ? '#e04030' : C.ink, C.shadow, 'right');
        txt('TYPE/' + (mv ? mv.type : ''), 170, 138, 9, C.ink, C.shadow);
      }
    }
  }
  requestAnimationFrame(render);
}
function draw() { /* everything is drawn every frame by render() */ }

/* messages: wait for a tap / key (tests can set window.BATTLE_FAST); long text shows two lines at a time */
let advance = null;
function msg(t) {
  V.mode = 'text'; V.text = t; V.page = 0; V.items = [];
  if (window.BATTLE_FAST) return Promise.resolve();
  const pages = Math.max(1, Math.ceil(wrap(t, 218, 10).length / 2));
  return new Promise(res => {
    let t0 = performance.now(), done = false;
    V.waiting = true;
    const finish = () => { if (done) return; if (V.page + 1 < pages) { V.page++; t0 = performance.now(); clearTimeout(timer); timer = setTimeout(finish, 2600); return; } done = true; V.waiting = false; if (advance === mine) advance = null; res(); };
    const mine = () => { if (performance.now() - t0 > 220) finish(); };
    advance = mine;
    let timer = setTimeout(finish, 2600);                    // text also moves on by itself
  });
}

/* menus: arrows move the ▶, Space/Enter picks, Esc/X goes back; tapping an item picks it */
let menuPick = null, menuBack = null;
function menu(items, back) {
  const main = items.length === 4 && items[0].value === 'fight';
  const moves = !main && items.every(it => MOVES[it.value] || it.value === 'STRUGGLE');
  V.mode = main ? 'main' : moves ? 'moves' : 'list';
  if (main) V.text = `What will\n${name(Pb.mon).toUpperCase()} do?`;
  V.items = items.slice(); if (back) V.items.push({label: 'BACK', value: 'back'});
  V.cursor = Math.max(0, V.items.findIndex(it => !it.disabled)); V.page = 0;
  return new Promise(res => {
    menuPick = i => { const it = V.items[i]; if (!it || it.disabled) return; menuPick = menuBack = null; res(it.value); };
    menuBack = back ? () => { menuPick = menuBack = null; res('back'); } : null;
  });
}
addEventListener('keydown', e => {
  if (!window.BATTLE_OPEN) return;
  e.preventDefault();
  if (['Space', 'Enter', 'KeyZ'].includes(e.code)) { if (advance) return advance(); if (menuPick) menuPick(V.cursor); return; }
  if (['Escape', 'KeyX', 'Backspace'].includes(e.code)) { if (menuBack) menuBack(); return; }
  const step = {ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2, KeyD: 1, KeyA: -1, KeyS: 2, KeyW: -2}[e.code];
  if (step && V.items.length) { let i = V.cursor; for (let k = 0; k < V.items.length; k++) { i = (i + step + V.items.length * 4) % V.items.length; if (!V.items[i].disabled) break; } V.cursor = i; }
});
CAN.addEventListener('pointerdown', e => {
  const r = CAN.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 240, y = (e.clientY - r.top) / r.height * 160;
  const hit = V.hits.find(([hx, hy, hw, hh]) => x >= hx && x < hx + hw && y >= hy && y < hy + hh);
  if (hit && menuPick) { V.cursor = hit[4]; return menuPick(hit[4]); }
  if (advance) advance();
});

/* ---------- the fight ---------- */
const MULT = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
const ACCM = s => s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
function eff(type, def) {
  let m = 1;
  for (const t of DEX[def.dex].types) {
    const T = TYPES[t]; if (!T) continue;
    if (T.immune.includes(type)) m *= 0; else if (T.weak.includes(type)) m *= 2; else if (T.resist.includes(type)) m *= .5;
  }
  return m;
}
function stat(bt, i, key) {
  let v = stats(bt.mon)[i] * MULT(bt.st[key]);
  if (key === 'spe' && bt.mon.status === 'PAR') v /= 4;
  if (key === 'atk' && bt.mon.status === 'BRN') v /= 2;
  return Math.max(1, Math.floor(v));
}
const STATKEY = {Attack: ['atk', 'Attack'], Defense: ['def', 'Defense'], SpAtk: ['spa', 'Sp. Atk'], SpDef: ['spd', 'Sp. Def'], Speed: ['spe', 'Speed'], Accuracy: ['acc', 'accuracy'], Evasion: ['eva', 'evasiveness']};
async function statChange(bt, key, label, n) {
  const before = bt.st[key]; bt.st[key] = Math.max(-6, Math.min(6, before + n));
  const who = (bt === Pb ? '' : 'The wild ') + name(bt.mon);
  if (bt.st[key] === before) return msg(`${who}'s ${label} won't go ${n > 0 ? 'any higher' : 'any lower'}!`);
  return msg(`${who}'s ${label} ${n > 0 ? 'rose' : 'fell'}${Math.abs(n) > 1 ? ' sharply' : ''}!`);
}
async function giveStatus(bt, s) {
  const who = (bt === Pb ? '' : 'The wild ') + name(bt.mon), types = DEX[bt.mon.dex].types;
  if (bt.mon.status || bt.mon.hp <= 0) return;
  if ((s === 'PAR' && types.includes('ELECTRIC')) || (s === 'BRN' && types.includes('FIRE')) || (s === 'PSN' && (types.includes('POISON') || types.includes('STEEL')))) return;
  bt.mon.status = s; if (s === 'SLP') bt.mon.sleep = 1 + rnd(3);
  draw();
  await msg(who + {PAR: ' is paralyzed! It may be unable to move!', BRN: ' was burned!', PSN: ' was poisoned!', SLP: ' fell asleep!'}[s]);
}
async function effect(fn, user, target, isStatusMove, moved_first) {
  let m = fn.match(/^(Raise|Lower)(User|Target)(Attack|Defense|SpAtk|SpDef|Speed|Accuracy|Evasion)(\d)$/);
  if (m) { const [key, label] = STATKEY[m[3]]; return statChange(m[2] === 'User' ? user : target, key, label, (m[1] === 'Raise' ? 1 : -1) * +m[4]); }
  if (/^ParalyzeTarget/.test(fn)) return giveStatus(target, 'PAR');
  if (/^BurnTarget/.test(fn)) return giveStatus(target, 'BRN');
  if (/^(Bad)?PoisonTarget/.test(fn)) return giveStatus(target, 'PSN');
  if (/^SleepTarget/.test(fn)) return giveStatus(target, 'SLP');
  if (/^ConfuseTarget/.test(fn)) { if (!target.conf && target.mon.hp > 0) { target.conf = 2 + rnd(3); return msg(((target === Pb) ? '' : 'The wild ') + name(target.mon) + ' became confused!'); } return; }
  if (fn === 'FlinchTarget') { if (moved_first) target.flinch = true; return; }
  if (/^HealUser(HalfOfTotalHP|DependingOnWeather)/.test(fn)) {
    const mx = stats(user.mon)[0]; if (user.mon.hp >= mx) return msg("It's already at full health!");
    user.mon.hp = Math.min(mx, user.mon.hp + Math.ceil(mx / 2)); draw(); return msg((user === Pb ? '' : 'The wild ') + name(user.mon) + ' regained health!');
  }
  if (isStatusMove) return msg('But nothing happened!');
}
async function useMove(user, target, id, first) {
  const mon = user.mon, who = (user === Pb ? '' : 'The wild ') + name(mon), mv = MOVES[id] || {name: 'Struggle', type: 'NORMAL', cat: 'Physical', power: 50, acc: 0, fn: 'None', chance: 0};
  if (user.flinch) { user.flinch = false; return msg(who + ' flinched and couldn\'t move!'); }
  if (mon.status === 'SLP') {
    if (mon.sleep > 0) { mon.sleep--; return msg(who + ' is fast asleep.'); }
    mon.status = null; draw(); await msg(who + ' woke up!');
  }
  if (mon.status === 'PAR' && rnd(4) === 0) return msg(who + ' is paralyzed! It can\'t move!');
  if (user.conf > 0) {
    user.conf--; await msg(who + ' is confused!');
    if (rnd(3) === 0) {
      const d = Math.max(1, Math.floor((Math.floor(2 * mon.lvl / 5 + 2) * 40 * stat(user, 1, 'atk') / stat(user, 2, 'def')) / 50 + 2));
      mon.hp = Math.max(0, mon.hp - d); draw(); return msg('It hurt itself in its confusion!');
    }
  }
  const slot = mon.moves.find(m => m.id === id); if (slot) slot.pp = Math.max(0, slot.pp - 1);
  await msg(`${who} used ${mv.name.toUpperCase()}!`);
  // accuracy
  if (mv.acc > 0 && mv.fn !== 'OHKO') {
    const hit = mv.acc * ACCM(user.st.acc) / ACCM(target.st.eva);
    if (rnd(100) >= hit) return msg((user === Pb ? '' : 'The wild ') + name(mon) + "'s attack missed!");
  }
  if (mv.cat === 'Status' || mv.power === 0 && mv.fn !== 'OHKO') return effect(mv.fn, user, target, true, first);
  const e = eff(mv.type, target.mon);
  if (e === 0) return msg("It doesn't affect " + (target === Pb ? '' : 'the wild ') + name(target.mon) + '...');
  let hits = /HitTwoToFiveTimes/.test(mv.fn) ? 2 + rnd(4) : /HitTwoTimes/.test(mv.fn) ? 2 : 1, total = 0, crit = false;
  for (let h = 0; h < hits && target.mon.hp > 0; h++) {
    let d;
    if (mv.fn === 'OHKO') { if (target.mon.lvl > mon.lvl || rnd(100) >= 30) return msg('But it failed!'); d = target.mon.hp; }
    else {
      const phys = mv.cat === 'Physical';
      const A = phys ? stat(user, 1, 'atk') : stat(user, 3, 'spa'), D = phys ? stat(target, 2, 'def') : stat(target, 4, 'spd');
      d = Math.floor(Math.floor(Math.floor(2 * mon.lvl / 5 + 2) * mv.power * A / D) / 50) + 2;
      if (rnd(16) === 0) { d = Math.floor(d * 1.5); crit = true; }
      if (DEX[mon.dex].types.includes(mv.type)) d = Math.floor(d * 1.5);
      d = Math.max(1, Math.floor(d * e * (85 + rnd(16)) / 100));
    }
    target.mon.hp = Math.max(0, target.mon.hp - d); total += d; draw();
  }
  if (crit) await msg('A critical hit!');
  if (e > 1) await msg("It's super effective!"); else if (e < 1) await msg("It's not very effective...");
  if (hits > 1) await msg(`Hit ${hits} time(s)!`);
  if (/HealUserByHalfOfDamageDone/.test(mv.fn)) { mon.hp = Math.min(stats(mon)[0], mon.hp + Math.max(1, Math.floor(total / 2))); draw(); await msg((target === Pb ? 'The wild ' + name(target.mon) : name(target.mon)) + ' had its energy drained!'); }
  const rec = mv.fn.match(/Recoil(Quarter|Third|Half)/);
  if (rec) { mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(total / {Quarter: 4, Third: 3, Half: 2}[rec[1]]))); draw(); await msg(who + ' is hit with recoil!'); }
  if (mv.fn === 'UserFaintsExplosive') { mon.hp = 0; draw(); }
  if (target.mon.hp > 0 && mv.chance > 0 && rnd(100) < mv.chance) await effect(mv.fn, user, target, false, first);
}
function pickEnemyMove() {
  const ok = E.moves.filter(m => m.pp > 0); return ok.length ? ok[rnd(ok.length)].id : 'STRUGGLE';
}
async function endOfTurn(bt) {
  const mon = bt.mon; if (mon.hp <= 0) return;
  const who = (bt === Pb ? '' : 'The wild ') + name(mon), mx = stats(mon)[0];
  if (mon.status === 'PSN') { mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(mx / 8))); draw(); await msg(who + ' is hurt by poison!'); }
  if (mon.status === 'BRN') { mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(mx / 16))); draw(); await msg(who + ' is hurt by its burn!'); }
}

/* ---------- level ups, new moves, evolution ---------- */
async function gainExp(p, amount) {
  p.exp += amount; await msg(`${name(p)} gained ${amount} EXP. Points!`);
  while (p.lvl < 100 && p.exp >= expFor(p.dex, p.lvl + 1)) {
    const before = stats(p); p.lvl++; const after = stats(p); p.hp += after[0] - before[0];
    draw(); await msg(`${name(p)} grew to Lv. ${p.lvl}!`);
    for (const [l, id] of DEX[p.dex].learn) {
      if (l !== p.lvl || p.moves.find(m => m.id === id) || !MOVES[id]) continue;
      if (p.moves.length < 4) { p.moves.push({id, pp: MOVES[id].pp}); await msg(`${name(p)} learned ${MOVES[id].name.toUpperCase()}!`); }
      else { const old = p.moves.shift(); p.moves.push({id, pp: MOVES[id].pp}); await msg(`${name(p)} forgot ${MOVES[old.id] ? MOVES[old.id].name.toUpperCase() : old.id}... and learned ${MOVES[id].name.toUpperCase()}!`); }
    }
  }
}
async function evolutions() {
  for (const p of save.party) {
    const ev = DEX[p.dex].evo;
    if (!ev || p.lvl < ev[1] || p.hp <= 0) continue;
    const old = name(p), before = stats(p);
    await msg(`What? ${old} is evolving!`);
    p.dex = ev[0]; const after = stats(p); p.hp += after[0] - before[0];
    await msg(`Congratulations! Your ${old} evolved into ${name(p)}!`);
  }
}

/* ---------- one wild battle ---------- */
async function choosePokemon(force) {
  const items = save.party.map((p, i) => ({label: `${name(p)} Lv${p.lvl}`, sub: `${p.hp}/${stats(p)[0]} HP${p.status ? ' ' + p.status : ''}`, value: i, disabled: p.hp <= 0 || p === Pb.mon}));
  return menu(items, !force);
}
async function wildBattle(dex, lvl) {
  window.BATTLE_OPEN = true; GAME.held.length = 0;
  E = makeMon(dex, lvl, rnd(32)); Eb = battler(E);
  Pb = battler(leadMon());
  B.style.display = 'flex'; V.eAlpha = 1; V.eScale = 1; V.eHP = E.hp; V.pHP = Pb.mon.hp; V.pEXP = 0; requestAnimationFrame(render);
  draw();
  await msg(`A wild ${name(E).toUpperCase()} appeared!`);
  await msg(`Go! ${name(Pb.mon).toUpperCase()}!`);
  let result = null;
  while (!result) {
    // the player's choice
    let act = null;
    while (!act) {
      const c = await menu([{label: 'FIGHT', value: 'fight'}, {label: 'BAG', value: 'bag'}, {label: 'PKMN', value: 'pkmn'}, {label: 'RUN', value: 'run'}]);
      if (c === 'fight') {
        const usable = Pb.mon.moves.filter(m => m.pp > 0);
        if (!usable.length) { act = {move: 'STRUGGLE'}; break; }
        const mv = await menu(Pb.mon.moves.map(m => ({label: (MOVES[m.id] || {name: m.id}).name.toUpperCase(), sub: `PP ${m.pp}/${MOVES[m.id] ? MOVES[m.id].pp : '?'}  ${MOVES[m.id] ? MOVES[m.id].type : ''}`, value: m.id, disabled: m.pp <= 0})), true);
        if (mv !== 'back') act = {move: mv};
      } else if (c === 'bag') {
        const it = await menu([{label: 'POKé BALL', sub: 'x' + save.bag.ball, value: 'ball', disabled: !save.bag.ball}, {label: 'POTION', sub: 'x' + save.bag.potion + '  (+20 HP)', value: 'potion', disabled: !save.bag.potion}], true);
        if (it !== 'back') act = {item: it};
      } else if (c === 'pkmn') {
        const i = await choosePokemon(false);
        if (i !== 'back') act = {swap: i};
      } else if (c === 'run') act = {run: true};
    }
    // non-attack actions go first
    if (act.run) { await msg('Got away safely!'); result = 'run'; break; }
    if (act.item === 'potion') {
      save.bag.potion--; const mx = stats(Pb.mon)[0], before = Pb.mon.hp; Pb.mon.hp = Math.min(mx, Pb.mon.hp + 20); draw();
      await msg(`${name(Pb.mon)}'s HP was restored by ${Pb.mon.hp - before} points.`);
    }
    if (act.item === 'ball') {
      save.bag.ball--; await msg('You threw a POKé BALL!');
      const mx = stats(E)[0], bonus = E.status === 'SLP' ? 2 : E.status ? 1.5 : 1;
      const a = Math.max(1, Math.floor((3 * mx - 2 * E.hp) * DEX[E.dex].catch * bonus / (3 * mx)));
      V.eScale = .25; V.eAlpha = .35;
      let shakes = 0; const p = Math.pow(a / 255, 1 / 4);
      for (; shakes < 4; shakes++) { if (a < 255 && Math.random() > p) break; if (shakes < 3) await msg('...' + '.'.repeat(shakes)); }
      if (shakes >= 4) {
        V.eAlpha = 0;
        await msg(`Gotcha! ${name(E).toUpperCase()} was caught!`);
        if (save.party.length < 6) { save.party.push(E); await msg(`${name(E)} joined your party!`); }
        else { save.box.push(E); await msg(`${name(E)} was sent to the PC box.`); }
        result = 'caught'; break;
      }
      V.eScale = 1; V.eAlpha = 1;
      await msg(['Oh no! The Pokémon broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!', 'Shoot! It was so close, too!'][Math.min(shakes, 3)]);
    }
    if (act.swap != null) {
      await msg(`${name(Pb.mon)}, come back!`);
      const chosen = save.party[act.swap]; save.party.splice(act.swap, 1); save.party.unshift(chosen); Pb = battler(chosen); V.pHP = chosen.hp;
      draw(); await msg(`Go! ${name(Pb.mon).toUpperCase()}!`);
    }
    // attacks, fastest first
    const eMove = pickEnemyMove();
    const order = act.move ? (stat(Pb, 5, 'spe') >= stat(Eb, 5, 'spe') ? [[Pb, Eb, act.move], [Eb, Pb, eMove]] : [[Eb, Pb, eMove], [Pb, Eb, act.move]]) : [[Eb, Pb, eMove]];
    for (let k = 0; k < order.length; k++) {
      const [u, t, mv] = order[k];
      if (u.mon.hp <= 0 || t.mon.hp <= 0) continue;
      await useMove(u, t, mv, k === 0);
    }
    Pb.flinch = Eb.flinch = false;
    if (E.hp > 0 && Pb.mon.hp > 0) { await endOfTurn(Pb); await endOfTurn(Eb); }
    // fainting
    if (E.hp <= 0) {
      V.eAlpha = 0; await msg(`The wild ${name(E).toUpperCase()} fainted!`);
      if (Pb.mon.hp > 0) await gainExp(Pb.mon, Math.max(1, Math.floor(DEX[E.dex].exp * E.lvl / 7)));
      result = 'won';
    }
    if (Pb.mon.hp <= 0) {
      await msg(`${name(Pb.mon).toUpperCase()} fainted!`);
      if (result) break;
      if (save.party.some(p => p.hp > 0)) {
        const i = await choosePokemon(true); Pb = battler(save.party[i]); V.pHP = Pb.mon.hp;
        const p = Pb.mon; save.party.splice(save.party.indexOf(p), 1); save.party.unshift(p);
        draw(); await msg(`Go! ${name(Pb.mon).toUpperCase()}!`);
      } else {
        await msg('You are out of usable Pokémon!'); await msg('You hurried back to BIRCHFIELD and your Pokémon were healed.');
        result = 'lost';
      }
    }
  }
  if (result === 'won' || result === 'caught') await evolutions();
  if (result === 'lost') healAll();
  persist();
  B.style.display = 'none'; window.BATTLE_OPEN = false; calm = 4;
  if (result === 'lost') await GAME.enter(WORLD.start.map, WORLD.start.x, WORLD.start.y, 'down');
  GAME.hud();
  return result;
}
window.wildBattle = wildBattle;
// battles with the Pokemon you can see walking around: beaten or caught ones vanish for a while
window.symbolBattle = async (o, mapId) => {
  const w = WILD[mapId] || {min: 3, max: 5};
  const res = await wildBattle(o.dex, o.lvl || (w.min + rnd(w.max - w.min + 1)));
  o.chasing = false; o.alert = 0;
  o.gone = true; o.respawn = Date.now() + 45000;         // whatever happened (won, caught or ran), that Pokemon is gone after the fight
  o.lvl = w.min + rnd(w.max - w.min + 1);
};

/* ---------- party / stats screen (P key, PKMN button) ---------- */
const PT = $('party');
function typeTag(t) { return `<span class="ty" style="background:${TYPE_COL[t] || '#888'}">${(TYPES[t] || {name: t}).name}</span>`; }
function renderParty() {
  PT.innerHTML = `<h2>YOUR POKéMON</h2><div class="hint">Tap a Pokémon (or press 1-6) to make it lead. P / Esc / tap here to close. Bag: ${save.bag.ball} Poké Balls, ${save.bag.potion} Potions. PC box: ${save.box.length}</div>` +
    save.party.map((p, i) => {
      const s = stats(p), a = expFor(p.dex, p.lvl), b = expFor(p.dex, p.lvl + 1);
      return `<div class="card ${i === 0 ? 'lead' : ''}" data-i="${i}"><img src="assets/battle/${p.dex}f.png?v=16">
        <div><b>${i + 1}. ${name(p).toUpperCase()}</b> Lv${p.lvl} ${DEX[p.dex].types.map(typeTag).join('')} ${p.status ? '<span class="ty" style="background:#c05050">' + p.status + '</span>' : ''}<br>
        HP ${p.hp}/${s[0]} · EXP ${p.exp - a}/${b - a} to next level
        <div class="stats">${STAT_NAMES.slice(1).map((n, k) => `<span>${n} ${s[k + 1]}</span>`).join('')}</div>
        <div class="moves">${p.moves.map(m => MOVES[m.id] ? `<span>${typeTag(MOVES[m.id].type)}${MOVES[m.id].name} ${m.pp}/${MOVES[m.id].pp}</span>` : '').join('')}</div></div></div>`;
    }).join('');
}
window.openParty = () => { window.PARTY_OPEN = true; renderParty(); PT.style.display = 'block'; GAME.held.length = 0; };
function closeParty() { window.PARTY_OPEN = false; PT.style.display = 'none'; GAME.hud(); }
function makeLead(i) { if (i > 0 && save.party[i]) { const p = save.party.splice(i, 1)[0]; save.party.unshift(p); persist(); renderParty(); } }
PT.addEventListener('pointerdown', e => { const c = e.target.closest('.card'); if (c) makeLead(+c.dataset.i); else closeParty(); });
addEventListener('keydown', e => {
  if (!window.PARTY_OPEN) return;
  e.preventDefault();
  if (['KeyP', 'Escape', 'KeyX', 'Space', 'Enter'].includes(e.code)) return closeParty();
  const n = +e.key; if (n >= 1 && n <= 6) makeLead(n - 1);
});
const pb = $('pbtn'); if (pb) pb.addEventListener('pointerdown', e => { e.preventDefault(); if (!window.BATTLE_OPEN) openParty(); });
window.PARTY = {makeMon, stats, healAll, persist};
if (GAME.M) GAME.hud();
})();
