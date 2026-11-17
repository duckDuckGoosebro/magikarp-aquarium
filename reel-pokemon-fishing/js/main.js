'use strict';
// ---------------------------------------------------------------- boot + main loop
let loadProg = 0;
makeSurfaces();
async function boot() {
  loadSave();
  const ids = Object.keys(SPECIES); let done = 0;
  const jobs = [];
  for (const id of ids) {
    jobs.push(loadImg('sprites/' + id + '.png').then(i => { IMG[id] = i; done++; loadProg = done / (ids.length * 1.3); }));
    if (SPECIES[id].shiny) jobs.push(loadImg('sprites/' + id + '_s.png').then(i => { IMG[id + '_s'] = i; }));
  }
  await Promise.all(jobs);
  // drop species whose sprite failed to load so nothing is ever missing
  for (const id of ids) if (!IMG[id]) { delete SPECIES[id]; for (const k in POOLS) POOLS[k] = POOLS[k].filter(p => p[0] !== id); }
  try { await Promise.race([Promise.all([document.fonts.load('16px "Press Start 2P"'), document.fonts.load('20px VT323')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  buildTextures(); buildMap();
  scene = 'title'; Snd.mode = 'title';
  try { if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js'); } catch (e) { }
}

let lastTs = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
  try {
    if (!window.DEBUG_FREEZE) update(dt);
    render();
  } catch (e) { console.error(e); }
  uiEndFrame();
  requestAnimationFrame(loop);
}
function update(dt) {
  switch (scene) {
    case 'title': updateTitle(dt); break;
    case 'help': updateHelp(); break;
    case 'options': updateOptions(); break;
    case 'map': updateMap(dt); break;
    case 'shop': updateShop(); break;
    case 'journal': updateJournal(); break;
    case 'spot': updateSpot(dt); break;
  }
}
function render() {
  const W = SURF.world.g, U = SURF.ui.g;
  W.setTransform(1, 0, 0, 1, 0, 0); W.globalAlpha = 1; W.fillStyle = '#000'; W.fillRect(0, 0, LW, LH);
  U.setTransform(1, 0, 0, 1, 0, 0); U.globalAlpha = 1; U.clearRect(0, 0, VW, VH);
  toWorld();
  switch (scene) {
    case 'load': begin(); UI.hits = []; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH); toUI(); begin(); txt('REEL POKEMON FISHING', VW / 2, 220, 26, '#ffe36e', 'center'); ctx.fillStyle = '#05060f'; ctx.fillRect(300, 280, 360, 22); ctx.fillStyle = '#7dff9a'; ctx.fillRect(303, 283, Math.max(8, 354 * loadProg), 16); ctx.strokeStyle = '#d8d8e0'; ctx.strokeRect(300, 280, 360, 22); txt('NOW LOADING...', VW / 2, 330, 18, '#fff', 'center'); break;
    case 'title': drawTitle(); break;
    case 'help': drawHelp(); break;
    case 'options': drawOptions(); break;
    case 'map': drawMap(); break;
    case 'shop': drawShop(); break;
    case 'journal': drawJournal(); break;
    case 'spot': if (F) drawSpot(); break;
  }
  // compose: chunky PS1 world + UI, nearest-neighbour up to the 4K canvas
  ctx = MAINCTX; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1;
  ctx.drawImage(SURF.world.c, 0, 0, cv.width, cv.height); ctx.drawImage(SURF.ui.c, 0, 0, cv.width, cv.height);
}
boot();
requestAnimationFrame(loop);
