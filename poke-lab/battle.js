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
#battle, #party { position: fixed; inset: 0; z-index: 8; display: none; font-family: var(--font); color: #303030; user-select: none; }
#battle { background: linear-gradient(#f8f8e8 0 8%, #c8e8a0 8% 52%, #98d070 52% 72%, #f8f8f8 72%); }
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
@media (orientation: portrait) {
  #battle .plat.e { right: 6% !important; top: 27% !important; width: 52vw !important; height: 6vh !important; }
  #battle .plat.p { left: 2% !important; top: 57% !important; width: 58vw !important; height: 6vh !important; }
  #bEsp { right: 14% !important; top: 13% !important; width: 36vw !important; }
  #bPsp { left: 8% !important; top: 38% !important; width: 44vw !important; }
  #battle .box.pb { top: 64% !important; right: 3% !important; width: 58vw !important; }
  #battle .box.eb { width: 58vw !important; }
  #bMsg { height: 25%; }
  #bMenu { width: calc(100vw - 16px); }
}
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
  const p = {dex, lvl, iv: iv == null ? 15 : iv, exp: expFor(dex, lvl), moves: [], status: null, sleep: 0};
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
if (!save.party || !save.party.length) save.party = [makeMon(137, 5)];
if (!save.bag) save.bag = {ball: 10, potion: 5};
if (!save.box) save.box = [];
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

/* ---------- battle screen ---------- */
const B = $('battle');
B.innerHTML = `<div class="plat e" style="right:8%;top:30%;width:34vw;height:7vh"></div><div class="plat p" style="left:6%;top:60%;width:38vw;height:8vh"></div>
  <img class="mon" id="bEsp" style="right:12%;top:6%"><img class="mon" id="bPsp" style="left:10%;top:34%">
  <div class="box eb" style="left:4%;top:5%"><b id="bEn"></b><span id="bEl"></span><div class="bar"><i id="bEh"></i></div></div>
  <div class="box pb" style="right:4%;top:46%"><b id="bPn"></b><span id="bPl"></span><div class="bar"><i id="bPh"></i></div><div class="hpt" id="bPt"></div><div class="xbar"><i id="bPx"></i></div></div>
  <div id="bMsg"></div><div id="bMenu"></div>`;
let E = null, Pb = null, Eb = null;               // the wild Pokémon and the two battlers (with their stat changes)
const battler = mon => ({mon, st: {atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0}, conf: 0, flinch: false});
function barClass(p) { return p > .5 ? '' : p > .2 ? 'mid' : 'low'; }
function draw() {
  const P = Pb.mon, es = stats(E), ps = stats(P);
  $('bEn').innerHTML = DEX[E.dex].name.toUpperCase() + (E.status ? `<span class="st" style="float:none">${E.status}</span>` : ''); $('bEl').textContent = 'Lv' + E.lvl;
  const ef = Math.max(0, E.hp / es[0]); $('bEh').style.width = ef * 100 + '%'; $('bEh').className = barClass(ef);
  $('bPn').innerHTML = name(P).toUpperCase() + (P.status ? `<span class="st" style="float:none">${P.status}</span>` : ''); $('bPl').textContent = 'Lv' + P.lvl;
  const pf = Math.max(0, P.hp / ps[0]); $('bPh').style.width = pf * 100 + '%'; $('bPh').className = barClass(pf);
  $('bPt').textContent = Math.max(0, P.hp) + ' / ' + ps[0];
  const a = expFor(P.dex, P.lvl), b = expFor(P.dex, P.lvl + 1); $('bPx').style.width = Math.min(100, (P.exp - a) / Math.max(1, b - a) * 100) + '%';
  $('bEsp').src = `assets/battle/${E.dex}f.png?v=11`; $('bPsp').src = `assets/battle/${P.dex}b.png?v=11`;
}

/* messages: wait for a tap / key (tests can set window.BATTLE_FAST) */
let advance = null;
function msg(t) {
  $('bMsg').textContent = t; $('bMenu').innerHTML = '';
  if (window.BATTLE_FAST) return Promise.resolve();
  return new Promise(res => {
    const t0 = performance.now();
    let done = false;
    const finish = () => { if (done) return; done = true; if (advance === mine) advance = null; res(); };
    const mine = () => { if (performance.now() - t0 > 220) finish(); };
    advance = mine;
    setTimeout(finish, 2600);                      // text also moves on by itself
  });
}
B.addEventListener('pointerdown', e => { if (advance && !e.target.closest('#bMenu')) advance(); });

/* menus: a grid of buttons; arrows move, Space/Enter picks, Esc/X goes back */
let menuBack = null;
function menu(items, back) {
  const m = $('bMenu'); m.innerHTML = ''; menuBack = back || null;
  return new Promise(res => {
    items.forEach((it, i) => {
      const b = document.createElement('button'); b.innerHTML = it.label + (it.sub ? `<small>${it.sub}</small>` : '');
      b.disabled = !!it.disabled;
      b.onclick = () => { menuBack = null; res(it.value); };
      m.appendChild(b);
    });
    if (back) { const b = document.createElement('button'); b.textContent = 'BACK'; b.onclick = () => { menuBack = null; res('back'); }; m.appendChild(b); }
    const first = m.querySelector('button:not(:disabled)'); if (first) first.focus();
    menuBack = back ? () => res('back') : null;
  });
}
addEventListener('keydown', e => {
  if (!window.BATTLE_OPEN) return;
  e.preventDefault();
  if (['Space', 'Enter', 'KeyZ'].includes(e.code)) { if (advance) return advance(); const f = document.activeElement; if (f && f.closest('#bMenu')) f.click(); return; }
  if (['Escape', 'KeyX', 'Backspace'].includes(e.code)) { if (menuBack) menuBack(); return; }
  const bs = [...$('bMenu').querySelectorAll('button:not(:disabled)')]; if (!bs.length) return;
  let i = bs.indexOf(document.activeElement); if (i < 0) i = 0;
  const step = {ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2, KeyD: 1, KeyA: -1, KeyS: 2, KeyW: -2}[e.code];
  if (step) bs[(i + step + bs.length) % bs.length].focus();
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
    $('bPsp').src = `assets/battle/${p.dex}b.png?v=11`;
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
  B.style.display = 'block'; $('bEsp').style.opacity = 1; $('bEsp').style.transform = '';
  draw();
  await msg(`A wild ${name(E).toUpperCase()} appeared!`);
  await msg(`Go! ${name(Pb.mon).toUpperCase()}!`);
  let result = null;
  while (!result) {
    // the player's choice
    let act = null;
    while (!act) {
      $('bMsg').textContent = `What will ${name(Pb.mon).toUpperCase()} do?`;
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
      $('bEsp').style.transform = 'scale(.2)'; $('bEsp').style.opacity = .2;
      let shakes = 0; const p = Math.pow(a / 255, 1 / 4);
      for (; shakes < 4; shakes++) { if (a < 255 && Math.random() > p) break; if (shakes < 3) await msg('...' + '.'.repeat(shakes)); }
      if (shakes >= 4) {
        $('bEsp').style.opacity = 0;
        await msg(`Gotcha! ${name(E).toUpperCase()} was caught!`);
        if (save.party.length < 6) { save.party.push(E); await msg(`${name(E)} joined your party!`); }
        else { save.box.push(E); await msg(`${name(E)} was sent to the PC box.`); }
        result = 'caught'; break;
      }
      $('bEsp').style.transform = ''; $('bEsp').style.opacity = 1;
      await msg(['Oh no! The Pokémon broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!', 'Shoot! It was so close, too!'][Math.min(shakes, 3)]);
    }
    if (act.swap != null) {
      await msg(`${name(Pb.mon)}, come back!`);
      const chosen = save.party[act.swap]; save.party.splice(act.swap, 1); save.party.unshift(chosen); Pb = battler(chosen);
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
      $('bEsp').style.opacity = 0; await msg(`The wild ${name(E).toUpperCase()} fainted!`);
      if (Pb.mon.hp > 0) await gainExp(Pb.mon, Math.max(1, Math.floor(DEX[E.dex].exp * E.lvl / 7)));
      result = 'won';
    }
    if (Pb.mon.hp <= 0) {
      await msg(`${name(Pb.mon).toUpperCase()} fainted!`);
      if (result) break;
      if (save.party.some(p => p.hp > 0)) {
        const i = await choosePokemon(true); Pb = battler(save.party[i]);
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

/* ---------- party / stats screen (P key, PKMN button) ---------- */
const PT = $('party');
function typeTag(t) { return `<span class="ty" style="background:${TYPE_COL[t] || '#888'}">${(TYPES[t] || {name: t}).name}</span>`; }
function renderParty() {
  PT.innerHTML = `<h2>YOUR POKéMON</h2><div class="hint">Tap a Pokémon (or press 1-6) to make it lead. P / Esc / tap here to close. Bag: ${save.bag.ball} Poké Balls, ${save.bag.potion} Potions. PC box: ${save.box.length}</div>` +
    save.party.map((p, i) => {
      const s = stats(p), a = expFor(p.dex, p.lvl), b = expFor(p.dex, p.lvl + 1);
      return `<div class="card ${i === 0 ? 'lead' : ''}" data-i="${i}"><img src="assets/battle/${p.dex}f.png?v=11">
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
