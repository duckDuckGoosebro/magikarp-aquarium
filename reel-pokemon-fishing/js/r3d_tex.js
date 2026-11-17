'use strict';
// ================================================================ 3D renderer: textures painted in code (no image files)
// Everything here is drawn on canvases at start-up: rock, leaves, water noise, caustics, sand, bark, cork...
// The only image files the 3D view uses are the Pokemon sprite strips and the angler portrait.
const T3 = {};
function t3canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
function t3tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  if (o.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (o.nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  t.anisotropy = o.aniso || 4;
  return t;
}
// tileable value noise + fbm (Float32 0..1)
function t3noise(size, cells, seed) {
  const R = mulberry(seed), g = new Float32Array(cells * cells); for (let i = 0; i < g.length; i++) g[i] = R();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = x / size * cells, fy = y / size * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
    const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
    out[y * size + x] = lerp(lerp(g[y0 * cells + x0], g[y0 * cells + x1], tx), lerp(g[y1 * cells + x0], g[y1 * cells + x1], tx), ty);
  }
  return out;
}
function t3fbm(size, cells, seed, oct) {
  const out = new Float32Array(size * size); let a = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) { const c = cells << o; if (c > size / 2) break; const n = t3noise(size, c, seed + o * 17); for (let i = 0; i < out.length; i++) out[i] += n[i] * a; tot += a; a *= 0.5; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function t3fromFloat(size, fn) {
  const c = t3canvas(size), g = c.getContext('2d'), im = g.createImageData(size, size), d = im.data;
  for (let i = 0; i < size * size; i++) { const v = fn(i, i % size, (i / size) | 0); d[i * 4] = v[0]; d[i * 4 + 1] = v[1]; d[i * 4 + 2] = v[2]; d[i * 4 + 3] = v.length > 3 ? v[3] : 255; }
  g.putImageData(im, 0, 0); return c;
}

function buildT3() {
  if (T3.done) return; T3.done = true;
  const R = mulberry(4242);
  // ---- noise (r,g,b = three different fbm fields) and a water normal map
  {
    const S = 256, a = t3fbm(S, 4, 11, 5), b = t3fbm(S, 8, 23, 4), c = t3fbm(S, 16, 37, 3);
    T3.noise = t3tex(t3fromFloat(S, i => [a[i] * 255, b[i] * 255, c[i] * 255]));
    const h = t3fbm(S, 6, 51, 5);
    T3.wnorm = t3tex(t3fromFloat(S, (i, x, y) => {
      const l = h[y * S + ((x + S - 1) % S)], r = h[y * S + ((x + 1) % S)], u = h[((y + S - 1) % S) * S + x], dn = h[((y + 1) % S) * S + x];
      return [clamp(128 + (l - r) * 1400, 0, 255), clamp(128 + (u - dn) * 1400, 0, 255), h[i] * 255];
    }));
  }
  // ---- caustics: bright network of lines (cell borders of a warped worley noise)
  {
    const S = 256, C = 7, pts = []; for (let i = 0; i < C * C; i++) pts.push([R(), R()]);
    const wa = t3fbm(S, 4, 71, 3), wb = t3fbm(S, 4, 93, 3);
    T3.caus = t3tex(t3fromFloat(S, (i, x, y) => {
      const fx = (x / S + (wa[i] - 0.5) * 0.09) * C, fy = (y / S + (wb[i] - 0.5) * 0.09) * C, cx = Math.floor(fx), cy = Math.floor(fy);
      let f1 = 9, f2 = 9;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const gx = cx + ox, gy = cy + oy, p = pts[(((gy % C) + C) % C) * C + (((gx % C) + C) % C)];
        const d = Math.hypot(gx + p[0] - fx, gy + p[1] - fy); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      const v = Math.pow(clamp(1 - (f2 - f1) * 3.2, 0, 1), 2.6) * 255; return [v, v, v];
    }));
  }
  // ---- granite: grey grain, blotches, dark cracks with a light edge, pale veins
  {
    const S = 512, a = t3fbm(S, 3, 101, 6), b = t3fbm(S, 32, 131, 3), st = t3fbm(S, 2, 151, 3);
    const c = t3fromFloat(S, (i, x, y) => {
      let v = 0.56 + (a[i] - 0.5) * 0.75 + (b[i] - 0.5) * 0.3 + Math.sin((y / S + st[i] * 0.6) * 38) * 0.035;
      const sp = Math.sin(i * 12.9898) * 43758.5453, r = sp - Math.floor(sp); if (r > 0.985) v += 0.16; else if (r < 0.02) v -= 0.14;
      v = clamp(v, 0.08, 1); return [v * 238, v * 240, v * 246];
    });
    const g = c.getContext('2d'); g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < 9; k++) { g.fillStyle = 'rgba(' + (R() < 0.5 ? '255,255,255' : '0,0,0') + ',' + (0.05 + R() * 0.08) + ')'; g.beginPath(); const cx = R() * S, cy = R() * S; for (let j = 0; j < 5; j++) { const an = j / 5 * 6.28 + R(), rr = 50 + R() * 110; g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } g.fill(); }
    for (let k = 0; k < 26; k++) {
      let x = R() * S, y = R() * S, an = R() * 6.28; const pts = [[x, y]], n = 6 + Math.floor(R() * 12);
      for (let j = 0; j < n; j++) { an += (R() - 0.5) * 1.3; x += Math.cos(an) * (8 + R() * 22); y += Math.sin(an) * (8 + R() * 22); pts.push([x, y]); }
      const path = (ox, oy) => { g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0] + ox, p[1] + oy) : g.moveTo(p[0] + ox, p[1] + oy)); g.stroke(); };
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
        g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.2; path(ox + 1.6, oy + 1.6);
        g.strokeStyle = 'rgba(16,17,22,.7)'; g.lineWidth = 0.8 + R() * 2.2; path(ox, oy);
      }
    }
    for (let k = 0; k < 7; k++) { g.strokeStyle = 'rgba(250,250,255,.22)'; g.lineWidth = 1 + R() * 3; g.beginPath(); const y = R() * S; g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + (R() - 0.5) * 120, S * 0.6, y + (R() - 0.5) * 120, S, y); g.stroke(); }
    T3.granite = t3tex(c, { aniso: 8 });
  }
  // ---- leaves: a sprig of small light leaves on transparent (tinted per tree)
  const leafCard = (seed, n, len, wid) => {
    const S = 256, c = t3canvas(S), g = c.getContext('2d'), Q = mulberry(seed);
    for (let i = 0; i < n; i++) {
      const an = Q() * 6.28, rr = Math.sqrt(Q()) * 104, x = S / 2 + Math.cos(an) * rr, y = S / 2 + Math.sin(an) * rr, rot = Q() * 6.28, l = len * (0.7 + Q() * 0.6), w = wid * (0.7 + Q() * 0.6), v = Math.floor(120 + Q() * 135);
      g.save(); g.translate(x, y); g.rotate(rot);
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(0, -w * 1.5, l, 0); g.quadraticCurveTo(0, w * 1.5, -l, 0); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-l, 0); g.lineTo(l, 0); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-l * 0.2, -w * 0.3, l * 0.5, w * 0.25, 0, 0, 7); g.fill();
      g.restore();
    }
    return t3tex(c, { repeat: false });
  };
  T3.leaf = leafCard(7, 95, 15, 7);
  T3.petal = leafCard(9, 120, 9, 6);
  // ---- palm frond card, reed card, grass card
  {
    let c = t3canvas(256, 128), g = c.getContext('2d');
    g.strokeStyle = '#d8d8d8'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 64); g.quadraticCurveTo(128, 40, 256, 70); g.stroke();
    for (let i = 0; i < 42; i++) { const t = i / 42, x = t * 250 + 3, y = 64 - Math.sin(t * 2.6) * 22 + t * t * 26, l = 58 * (1 - t * 0.6) * (0.4 + Math.sin(Math.min(1, t * 3) * 1.57) * 0.6), v = 150 + (i * 53 % 100); g.strokeStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y - l); g.moveTo(x, y); g.lineTo(x + 14, y + l); g.stroke(); }
    T3.frond = t3tex(c, { repeat: false });
    c = t3canvas(128, 256); g = c.getContext('2d'); g.lineCap = 'round';
    for (let i = 0; i < 11; i++) { const x = 14 + i * 10 + R() * 5, h = 120 + R() * 125, bend = (R() - 0.5) * 46, v = 140 + Math.floor(R() * 110); g.strokeStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.lineWidth = 3 + R() * 3; g.beginPath(); g.moveTo(x, 256); g.quadraticCurveTo(x, 256 - h * 0.6, x + bend, 256 - h); g.stroke(); if (i % 4 === 1) { g.strokeStyle = '#5a4030'; g.lineWidth = 9; g.beginPath(); g.moveTo(x + bend * 0.72, 256 - h * 0.86); g.lineTo(x + bend, 256 - h); g.stroke(); } }
    T3.reed = t3tex(c, { repeat: false });
  }
  // ---- ground / bed tiles
  const tile = (seed, base, vary, deco) => {
    const S = 256, a = t3fbm(S, 4, seed, 5), b = t3fbm(S, 32, seed + 5, 2), c0 = hexRGB(base[0]), c1 = hexRGB(base[1]);
    const c = t3fromFloat(S, i => { const k = clamp(a[i] * 1.5 - 0.25, 0, 1), m = 1 + (b[i] - 0.5) * vary; return [lerp(c1[0], c0[0], k) * m, lerp(c1[1], c0[1], k) * m, lerp(c1[2], c0[2], k) * m]; });
    if (deco) deco(c.getContext('2d'), S, mulberry(seed + 99)); return t3tex(c, { aniso: 8 });
  };
  const pebbles = (cols, n, r0, r1) => (g, S, Q) => { for (let i = 0; i < n; i++) { const x = Q() * S, y = Q() * S, rx = r0 + Q() * (r1 - r0), ry = rx * (0.6 + Q() * 0.4), col = cols[Math.floor(Q() * cols.length)], rot = Q() * 3; for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + ox + 1.5, y + oy + 2, rx, ry, rot, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, rot, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(x + ox - rx * 0.25, y + oy - ry * 0.3, rx * 0.45, ry * 0.3, rot, 0, 7); g.fill(); } } };
  const blades = cols => (g, S, Q) => { g.lineCap = 'round'; for (let i = 0; i < 900; i++) { const x = Q() * S, y = Q() * S; g.strokeStyle = cols[Math.floor(Q() * cols.length)]; g.lineWidth = 1 + Q(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Q() - 0.5) * 6, y - 3 - Q() * 7); g.stroke(); } };
  T3.land = {
    pond: tile(201, ['#5fae45', '#3a7a30'], 0.35, blades(['#7fd05a', '#2f6a2a', '#9be06a', '#4a9a3a'])),
    river: tile(202, ['#6f8a52', '#4a5a3c'], 0.4, blades(['#86a860', '#3a4a30', '#a0b878'])),
    coast: tile(203, ['#f2e2b0', '#d8c084'], 0.16, pebbles(['#fff4d0', '#c8a870', '#e8d8b0'], 50, 1, 2.6)),
    cave: tile(204, ['#4a4878', '#262446'], 0.45, pebbles(['#5a5890', '#201e3c', '#6a68a0'], 60, 2, 7)),
    deep: tile(205, ['#3a4668', '#141a30'], 0.4),
    legend: tile(206, ['#b8b0e0', '#7f78c0'], 0.3, blades(['#e0d8ff', '#8a80c8', '#ffd0f0'])),
  };
  T3.bed = {
    pond: tile(301, ['#8a8a5a', '#4b5e3a'], 0.4, pebbles(['#9a9a70', '#5a6a48', '#767a58', '#3f5236'], 70, 2, 6)),
    river: tile(302, ['#b0a898', '#6a665e'], 0.35, pebbles(['#c8c2b6', '#8a8680', '#6f6c68', '#a89c88', '#585654'], 120, 3, 10)),
    coast: tile(303, ['#f4e4b0', '#c8ac70'], 0.2, pebbles(['#fff6d8', '#d0b47c', '#ff9a8a'], 40, 1, 3)),
    cave: tile(304, ['#55528c', '#25234a'], 0.45, pebbles(['#6a66a8', '#2c2a56', '#7f7ac0'], 70, 2, 8)),
    deep: tile(305, ['#46567e', '#182040'], 0.4, pebbles(['#52628c', '#1c2446'], 40, 3, 9)),
    legend: tile(306, ['#9a94d8', '#514c98'], 0.35, pebbles(['#c0b8f0', '#6a64b0', '#f0c8ff'], 70, 2, 7)),
  };
  // ---- bark, cork, deck planks
  {
    let c = t3fromFloat(128, (i, x, y) => { const v = 0.55 + Math.sin(x * 0.55 + Math.sin(y * 0.09) * 3) * 0.2 + (Math.sin(i * 7.31) * 0.5) * 0.12; return [v * 150, v * 110, v * 78]; }); T3.bark = t3tex(c);
    c = t3fromFloat(128, i => { const s = Math.sin(i * 12.9898) * 43758.5453, r = s - Math.floor(s), v = 0.84 + r * 0.16; return r > 0.94 ? [120, 82, 50] : [214 * v, 168 * v, 112 * v]; }); T3.cork = t3tex(c);
    c = t3canvas(256); let g = c.getContext('2d'); g.fillStyle = '#b98954'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) { g.strokeStyle = 'rgba(' + (R() < 0.5 ? '80,50,24' : '230,190,130') + ',' + (0.08 + R() * 0.14) + ')'; g.lineWidth = 1; const x = R() * 256, y = R() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y + 20 + R() * 50); g.stroke(); }
    g.fillStyle = '#4a2f18'; for (let i = 0; i < 4; i++) g.fillRect(i * 64 - 2, 0, 4, 256);
    g.fillStyle = '#2c1c0e'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.arc(i * 64 + 10, 30 + j * 128, 2.5, 0, 7); g.arc(i * 64 + 54, 30 + j * 128, 2.5, 0, 7); g.fill(); }
    T3.deck = t3tex(c, { aniso: 8 });
  }
  // ---- backdrop strips (alpha): forest wall, far hills / islands
  const strip = (seed, paint) => { const c = t3canvas(1024, 256), g = c.getContext('2d'); paint(g, mulberry(seed)); const t = t3tex(c); t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  T3.forest = strip(401, (g, Q) => {
    for (let layer = 0; layer < 3; layer++) { const v = [62, 92, 128][layer]; for (let i = 0; i < 130; i++) { const x = Q() * 1024, r = 22 + Q() * 34, y = 90 + layer * 42 + Q() * 60 - (layer === 0 ? Q() * 60 : 0), k = v + Q() * 40; g.fillStyle = 'rgb(' + (k * 0.62) + ',' + k + ',' + (k * 0.5) + ')'; for (const ox of [0, 1024, -1024]) { g.beginPath(); g.arc(x + ox, y, r, 0, 7); g.fill(); } } }
    g.fillStyle = 'rgb(60,96,50)'; g.fillRect(0, 200, 1024, 56);
    g.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(' + (Q() < 0.5 ? '190,240,130' : '10,40,14') + ',' + (0.1 + Q() * 0.16) + ')'; g.beginPath(); g.arc(Q() * 1024, 30 + Q() * 226, 2 + Q() * 5, 0, 7); g.fill(); }
  });
  T3.hills = strip(402, (g, Q) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, 256);
    for (let x = 0; x <= 1024; x += 8) { const a = x / 1024 * 6.2832; g.lineTo(x, 150 - 60 * (0.5 + 0.5 * Math.sin(a * 3 + 1)) * (0.5 + 0.5 * Math.sin(a * 7 + 2)) - 22 * Math.sin(a * 13) - 8 * Math.sin(a * 29)); }
    g.lineTo(1024, 256); g.fill();
    g.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(0,0,0,' + (0.03 + Q() * 0.07) + ')'; g.beginPath(); g.arc(Q() * 1024, 60 + Q() * 200, 8 + Q() * 30, 0, 7); g.fill(); }
  });
  T3.isles = strip(403, (g, Q) => {
    for (let k = 0; k < 5; k++) { const cx = 60 + k * 205 + Q() * 60, w = 50 + Q() * 70, h = 26 + Q() * 44; g.fillStyle = k % 2 ? '#e8e8e8' : '#ffffff'; g.beginPath(); g.moveTo(cx - w, 256); g.bezierCurveTo(cx - w * 0.6, 256 - h * 1.3, cx + w * 0.5, 256 - h * 1.5, cx + w, 256); g.fill(); }
  });
  // ---- small alpha sprites
  {
    let c = t3canvas(128), g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); g.lineWidth = 3; g.globalAlpha = 0.5; g.beginPath(); g.arc(64, 64, 36, 0, 7); g.stroke();
    T3.ring = t3tex(c, { repeat: false });
    c = t3canvas(64); g = c.getContext('2d'); let gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    T3.dot = t3tex(c, { repeat: false });
    c = t3canvas(64, 256); g = c.getContext('2d'); gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = 'destination-in'; gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    T3.shaft = t3tex(c, { repeat: false });
    // lily pad
    c = t3canvas(128); g = c.getContext('2d'); g.fillStyle = '#3f9a48'; g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 58, 0.25, 6.03); g.closePath(); g.fill();
    g.strokeStyle = '#2a7434'; g.lineWidth = 5; g.stroke(); g.strokeStyle = 'rgba(190,240,150,.5)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { const a = 0.5 + i * 0.62; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); g.stroke(); }
    T3.pad = t3tex(c, { repeat: false });
    c = t3canvas(64); g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.save(); g.translate(32, 32); g.rotate(i * 0.785); g.fillStyle = i % 2 ? '#ffc0dc' : '#fff0f6'; g.beginPath(); g.ellipse(0, -15, 7, 15, 0, 0, 7); g.fill(); g.restore(); } g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(32, 32, 7, 0, 7); g.fill();
    T3.flower = t3tex(c, { repeat: false });
    // bite mark "!"
    c = t3canvas(64); g = c.getContext('2d'); g.fillStyle = '#ffe23a'; g.strokeStyle = '#7a1a10'; g.lineWidth = 4; g.beginPath(); g.moveTo(32, 4); g.lineTo(60, 32); g.lineTo(32, 60); g.lineTo(4, 32); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#b3261e'; g.fillRect(28, 15, 8, 22); g.fillRect(28, 42, 8, 8);
    T3.bang = t3tex(c, { repeat: false });
    // cast target
    c = t3canvas(128); g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 6; g.setLineDash([26, 14]); g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke(); g.setLineDash([]); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 7, 0, 7); g.fill();
    T3.target = t3tex(c, { repeat: false });
  }
  T3.lure = {};
}
// lure textures reuse the existing 2D lure art (actors.js drawLure)
function t3lure(id) {
  if (T3.lure[id]) return T3.lure[id];
  const c = t3canvas(96), keep = ctx; ctx = c.getContext('2d'); try { drawLure(id, 48, 48, 2.6, 0, 0.3); } finally { ctx = keep; }
  return T3.lure[id] = t3tex(c, { repeat: false });
}
const T3SPR = {};
function t3sprite(id, shiny) {
  const key = shiny && IMG[id + '_s'] ? id + '_s' : id; if (T3SPR[key]) return T3SPR[key];
  const img = IMG[key]; if (!img) return null;
  const t = new THREE.Texture(img); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return T3SPR[key] = t;
}
