'use strict';
// ---------------------------------------------------------------- the fishing scene: simulation
const Y0 = 175, YB = 520, XS = 130;
const RAR_W = { 1: 100, 2: 55, 3: 28, 4: 12, 5: 5, 6: 3 };
let F = null;

function slotOf(h) { return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night'; }
function bottomAt(x) {
  const sp = F.spot;
  return sp.D * (0.16 + 0.84 * smooth(clamp(x / (sp.W * 0.55), 0, 1))) * (1 + 0.04 * Math.sin(x * 0.8));
}
const depthY = d => Y0 + d / F.spot.D * (YB - Y0 - 14);
const xPx = x => XS + x * F.pxm;

function condOK(c) {
  const s = slotOf(F.hour);
  if (!c) return true;
  if (c === 'rain') return F.wx === 'rain';
  if (c === 'cloud') return F.wx === 'cloud' || F.wx === 'rain';
  return s === c;
}

function enterSpot(id, tour) {
  F = makeSession(id, tour);
  Snd.mode = tour ? 'tour' : 'fish';
  scene = 'spot';
  say(tour ? 'TOURNAMENT! 3 minutes. Heaviest 3 fish win!' : F.spot.name, '#fff');
}
function makeSession(id, tour) {
  const prevF = F;
  const spot = SPOT_BY[id];
  F = {
    spot, pxm: (VW - XS - 18) / spot.W, t: 0, hour: pick([7, 10, 13, 16, 18, 21]), wx: pick(['clear', 'clear', 'cloud', 'rain']), wxT: rnd(70, 150),
    fish: [], phase: 'idle', lure: { x: 0, y: 0, z: 0, twitch: 0, fly: null, reeling: false, spd: 0, wob: 0 }, charge: 0, cdir: 1, fight: null, msgs: [], parts: [], ripples: [],
    card: null, tour: null, decor: [], rodAng: -0.8, bend: 0, bite: null, spawnT: 0, menu: false, lureMenu: false, flash: 0, land: null, tipX: 0, tipY: 0, hold: 0, bubbles: [],
    reelSnd: 0, warnSnd: 0, legendNote: 0, shake: 0,
  };
  if (spot.cave) F.hour = pick([2, 12, 22, 7]);
  const R = mulberry(id.length * 7919 + 13);
  const n = Math.floor(spot.W * 0.7);
  for (let i = 0; i < n; i++) {
    const kind = R() < 0.45 ? 'rock' : spot.env === 'cave' ? 'crystal' : spot.env === 'coast' || spot.env === 'deep' ? (R() < 0.5 ? 'coral' : 'kelp') : 'kelp';
    F.decor.push({ x: 2 + R() * (spot.W - 3), kind, h: 0.6 + R() * 1.4, ph: R() * 6, hue: Math.floor(R() * 360), s: 0.7 + R() * 0.8 });
  }
  F.pads = []; for (let i = 0; i < 9; i++) F.pads.push({ x: 3 + R() * (spot.W - 5), r: 7 + R() * 7, fl: R() < 0.5 });
  F.clouds = []; for (let i = 0; i < 6; i++) F.clouds.push({ x: R() * VW, y: 25 + R() * 90, s: 0.6 + R() * 0.9, v: 4 + R() * 8 });
  F.stars = []; for (let i = 0; i < 60; i++) F.stars.push({ x: R() * VW, y: R() * 150, tw: R() * 6 });
  for (let i = 0; i < spot.fc; i++) spawnFish(true);
  if (tour) {
    const names = ['Rex', 'Dana', 'Old Gus', 'Mika', 'Bo', 'Captain Lo'];
    const rv = []; for (let i = 0; i < 3; i++) rv.push({ name: names.splice(rint(0, names.length - 1), 1)[0], score: spot.tour * rnd(0.5, 1.25) });
    F.tour = { left: 180, catches: [], ended: false, rivals: rv, prize: 0 };
  }
  F.cam = { x: VW / 2, y: VH / 2, z: 1 }; F.snow = []; F.flies = []; F.lightning = 0; F.boltT = rnd(8, 20); F.spin = 0; F.glitter = [];
  for (let i = 0; i < 70; i++) F.snow.push({ x: rnd(XS, VW), y: rnd(Y0, VH), v: rnd(2, 7), s: rnd(0.6, 1.8), ph: rnd(6) });
  for (let i = 0; i < 26; i++) F.flies.push({ x: rnd(0, VW), y: rnd(Y0 - 90, Y0 - 6), ph: rnd(6), sp: rnd(0.4, 1) });
  if (!TEX.clouds) buildTextures();
  for (const d of F.decor) d.z = (Math.random() - 0.5) * Math.min(spot.W * 1.1, 46);
  for (const p of F.pads) p.z = (Math.random() - 0.5) * Math.min(spot.W * 0.9, 36);
  F.aim = 0; F.hz = 70; F.yaw = 0; F.uwc = null; F.splash = []; F.jumps = []; F.jumpT = rnd(3, 8);
  buildPanorama(F);
  const S = F; F = prevF;
  return S;
}
window.onScaleChange = () => { };

function say(text, col = '#fff', dur = 2.4) { F.msgs.push({ text, col, t: dur, max: dur }); if (F.msgs.length > 4) F.msgs.shift(); }

// ---------------------------------------------------------------- fish
function pickSpecies() {
  const slot = slotOf(F.hour);
  const legendsNow = F.fish.filter(f => f.S.cond).length;
  const pool = POOLS[F.spot.id].map(([id, w]) => {
    const S = SPECIES[id]; let m = w * RAR_W[S.rar];
    if (S.act === 'n') m *= slot === 'night' ? 4 : slot === 'day' ? 0.3 : 1;
    if (S.act === 'd') m *= slot === 'day' ? 3 : slot === 'night' ? 0.2 : 1;
    if (S.cond) { m = condOK(S.cond) && legendsNow < 1 ? w * 2.2 : 0; }
    if (RAIN_LOVERS.has(id) && F.wx === 'rain') m *= 2.5;
    return [id, m];
  });
  return wpick(pool, p => p[1])[0];
}
const ZM = () => Math.min(F.spot.W * 0.32, 13);
function sizeClass(size) { return clamp(1 + Math.round(Math.log2(size / 0.5)), 1, 5); }
function makeFish(id, x) {
  const S = SPECIES[id];
  const size = S.h * lerp(0.62, 1.45, Math.pow(Math.random(), 1.7)) * (Math.random() < 0.04 ? 1.25 : 1);
  const shiny = S.shiny && Math.random() < 1 / 40;
  const f = {
    id, S, size, kg: S.kg * Math.pow(size / S.h, 3) * rnd(0.92, 1.08), shiny, x, y: 0, tx: x, ty: 0, hab: S.hab,
    hpx: clamp(14 + 38 * Math.sqrt(size), 30, 150), power: (10 + 12 * Math.sqrt(size)) * (0.8 + 0.18 * S.rar) * (shiny ? 1.15 : 1),
    speed: rnd(0.7, 1.3), mood: rnd(0.55, 1.2), state: 'wander', st: 0, dir: Math.random() < 0.5 ? 1 : -1, cool: 0, t: rnd(9), pause: 0, tugs: 0, tugT: 0, ph: rnd(6),
  };
  f.price = Math.round(18 * Math.pow(S.rar, 2.1) * Math.pow(size / S.h, 1.8) * (1 + S.h * 0.12) * (shiny ? 3 : 1));
  f.y = zoneY(f, x); f.ty = f.y; f.z = rnd(-ZM(), ZM()); f.tz = f.z; f.fz = Math.random() < 0.5 ? 1 : -1;
  return f;
}
function zoneY(f, x) {
  const b = bottomAt(x), r = Math.random();
  const fr = f.hab === 's' ? 0.04 + r * 0.16 : f.hab === 'm' ? 0.25 + r * 0.35 : 0.72 + r * 0.22;
  return Math.max(f.size * 0.25 + 0.2, fr * b);
}
function spawnFish(first) {
  const id = pickSpecies();
  const x = first ? rnd(4, F.spot.W - 2) : (Math.random() < 0.5 ? F.spot.W - 1.5 : rnd(F.spot.W * 0.6, F.spot.W - 1.5));
  const f = makeFish(id, x);
  F.fish.push(f);
  if (f.S.cond && !first) { say('A legendary presence stirs the water...', '#ffe36e', 4); Snd.sfx('legend'); }
}

function updateFish(f, dt) {
  const spot = F.spot, l = F.lure, lure = LURE_BY[SAVE.lure];
  f.t += dt; f.cool = Math.max(0, f.cool - dt);
  const inLure = F.phase === 'lure';
  const steer = (tx, ty, tz, sp) => {
    const dx = tx - f.x, dy = ty - f.y, dz = tz - f.z, d = Math.hypot(dx, dy, dz) || 1;
    f.x += dx / d * sp * dt; f.y += dy / d * sp * dt * 0.8; f.z += dz / d * sp * dt;
    if (Math.abs(dz) > 0.08) f.fz = dz > 0 ? 1 : -1; if (Math.abs(dx) > 0.15) f.dir = dx > 0 ? 1 : -1;
    return d;
  };
  const newTarget = (far) => { f.tx = clamp(f.x + rnd(-far, far), 3, spot.W - 1.5); f.tz = clamp(f.z + rnd(-far, far), -ZM(), ZM()); f.ty = zoneY(f, f.tx); };
  if (f.state === 'wander' || f.state === 'flee') {
    if (f.pause > 0) { f.pause -= dt; }
    else {
      const d = Math.hypot(f.tx - f.x, (f.ty - f.y) * 0.6, (f.tz || 0) - f.z);
      const sp = (f.state === 'flee' ? 3.2 : 0.85) * f.speed * (1 + 0.25 * Math.sqrt(f.size));
      if (d < 0.5) { if (Math.random() < 0.35) f.pause = rnd(0.5, 2.2); newTarget(9); if (f.state === 'flee') f.state = 'wander'; }
      else steer(f.tx, f.ty, f.tz || 0, sp);
    }
    if (inLure && f.state === 'wander' && f.cool <= 0) {
      const dx = l.x - f.x, dy = (l.y - f.y) * 1.3, dz = (l.z - f.z) * 0.6, d = Math.hypot(dx, dy, dz);
      const sight = Math.min(12, 3 + f.size * 1.6) * (1 + spot.D / 50);
      if (d < sight && l.x > 1.8) {
        const habm = lure.hab[f.hab] || 0.5;
        const zone = 1 - clamp(Math.abs(l.y - f.y) / (spot.D * 0.35 + 2), 0, 1) * 0.65;
        const sizeFit = 1 - 0.13 * Math.abs(lure.size - sizeClass(f.size));
        const rar = Math.max(0.35, 1.15 - 0.12 * f.S.rar) * (lure.rare && f.S.rar >= 4 ? lure.rare : 1);
        const nightB = lure.night && (slotOf(F.hour) === 'night' || spot.cave) ? lure.night : 1;
        const wxB = F.wx === 'rain' ? 1.3 : F.wx === 'cloud' ? 1.1 : 1;
        const mv = (l.reeling ? 1 : 0.6) + l.twitch * 1.3;
        const p = lure.app * habm * zone * Math.max(0.2, sizeFit) * rar * nightB * wxB * mv * f.mood * (1 - d / sight * 0.5);
        if (Math.random() < p * dt * 0.95) { f.state = 'chase'; f.st = 0; }
      }
    }
  } else if (f.state === 'chase') {
    if (!inLure) { f.state = 'wander'; f.cool = 3; return; }
    f.st += dt;
    const d = Math.hypot(l.x + 0.5 - f.x, l.y - f.y, l.z - f.z);
    if (d < 1.2) { f.state = 'nibble'; f.tugs = rint(1, 3); f.tugT = rnd(0.45, 0.8); f.st = 0; }
    else { steer(l.x + 0.5, l.y, l.z, (3.4 + l.spd * 0.6) * f.speed * (1 + 0.2 * Math.sqrt(f.size))); if (f.st > 8 || d > 18) { f.state = 'wander'; f.cool = 4; } }
  } else if (f.state === 'nibble' || f.state === 'bite') {
    if (!inLure) { f.state = 'wander'; f.cool = 3; return; }
    f.x = l.x + 0.5; f.y = l.y; f.z = l.z + Math.sin(f.t * 9) * 0.06;
    if (f.state === 'nibble') {
      f.tugT -= dt;
      if (l.spd > 3.6 && Math.random() < dt * 1.2) { f.state = 'flee'; f.cool = 6; newTarget(7); say('The lure moved too fast!', '#ffd0a0'); Snd.sfx('flee'); return; }
      if (f.tugT <= 0) {
        f.tugs--; l.wob = 1; Snd.sfx('tap');
        if (f.tugs <= 0) { f.state = 'bite'; f.st = Math.max(0.38, 0.9 - 0.07 * f.S.rar); F.bite = f; Snd.sfx('bite'); F.flash = 0.25; }
        else f.tugT = rnd(0.5, 0.95);
      }
    } else {
      f.st -= dt;
      if (f.st <= 0) { f.state = 'flee'; f.cool = 10; newTarget(9); F.bite = null; say('Too slow! It got away with a nibble.', '#ffd0a0'); Snd.sfx('flee'); }
    }
  }
  f.x = clamp(f.x, 0.5, spot.W - 0.3); f.z = clamp(f.z, -ZM() - 2, ZM() + 2);
  f.y = clamp(f.y, 0.15, Math.max(0.4, bottomAt(f.x) - 0.15));
}

// ---------------------------------------------------------------- actions
function castMax() { return Math.min(ROD_BY[SAVE.rod].cast, F.spot.W - 1.5); }
function startCast(power, targetX, targetZ) {
  const maxD = castMax();
  let x = targetX !== undefined ? clamp(targetX, 3, maxD) : clamp(3 + power * (maxD - 3), 3, maxD);
  let z = targetZ !== undefined ? targetZ : x * Math.tan(F.aim);
  z = clamp(z, -ZM() - 1, ZM() + 1);
  if (targetZ !== undefined) F.aim = Math.atan2(z, Math.max(1, x));
  F.lure.fly = { t: 0, dur: 0.75 + x * 0.012, x, z };
  F.lure.x = x; F.lure.z = z; F.lure.y = 0; F.lure.twitch = 0; F.lure.spd = 0;
  F.phase = 'cast'; F.rodAng = -1.4; Snd.sfx('cast');
}
function retrieveLure() { F.phase = 'idle'; F.lure.fly = null; F.bite = null; for (const f of F.fish) if (['chase', 'nibble', 'bite'].includes(f.state)) { f.state = 'wander'; f.cool = 3; } }

function hookFish(f) {
  const rod = ROD_BY[SAVE.rod], l = F.lure;
  f.state = 'hooked'; F.bite = null;
  const smax = (28 + 32 * Math.sqrt(f.size)) * (0.8 + 0.1 * f.S.rar) * 4;
  F.fight = { f, d: Math.max(3, l.x) + 4, tension: 30, stam: smax, smax, mode: 'rest', mt: rnd(1.2, 2.2), warn: 0, dir: Math.random() < 0.5 ? -1 : 1, tilt: 0, snapT: 0, jumpFail: false, t: 0, depthT: f.y, reeling: false, counter: false, slack: 0, hook: 0 };
  F.phase = 'fight'; Snd.sfx('hook'); F.shake = 0.25;
  say(f.S.name + ' is on the line!', '#ffe36e', 2.2);
}

function updateFight(dt, reeling, tiltIn) {
  const fi = F.fight, f = fi.f, rod = ROD_BY[SAVE.rod];
  fi.t += dt; fi.reeling = reeling;
  fi.tilt = lerp(fi.tilt, tiltIn, Math.min(1, dt * 10));
  const rar = f.S.rar, sp = fi.stam / fi.smax;
  // mode machine
  fi.mt -= dt;
  if (fi.mode === 'rest' && fi.mt <= 0) {
    fi.mode = 'warn'; fi.mt = 0.7; fi.dir = Math.random() < 0.5 ? -1 : 1; Snd.sfx('warn');
  } else if (fi.mode === 'warn' && fi.mt <= 0) {
    const canJump = (f.hab !== 'b' || Math.random() < 0.15) && fi.d > 4 && Math.random() < 0.28;
    if (canJump) { fi.mode = 'jump'; fi.mt = 1.0; fi.jumpFail = true; Snd.sfx('jump'); F.shake = 0.2; spray(f.x, f.z, 14); }
    else { fi.mode = 'run'; fi.mt = rnd(1.1, 2.0) + rar * 0.12 + (1 - sp) * -0.5; if (fi.mt < 0.7) fi.mt = 0.7; }
  } else if ((fi.mode === 'run' || fi.mode === 'jump') && fi.mt <= 0) {
    if (fi.mode === 'jump' && fi.jumpFail) {
      // a jumping fish throws the hook if the line goes slack
      if (fi.tension < 28 && Math.random() < 0.8) { fightLost('The hook came loose! Keep reeling when it jumps!'); return; }
    }
    fi.mode = 'rest'; fi.mt = rnd(1.4, 3.0) * (0.6 + 0.5 * sp);
  }
  const counterNeeded = fi.mode === 'run';
  fi.counter = counterNeeded && fi.tilt * -fi.dir > 0.5;
  const wrong = counterNeeded && fi.tilt * fi.dir > 0.5;
  // tension
  const pullMul = fi.mode === 'run' ? 2.0 : fi.mode === 'jump' ? 0.55 : fi.mode === 'warn' ? 1.0 : 0.6;
  let pull = f.power * pullMul * (0.55 + 0.45 * sp);
  let tgt = 100 * pull / rod.line * (fi.counter ? 0.7 : wrong ? 1.2 : 1);
  if (reeling) tgt += 18 + 9 * rod.reel;
  tgt = Math.max(tgt, reeling ? 18 : 4);
  fi.tension += (tgt - fi.tension) * (1 - Math.exp(-5.5 * dt));
  if (fi.tension > 100) { fi.snapT += dt; } else fi.snapT = Math.max(0, fi.snapT - dt * 1.5);
  if (fi.snapT > 0.55) { fightSnap(); return; }
  // stamina
  const sweet = fi.tension > 36 && fi.tension < 90;
  if (sweet) fi.stam -= (8 + 5 * rod.reel) * dt * (fi.counter ? 1.9 : 1) * (reeling ? 1 : 0.45);
  else if (fi.tension < 22 && fi.mode === 'rest') fi.stam = Math.min(fi.smax, fi.stam + 1.6 * dt);
  if (fi.counter) fi.stam -= 3 * dt;
  fi.stam = Math.max(0, fi.stam);
  // distance
  let reelRate = reeling ? 2.4 * rod.reel * (1.35 - 0.95 * sp) * (fi.mode === 'run' ? 0.35 : fi.mode === 'jump' ? 1.4 : 1) : 0;
  let fishRate = f.speed * 1.5 * (fi.mode === 'run' ? 1.6 : fi.mode === 'rest' ? 0.4 : fi.mode === 'jump' ? 0.2 : 0.3) * (0.3 + 0.7 * sp) * (fi.counter ? 0.35 : 1);
  if (fi.tension >= 94) { reelRate *= 0.15; fishRate *= 1.5; }
  fi.d += (fishRate - reelRate) * dt;
  if (fi.d > Math.min(ROD_BY[SAVE.rod].cast, F.spot.W - 1) + 4) { fightLost('The line ran out! It swam away.'); return; }
  fi.d = Math.max(0, fi.d);
  // fish position + depth
  const bot = bottomAt(Math.max(1, fi.d));
  const wantY = fi.mode === 'jump' ? -1.2 : fi.mode === 'run' ? bot * 0.8 : (f.hab === 's' ? bot * 0.2 : f.hab === 'm' ? bot * 0.45 : bot * 0.78);
  f.y = lerp(f.y, clamp(wantY, -1.5, bot - 0.2), Math.min(1, dt * (fi.mode === 'jump' ? 5 : 2)));
  f.x = fi.d; f.dir = 1;
  f.z += (fi.mode === 'run' ? fi.dir * f.speed * 1.8 * (fi.counter ? 0.3 : 1) : -f.z * 0.25) * dt; f.z = clamp(f.z, -ZM() - 2, ZM() + 2); if (fi.mode === 'run') f.fz = fi.dir;
  // rod bend + sfx
  F.bend = lerp(F.bend, 0.35 + fi.tension / 100 * 1.1, Math.min(1, dt * 8));
  F.reelSnd -= dt;
  if (reeling && F.reelSnd <= 0) { Snd.beep(120 + fi.tension * 3, 0.04, 'square', 0.025); F.reelSnd = 0.11; }
  F.warnSnd -= dt;
  if (fi.tension > 86 && F.warnSnd <= 0) { Snd.sfx('warn'); F.warnSnd = 0.18; }
  if (fi.d <= 1.3) landFish();
}
function fightSnap() {
  const f = F.fight.f; Snd.sfx('snap'); F.shake = 0.5; SAVE.stats.snapped++;
  say('SNAP! The line broke and ' + f.S.name + ' escaped.', '#ff8a8a', 3.2);
  F.fish = F.fish.filter(x => x !== f); F.fight = null; F.phase = 'idle'; F.bend = 0; spawnFish(false);
}
function fightLost(msg) {
  const f = F.fight.f; Snd.sfx('flee'); say(msg, '#ffd0a0', 3);
  f.state = 'flee'; f.cool = 15; f.tx = clamp(f.x + 8, 3, F.spot.W - 1); f.ty = f.y; F.fight = null; F.phase = 'idle'; F.bend = 0;
}
function landFish() {
  const f = F.fight.f; F.land = { f, t: 0 }; F.phase = 'land'; F.fight = null; Snd.sfx('splash');
}
function finishCatch(f) {
  F.fish = F.fish.filter(x => x !== f);
  const id = f.id, S = f.S;
  let d = SAVE.dex[id]; const isNew = !d;
  if (!d) d = SAVE.dex[id] = { n: 0, best: 0, bestKg: 0, shiny: false, spots: {} };
  const rec = f.size > d.best;
  d.n++; if (rec) { d.best = f.size; d.bestKg = f.kg; } if (f.shiny) d.shiny = true; d.spots[F.spot.id] = 1;
  SAVE.stats.caught++;
  F.card = { f, isNew, rec, t: 0, shiny: f.shiny };
  const rare = S.rar >= 5 || f.shiny || isNew;
  Snd.sfx(rare ? 'rare' : 'catch');
  if (F.tour) F.tour.catches.push({ id, name: S.name, kg: f.kg, size: f.size, shiny: f.shiny });
  saveGame();
  F.phase = 'result';
}
function spray(x, z, n) { F.splash.push({ x, z, t: 0, n, big: n > 9 }); }

// ---------------------------------------------------------------- per-frame update
function tourScore() {
  if (!F.tour) return 0;
  return F.tour.catches.map(c => c.kg).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
}
function mainHeld() { return !!(keys.Space || keys.KeyZ || uiHeld('main')); }
function mainPressed() { return !!(keyEdge.Space || keyEdge.KeyZ || UI.pressed['main']); }
function jerkPressed() { return !!(keyEdge.KeyJ || keyEdge.KeyX || UI.pressed['jerk']); }

function updateSpot(dt) {
  if (!F) return;
  // overlays
  if (F.menu) { handleSpotMenu(); return; }
  F.t += dt;
  const blocked = !!F.card || (F.tour && F.tour.ended);
  if (F.card) { updateCard(dt); }
  else if (F.tour && F.tour.ended) { if (UI.clicked['tour-ok'] || keyEdge.Enter || keyEdge.Space) { leaveSpot(); } return; }
  F.shake = Math.max(0, F.shake - dt); F.flash = Math.max(0, F.flash - dt);
  // clock + weather
  F.hour = (F.hour + dt / 25) % 24;
  F.wxT -= dt;
  if (F.wxT <= 0) { F.wxT = rnd(70, 160); F.wx = wpick([['clear', 5], ['cloud', 3], ['rain', 2]], x => x[1])[0]; if (F.wx === 'rain') say('It starts to rain. The fish are biting more!', '#bfe3ff'); }
  if (F.tour && !F.tour.ended) {
    F.tour.left -= dt;
    if (F.tour.left <= 0 && (F.phase === 'idle' || F.phase === 'lure')) { endTournament(); }
  }
  // msgs / particles
  for (const m of F.msgs) m.t -= dt; F.msgs = F.msgs.filter(m => m.t > 0);
  for (const p of F.parts) { p.t -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } F.parts = F.parts.filter(p => p.t > 0);
  for (const r of F.ripples) { r.t -= dt; r.r += dt * 26; } F.ripples = F.ripples.filter(r => r.t > 0);
  if (F.wx === 'rain' && Math.random() < dt * 16) F.ripples.push({ x: rnd(XS, VW), r: 1, t: 0.7 });
  if (Math.random() < dt * 3) F.bubbles.push({ x: xPx(rnd(2, F.spot.W - 1)), y: YB - 10, v: rnd(18, 40), s: rnd(1.5, 3.5), ph: rnd(6) });
  for (const b of F.bubbles) { b.y -= b.v * dt; b.ph += dt * 2; } F.bubbles = F.bubbles.filter(b => b.y > Y0);
  // fish upkeep
  F.spawnT -= dt;
  if (F.spawnT <= 0 && F.fish.length < F.spot.fc) { spawnFish(false); F.spawnT = rnd(2, 5); }
  // leave legendary fish if their condition ended
  for (const f of F.fish) if (f.S.cond && f.state === 'wander' && !condOK(f.S.cond) && F.phase !== 'fight') { f.state = 'flee'; f.tx = F.spot.W; f.cool = 99; f.ty = f.y; if (f.x > F.spot.W - 2) f.x = -99; }
  F.fish = F.fish.filter(f => f.x > -50);
  const held = mainHeld(), tilt = ((keys.KeyD || keys.ArrowRight || uiHeld('tr')) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft || uiHeld('tl')) ? 1 : 0);
  const l = F.lure, rod = ROD_BY[SAVE.rod], lure = LURE_BY[SAVE.lure];
  if (!blocked) {
    if (UI.clicked['menu'] || keyEdge.Escape || keyEdge.KeyP) { F.menu = true; return; }
    if (F.phase === 'idle') {
      F.rodAng = lerp(F.rodAng, -0.8, Math.min(1, dt * 6)); F.bend = lerp(F.bend, 0, Math.min(1, dt * 6));
      if (UI.clicked['lure-'] || keyEdge.KeyQ) cycleLure(-1);
      if (UI.clicked['lure+'] || keyEdge.KeyE) cycleLure(1);
      F.aim = clamp(F.aim + tilt * dt * 0.55, -0.5, 0.5);
      if (UI.pressed['@water']) { const w = unP(UI.mx * LK, UI.my * LK); if (w && w.x > 2) startCast(0, w.x, w.z); }
      else if (mainPressed()) { F.phase = 'charge'; F.charge = 0; F.cdir = 1; }
    } else if (F.phase === 'charge') {
      F.aim = clamp(F.aim + tilt * dt * 0.55, -0.5, 0.5);
      F.charge += F.cdir * dt * 1.15; if (F.charge >= 1) { F.charge = 1; F.cdir = -1; } if (F.charge <= 0) { F.charge = 0; F.cdir = 1; }
      F.rodAng = lerp(F.rodAng, -0.8 - 1.5 * F.charge, Math.min(1, dt * 12));
      if (!held) startCast(Math.max(0.1, F.charge));
    } else if (F.phase === 'cast') {
      const fl = l.fly; fl.t += dt / fl.dur;
      F.rodAng = lerp(F.rodAng, -0.3, Math.min(1, dt * 14));
      if (fl.t >= 1) { l.fly = null; F.phase = 'lure'; l.y = 0; spray(l.x, l.z, 10); Snd.sfx('splash'); F.rodAng = -0.55; }
    } else if (F.phase === 'lure') {
      const reeling = held;
      l.reeling = reeling; l.twitch = Math.max(0, l.twitch - dt * 1.5); l.wob = Math.max(0, l.wob - dt * 3);
      const prevX = l.x;
      if (reeling) { const nx = Math.max(0, l.x - 3.2 * rod.reel * lure.speed * dt); l.z *= l.x > 0.1 ? nx / l.x : 1; l.x = nx; l.y += lure.dive * dt; }
      else l.y += lure.sink * dt;
      if (keys.KeyW || keys.ArrowUp || uiHeld('up')) l.y -= 2.2 * dt;
      if (keys.KeyS || keys.ArrowDown || uiHeld('dn')) l.y += 2.2 * dt;
      if (lure.id === 'popper' || lure.id === 'worm' && false) { }
      if (jerkPressed() && !F.bite) { l.twitch = 1; l.y -= 0.7; l.x -= 0.3; Snd.sfx('tap'); if (lure.id === 'popper') { spray(l.x, l.z, 8); Snd.sfx('splash'); } }
      l.y = clamp(l.y, 0, bottomAt(l.x) - 0.25);
      l.spd = Math.abs(prevX - l.x) / Math.max(dt, 0.001);
      l.x = Math.max(0, l.x);
      F.rodAng = lerp(F.rodAng, reeling ? -0.62 : -0.5, Math.min(1, dt * 5)); F.bend = lerp(F.bend, 0.25, Math.min(1, dt * 5));
      F.reelSnd -= dt; if (reeling && F.reelSnd <= 0) { Snd.beep(160, 0.03, 'square', 0.015); F.reelSnd = 0.14; }
      // hook-set
      if (F.bite && (mainPressed() || jerkPressed() || UI.pressed['hook'])) { hookFish(F.bite); }
      else if (l.x <= 1.7) { retrieveLure(); }
    } else if (F.phase === 'fight') {
      updateFight(dt, held, tilt);
      if (F.fight) F.rodAng = lerp(F.rodAng, -0.85 + F.fight.tilt * 0.3, Math.min(1, dt * 8));
    } else if (F.phase === 'land') {
      F.land.t += dt; F.rodAng = lerp(F.rodAng, -1.3, Math.min(1, dt * 6)); F.bend = lerp(F.bend, 0.2, Math.min(1, dt * 6));
      if (F.land.t > 0.9) { const f = F.land.f; F.land = null; finishCatch(f); }
    }
  }
  for (const f of F.fish) { if (f.state !== 'hooked') updateFish(f, dt); }
  tickJumps(dt);
  if (held && (F.phase === 'lure' || F.phase === 'fight')) F.spin += dt * 14;
  if (F.wx === 'rain') { F.boltT -= dt; if (F.boltT <= 0) { F.boltT = rnd(9, 22); F.lightning = 1; F.bolt = { x: rnd(300, 900), seed: Math.random() * 999 }; setTimeout(() => Snd.noise(1.2, 0.12, 600, 60), 350); } }
  F.lightning = Math.max(0, F.lightning - dt * 2.5);
}
function cycleLure(d) {
  const owned = LURES.filter(l => SAVE.lures[l.id]); let i = owned.findIndex(l => l.id === SAVE.lure);
  i = (i + d + owned.length) % owned.length; SAVE.lure = owned[i].id; Snd.sfx('click'); saveGame();
}
function endTournament() {
  const T = F.tour; T.ended = true;
  const mine = tourScore();
  const all = [{ name: 'YOU', score: mine, me: true }].concat(T.rivals);
  all.sort((a, b) => b.score - a.score);
  T.ranking = all; T.place = all.findIndex(a => a.me);
  const mult = [4, 2, 1, 0][T.place]; T.prize = Math.round(F.spot.ent * mult);
  SAVE.money += T.prize; SAVE.stats.earned += T.prize;
  const rec = SAVE.tour[F.spot.id] || (SAVE.tour[F.spot.id] = { wins: 0, plays: 0, best: 0 });
  rec.plays++; if (T.place === 0) rec.wins++; rec.best = Math.max(rec.best, mine);
  saveGame();
  Snd.sfx(T.place === 0 ? 'rare' : 'catch');
  if (F.phase === 'lure') retrieveLure();
}
function leaveSpot() { saveGame(); F = null; scene = 'map'; Snd.mode = 'map'; }

function updateCard(dt) {
  const c = F.card; c.t += dt;
  if (F.tour) {
    if (c.t > 0.5 && (UI.clicked['card-ok'] || keyEdge.Space || keyEdge.Enter || UI.clicked['@canvas'])) closeCard(0);
    return;
  }
  if (c.t > 0.35) {
    if (UI.clicked['sell'] || keyEdge.Space || keyEdge.Enter) closeCard(1);
    else if (UI.clicked['release'] || keyEdge.KeyR || keyEdge.Escape) closeCard(2);
  }
}
function closeCard(mode) {
  const c = F.card, f = c.f;
  if (mode === 1) { SAVE.money += f.price; SAVE.stats.earned += f.price; SAVE.stats.sold++; Snd.sfx('buy'); }
  else if (mode === 2) { SAVE.stats.released++; const bonus = Math.round(f.price * 0.1); SAVE.money += bonus; Snd.sfx('click'); }
  if (f.size > 3) SAVE.stats.big++;
  F.card = null; F.phase = 'idle'; F.bend = 0; saveGame();
  spawnFish(false);
  if (F.tour && F.tour.left <= 0) endTournament();
}

function handleSpotMenu() {
  if (UI.clicked['m-resume'] || keyEdge.Escape || keyEdge.KeyP) { F.menu = false; Snd.sfx('back'); }
  else if (UI.clicked['m-leave']) { if (F.phase === 'fight') { return; } Snd.sfx('back'); leaveSpot(); }
  else if (UI.clicked['m-snd']) { Snd.on = !Snd.on; SAVE.sound = Snd.on; saveGame(); }
  else if (UI.clicked['m-mus']) { Snd.musicOn = !Snd.musicOn; SAVE.music = Snd.musicOn; saveGame(); }
  for (const l of LURES) if (UI.clicked['pick-' + l.id] && SAVE.lures[l.id] && (F.phase === 'idle')) { SAVE.lure = l.id; Snd.sfx('click'); saveGame(); }
}

// ---------------------------------------------------------------- camera
function screenToWorld(sx, sy) { const c = F.cam; return { x: (sx - VW / 2) / c.z + c.x, y: (sy - VH / 2) / c.z + c.y }; }
function updateCamera(dt) {
  const c = F.cam; let tz = 1, tx = VW / 2, ty = VH / 2;
  if (F.phase === 'fight' && F.fight) {
    // frame the angler's rod tip and the fish together, zooming in as far as that allows
    const fx = xPx(F.fight.f.x), fy = depthY(F.fight.f.y), L = 30, R = Math.max(fx + 110, 520), T = 26, B = Math.max(fy + 90, Y0 + 120);
    tz = clamp(Math.min(VW / (R - L), VH / (B - T)), 1, 1.28); tx = (L + R) / 2; ty = (T + B) / 2;
  }
  else if (F.phase === 'lure' && F.bite) { const [lx, ly] = [xPx(F.lure.x), depthY(F.lure.y)]; tz = 1.12; tx = (lx + VW / 2) / 2; ty = (ly + VH / 2) / 2; }
  else if (F.phase === 'land') { tz = 1.3; tx = 260; ty = Y0 - 10; }
  const k = 1 - Math.exp(-dt * 2.6);
  c.z = lerp(c.z, tz, k); c.x = lerp(c.x, tx, k); c.y = lerp(c.y, ty, k);
  const hw = VW / 2 / c.z, hh = VH / 2 / c.z;
  c.x = clamp(c.x, hw, VW - hw); c.y = clamp(c.y, hh, VH - hh);
}
// ambient-only simulation (used by the title screen)
function ambientUpdate(dt) {
  F.t += dt; tickJumps(dt); F.hour = (F.hour + dt / 120) % 24;
  for (const f of F.fish) updateFish(f, dt);
  if (Math.random() < dt * 3) F.bubbles.push({ x: xPx(rnd(2, F.spot.W - 1)), y: YB - 10, v: rnd(18, 40), s: rnd(1.5, 3.5), ph: rnd(6) });
  for (const b of F.bubbles) { b.y -= b.v * dt; b.ph += dt * 2; } F.bubbles = F.bubbles.filter(b => b.y > Y0);
  for (const r of F.ripples) { r.t -= dt; r.r += dt * 26; } F.ripples = F.ripples.filter(r => r.t > 0);
  if (Math.random() < dt * 0.4) { const f = pick(F.fish); if (f && f.hab !== 'b') { F.ripples.push({ x: xPx(f.x), r: 2, t: 1.2 }); } }
}

// fish leaping out of the water now and then (seen from the bank)
function tickJumps(dt) {
  for (const s of F.splash) s.t += dt; F.splash = F.splash.filter(s => s.t < 1.4);
  for (const j of F.jumps) j.t += dt; F.jumps = F.jumps.filter(j => j.t < 1);
  F.jumpT -= dt;
  if (F.jumpT <= 0) {
    F.jumpT = rnd(4, 11);
    const c = F.fish.filter(f => f.state === 'wander' && f.hab !== 'b' && f.x > 6);
    if (c.length) { const f = pick(c); F.jumps.push({ id: f.id, x: f.x, z: f.z, size: f.size, shiny: f.shiny, t: 0, fz: f.fz }); spray(f.x, f.z, 6); }
  }
}
