"use strict";
// FISH TANK (web / iPhone). Port of FISH TANK 2 (fishtank2.py): tables come from data.js (built by tools/build_assets.py).
const W = 900, H = 600, SAND_Y = H - 60, TOP = 70, BOT = SAND_Y - 30, MAX_FISH = 22, FOOD_COST = 5;
const D = DATA, SP = D.sprites;
const set = (a) => new Set(a);
const PETS = set(D.pets), GROUND = set(D.ground), STILL = set(D.still), EATERS = set(D.eaters), LEGENDS = set(D.legends), GRAB = set(D.grabbers);
const FLOOR = set(D.floorRaiders), CHASERS = set(D.bossChasers);
const COINV = D.coins;
const R = Math.random, rnd = (a, b) => a + R() * (b - a), pick = (a) => a[Math.floor(R() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const stageLabel = (L) => (Math.floor((L - 1) / D.stagesPerTank) + 1) + "-" + (((L - 1) % D.stagesPerTank) + 1);
function wchoice(items, weights) { let t = weights.reduce((a, b) => a + b, 0) * R(); for (let i = 0; i < items.length; i++) { t -= weights[i]; if (t <= 0) return items[i]; } return items[items.length - 1]; }

// ------------------------------------------------------------------------------------------------ images / sprites
const imgs = {};
function loadImg(src) {
  if (!imgs[src]) { const i = new Image(); const o = { img: i, ok: false, bad: false }; i.onload = () => { o.ok = true; }; i.onerror = () => { o.bad = true; }; i.src = src; imgs[src] = o; }
  return imgs[src];
}
const strips = {};
function tintCanvas(img, tint) {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height), p = id.data;
  const T = tint[0] === "s" ? D.shinyTiers[tint[1]] : null;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    let r = p[i], g = p[i + 1], b = p[i + 2];
    if (tint === "red") { p[i] = b; p[i + 2] = r; continue; }
    if (tint === "black") { p[i] = p[i + 1] = p[i + 2] = 0; continue; }
    if (tint === "dead") { const y = (r * 0.3 + g * 0.59 + b * 0.11) | 0; p[i] = p[i + 1] = p[i + 2] = y; continue; }
    if (T) {                                           // Aurora / Solar / Void: hue shift
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
      if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
      let s = mx ? d / mx : 0, v = mx / 255;
      h = (h + T[1]) % 360; s = Math.min(1, s * T[2]); v = Math.min(1, v * T[3]);
      const c2 = v * s, x2 = c2 * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c2; let rr = 0, gg = 0, bb = 0;
      if (h < 60) { rr = c2; gg = x2; } else if (h < 120) { rr = x2; gg = c2; } else if (h < 180) { gg = c2; bb = x2; } else if (h < 240) { gg = x2; bb = c2; } else if (h < 300) { rr = x2; bb = c2; } else { rr = c2; bb = x2; }
      p[i] = (rr + m) * 255; p[i + 1] = (gg + m) * 255; p[i + 2] = (bb + m) * 255;
    }
  }
  x.putImageData(id, 0, 0);
  return c;
}
function getStrip(sp, anim, shiny, tint) {
  const m = SP[sp]; if (!m) return null;
  const useShiny = shiny && m.shiny && !tint;
  const src = "sprites/" + sp + (useShiny ? "_shiny_" : "_") + anim + ".png";
  const o = loadImg(src);
  if (o.bad && useShiny) return getStrip(sp, anim, false, tint);
  if (!o.ok) return null;
  if (!tint) return o.img;
  const key = src + "|" + tint;
  if (!strips[key]) strips[key] = tintCanvas(o.img, tint);
  return strips[key];
}
function pickAnim(sp, anim) { const m = SP[sp]; for (const a of [anim, "Walk", "Idle"]) if (m && m[a]) return a; return null; }
const fxSheets = {};
function fxImg(name) { return loadImg("fx/" + name + ".png"); }

// ------------------------------------------------------------------------------------------------ audio (tiny synth blips)
let actx = null;
function beep(freq, dur, type, vol) {
  try {
    if (!G.settings.sound) return;
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(); o.type = type || "sine"; o.frequency.value = freq;
    g.gain.value = vol || 0.05; g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch (e) { /* no audio */ }
}
const SND = { coin: () => beep(880, 0.12, "triangle"), buy: () => beep(520, 0.15, "square", 0.03), slam: () => beep(90, 0.35, "sawtooth", 0.08), alarm: () => beep(300, 0.3, "square", 0.04), evolve: () => beep(1200, 0.3, "sine") };

// ------------------------------------------------------------------------------------------------ entities
let UID = 1;
function newE(kind, x, y, stage, sp, variant) {
  const boss = kind === "boss";
  const e = {
    id: UID++, kind, variant: boss ? (variant || "gyarados") : null, sp: sp || (boss ? D.bosses[variant || "gyarados"][0] : "magikarp"),
    x: x == null ? rnd(80, W - 80) : x, y: y == null ? rnd(TOP, BOT) : y, right: R() < 0.5, mode: "idle", timer: rnd(0.2, 2), frame: 0, ftime: 0,
    hunger: kind === "guppy" ? rnd(70, 100) : 100, stage: stage || 0, growth: 0, coin_t: rnd(5, 10), spawn_t: rnd(10, 18), dead: 0, isDead: false, hp: 0, maxhp: 1,
    cool: 0, shoot: 0, atk: 0, slow: 0, poison: 0, ptick: 0, shiny: false, tier: 0, spark: rnd(1, 3), phase: "swim", fly_t: rnd(8, 14), evolved: false, age: 0,
    vis: true, loot: [], fuse: 14, born: 0, shake: 0, held: false, sizeMul: boss ? 1 : wchoice(D.sizeClasses, D.sizeWeights) * rnd(0.95, 1.05),
  };
  e.tx = e.x; e.ty = e.y;
  return e;
}
const isPet = (e) => PETS.has(e.kind);
function baseScale(e) {
  const m = SP[e.sp]; if (!m) return 1;
  const ah = m.h;
  if (e.kind === "guppy") { if (D.spH[e.sp]) return D.spH[e.sp] * [0.55, 0.8, 1.0][e.stage] / ah; return D.guppyScale[e.stage]; }
  if (e.kind === "boss" && D.bosses[e.variant][5]) return D.bosses[e.variant][5] / ah;
  if (D.targetH[e.kind]) return (D.spH[e.sp] || D.targetH[e.kind]) / ah * (D.evoMult[e.sp] || 1);
  return D.scale[e.kind] || 1;
}
const scaleOf = (e) => baseScale(e) * ((e.evolved && D.spH[e.sp] == null) ? 1.2 : 1) * e.sizeMul;
function tintOf(e) {
  if (e.kind === "boss") { if (e.variant === "gyarados") return "red"; return null; }
  return e.shiny && e.tier ? "s" + e.tier : null;
}

// ------------------------------------------------------------------------------------------------ game state
const G = {
  level: 1, best: 1, settings: { fx: true, shiny: true, sound: true, boss: true, hunger: true, speed: 1 },
  prog: { grown: 0, raiders: 0, evolved: 0, coins: 0, births: 0, shinies: 0, birds: 0, eggs: 0, kyogre: 0, seen: [], unlocked: [], beaten: [] },
  dbg: { unlock: false, god: false, cash: false, shiny: false },
  state: "play", paused: false, S: 1,
};
function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem("fishtank_save") || "null");
    if (d) { G.level = d.level || 1; G.best = d.best || G.level; Object.assign(G.settings, d.settings || {}); Object.assign(G.prog, d.prog || {}); }
  } catch (e) { /* fresh */ }
}
function save() { try { localStorage.setItem("fishtank_save", JSON.stringify({ level: G.level, best: Math.max(G.best, G.level), settings: G.settings, prog: G.prog })); } catch (e) { /* private mode */ } }
const stat = (n) => n === "tank" ? Math.max(G.best, G.level) : (G.prog[n] || 0);
const wallMet = (k) => D.shop[k].wall.conds.every(([s, g]) => stat(s) >= g);
const isUnlocked = (k) => { if (G.dbg.unlock) return true; const it = D.shop[k]; if (it.wall) return G.prog.unlocked.includes(k); return it.lvl <= G.level; };
const upOk = (k) => G.dbg.unlock || G.level >= (D.stageUnlock[k] || 1);
function bump(n, v) { G.prog[n] = (G.prog[n] || 0) + (v == null ? 1 : v); checkUnlocks(); }
const announced = new Set();
function checkUnlocks() {
  for (const k of D.order) { const w = D.shop[k].wall; if (w && !G.prog.unlocked.includes(k) && !announced.has(k) && wallMet(k)) { announced.add(k); if (G.state === "play") say("Challenge complete: " + D.shop[k].name + "! Finish this tank to catch it."); } }
}
function grantUnlocks() { const got = D.order.filter((k) => D.shop[k].wall && !G.prog.unlocked.includes(k) && wallMet(k)); G.prog.unlocked.push(...got); if (got.length) save(); return got; }

let T = null;      // current tank
function say(t) { if (T) { T.msg = t; T.msg_t = 3.5; } }
function newTank() {
  const L = G.level;
  T = { cash: 150, pellets: [], coins: [], floaters: [], fx: [], fish: [], eggs: 0, foodL: 0, qualL: 0, weapL: 0, auto: false, autoEvo: false, auto_t: 0, evo_t: 0, rain: 0, boss: null,
    boss_clock: L >= 3 ? Math.max(20, 50 - 4 * L) : 1e9, t: 0, msg: "", msg_t: 0, bubbles: [] };
  T.fish.push(makeFish("guppy", null, null, 0, null, false), makeFish("guppy", null, null, 0, null, false));
  G.state = "play"; G.paused = false;
  const nw = D.order.filter((k) => D.shop[k].lvl === L && L > 1);
  say(nw.length ? "Tank " + stageLabel(L) + " - NEW: " + nw.map((k) => D.shop[k].name).join(", ") + "!" : "Tank " + stageLabel(L) + " - buy the 3 egg pieces!");
  T.msg_t = 6;
  document.getElementById("bg").style.backgroundImage = "url(env/tank_" + D.themes[(L - 1) % D.themes.length] + ".jpg)";
  checkUnlocks(); buildShop(); closeModal();
}
function eggCost() { const L = G.level; return Math.floor(D.eggCosts[T.eggs] * (1 + 0.3 * Math.min(L - 1, 9) + 0.15 * Math.max(0, L - 10))); }
const alive = () => T.fish.filter((f) => !f.isDead && f.kind !== "boss");

function rollTier(f) {
  f.tier = wchoice(D.shinyTierWeights.map((a) => a[0]), D.shinyTierWeights.map((a) => a[1]));
}
function makeFish(kind, x, y, stage, sp, shiny) {
  if (shiny == null) shiny = G.dbg.shiny || (G.settings.shiny && R() < 0.06);
  const f = newE(kind, x, y, stage, sp || defaultSp(kind));
  if (shiny && D.shinyAbility[kind]) {
    f.shiny = true; rollTier(f); bump("shinies");
    const [nm, tx] = D.shinyAbility[kind];
    const tn = f.tier ? D.shinyTiers[f.tier][0] : "";
    say("✨ " + (tn ? tn + " " : "") + "Shiny " + cap(f.sp) + "! " + nm + ": " + tx);
    T.floaters.push([f.x, f.y - 30, tn ? "✨ " + tn.toUpperCase() + " FORM!" : "✨ SHINY!", ["#fff27a", "#8dffb0", "#ffb347", "#c28bff"][f.tier], 1.8]);
  }
  return f;
}
const SPECIES_OF_KIND = { guppy: "magikarp", breeder: "seaking", carn: "gyarados", remo: "remoraid", relic: "relicanth", shark: "sharpedo", wailord: "wailord", milotic: "milotic", luv: "luvdisc",
  clam: "cloyster", coral: "corsola", mantine: "mantine", hunt: "clamperl", star: "starmie", healer: "alomomola", sea: "horsea", poison: "tentacruel", psy: "psyduck", slow: "slowpoke", azu: "azumarill",
  dew: "dewgong", craw: "crawdaunt", lumi: "lumineon", lap: "lapras", toad: "politoed", mon: "magikarp", wig: "wiglett", gun: "vaporeon", mom: "azumarill", bird: "wingull", dig: "wooper", quake: "tympole", venom: "mareanie" };
const defaultSp = (k) => SPECIES_OF_KIND[k] || "magikarp";
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------------------------------------ coins, fx, collect
function addFx(name, cells, x, y, dur, size, tx, ty, delay, loop) {
  if (!G.settings.fx) return;
  T.fx.push({ name, cells, x, y, tx: tx == null ? null : tx, ty, dur, size, t: -(delay || 0), loop: !!loop });
}
let curTier = 0;
function dropCoin(x, y, kind, dbl) {
  if (curTier >= 3) T.coins.push({ x: x + rnd(-18, 18), y, kind, age: 0 });
  const co = { x, y, kind, age: 0 };
  const corals = T.fish.reduce((a, f) => a + (f.kind === "coral" && !f.isDead ? (f.shiny ? 2 : 1) : 0), 0);
  if (dbl || curTier >= 2 || (corals && R() < Math.min(0.6, 0.2 * corals))) co.x2 = true;
  T.coins.push(co);
}
function collect(co) {
  const i = T.coins.indexOf(co); if (i < 0) return;
  const val = COINV[co.kind] * (co.x2 ? 2 : 1) * (T.rain > 0 ? 2 : 1);
  T.cash += val; bump("coins", val); SND.coin();
  T.floaters.push([co.x, co.y, "+" + val, "#ffe27a", 1]);
  T.coins.splice(i, 1);
}
const shieldChance = () => Math.min(0.8, T.fish.reduce((a, f) => a + (f.kind === "dew" && !f.isDead ? (f.shiny ? 0.7 : 0.4) : 0), 0));
const growthBonus = () => Math.min(3, T.fish.reduce((a, f) => a + (f.kind === "azu" && !f.isDead ? (f.shiny ? 2 : 1) : 0), 0));
function coinAgeRate() { let r = 1; for (const f of T.fish) if (f.kind === "lumi" && !f.isDead) r *= f.shiny ? 0.33 : 0.5; return Math.max(0.15, r); }
const kill = (f) => { if (f.isDead || G.dbg.god) return; f.isDead = true; f.dead = 9; };

// ------------------------------------------------------------------------------------------------ evolution
const EVO_TIME = 60;
const evoOptions = (f) => [D.evolutions[f.sp]].concat(D.altEvolutions[f.sp] || []).filter(Boolean);
const canEvolve = (f) => f.kind !== "boss" && !f.isDead && f.phase === "swim" && D.evolutions[f.sp] && f.age >= EVO_TIME && (f.kind !== "guppy" || f.stage >= 2);
function applyEvolution(f, idx) {
  const [ev, nk] = evoOptions(f)[idx || 0];
  f.sp = ev;
  if (nk) { f.kind = nk; f.hunger = 100; f.coin_t = rnd(5, 10); f.spawn_t = rnd(10, 18); }
  f.evolved = true; bump("evolved"); SND.evolve(); f.age = 0; f.cool = 0;
  addFx("heal", [9, 8, 7, 6, 5], f.x, f.y, 0.9, 140);
  T.floaters.push([f.x, f.y - 30, "✦ evolved into " + cap(ev) + "!", "#ffe27a", 1.8]);
}
function evolve(f, idx) {
  const cost = evoOptions(f)[idx || 0][2];
  if (T.cash < cost) { say("Evolving " + cap(f.sp) + " costs $" + cost); return; }
  T.cash -= cost; applyEvolution(f, idx || 0); refreshShop();
}

// ------------------------------------------------------------------------------------------------ boss
function spawnBoss(variant) {
  if (T.boss) return;
  const bs = D.bosses;
  if (!variant) {
    const al = alive(), ground = al.filter((o) => GROUND.has(o.sp) && !LEGENDS.has(o.sp)), share = ground.length / Math.max(1, al.length);
    const fp = D.floorRaiders.filter((v) => bs[v][1] <= G.level);
    if (fp.length && ground.length >= 3 && R() < Math.min(0.75, share * 1.2)) variant = pick(fp);
    else { const pool = Object.keys(bs).filter((v) => bs[v][1] <= G.level && !FLOOR.has(v)); if (!pool.length) pool.push("gyarados"); variant = pick(pool.concat(["gyarados"])); }
  }
  const d = bs[variant];
  const y = (variant === "kingler" || variant === "dragalge" || FLOOR.has(variant)) ? SAND_Y - 20 : rnd(TOP, BOT);
  const b = newE("boss", pick([40, W - 40]), y, 0, null, variant);
  b.maxhp = b.hp = d[2] + d[3] * G.level; b.cool = 3;
  T.boss = b; T.fish.push(b);
  if (!G.prog.seen.includes(variant)) { G.prog.seen.push(variant); save(); }
  say(d[7]); SND.alarm();
}
function hitBoss(dmg) {
  const b = T.boss; if (!b) return;
  b.hp -= dmg * (D.tierDamage[curTier] || 1); b.shake = 0.15;
  if (b.hp <= 0) {
    T.floaters.push([b.x, b.y, "DEFEATED!", "#ffd34d", 1.8]); SND.slam();
    if (!G.prog.beaten.includes(b.variant)) G.prog.beaten.push(b.variant);
    bump("raiders");
    addFx("hit", [0], b.x, b.y, 0.5, 140);
    for (const co of b.loot) T.coins.push({ ...co, x: b.x + rnd(-40, 40), y: b.y, age: 0 });
    for (let i = 0; i < 3; i++) T.coins.push({ x: b.x + rnd(-30, 30), y: b.y, kind: "trophy", age: 0 });
    T.fish.splice(T.fish.indexOf(b), 1); T.boss = null; T.boss_clock = 55 + rnd(0, 15);
    say(D.bosses[b.variant][6] + (b.variant === "wailmer" ? " burst!" : " is gone!"));
  }
}

// ------------------------------------------------------------------------------------------------ movement
function move(f, dt, boost) {
  boost = boost || 1;
  if (STILL.has(f.sp) && f.kind !== "boss") return 0;
  if (GROUND.has(f.sp) && f.kind !== "boss" && f.phase === "swim") f.ty = SAND_Y - 16;
  const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
  if (d > 4) { const v = (D.speed[f.kind] || 50) * boost, st = Math.min(v * dt, d); f.x += dx / d * st; f.y += dy / d * st; if (Math.abs(dx) > 4) f.right = dx > 0; }
  f.y = Math.max(TOP - 30, Math.min(SAND_Y - 12, f.y)); f.x = Math.max(25, Math.min(W - 25, f.x));
  return d;
}
function wander(f, dt, ylo, yhi, boost) {
  if (f.mode === "idle") { f.timer -= dt; if (f.timer <= 0) { f.tx = rnd(50, W - 50); f.ty = rnd(ylo == null ? TOP : ylo, yhi == null ? BOT : yhi); f.mode = "swim"; } }
  else if (move(f, dt, boost) <= 6) { f.mode = "idle"; f.timer = rnd(0.5, 3); }
}
const near = (lst, p) => lst.reduce((a, b) => (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a));

// ------------------------------------------------------------------------------------------------ per-fish update
function animate(f, dt, anim) {
  const a = pickAnim(f.sp, anim); if (!a) return;
  const m = SP[f.sp][a]; f.anim = a;
  f.ftime += dt * 60; f.frame %= m.n;
  while (f.ftime >= Math.max(1, m.d[f.frame])) { f.ftime -= Math.max(1, m.d[f.frame]); f.frame = (f.frame + 1) % m.n; }
}
function updateFish(f, dt) {
  f.shake = Math.max(0, f.shake - dt); f.shoot = Math.max(0, f.shoot - dt); f.atk = Math.max(0, f.atk - dt);
  if (f.isDead) { f.dead -= dt; f.y = Math.max(TOP - 18, f.y - 24 * dt); if (f.dead <= 0) T.fish.splice(T.fish.indexOf(f), 1); animate(f, dt, "Idle"); return; }
  const k = f.kind;
  if (k !== "boss") f.age += dt;
  if (GROUND.has(f.sp) && k !== "boss" && f.phase === "swim" && !f.held) f.y = SAND_Y - 16;
  if (f.shiny) { f.spark -= dt; if (f.spark <= 0) { f.spark = rnd(2.5, 4.5); addFx("love", [6], f.x + rnd(-20, 20), f.y + rnd(-20, 20), 0.5, 42); } }
  let anim = f.mode === "swim" ? "Walk" : "Idle";
  const tm = f.shiny ? [1, 1.3, 1.7, 2.2][f.tier] : 1;
  curTier = f.shiny ? f.tier : 0;
  if (k === "boss") updateBoss(f, dt);
  else if (isPet(f)) { if (LEGENDS.has(f.sp) && legendFlight(f, dt)) { /* busy */ } else updatePet(f, dt * (f.evolved ? 1.25 : 1) * tm); }
  else updateEater(f, dt * tm);
  curTier = 0;
  if (f.shoot > 0) anim = "Attack"; else if (f.atk > 0) anim = "Attack";
  animate(f, dt, anim);
}

function updateEater(f, dt) {
  const k = f.kind, sh = f.shiny; let calm = 1;
  if (k === "guppy" && T.fish.some((o) => o.sp === "tympole" && o !== f && !o.isDead && dist(o, f) < 150)) calm = 0.8;
  if (f.sp === "poliwag" && T.boss && dist(T.boss, f) < 150) T.boss.slow = Math.max(T.boss.slow, 0.8);
  f.hunger -= dt * D.hungerRate[k] * calm * (sh && (k === "carn" || k === "shark" || k === "wailord") ? 0.6 : 1);
  if (G.dbg.god) f.hunger = 100;
  if (f.hunger <= 0) { kill(f); return; }
  const hungry = f.hunger < D.hungryAt[k];
  let target = null;
  if (hungry) {
    let prey = [];
    if (k === "carn") prey = T.fish.filter((o) => o.kind === "guppy" && o.stage === 0 && !o.isDead);
    else if (k === "shark") prey = T.fish.filter((o) => o.kind === "guppy" && o.stage <= 1 && !o.isDead);
    else if (k === "wailord" && !T.pellets.length) prey = T.fish.filter((o) => ["guppy", "breeder", "carn", "shark"].includes(o.kind) && !o.isDead);
    if (prey.length) target = near(prey, f);
    else if (k !== "carn" && k !== "shark" && T.pellets.length) target = near(T.pellets, f);
  }
  if (target) {
    const tx = target.x, ty = target.y;
    f.tx = tx; f.ty = Math.min(ty, SAND_Y - 14); f.mode = "swim";
    move(f, dt, 1.7 * (sh && k === "shark" ? 1.4 : 1));
    const gap = (GROUND.has(f.sp) && f.y - ty < 120) ? Math.abs(tx - f.x) : Math.hypot(tx - f.x, ty - f.y);
    if (gap < (D.reach[k] || 26)) {
      f.atk = 0.5;
      if (target.kind) { addFx("bite", [0, 1, 2, 3, 4], tx, ty, 0.5, 70); T.fish.splice(T.fish.indexOf(target), 1); }
      else T.pellets.splice(T.pellets.indexOf(target), 1);
      f.hunger = 100;
      if (k === "guppy") {
        f.growth += 1 + T.qualL + growthBonus() + (f.sp === "spheal" ? 1 : 0);
        if (f.stage < 2 && f.growth >= D.growNeed[f.stage]) {
          f.stage++; f.growth = 0; T.floaters.push([f.x, f.y - 30, "grew!", "#a6ffcb", 1.2]);
          if (f.stage === 2) { bump("grown"); if (f.sp === "magikarp") { for (const o of T.fish) if (o !== f && o.kind === "guppy" && !o.isDead) o.growth += 3; addFx("water", [1, 2, 3], f.x, f.y, 0.6, 120); T.floaters.push([f.x, f.y - 50, "Splash! babies grow", "#9ee6ff", 1.4]); } }
        }
      }
    }
  } else wander(f, dt);
  // production
  if (k === "guppy" && f.stage >= 1) {
    f.coin_t -= dt;
    if (f.coin_t <= 0) {
      f.coin_t = f.sp === "azurill" ? rnd(4, 6) : rnd(8, 12);
      let ck = f.stage === 1 ? "silver" : "gold"; if (f.sp === "feebas" && R() < 0.15) ck = "pearl";
      dropCoin(f.x, f.y, ck, sh || (f.sp === "goldeen" && R() < 0.1));
    }
  } else if (k === "carn") { f.coin_t -= dt; if (f.coin_t <= 0) { f.coin_t = rnd(11, 15); dropCoin(f.x, f.y, "diamond", sh); } }
  else if (k === "shark") { f.coin_t -= dt; if (f.coin_t <= 0) { f.coin_t = sh ? rnd(6, 8) : rnd(9, 13); dropCoin(f.x, f.y, "diamond"); } }
  else if (k === "wailord" && f.hunger > 30) { f.coin_t -= dt; if (f.coin_t <= 0) { f.coin_t = sh ? rnd(10, 14) : rnd(18, 24); dropCoin(f.x, f.y, "treasure"); } }
  else if ((k === "breeder" || k === "milotic" || k === "mom") && f.hunger > 40) {
    f.spawn_t -= dt;
    if (f.spawn_t <= 0) {
      f.spawn_t = k === "breeder" ? rnd(16, 22) : k === "mom" ? (sh ? rnd(13, 17) : rnd(18, 26)) : (sh ? rnd(8, 10) : rnd(14, 18));
      for (let i = 0; i < ((sh && (k === "breeder" || k === "mom")) ? 2 : 1); i++) {
        if (alive().length < MAX_FISH) {
          const nm = k === "breeder" ? "goldeen" : k === "milotic" ? "feebas" : (D.momBaby[f.sp] || "magikarp");
          T.fish.push(makeFish("guppy", f.x, f.y, 0, nm, !!(sh && k === "milotic" && R() < 0.5)));
          T.floaters.push([f.x, f.y - 30, "a baby " + cap(nm) + "!", "#ffc6e0", 1.2]); bump("births");
        }
      }
    }
  }
}

function bossRanged(f, dt, keep, rng, cd, fire) {
  const b = T.boss; if (!b) { wander(f, dt); return; }
  f.tx = b.x + (f.x < b.x ? -keep : keep); f.ty = b.y; f.mode = "swim";
  const reach = GROUND.has(f.sp) ? Math.abs(b.x - f.x) : Math.hypot(b.x - f.x, b.y - f.y);
  if (reach < rng) { f.mode = "idle"; f.right = b.x > f.x; f.cool -= dt; if (f.cool <= 0) { f.cool = cd; f.shoot = 0.4; fire(b); } }
  else move(f, dt);
}

function updatePet(f, dt) {
  const k = f.kind, b = T.boss, sh = f.shiny, wk = Math.floor(T.weapL / 2);
  switch (k) {
    case "relic": f.coin_t -= dt; if (f.coin_t <= 0) { f.coin_t = sh ? 25 : 60; dropCoin(f.x, f.y, "pearl"); } wander(f, dt); break;
    case "remo":
      if (b) bossRanged(f, dt, 140, 220, sh ? 0.6 : 1.2, (bb) => { addFx("water", [9], f.x, f.y, 0.25, 36, bb.x, bb.y); addFx("water", [1, 2, 3], bb.x, bb.y, 0.35, 64, null, null, 0.25); hitBoss(1 + wk + (sh ? 1 : 0)); });
      else if (T.coins.length) { const co = near(T.coins, f); f.tx = co.x; f.ty = co.y; f.mode = "swim"; if (move(f, dt, sh ? 2.8 : 1.4) < 24) collect(co); }
      else wander(f, dt);
      break;
    case "clam": f.coin_t -= dt; if (f.coin_t <= 0) { f.coin_t = sh ? rnd(10, 14) : rnd(24, 30); f.atk = 0.5; dropCoin(f.x, f.y, "spearl"); } wander(f, dt, SAND_Y - 60, SAND_Y - 14); break;
    case "coral": wander(f, dt, SAND_Y - 90, SAND_Y - 14); break;
    case "luv":
      f.spawn_t -= dt;
      if (f.spawn_t <= 0) { f.spawn_t = sh ? rnd(10, 14) : rnd(20, 28); if (alive().length < MAX_FISH) { T.fish.push(makeFish("guppy", f.x, f.y, 0, "magikarp", false)); addFx("love", [3, 4, 5, 5], f.x, f.y - 24, 0.9, 48); T.floaters.push([f.x, f.y - 30, "a baby Magikarp!", "#ffc6e0", 1.2]); bump("births"); } }
      wander(f, dt); break;
    case "mantine": {
      f.coin_t -= dt;
      const hungry = alive().filter((o) => ["guppy", "breeder", "milotic", "mom"].includes(o.kind) && o.hunger < 55);
      if (f.coin_t <= 0 && hungry.length && (sh || T.pellets.length < 1 + T.foodL)) { f.coin_t = sh ? 1.5 : 3.5; f.atk = 0.4; const t = pick(hungry); T.pellets.push({ x: Math.max(30, Math.min(W - 30, t.x + rnd(-40, 40))), y: f.y, vy: 0, life: 7 }); T.floaters.push([f.x, f.y - 20, "free food", "#c9e8a0", 1]); }
      wander(f, dt, TOP - 10, TOP + 70); break;
    }
    case "hunt":
      if (b) { f.tx = b.x; f.ty = b.y; f.mode = "swim"; const d = move(f, dt, 1.5); f.cool -= dt; if (d < 50 && f.cool <= 0) { f.cool = sh ? 0.65 : 1.3; f.atk = 0.4; addFx("bite", [0, 1, 2, 3, 4], b.x + rnd(-15, 15), b.y + rnd(-15, 15), 0.45, 70); hitBoss(((f.evolved ? 3 : 1) + wk) * (sh ? 2 : 1)); } }
      else wander(f, dt); break;
    case "star": {
      const fl = T.coins.filter((c) => c.y >= SAND_Y - 30 || (sh && Math.hypot(c.x - f.x, c.y - f.y) < 260));
      if (fl.length) { const co = near(fl, f); f.tx = co.x; f.ty = co.y; f.mode = "swim"; if (move(f, dt, 1.4) < 24) collect(co); } else wander(f, dt); break;
    }
    case "healer":
      f.coin_t -= dt;
      for (const o of alive()) if (!isPet(o) && EATERS.has(o.kind) && dist(o, f) < (sh ? 280 : 160)) o.hunger = Math.min(100, o.hunger + (sh ? 9 : 4.5) * dt);
      if (f.coin_t <= 0) { f.coin_t = 3; addFx("heal", [9, 8, 7, 6, 5], f.x, f.y, 0.9, sh ? 300 : 180); }
      wander(f, dt); break;
    case "sea":
      bossRanged(f, dt, 190, 280, 2.6, (bb) => { addFx("pulse", [0], f.x, f.y, 0.35, 56, bb.x, bb.y); addFx("pulse", [1, 2, 3, 4], bb.x, bb.y, 0.5, 70, null, null, 0.35); bb.slow = sh ? 7 : 3.5; if (f.evolved || sh) hitBoss(2 + wk); }); break;
    case "poison":
      bossRanged(f, dt, 170, 230, sh ? 3.5 : 6.5, (bb) => { addFx("sludge", [0, 1, 2, 3], f.x, f.y, 0.45, 50, bb.x, bb.y, 0, true); addFx("jab", [0, 1], bb.x, bb.y, 0.4, 80, null, null, 0.45); bb.poison = sh ? 16 : 8; bb.ptick = 0; T.floaters.push([bb.x, bb.y - 30, "poisoned!", "#d28bff", 1.2]); }); break;
    case "psy": f.coin_t -= dt; if (f.coin_t <= 0) { f.coin_t = sh ? rnd(5, 8) : rnd(7, 11); f.atk = 0.5; dropCoin(f.x, f.y, wchoice(["silver", "gold", "diamond", "pearl", "spearl"], sh ? [10, 25, 35, 20, 10] : [40, 35, 15, 5, 5])); } wander(f, dt); break;
    case "slow": f.coin_t -= dt; if (f.coin_t <= 0) { f.coin_t = sh ? 5 : 9; dropCoin(f.x, f.y, "gold"); } wander(f, dt); break;
    case "craw":
      f.coin_t -= dt;
      if (f.coin_t <= 0) {
        f.coin_t = sh ? 5 : 10;
        let pool = T.coins.filter((c) => c.kind === "silver"); if (!pool.length && sh) pool = T.coins.filter((c) => c.kind === "gold");
        if (pool.length) { const co = pick(pool); co.kind = co.kind === "silver" ? "gold" : "diamond"; f.atk = 0.5; addFx("hit", [0], co.x, co.y, 0.3, 56); T.floaters.push([co.x, co.y - 20, "upgraded!", "#ffe27a", 1]); }
      }
      wander(f, dt); break;
    case "lap":
      f.coin_t -= dt;
      if (f.coin_t <= 0 && T.coins.length) { f.coin_t = sh ? 12 : 25; f.atk = 0.6; addFx("water", [1, 2, 3], f.x, f.y, 0.7, 220); T.floaters.push([f.x, f.y - 30, "COIN SURF!", "#9ee6ff", 1.2]); for (const co of T.coins.slice()) collect(co); }
      wander(f, dt); break;
    case "toad":
      f.coin_t -= dt;
      if (f.coin_t <= 0) { f.coin_t = sh ? 25 : 45; T.rain = sh ? 14 : 10; f.atk = 0.6; addFx("water", [1, 2, 3], f.x, f.y, 0.8, 260); say("Rain dance! Coins pay double for " + T.rain + " seconds!"); }
      wander(f, dt); break;
    case "dig":
      f.coin_t -= dt;
      if (f.coin_t <= 0) { f.coin_t = sh ? 6 : 11; f.atk = 0.5; dropCoin(f.x, f.y - 10, wchoice(["gold", "pearl", "diamond", "spearl"], sh ? [20, 30, 40, 10] : [55, 20, 10, 15])); T.floaters.push([f.x, f.y - 30, "dug up treasure!", "#e0c070", 1]); }
      wander(f, dt); break;
    case "quake":
      f.coin_t -= dt;
      if (f.coin_t <= 0) { if (b) { f.coin_t = sh ? 12 : 22; f.atk = 0.6; addFx("hit", [0], f.x, f.y, 0.5, 150); b.slow = 4; b.shake = 0.4; T.floaters.push([b.x, b.y - 30, "QUAKE!", "#e0c070", 1.2]); hitBoss((sh ? 2 : 1) + wk); } else f.coin_t = 2; }
      wander(f, dt); break;
    case "venom":
      f.coin_t -= dt;
      if (f.coin_t <= 0) { if (b) { f.coin_t = sh ? 10 : 14; f.atk = 0.5; addFx("sludge", [0, 1, 2, 3], f.x, f.y, 0.5, 60, b.x, b.y, 0, true); b.poison = sh ? 12 : 6; b.ptick = 0; T.floaters.push([b.x, b.y - 30, "poisoned!", "#d28bff", 1.2]); } else f.coin_t = 2; }
      wander(f, dt); break;
    case "bird": {
      const ph = f.phase;
      if (ph === "swim") { f.coin_t -= dt; wander(f, dt); if (f.coin_t <= 0) f.phase = "up"; }
      else if (ph === "up") { f.y -= 190 * dt; f.right = true; if (f.y < -70) { f.phase = "gone"; f.coin_t = sh ? rnd(3, 5) : rnd(6, 10); } }
      else if (ph === "gone") { f.coin_t -= dt; if (f.coin_t <= 0) { f.phase = "down"; f.x = rnd(70, W - 70); f.y = -70; f.tx = f.x; f.ty = rnd(TOP, BOT); } }
      else {
        f.y += 190 * dt;
        if (f.y >= f.ty) { f.atk = 0.5; dropCoin(f.x, f.y, wchoice(["silver", "gold", "diamond", "pearl", "spearl"], sh ? [20, 30, 30, 12, 8] : [45, 35, 12, 5, 3])); addFx("water", [1, 2, 3], f.x, f.y, 0.5, 80); T.floaters.push([f.x, f.y - 30, "brought something!", "#ffe27a", 1.2]); bump("birds"); f.phase = "swim"; f.mode = "idle"; f.timer = 1; f.coin_t = sh ? rnd(9, 14) : rnd(14, 22); }
      }
      break;
    }
    case "wig": {                              // stands still half-buried in the sand
      f.mode = "idle"; f.y = SAND_Y - 16; f.cool -= dt; f.coin_t -= dt; const reach = sh ? 150 : 100;
      if (b) f.right = b.x > f.x;
      if (f.cool <= 0) { const nr = T.coins.filter((c) => c.y > SAND_Y - 120 && Math.abs(c.x - f.x) < reach); if (nr.length) { const co = nr.reduce((a, c) => (Math.abs(c.x - f.x) < Math.abs(a.x - f.x) ? c : a)); f.cool = sh ? 0.8 : 1.6; f.atk = 0.4; addFx("hit", [0], co.x, co.y, 0.3, 46); T.floaters.push([f.x, f.y - 30, "snap!", "#e0c070", 0.8]); collect(co); } }
      if (b && f.coin_t <= 0 && Math.abs(b.x - f.x) < reach * 1.2 && b.y > SAND_Y - 170) { f.coin_t = 4; f.atk = 0.6; b.slow = Math.max(b.slow, sh ? 5 : 2.5); b.shake = 0.3; addFx("hit", [0], b.x, b.y, 0.4, 100); T.floaters.push([b.x, b.y - 30, "AMBUSH!", "#e0c070", 1.1]); hitBoss(2 + wk); }
      break;
    }
    case "gun": {
      const g = D.gun[f.sp] || D.gun.vaporeon;
      bossRanged(f, dt, 150, 260, sh ? 0.7 : 1.4, (bb) => { addFx(g[0], g[1], f.x, f.y, 0.3, 44, bb.x, bb.y); addFx(g[2], g[3], bb.x, bb.y, 0.4, 70, null, null, 0.3); T.floaters.push([f.x, f.y - 26, g[4] + "!", "#9ee6ff", 0.9]); hitBoss(2 + wk + (sh ? 2 : 0)); });
      break;
    }
    default: wander(f, dt);
  }
}

// ------------------------------------------------------------------------------------------------ legendaries
function legendFlight(f, dt) {
  if (GRAB.has(f.sp)) return legendGrab(f, dt);
  const b = T.boss, ph = f.phase;
  if (ph === "swim") { f.fly_t -= dt * (b ? 2 : 1); if (f.fly_t <= 0) f.phase = "up"; return false; }
  if (ph === "up") { f.y -= 240 * dt; if (f.y < -90) { f.phase = "gone"; f.fly_t = rnd(2, 3.5); } return true; }
  if (ph === "gone") { f.fly_t -= dt; if (f.fly_t <= 0) { f.phase = "down"; f.x = Math.max(40, Math.min(W - 40, b ? b.x : rnd(80, W - 80))); f.y = -90; f.ty = b ? b.y : rnd(TOP, BOT); } return true; }
  if (b) { f.x += (b.x - f.x) * Math.min(1, 3 * dt); f.ty = b.y; }
  f.y += 380 * dt;
  if (f.y >= f.ty) {
    if (b) { addFx("hit", [0], f.x, f.y, 0.5, 220); addFx("water", [1, 2, 3], f.x, f.y, 0.6, 200); T.floaters.push([f.x, f.y - 40, "SLAM!", "#ffe27a", 1.4]); SND.slam(); b.slow = 4; b.shake = 0.5; hitBoss(10 + 3 * T.weapL); }
    else { dropCoin(f.x, f.y, pick(["treasure", "diamond", "pearl"])); addFx("water", [1, 2, 3], f.x, f.y, 0.6, 140); T.floaters.push([f.x, f.y - 30, "brought something!", "#ffe27a", 1.2]); }
    f.phase = "swim"; f.mode = "idle"; f.timer = 1; f.fly_t = rnd(12, 20); f.atk = 0.5;
  }
  return true;
}
function legendGrab(f, dt) {
  const b = T.boss, ph = f.phase, floor = SAND_Y - 16, walker = f.sp === "suicune";
  if (!b) { if (ph !== "swim") { f.phase = "swim"; f.mode = "idle"; f.timer = 0.5; } return false; }
  if (ph === "swim") { f.fly_t -= dt * 2; if (f.fly_t <= 0) { f.phase = "run"; T.floaters.push([f.x, f.y - 40, "CHARGE!", "#9ee6ff", 1]); } return false; }
  f.mode = "swim";
  if (ph === "run") {
    const dx = b.x - f.x; f.right = dx > 0; const sp = walker ? 210 : 330; let close;
    if (walker) { f.x += Math.max(-sp * dt, Math.min(sp * dt, dx)); f.y = floor; close = Math.abs(dx) < 46; }
    else { const dy = b.y - f.y, d = Math.hypot(dx, dy); if (d > 1) { f.x += dx / d * Math.min(sp * dt, d); f.y += dy / d * Math.min(sp * dt, d); } close = d < 56; }
    if (close) f.phase = walker ? "leap" : "lift";
  } else if (ph === "leap") { f.y -= 560 * dt; f.x += (b.x - f.x) * Math.min(1, 8 * dt); if (f.y <= b.y + 14) f.phase = "lift"; }
  else if (ph === "lift") { b.held = true; f.atk = 0.3; f.y -= 250 * dt; b.x = f.x; b.y = f.y - 28; if (f.y < TOP + 34) { f.phase = "slam"; T.floaters.push([f.x, f.y + 40, "GRABBED!", "#ffe27a", 1.2]); } }
  else if (ph === "slam") {
    f.atk = 0.3; f.y += 620 * dt; b.x = f.x; b.y = f.y - 24;
    if (f.y >= floor) {
      f.y = floor; b.held = false; b.slow = 5; b.shake = 0.7;
      addFx("hit", [0], f.x, f.y, 0.6, 260); addFx("water", [1, 2, 3], f.x, f.y, 0.7, 240); T.floaters.push([f.x, f.y - 50, "SLAM!!!", "#ffe27a", 1.6]); SND.slam();
      f.phase = "swim"; f.mode = "idle"; f.timer = 1; f.fly_t = rnd(14, 20);
      hitBoss(Math.max(30, Math.floor(b.maxhp * 0.65)) + 6 * T.weapL);
    }
  }
  return true;
}

// ------------------------------------------------------------------------------------------------ raiders
function updateBoss(f, dt) {
  const v = f.variant, d = D.bosses[v];
  if (f.held) { f.shake = Math.max(f.shake, 0.05); return; }
  f.cool -= dt; f.slow = Math.max(0, f.slow - dt); f.born += dt;
  if (f.poison > 0) { f.poison -= dt; f.ptick += dt; if (f.ptick >= 1) { f.ptick -= 1; addFx("scald", [5, 6, 7, 8, 9], f.x, f.y, 0.6, 64); hitBoss(1 + Math.floor(T.weapL / 2)); if (T.boss !== f) return; } }
  const spd = d[4] * (1 + 0.04 * G.level) * (f.slow > 0 ? 0.45 : 1);
  const prey = alive().filter((o) => !isPet(o) && o.kind !== "wailord" && o.sp !== "wooper");
  const chomp = (tgt, cd) => {
    f.cool = cd; f.atk = 0.5; T.floaters.push([tgt.x, tgt.y, "CHOMP!", "#ff6b6b", 1]); addFx("bite", [5, 6, 7, 8, 9], tgt.x, tgt.y, 0.5, 80);
    if (R() < shieldChance()) T.floaters.push([tgt.x, tgt.y - 24, "BLOCKED!", "#9ee6ff", 1.2]); else kill(tgt);
  };
  const leave = (msg) => { say(msg); T.fish.splice(T.fish.indexOf(f), 1); T.boss = null; T.boss_clock = 45 + rnd(0, 15); };
  if (CHASERS.has(v)) {
    if (prey.length) { const t = near(prey, f); f.tx = t.x; f.ty = t.y; f.mode = "swim"; if (move(f, dt, spd) < (D.bossReach[v] || 38) && f.cool <= 0) chomp(t, D.bossCd[v] || 2.6); }
    else wander(f, dt, null, null, spd);
  } else if (FLOOR.has(v)) {
    const floor = SAND_Y - 18, gp = alive().filter((o) => GROUND.has(o.sp) && !LEGENDS.has(o.sp) && o.sp !== "wooper");
    f.ty = floor; f.mode = "swim";
    if (gp.length) { const t = near(gp, f); f.tx = t.x; move(f, dt, spd); if (Math.abs(t.x - f.x) < 46 && f.cool <= 0) chomp(t, D.bossCd[v] || 2.4); }
    else { if (Math.abs(f.tx - f.x) < 10 || f.timer <= 0) { f.tx = rnd(60, W - 60); f.timer = 4; } f.timer -= dt; move(f, dt, spd * 0.8); }
  } else if (v === "wailmer") {
    f.fuse -= dt; if (f.fuse < 4) f.shake = 0.12; wander(f, dt, null, null, spd * 1.6);
    if (f.fuse <= 0) { T.floaters.push([f.x, f.y, "BURST!", "#ff6b6b", 1.4]); addFx("water", [1, 2, 3], f.x, f.y, 0.7, 300); for (const o of alive()) if (o.kind !== "wailord" && dist(o, f) < 170) kill(o); T.fish.splice(T.fish.indexOf(f), 1); T.boss = null; T.boss_clock = 45 + rnd(0, 15); }
  } else if (v === "octillery") {
    f.vis = (f.born % 4) < 2.6;
    if (f.born > 28 || f.loot.length >= 4) {
      const gone = f.x < W / 2; f.tx = gone ? -50 : W + 50; f.ty = f.y; f.mode = "swim"; move(f, dt, spd * 1.3); f.x = Math.max(-60, Math.min(W + 60, f.x + (gone ? -1 : 1) * 30 * dt));
      if (f.x < 28 || f.x > W - 28) { const got = f.loot.reduce((a, c) => a + COINV[c.kind], 0); leave(got ? "Octillery got away with $" + got + "!" : "Octillery left empty-handed."); }
    } else if (T.coins.length) {
      const co = near(T.coins, f); f.tx = co.x; f.ty = co.y; f.mode = "swim";
      if (move(f, dt, spd * 1.5) < 32 && f.vis) { T.coins.splice(T.coins.indexOf(co), 1); f.loot.push(co); f.atk = 0.4; addFx("scald", [5, 6, 7, 8, 9], co.x, co.y, 0.6, 60); T.floaters.push([co.x, co.y, "-$" + COINV[co.kind], "#d28bff", 1]); }
    } else wander(f, dt, null, null, spd);
  } else if (v === "kyogre") {
    if (prey.length) { const t = near(prey, f); f.tx = t.x; f.ty = t.y; f.mode = "swim"; move(f, dt, spd); } else wander(f, dt, null, null, spd);
    for (const o of prey) if (dist(o, f) < 170) o.hunger -= 7 * dt;
    f.coin_t -= dt; if (f.coin_t <= 0) { f.coin_t = 0.7; addFx("water", [1, 2, 3], f.x + rnd(-90, 90), f.y + rnd(-70, 70), 0.7, 90); }
  } else if (v === "jellicent") {
    wander(f, dt, null, null, spd); T.cash = Math.max(0, T.cash - 4 * dt);
    f.coin_t -= dt; if (f.coin_t <= 0) { f.coin_t = 0.9; addFx("scald", [5, 6, 7, 8, 9], f.x + rnd(-40, 40), f.y + rnd(-30, 30), 0.7, 70); T.floaters.push([f.x, f.y - 30, "-$", "#d28bff", 0.9]); }
  } else if (v === "dragalge") {
    const floor = SAND_Y - 20;
    if (f.mode !== "swim" || Math.abs(f.tx - f.x) < 10) { f.tx = rnd(60, W - 60); f.ty = floor; f.mode = "swim"; }
    move(f, dt, spd);
    for (const o of prey) if (o.y > SAND_Y - 140 && Math.abs(o.x - f.x) < 220) o.hunger -= 6 * dt;
    f.coin_t -= dt; if (f.coin_t <= 0) { f.coin_t = 0.7; addFx("scald", [5, 6, 7, 8, 9], f.x + rnd(-80, 80), floor - 20, 0.7, 80); }
  } else if (v === "kingler") {
    const floor = SAND_Y - 18, coins = T.coins.filter((c) => c.y >= SAND_Y - 30), low = prey.filter((o) => o.y > SAND_Y - 100);
    let tgt = null, tx, ty = floor;
    if (coins.length) { tgt = near(coins, f); tx = tgt.x; } else if (low.length) { tgt = near(low, f); tx = tgt.x; } else tx = f.mode === "swim" ? f.tx : rnd(60, W - 60);
    f.tx = tx; f.ty = ty; f.mode = "swim"; const dd = move(f, dt, spd);
    if (!tgt) { if (dd < 8) f.tx = rnd(60, W - 60); }
    else if (Math.abs(tx - f.x) < 36) {
      if (tgt.kind in COINV) { if (T.coins.includes(tgt)) { T.coins.splice(T.coins.indexOf(tgt), 1); addFx("hit", [0], tgt.x, tgt.y, 0.3, 60); T.floaters.push([tgt.x, tgt.y, "snip!", "#ff9b6b", 1]); } }
      else if (f.cool <= 0) { f.cool = 3; f.atk = 0.5; T.floaters.push([tgt.x, tgt.y, "PINCH!", "#ff6b6b", 1]); addFx("hit", [0], tgt.x, tgt.y, 0.3, 70); kill(tgt); }
    }
  }
}

// ------------------------------------------------------------------------------------------------ tank update
function update(dt) {
  if (G.state !== "play" || G.paused || !T) return;
  if (G.dbg.cash) T.cash = Math.max(T.cash, 99999);
  T.t += dt; T.rain = Math.max(0, T.rain - dt); if (T.msg_t > 0) T.msg_t -= dt;
  if (!T.boss && G.settings.boss) { T.boss_clock -= dt; if (T.boss_clock <= 0) spawnBoss(); }
  if (G.settings.sound !== false && R() < dt * 0.9 && false) beep(200, 0.05);
  if (R() < dt * 3) T.bubbles.push({ x: pick([0.03, 0.085, 0.14, 0.33, 0.47, 0.6, 0.885, 0.94]) * W + rnd(-14, 14), y: SAND_Y, r: rnd(2, 6), sp: rnd(30, 70) });
  for (const b of T.bubbles) { b.y -= b.sp * dt; b.x += Math.sin(b.y / 14) * 12 * dt; }
  T.bubbles = T.bubbles.filter((b) => b.y > 0);
  if (T.auto) {
    T.auto_t -= dt;
    const hungry = alive().filter((f) => !isPet(f) && ["guppy", "breeder", "milotic", "mom"].includes(f.kind) && f.hunger < 55);
    if (T.auto_t <= 0 && hungry.length && T.cash >= FOOD_COST && T.pellets.length < 1 + T.foodL) { T.auto_t = 4; T.cash -= FOOD_COST; const f = pick(hungry); T.pellets.push({ x: Math.max(30, Math.min(W - 30, f.x + rnd(-40, 40))), y: 25, vy: 0, life: 7 }); }
  }
  if (T.autoEvo) {
    T.evo_t -= dt;
    if (T.evo_t <= 0) { T.evo_t = 1; const rd = T.fish.filter((f) => canEvolve(f) && T.cash >= D.evolutions[f.sp][2]).sort((a, b) => D.evolutions[a.sp][2] - D.evolutions[b.sp][2]); if (rd.length) evolve(rd[0], Math.floor(R() * evoOptions(rd[0]).length)); }
  }
  for (const p of T.pellets.slice()) { p.vy = Math.min(45, p.vy + 60 * dt); p.y += p.vy * dt; if (p.y >= SAND_Y + 4) { p.y = SAND_Y + 4; p.life -= dt; if (p.life <= 0) T.pellets.splice(T.pellets.indexOf(p), 1); } }
  for (const co of T.coins.slice()) { if (co.y < SAND_Y - 8) co.y += 45 * dt; co.age += dt * coinAgeRate(); if (co.age > 14) T.coins.splice(T.coins.indexOf(co), 1); }
  for (const f of T.fish.slice()) if (T.fish.includes(f)) updateFish(f, dt);
  for (const e of T.fx.slice()) { e.t += dt; if (e.t >= e.dur) T.fx.splice(T.fx.indexOf(e), 1); }
  for (const ft of T.floaters.slice()) { ft[1] -= 30 * dt; ft[4] -= dt; if (ft[4] <= 0) T.floaters.splice(T.floaters.indexOf(ft), 1); }
  if (!alive().length || !T.fish.some((f) => !f.isDead && !isPet(f) && EATERS.has(f.kind))) { if (T.cash < 100 && !T.coins.length) lose(); }
}
function win() {
  if (G.state !== "play") return;
  G.state = "won"; G.best = Math.max(G.best, G.level + 1); const got = grantUnlocks(); save();
  const lines = ["All 3 egg pieces collected!"].concat(got.length ? ["Caught: " + got.map((k) => D.shop[k].name).join(", ")] : []);
  modal("TANK " + stageLabel(G.level) + " COMPLETE", lines, [["Next tank", () => { G.level++; save(); newTank(); }]]);
}
function lose() { if (G.state !== "play") return; G.state = "lost"; modal("ALL FISH LOST", ["Your fish starved or were eaten."], [["Try again", () => newTank()]]); }

// ------------------------------------------------------------------------------------------------ input
function onTap(x, y) {
  if (G.state !== "play" || G.paused) return;
  let bestC = null, bd = 34;
  for (const co of T.coins) { const d = Math.hypot(co.x - x, co.y - y); if (d < bd) { bd = d; bestC = co; } }
  if (bestC) { collect(bestC); refreshShop(); return; }
  const b = T.boss; if (b && !b.held && Math.hypot(b.x - x, b.y - y) < 52 * Math.max(0.8, scaleOf(b) * 0.9)) { hitBoss(1 + T.weapL); return; }
  if (b && b.held && Math.hypot(b.x - x, b.y - y) < 52) { hitBoss(1 + T.weapL); return; }
  for (const f of T.fish) if (canEvolve(f) && Math.hypot(f.x - x, f.y - y) < 40) { const opts = evoOptions(f); if (opts.length > 1) modal("Evolve " + cap(f.sp), [], opts.map((o, i) => [cap(o[0]) + " ($" + o[2] + ")", () => { closeModal(); evolve(f, i); }]).concat([["Cancel", closeModal]])); else evolve(f, 0); return; }
  if (T.cash >= FOOD_COST && T.pellets.length < 1 + T.foodL) { T.cash -= FOOD_COST; T.pellets.push({ x, y: Math.max(TOP - 40, y), vy: 0, life: 7 }); refreshShop(); }
}

// ------------------------------------------------------------------------------------------------ shop
const UPS = ["egg", "food", "qual", "weap", "auto", "evo"];
const UP_INFO = {
  egg: () => ["Egg " + T.eggs + "/3", "finish the tank", T.eggs < 3 ? eggCost() : null, "🥚"],
  food: () => ["Food " + (1 + T.foodL), "more food at once", T.foodL < 7 ? 200 + 100 * T.foodL : null, "🍽"],
  qual: () => ["Quality " + (1 + T.qualL), "more growth per food", T.qualL < 2 ? 300 + 300 * T.qualL : null, "⭐"],
  weap: () => ["Weapon " + (1 + T.weapL), "more damage per tap", T.weapL < 4 ? 500 + 300 * T.weapL : null, "🔫"],
  auto: () => ["Auto Feeder", "feeds hungry fish ($5 each)", T.auto ? null : 400, "🤖"],
  evo: () => ["Auto Evolver", "evolves ready fish for you", T.autoEvo ? null : 700, "💎"],
};
function shopItems() {
  const out = [];
  for (const k of UPS) { const [n, s, p, ic] = UP_INFO[k](); const lock = !upOk(k); out.push({ key: k, name: n, sub: lock ? "Unlocks at Tank " + stageLabel(D.stageUnlock[k]) : s, price: lock ? null : p, label: lock ? "T " + stageLabel(D.stageUnlock[k]) : null, ok: !lock && p != null, icon: ic }); }
  const n = alive().length, room = n < MAX_FISH, petsOk = T.fish.length < 36, oneLegend = T.fish.some((f) => LEGENDS.has(f.sp) && !f.isDead);
  for (const k of D.order) {
    if (!isUnlocked(k)) continue;
    const it = D.shop[k], needRoom = ["guppy", "mom", "breeder", "milotic", "carn", "shark", "wailord"].includes(it.kind);
    out.push({ key: k, name: it.name, sub: it.sub, price: it.price, ok: (needRoom ? room : petsOk) && !(it.legend && oneLegend), sp: it.sp });
  }
  return out;
}
function buy(key) {
  if (G.state !== "play" || G.paused) return;
  const it = shopItems().find((i) => i.key === key); if (!it || it.price == null || T.cash < it.price || !it.ok) return;
  T.cash -= it.price; SND.buy();
  if (UPS.includes(key)) {
    if (key === "food") T.foodL++; else if (key === "qual") T.qualL++; else if (key === "weap") T.weapL++; else if (key === "auto") T.auto = true; else if (key === "evo") { T.autoEvo = true; say("Auto Evolver installed"); }
    else { T.eggs++; bump("eggs"); say("Egg piece " + T.eggs + "/3!"); if (T.eggs >= 3) win(); }
  } else {
    const s = D.shop[key], y = ["star", "clam", "coral"].includes(s.kind) ? SAND_Y - 20 : TOP;
    let shiny = null; if (s.legend) shiny = G.dbg.shiny || (G.settings.shiny && R() < D.legendShiny);
    T.fish.push(makeFish(s.kind, rnd(100, W - 100), y, 0, s.sp, shiny));
  }
  refreshShop();
}
const shopEl = () => document.getElementById("shop");
function buildShop() {
  const el = shopEl(); el.innerHTML = "";
  for (const it of shopItems()) {
    const b = document.createElement("button"); b.className = "item"; b.dataset.key = it.key;
    const ic = document.createElement("div"); ic.className = "ic";
    if (it.sp && SP[it.sp]) { const c = document.createElement("canvas"); c.width = c.height = 44; ic.appendChild(c); it.cv = c; } else ic.textContent = it.icon || "?";
    const nm = document.createElement("div"); nm.className = "nm"; const pr = document.createElement("div"); pr.className = "pr";
    b.append(ic, nm, pr); b.onclick = () => buy(it.key); b.ontouchstart = () => { document.getElementById("tip").textContent = it.name + " - " + it.sub; };
    b.onmouseenter = () => { document.getElementById("tip").textContent = it.name + " - " + it.sub; };
    el.appendChild(b);
  }
  refreshShop(true);
}
let lastShopKeys = "";
function refreshShop(force) {
  if (!T) return;
  const items = shopItems(), keys = items.map((i) => i.key).join(",");
  if (keys !== lastShopKeys || force) { lastShopKeys = keys; if (!force) { buildShop(); return; } }
  const els = shopEl().children;
  items.forEach((it, i) => {
    const b = els[i]; if (!b) return;
    b.classList.toggle("off", !(it.ok && it.price != null && T.cash >= it.price));
    b.querySelector(".nm").textContent = it.name; b.querySelector(".pr").textContent = it.price != null ? "$" + it.price : (it.label || "MAX");
    const c = b.querySelector("canvas"); if (c && !c.dataset.done) { const a = SP[it.sp]; const an = a.Idle ? "Idle" : "Walk"; const s = getStrip(it.sp, an, false, null); if (s) { const x = c.getContext("2d"); x.imageSmoothingEnabled = false; const m = a[an], k = Math.min(40 / m.fh, 40 / m.fw); x.clearRect(0, 0, 44, 44); x.drawImage(s, 0, 0, m.fw, m.fh, (44 - m.fw * k) / 2, (44 - m.fh * k) / 2, m.fw * k, m.fh * k); c.dataset.done = 1; } }
  });
  document.getElementById("cash").textContent = Math.floor(T.cash);
}

// ------------------------------------------------------------------------------------------------ drawing
const cv = document.getElementById("c"), ctx = cv.getContext("2d");
function drawFish(f, t) {
  const an = f.anim || pickAnim(f.sp, "Idle"); if (!an) return;
  const m = SP[f.sp][an]; const tint = f.isDead ? "dead" : (f.kind === "boss" && f.variant === "octillery" && !f.vis ? null : tintOf(f));
  const s = getStrip(f.sp, an, f.shiny && !f.tier, tint); if (!s) return;
  const sc = scaleOf(f), sw = m.fw * sc, sh = m.fh * sc, fi = f.frame % m.n;
  ctx.save(); ctx.translate(f.x + (f.shake > 0 ? rnd(-3, 3) : 0), f.y + Math.sin(t * 2 + f.x / 50) * 2);
  if (!f.right) ctx.scale(-1, 1); if (f.isDead) ctx.scale(1, -1);
  if (f.kind === "boss" && f.variant === "octillery" && !f.vis) ctx.globalAlpha = 0.35;
  ctx.drawImage(s, fi * m.fw, 0, m.fw, m.fh, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();
  return sh;
}
function text(s, x, y, size, col, align) {
  ctx.font = "bold " + size + "px system-ui, sans-serif"; ctx.textAlign = align || "center"; ctx.lineWidth = 4; ctx.strokeStyle = "#0a1a2a"; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function draw() {
  ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
  if (!T) return; const t = performance.now() / 1000;
  ctx.imageSmoothingEnabled = true;
  for (const b of T.bubbles) { const o = loadImg("env/bubble.png"); if (o.ok) ctx.drawImage(o.img, b.x, b.y, b.r * 2.4, b.r * 2.4); }
  const pel = loadImg("env/pellet.png"); for (const p of T.pellets) if (pel.ok) ctx.drawImage(pel.img, p.x - 6, p.y - 6, 12, 12);
  ctx.imageSmoothingEnabled = false;
  for (const f of T.fish.slice().sort((a, b) => a.y - b.y)) {
    if (f.phase === "gone") continue;
    const sh = drawFish(f, t); if (!sh || f.isDead) continue;
    const top = f.y - sh / 2;
    if (f.kind === "boss") {
      const m = Math.max(1, f.maxhp);
      if (f.variant === "wailmer") text(String(Math.max(0, Math.ceil(f.fuse))), f.x, top - 26, 16, f.fuse < 5 ? "#ff6b6b" : "#fff");
      ctx.fillStyle = "#400"; ctx.fillRect(f.x - 30, top - 12, 60, 6); ctx.fillStyle = "#ff4d4d"; ctx.fillRect(f.x - 30, top - 12, 60 * Math.max(0, f.hp) / m, 6); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(f.x - 30, top - 12, 60, 6);
    } else {
      if (canEvolve(f)) text(evoOptions(f).length > 1 ? "✦ evolve: choose" : "✦ evolve $" + D.evolutions[f.sp][2], f.x, top - 20, 12, "#ffe27a");
      if (G.settings.hunger && !isPet(f) && f.hunger < (D.hungryAt[f.kind] || 55)) text("!", f.x, top - 8, 16, f.hunger < 25 ? "#ff4d4d" : "#ffd34d");
    }
  }
  ctx.imageSmoothingEnabled = true;
  for (const co of T.coins) {
    if (co.age > 11 && Math.floor(co.age * 8) % 2 === 0) continue;
    const o = loadImg("env/coin_" + co.kind + ".png"); const sz = co.kind === "diamond" ? 34 : co.kind === "treasure" ? 46 : 28; const y = co.y + Math.sin(t * 3 + co.x) * 1.5;
    if (o.ok) ctx.drawImage(o.img, co.x - sz / 2, y - sz / 2, sz, sz); if (co.x2) text("x2", co.x, y + 4, 11, "#fff");
  }
  for (const e of T.fx) {
    if (e.t < 0) continue; const p = e.t / e.dur; let x = e.x, y = e.y; if (e.tx != null) { x += (e.tx - x) * p; y += (e.ty - y) * p; }
    const n = e.cells.length, idx = e.loop ? Math.floor(p * n * 3) % n : Math.min(n - 1, Math.floor(p * n)), cell = e.cells[idx], o = fxImg(e.name);
    if (o.ok) ctx.drawImage(o.img, (cell % 5) * 96, Math.floor(cell / 5) * 96, 96, 96, x - e.size / 2, y - e.size / 2, e.size, e.size);
  }
  for (const [x, y, s, col] of T.floaters) text(s, x, y, 14, col);
  if (T.rain > 0) text("☔ RAIN! coins pay double (" + Math.ceil(T.rain) + ")", W / 2, 50, 16, "#9ee6ff");
  if (T.msg_t > 0) text(T.msg, W / 2, 24, 16, "#ffd34d");
  text("Tank " + stageLabel(G.level), 14, H - 10, 18, "#f3e3c8", "left");
  if (G.paused) text("PAUSED", W / 2, H / 2, 48, "#fff");
}

// ------------------------------------------------------------------------------------------------ menus
const modalEl = () => document.getElementById("modal");
function closeModal() { modalEl().classList.remove("show"); modalEl().innerHTML = ""; if (G.state === "menu") { G.state = G.prevState || "play"; } }
function modal(title, lines, buttons, extra) {
  const m = modalEl(); m.innerHTML = ""; const box = document.createElement("div"); box.className = "box";
  const h = document.createElement("h2"); h.textContent = title; box.appendChild(h);
  for (const l of lines || []) { const p = document.createElement("p"); p.textContent = l; box.appendChild(p); }
  if (extra) box.appendChild(extra);
  for (const [t, fn] of buttons || []) { const b = document.createElement("button"); b.textContent = t; b.onclick = fn; box.appendChild(b); }
  m.appendChild(box); m.classList.add("show");
}
function openMenu() {
  if (G.state === "menu") return;
  if (G.state === "play") { G.prevState = "play"; G.paused = true; G.state = "menu"; }
  const fresh = G.level === 1 && G.best === 1 && !G.prog.coins;
  modal("FISH TANK", ["Tank " + stageLabel(G.level) + "   best " + stageLabel(G.best)], [
    [fresh ? "Play" : "Resume", () => { G.paused = false; G.state = "play"; closeModal(); }],
    ["Restart this tank", () => { G.state = "play"; newTank(); }],
    ["Select tank", openSelect], ["Wall of unlocks", openWall], ["Settings", openSettings], ["Debug", openDebug],
    ["New game (erase)", () => { if (confirm("Erase all progress?")) { localStorage.removeItem("fishtank_save"); location.reload(); } }],
  ]);
}
function openSelect() {
  const g = document.createElement("div"); g.className = "grid"; const max = Math.max(G.best, G.level);
  for (let i = 1; i <= max; i++) { const b = document.createElement("button"); b.textContent = stageLabel(i); b.onclick = () => { G.level = i; G.state = "play"; save(); newTank(); }; g.appendChild(b); }
  modal("Select tank", [], [["Back", () => { G.state = "play"; openMenu(); }]], g);
}
function openWall() {
  const g = document.createElement("div"); g.className = "list";
  for (const k of D.order) {
    const it = D.shop[k]; if (!it.wall) continue; const got = G.prog.unlocked.includes(k) || G.dbg.unlock, met = wallMet(k);
    const p = document.createElement("div"); p.className = got ? "got" : met ? "met" : "";
    p.textContent = (got ? "✅ " : met ? "⏳ " : "🔒 ") + it.name + " - " + it.wall.text + (got ? "" : "  (" + it.wall.conds.map(([s, gl]) => Math.min(stat(s), gl) + "/" + gl).join(", ") + ")");
    g.appendChild(p);
  }
  modal("Wall of unlocks", ["Finish a tank to catch completed Pokemon."], [["Back", () => { G.state = "play"; openMenu(); }]], g);
}
function openSettings() {
  const g = document.createElement("div"); g.className = "list";
  for (const [k, label] of [["fx", "Attack effects"], ["shiny", "Shiny fish"], ["sound", "Sound"], ["boss", "Raiding monsters"], ["hunger", "Hungry markers"]]) {
    const b = document.createElement("button"); const upd = () => { b.textContent = label + ": " + (G.settings[k] ? "ON" : "OFF"); }; upd(); b.onclick = () => { G.settings[k] = !G.settings[k]; save(); upd(); }; g.appendChild(b);
  }
  const sp = document.createElement("button"); sp.textContent = "Speed: " + G.settings.speed + "x"; sp.onclick = () => { const L = [0.5, 1, 1.5, 2, 3]; G.settings.speed = L[(L.indexOf(G.settings.speed) + 1) % L.length]; sp.textContent = "Speed: " + G.settings.speed + "x"; save(); }; g.appendChild(sp);
  modal("Settings", [], [["Back", () => { G.state = "play"; openMenu(); }]], g);
}
function openDebug() {
  const g = document.createElement("div"); g.className = "list";
  const add = (t, fn) => { const b = document.createElement("button"); b.textContent = t; b.onclick = () => { fn(); refreshShop(); }; g.appendChild(b); };
  add("UNLOCK EVERYTHING (fish, upgrades, all tanks)", () => { G.dbg.unlock = true; for (const k of D.order) if (D.shop[k].wall && !G.prog.unlocked.includes(k)) G.prog.unlocked.push(k); G.best = Math.max(G.best, 60); G.prog.seen = Object.keys(D.bosses); save(); buildShop(); say("Everything unlocked!"); });
  add("+$1000", () => { T.cash += 1000; }); add("+$100000", () => { T.cash += 100000; });
  add("Infinite cash: " + (G.dbg.cash ? "ON" : "OFF"), () => { G.dbg.cash = !G.dbg.cash; openDebug(); });
  add("Fish never starve: " + (G.dbg.god ? "ON" : "OFF"), () => { G.dbg.god = !G.dbg.god; openDebug(); });
  add("Every new fish is shiny: " + (G.dbg.shiny ? "ON" : "OFF"), () => { G.dbg.shiny = !G.dbg.shiny; openDebug(); });
  add("Spawn raider (random)", () => { spawnBoss(); });
  for (const v of Object.keys(D.bosses)) add("Raider: " + D.bosses[v][6], () => { T.boss = null; T.fish = T.fish.filter((f) => f.kind !== "boss"); spawnBoss(v); });
  add("Kill raider", () => hitBoss(1e6)); add("Free food x5", () => { for (let i = 0; i < 5; i++) T.pellets.push({ x: rnd(40, W - 40), y: 25, vy: 0, life: 7 }); });
  add("Grow all babies", () => { for (const f of T.fish) if (f.kind === "guppy") f.stage = 2; });
  add("Evolve all", () => { for (const f of T.fish.slice()) if (f.kind !== "boss" && D.evolutions[f.sp]) applyEvolution(f, 0); });
  add("Finish tank", () => { T.eggs = 3; closeModal(); G.state = "play"; win(); });
  const inp = document.createElement("input"); inp.placeholder = "spawn Pokemon (e.g. lugia)"; inp.setAttribute("list", "spl");
  const dl = document.createElement("datalist"); dl.id = "spl"; dl.innerHTML = Object.keys(SP).map((s) => "<option value='" + s + "'>").join(""); g.append(inp, dl);
  add("Spawn it (shiny)", () => { const s = inp.value.trim().toLowerCase(); if (SP[s]) { const f = newE("mon", rnd(80, W - 80), rnd(TOP, BOT), 0, s); f.shiny = true; rollTier(f); T.fish.push(f); } else say("no sprite for " + s); });
  modal("Debug", [], [["Back", () => { G.state = "play"; openMenu(); }]], g);
}

// ------------------------------------------------------------------------------------------------ main loop + wiring
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const sp = G.settings.speed || 1, n = Math.max(1, Math.ceil(sp));
  for (let i = 0; i < n; i++) update(dt * sp / n);
  draw();
  if (Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) refreshShop();
  requestAnimationFrame(frame);
}
function fit() {
  const stage = document.getElementById("stage"), r = stage.getBoundingClientRect(); const k = Math.min(r.width / W, r.height / H);
  cv.style.width = W * k + "px"; cv.style.height = H * k + "px"; document.getElementById("bg").style.width = W * k + "px"; document.getElementById("bg").style.height = H * k + "px";
  const wrap = document.getElementById("tank"); wrap.style.width = W * k + "px"; wrap.style.height = H * k + "px";
}
function pointer(e) { const r = cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) / r.width * W, (t.clientY - r.top) / r.height * H]; }
cv.addEventListener("pointerdown", (e) => { e.preventDefault(); const [x, y] = pointer(e); onTap(x, y); });
window.addEventListener("resize", fit); window.addEventListener("orientationchange", () => setTimeout(fit, 200));
document.addEventListener("visibilitychange", () => { if (document.hidden && G.state === "play") G.paused = true; });
document.getElementById("menuBtn").onclick = openMenu;
document.getElementById("pauseBtn").onclick = () => { if (G.state === "play") { G.paused = !G.paused; document.getElementById("pauseBtn").textContent = G.paused ? "▶" : "II"; } };
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("touchmove", (e) => { if (!e.target.closest("#shop, .box")) e.preventDefault(); }, { passive: false });
loadSave(); fit(); newTank(); openMenu();
requestAnimationFrame(frame);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { /* offline cache is optional */ });
