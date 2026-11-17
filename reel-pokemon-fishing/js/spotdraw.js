'use strict';
// ================================================================ the fishing scene, PS1 Reel Fishing style
// Above water: you look out over the lake from behind your rod (first person). Aim, cast, watch the line.
// Under water: a "lure cam" window follows your lure; when a fish is hooked the whole screen goes underwater.
const NIGHTK = [[0, 1], [5, 1], [7, 0.25], [9, 0], [16, 0], [18, 0.3], [20, 1], [24, 1]];
function nightness(h) {
  if (F.spot.cave) return 0.55;
  const k = F.spot.env === 'legend' ? 0.55 : 1;
  for (let i = 0; i < NIGHTK.length - 1; i++) { const a = NIGHTK[i], b = NIGHTK[i + 1]; if (h >= a[0] && h <= b[0]) return k * lerp(a[1], b[1], (h - a[0]) / (b[0] - a[0])); }
  return k;
}
function sunPos(h) { if (h < 5.8 || h > 18.4) return null; const t = (h - 5.8) / 12.6; return [lerp(70, 900, t), Y0 - 6 - Math.sin(Math.PI * t) * 130, t]; }
function moonPos(h) { const t = ((h - 18.6 + 24) % 24) / 11; if (t < 0 || t > 1) return null; return [lerp(90, 880, t), Y0 - 10 - Math.sin(Math.PI * t) * 120]; }
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const PIP = { x: 6, y: LH - 102, w: 168, h: 96 };   // lure-cam window in world-buffer pixels

// ---------------------------------------------------------------- frame
function drawSpot() {
  toWorld(); px(); UI.hits = []; region('@water', 0, 0, VW, VH);
  LIGHT = lightColor(F.hour, F.wx, F.spot.env); ensurePanoTint(F);
  F.hz = 72 + Math.sin(F.t * 0.9) * 0.7 - (F.phase === 'charge' ? F.charge * 5 : 0);
  F.yaw = lerp(F.yaw || 0, -Math.tan(F.aim) * FOC * 0.45, 0.08);
  const under = F.phase === 'fight' && F.fight && F.fight.mode !== 'jump';
  F.biteMark = null;
  if (under) drawUnderView(SURF.world, SURF.imgW, LW, LH, true);
  else {
    drawAboveView();
    if (F.phase === 'lure') { drawUnderView(SURF.pip, SURF.imgP, PIP.w, PIP.h, false); toWorld(); px(); ctx.drawImage(SURF.pip.c, PIP.x, PIP.y); }
  }
  toWorld(); px();
  if (F.lightning > 0) { ctx.fillStyle = 'rgba(225,235,255,' + F.lightning * 0.5 + ')'; ctx.fillRect(0, 0, LW, LH); }
  if (F.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + F.flash * 0.6 + ')'; ctx.fillRect(0, 0, LW, LH); }
  toUI(); begin();
  if (!F.card && !(F.tour && F.tour.ended)) drawSpotHud(under);
  if (F.card) drawCard();
  if (F.tour && F.tour.ended) drawTourEnd();
  if (F.menu) drawSpotMenu();
}

// ---------------------------------------------------------------- above-water first-person view
function drawAboveView() {
  const sp = F.spot, n = nightness(F.hour), t = F.t;
  rasterAbove(SURF.imgW); toWorld(); ctx.putImageData(SURF.imgW, 0, 0); px();
  if (!sp.cave) {
    if (n > 0.25 && F.wx !== 'rain') { ctx.fillStyle = '#fff'; for (const s of F.stars) { const x = Math.round(s.x * 0.42 + F.yaw * 0.2) % LW, y = Math.round(s.y * 0.42); if (y < F.hz - 4 && Math.sin(t * 1.7 + s.tw) > -0.3) { ctx.globalAlpha = n; ctx.fillRect(x, y, 1, 1); } } ctx.globalAlpha = 1; }
    const s = sunScreen();
    if (s) { const [x, y] = s; ctx.fillStyle = 'rgba(255,240,180,.25)'; oct(x, y, 15); ctx.fillStyle = 'rgba(255,240,180,.35)'; oct(x, y, 10); ctx.fillStyle = s[2] < 0.12 || s[2] > 0.88 ? '#ffb070' : '#fff6c8'; oct(x, y, 6); }
    const m = n > 0.3 ? moonScreen() : null;
    if (m) { ctx.fillStyle = 'rgba(200,215,255,.25)'; oct(m[0], m[1], 10); ctx.fillStyle = '#e8ecff'; oct(m[0], m[1], 5); ctx.fillStyle = 'rgba(120,130,160,.6)'; ctx.fillRect(m[0] - 2, m[1] - 1, 2, 2); }
    const cl = F.L.cloudsT || TEX.clouds, cov = F.wx === 'rain' ? 1 : F.wx === 'cloud' ? 0.8 : 0.5;
    F.clouds.forEach((c, i) => { const w = 92 * c.s, x = ((c.x * 0.42 + t * c.v * 0.3) % (LW + w + 20)) - w, y = c.y * 0.3 - 6; ctx.globalAlpha = cov; ctx.drawImage(cl[i % cl.length], Math.round(x), Math.round(y), Math.round(w), Math.round(40 * c.s)); });
    ctx.globalAlpha = 1;
    if (F.lightning > 0.55 && F.bolt) { const R = mulberry(F.bolt.seed | 0); ctx.strokeStyle = '#eef4ff'; ctx.lineWidth = 1; ctx.beginPath(); let x = F.bolt.x * 0.4, y = 0; ctx.moveTo(x, y); while (y < F.hz - 6) { x += (R() - 0.5) * 12; y += 5 + R() * 6; ctx.lineTo(x, y); } ctx.stroke(); }
  }
  // distant scenery sitting on the horizon
  const pano = F.L.backT || F.L.back, PW = LW * 1.3, sc = PW / VW, PH = Y0 * sc;
  ctx.drawImage(pano, 0, 0, pano.width, Math.round(Y0 * F.L.k), Math.round((LW - PW) / 2 + F.yaw * 0.25), Math.round(F.hz - PH + 1), Math.round(PW), Math.round(PH));
  // things on the water, far to near
  if (sp.env === 'pond') for (const p of F.pads) { const q = P(p.x, 0, p.z); if (!q) continue; const rx = FOC * (p.r / 22) / q[2], ry = rx * CAMH / q[2] * 1.2; ctx.fillStyle = lit('#3f8f45'); ctx.beginPath(); ctx.ellipse(Math.round(q[0]), Math.round(q[1]), Math.max(1, rx), Math.max(0.6, ry), 0, 0, 7); ctx.fill(); if (p.fl && rx > 2) { ctx.fillStyle = lit('#ff9ec8'); ctx.fillRect(Math.round(q[0]) - 1, Math.round(q[1] - ry) - 1, 2, 2); } }
  if (F.wx === 'rain') { for (let i = 0; i < 30; i++) { const ph = (t * 1.6 + hash(i) * 7) % 1, k = Math.floor(t * 1.6 + hash(i) * 7); const x = 3 + hash(i * 3 + k) * (sp.W - 3), z = (hash(i * 7 + k) - 0.5) * 30; const q = P(x, 0, z); if (!q) continue; const r = FOC * (0.08 + ph * 0.35) / q[2]; ringPx(q[0], q[1], r, r * CAMH / q[2], '#dfefff', 1 - ph); } }
  for (const s of F.splash) {
    const q = P(s.x, 0, s.z); if (!q) continue; const a = 1 - s.t / 1.4;
    for (let k = 0; k < (s.big ? 2 : 1); k++) { const r = FOC * (0.15 + (s.t - k * 0.2) * 1.1) / q[2]; if (r > 0) ringPx(q[0], q[1], r, r * CAMH / q[2] * 1.2, '#ffffff', a); }
    if (s.t < 0.6) { ctx.fillStyle = '#eaf6ff'; for (let i = 0; i < s.n; i++) { const an = i / s.n * 6.28, h = Math.sin(Math.min(Math.PI, s.t * 5.2)) * (s.big ? 0.9 : 0.5) * (0.6 + hash(i) * 0.5); const w = P(s.x + Math.cos(an) * 0.35 * s.t * 2, h, s.z + Math.sin(an) * 0.35 * s.t * 2); if (w) ctx.fillRect(Math.round(w[0]), Math.round(w[1]), w[2] < 12 ? 2 : 1, w[2] < 12 ? 2 : 1); } }
  }
  for (const j of F.jumps) { const h = Math.sin(Math.PI * j.t) * Math.max(0.7, j.size * 0.8), q = P(j.x + j.t * 0.6, h, j.z); if (!q) continue; drawMonPx(j.id, q[0], q[1], FOC * j.size / q[2] * 0.9, j.fz < 0, t * 2, { shiny: j.shiny, rot: (j.t - 0.5) * 1.6 * (j.fz < 0 ? -1 : 1), frame: 0 }); }
  // the hooked fish when it leaps
  if (F.phase === 'fight' && F.fight && F.fight.mode === 'jump') { const f = F.fight.f, q = P(f.x, Math.max(0, -f.y) + 0.3, f.z); if (q) drawMonPx(f.id, q[0], q[1], FOC * f.size / q[2] * 0.9, false, t, { shiny: f.shiny, rot: Math.sin(t * 14) * 0.4 }); }
  drawForeground();
  drawRigFP();
  if (F.wx === 'rain') { ctx.strokeStyle = 'rgba(200,225,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 70; i++) { const x = (i * 37.3 + t * 40) % (LW + 20) - 10, y = (i * 23.7 + t * 260 * (0.8 + hash(i) * 0.4)) % (LH + 20) - 10; ctx.moveTo(Math.round(x), Math.round(y)); ctx.lineTo(Math.round(x - 2), Math.round(y + 6)); } ctx.stroke(); }
  if ((sp.env === 'pond' || sp.env === 'river') && n > 0.45) { for (const f of F.flies) { const x = (f.x * 0.4 + Math.sin(t * f.sp + f.ph) * 12 + t * 2) % LW, y = F.hz - 20 + f.y * 0.15 + Math.sin(t * 1.3 * f.sp + f.ph * 2) * 5; if (Math.sin(t * 3 + f.ph * 5) > 0) { ctx.fillStyle = 'rgba(210,255,120,.35)'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); ctx.fillStyle = '#efffb0'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); } } }
}
function oct(x, y, r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; ctx.lineTo(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r)); } ctx.closePath(); ctx.fill(); }

// rod, line and lure in first person
function drawRigFP() {
  const rod = ROD_BY[SAVE.rod], l = F.lure, ph = F.phase, t = F.t;
  const aimPt = P(15, 0, 15 * Math.tan(F.aim)) || [LW / 2, F.hz + 20];
  const bx = LW * 0.86;
  let T, bend = 0.1, end = null, endKind = 'hang';
  if (ph === 'idle' || ph === 'result') T = [lerp(bx, aimPt[0], 0.62), F.hz - 32 + Math.sin(t * 1.3) * 1.5];
  else if (ph === 'charge') { T = [lerp(bx, aimPt[0], 0.42) + 16 * F.charge, F.hz - 34 - 62 * F.charge]; bend = -0.2 * F.charge; }
  else if (ph === 'cast') {
    const fl = l.fly, p = clamp(fl.t, 0, 1), x = lerp(0.6, fl.x, p), z = lerp(0.2, fl.z, p), y = lerp(CAMH + 0.6, 0, p) + Math.sin(Math.PI * p) * (2 + fl.x * 0.2);
    end = P(x, y, z); endKind = 'fly'; T = [lerp(bx, aimPt[0], 0.7), F.hz - 14 + (1 - p) * -30];
  } else if (ph === 'lure') { end = P(l.x, 0, l.z); endKind = 'water'; T = [lerp(bx, end ? end[0] : aimPt[0], 0.58), F.hz - 26 + (l.reeling ? 3 : 0)]; bend = 0.25; }
  else if (ph === 'fight' && F.fight) { const f = F.fight.f; end = P(f.x, Math.max(0, -f.y), f.z); endKind = 'fish'; T = [lerp(bx, end ? end[0] : aimPt[0], 0.5) + F.fight.tilt * -28, F.hz - 6 + F.fight.tension * 0.1]; bend = 0.3 + F.fight.tension / 100 * 1.3; }
  else if (ph === 'land' && F.land) {
    const L = F.land, p = clamp(L.t / 0.9, 0, 1), f = L.f, q0 = P(1.6, 0, f.z * 0.2) || [LW / 2, LH * 0.8];
    const fx = lerp(q0[0], LW * 0.48, p), fy = lerp(q0[1], LH * 0.42, p) - Math.sin(Math.PI * p) * 30, h = lerp(20, 96, p);
    T = [lerp(bx, LW * 0.6, 0.6), F.hz - 60]; bend = 0.5; end = [fx, fy - h * 0.3]; endKind = 'land';
    drawMonPx(f.id, fx, fy, h, false, t, { shiny: f.shiny, rot: Math.sin(t * 16) * 0.25 });
  } else T = [lerp(bx, aimPt[0], 0.62), F.hz - 32];
  F.tipS = F.tipS ? [lerp(F.tipS[0], T[0], 0.25), lerp(F.tipS[1], T[1], 0.25)] : T;
  F.bendS = lerp(F.bendS || 0, bend, 0.2);
  const pts = drawRodFP(F.tipS[0], F.tipS[1], F.bendS, rod, F.spin), tip = pts[pts.length - 1];
  ctx.strokeStyle = endKind === 'fish' && F.fight && F.fight.tension > 85 ? '#ffb0b0' : 'rgba(240,248,255,.9)'; ctx.lineWidth = 1;
  if (endKind === 'hang' || !end) { const hx = tip[0] + 1, hy = tip[1] + 16 + Math.sin(t * 2) * 1; ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(hx, hy); ctx.stroke(); drawLure(SAVE.lure, Math.round(hx), Math.round(hy + 3), 0.7, 0, t); }
  else {
    const sag = endKind === 'water' ? (l.reeling ? 4 : 14) : endKind === 'fish' ? (100 - F.fight.tension) * 0.12 : 2;
    ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.quadraticCurveTo((tip[0] + end[0]) / 2, Math.max(tip[1], end[1]) - 4 + sag, end[0], end[1]); ctx.stroke();
    if (endKind === 'fly') drawLure(SAVE.lure, Math.round(end[0]), Math.round(end[1]), clamp(6 / end[2], 0.35, 0.9), t * 8, t);
    if (endKind === 'water') { const r = FOC * 0.12 / end[2]; ringPx(end[0], end[1], r + (l.reeling ? Math.sin(t * 20) : 0), r * 0.4, '#ffffff', 0.8); if (l.y < 0.3) drawLure(SAVE.lure, Math.round(end[0]), Math.round(end[1] - 1), clamp(5 / end[2], 0.3, 0.8), 0, t); if (l.reeling && Math.sin(t * 9) > 0.6) { ringPx(end[0] + 2, end[1], r * 2, r * 0.6, '#ffffff', 0.4); } }
    if (endKind === 'fish') { const r = FOC * 0.3 / end[2]; ringPx(end[0], end[1] + 1, r * (1.2 + Math.sin(t * 18) * 0.3), r * 0.35, '#ffffff', 0.9); }
  }
}

// ---------------------------------------------------------------- underwater camera (pip or full screen)
const KELPC = { pond: '#3f8a45', river: '#4a7a3a', coast: '#2d8a5a', deep: '#1f6a5a', cave: '#3a5a8a', legend: '#5ad0a8' };
function drawUnderView(surf, img, W, H, full) {
  const l = F.lure, t = F.t, sp = F.spot;
  let tg;
  if (F.phase === 'fight' && F.fight) { const f = F.fight.f; tg = { x: f.x - 0.9 - f.size * 1.5, y: clamp(f.y, 0.3, 99), z: f.z }; }
  else tg = { x: l.x - 2.8, y: Math.max(0.35, l.y), z: l.z };
  if (!F.uwc || Math.abs(F.uwc.x - tg.x) > 12 || F.uwcPhase !== F.phase) { F.uwc = { ...tg }; F.uwcPhase = F.phase; }
  const c = F.uwc; c.x = lerp(c.x, tg.x, 0.12); c.y = lerp(c.y, tg.y, 0.12); c.z = lerp(c.z, tg.z, 0.12);
  const info = rasterUnder(img, W, H, c);
  const keep = ctx; ctx = surf.g; px(); ctx.putImageData(img, 0, 0);
  if (!sp.cave && nightness(F.hour) < 0.6) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,250,215,.07)'; for (let i = 0; i < 4; i++) { const x = (i * W / 3.2 + Math.sin(t * 0.3 + i * 2) * W * 0.1) | 0, w = W * 0.06; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 2.6, H); ctx.lineTo(x + w * 0.6, H); ctx.fill(); } ctx.restore(); }
  const items = [];
  for (const d of F.decor) { const dx = d.x - c.x; if (dx > 0.3 && dx < info.vis * 1.2) items.push({ k: 'decor', d, dx }); }
  for (const f of F.fish) { const dx = f.x - c.x; if (dx > 0.3 && dx < info.vis * 1.15) items.push({ k: 'fish', f, dx }); }
  if (F.phase === 'lure') items.push({ k: 'lure', dx: l.x - c.x });
  items.sort((a, b) => b.dx - a.dx);
  const fogA = dx => 1 - clamp((dx - info.vis * 0.45) / (info.vis * 0.6), 0, 1);
  const kc = KELPC[sp.env];
  for (const it of items) {
    if (it.k === 'decor') {
      const d = it.d, base = bottomAt(d.x), q = PU(c, info, W, d.x, base, d.z); if (!q) continue;
      const a = fogA(it.dx); if (a <= 0.02) continue; ctx.globalAlpha = a;
      if (d.kind === 'kelp') { const hgt = (1.2 + d.h * 1.8) * d.s, top = PU(c, info, W, d.x, base - hgt, d.z); if (top) { const segs = 6, w = Math.max(1, info.f * 0.12 / it.dx); ctx.fillStyle = kc; for (let i = 0; i < segs; i++) { const k0 = i / segs, sw = Math.sin(t * 1.3 + d.ph + k0 * 2.4) * w * 2 * k0; ctx.fillRect(Math.round(lerp(q[0], top[0], k0) + sw - w / 2), Math.round(lerp(q[1], top[1], k0 + 1 / segs)), Math.ceil(w), Math.ceil(Math.abs(q[1] - top[1]) / segs) + 1); } } }
      else if (d.kind === 'rock') { const r = info.f * 0.5 * d.s / it.dx; ctx.fillStyle = sp.env === 'cave' ? '#3a3866' : '#4f565e'; ctx.beginPath(); ctx.ellipse(Math.round(q[0]), Math.round(q[1]), Math.max(1, r * 1.4), Math.max(1, r * 0.8), 0, Math.PI, 0); ctx.fill(); }
      else if (d.kind === 'coral') { const r = info.f * 0.35 * d.h / it.dx; ctx.fillStyle = 'hsl(' + d.hue + ',70%,58%)'; for (let i = -1; i <= 1; i++) ctx.fillRect(Math.round(q[0] + i * r * 0.5), Math.round(q[1] - r * (1.2 - Math.abs(i) * 0.4)), Math.max(1, Math.round(r * 0.25)), Math.round(r * (1.2 - Math.abs(i) * 0.4))); }
      else if (d.kind === 'crystal') { const r = info.f * 0.5 * d.h / it.dx; ctx.fillStyle = 'hsl(' + (170 + d.hue % 120) + ',90%,65%)'; ctx.beginPath(); ctx.moveTo(q[0] - r * 0.3, q[1]); ctx.lineTo(q[0], q[1] - r); ctx.lineTo(q[0] + r * 0.3, q[1]); ctx.fill(); }
      ctx.globalAlpha = 1;
    } else if (it.k === 'fish') {
      const f = it.f, q = PU(c, info, W, f.x, f.y, f.z); if (!q) continue;
      const a = fogA(it.dx); if (a <= 0.02) continue;
      const hooked = f.state === 'hooked', h = Math.min(H * 1.4, info.f * f.size / it.dx * 0.85);
      let rot = Math.sin(f.t * 3 + f.ph) * 0.06; if (hooked) rot = Math.sin(t * 16) * (F.fight && F.fight.mode === 'run' ? 0.3 : 0.15);
      const moving = f.state !== 'wander' || f.pause <= 0;
      drawMonPx(f.id, q[0], q[1], h, f.fz < 0, f.t, { shiny: f.shiny, alpha: a, rot, speed: moving ? (f.state === 'chase' || hooked ? 1.6 : 0.8) : 0.3 });
      if (f.state === 'bite') F.biteMark = { surf: full ? 'world' : 'pip', x: q[0], y: q[1] - h * 0.6 };
      if (hooked) { ctx.strokeStyle = F.fight && F.fight.tension > 85 ? '#ffb0b0' : 'rgba(240,248,255,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(q[0] + h * 0.3), Math.round(q[1])); ctx.lineTo(Math.round(W * 0.35), -2); ctx.stroke(); }
    } else if (it.k === 'lure') {
      const q = PU(c, info, W, l.x, l.y, l.z); if (!q) continue;
      ctx.strokeStyle = 'rgba(240,248,255,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(q[0]), Math.round(q[1])); ctx.lineTo(Math.round(q[0] - W * 0.25), -2); ctx.stroke();
      drawLure(SAVE.lure, Math.round(q[0]), Math.round(q[1] + Math.sin(t * 40) * l.wob * 2), clamp(info.f * 0.035 / it.dx, 0.5, 1.5), l.reeling ? 0 : 0.4, t);
      if (l.twitch > 0.2) ringPx(q[0], q[1], 8 + (1 - l.twitch) * 10, 8 + (1 - l.twitch) * 10, '#ffffff', l.twitch);
      if (SAVE.lure === 'glow') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(150,255,150,.25)'; oct(q[0], q[1], 9); ctx.restore(); }
    }
  }
  ctx.fillStyle = 'rgba(230,245,255,.5)'; for (let i = 0; i < (full ? 50 : 22); i++) { const x = (hash(i) * W + Math.sin(t * 0.4 + i) * 6 - c.z * 8) % W, y = (hash(i + 50) * H + t * (3 + hash(i + 9) * 5)) % H; ctx.fillRect(Math.round((x + W) % W), Math.round(y), 1, 1); }
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = rgb(mixRGB(LIGHT, [255, 255, 255], 0.25)); ctx.fillRect(0, 0, W, H); ctx.restore();
  if (F.biteMark && F.biteMark.surf === (full ? 'world' : 'pip')) { const b = F.biteMark, s = Math.sin(t * 20) > 0 ? 1 : 0; ctx.fillStyle = '#ffe23a'; ctx.fillRect(Math.round(b.x) - 5 - s, Math.round(b.y) - 12 - s, 10 + s * 2, 14 + s * 2); ctx.fillStyle = '#b3261e'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 10, 3, 7); ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 2); }
  ctx = keep;
}

// ---------------------------------------------------------------- HUD (960x540 UI layer)
function wxName() { return F.wx === 'rain' ? 'RAIN' : F.wx === 'cloud' ? 'CLOUDY' : 'CLEAR'; }
function clockStr() { const h = Math.floor(F.hour), m = Math.floor((F.hour % 1) * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
function segBar(x, y, w, h, frac, cols, n = 20) { ctx.fillStyle = '#05060f'; ctx.fillRect(x, y, w, h); const sw = (w - 4) / n; for (let i = 0; i < n; i++) { if ((i + 0.5) / n > frac) break; ctx.fillStyle = typeof cols === 'function' ? cols(i / n) : cols; ctx.fillRect(Math.round(x + 2 + i * sw), y + 2, Math.max(1, Math.round(sw - 2)), h - 4); } ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2); }
function vSegBar(x, y, w, h, frac, colf, n = 24) { ctx.fillStyle = '#05060f'; ctx.fillRect(x, y, w, h); const sh = (h - 4) / n; for (let i = 0; i < n; i++) { if ((i + 0.5) / n > frac) break; ctx.fillStyle = colf(i / n); ctx.fillRect(x + 2, Math.round(y + h - 2 - (i + 1) * sh + 1), w - 4, Math.max(1, Math.round(sh - 2))); } ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2); }
function drawSonar(x, y, w, h) {
  panel(x, y, w, h, { top: '#0f3a1a', bot: '#021006' }); const sp = F.spot, ox = x + w / 2, oy = y + h - 10, sx = (w / 2 - 12) / (ZM() + 2), sy = (h - 30) / sp.W;
  ctx.save(); ctx.beginPath(); ctx.rect(x + 4, y + 4, w - 8, h - 8); ctx.clip();
  ctx.strokeStyle = 'rgba(80,255,120,.25)'; ctx.lineWidth = 1; for (let r = 10; r <= sp.W; r += 10) { ctx.beginPath(); ctx.moveTo(x + 8, oy - r * sy); ctx.lineTo(x + w - 8, oy - r * sy); ctx.stroke(); }
  const sw = (F.t * 0.8) % 1; ctx.fillStyle = 'rgba(80,255,120,.12)'; ctx.fillRect(x + 4, oy - sw * sp.W * sy - 6, w - 8, 6);
  for (const f of F.fish) { const fx = ox + f.z * sx, fy = oy - f.x * sy, s = clamp(1.5 + f.size * 1.6, 2, 6); ctx.fillStyle = f.state === 'hooked' ? '#ff5a5a' : f.state === 'chase' || f.state === 'nibble' || f.state === 'bite' ? '#ffe36e' : 'rgba(110,255,140,' + (0.45 + 0.55 * clamp(1 - Math.abs(((oy - fy) / (h - 30)) - sw) * 3, 0, 1)) + ')'; ctx.fillRect(Math.round(fx - s / 2), Math.round(fy - s / 2), Math.round(s), Math.round(s)); }
  if (F.phase === 'lure' || F.phase === 'cast') { const lx = ox + F.lure.z * sx, ly = oy - F.lure.x * sy; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(lx) - 2, Math.round(ly) - 2, 4, 4); }
  if (F.phase === 'idle' || F.phase === 'charge') { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(ox, oy); const r = castMax(); ctx.lineTo(ox + Math.sin(F.aim) * r * sx, oy - Math.cos(F.aim) * r * sy); ctx.stroke(); }
  ctx.restore(); ctx.fillStyle = '#ffffff'; ctx.fillRect(ox - 2, oy, 4, 4);
  txt('SONAR', x + 10, y + 13, 14, '#7dff9a');
}
function drawSpotHud(under) {
  const sp = F.spot, rod = ROD_BY[SAVE.rod], lure = LURE_BY[SAVE.lure], ph = F.phase;
  if (ph !== 'fight') { panel(10, 10, 300, 62); txt(sp.name.toUpperCase(), 24, 30, 22, '#fff'); txt(clockStr() + '  ' + wxName() + '  ' + slotOf(F.hour).toUpperCase(), 24, 56, 15, '#bcd0ff'); }
  panel(VW - 230, 10, 162, 62); txt(money(SAVE.money), VW - 216, 30, 16, '#ffe36e'); txt('DEX ' + dexCount() + '/' + dexTotal(), VW - 216, 54, 15, '#bcd0ff');
  roundButton('menu', VW - 34, 40, 24, '', { sym: 'sq' });
  if (ph !== 'fight' && ph !== 'land') drawSonar(VW - 200, 80, 190, 150);
  if (F.tour) { const T = F.tour, left = Math.max(0, T.left); panel(VW - 400, 10, 162, 62, { stroke: '#ffd23f' }); txt('TOURNEY ' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'), VW - 388, 30, 15, left < 30 ? '#ff8a8a' : '#ffd23f'); txt('TOP3 ' + kgStr(tourScore()), VW - 388, 54, 15, '#fff'); }
  let my = ph === 'fight' ? 150 : 96;
  for (const m of F.msgs) { const w = Math.min(560, txtw(m.text, 16) + 40); panel(VW / 2 - w / 2, my - 16, w, 32); txt(m.text, VW / 2, my, 16, m.col, 'center'); my += 40; }
  if (F.card || F.menu) return;
  if (ph === 'lure') { const x = PIP.x / LK, y = PIP.y / LK, w = PIP.w / LK, h = PIP.h / LK; ctx.strokeStyle = '#0a0a14'; ctx.lineWidth = 4; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4); ctx.strokeStyle = '#e6e6f0'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); panel(x, y - 28, 150, 24); txt('LURE CAM', x + 12, y - 16, 14, '#7dff9a'); txt('DEPTH ' + F.lure.y.toFixed(1) + 'm', x + w - 8, y + h - 12, 15, '#ffffff', 'right'); txt('LINE ' + F.lure.x.toFixed(1) + 'm', x + 10, y + h - 12, 15, '#ffffff'); }
  if (ph === 'idle' || ph === 'charge' || ph === 'cast') {
    panel(10, VH - 92, 380, 82);
    roundButton('lure-', 44, VH - 51, 22, '', { sym: 'l', disabled: ph !== 'idle' }); roundButton('lure+', 356, VH - 51, 22, '', { sym: 'r', disabled: ph !== 'idle' });
    ctx.fillStyle = '#05060f'; ctx.fillRect(76, VH - 80, 60, 58); ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 1.5; ctx.strokeRect(76, VH - 80, 60, 58);
    drawLure(lure.id, 106, VH - 51, 1.9, 0, F.t);
    txt(lure.name.toUpperCase(), 148, VH - 66, 15, '#fff'); txt(rod.name + '  LINE ' + rod.line, 148, VH - 44, 15, '#bcd0ff'); txt('CAST ' + Math.round(castMax()) + 'm', 148, VH - 24, 15, '#bcd0ff');
    if (ph === 'idle') txt('AIM WITH ◀ ▶    HOLD ✕ TO CAST    OR TAP THE WATER', VW / 2 + 40, VH - 112, 16, '#ffffff', 'center');
  }
  if (ph === 'charge') {
    const w = 360, x = VW / 2 - w / 2 + 60, y = VH - 150; panel(x - 14, y - 34, w + 28, 64);
    txt('POWER  ' + Math.round(3 + F.charge * (castMax() - 3)) + 'm', x, y - 16, 16, '#fff');
    segBar(x, y, w, 18, F.charge, f => f < 0.6 ? '#4fe08a' : f < 0.85 ? '#ffd23f' : '#ff5959', 24);
  }
  const lab = ph === 'idle' ? 'CAST' : ph === 'charge' ? 'RELEASE' : ph === 'lure' || ph === 'fight' ? 'REEL' : '';
  roundButton('main', VW - 86, VH - 86, 62, lab, { hold: true, sym: 'x', size: 16, disabled: ph === 'cast' || ph === 'land' || ph === 'result' });
  if (ph === 'lure') {
    roundButton('jerk', VW - 196, VH - 56, 40, F.bite ? 'HOOK!' : 'JERK', { sym: 'o', size: 15 });
    roundButton('up', 530, VH - 118, 28, '', { hold: true, sym: 'u' }); roundButton('dn', 530, VH - 40, 28, '', { hold: true, sym: 'd' });
    txt('DEPTH', 530, VH - 79, 14, '#bcd0ff', 'center');
    if (F.bite && Math.floor(F.t * 12) % 2) htxt('HIT! HOOK IT!', VW / 2 - 40, 150, 40, '#fff27a', '#ff6a3a');
  }
  if (ph === 'idle' || ph === 'charge') { roundButton('tl', 470, VH - 60, 30, '', { hold: true, sym: 'l' }); roundButton('tr', 590, VH - 60, 30, '', { hold: true, sym: 'r' }); txt('AIM', 530, VH - 60, 15, '#bcd0ff', 'center'); }
  if (ph === 'fight') drawFightHud();
}
function drawFightHud() {
  const fi = F.fight, f = fi.f, x = VW / 2 - 230, w = 460;
  panel(x, 10, w, 84, { stroke: f.shiny ? '#ffd23f' : undefined });
  ctx.fillStyle = '#05060f'; ctx.fillRect(x + 12, 20, 64, 64); ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 12, 20, 64, 64);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 12, 20, 64, 64); ctx.clip(); drawMon(f.id, x + 44, 54, 50, false, F.t, { shiny: f.shiny, speed: 1.4 }); ctx.restore();
  txt(f.S.name.toUpperCase() + (f.shiny ? ' *' : ''), x + 90, 34, 22, f.shiny ? '#ffe36e' : '#fff');
  txt(lenStr(f.size) + '   LINE ' + fi.d.toFixed(1) + 'm', x + w - 14, 34, 16, '#bcd0ff', 'right');
  txt('STAMINA', x + 90, 66, 14, '#ff9a9a');
  segBar(x + 160, 58, w - 176, 16, fi.stam / fi.smax, '#ff5a5a', 24);
  panel(12, 110, 70, 330); txt('LINE', 47, 128, 14, '#fff', 'center');
  vSegBar(28, 142, 38, 280, clamp(fi.tension / 100, 0, 1), fr => fr < 0.36 ? '#5a8aff' : fr < 0.9 ? '#4fe08a' : '#ff4d4d', 26);
  ctx.fillStyle = '#ff4d4d'; ctx.fillRect(22, 142 + 280 * 0.1, 50, 2); ctx.fillStyle = '#4fe08a'; ctx.fillRect(22, 142 + 280 * 0.64, 50, 2);
  txt(Math.round(fi.tension) + '%', 47, 432, 15, fi.tension > 86 ? '#ff6a6a' : '#fff', 'center');
  const blink = Math.floor(F.t * 10) % 2;
  if (fi.mode === 'warn' || fi.mode === 'run') {
    if (fi.mode === 'warn' ? blink : (fi.counter || blink)) htxt((fi.mode === 'warn' ? 'HE WILL RUN! ' : 'RUNNING! ') + 'PULL ' + (fi.dir > 0 ? '◀' : '▶'), VW / 2, 130, 30, fi.counter ? '#b6ffb0' : '#fff27a', fi.counter ? '#2fd06a' : '#ff8a2e');
  } else if (fi.mode === 'jump') { if (blink) htxt('JUMP! KEEP REELING!', VW / 2, 130, 30, '#fff27a', '#ff9a2e'); }
  else if (fi.tension < 24 && !fi.reeling) txt('REEL TO KEEP THE LINE TIGHT', VW / 2, 130, 18, '#bcd0ff', 'center');
  if (fi.tension > 86 && blink) htxt('LINE WILL SNAP! EASE OFF!', VW / 2, 172, 24, '#ffd0d0', '#ff3b3b');
  roundButton('tl', 470, VH - 60, 34, '', { hold: true, sym: 'l' }); roundButton('tr', 590, VH - 60, 34, '', { hold: true, sym: 'r' }); txt('TILT', 530, VH - 60, 15, '#bcd0ff', 'center');
}

// ---------------------------------------------------------------- overlays
function drawCard() {
  const c = F.card, f = c.f, S = f.S, cx = VW / 2;
  ctx.fillStyle = 'rgba(0,0,10,.55)'; ctx.fillRect(0, 0, VW, VH);
  panel(170, 30, 620, 480, { stroke: f.shiny ? '#ffd23f' : undefined });
  htxt(c.isNew ? 'NEW SPECIES!' : 'CAUGHT!', cx, 66, 32, c.isNew ? '#b8ffc8' : '#ffffff', c.isNew ? '#3ad07a' : '#8fb0ff');
  if (f.shiny) htxt('* SHINY *', cx, 100, 22, '#fff8c0', '#ffc22e');
  ctx.fillStyle = '#05060f'; ctx.fillRect(cx - 150, 116, 300, 196); ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 2; ctx.strokeRect(cx - 150, 116, 300, 196);
  ctx.save(); ctx.beginPath(); ctx.rect(cx - 150, 116, 300, 196); ctx.clip();
  const g = ctx.createRadialGradient(cx, 214, 10, cx, 214, 160); g.addColorStop(0, 'rgba(90,120,255,.5)'); g.addColorStop(1, 'rgba(90,120,255,0)'); ctx.fillStyle = g; ctx.fillRect(cx - 150, 116, 300, 196);
  const sc = smooth(Math.min(1, c.t * 2.5)); drawMon(f.id, cx, 214 + Math.sin(F.t * 2.4) * 4, 150 * sc, Math.floor(F.t * 0.5) % 2 === 1, F.t, { shiny: f.shiny, speed: 0.7 }); ctx.restore();
  htxt(S.name.toUpperCase(), cx, 340, 28, '#ffffff', '#c8d4ff');
  txt('RARITY  ' + '*'.repeat(S.rar), cx, 370, 18, '#ffd23f', 'center');
  txt('LENGTH  ' + lenStr(f.size), 220, 400, 18, '#fff'); txt('WEIGHT  ' + kgStr(f.kg), cx + 30, 400, 18, '#fff');
  txt(F.tour ? 'KEPT FOR THE TOURNAMENT' : 'VALUE   ' + money(f.price), 220, 428, 18, '#ffe36e');
  if (c.rec && !c.isNew) txt('NEW RECORD!', VW - 210, 428, 18, '#ffe36e', 'right');
  if (F.tour) button('card-ok', cx - 110, 452, 220, 44, 'CONTINUE', { color: '#2f8a4a', size: 18 });
  else { button('sell', 210, 452, 250, 44, 'SELL +' + money(f.price), { color: '#2f8a4a', size: 18 }); button('release', 500, 452, 250, 44, 'RELEASE', { color: '#2f4fb0', size: 18 }); }
}
function drawTourEnd() {
  const T = F.tour; ctx.fillStyle = 'rgba(0,0,10,.6)'; ctx.fillRect(0, 0, VW, VH);
  panel(220, 40, 520, 460, { stroke: '#ffd23f' });
  htxt('RESULTS', VW / 2, 80, 32, '#fff3b0', '#ffc22e');
  htxt(['1ST PLACE!', '2ND PLACE', '3RD PLACE', '4TH PLACE'][T.place], VW / 2, 122, 24, T.place === 0 ? '#b8ffc8' : '#ffffff', T.place === 0 ? '#3ad07a' : '#9fb8ef');
  T.ranking.forEach((r, i) => { const y = 180 + i * 50; panel(260, y - 21, 440, 42, r.me ? { top: '#8a6a1a', bot: '#3a2a06' } : {}); txt((i + 1) + '. ' + r.name.toUpperCase(), 280, y, 18, r.me ? '#ffe36e' : '#fff'); txt(kgStr(r.score), 680, y, 18, '#bcd0ff', 'right'); });
  txt('PRIZE  ' + money(T.prize), VW / 2, 398, 22, '#ffe36e', 'center');
  txt(T.place === 0 ? 'YOU ARE THE CHAMPION OF ' + F.spot.name.toUpperCase() + '!' : 'CATCH HEAVIER POKEMON NEXT TIME.', VW / 2, 428, 16, '#bcd0ff', 'center');
  button('tour-ok', VW / 2 - 110, 448, 220, 40, 'BACK TO MAP', { color: '#2f8a4a' });
}
function drawSpotMenu() {
  ctx.fillStyle = 'rgba(0,0,10,.6)'; ctx.fillRect(0, 0, VW, VH);
  panel(260, 30, 440, 480);
  htxt('PAUSE', VW / 2, 66, 30, '#ffffff', '#8fb0ff');
  button('m-resume', 300, 94, 360, 44, 'RESUME', { color: '#2f8a4a' });
  txt('EQUIP LURE' + (F.phase === 'idle' ? '' : '  (REEL IN FIRST)'), VW / 2, 160, 15, '#bcd0ff', 'center');
  const owned = LURES.filter(l => SAVE.lures[l.id]);
  owned.forEach((l, i) => { const col = i % 2, row = Math.floor(i / 2); button('pick-' + l.id, 296 + col * 190, 176 + row * 46, 180, 40, '', { color: SAVE.lure === l.id ? '#b8741a' : '#2f4fb0', disabled: F.phase !== 'idle', nocursor: true, draw: (x, y, w, h) => { drawLure(l.id, x + 22, y + h / 2, 1.1, 0, F.t); txt(l.name.toUpperCase(), x + 42, y + h / 2, 14, '#fff'); } }); });
  button('m-snd', 300, 412, 170, 38, 'SOUND ' + (Snd.on ? 'ON' : 'OFF'), { color: '#4a4a6a', size: 15 });
  button('m-mus', 490, 412, 170, 38, 'MUSIC ' + (Snd.musicOn ? 'ON' : 'OFF'), { color: '#4a4a6a', size: 15 });
  button('m-leave', 300, 460, 360, 40, F.tour ? 'QUIT TOURNAMENT' : 'LEAVE SPOT', { color: '#a02a2a', disabled: F.phase === 'fight' });
}
