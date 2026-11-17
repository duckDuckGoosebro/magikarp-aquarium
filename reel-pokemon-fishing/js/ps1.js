'use strict';
// ================================================================ PS1-style renderer
// The 3D view is software-rendered into a 384x216 buffer (PlayStation-like resolution, 15-bit colour with
// ordered dithering), then blown up with nearest-neighbour. UI is drawn on a separate 960x540 layer.
const LW = 384, LH = 216, LK = LW / VW;            // world buffer + logical->buffer scale (0.4)
const FOC = 250, CAMH = 2.6, CAMB = 2.2;           // first-person camera: focal length, eye height, metres behind the shore
const SURF = {};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const WT = new Float32Array(64 * 64), SAND = new Float32Array(64 * 64);
(function buildTex() {
  const a = Math.PI * 2 / 64, R = mulberry(5);
  for (let v = 0; v < 64; v++) for (let u = 0; u < 64; u++) {
    WT[v * 64 + u] = 0.5 + 0.2 * Math.sin(a * (u * 2 + v)) + 0.14 * Math.sin(a * (u * 3 - v * 2) + 1) + 0.1 * Math.sin(a * (u - v * 5) + 2) + 0.06 * Math.sin(a * (u * 7 + v * 3));
    SAND[v * 64 + u] = 0.5 + 0.18 * Math.sin(a * (u * 4 + v * 1)) + 0.1 * Math.sin(a * (u * 9 - v * 6)) + (R() - 0.5) * 0.35;
  }
})();
function makeSurfaces() {
  const mk = (w, h, k) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.__k = k; g.imageSmoothingEnabled = false; return { c, g, w, h }; };
  SURF.world = mk(LW, LH, LK); SURF.ui = mk(VW, VH, 1); SURF.pip = mk(168, 96, 168 / VW);
  SURF.imgW = SURF.world.g.createImageData(LW, LH); SURF.imgP = SURF.pip.g.createImageData(168, 96);
}
function toWorld() { ctx = SURF.world.g; }
function toUI() { ctx = SURF.ui.g; }
function px() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; } // draw in raw buffer pixels

// 15-bit colour with ordered dither (the PS1 look)
function put(d, i, r, g, b, bay) {
  const o = (bay - 7.5) * 0.55;
  d[i] = (clamp(r + o, 0, 255) >> 3) << 3; d[i + 1] = (clamp(g + o, 0, 255) >> 3) << 3; d[i + 2] = (clamp(b + o, 0, 255) >> 3) << 3; d[i + 3] = 255;
}

// ---------------------------------------------------------------- first-person projection (above water)
// world: x = metres out from the shore, z = metres to the right, y = height above the surface
function P(x, y, z) { const d = x + CAMB; if (d < 0.3) return null; return [LW / 2 + FOC * z / d + F.yaw, F.hz + FOC * (CAMH - y) / d, d]; }
function unP(sx, sy) { if (sy <= F.hz + 0.5) return null; const d = FOC * CAMH / (sy - F.hz); return { x: d - CAMB, z: (sx - LW / 2 - F.yaw) * d / FOC }; }

// distant scenery panorama for the horizon (reuses the painted backdrops, then gets crunched to PS1 resolution)
function buildPanorama(S) {
  const prevF = F; F = S;
  try { const R = mulberry(S.spot.env.length * 31 + 7), back = layer(VW, Y0 + 30, 0.6); paintBack[S.spot.env](back.g, R, S); S.L = { back: back.c, k: 0.6, tintKey: '' }; }
  finally { F = prevF; }
}
function ensurePanoTint(S) {
  const key = Math.round(F.hour * 4) + F.wx;
  if (S.L.tintKey === key) return;
  const str = rgb(lightColor(F.hour, F.wx, S.spot.env));
  S.L.backT = tintCanvas(S.L.back, str); S.L.cloudsT = TEX.clouds.map(c => tintCanvas(c, str)); S.L.tintKey = key;
}

// ---------------------------------------------------------------- raster: sky + lake surface
function sunScreen() { const s = sunPos(F.hour); if (!s || F.spot.cave || F.wx === 'rain') return null; return [LW / 2 + (s[0] - VW / 2) * 0.42 + F.yaw, F.hz - 8 - Math.sin(Math.PI * s[2]) * 58, s[2]]; }
function moonScreen() { const m = moonPos(F.hour); if (!m || F.spot.cave) return null; return [LW / 2 + (m[0] - VW / 2) * 0.42 + F.yaw, F.hz - 10 - (Y0 - 10 - m[1]) * 0.45]; }
function rasterAbove(img) {
  const d = img.data, sp = F.spot, env = sp.env, t = F.t, hz = F.hz, L = LIGHT;
  const sk = skyColors(F.hour, F.wx, env), n = nightness(F.hour);
  const wn = hexRGB(sp.water[0]), wf = hexRGB(sp.water[1]);
  const near = [wn[0] * 0.55 * L[0] / 255, wn[1] * 0.62 * L[1] / 255, wn[2] * 0.7 * L[2] / 255];
  const deep = [wf[0] * 0.9 * L[0] / 255, wf[1] * 0.95 * L[1] / 255, wf[2] * L[2] / 255];
  const hor = sk[2], sun = sunScreen(), moon = n > 0.3 ? moonScreen() : null, glint = sun ? sun[0] : moon ? moon[0] : -999;
  const gcol = sun ? [255, 244, 210] : [210, 225, 255];
  const caveC = [[14, 12, 34], [34, 32, 70]];
  for (let y = 0; y < LH; y++) {
    const row = y * LW * 4, by = (y & 3) * 4;
    if (y <= hz) {
      let c0, c1, tt;
      if (sp.cave) { tt = y / hz; c0 = caveC[0]; c1 = caveC[1]; }
      else { tt = y / hz; if (tt < 0.55) { c0 = sk[0]; c1 = sk[1]; tt = tt / 0.55; } else { c0 = sk[1]; c1 = sk[2]; tt = (tt - 0.55) / 0.45; } }
      const r = c0[0] + (c1[0] - c0[0]) * tt, g = c0[1] + (c1[1] - c0[1]) * tt, b = c0[2] + (c1[2] - c0[2]) * tt;
      for (let x = 0; x < LW; x++) {
        let rr = r, gg = g, bb = b;
        if (sp.cave) { const v = SAND[((y * 2) & 63) * 64 + ((x * 2) & 63)]; rr += (v - 0.5) * 30; gg += (v - 0.5) * 28; bb += (v - 0.5) * 40; }
        put(d, row + x * 4, rr, gg, bb, BAYER[by + (x & 3)]);
      }
      continue;
    }
    const dist = FOC * CAMH / (y - hz + 0.001), scale = dist / FOC;
    const fres = Math.pow(clamp(1 - (y - hz) / 45, 0, 1), 1.8);            // grazing angle -> mirror the sky
    const depthMix = clamp(dist / 30, 0, 1);
    const br = near[0] + (deep[0] - near[0]) * depthMix, bg = near[1] + (deep[1] - near[1]) * depthMix, bb = near[2] + (deep[2] - near[2]) * depthMix;
    const r0 = br + (hor[0] - br) * fres * 0.5, g0 = bg + (hor[1] - bg) * fres * 0.5, b0 = bb + (hor[2] - bb) * fres * 0.5;
    const u0 = (dist * 3.2 + t * 1.5) | 0, u1 = (dist * 1.9 - t * 1.0) | 0, gw = (y - hz) * 0.7 + 3;
    for (let x = 0; x < LW; x++) {
      const z = (x - LW / 2 - F.yaw) * scale;
      const a = WT[(u0 & 63) * 64 + (((z * 2.6 + t * 0.6) | 0) & 63)], b = WT[(u1 & 63) * 64 + (((z * 1.7) | 0) & 63)];
      const v = (a + b) * 0.5 + (BAYER[by + (x & 3)] - 7.5) * 0.012;
      let k = v < 0.36 ? -22 : v < 0.58 ? 0 : v < 0.74 ? 16 : 30;
      let r = r0 + k, g = g0 + k, bl = b0 + k;
      if (Math.abs(x - glint) < gw && v > 0.66) { const s = (1 - Math.abs(x - glint) / gw) * (sun ? 1 : 0.6); r += (gcol[0] - r) * s; g += (gcol[1] - g) * s; bl += (gcol[2] - bl) * s; }
      put(d, row + x * 4, r, g, bl, BAYER[by + (x & 3)]);
    }
  }
}

// ---------------------------------------------------------------- raster: underwater camera
const VIS = { pond: 20, river: 22, coast: 30, cave: 16, deep: 34, legend: 26 };
function rasterUnder(img, W, H, cam) {
  const d = img.data, sp = F.spot, env = sp.env, t = F.t, L = LIGHT, n = nightness(F.hour);
  const hy = H * 0.46, f = W * 0.62, vis = VIS[env];
  const wa = hexRGB(sp.water[0]), wb = hexRGB(sp.water[1]), bed = hexRGB(BED[env][0]);
  const lm = mixRGB(L, [255, 255, 255], 0.25), lk = c => [c[0] * lm[0] / 255, c[1] * lm[1] / 255, c[2] * lm[2] / 255];
  const fog = lk(mixRGB(wa, wb, 0.55 + clamp(cam.y / sp.D, 0, 1) * 0.4)), surf = lk(mixRGB(wa, [255, 255, 255], 0.45)), sand = lk(bed);
  const B = Math.max(cam.y + 0.5, bottomAt(clamp(cam.x + 3, 0, sp.W)));
  const caus = (1 - n) * (sp.cave ? 0.3 : 1);
  for (let y = 0; y < H; y++) {
    const row = y * W * 4, by = (y & 3) * 4;
    let dist, top;
    if (y < hy) { dist = f * Math.max(0.2, cam.y) / (hy - y); top = true; } else { dist = f * (B - cam.y) / (y - hy + 0.001); top = false; }
    const fg = Math.pow(clamp((dist - 1.5) / vis, 0, 1), 0.75), scale = dist / f;
    const ux = ((cam.x + dist) * (top ? 2 : 4)) | 0;
    for (let x = 0; x < W; x++) {
      const z = cam.z + (x - W / 2) * scale;
      let r, g, b;
      if (top) {
        const v = WT[((ux + ((t * 3) | 0)) & 63) * 64 + (((z * 2 + t) | 0) & 63)];
        const k = v > 0.68 ? 1.25 : v > 0.5 ? 1.05 : 0.9;
        r = surf[0] * k; g = surf[1] * k; b = surf[2] * k;
      } else {
        const v = SAND[(ux & 63) * 64 + (((z * 4) | 0) & 63)], c = WT[(((cam.x + dist) * 3 + t * 2) & 63) * 64 + (((z * 3 - t) | 0) & 63)];
        const k = 0.75 + v * 0.5 + (c > 0.72 ? 0.35 * caus : 0);
        r = sand[0] * k; g = sand[1] * k; b = sand[2] * k;
      }
      r += (fog[0] - r) * fg; g += (fog[1] - g) * fg; b += (fog[2] - b) * fg;
      put(d, row + x * 4, r, g, b, BAYER[by + (x & 3)]);
    }
  }
  return { hy, f, vis, B };
}
// project into the underwater camera (cam looks out along +x)
function PU(cam, info, W, x, y, z) {
  const dx = x - cam.x; if (dx < 0.25) return null;
  return [W / 2 + info.f * (z - cam.z) / dx, info.hy - info.f * (cam.y - y) / dx, dx];
}

// ---------------------------------------------------------------- first-person rod + hand (flat-shaded polygons)
function drawRodFP(tipX, tipY, bend, rod, spin) {
  const bx = LW * 0.86, by = LH + 8;
  const n = 7, pts = [];
  const mx = (bx + tipX) / 2 + bend * 18, my = (by + tipY) / 2 + bend * 26;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([(1 - t) * (1 - t) * bx + 2 * (1 - t) * t * mx + t * t * tipX, (1 - t) * (1 - t) * by + 2 * (1 - t) * t * my + t * t * tipY]); }
  const L = c => lit(c);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[i + 1], w0 = lerp(7, 1, i / n), w1 = lerp(7, 1, (i + 1) / n);
    const dx = b[0] - a[0], dy = b[1] - a[1], ln = Math.hypot(dx, dy) || 1, nx = -dy / ln, ny = dx / ln;
    ctx.fillStyle = rod.id === 'rainbow' ? 'hsl(' + ((i * 50 + F.t * 120) % 360) + ',80%,55%)' : i < 2 ? L('#c9a26b') : L(i % 2 ? rod.c1 : shadeHex(rod.c1, 25));
    ctx.beginPath(); ctx.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2); ctx.lineTo(b[0] + nx * w1 / 2, b[1] + ny * w1 / 2); ctx.lineTo(b[0] - nx * w1 / 2, b[1] - ny * w1 / 2); ctx.lineTo(a[0] - nx * w0 / 2, a[1] - ny * w0 / 2); ctx.fill();
    if (i >= 2 && i < n - 1) { ctx.fillStyle = L(rod.c2); ctx.fillRect(b[0] - 1, b[1] - 1, 2, 2); }
  }
  // reel
  const r0 = pts[1], rx = r0[0] - 9, ry = r0[1] + 3;
  ctx.fillStyle = L('#5c6672'); ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.lineTo(rx + Math.cos(a) * 8, ry + Math.sin(a) * 8); } ctx.fill();
  ctx.fillStyle = L('#b9c3cd'); ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.lineTo(rx + Math.cos(a) * 5.5, ry + Math.sin(a) * 5.5); } ctx.fill();
  ctx.fillStyle = L(rod.c2); ctx.fillRect(rx - 1, ry - 1, 3, 3);
  const cxk = rx + Math.cos(spin) * 9, cyk = ry + Math.sin(spin) * 9; ctx.strokeStyle = L('#2b3440'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(cxk, cyk); ctx.stroke(); ctx.fillStyle = L('#1d232b'); ctx.fillRect(cxk - 2, cyk - 2, 4, 4);
  // hands + sleeves
  const h1 = pts[1], h2 = pts[2];
  ctx.fillStyle = L('#c0392b'); ctx.beginPath(); ctx.moveTo(LW, LH); ctx.lineTo(LW, LH - 30); ctx.lineTo(h1[0] + 10, h1[1] + 4); ctx.lineTo(h1[0] + 2, LH); ctx.fill();
  ctx.fillStyle = L('#962d22'); ctx.beginPath(); ctx.moveTo(h2[0] - 12, LH); ctx.lineTo(h2[0] - 2, h2[1] + 10); ctx.lineTo(h2[0] + 14, h2[1] + 14); ctx.lineTo(h2[0] + 18, LH); ctx.fill();
  ctx.fillStyle = L('#e8b48c'); ctx.beginPath(); ctx.moveTo(h1[0] - 6, h1[1] - 4); ctx.lineTo(h1[0] + 8, h1[1] - 6); ctx.lineTo(h1[0] + 10, h1[1] + 6); ctx.lineTo(h1[0] - 4, h1[1] + 8); ctx.fill();
  ctx.fillStyle = L('#d9a27a'); ctx.beginPath(); ctx.moveTo(h2[0] - 6, h2[1] - 3); ctx.lineTo(h2[0] + 7, h2[1] - 5); ctx.lineTo(h2[0] + 9, h2[1] + 7); ctx.lineTo(h2[0] - 4, h2[1] + 8); ctx.fill();
  return pts;
}
function shadeHex(h, a) { const c = hexRGB(h); return rgb([clamp(c[0] + a, 0, 255), clamp(c[1] + a, 0, 255), clamp(c[2] + a, 0, 255)]); }

// ---------------------------------------------------------------- near shore foreground (corners of the screen)
function drawForeground() {
  const e = F.spot.env, L = c => lit(c), t = F.t;
  const poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); };
  if (e === 'deep') {
    poly([[0, LH], [0, LH - 22], [LW * 0.3, LH - 30], [LW / 2, LH - 44], [LW * 0.7, LH - 30], [LW, LH - 22], [LW, LH]], L('#7a4a26'));
    poly([[0, LH - 22], [LW * 0.3, LH - 30], [LW / 2, LH - 44], [LW * 0.7, LH - 30], [LW, LH - 22], [LW, LH - 18], [LW * 0.7, LH - 26], [LW / 2, LH - 39], [LW * 0.3, LH - 26], [0, LH - 18]], L('#b07a44'));
    ctx.fillStyle = L('#d9dde3'); for (let i = 0; i < 9; i++) { const x = i * LW / 8; ctx.fillRect(x - 1, LH - 58 + Math.abs(i - 4) * 3, 2, 30); } ctx.fillRect(0, LH - 58, LW * 0.36, 2); ctx.fillRect(LW * 0.64, LH - 58, LW * 0.36, 2);
    return;
  }
  const col = { pond: ['#3f8a3c', '#2f6a2e', '#5fb35a'], river: ['#5a6a50', '#3d4a38', '#7f9a6a'], coast: ['#d9c58b', '#b8a26a', '#efdfae'], cave: ['#2c2a52', '#1a1838', '#4a4880'], legend: ['#8a82c8', '#5a54a0', '#c8c0f0'] }[e];
  poly([[0, LH], [0, LH - 70], [26, LH - 64], [52, LH - 40], [86, LH - 18], [120, LH]], L(col[1]));
  poly([[0, LH - 70], [26, LH - 64], [52, LH - 40], [86, LH - 18], [80, LH - 14], [48, LH - 34], [22, LH - 58], [0, LH - 62]], L(col[2]));
  poly([[LW, LH], [LW, LH - 52], [LW - 30, LH - 46], [LW - 64, LH - 20], [LW - 100, LH]], L(col[0]));
  if (e === 'pond' || e === 'river') {
    for (let i = 0; i < 14; i++) { const x = 6 + i * 6 + (i % 3) * 2, h = 26 + (i * 37 % 20), sw = Math.sin(t * 1.4 + i) * 2; ctx.strokeStyle = L(i % 2 ? '#4f7f3a' : '#6a9a45'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, LH - 30 + (i % 4) * 6); ctx.lineTo(x + sw, LH - 30 - h + (i % 4) * 6); ctx.stroke(); if (i % 3 === 0) { ctx.fillStyle = L('#6b4226'); ctx.fillRect(x + sw - 1.5, LH - 30 - h + (i % 4) * 6, 3, 8); } }
    for (let i = 0; i < 9; i++) { const x = LW - 8 - i * 7, h = 18 + (i * 23 % 16), sw = Math.sin(t * 1.2 + i * 2) * 2; ctx.strokeStyle = L(i % 2 ? '#4f7f3a' : '#6a9a45'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, LH - 20 + (i % 3) * 6); ctx.lineTo(x + sw, LH - 20 - h + (i % 3) * 6); ctx.stroke(); }
  } else if (e === 'cave') {
    ctx.fillStyle = 'hsl(175,90%,65%)'; ctx.fillRect(18, LH - 74, 4, 10); ctx.fillRect(24, LH - 70, 3, 7); ctx.fillStyle = 'hsl(300,85%,70%)'; ctx.fillRect(LW - 34, LH - 58, 4, 10);
  } else if (e === 'coast') {
    ctx.fillStyle = L('#ff8a5a'); ctx.fillRect(30, LH - 30, 3, 3); ctx.fillRect(LW - 40, LH - 18, 3, 3);
  }
}

// ---------------------------------------------------------------- sprites in the 3D views
function drawMonPx(id, x, y, h, flip, t, o = {}) { drawMon(id, Math.round(x), Math.round(y), Math.max(2, h), flip, t, o); }
function ringPx(x, y, rx, ry, col, a) { ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), Math.max(1, rx), Math.max(0.6, ry), 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
