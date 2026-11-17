'use strict';
// ================================================================ art engine: noise, offscreen layers, painted scenery
// Everything here is drawn in code. Pokémon sprites are never touched (they stay pixel-crisp).

function makeNoise(seed) {
  const R = mulberry(seed); const v = new Float32Array(256), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) { v[i] = R(); p[i] = i; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const h = (i, j) => v[p[(p[i & 255] + j) & 255]];
  return (x, y = 0) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
}
const NZ = makeNoise(1337);
function fbm(x, y = 0, oct = 4, n = NZ) { let a = 0.5, f = 1, s = 0, t = 0; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); t += a; a *= 0.5; f *= 2.03; } return s / t; }

// offscreen layer in logical units, rendered at the current 4K scale
function layer(w, h, k) {
  k = k || SCALE_K; const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k));
  const g = c.getContext('2d'); g.scale(k, k); g.imageSmoothingEnabled = true;
  return { c, g, w, h, k };
}
// multiply a layer by a light colour, keeping its alpha
function tintCanvas(src, rgbStr) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d');
  g.drawImage(src, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = rgbStr; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0);
  return c;
}
const CAN_FILTER = (() => { try { const g = document.createElement('canvas').getContext('2d'); return typeof g.filter === 'string'; } catch (e) { return false; } })();

// ---------------------------------------------------------------- time of day
const SKY3 = [
  [0, '#020617', '#0b1a3d', '#1c2b5a'], [4.6, '#020617', '#0b1a3d', '#1c2b5a'], [6, '#33437f', '#d9817a', '#ffc996'],
  [7.6, '#3a8ee6', '#86c4f2', '#ffe6c8'], [10, '#2a78dc', '#64b0f4', '#cfeeff'], [15.5, '#2f7ddc', '#6fb7f2', '#e2f2ff'],
  [17.6, '#4559a5', '#ef8d5e', '#ffd08a'], [18.9, '#1d2350', '#80467e', '#ff8a5e'], [20.4, '#050b24', '#101d45', '#253262'], [24, '#020617', '#0b1a3d', '#1c2b5a']];
const LIGHTK = [[0, '#3b4a86'], [4.6, '#3b4a86'], [6, '#ffae8c'], [7.6, '#fff1de'], [9, '#ffffff'], [16, '#ffffff'], [17.6, '#ffd6ae'], [18.8, '#ff9f78'], [19.8, '#6f5c9c'], [21, '#3b4a86'], [24, '#3b4a86']];
function keyLerp(keys, h, idx) {
  for (let i = 0; i < keys.length - 1; i++) { const a = keys[i], b = keys[i + 1]; if (h >= a[0] && h <= b[0]) return mixRGB(hexRGB(a[idx]), hexRGB(b[idx]), (h - a[0]) / (b[0] - a[0])); }
  return hexRGB(keys[0][idx]);
}
function skyColors(h, wx, env) {
  let c = [keyLerp(SKY3, h, 1), keyLerp(SKY3, h, 2), keyLerp(SKY3, h, 3)];
  if (env === 'legend') c = [mixRGB(c[0], [70, 30, 130], 0.4), mixRGB(c[1], [190, 110, 220], 0.35), mixRGB(c[2], [255, 190, 235], 0.3)];
  const grey = wx === 'rain' ? 0.62 : wx === 'cloud' ? 0.35 : 0;
  if (grey) { const avg = x => { const m = (x[0] + x[1] + x[2]) / 3; return mixRGB(x, [m * 0.9, m * 0.95, m], grey); }; c = c.map(avg); }
  return c;
}
function lightColor(h, wx, env) {
  if (env === 'cave') return [140, 146, 205];
  let c = keyLerp(LIGHTK, h, 1);
  if (env === 'legend') c = mixRGB(c, [235, 205, 255], 0.3);
  if (wx === 'cloud') c = mixRGB(c, [200, 208, 220], 0.25);
  if (wx === 'rain') c = mixRGB(c, [150, 162, 185], 0.45);
  return c;
}
let LIGHT = [255, 255, 255];
function lit(hex, k = 1) { const c = hexRGB(hex); return 'rgb(' + Math.round(c[0] * LIGHT[0] / 255 * k) + ',' + Math.round(c[1] * LIGHT[1] / 255 * k) + ',' + Math.round(c[2] * LIGHT[2] / 255 * k) + ')'; }

// ---------------------------------------------------------------- shared textures (built once per scale)
const TEX = {};
function buildTextures() {
  // caustic net: voronoi edge brightness, tileable
  const N = 160, cc = document.createElement('canvas'); cc.width = cc.height = N; const cg = cc.getContext('2d');
  const id = cg.createImageData(N, N), R = mulberry(9), pts = [];
  for (let i = 0; i < 10; i++) pts.push([R() * N, R() * N]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let f1 = 1e9, f2 = 1e9;
    for (const p of pts) for (let ox = -N; ox <= N; ox += N) for (let oy = -N; oy <= N; oy += N) {
      const dx = x - p[0] - ox, dy = y - p[1] - oy, d = dx * dx + dy * dy;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const e = Math.sqrt(f2) - Math.sqrt(f1); const b = Math.pow(Math.exp(-e * 0.55), 1.4) * 255;
    const i = (y * N + x) * 4; id.data[i] = 200; id.data[i + 1] = 245; id.data[i + 2] = 255; id.data[i + 3] = b;
  }
  cg.putImageData(id, 0, 0); TEX.caustic = cc;
  // clouds
  TEX.clouds = [];
  for (let v = 0; v < 4; v++) {
    const L = layer(260, 110, Math.min(SCALE_K, 3)), g = L.g, R2 = mulberry(100 + v);
    const blobs = []; const n = 9 + v * 2;
    for (let i = 0; i < n; i++) { const t = i / (n - 1); blobs.push([30 + t * 200 + (R2() - 0.5) * 20, 70 - Math.sin(t * Math.PI) * (22 + R2() * 18) + R2() * 8, 16 + Math.sin(t * Math.PI) * 18 + R2() * 10]); }
    if (CAN_FILTER) g.filter = 'blur(1.2px)';
    g.beginPath(); for (const b of blobs) { g.moveTo(b[0] + b[2], b[1]); g.arc(b[0], b[1], b[2], 0, 7); } g.rect(30, 70, 200, 18);
    const gr = g.createLinearGradient(0, 20, 0, 92); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#f1f4fa'); gr.addColorStop(1, '#aab6ca'); g.fillStyle = gr; g.fill();
    g.filter = 'none';
    g.globalAlpha = 0.55; g.fillStyle = '#ffffff'; for (const b of blobs) { g.beginPath(); g.arc(b[0] - b[2] * 0.25, b[1] - b[2] * 0.3, b[2] * 0.55, 0, 7); g.fill(); }
    TEX.clouds.push(L.c);
  }
  // soft fog puff
  const F2 = layer(400, 80, 2), fg = F2.g, gg = fg.createRadialGradient(200, 40, 4, 200, 40, 200);
  gg.addColorStop(0, 'rgba(255,255,255,.55)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); fg.save(); fg.scale(1, 0.2); fg.translate(0, 160); fg.fillStyle = gg; fg.fillRect(0, -160, 400, 400); fg.restore(); TEX.fog = F2.c;
  TEX.k = SCALE_K;
}

// ---------------------------------------------------------------- painting helpers (draw into a layer's g)
function ridgeY(x, base, amp, freq, seed, oct = 5) { return base - amp * clamp((fbm(x * freq + seed, seed * 0.37, oct) - 0.25) * 2.1, 0.04, 1); }
function paintRidge(g, base, amp, freq, seed, col, bottom, o = {}) {
  const pts = []; for (let x = -4; x <= VW + 4; x += 2) pts.push([x, ridgeY(x, base, amp, freq, seed, o.oct || 5)]);
  g.save(); g.beginPath(); g.moveTo(-4, bottom); for (const p of pts) g.lineTo(p[0], p[1]); g.lineTo(VW + 4, bottom); g.closePath();
  g.fillStyle = col; g.fill(); g.clip();
  if (o.shade) { // light from the upper-left: brighten slopes facing left, darken those facing right
    for (let i = 1; i < pts.length - 1; i++) {
      const s = pts[i + 1][1] - pts[i - 1][1]; const len = (bottom - pts[i][1]) * 0.9;
      g.strokeStyle = s < 0 ? 'rgba(255,255,255,' + Math.min(0.28, -s * 0.06) + ')' : 'rgba(0,0,30,' + Math.min(0.3, s * 0.07) + ')';
      g.lineWidth = 2.2; g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i][0] + len * 0.25, pts[i][1] + len); g.stroke();
    }
  }
  if (o.snow) {
    g.fillStyle = '#f4f8ff';
    for (const p of pts) if (p[1] < o.snow) { const d = (o.snow - p[1]) * (0.5 + 0.5 * NZ(p[0] * 0.1, 3)); g.fillRect(p[0] - 1.1, p[1] - 1, 2.4, Math.max(2, d)); }
  }
  if (o.tex) { const R = mulberry(seed | 0); for (let i = 0; i < o.tex; i++) { const x = R() * VW, y = base - amp + R() * (bottom - base + amp); g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(x, y, 1.5 + R() * 3, 1 + R() * 2); } }
  if (o.haze) { const hg = g.createLinearGradient(0, base - amp, 0, bottom); hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, o.haze); g.fillStyle = hg; g.fillRect(0, base - amp, VW, bottom - base + amp); }
  g.restore();
  return pts;
}
function treeRound(g, x, y, s, R, pal) {
  g.fillStyle = pal[3]; g.beginPath(); g.moveTo(x - 2 * s, y); g.lineTo(x - 1 * s, y - 13 * s); g.lineTo(x + 1 * s, y - 13 * s); g.lineTo(x + 2 * s, y); g.fill();
  const bl = []; for (let i = 0; i < 8; i++) bl.push([x + (R() - 0.5) * 16 * s, y - 16 * s - R() * 13 * s, (5.5 + R() * 5) * s]);
  g.fillStyle = pal[0]; for (const b of bl) { g.beginPath(); g.arc(b[0] + s, b[1] + 2 * s, b[2], 0, 7); g.fill(); }
  g.fillStyle = pal[1]; for (const b of bl) { g.beginPath(); g.arc(b[0] - 0.6 * s, b[1], b[2] * 0.86, 0, 7); g.fill(); }
  g.fillStyle = pal[2]; for (const b of bl) { g.beginPath(); g.arc(b[0] - 2.2 * s, b[1] - 2.2 * s, b[2] * 0.42, 0, 7); g.fill(); }
}
function treePine(g, x, y, s, pal) {
  g.fillStyle = pal[3]; g.fillRect(x - 1.2 * s, y - 6 * s, 2.4 * s, 6 * s);
  for (let i = 0; i < 4; i++) {
    const w = (11 - i * 2.2) * s, ty = y - 5 * s - i * 7 * s, h = 13 * s;
    g.fillStyle = pal[0]; g.beginPath(); g.moveTo(x, ty - h); g.lineTo(x + w, ty); g.lineTo(x - w, ty); g.fill();
    g.fillStyle = pal[1]; g.beginPath(); g.moveTo(x, ty - h); g.lineTo(x, ty); g.lineTo(x - w, ty); g.fill();
  }
}
function palmTree(g, x, y, s, lean = 1) {
  const tx = x + 22 * s * lean, ty = y - 70 * s;
  for (let i = 0; i < 14; i++) {
    const t = i / 14, px = x + (tx - x) * t * t, py = y + (ty - y) * t;
    g.fillStyle = i % 2 ? '#7a5634' : '#8d6640'; g.beginPath(); g.ellipse(px, py, 3.4 * s * (1 - t * 0.35), 3 * s, 0, 0, 7); g.fill();
  }
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.95 + i * (Math.PI * 0.95 / 3.2) + (i > 3 ? 0.4 : 0), L = (26 + (i % 3) * 5) * s;
    const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.6 + 10 * s;
    g.strokeStyle = i % 2 ? '#2f8a3e' : '#3fa04c'; g.lineWidth = 5 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo((tx + ex) / 2, ty - 8 * s + Math.sin(a) * 6 * s, ex, ey); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.2 * s; g.stroke();
  }
  g.fillStyle = '#5b3a1e'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(tx - 3 * s + i * 3 * s, ty + 4 * s, 2.6 * s, 0, 7); g.fill(); }
}
function cattails(g, x0, x1, y, R, n, s = 1) {
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), h = (18 + R() * 26) * s, b = (R() - 0.5) * 6;
    g.strokeStyle = R() < 0.5 ? '#4f7f3a' : '#6a9a45'; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + b * 0.5, y - h * 0.6, x + b, y - h); g.stroke();
    if (R() < 0.55) { g.fillStyle = '#6b4226'; g.beginPath(); g.ellipse(x + b, y - h + 4 * s, 1.9 * s, 5 * s, b * 0.03, 0, 7); g.fill(); }
    else { g.strokeStyle = '#5f9a48'; g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - b, y - h * 0.5, x - b * 2.2, y - h * 0.7); g.stroke(); }
  }
}
function grassTufts(g, x0, x1, y, R, n, cols) {
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), h = 3 + R() * 8;
    g.strokeStyle = cols[Math.floor(R() * cols.length)]; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x, y + 1); g.quadraticCurveTo(x + (R() - 0.5) * 3, y - h * 0.6, x + (R() - 0.5) * 6, y - h); g.stroke();
  }
}
function shadedRock(g, x, y, rx, ry, base) {
  const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.6, 1, x, y, rx * 1.1);
  gr.addColorStop(0, mix(base, '#ffffff', 0.35)); gr.addColorStop(0.6, base); gr.addColorStop(1, mix(base, '#000000', 0.45));
  g.fillStyle = gr; g.beginPath(); g.moveTo(x - rx, y);
  for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += 0.35) g.lineTo(x + Math.cos(a) * rx * (0.9 + 0.12 * Math.sin(a * 5 + x)), y + Math.sin(a) * ry * (0.85 + 0.15 * Math.cos(a * 3 + y)));
  g.closePath(); g.fill();
}

// ---------------------------------------------------------------- per-spot layers
// back  : distant scenery above the water (also used for reflections)
// front : the near bank / dock / boat (left side, whole height)
// under : water body, back rocks and the textured lake bed
const FRONT_W = 236;
function buildSpotLayers(S) {
  const prevF = F; F = S;
  try {
    const env = S.spot.env, R = mulberry(env.length * 31 + 7);
    const back = layer(VW, Y0 + 30), front = layer(FRONT_W, VH), under = layer(VW - XS, VH - Y0);
    paintBack[env](back.g, R, S);
    paintUnder(under.g, R, S);
    paintFront(front.g, R, S);
    S.L = { back: back.c, front: front.c, under: under.c, k: SCALE_K, tintKey: '' };
  } finally { F = prevF; }
}
function ensureTints(S, h, wx) {
  const key = Math.round(h * 4) + wx + S.L.k;
  if (S.L.tintKey === key) return;
  const c = lightColor(h, wx, S.spot.env), str = rgb(c);
  S.L.backT = tintCanvas(S.L.back, str); S.L.frontT = tintCanvas(S.L.front, str);
  S.L.cloudsT = TEX.clouds.map(cl => tintCanvas(cl, str)); S.L.tintKey = key;
}

const PAL = {
  leaf: ['#25603a', '#2f7a43', '#58a85a', '#4a3020'], leafFar: ['#3f7a66', '#4a8a72', '#6aa88a', '#4a5a50'],
  pine: ['#1f4f38', '#2c6a48', '', '#4a3020'], pineFar: ['#3a6a68', '#4a7f78', '', '#3d4f55'], cherry: ['#c9609a', '#ec8ec0', '#ffd0ea', '#5a3a30'],
};
const paintBack = {
  pond(g, R) {
    paintRidge(g, Y0 - 34, 70, 0.006, 3.1, '#9cb8c8', Y0 + 30, { shade: true, haze: 'rgba(205,228,245,.6)' });
    const p1 = paintRidge(g, Y0 - 6, 52, 0.009, 7.7, '#6f9f7c', Y0 + 30, { shade: true, haze: 'rgba(205,228,245,.4)' });
    for (let x = 4; x < VW; x += 13 + R() * 14) { const y = ridgeY(x, Y0 - 6, 52, 0.009, 7.7); treeRound(g, x, y + 6, 0.55 + R() * 0.25, R, PAL.leafFar); }
    const p2 = paintRidge(g, Y0 + 4, 28, 0.013, 12.3, '#4f9a55', Y0 + 30, { shade: true });
    for (let x = 300; x < VW; x += 16 + R() * 26) { const y = ridgeY(x, Y0 + 4, 28, 0.013, 12.3); treeRound(g, x, y + 8, 0.9 + R() * 0.5, R, PAL.leaf); }
    // a little red-roof cabin
    const cx = 760, cy = ridgeY(760, Y0 + 4, 28, 0.013, 12.3) + 6;
    g.fillStyle = '#a3774f'; g.fillRect(cx - 14, cy - 14, 28, 14); g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(cx - 18, cy - 13); g.lineTo(cx, cy - 26); g.lineTo(cx + 18, cy - 13); g.fill();
    g.fillStyle = '#ffe9a0'; g.fillRect(cx - 8, cy - 9, 5, 5); g.fillStyle = '#5a3a24'; g.fillRect(cx + 3, cy - 10, 6, 10);
    g.fillStyle = '#4b8f4f'; g.fillRect(0, Y0 - 3, VW, 33);
    cattails(g, XS + 200, VW, Y0 + 1, R, 70, 0.7);
  },
  river(g, R) {
    paintRidge(g, Y0 - 40, 130, 0.0045, 21.4, '#8c9cbc', Y0 + 30, { shade: true, snow: Y0 - 128, haze: 'rgba(210,228,248,.55)' });
    paintRidge(g, Y0 - 16, 92, 0.0065, 5.9, '#5f7590', Y0 + 30, { shade: true, snow: Y0 - 92, haze: 'rgba(210,228,248,.35)' });
    // waterfall
    const wx = 610, wy = ridgeY(610, Y0 - 16, 92, 0.0065, 5.9);
    const wg = g.createLinearGradient(0, wy, 0, Y0); wg.addColorStop(0, 'rgba(235,248,255,.95)'); wg.addColorStop(1, 'rgba(200,235,255,.5)');
    g.fillStyle = wg; g.fillRect(wx - 5, wy + 4, 10, Y0 - wy); g.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 5; i++) g.fillRect(wx - 4 + i * 2, wy + 4, 0.8, Y0 - wy);
    for (let x = 0; x < VW; x += 7 + R() * 7) { const y = ridgeY(x, Y0 + 2, 30, 0.012, 2.2); treePine(g, x, y + 10, 0.55 + R() * 0.3, PAL.pineFar); }
    paintRidge(g, Y0 + 8, 22, 0.016, 9.1, '#335f45', Y0 + 30, {});
    for (let x = 200; x < VW; x += 9 + R() * 10) { const y = ridgeY(x, Y0 + 8, 22, 0.016, 9.1); treePine(g, x, y + 10, 0.85 + R() * 0.45, PAL.pine); }
    g.fillStyle = '#3c6a45'; g.fillRect(0, Y0 - 2, VW, 32);
    for (let i = 0; i < 30; i++) shadedRock(g, XS + 120 + R() * (VW - XS - 120), Y0 + 1, 5 + R() * 9, 4 + R() * 6, '#7a8088');
  },
  coast(g, R) {
    paintRidge(g, Y0 - 30, 46, 0.02, 4.4, '#8a7a68', Y0 + 30, { shade: true, tex: 300 });
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillRect(0, 0, 730, Y0 + 30); g.restore();
    g.fillStyle = '#7fa6b8'; g.beginPath(); g.ellipse(360, Y0, 120, 16, 0, Math.PI, 0); g.fill(); g.beginPath(); g.ellipse(520, Y0, 60, 9, 0, Math.PI, 0); g.fill();
    palmTree(g, 330, Y0 - 12, 0.32); palmTree(g, 372, Y0 - 13, 0.28, -1);
    const lx = 860, ly = ridgeY(860, Y0 - 30, 46, 0.02, 4.4) + 4;
    for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#d63b3b' : '#f7f7f7'; g.fillRect(lx - 7 + i * 0.6, ly - 10 - i * 10, 14 - i * 1.2, 10); }
    g.fillStyle = '#333'; g.fillRect(lx - 6, ly - 60, 12, 10); g.fillStyle = '#ffe680'; g.fillRect(lx - 4, ly - 58, 8, 6); g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(lx - 8, ly - 60); g.lineTo(lx, ly - 70); g.lineTo(lx + 8, ly - 60); g.fill();
  },
  deep(g, R) {
    paintRidge(g, Y0 - 4, 30, 0.02, 8.8, '#6d84a2', Y0 + 1, { shade: true });
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillRect(0, 0, 560, Y0 + 30); g.restore();
    g.fillStyle = '#8399b4'; g.beginPath(); g.ellipse(690, Y0, 150, 22, 0, Math.PI, 0); g.fill(); g.fillStyle = '#9fb2c8'; g.beginPath(); g.ellipse(420, Y0, 80, 10, 0, Math.PI, 0); g.fill();
    const sx = 300; g.fillStyle = '#5a6a80'; g.beginPath(); g.moveTo(sx - 30, Y0 - 6); g.lineTo(sx + 32, Y0 - 6); g.lineTo(sx + 26, Y0); g.lineTo(sx - 26, Y0); g.fill(); g.fillRect(sx - 12, Y0 - 14, 20, 8); g.fillRect(sx + 4, Y0 - 22, 4, 8);
  },
  cave(g, R) {
    const gr = g.createLinearGradient(0, 0, 0, Y0 + 30); gr.addColorStop(0, '#07081a'); gr.addColorStop(1, '#1b1d40'); g.fillStyle = gr; g.fillRect(0, 0, VW, Y0 + 30);
    // far wall texture + arches
    for (let i = 0; i < 1800; i++) { g.fillStyle = R() < 0.5 ? 'rgba(120,130,200,.05)' : 'rgba(0,0,0,.18)'; g.fillRect(R() * VW, R() * (Y0 + 30), 1 + R() * 4, 1 + R() * 3); }
    for (let i = 0; i < 4; i++) { const ax = 200 + i * 220, aw = 70 + R() * 50; g.fillStyle = 'rgba(4,4,14,.6)'; g.beginPath(); g.ellipse(ax, Y0 + 10, aw, 90 + R() * 30, 0, Math.PI, 0); g.fill(); }
    // ceiling with stalactites
    g.fillStyle = '#100f26'; g.beginPath(); g.moveTo(0, 0); g.lineTo(VW, 0); g.lineTo(VW, 40);
    for (let x = VW; x >= 0; x -= 6) g.lineTo(x, 40 + 14 * fbm(x * 0.03, 2) + (x % 54 < 6 ? 30 + 30 * NZ(x * 0.1) : 0));
    g.closePath(); g.fill();
    for (let i = 0; i < 26; i++) { const x = R() * VW, L = 20 + R() * 60, w = 4 + R() * 8; const sg = g.createLinearGradient(x - w, 0, x + w, 0); sg.addColorStop(0, '#2c2a55'); sg.addColorStop(0.4, '#4a4880'); sg.addColorStop(1, '#14132d'); g.fillStyle = sg; g.beginPath(); g.moveTo(x - w, 30); g.lineTo(x + w, 30); g.lineTo(x + w * 0.1, 30 + L); g.closePath(); g.fill(); }
    paintRidge(g, Y0 + 6, 40, 0.012, 3.3, '#232147', Y0 + 30, { shade: true, tex: 400 });
    S_CRYSTALS.length = 0; for (let i = 0; i < 14; i++) S_CRYSTALS.push({ x: 140 + R() * 800, y: 30 + R() * 50 + (i % 3 ? 0 : Y0 - 90), s: 0.6 + R() * 0.9, hue: R() < 0.5 ? 175 : 300, ph: R() * 6 });
    for (const c of S_CRYSTALS) crystal(g, c.x, c.y, c.s, c.hue, 1);
  },
  legend(g, R) {
    paintRidge(g, Y0 - 30, 110, 0.005, 17.2, '#8f7fc0', Y0 + 30, { shade: true, snow: Y0 - 118, haze: 'rgba(240,215,255,.5)' });
    // floating islands with waterfalls
    for (let i = 0; i < 3; i++) {
      const ix = 250 + i * 230 + R() * 40, iy = 45 + R() * 40, w = 34 + R() * 26;
      g.fillStyle = '#6a5a8a'; g.beginPath(); g.moveTo(ix - w, iy); g.lineTo(ix + w, iy); g.lineTo(ix + w * 0.2, iy + w * 0.9); g.lineTo(ix - w * 0.3, iy + w * 0.7); g.closePath(); g.fill();
      g.fillStyle = '#7fd08a'; g.beginPath(); g.ellipse(ix, iy, w, 6, 0, 0, 7); g.fill();
      treeRound(g, ix - w * 0.4, iy, 0.6, R, PAL.cherry); treeRound(g, ix + w * 0.3, iy, 0.5, R, PAL.cherry);
      g.fillStyle = 'rgba(220,240,255,.6)'; g.fillRect(ix + w * 0.6, iy + 2, 3, 60 + R() * 40);
    }
    paintRidge(g, Y0 + 2, 26, 0.012, 6.2, '#6f62a8', Y0 + 30, { shade: true });
    for (let x = 220; x < VW; x += 22 + R() * 30) treeRound(g, x, ridgeY(x, Y0 + 2, 26, 0.012, 6.2) + 8, 0.9 + R() * 0.5, R, PAL.cherry);
    // great stone arch
    const ax = 720; const stone = '#b9b0e0', sd = '#7f76b0';
    g.fillStyle = sd; g.fillRect(ax - 70, Y0 - 120, 20, 122); g.fillRect(ax + 50, Y0 - 120, 20, 122);
    g.fillStyle = stone; g.fillRect(ax - 74, Y0 - 120, 14, 122); g.fillRect(ax + 46, Y0 - 120, 14, 122);
    g.fillStyle = sd; g.fillRect(ax - 92, Y0 - 136, 184, 16); g.fillStyle = stone; g.fillRect(ax - 92, Y0 - 136, 184, 6); g.fillRect(ax - 72, Y0 - 104, 144, 8);
  },
};
const S_CRYSTALS = [];
function crystal(g, x, y, s, hue, a) {
  for (let i = -1; i <= 1; i++) {
    const h = (22 + Math.abs(i) * -6) * s, w = 5 * s, cx = x + i * 6 * s;
    const gr = g.createLinearGradient(cx - w, 0, cx + w, 0); gr.addColorStop(0, 'hsla(' + hue + ',90%,82%,' + a + ')'); gr.addColorStop(0.5, 'hsla(' + hue + ',85%,62%,' + a + ')'); gr.addColorStop(1, 'hsla(' + hue + ',80%,38%,' + a + ')');
    g.fillStyle = gr; g.beginPath(); g.moveTo(cx - w, y); g.lineTo(cx - w * 0.6, y - h * 0.8); g.lineTo(cx + i * 2 * s, y - h); g.lineTo(cx + w * 0.7, y - h * 0.75); g.lineTo(cx + w, y); g.closePath(); g.fill();
  }
}

const BED = { pond: ['#4b5e3a', '#2c3a24'], river: ['#77736a', '#3d3b38'], coast: ['#e8d49a', '#b89c63'], cave: ['#2e2b52', '#15132c'], deep: ['#283350', '#0d1326'], legend: ['#5d589c', '#2c2860'] };
function paintUnder(g, R, S) {
  const sp = S.spot, env = sp.env;
  g.save(); g.translate(-XS, -Y0);
  const wg = g.createLinearGradient(0, Y0, 0, VH); wg.addColorStop(0, sp.water[0]); wg.addColorStop(0.45, mix(sp.water[0], sp.water[1], 0.6)); wg.addColorStop(1, sp.water[1]);
  g.fillStyle = wg; g.fillRect(XS, Y0, VW - XS, VH - Y0);
  // distant underwater ridges (soft, out of focus)
  const far = mix(sp.water[1], sp.water[0], 0.45), mid = mix(sp.water[1], sp.water[0], 0.25);
  [[far, 120, 0.012, 0.55, 2.5], [mid, 70, 0.02, 0.75, 1.2]].forEach(([col, amp, fr, al, bl], j) => {
    if (CAN_FILTER) g.filter = 'blur(' + bl + 'px)';
    g.globalAlpha = al; g.fillStyle = col; g.beginPath(); g.moveTo(XS, VH);
    for (let x = XS; x <= VW; x += 4) { const b = depthY(bottomAt((x - XS) / F.pxm)); g.lineTo(x, Math.min(b, b - 20 - amp * fbm(x * fr + j * 9, j * 3))); }
    g.lineTo(VW, VH); g.closePath(); g.fill(); g.filter = 'none'; g.globalAlpha = 1;
  });
  if (env === 'legend') { // sunken temple columns
    for (let i = 0; i < 4; i++) { const x = 420 + i * 120, b = depthY(bottomAt((x - XS) / F.pxm)), h = 40 + R() * 70; g.globalAlpha = 0.55; shadedColumn(g, x, b, 16, h); g.globalAlpha = 1; }
  }
  // lake bed
  const bed = BED[env];
  const path = () => { g.beginPath(); g.moveTo(XS, depthY(bottomAt(0))); for (let x = 0; x <= sp.W + 0.01; x += 0.25) g.lineTo(xPx(x), depthY(bottomAt(x))); g.lineTo(VW, VH + 2); g.lineTo(XS, VH + 2); g.closePath(); };
  path(); const bg = g.createLinearGradient(0, Y0 + 40, 0, VH); bg.addColorStop(0, bed[0]); bg.addColorStop(1, bed[1]); g.fillStyle = bg; g.fill();
  g.save(); path(); g.clip();
  for (let i = 0; i < 5000; i++) { const x = XS + R() * (VW - XS), y = Y0 + 20 + R() * (VH - Y0); const l = R(); g.fillStyle = l < 0.5 ? 'rgba(255,255,255,' + (0.04 + R() * 0.08) + ')' : 'rgba(0,0,0,' + (0.06 + R() * 0.12) + ')'; g.fillRect(x, y, 0.8 + R() * 2.2, 0.8 + R() * 1.6); }
  if (env === 'coast') { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.2; for (let i = 0; i < 40; i++) { const x = XS + R() * (VW - XS), y = depthY(bottomAt((x - XS) / F.pxm)) + 6 + R() * 50; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 3, x + 20, y); g.quadraticCurveTo(x + 30, y + 3, x + 40, y); g.stroke(); } }
  // top edge light
  g.restore();
  g.beginPath(); for (let x = 0; x <= sp.W + 0.01; x += 0.25) { const X = xPx(x), Y = depthY(bottomAt(x)); x ? g.lineTo(X, Y) : g.moveTo(X, Y); }
  g.strokeStyle = mix(bed[0], '#ffffff', 0.35); g.lineWidth = 2.5; g.stroke(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 6; g.globalCompositeOperation = 'destination-over'; g.stroke(); g.globalCompositeOperation = 'source-over';
  // static decor: rocks, corals, crystals, shells
  for (const d of S.decor) {
    const bx = xPx(d.x), by = depthY(bottomAt(d.x)) + 3;
    if (d.kind === 'rock') shadedRock(g, bx, by, 14 * d.s, 10 * d.s, env === 'cave' ? '#4a4680' : env === 'coast' ? '#9a9080' : env === 'legend' ? '#8f86c8' : '#6d747c');
    else if (d.kind === 'coral') coral(g, bx, by, d.h, d.hue, R);
    else if (d.kind === 'crystal') crystal(g, bx, by, d.h * 0.8, 170 + d.hue % 140, 0.95);
  }
  if (env === 'coast') for (let i = 0; i < 14; i++) { const x = XS + 40 + R() * (VW - XS - 60), y = depthY(bottomAt((x - XS) / F.pxm)) + 4; star5(g, x, y, 5 + R() * 4, R() < 0.5 ? '#ff8a5a' : '#ffd25a'); }
  g.restore();
}
function shadedColumn(g, x, base, w, h) {
  const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, '#d8d0ff'); gr.addColorStop(0.5, '#a49bd8'); gr.addColorStop(1, '#5d5598');
  g.fillStyle = gr; g.fillRect(x - w / 2, base - h, w, h); g.fillRect(x - w / 2 - 4, base - h - 6, w + 8, 6);
  g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 1; i < 4; i++) g.fillRect(x - w / 2 + i * w / 4, base - h, 1, h);
}
function coral(g, x, y, h, hue, R) {
  const col = 'hsl(' + hue + ',70%,58%)', hi = 'hsl(' + hue + ',85%,74%)';
  const branch = (bx, by, a, L, d) => {
    if (d > 4 || L < 3) { g.fillStyle = hi; g.beginPath(); g.arc(bx, by, 2.2, 0, 7); g.fill(); return; }
    const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L;
    g.strokeStyle = col; g.lineWidth = Math.max(1.5, 5 - d); g.lineCap = 'round'; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
    branch(ex, ey, a - 0.45 - R() * 0.2, L * 0.72, d + 1); branch(ex, ey, a + 0.4 + R() * 0.2, L * 0.7, d + 1);
  };
  branch(x, y, -Math.PI / 2 + (R() - 0.5) * 0.3, 10 * h + 6, 0);
}
function star5(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6); } g.closePath(); g.fill(); }

function paintFront(g, R, S) {
  const env = S.spot.env, top = Y0 - 14;
  if (env === 'deep') { // the boat
    const wg = g.createLinearGradient(0, Y0, 0, VH); wg.addColorStop(0, S.spot.water[0]); wg.addColorStop(1, S.spot.water[1]); g.fillStyle = wg; g.fillRect(0, Y0, XS, VH - Y0);
    const hull = () => { g.beginPath(); g.moveTo(-10, top - 4); g.lineTo(XS + 36, top - 4); g.quadraticCurveTo(XS + 30, Y0 + 40, XS - 10, Y0 + 70); g.lineTo(-10, Y0 + 84); g.closePath(); };
    hull(); const hg = g.createLinearGradient(0, top, 0, Y0 + 84); hg.addColorStop(0, '#f2efe8'); hg.addColorStop(0.18, '#d9d3c7'); hg.addColorStop(0.2, '#2a5aa8'); hg.addColorStop(0.3, '#1d4486'); hg.addColorStop(0.32, '#b8342f'); hg.addColorStop(1, '#6e1c1a'); g.fillStyle = hg; g.fill();
    g.save(); hull(); g.clip(); g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(-10, top + 8 + i * 8); g.lineTo(XS + 40, top + 8 + i * 8 - 2); g.stroke(); }
    const sh = g.createLinearGradient(0, 0, XS + 40, 0); sh.addColorStop(0, 'rgba(0,0,0,.25)'); sh.addColorStop(0.7, 'rgba(255,255,255,.08)'); sh.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = sh; g.fillRect(-10, top - 4, XS + 60, 100); g.restore();
    g.fillStyle = '#8a5a30'; g.fillRect(-10, top - 8, XS + 46, 6); g.fillStyle = '#b07a44'; g.fillRect(-10, top - 8, XS + 46, 2);
    g.strokeStyle = '#d9dde3'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= XS + 30; x += 18) { g.moveTo(x, top - 8); g.lineTo(x, top - 30); } g.moveTo(0, top - 30); g.lineTo(XS + 30, top - 30); g.moveTo(0, top - 20); g.lineTo(XS + 30, top - 20); g.stroke();
    g.strokeStyle = '#e04646'; g.lineWidth = 5; g.beginPath(); g.arc(30, Y0 + 2, 10, 0, 7); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.setLineDash([5, 5]); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#6b4a2a'; g.fillRect(4, top - 140, 6, 132); g.fillStyle = 'rgba(245,240,225,.95)'; g.beginPath(); g.moveTo(12, top - 136); g.quadraticCurveTo(70, top - 90, 60, top - 30); g.lineTo(12, top - 30); g.closePath(); g.fill();
    return;
  }
  // ground cross-section
  const soil = { pond: ['#6b4a2f', '#3e2a1a'], river: ['#6c6660', '#3a3632'], coast: ['#e2cf98', '#b59a62'], cave: ['#2c2a52', '#121128'], legend: ['#8a82c8', '#4a4488'] }[env];
  g.beginPath(); g.moveTo(0, top); g.lineTo(XS + 2, top); g.lineTo(XS + 2, Y0 + 2);
  for (let y = Y0; y <= VH; y += 6) g.lineTo(XS + 2 + 6 * fbm(y * 0.05, 4) + (y - Y0) * 0.02, y);
  g.lineTo(0, VH); g.closePath();
  const sg = g.createLinearGradient(0, top, 0, VH); sg.addColorStop(0, soil[0]); sg.addColorStop(1, soil[1]); g.fillStyle = sg; g.fill();
  g.save(); g.clip();
  for (let i = 0; i < 1600; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.14)'; g.fillRect(R() * (XS + 10), top + R() * (VH - top), 1 + R() * 3, 1 + R() * 2); }
  g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; for (let i = 0; i < 7; i++) { const y = top + 40 + i * 48 + R() * 10; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y + 6, 80, y - 6, XS + 6, y + 3); g.stroke(); }
  for (let i = 0; i < 14; i++) shadedRock(g, R() * XS, top + 30 + R() * (VH - top - 30), 5 + R() * 8, 4 + R() * 6, env === 'coast' ? '#c7b07a' : env === 'cave' ? '#3a3866' : '#7d756c');
  if (env === 'pond' || env === 'river') { g.strokeStyle = 'rgba(70,45,25,.6)'; g.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const x = R() * XS; g.beginPath(); g.moveTo(x, top + 8); g.bezierCurveTo(x + 10, top + 30, x - 8, top + 50, x + 4, top + 70 + R() * 40); g.stroke(); } }
  g.restore();
  // top surface
  if (env === 'cave') { g.fillStyle = '#3d3a6e'; g.fillRect(0, top - 2, XS + 2, 6); crystal(g, 18, top, 0.9, 175, 1); crystal(g, 50, top, 0.6, 300, 1); }
  else if (env === 'legend') { g.fillStyle = '#d4ccff'; g.fillRect(0, top - 4, XS + 2, 8); g.fillStyle = '#a99fe0'; g.fillRect(0, top + 4, XS + 2, 4); for (let x = 0; x < XS; x += 26) { g.fillStyle = 'rgba(80,70,140,.4)'; g.fillRect(x, top - 4, 1, 12); } }
  else if (env === 'coast') { g.fillStyle = '#efdfae'; g.fillRect(0, top - 3, XS + 2, 6); for (let i = 0; i < 8; i++) star5(g, 10 + R() * (XS - 20), top + 1, 3, '#ff9a6a'); palmTree(g, 26, top, 1.15, -0.3); }
  else { const gg = g.createLinearGradient(0, top - 6, 0, top + 8); gg.addColorStop(0, env === 'river' ? '#5a9a52' : '#5fb35a'); gg.addColorStop(1, '#3a7a3a'); g.fillStyle = gg; g.fillRect(0, top - 4, XS + 2, 10); grassTufts(g, 0, XS + 4, top - 3, R, 220, ['#4f9a48', '#6cbf5a', '#3f8a3c', '#88cf66']); for (let i = 0; i < 8; i++) { const x = R() * XS; g.fillStyle = pick(['#ff9ec8', '#fff27a', '#ffffff', '#b7a0ff']); g.beginPath(); g.arc(x, top - 5 - R() * 4, 1.8, 0, 7); g.fill(); } }
  if (env !== 'cave') { // dock
    const wood = env === 'coast' ? ['#c9b08a', '#9c8360'] : env === 'legend' ? ['#cfc6f0', '#9a90d0'] : ['#9a6a3c', '#6a4422'];
    for (const px of [XS - 44, XS - 4, XS + 34]) { const pg = g.createLinearGradient(px, 0, px + 7, 0); pg.addColorStop(0, wood[0]); pg.addColorStop(1, wood[1]); g.fillStyle = pg; g.fillRect(px, top - 2, 7, 70); g.fillStyle = 'rgba(0,30,50,.35)'; g.fillRect(px, Y0, 7, 68); }
    for (let i = 0; i < 7; i++) { const x = XS - 52 + i * 13.5; const pg = g.createLinearGradient(0, top - 2, 0, top + 7); pg.addColorStop(0, mix(wood[0], '#ffffff', 0.15)); pg.addColorStop(1, wood[1]); g.fillStyle = pg; g.fillRect(x, top - 2, 12.5, 7); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 12.5, top - 2, 1, 7); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 2, top, 1, 1); g.fillRect(x + 9, top, 1, 1); }
    g.fillStyle = wood[1]; g.fillRect(XS - 52, top + 5, 96, 3);
    // tackle box + bucket + lantern post
    const tb = 26; g.fillStyle = '#b8322e'; g.fillRect(tb, top - 13, 22, 12); g.fillStyle = '#d94a42'; g.fillRect(tb, top - 13, 22, 3); g.fillStyle = '#ddd'; g.fillRect(tb + 9, top - 16, 5, 3); g.fillStyle = '#e8c04a'; g.fillRect(tb + 10, top - 9, 3, 3);
    const bg = g.createLinearGradient(52, 0, 68, 0); bg.addColorStop(0, '#9aa6b2'); bg.addColorStop(0.5, '#e4eaf0'); bg.addColorStop(1, '#6f7a86'); g.fillStyle = bg; g.beginPath(); g.moveTo(52, top - 15); g.lineTo(67, top - 15); g.lineTo(65, top - 1); g.lineTo(54, top - 1); g.closePath(); g.fill(); g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.arc(59.5, top - 15, 7, Math.PI, 0); g.stroke();
    const lx = XS + 34 + 3.5; g.fillStyle = wood[1]; g.fillRect(lx - 1.5, top - 46, 3, 44); g.fillRect(lx - 1.5, top - 46, 10, 2.5); g.fillStyle = '#333'; g.fillRect(lx + 5, top - 44, 7, 10); g.fillStyle = '#ffdd88'; g.fillRect(lx + 6, top - 42, 5, 6);
    S.lantern = { x: lx + 8.5, y: top - 39 };
  }
  if (env === 'pond' || env === 'river') cattails(g, XS - 14, XS + 26, Y0 + 2, R, 18, 1);
}
