'use strict';
// ---------------------------------------------------------------- canvas, math, text, audio, input, ui
const VW = 960, VH = 540;
const cv = document.getElementById('game');
let ctx = cv.getContext('2d');
const MAINCTX = ctx;
const FONT = '"VT323","Courier New",monospace';
const HFONT = '"Press Start 2P","Courier New",monospace';
let SCALE_K = 1;

function fitCanvas() {
  const w = window.innerWidth, h = window.innerHeight;
  const s = Math.min(w / VW, h / VH);
  cv.style.width = Math.floor(VW * s) + 'px';
  cv.style.height = Math.floor(VH * s) + 'px';
  const k = window.GFX_4K === false ? Math.max(1, Math.min(3, Math.round(s * (window.devicePixelRatio || 1)))) : 4; // 4 = 3840x2160 (4K)
  const changed = k !== SCALE_K; SCALE_K = k; MAINCTX.__k = k;
  cv.width = VW * k; cv.height = VH * k;
  if (changed && window.onScaleChange) window.onScaleChange();
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const smooth = t => t * t * (3 - 2 * t);
function wpick(items, wf) {
  let tot = 0; for (const it of items) tot += wf(it);
  let r = Math.random() * tot;
  for (const it of items) { r -= wf(it); if (r <= 0) return it; }
  return items[items.length - 1];
}
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function begin() { const k = ctx.__k || SCALE_K; ctx.setTransform(k, 0, 0, k, 0, 0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; ctx.filter = 'none'; }

function rrect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fontStr(size, weight) { if (size >= 21) return Math.max(8, Math.round(size * 0.6 / 8) * 8) + 'px ' + HFONT; return Math.round(size * 1.3) + 'px ' + FONT; }
function txt(s, x, y, size = 16, color = '#fff', align = 'left', weight = 'bold', shadow = true) {
  ctx.font = fontStr(size, weight); ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (shadow) { ctx.fillStyle = 'rgba(0,10,25,.55)'; ctx.fillText(s, x, y + Math.max(1.3, size * 0.075)); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
// big title text with outline + gradient fill
function htxt(s, x, y, size, c1, c2, align = 'center', stroke = 'rgba(5,20,45,.9)') {
  ctx.font = fontStr(Math.max(size, 21)); ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'miter';
  ctx.lineWidth = Math.max(3, size * 0.12); ctx.strokeStyle = stroke; ctx.strokeText(s, x, y + size * 0.05);
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillText(s, x, y);
}
function txtw(s, size = 16, weight = 'bold') { ctx.font = fontStr(size, weight); return ctx.measureText(s).width; }
function wrap(s, x, y, w, size, color, lh, align = 'left') {
  ctx.font = fontStr(size, 'bold');
  const words = s.split(' '); let line = '', yy = y;
  for (const wd of words) {
    const t = line ? line + ' ' + wd : wd;
    if (ctx.measureText(t).width > w && line) { txt(line, x, yy, size, color, align, 'bold'); ctx.font = fontStr(size, 'bold'); line = wd; yy += lh; } else line = t;
  }
  if (line) txt(line, x, yy, size, color, align, 'bold');
  return yy;
}
// PS1 RPG-style window: blue gradient, light grey bevelled border, hard drop shadow
function panel(x, y, w, h, o = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x + 4, y + 4, w, h);
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, o.top || '#3c4fb0'); g.addColorStop(1, o.bot || '#0a1046'); ctx.fillStyle = o.fill || g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#0a0a14'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.strokeStyle = o.stroke || '#e6e6f0'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = 'rgba(120,120,160,.9)'; ctx.lineWidth = 1; ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  ctx.restore();
}
function hexA(c, a) { if (c[0] !== '#') return c; const v = hexRGB(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }
const _hexc = {};
function hexRGB(h) { if (_hexc[h]) return _hexc[h]; const n = parseInt(h.slice(1), 16); return _hexc[h] = [n >> 16, (n >> 8) & 255, n & 255]; }
function mixRGB(a, b, t) { return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))]; }
function mix(a, b, t) { return rgb(mixRGB(hexRGB(a), hexRGB(b), t)); }
const rgb = c => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
function money(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
function lenStr(m) { return m < 1 ? Math.round(m * 100) + ' cm' : m.toFixed(2) + ' m'; }
function kgStr(k) { return k < 10 ? k.toFixed(1) + ' kg' : Math.round(k).toLocaleString('en-US') + ' kg'; }

// ---------------------------------------------------------------- images
const IMG = {};
function loadImg(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
const SIL = {};
function silhouette(id, shiny) {
  const key = id + (shiny ? 's' : '');
  if (SIL[key]) return SIL[key];
  const img = IMG[key] || IMG[id]; const S = SPECIES[id];
  const c = document.createElement('canvas'); c.width = S.fw; c.height = S.fh;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, S.fw, S.fh, 0, 0, S.fw, S.fh);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0b1424'; g.fillRect(0, 0, S.fw, S.fh);
  return SIL[key] = c;
}
// draw a species centred on (x,y), its body height scaled to hpx. t = animation seconds.
function drawMon(id, x, y, hpx, flip, t, o = {}) {
  const S = SPECIES[id]; const img = o.shiny && IMG[id + '_s'] ? IMG[id + '_s'] : IMG[id];
  if (!img) return;
  const bh = Math.max(8, S.bb[3] - S.bb[1]); const sc = hpx / bh;
  let fr = 0;
  if (o.frame !== undefined) fr = o.frame;
  else {
    let tot = 0; for (const d of S.d) tot += d; const per = tot / 50; let tt = (t * (o.speed || 1)) % per, acc = 0;
    for (let i = 0; i < S.n; i++) { acc += S.d[i] / 50; if (tt < acc) { fr = i; break; } }
  }
  const cx = (S.bb[0] + S.bb[2]) / 2, cy = (S.bb[1] + S.bb[3]) / 2;
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (flip) ctx.scale(-1, 1);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.sil) ctx.drawImage(silhouette(id, o.shiny), fr * S.fw, 0, S.fw, S.fh, -cx * sc, -cy * sc, S.fw * sc, S.fh * sc);
  else ctx.drawImage(img, fr * S.fw, 0, S.fw, S.fh, -cx * sc, -cy * sc, S.fw * sc, S.fh * sc);
  ctx.restore();
}

// ---------------------------------------------------------------- audio (tiny synth)
const Snd = {
  c: null, on: true, master: null, musicOn: true, step: 0, mode: 'map', timer: null,
  init() {
    if (this.c) { if (this.c.state === 'suspended') this.c.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.c = new AC(); this.master = this.c.createGain(); this.master.gain.value = 0.9; this.master.connect(this.c.destination);
      this.startMusic();
    } catch (e) { }
  },
  beep(f, d = 0.1, type = 'square', v = 0.05, slide = 0, delay = 0) {
    if (!this.c || !this.on) return;
    const t0 = this.c.currentTime + delay, o = this.c.createOscillator(), g = this.c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + d + 0.02);
  },
  noise(d = 0.2, v = 0.05, f0 = 2000, f1 = 400) {
    if (!this.c || !this.on) return;
    const n = Math.floor(this.c.sampleRate * d), b = this.c.createBuffer(1, n, this.c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.c.createBufferSource(); s.buffer = b;
    const fl = this.c.createBiquadFilter(); fl.type = 'lowpass'; const t0 = this.c.currentTime;
    fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(f1, t0 + d);
    const g = this.c.createGain(); g.gain.value = v; s.connect(fl); fl.connect(g); g.connect(this.master); s.start();
  },
  sfx(n) {
    switch (n) {
      case 'click': this.beep(660, .05, 'square', .04); break;
      case 'back': this.beep(330, .08, 'square', .04); break;
      case 'buy': this.beep(660, .08, 'square', .05); this.beep(990, .12, 'square', .05, 0, .08); break;
      case 'no': this.beep(160, .15, 'sawtooth', .05); break;
      case 'cast': this.noise(.35, .08, 3000, 300); break;
      case 'splash': this.noise(.3, .09, 1800, 200); break;
      case 'tap': this.beep(520, .05, 'triangle', .07); break;
      case 'bite': this.beep(880, .08, 'square', .07); this.beep(1320, .14, 'square', .07, 0, .1); break;
      case 'hook': this.beep(500, .1, 'square', .06, 600); break;
      case 'warn': this.beep(220, .08, 'sawtooth', .04); break;
      case 'snap': this.beep(900, .35, 'sawtooth', .07, -800); this.noise(.2, .06, 4000, 500); break;
      case 'jump': this.noise(.25, .07, 2400, 500); break;
      case 'catch': [523, 659, 784, 1047].forEach((f, i) => this.beep(f, .16, 'square', .06, 0, i * .1)); break;
      case 'rare': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.beep(f, .18, 'square', .06, 0, i * .09)); break;
      case 'flee': this.beep(400, .2, 'triangle', .05, -250); break;
      case 'legend': [196, 262, 330, 392, 523].forEach((f, i) => this.beep(f, .5, 'triangle', .06, 0, i * .18)); break;
    }
  },
  startMusic() {
    if (this.timer) return;
    const penta = [0, 2, 4, 7, 9];
    this.timer = setInterval(() => {
      if (!this.c || !this.on || !this.musicOn) return;
      const m = this.mode; this.step++;
      const base = m === 'fish' ? 196 : m === 'tour' ? 261 : m === 'title' ? 220 : 233;
      const patt = m === 'fish' ? [0, 2, 4, 2, 1, 3, 4, 3] : m === 'tour' ? [0, 3, 4, 3, 0, 3, 4, 2] : [0, 1, 2, 4, 2, 1, 3, 2];
      if (m === 'fish' && this.step % 2) return;
      const i = patt[this.step % patt.length];
      const f = base * Math.pow(2, penta[i % 5] / 12 + (i >= 5 ? 1 : 0));
      this.beep(f, 0.35, 'triangle', m === 'fish' ? .018 : .025);
      if (this.step % 8 === 0) this.beep(base / 2, 0.8, 'sine', .03);
    }, 260);
  },
};

// ---------------------------------------------------------------- input + ui hit regions
const keys = {}, keyEdge = {};
const UI = { hits: [], ptrs: new Map(), pressed: {}, clicked: {}, held: {}, mx: -1, my: -1, lastMove: 0, wheel: 0 };
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH };
}
function hitAt(x, y) {
  for (let i = UI.hits.length - 1; i >= 0; i--) { const h = UI.hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; }
  return null;
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); Snd.init();
  const p = toLogical(e); UI.mx = p.x; UI.my = p.y;
  const h = hitAt(p.x, p.y);
  UI.ptrs.set(e.pointerId, { id: h ? h.id : null, x: p.x, y: p.y, hold: h && h.hold });
  if (h) { UI.pressed[h.id] = true; }
  else { UI.pressed['@canvas'] = { x: p.x, y: p.y }; }
  try { cv.setPointerCapture(e.pointerId); } catch (_) { }
});
cv.addEventListener('pointermove', e => {
  const p = toLogical(e); UI.mx = p.x; UI.my = p.y; UI.lastMove = performance.now();
  const q = UI.ptrs.get(e.pointerId); if (q) { q.x = p.x; q.y = p.y; }
});
function pEnd(e) {
  const q = UI.ptrs.get(e.pointerId); if (!q) return;
  const p = toLogical(e); const h = hitAt(p.x, p.y);
  if (q.id && h && h.id === q.id) UI.clicked[q.id] = true;
  if (!q.id) UI.clicked['@canvas'] = { x: p.x, y: p.y };
  UI.ptrs.delete(e.pointerId);
}
cv.addEventListener('pointerup', pEnd);
cv.addEventListener('pointercancel', e => UI.ptrs.delete(e.pointerId));
cv.addEventListener('wheel', e => { UI.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  Snd.init();
  if (!e.repeat) keyEdge[e.code] = true;
  keys[e.code] = true;
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; UI.ptrs.clear(); });

function uiHeld(id) { for (const q of UI.ptrs.values()) if (q.id === id) return true; return false; }
function uiEndFrame() { UI.pressed = {}; UI.clicked = {}; for (const k in keyEdge) delete keyEdge[k]; UI.wheel = 0; }
function uiBegin() { UI.hits = []; }

// button: PS1 menu box (bevelled), registers a hit region. returns hover state
function button(id, x, y, w, h, label, o = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const hv = !o.disabled && UI.mx >= x && UI.mx <= x + w && UI.my >= y && UI.my <= y + h;
  const down = uiHeld(id), base = o.color || '#2f4fb0', dy = down ? 2 : 0;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x + 3, y + 4, w, h);
  const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + h);
  if (o.disabled) { g.addColorStop(0, '#585868'); g.addColorStop(1, '#2a2a36'); }
  else { g.addColorStop(0, shade(base, hv ? 55 : 30)); g.addColorStop(1, shade(base, -45)); }
  ctx.fillStyle = g; ctx.fillRect(x, y + dy, w, h);
  ctx.fillStyle = 'rgba(255,255,255,' + (o.disabled ? 0.15 : 0.55) + ')'; ctx.fillRect(x, y + dy, w, 2); ctx.fillRect(x, y + dy, 2, h);
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x, y + dy + h - 2, w, 2); ctx.fillRect(x + w - 2, y + dy, 2, h);
  ctx.strokeStyle = '#0a0a14'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 0.5, y + dy - 0.5, w + 1, h + 1);
  if (label) txt(label, x + w / 2, y + h / 2 + dy, o.size || Math.min(20, h * 0.42), o.disabled ? '#9a9aaa' : (o.tc || '#fff'), 'center');
  if (o.draw) o.draw(x, y + dy, w, h);
  if (hv && !o.nocursor) { const cx = x - 4, cy = y + h / 2 + dy; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 12, cy - 6); ctx.lineTo(cx, cy); ctx.lineTo(cx - 12, cy + 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  if (!o.disabled) UI.hits.push({ id, x, y, w, h, hold: !!o.hold });
  return hv;
}
// PlayStation-controller style round button. o.sym: 'x' | 'o' | 'tri' | 'sq' | 'l' | 'r' | 'u' | 'd' (d-pad arrows)
function roundButton(id, cx, cy, r, label, o = {}) {
  const hv = !o.disabled && Math.hypot(UI.mx - cx, UI.my - cy) <= r;
  const down = uiHeld(id), dy = down ? 2 : 0;
  ctx.save();
  if (o.disabled) ctx.globalAlpha = 0.45;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(cx + 2, cy + 4, r, 0, 7); ctx.fill();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r); g.addColorStop(0, hv ? '#6a6a78' : '#4a4a56'); g.addColorStop(1, '#16161c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy + dy, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy + dy, r - 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  const sym = o.sym, s = r * 0.42, y = cy + dy - (label ? r * 0.16 : 0);
  ctx.lineWidth = Math.max(2.5, r * 0.09); ctx.lineCap = 'square';
  const col = { x: '#7fa8ff', o: '#ff6a6a', tri: '#4fe0a0', sq: '#ff9ad9' }[sym] || '#d8d8e0'; ctx.strokeStyle = col; ctx.fillStyle = col;
  if (sym === 'x') { ctx.beginPath(); ctx.moveTo(cx - s, y - s); ctx.lineTo(cx + s, y + s); ctx.moveTo(cx + s, y - s); ctx.lineTo(cx - s, y + s); ctx.stroke(); }
  else if (sym === 'o') { ctx.beginPath(); ctx.arc(cx, y, s, 0, 7); ctx.stroke(); }
  else if (sym === 'tri') { ctx.beginPath(); ctx.moveTo(cx, y - s); ctx.lineTo(cx + s, y + s * 0.8); ctx.lineTo(cx - s, y + s * 0.8); ctx.closePath(); ctx.stroke(); }
  else if (sym === 'sq') { ctx.strokeRect(cx - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6); }
  else if (sym) { const a = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 }[sym]; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * s, y + Math.sin(a) * s); ctx.lineTo(cx + Math.cos(a + 2.3) * s, y + Math.sin(a + 2.3) * s); ctx.lineTo(cx + Math.cos(a - 2.3) * s, y + Math.sin(a - 2.3) * s); ctx.closePath(); ctx.fill(); }
  if (label) txt(label, cx, cy + dy + (sym ? r * 0.55 : 0), o.size || 14, '#fff', 'center');
  if (o.draw) o.draw(cx, cy + dy, r);
  ctx.restore();
  if (!o.disabled) UI.hits.push({ id, x: cx - r, y: cy - r, w: r * 2, h: r * 2, hold: !!o.hold });
  return hv;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  r = clamp(r + amt, 0, 255); g = clamp(g + amt, 0, 255); b = clamp(b + amt, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
// invisible hit region (for tapping the scene)
function region(id, x, y, w, h, hold) { UI.hits.push({ id, x, y, w, h, hold: !!hold }); }
