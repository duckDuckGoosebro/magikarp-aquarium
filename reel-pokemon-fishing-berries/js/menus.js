'use strict';
// ---------------------------------------------------------------- title / help / map / shop / journal / options
let scene = 'load';
let selSpot = 'pond', shopTab = 'rod', shopSel = 'old', jPage = 0, jFilter = 'all', jDetail = null, confirmReset = false, mapT = 0;
const PINS = { pond: [372, 352], river: [455, 255], coast: [692, 324], cave: [338, 196], deep: [818, 432], legend: [482, 142] };
const SPOT_ORDER = ['pond', 'river', 'coast', 'cave', 'deep', 'legend'];
let MAPCV = null;

function buildMap() {
  const M = 1.5, W = Math.round(VW * M), H = Math.round(VH * M);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const n1 = makeNoise(42), n2 = makeNoise(7), E = new Float32Array(W * H), P = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = x / M, wy = y / M, dx = wx - 478, dy = wy - 318, a = Math.atan2(dy / 212, dx / 300);
    const nn = 0.82 + 0.18 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 5 + 2) + 0.06 * Math.sin(a * 9);
    const r = Math.hypot(dx / 300, dy / 212) / nn;
    let e = (1 - r) * 0.9 + (fbm(wx * 0.012, wy * 0.012, 5, n1) - 0.5) * 0.5;
    e += 0.55 * Math.exp(-((wx - 280) ** 2 + (wy - 180) ** 2) / 9800) + 0.45 * Math.exp(-((wx - 505) ** 2 + (wy - 118) ** 2) / 8000);
    if (e > 0.3) e += 0.16 * (1 - Math.abs(fbm(wx * 0.035, wy * 0.035, 4, n2) * 2 - 1)) * clamp((e - 0.3) * 2.5, 0, 1);
    const pd = ((wx - 372) / 54) ** 2 + ((wy - 356) / 32) ** 2; if (pd < 1) { e = Math.min(e, -0.03 + pd * 0.05); P[y * W + x] = 1; }
    const sd = ((wx - 482) / 30) ** 2 + ((wy - 152) / 16) ** 2; if (sd < 1) { e = Math.min(e, -0.02); P[y * W + x] = 2; }
    E[y * W + x] = e;
  }
  const id = g.createImageData(W, H), d = id.data;
  const LAND = [[0, '#efdca4'], [0.05, '#e3d79a'], [0.07, '#8fd06a'], [0.25, '#62b452'], [0.42, '#3f8f48'], [0.6, '#6f7a5a'], [0.85, '#8f8a82'], [1.1, '#cfd3da'], [1.3, '#ffffff']];
  const SEA = [[0, '#7fe0f0'], [0.04, '#4cc0e6'], [0.14, '#2a8fd6'], [0.35, '#1b62ad'], [0.8, '#0f3d7a']];
  const ramp = (R, v) => { for (let i = 0; i < R.length - 1; i++) if (v <= R[i + 1][0]) return mixRGB(hexRGB(R[i][1]), hexRGB(R[i + 1][1]), clamp((v - R[i][0]) / (R[i + 1][0] - R[i][0]), 0, 1)); return hexRGB(R[R.length - 1][1]); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, e = E[i]; let col;
    if (e < 0) {
      col = P[i] === 1 ? mixRGB([95, 190, 235], [40, 120, 190], clamp(-e * 12, 0, 1)) : P[i] === 2 ? [170, 245, 255] : ramp(SEA, -e);
      if (e > -0.012 && !P[i]) col = mixRGB(col, [255, 255, 255], 0.55);
    } else {
      col = ramp(LAND, e);
      const xl = Math.max(0, x - 1), xr = Math.min(W - 1, x + 1), yu = Math.max(0, y - 1), yd = Math.min(H - 1, y + 1);
      const nx = E[y * W + xl] - E[y * W + xr], ny = E[yu * W + x] - E[yd * W + x], sh = clamp(1 + (nx + ny) * 55, 0.55, 1.4);
      const v = (NZ(x * 0.9, y * 0.9) - 0.5) * 14;
      col = [col[0] * sh + v, col[1] * sh + v, col[2] * sh + v];
    }
    const k = i * 4; d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  g.scale(M, M); const R = mulberry(77);
  const elev = (x, y) => E[Math.round(clamp(y * M, 0, H - 1)) * W + Math.round(clamp(x * M, 0, W - 1))];
  g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1.2;
  for (let i = 0; i < 140; i++) { const x = R() * VW, y = R() * VH; if (elev(x, y) > -0.05) continue; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 3, x + 12, y); g.quadraticCurveTo(x + 18, y + 3, x + 24, y); g.stroke(); }
  const river = () => { g.beginPath(); g.moveTo(488, 166); g.bezierCurveTo(492, 210, 440, 220, 455, 255); g.bezierCurveTo(470, 290, 540, 282, 600, 300); g.bezierCurveTo(660, 318, 705, 318, 770, 342); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  river(); g.strokeStyle = 'rgba(20,60,40,.35)'; g.lineWidth = 11; g.stroke();
  river(); g.strokeStyle = '#3aa6e6'; g.lineWidth = 7; g.stroke(); river(); g.strokeStyle = 'rgba(200,245,255,.6)'; g.lineWidth = 2; g.stroke();
  for (let i = 0; i < 900; i++) {
    const x = R() * VW, y = R() * VH, e = elev(x, y); if (e < 0.18 || e > 0.62) continue;
    const s = 2.6 + R() * 2.2, pine = e > 0.4;
    g.fillStyle = 'rgba(0,30,10,.3)'; g.beginPath(); g.ellipse(x + 1.5, y + 1, s * 0.9, s * 0.4, 0, 0, 7); g.fill();
    if (pine) { g.fillStyle = '#245a34'; g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x + s, y); g.lineTo(x - s, y); g.fill(); g.fillStyle = '#3a7a48'; g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x, y); g.lineTo(x - s, y); g.fill(); }
    else { g.fillStyle = '#2e7a3c'; g.beginPath(); g.arc(x, y - s * 0.6, s, 0, 7); g.fill(); g.fillStyle = '#5fb05a'; g.beginPath(); g.arc(x - s * 0.3, y - s * 0.9, s * 0.5, 0, 7); g.fill(); }
  }
  g.fillStyle = '#14122a'; g.beginPath(); g.ellipse(PINS.cave[0] - 2, PINS.cave[1] + 16, 14, 10, 0, Math.PI, 0); g.fill();
  const sg = g.createRadialGradient(482, 152, 2, 482, 152, 46); sg.addColorStop(0, 'rgba(255,255,255,.9)'); sg.addColorStop(0.4, 'rgba(170,240,255,.5)'); sg.addColorStop(1, 'rgba(170,240,255,0)'); g.fillStyle = sg; g.fillRect(430, 100, 110, 110);
  g.fillStyle = '#3f9d4a'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(345 + i * 9, 350 + (i % 3) * 8, 4, 2, 0, 0, 7); g.fill(); }
  [[560, 360], [574, 368], [552, 374], [585, 352]].forEach(([x, y], i) => { g.fillStyle = '#f2e8d8'; g.fillRect(x - 5, y - 4, 10, 7); g.fillStyle = ['#c0392b', '#2a62c4', '#e08a1e', '#7a56c8'][i]; g.beginPath(); g.moveTo(x - 7, y - 4); g.lineTo(x, y - 10); g.lineTo(x + 7, y - 4); g.fill(); });
  g.save(); g.translate(890, 470); g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -26); g.lineTo(6, 0); g.lineTo(-6, 0); g.fill(); } g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(0, -26); g.lineTo(6, 0); g.lineTo(-6, 0); g.fill(); g.restore();
  g.font = '800 13px ' + FONT; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('N', 890, 436);
  MAPCV = c;
}

function drawOcean() {
  if (!MAPCV) buildMap();
  ctx.imageSmoothingEnabled = false; ctx.drawImage(MAPCV, 0, 0, VW, VH);
  if (!TEX.clouds) buildTextures();
  for (let i = 0; i < 4; i++) {
    const w = 300, x = ((i * 330 + mapT * (10 + i * 3)) % (VW + w)) - w, y = 40 + i * 120;
    ctx.globalAlpha = 0.38; ctx.imageSmoothingEnabled = false; ctx.drawImage(TEX.clouds[i], x, y, w, 120);
  }
  ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
}

function drawBoat(x, y, t) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 2) * 2); ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.moveTo(-26, -4); ctx.lineTo(26, -4); ctx.lineTo(16, 10); ctx.lineTo(-16, 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(18, -6); ctx.lineTo(0, -6); ctx.fill(); ctx.fillStyle = '#e04646'; ctx.beginPath(); ctx.moveTo(-2, -32); ctx.lineTo(-18, -8); ctx.lineTo(-2, -8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 12, 34, 6, 0, 0, 7); ctx.stroke(); ctx.restore();
}
function spotSpeciesSeen(spot) {
  const ids = POOLS[spot.id].map(p => p[0]); let seen = 0; for (const id of ids) if (SAVE.dex[id]) seen++; return [seen, ids.length];
}

// ---------------------------------------------------------------- title (a live lake at sunset)
let LOGO = null;
function buildLogo() {
  const L = layer(760, 240, 1), save = ctx; const c = L.c, g = L.g;
  // draw with the shared text helpers by temporarily pointing them at the logo canvas
  const real = window.__ctxSwap || null;
  const draw = (s, x, y, size, c1, c2, stroke) => { g.font = size + 'px ' + HFONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'miter'; g.lineWidth = size * 0.22; g.strokeStyle = stroke; g.strokeText(s, x, y + size * 0.05); const gr = g.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillText(s, x, y); };
  draw('REEL', 380, 50, 24, '#fff6c8', '#ffb340', '#081830');
  draw('POKEMON', 380, 108, 64, '#ffffff', '#7cc8ff', '#081830');
  draw('FISHING', 380, 180, 48, '#ffe9a8', '#ff8a3a', '#301004');
  const w = document.createElement('canvas'); w.width = c.width; w.height = c.height; const wg = w.getContext('2d'); wg.drawImage(c, 0, 0); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = '#fff'; wg.fillRect(0, 0, w.width, w.height);
  LOGO = { c, w, k: SCALE_K };
}
function drawLogo(cx, cy) {
  if (!LOGO) buildLogo();
  ctx.imageSmoothingEnabled = false; ctx.drawImage(LOGO.c, cx - 380, cy - 110, 760, 240);
  const sx = cx - 330 + ((mapT * 220) % 1100);
  ctx.save(); ctx.beginPath(); ctx.moveTo(sx, cy - 110); ctx.lineTo(sx + 40, cy - 110); ctx.lineTo(sx - 20, cy + 130); ctx.lineTo(sx - 60, cy + 130); ctx.clip();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45; ctx.drawImage(LOGO.w, cx - 380, cy - 110, 760, 240); ctx.restore();
  ctx.imageSmoothingEnabled = false;
}
let TITLEF = null;
function titleSession() { if (!TITLEF) { TITLEF = makeSession('pond', false); TITLEF.hour = 18.2; TITLEF.wx = 'clear'; TITLEF.rodAng = -0.75; } return TITLEF; }
function updateTitle(dt) {
  mapT += dt;
  const keep = F; F = titleSession(); ambientUpdate(dt); if (F.hour > 19.4 || F.hour < 17) F.hour = 17.3; F = keep;
  if (UI.clicked['t-start'] || keyEdge.Enter) { Snd.sfx('click'); Snd.mode = 'map'; if (hasSave()) scene = 'map'; else { scene = 'help'; helpNext = 'map'; saveGame(); } }
  if (UI.clicked['t-help']) { Snd.sfx('click'); scene = 'help'; helpNext = 'title'; }
  if (UI.clicked['t-opt']) { Snd.sfx('click'); prevScene = 'title'; scene = 'options'; }
}
function drawTitle() {
  UI.hits = [];
  const keep = F; F = titleSession();
  LIGHT = lightColor(F.hour, F.wx, F.spot.env); ensurePanoTint(F); F.hz = 92; F.yaw = 0;
  toWorld(); px(); drawAboveView(); F = keep;
  toUI(); begin();
  const y = 118 + Math.sin(mapT * 1.4) * 3;
  drawLogo(VW / 2, y);
  const has = hasSave(), blink = Math.floor(mapT * 2) % 2;
  button('t-start', VW / 2 - 150, 300, 300, 56, has ? 'CONTINUE' : 'NEW GAME', { color: '#2f4fb0', size: 24 });
  button('t-help', VW / 2 - 150, 368, 145, 44, 'HOW TO PLAY', { color: '#2f4fb0', size: 15 });
  button('t-opt', VW / 2 + 5, 368, 145, 44, 'OPTIONS', { color: '#2f4fb0', size: 15 });
  if (blink) txt('PRESS START', VW / 2, 440, 22, '#ffffff', 'center');
  txt('POKEDEX ' + dexCount() + '/' + dexTotal() + '      SPRITES: PMDCOLLAB SPRITECOLLAB (CC BY-NC 4.0)', VW / 2, 522, 14, 'rgba(255,255,255,.75)', 'center');
}

// ---------------------------------------------------------------- how to play
const HELP = [
  ['1', 'Pick a spot on the map. Catch new Pokemon to unlock further spots.'],
  ['2', 'You stand behind your rod. Aim with LEFT/RIGHT (A D), hold X (Space) and let go to cast. Or tap the water.'],
  ['3', 'Hold X to reel the lure back. UP/DOWN (W S) change its depth. O (J) jerks it to tempt fish.'],
  ['4', 'Watch the LURE CAM and the SONAR. When a fish bites and HIT! flashes, press O (J or Space) fast!'],
  ['5', 'The view dives underwater for the fight. Hold X to gain line, keep the LINE gauge in the green.'],
  ['6', 'When the fish RUNS, tilt the rod the other way (LEFT/RIGHT). Let go of X if the line is about to snap!'],
  ['7', 'Sell fish for money, buy stronger rods and better lures, and win tournaments for big prizes.'],
  ['8', 'Night, rain and time of day change which Pokemon bite. Legendaries appear only in special conditions...'],
];
let prevScene = 'title', helpNext = 'title';
function updateHelp() { if (UI.clicked['h-ok'] || keyEdge.Enter || keyEdge.Escape) { Snd.sfx('click'); scene = helpNext; helpNext = 'title'; if (scene === 'map') Snd.mode = 'map'; } }
function drawHelp() {
  begin(); UI.hits = []; drawOcean(); toUI(); begin(); ctx.fillStyle = 'rgba(8,30,70,.55)'; ctx.fillRect(0, 0, VW, VH);
  panel(60, 36, 840, 468);
  txt('HOW TO PLAY', VW / 2, 70, 30, '#ffe36e', 'center');
  HELP.forEach((h, i) => { const y = 120 + i * 46; ctx.fillStyle = '#e08a1e'; ctx.beginPath(); ctx.arc(100, y, 16, 0, 7); ctx.fill(); txt(h[0], 100, y, 18, '#fff', 'center'); wrap(h[1], 130, y, 740, 17, '#fff', 20); });
  button('h-ok', VW / 2 - 100, 452, 200, 42, 'GOT IT!', { color: '#2f9a4a' });
}

// ---------------------------------------------------------------- options
function updateOptions() {
  if (UI.clicked['o-snd']) { Snd.on = !Snd.on; SAVE.sound = Snd.on; saveGame(); Snd.sfx('click'); }
  if (UI.clicked['o-mus']) { Snd.musicOn = !Snd.musicOn; SAVE.music = Snd.musicOn; saveGame(); }
  if (UI.clicked['o-gfx']) { window.GFX_4K = window.GFX_4K === false; SAVE.gfx4k = window.GFX_4K; saveGame(); fitCanvas(); }
  if (UI.clicked['o-reset']) { if (confirmReset) { resetSave(); loadSave(); confirmReset = false; Snd.sfx('no'); } else confirmReset = true; }
  if (UI.clicked['o-back'] || keyEdge.Escape) { Snd.sfx('back'); confirmReset = false; scene = prevScene === 'map' ? 'map' : 'title'; }
}
function drawOptions() {
  begin(); UI.hits = []; drawOcean(); toUI(); begin(); ctx.fillStyle = 'rgba(8,30,70,.55)'; ctx.fillRect(0, 0, VW, VH);
  panel(270, 90, 420, 360);
  txt('OPTIONS', VW / 2, 126, 28, '#ffe36e', 'center');
  button('o-snd', 310, 150, 340, 44, 'Sound effects: ' + (Snd.on ? 'ON' : 'OFF'), { color: '#3a6ea8' });
  button('o-mus', 310, 204, 340, 44, 'Music: ' + (Snd.musicOn ? 'ON' : 'OFF'), { color: '#3a6ea8' });
  button('o-gfx', 310, 258, 340, 44, 'Graphics: ' + (window.GFX_4K === false ? 'Auto (lighter)' : '4K (3840x2160)'), { color: '#3a6ea8' });
  button('o-reset', 310, 312, 340, 44, confirmReset ? 'TAP AGAIN TO ERASE EVERYTHING' : 'Reset save data', { color: '#c0392b', size: confirmReset ? 15 : 18 });
  button('o-back', 310, 378, 340, 44, 'BACK', { color: '#2f9a4a' });
}

// ---------------------------------------------------------------- map
function updateMap(dt) {
  mapT += dt;
  for (const id of SPOT_ORDER) if (UI.clicked['pin-' + id]) { selSpot = id; Snd.sfx('click'); }
  const sp = SPOT_BY[selSpot];
  if (UI.clicked['fish'] && spotUnlocked(sp)) { Snd.sfx('click'); enterSpot(selSpot, false); return; }
  if (UI.clicked['tour'] && spotUnlocked(sp)) { if (SAVE.money >= sp.ent) { SAVE.money -= sp.ent; saveGame(); Snd.sfx('buy'); enterSpot(selSpot, true); return; } else Snd.sfx('no'); }
  if (UI.clicked['m-shop']) { Snd.sfx('click'); scene = 'shop'; shopSel = shopTab === 'rod' ? SAVE.rod : SAVE.lure; }
  if (UI.clicked['m-dex']) { Snd.sfx('click'); scene = 'journal'; jPage = 0; jDetail = null; }
  if (UI.clicked['m-opt']) { Snd.sfx('click'); prevScene = 'map'; scene = 'options'; }
  if (UI.clicked['m-title']) { Snd.sfx('back'); scene = 'title'; Snd.mode = 'title'; }
}
function drawMap() {
  begin(); UI.hits = []; drawOcean(); drawBoat(PINS.deep[0] + 24, PINS.deep[1] + 30, mapT); toUI(); begin();
  // dashed route
  ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.beginPath();
  SPOT_ORDER.forEach((id, i) => { const p = PINS[id]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke(); ctx.setLineDash([]);
  // pins
  for (const id of SPOT_ORDER) {
    const sp = SPOT_BY[id], p = PINS[id], un = spotUnlocked(sp), sel = id === selSpot;
    const bob = sel ? Math.sin(mapT * 5) * 4 : 0;
    ctx.save(); ctx.translate(p[0], p[1] + bob);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 6, 12, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = un ? (sel ? '#ffd23f' : '#ff5a4d') : '#8b94a0'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.bezierCurveTo(-22, -16, -14, -42, 0, -42); ctx.bezierCurveTo(14, -42, 22, -16, 0, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -27, 7, 0, 7); ctx.fill();
    if (!un) { ctx.fillStyle = '#444'; ctx.fillRect(-4, -30, 8, 6); ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -31, 3.5, Math.PI, 0); ctx.stroke(); }
    ctx.restore();
    const lbl = sp.name; const w = txtw(lbl, 13) + 14; rrect(p[0] - w / 2, p[1] + 12, w, 20, 8); ctx.fillStyle = sel ? 'rgba(255,210,63,.95)' : 'rgba(8,30,70,.78)'; ctx.fill(); txt(lbl, p[0], p[1] + 22, 13, sel ? '#222' : '#fff', 'center', 'bold', false);
    region('pin-' + id, p[0] - 30, p[1] - 50, 60, 90);
  }
  // title ribbon
  rrect(300, 8, 360, 40, 14); ctx.fillStyle = 'rgba(8,30,70,.85)'; ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2.5; ctx.stroke(); txt('FISHING MAP', VW / 2, 28, 24, '#ffe36e', 'center');
  // info panel
  const sp = SPOT_BY[selSpot], un = spotUnlocked(sp), [seen, tot] = spotSpeciesSeen(sp);
  panel(10, 60, 250, 360);
  txt(sp.name, 135, 86, 19, '#ffe36e', 'center');
  wrap(sp.desc, 24, 116, 222, 13, '#dff2ff', 16);
  txt('Depth: up to ' + sp.D + ' m', 24, 190, 14, '#fff'); txt('Width: ' + sp.W + ' m', 24, 212, 14, '#fff');
  txt('Seen here: ' + seen + ' / ' + tot, 24, 236, 14, '#7dffa0');
  const tr = SAVE.tour[sp.id];
  txt('Tournament fee: ' + money(sp.ent), 24, 262, 13, '#ffd23f'); txt(tr ? 'Wins ' + tr.wins + ' / ' + tr.plays + ' · best ' + kgStr(tr.best) : 'Not entered yet', 24, 282, 12, '#bfe3ff');
  if (un) {
    button('fish', 24, 306, 222, 46, 'FISH HERE', { color: '#2f9a4a', size: 20 });
    button('tour', 24, 360, 222, 44, 'TOURNAMENT  ' + money(sp.ent), { color: '#c8921a', size: 15, disabled: SAVE.money < sp.ent });
  } else {
    wrap('LOCKED: discover ' + sp.unlock + ' different Pokémon to open this spot. (' + dexCount() + ' so far)', 24, 330, 222, 14, '#ffb4a8', 18);
  }
  // top-right money
  panel(VW - 190, 8, 180, 36, { r: 10 }); txt(money(SAVE.money), VW - 100, 26, 19, '#ffe36e', 'center');
  // bottom bar
  const rod = ROD_BY[SAVE.rod], lu = LURE_BY[SAVE.lure];
  panel(10, VH - 76, 940, 66, { r: 14 });
  button('m-shop', 22, VH - 68, 150, 50, 'TACKLE SHOP', { color: '#e08a1e', size: 16 });
  button('m-dex', 182, VH - 68, 150, 50, 'JOURNAL ' + dexCount() + '/' + dexTotal(), { color: '#7a56c8', size: 15 });
  button('m-opt', 342, VH - 68, 110, 50, 'OPTIONS', { color: '#5a6a80', size: 15 });
  button('m-title', 462, VH - 68, 90, 50, 'TITLE', { color: '#5a6a80', size: 15 });
  txt('Rod: ' + rod.name, 600, VH - 52, 15, '#fff'); txt('Lure: ' + lu.name, 600, VH - 30, 15, '#fff');
  drawLure(lu.id, 800, VH - 42, 1.9, 0, mapT);
  txt('Caught ' + SAVE.stats.caught, 900, VH - 42, 14, '#bfe3ff', 'right');
}

// ---------------------------------------------------------------- shop
function statBar(x, y, w, label, v, max, col) {
  txt(label, x, y, 13, '#bfe3ff'); rrect(x + 84, y - 7, w, 14, 7); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
  rrect(x + 86, y - 5, Math.max(6, (w - 4) * clamp(v / max, 0, 1)), 10, 5); ctx.fillStyle = col; ctx.fill();
}
function updateShop() {
  if (UI.clicked['s-back'] || keyEdge.Escape) { Snd.sfx('back'); scene = 'map'; saveGame(); return; }
  if (UI.clicked['tab-rod']) { shopTab = 'rod'; shopSel = SAVE.rod; Snd.sfx('click'); }
  if (UI.clicked['tab-lure']) { shopTab = 'lure'; shopSel = SAVE.lure; Snd.sfx('click'); }
  const list = shopTab === 'rod' ? RODS : LURES;
  for (const it of list) if (UI.clicked['it-' + it.id]) { shopSel = it.id; Snd.sfx('click'); }
  if (UI.clicked['s-buy']) {
    const it = (shopTab === 'rod' ? ROD_BY : LURE_BY)[shopSel], bag = shopTab === 'rod' ? SAVE.rods : SAVE.lures;
    if (bag[it.id]) { if (shopTab === 'rod') SAVE.rod = it.id; else SAVE.lure = it.id; Snd.sfx('click'); }
    else if (SAVE.money >= it.price) { SAVE.money -= it.price; bag[it.id] = 1; if (shopTab === 'rod') SAVE.rod = it.id; else SAVE.lure = it.id; Snd.sfx('buy'); }
    else Snd.sfx('no');
    saveGame();
  }
}
function drawShop() {
  begin(); UI.hits = []; drawOcean(); toUI(); begin(); ctx.fillStyle = 'rgba(8,30,70,.6)'; ctx.fillRect(0, 0, VW, VH);
  txt('TACKLE SHOP', 30, 36, 28, '#ffe36e'); panel(VW - 200, 10, 190, 36, { r: 10 }); txt(money(SAVE.money), VW - 105, 28, 19, '#ffe36e', 'center');
  button('tab-rod', 30, 64, 140, 40, 'RODS', { color: shopTab === 'rod' ? '#e08a1e' : '#3a6ea8' });
  button('tab-lure', 178, 64, 140, 40, 'LURES', { color: shopTab === 'lure' ? '#e08a1e' : '#3a6ea8' });
  button('s-back', VW - 150, 64, 120, 40, 'BACK', { color: '#5a6a80' });
  const list = shopTab === 'rod' ? RODS : LURES, bag = shopTab === 'rod' ? SAVE.rods : SAVE.lures, cur = shopTab === 'rod' ? SAVE.rod : SAVE.lure;
  const cols = 3, cw = 188, ch = shopTab === 'rod' ? 160 : 108;
  list.forEach((it, i) => {
    const x = 30 + (i % cols) * (cw + 8), y = 118 + Math.floor(i / cols) * (ch + 8), owned = !!bag[it.id], sel = it.id === shopSel;
    rrect(x, y, cw, ch, 12); ctx.fillStyle = sel ? 'rgba(255,210,63,.3)' : 'rgba(10,28,52,.85)'; ctx.fill(); ctx.lineWidth = sel ? 3.5 : 2; ctx.strokeStyle = sel ? '#ffd23f' : '#7fd4ff'; ctx.stroke();
    if (shopTab === 'rod') drawRod(x + 30, y + ch - 48, -0.75, 0.4, it, 92); else drawLure(it.id, x + 36, y + 40, 2.1, 0, mapT);
    txt(it.name, x + (shopTab === 'rod' ? 10 : 70), y + (shopTab === 'rod' ? 18 : 24), 14, '#fff');
    txt(owned ? (cur === it.id ? 'EQUIPPED' : 'owned') : money(it.price), x + (shopTab === 'rod' ? 10 : 70), y + (shopTab === 'rod' ? 38 : 48), 13, owned ? '#7dffa0' : '#ffe36e');
    region('it-' + it.id, x, y, cw, ch);
  });
  // detail
  const it = (shopTab === 'rod' ? ROD_BY : LURE_BY)[shopSel], owned = !!bag[it.id];
  const px = 640, pw = 290;
  panel(px, 118, pw, 394);
  txt(it.name, px + pw / 2, 146, 22, '#ffe36e', 'center');
  if (shopTab === 'rod') {
    drawRod(px + 40, 270, -0.8, 0.6, it, 150);
    statBar(px + 14, 304, 150, 'Line', it.line, 200, '#ff7a7a'); statBar(px + 14, 330, 150, 'Cast', it.cast, 64, '#7ad0ff'); statBar(px + 14, 356, 150, 'Reel', it.reel, 2.4, '#8aff7a');
  } else {
    drawLure(it.id, px + pw / 2, 214, 4, 0, mapT);
    statBar(px + 14, 270, 150, 'Size', it.size, 4, '#ffd27a'); statBar(px + 14, 294, 150, 'Sinks', Math.max(0, it.sink) + 0.2, 2.6, '#7ad0ff'); statBar(px + 14, 318, 150, 'Appeal', it.app, 1.6, '#8aff7a');
    statBar(px + 14, 342, 150, 'Surface', it.hab.s, 2.4, '#bfe3ff'); statBar(px + 14, 366, 150, 'Mid', it.hab.m, 2.4, '#7ac7ff'); statBar(px + 14, 390, 150, 'Bottom', it.hab.b, 2.4, '#b58cff');
  }
  wrap(it.desc, px + 14, shopTab === 'rod' ? 392 : 424, pw - 28, 13, '#dff2ff', 16);
  const canBuy = owned || SAVE.money >= it.price;
  button('s-buy', px + 20, 462, pw - 40, 42, owned ? (cur === it.id ? 'EQUIPPED' : 'EQUIP') : 'BUY  ' + money(it.price), { color: owned ? '#3a6ea8' : '#2f9a4a', disabled: !canBuy || (owned && cur === it.id) });
}

// ---------------------------------------------------------------- journal
function journalList() {
  let ids;
  if (jFilter === 'all') ids = Object.keys(SPECIES).sort((a, b) => a.localeCompare(b));
  else ids = POOLS[jFilter].map(p => p[0]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => SPECIES[a].rar - SPECIES[b].rar || a.localeCompare(b));
  return ids;
}
function updateJournal() {
  if (jDetail) { if (UI.clicked['@canvas'] || UI.clicked['j-close'] || keyEdge.Escape || keyEdge.Enter) { jDetail = null; Snd.sfx('back'); } return; }
  if (UI.clicked['j-back'] || keyEdge.Escape) { Snd.sfx('back'); scene = 'map'; return; }
  const ids = journalList(), pages = Math.max(1, Math.ceil(ids.length / 40));
  if (UI.clicked['j-prev'] || keyEdge.ArrowLeft) { jPage = (jPage - 1 + pages) % pages; Snd.sfx('click'); }
  if (UI.clicked['j-next'] || keyEdge.ArrowRight) { jPage = (jPage + 1) % pages; Snd.sfx('click'); }
  for (const f of ['all'].concat(SPOT_ORDER)) if (UI.clicked['jf-' + f]) { jFilter = f; jPage = 0; Snd.sfx('click'); }
  const start = jPage * 40;
  for (let i = 0; i < 40; i++) { const id = ids[start + i]; if (id && UI.clicked['jc-' + id] && SAVE.dex[id]) { jDetail = id; Snd.sfx('click'); } }
}
function drawJournal() {
  begin(); UI.hits = []; drawOcean(); toUI(); begin(); ctx.fillStyle = 'rgba(8,30,70,.72)'; ctx.fillRect(0, 0, VW, VH);
  txt('JOURNAL', 24, 28, 26, '#ffe36e'); txt(dexCount() + ' / ' + dexTotal() + ' species', 170, 30, 16, '#7dffa0');
  button('j-back', VW - 120, 10, 104, 38, 'BACK', { color: '#5a6a80' });
  const tabs = ['all'].concat(SPOT_ORDER); tabs.forEach((f, i) => { const nm = f === 'all' ? 'ALL' : SPOT_BY[f].name.split(' ')[0].toUpperCase(); button('jf-' + f, 24 + i * 126, 54, 120, 32, nm, { color: jFilter === f ? '#e08a1e' : '#3a6ea8', size: 13 }); });
  const ids = journalList(), pages = Math.max(1, Math.ceil(ids.length / 40)); jPage = Math.min(jPage, pages - 1);
  const start = jPage * 40;
  for (let i = 0; i < 40; i++) {
    const id = ids[start + i]; if (!id) break;
    const x = 20 + (i % 8) * 116, y = 98 + Math.floor(i / 8) * 76, S = SPECIES[id], d = SAVE.dex[id];
    rrect(x, y, 110, 70, 10); ctx.fillStyle = d ? 'rgba(30,70,120,.9)' : 'rgba(10,20,40,.85)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = d ? (d.shiny ? '#ffe36e' : '#7fd4ff') : '#33425e'; ctx.stroke();
    drawMon(id, x + 32, y + 36, 46, false, mapT, { sil: !d, frame: 0 });
    txt(d ? S.name : '???', x + 58, y + 18, S.name.length > 8 ? 10 : 12, d ? '#fff' : '#7f8aa0', 'left', 'bold', false);
    txt('★'.repeat(S.rar), x + 58, y + 36, 10, d ? '#ffd23f' : '#4a556e', 'left', 'bold', false);
    if (d) txt('x' + d.n + (d.shiny ? ' ✦' : ''), x + 58, y + 54, 11, '#bfe3ff', 'left', 'bold', false);
    region('jc-' + id, x, y, 110, 70);
  }
  button('j-prev', 340, VH - 46, 60, 36, '<', { color: '#3a6ea8' }); button('j-next', 560, VH - 46, 60, 36, '>', { color: '#3a6ea8' });
  txt('Page ' + (jPage + 1) + ' / ' + pages, VW / 2, VH - 28, 16, '#fff', 'center');
  if (jDetail) {
    const id = jDetail, S = SPECIES[id], d = SAVE.dex[id];
    ctx.fillStyle = 'rgba(0,10,25,.8)'; ctx.fillRect(0, 0, VW, VH);
    panel(200, 60, 560, 420, { stroke: d.shiny ? '#ffe36e' : '#7fd4ff' });
    drawMon(id, 360, 220, 150, false, mapT, { shiny: d.shiny && Math.floor(mapT / 2) % 2 === 1 });
    txt(S.name, 360, 340, 26, '#fff', 'center'); txt('★'.repeat(S.rar) + '☆'.repeat(6 - S.rar), 360, 368, 18, '#ffd23f', 'center');
    const hab = { s: 'Surface', m: 'Mid-water', b: 'Bottom' }[S.hab], act = { a: 'Any time', d: 'Daytime', n: 'Night' }[S.act];
    const lines = ['Habitat: ' + hab, 'Active: ' + act + (S.cond ? ' (' + S.cond + ' only)' : ''), 'Typical size: ' + lenStr(S.h * 0.62) + ' – ' + lenStr(S.h * 1.45), 'Caught: ' + d.n + (d.shiny ? '   ✦ shiny found' : ''), 'Best length: ' + lenStr(d.best), 'Best weight: ' + kgStr(d.bestKg)];
    lines.forEach((l, i) => txt(l, 480, 130 + i * 32, 16, '#dff2ff'));
    const where = SPOT_ORDER.filter(s => POOLS[s].some(p => p[0] === id)).map(s => SPOT_BY[s].name).join(', ');
    txt('Found at:', 480, 330, 15, '#ffe36e'); wrap(where, 480, 354, 260, 14, '#fff', 18);
    button('j-close', 440, 430, 160, 36, 'CLOSE', { color: '#3a6ea8' });
  }
}
