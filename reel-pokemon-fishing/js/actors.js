'use strict';
// ================================================================ actors drawn in code: rod, angler, lures

// rod: returns { x, y, pts } (tip). o.lit -> colours follow the time-of-day light; o.spin -> reel crank angle
function drawRod(x, y, ang, bend, rod, len = 110, o = {}) {
  const L = c => (o.lit ? lit(c) : c);
  const n = 18; let px = x, py = y, a = ang; const seg = len / n;
  const pts = [[px, py]], angs = [a];
  for (let i = 0; i < n; i++) { a += bend * Math.pow(i / n, 1.6) * 0.15; px += Math.cos(a) * seg; py += Math.sin(a) * seg; pts.push([px, py]); angs.push(a); }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const rainbow = rod.id === 'rainbow', now = performance.now();
  // blank
  for (let i = 4; i < n; i++) {
    const w = lerp(4.6, 1.3, (i - 4) / (n - 4));
    ctx.strokeStyle = rainbow ? 'hsl(' + ((i * 26 + now / 9) % 360) + ',85%,55%)' : L(rod.c1);
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
    const nx = Math.sin(angs[i]) * w * 0.28, ny = -Math.cos(angs[i]) * w * 0.28;
    ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = w * 0.3; ctx.beginPath(); ctx.moveTo(pts[i][0] + nx, pts[i][1] + ny); ctx.lineTo(pts[i + 1][0] + nx, pts[i + 1][1] + ny); ctx.stroke();
  }
  // wraps + guides
  for (let i = 6; i < n; i += 3) {
    const p = pts[i], q = angs[i], w = lerp(5.5, 2, i / n);
    ctx.strokeStyle = L(rod.c2); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(p[0] - Math.cos(q) * 1.2, p[1] - Math.sin(q) * 1.2); ctx.lineTo(p[0] + Math.cos(q) * 1.2, p[1] + Math.sin(q) * 1.2); ctx.stroke();
    ctx.strokeStyle = L('#dfe6ee'); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p[0] + Math.sin(q) * w * 0.9, p[1] - Math.cos(q) * w * 0.9, 1.6, 0, 7); ctx.stroke();
  }
  // cork handle + butt
  ctx.strokeStyle = L('#2a1d12'); ctx.lineWidth = 7.5; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke();
  ctx.strokeStyle = L('#c9a26b'); ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[3][0], pts[3][1]); ctx.lineTo(pts[4][0], pts[4][1]); ctx.stroke();
  ctx.fillStyle = L('#8a6a40'); for (let i = 0; i < 9; i++) { const t = i / 9, qx = lerp(pts[1][0], pts[4][0], t), qy = lerp(pts[1][1], pts[4][1], t); ctx.fillRect(qx + ((i * 7) % 3) - 1, qy + ((i * 5) % 3) - 1.5, 1, 1); }
  ctx.strokeStyle = L('#e9d0a0'); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(pts[1][0] + Math.sin(angs[1]) * 2, pts[1][1] - Math.cos(angs[1]) * 2); ctx.lineTo(pts[4][0] + Math.sin(angs[1]) * 2, pts[4][1] - Math.cos(angs[1]) * 2); ctx.stroke();
  // reel (hangs below the rod)
  const r0 = pts[2], rx = r0[0] - Math.sin(angs[2]) * 8, ry = r0[1] + Math.cos(angs[2]) * 8;
  ctx.strokeStyle = L('#7d8894'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(rx, ry); ctx.stroke();
  const rg = ctx.createRadialGradient(rx - 2, ry - 2, 0.5, rx, ry, 7.5); rg.addColorStop(0, L('#ffffff')); rg.addColorStop(0.4, L('#c4ccd6')); rg.addColorStop(1, L('#4a5562'));
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(rx, ry, 7, 0, 7); ctx.fill(); ctx.strokeStyle = L('#2b3440'); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = L(rod.c2); ctx.beginPath(); ctx.arc(rx, ry, 2.6, 0, 7); ctx.fill();
  const sp = o.spin || 0, cx = rx + Math.cos(sp) * 7, cy = ry + Math.sin(sp) * 7;
  ctx.strokeStyle = L('#3a4450'); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(cx, cy); ctx.stroke(); ctx.fillStyle = L('#1d232b'); ctx.beginPath(); ctx.arc(cx, cy, 2, 0, 7); ctx.fill();
  if (rod.id === 'master' || rainbow) {
    const t = now / 300; const gl = ctx.createRadialGradient(px, py, 0, px, py, 10); gl.addColorStop(0, rod.c2); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.35 * Math.sin(t); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, 10, 0, 7); ctx.fill();
  }
  ctx.restore();
  return { x: px, y: py, pts, angs };
}

// angler body (feet at x,y). t = time for breathing. o.lit applies the time-of-day light
function drawAnglerBody(x, y, t, o = {}) {
  const L = c => (o.lit ? lit(c) : c), b = Math.sin(t * 2) * 0.6;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y, 17, 3.5, 0, 0, 7); ctx.fill();
  const jean = ctx.createLinearGradient(x - 9, 0, x + 9, 0); jean.addColorStop(0, L('#3d5a8f')); jean.addColorStop(1, L('#22355c'));
  ctx.fillStyle = jean; rrect(x - 9, y - 30, 8, 27, 3); ctx.fill(); rrect(x + 1, y - 30, 8, 27, 3); ctx.fill();
  ctx.fillStyle = L('#2b1b10'); rrect(x - 11, y - 7, 11, 7, 2.5); ctx.fill(); rrect(x, y - 7, 12, 7, 2.5); ctx.fill(); ctx.fillStyle = L('#140c06'); ctx.fillRect(x - 11, y - 1.5, 23, 1.5);
  ctx.translate(0, b);
  ctx.fillStyle = L('#d8433c'); rrect(x - 11, y - 58, 22, 30, 7); ctx.fill();
  const vest = ctx.createLinearGradient(x - 12, 0, x + 12, 0); vest.addColorStop(0, L('#7f8f48')); vest.addColorStop(1, L('#55622c'));
  ctx.fillStyle = vest; rrect(x - 12, y - 56, 24, 27, 6); ctx.fill();
  ctx.fillStyle = L('#d8433c'); ctx.fillRect(x - 2.5, y - 56, 5, 26);
  ctx.fillStyle = L('#46511f'); ctx.fillRect(x - 10, y - 46, 6, 6); ctx.fillRect(x + 4, y - 46, 6, 6); ctx.fillRect(x - 10, y - 37, 6, 5); ctx.fillRect(x + 4, y - 37, 6, 5);
  ctx.fillStyle = L('#3a2a1a'); ctx.fillRect(x - 12, y - 31, 24, 3); ctx.fillStyle = L('#c9a24a'); ctx.fillRect(x - 2, y - 31, 4, 3);
  ctx.fillStyle = L('#e9b88f'); ctx.fillRect(x - 3, y - 62, 6, 5);
  const sk = ctx.createRadialGradient(x - 2, y - 70, 1, x, y - 67, 11); sk.addColorStop(0, L('#ffdcbd')); sk.addColorStop(1, L('#d9a27a'));
  ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(x + 1, y - 67, 8.5, 9.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = L('#5a3a22'); ctx.beginPath(); ctx.arc(x - 5, y - 69, 4.5, 0, 7); ctx.fill();
  ctx.fillStyle = L('#d39a74'); ctx.beginPath(); ctx.arc(x - 4, y - 66, 2.2, 0, 7); ctx.fill();
  ctx.fillStyle = L('#1d1d1d'); ctx.fillRect(x + 5, y - 69, 2, 2.6); ctx.fillStyle = L('#5a3a22'); ctx.fillRect(x + 4, y - 72.5, 4.5, 1.2);
  ctx.fillStyle = L('#c98a66'); ctx.beginPath(); ctx.arc(x + 9.4, y - 66, 1.6, 0, 7); ctx.fill(); ctx.strokeStyle = L('#8a4a3a'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 5, y - 62.5); ctx.lineTo(x + 8, y - 63); ctx.stroke();
  const hg = ctx.createLinearGradient(0, y - 84, 0, y - 72); hg.addColorStop(0, L('#e2cc92')); hg.addColorStop(1, L('#b0965e'));
  ctx.fillStyle = hg; rrect(x - 8, y - 84, 18, 12, 5); ctx.fill();
  ctx.fillStyle = L('#a08550'); ctx.beginPath(); ctx.ellipse(x + 1, y - 73, 14, 3.4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = L('#6b4a2a'); ctx.fillRect(x - 8, y - 77, 18, 2.6); ctx.fillStyle = L('#e04646'); ctx.fillRect(x + 6, y - 80, 3, 3);
  ctx.restore();
}
function drawAnglerArms(x, y, h1, h2, t, o = {}) {
  const L = c => (o.lit ? lit(c) : c), b = Math.sin(t * 2) * 0.6;
  const arm = (sx, sy, hx, hy, col, w) => {
    const mx = (sx + hx) / 2, my = (sy + hy) / 2 + 7;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, hx, hy); ctx.stroke();
    ctx.fillStyle = L('#f0c29a'); ctx.beginPath(); ctx.arc(hx, hy, 3.3, 0, 7); ctx.fill();
  };
  ctx.save();
  arm(x - 4, y - 53 + b, h1[0], h1[1], L('#a8322c'), 5.5);
  arm(x + 5, y - 53 + b, h2[0], h2[1], L('#d8433c'), 6);
  ctx.restore();
}
// little specular glint on a lure
function lureGlint(x, y, t) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 + 0.45 * Math.sin(t * 7); ctx.fillStyle = '#fff'; ctx.fillRect(x - 0.6, y - 5, 1.2, 10); ctx.fillRect(x - 5, y - 0.6, 10, 1.2); ctx.restore(); }

// ---------------------------------------------------------------- drawing: lure
function drawLure(id, x, y, s = 1, rot = 0, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.lineWidth = 1.4; ctx.strokeStyle = '#222';
  switch (id) {
    case 'worm': {
      ctx.strokeStyle = '#d86a8a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const px = -9 + i * 1.8, py = Math.sin(i * 0.9 + t * 8) * 2.6; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
      ctx.strokeStyle = '#f7a3b8'; ctx.lineWidth = 1.4; ctx.stroke(); break;
    }
    case 'spinner':
      ctx.fillStyle = '#e8f0f8'; ctx.beginPath(); ctx.ellipse(-4, -3, 7, 3.2, -0.5 + Math.sin(t * 20) * 0.4, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e0452f'; ctx.beginPath(); ctx.ellipse(5, 1, 5, 2.6, 0, 0, 7); ctx.fill(); ctx.stroke(); break;
    case 'popper':
      ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(4, -5); ctx.lineTo(10, 2); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d33'; ctx.fillRect(-9, -3, 4, 7); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -1, 1.4, 0, 7); ctx.fill(); break;
    case 'crank':
      ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 5.5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.fillRect(7, 1, 7, 2.6); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -1.5, 1.5, 0, 7); ctx.fill(); break;
    case 'jig':
      ctx.fillStyle = '#6a7380'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#f08a24'; ctx.lineWidth = 2.2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 1.5, 4); ctx.lineTo(i * 3, 12 + Math.sin(t * 10 + i) * 1.2); ctx.stroke(); } break;
    case 'spoon':
      ctx.fillStyle = '#f4c542'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.5, Math.sin(t * 9) * 0.3, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-2, -1.4, 4, 1.2, 0, 0, 7); ctx.fill(); break;
    case 'shrimp':
      ctx.strokeStyle = '#ff9157'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 2, 7, Math.PI * 1.1, Math.PI * 2.05); ctx.stroke();
      ctx.strokeStyle = '#ffd1b0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 2, 7, Math.PI * 1.2, Math.PI * 1.9); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(6, -2, 1.1, 0, 7); ctx.fill(); break;
    case 'glow': {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14); g.addColorStop(0, 'rgba(160,255,160,.9)'); g.addColorStop(1, 'rgba(160,255,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#b6ff8a'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, 7); ctx.fill(); ctx.stroke(); break;
    }
    case 'rainbow': {
      const g = ctx.createLinearGradient(-9, 0, 9, 0);
      ['#ff4d4d', '#ffb84d', '#fff04d', '#5cff6a', '#4db8ff', '#c14dff'].forEach((c, i) => g.addColorStop(i / 5, c));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 10, 4.8, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8); ctx.fillRect(-1, -9, 2, 5); ctx.fillRect(-3, -7, 6, 1.6); break;
    }
  }
  ctx.restore();
}

