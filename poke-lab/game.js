/* Poké Lab: walk through 8 connected cities. All art is Pokémon GBA (Emerald). World data is world.js (made by tools/build_world.py). */
const T = 16;                                   // tile size in game pixels
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const DIRS = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};
const OPP = {up: 'down', down: 'up', left: 'right', right: 'left'};
const SIDE = {up: 'n', down: 's', left: 'w', right: 'e'};

/* ---------- images ---------- */
const IMG = {};
function img(src) {
  if (IMG[src]) return IMG[src];
  const im = new Image(); im.src = src + '?v=6'; im.ready = false;
  im.onload = () => { im.ready = true; }; IMG[src] = im; return im;
}
const whenReady = list => Promise.all(list.map(im => im.ready ? 1 : new Promise(r => { im.addEventListener('load', r); im.addEventListener('error', r); if (im.complete && im.naturalWidth) { im.ready = true; r(); } })));

/* ---------- sprite sheets ---------- */
// GBA trainer sheet: 9 frames of 16x32: down, up, left, then walk frames (down A/B, up A/B, left A/B). Right = left mirrored.
function drawTrainer(sheet, face, moving, parity, x, y) {
  const im = img(`assets/trainers/${sheet}.png`); if (!im.ready) return;
  const base = {down: 0, up: 1, left: 2, right: 2}[face];
  const walk = {down: 3, up: 5, left: 7, right: 7}[face] + parity;
  const f = moving ? walk : base, h = im.naturalHeight, flip = face === 'right';
  const dy = Math.round(y) - (h - 16);
  x = Math.round(x);
  if (flip) { ctx.save(); ctx.translate(x + 16, dy); ctx.scale(-1, 1); ctx.drawImage(im, f * 16, 0, 16, h, 0, 0, 16, h); ctx.restore(); }
  else ctx.drawImage(im, f * 16, 0, 16, h, x, dy, 16, h);
}
// follower sheet: 4 frames x 4 rows (down, left, right, up) of 32x32
function drawMon(dex, face, frame, x, y) {
  const im = img(`assets/followers/${dex}.png`); if (!im.ready) return;
  const row = {down: 0, left: 1, right: 2, up: 3}[face];
  ctx.drawImage(im, (frame % 4) * 32, row * 32, 32, 32, Math.round(x - 8), Math.round(y - 14), 32, 32);
}

/* ---------- game state ---------- */
const STORE = 'pokelab-save-1';
let save = {visited: {}, at: null};
try { save = Object.assign(save, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) {}
const RT = {};          // runtime per map (people and Pokémon keep their place when you come back)
let cur = null, M = null, view = null;
const P = {x: 0, y: 0, dir: 'down', p: 0, moving: false, parity: 0, sheet: 'brendan'};
const F = {dex: 137, x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, dir: 'down'};   // the Pokémon that follows you
let talking = false, busy = false, frame = 0;
const held = [];

function rt(mid) {
  if (RT[mid]) return RT[mid];
  const m = WORLD.maps[mid];
  const mk = (o, kind) => ({...o, kind, hx: o.x, hy: o.y, dir: 'down', p: 0, moving: false, wait: 40 + Math.random() * 200, parity: 0});
  RT[mid] = {npcs: m.npcs.map(o => mk(o, 'npc')), mons: m.mons.map(o => mk(o, 'mon'))};
  return RT[mid];
}
const solidAt = (m, x, y) => x < 0 || y < 0 || x >= m.w || y >= m.h || m.solid[y][x] === '1';
function entityAt(x, y, except) {
  for (const o of [...view.npcs, ...view.mons]) {
    if (o === except) continue;
    if ((o.x === x && o.y === y) || (o.moving && o.tx === x && o.ty === y)) return o;
  }
  if (except !== P && ((P.x === x && P.y === y) || (P.moving && P.tx === x && P.ty === y))) return P;
  return null;
}

/* ---------- loading and switching maps ---------- */
function preload(mid) {
  const m = WORLD.maps[mid], l = [img(`assets/maps/${mid}_bottom.png`), img(`assets/maps/${mid}_top.png`)];
  for (const n of m.npcs) l.push(img(`assets/trainers/${n.sheet}.png`));
  for (const o of m.mons) l.push(img(`assets/followers/${o.dex}.png`));
  return l;
}
async function enter(mid, x, y, dir) {
  busy = true; $('fade').style.opacity = 1;
  await whenReady(preload(mid).concat(img('assets/trainers/brendan.png'), img(`assets/followers/${F.dex}.png`)));
  cur = mid; M = WORLD.maps[mid]; view = rt(mid);
  P.x = x; P.y = y; P.dir = dir; P.moving = false; P.p = 0;
  F.x = F.sx = F.tx = x; F.y = F.sy = F.ty = y; F.dir = dir;
  for (const o of [...view.npcs, ...view.mons]) if ((o.x === x && o.y === y) || (o.moving && o.tx === x && o.ty === y)) { o.x = o.hx; o.y = o.hy; o.moving = false; }
  save.visited[mid] = 1; save.at = {map: mid, x, y};
  try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) {}
  banner(M.name);
  setTimeout(() => { $('fade').style.opacity = 0; busy = false; }, 60);
  Object.values(M.conn).forEach(c => whenReady(preload(c.to)));       // warm up the next maps
  hud();
}
function hud() {
  const cities = WORLD.cities.filter(c => save.visited[c]).length;
  $('hud').innerHTML = `${M.name}<br>Towns ${cities}/8`;
}
let bannerT = 0;
function banner(t) { const b = $('banner'); b.textContent = t; b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 2200); }

/* ---------- talking ---------- */
function say(text) { $('msg').innerHTML = text.replace(/</g, '&lt;') + '<i>▼</i>'; $('msg').style.display = 'block'; talking = true; document.body.classList.add('talk'); held.length = 0; }
function closeMsg() { $('msg').style.display = 'none'; talking = false; document.body.classList.remove('talk'); }
function interact() {
  if (busy) return;
  if ($('wm').style.display === 'flex') return toggleMap();
  if (talking) return closeMsg();
  if (P.moving) return;
  const [dx, dy] = DIRS[P.dir], x = P.x + dx, y = P.y + dy;
  const o = entityAt(x, y, P);
  if (o && o !== P) {
    o.dir = OPP[P.dir]; o.wait = 150;
    if (o.kind === 'mon') return say(`${WORLD.names[o.dex] || 'Pokémon'}: ${['Bzzt!', 'Pika!', 'Rawr!', 'Gru gru!', 'Kyuu!'][o.dex % 5]}\n(A Pokémon is wandering around.)`);
    return say("What's up austin-o!\n" + o.text);        // every person greets you first
  }
  const s = M.signs.find(s => s.x === x && s.y === y) || M.doors.find(d => d.x === x && d.y === y);
  if (s) return say(s.text);
  if (F.x === x && F.y === y) say(`${WORLD.names[F.dex]} is following you!`);
}

/* ---------- input ---------- */
const KEYS = {ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'};
const press = d => { release(d); held.push(d); };
const release = d => { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); };
addEventListener('keydown', e => {
  if (KEYS[e.code]) { e.preventDefault(); if (!talking) press(KEYS[e.code]); }
  else if (['Space', 'Enter', 'KeyZ'].includes(e.code)) { e.preventDefault(); if (!e.repeat) interact(); }
  else if (e.code === 'KeyM' && !e.repeat) toggleMap();
  else if (e.code === 'Escape') { if (talking) closeMsg(); else if ($('wm').style.display === 'flex') toggleMap(); }
});
addEventListener('keyup', e => { if (KEYS[e.code]) release(KEYS[e.code]); });
for (const b of document.querySelectorAll('#pad button')) {
  const d = b.dataset.d;
  b.addEventListener('pointerdown', e => { e.preventDefault(); if (talking) return closeMsg(); press(d); b.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => release(d));
}
$('abtn').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
$('mbtn').addEventListener('pointerdown', e => { e.preventDefault(); toggleMap(); });
$('msg').addEventListener('pointerdown', closeMsg);
$('wm').addEventListener('pointerdown', toggleMap);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- world map (all 8 cities and the routes between them) ---------- */
function toggleMap() {
  const w = $('wm'); if (talking) return;
  if (w.style.display === 'flex') { w.style.display = 'none'; return; }
  w.style.display = 'flex'; drawWorldMap(); held.length = 0;
}
const OVIMG = new Image(); OVIMG.src = 'assets/overview.png?v=6';
function drawWorldMap() {
  const c = $('wmc'), g = c.getContext('2d'), O = WORLD.overview;
  c.width = O.w; c.height = O.h; g.imageSmoothingEnabled = false;
  if (OVIMG.complete) g.drawImage(OVIMG, 0, 0); else OVIMG.onload = drawWorldMap;
  g.textAlign = 'center'; const font = n => `${n}px "Press Start 2P", monospace`;
  // route numbers on the roads
  g.font = font(11);
  for (const r of WORLD.routes) {
    const p = O.routes[r.id], a = p[Math.floor((p.length - 1) / 2)], b = p[Math.floor((p.length - 1) / 2) + 1], x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2;
    g.fillStyle = '#102040'; g.fillRect(x - 24, y - 12, 48, 22); g.fillStyle = cur === r.id ? '#ffd040' : '#fff'; g.fillText('R' + r.num, x, y + 5);
  }
  // town names
  for (const id of WORLD.cities) {
    const [x, y] = O.cities[id], here = id === cur, seen = save.visited[id];
    g.font = font(12); const w = g.measureText(WORLD.maps[id].name).width + 20;
    g.fillStyle = here ? '#ffd040' : seen ? '#98e098' : '#ffffff'; g.strokeStyle = '#102040'; g.lineWidth = 4;
    g.fillRect(x - w / 2, y + 40, w, 26); g.strokeRect(x - w / 2, y + 40, w, 26);
    g.fillStyle = '#102040'; g.fillText(WORLD.maps[id].name, x, y + 59);
  }
  // you are here (blinks)
  let px, py;
  if (cur.startsWith('route')) {
    const p = O.routes[cur], c0 = M.conn, sides = Object.entries(c0);
    const [sa, ca] = sides[0], [sb, cb] = sides[1] || sides[0];
    const at = (s, cc) => ({n: [cc.from + 1.5, 0], s: [cc.from + 1.5, M.h], w: [0, cc.from + 1.5], e: [M.w, cc.from + 1.5]}[s]);
    const A = at(sa, ca), B = at(sb, cb);
    const d = (P.x + 0.5 - A[0]) ** 2 + (P.y + 0.5 - A[1]) ** 2, tot = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    let t = Math.min(1, Math.sqrt(d) / (Math.hypot(B[0] - A[0], B[1] - A[1]) || 1));
    // walk along the polyline; polyline runs from the first city to the second, and sides[0] is whichever gap comes first in conn order
    const r = WORLD.routes.find(r => r.id === cur), firstIsA = c0[sa].to === r.a;
    if (!firstIsA) t = 1 - t;
    let len = 0; const seg = [];
    for (let i = 0; i + 1 < p.length; i++) { const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); seg.push(l); len += l; }
    let k = t * len; px = p[p.length - 1][0]; py = p[p.length - 1][1];
    for (let i = 0; i < seg.length; i++) { if (k <= seg[i]) { px = p[i][0] + (p[i + 1][0] - p[i][0]) * k / (seg[i] || 1); py = p[i][1] + (p[i + 1][1] - p[i][1]) * k / (seg[i] || 1); break; } k -= seg[i]; }
  } else [px, py] = O.cities[cur];
  if (Math.floor(performance.now() / 400) % 2 === 0 || !wmAnim) {
    g.fillStyle = '#e02020'; g.strokeStyle = '#fff'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(px, py - 8); g.lineTo(px - 14, py - 34); g.lineTo(px + 14, py - 34); g.closePath(); g.fill(); g.stroke();
  }
  g.font = font(14); g.fillStyle = '#fff'; g.strokeStyle = '#102040'; g.lineWidth = 6;
  const label = cur.startsWith('route') ? `You are on ${M.name}` : `You are in ${M.name}`;
  g.strokeText(label, c.width / 2, 36); g.fillText(label, c.width / 2, 36);
}
let wmAnim = 0;
setInterval(() => { if ($('wm').style.display === 'flex') { wmAnim = 1; drawWorldMap(); } }, 400);

/* ---------- movement ---------- */
const SPD = 1.5;
function tryMove(o, d, isPlayer) {
  const [dx, dy] = DIRS[d], nx = o.x + dx, ny = o.y + dy;
  o.dir = d;
  if (nx < 0 || ny < 0 || nx >= M.w || ny >= M.h) {                    // walking off the map into the next one
    if (!isPlayer) return false;
    const side = SIDE[d], c = M.conn[side], t = dx ? o.y : o.x;
    if (!c || t < c.from || t >= c.from + c.len) return false;
    const to = WORLD.maps[c.to], tt = c.start + (t - c.from);
    const at = {n: [tt, to.h - 1], s: [tt, 0], w: [to.w - 1, tt], e: [0, tt]}[side];
    enter(c.to, at[0], at[1], d);
    return false;
  }
  if (solidAt(M, nx, ny) || entityAt(nx, ny, o)) return false;
  o.tx = nx; o.ty = ny; o.moving = true; o.p = 0;
  return true;
}
function finishStep(o) { o.x = o.tx; o.y = o.ty; o.moving = false; o.p = 0; o.parity ^= 1; }
const pos = o => o.moving ? [o.x * T + DIRS[o.dir][0] * o.p, o.y * T + DIRS[o.dir][1] * o.p] : [o.x * T, o.y * T];

function update() {
  frame++;
  if (busy || !M) return;
  if (P.moving) {
    P.p += SPD;
    if (P.p >= T) { finishStep(P); F.x = F.tx; F.y = F.ty; }
  }
  if (!P.moving && !talking && $('wm').style.display !== 'flex' && held.length) {
    const px = P.x, py = P.y, d = held[held.length - 1];
    if (tryMove(P, d, true) && P.moving) { F.sx = F.x; F.sy = F.y; F.tx = px; F.ty = py; F.dir = d; }
  }
  if (!M) return;
  for (const o of [...view.npcs, ...view.mons]) {
    if (o.moving) { o.p += SPD; if (o.p >= T) finishStep(o); continue; }
    if (o.kind === 'npc' && !o.wander) continue;
    if (talking || --o.wait > 0) continue;
    o.wait = 60 + Math.random() * 220;
    const d = Object.keys(DIRS)[Math.floor(Math.random() * 4)], [dx, dy] = DIRS[d];
    const nx = o.x + dx, ny = o.y + dy;
    o.dir = d;
    if (Math.abs(nx - o.hx) > 3 || Math.abs(ny - o.hy) > 3 || nx < 2 || ny < 2 || nx >= M.w - 2 || ny >= M.h - 2) continue;
    if (solidAt(M, nx, ny) || entityAt(nx, ny, o)) continue;
    o.tx = nx; o.ty = ny; o.moving = true; o.p = 0;
  }
}

/* ---------- drawing ---------- */
let S = 3;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  S = Math.max(2, Math.floor(Math.min(cv.width / (15 * T), cv.height / (10 * T))));
}
addEventListener('resize', resize); resize();

function draw() {
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!M) return;
  const vw = cv.width / S, vh = cv.height / S, W = M.w * T, H = M.h * T;
  const [ppx, ppy] = pos(P);
  let cx = W <= vw ? (W - vw) / 2 : Math.min(Math.max(ppx + 8 - vw / 2, 0), W - vw);
  let cy = H <= vh ? (H - vh) / 2 : Math.min(Math.max(ppy + 8 - vh / 2, 0), H - vh);
  cx = Math.round(cx); cy = Math.round(cy);
  ctx.setTransform(S, 0, 0, S, -cx * S, -cy * S);
  ctx.drawImage(img(`assets/maps/${cur}_bottom.png`), 0, 0);
  // everything standing on the ground, sorted by its feet so things in front hide things behind
  const list = [];
  let fxp, fyp;
  if (P.moving) { const k = P.p / T; fxp = (F.sx + (F.tx - F.sx) * k) * T; fyp = (F.sy + (F.ty - F.sy) * k) * T; }
  else { fxp = F.x * T; fyp = F.y * T; }
  list.push({y: fyp + 15, f: () => drawMon(F.dex, F.dir, P.moving ? (frame >> 3) : 0, fxp, fyp)});
  for (const o of view.mons) { const [x, y] = pos(o); list.push({y: y + 15, f: () => drawMon(o.dex, o.dir, o.moving ? (frame >> 3) : (frame >> 5), x, y)}); }
  for (const o of view.npcs) { const [x, y] = pos(o); list.push({y: y + 15, f: () => drawTrainer(o.sheet, o.dir, o.moving, o.parity, x, y)}); }
  list.push({y: ppy + 16, f: () => drawTrainer(P.sheet, P.dir, P.moving, P.parity, ppx, ppy)});
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());
  ctx.drawImage(img(`assets/maps/${cur}_top.png`), 0, 0);          // roofs and treetops go over the people
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

let acc = 0, last = performance.now();
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw(); requestAnimationFrame(loop);
}

/* ---------- start ---------- */
(async function start() {
  const s = save.at && WORLD.maps[save.at.map] ? save.at : WORLD.start;
  await enter(s.map, s.x, s.y, 'down');
  requestAnimationFrame(loop);
})();
window.GAME = {P, F, RT, WORLD, enter, get M() { return M; }, get cur() { return cur; }, held, interact};
