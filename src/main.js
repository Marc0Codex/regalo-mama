import { Ascii, GL, G_SCRAMBLE, G_SCRAMBLE_N } from './ascii.js';
import { makeMorpho } from './scene_morpho.js';
import { makeBirds } from './scene_birds.js';
import { makeFlowers, FL } from './scene_flowers.js';
import { startAudio, LOOP, BAR, TOTAL } from './audio.js';
import { hash, clamp, ease } from './util.js';

const q = new URLSearchParams(location.search), seek = q.has('t') ? +q.get('t') : null;
const ascii = new Ascii(document.getElementById('c'));
const ocean = makeMorpho(), chess = makeBirds(), flowers = makeFlowers(), scenes = [ocean, chess, flowers];
const fit = () => { ascii.resize(); scenes.forEach(s => s.setAspect(ascii.aspect)); mask = null; };
let mask = null; addEventListener('resize', fit); fit();

const NAME = 'Mamá', T_NAME = 3 * LOOP, T_CREDIT = 3 * LOOP + 6 * BAR;
const T_WIPE = LOOP - BAR, T_RAD0 = 2 * LOOP - 1.0, T_RAD1 = 2 * LOOP + .7;

// máscara de letras (alfa por celda) dibujada con serif itálica del sistema
function nameMask() {
  const { cols, rows, cw, ch } = ascii, k = 4, c = document.createElement('canvas'); c.width = cols * k; c.height = rows * k;
  const x = c.getContext('2d'), ar = cw / ch, port = cols * cw < rows * ch;
  let fs = 100; x.font = `italic 700 ${fs}px Georgia,"Times New Roman",serif`;
  fs *= (c.width * (port ? .62 : .42)) / x.measureText(NAME).width;
  x.font = `italic 700 ${fs}px Georgia,"Times New Roman",serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.setTransform(1, 0, 0, ar, 0, 0); x.fillStyle = '#fff';
  x.fillText(NAME, c.width / 2, (c.height * (port ? .2 : .2)) / ar);
  const d = x.getImageData(0, 0, c.width, c.height).data, m = new Float32Array(cols * rows); let minx = cols, maxx = 0;
  for (let y = 0; y < rows; y++) for (let xx = 0; xx < cols; xx++) {
    let s = 0; for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += d[(((y * k + j) * c.width) + xx * k + i) * 4 + 3];
    const a = s / (255 * k * k); m[y * cols + xx] = a; if (a > .3) { minx = Math.min(minx, xx); maxx = Math.max(maxx, xx); }
  }
  return { m, minx, maxx };
}

// pétalos que caen detrás del ramo
const petals = Array.from({ length: 46 }, (_, i) => ({ x: hash(i, 1), y: hash(i, 2), s: .02 + hash(i, 3) * .03, p: hash(i, 4) * 6.28, c: i % 3 }));
const PCOL = [[.95, .65, .76], [.72, .64, .89], [1, .96, .92]];

function frame(t) {
  const { cols, rows } = ascii, cx = cols / 2, cy = rows / 2;
  let fade = 1;
  const need = [];
  if (t < T_WIPE) { ocean.update(t); ascii.sample(ocean.scene, ocean.camera, 0); ascii.compose(0, null); }
  else if (t < LOOP) {
    ocean.update(t); chess.update(t); ascii.sample(ocean.scene, ocean.camera, 0); ascii.sample(chess.scene, chess.camera, 1);
    const u = (t - T_WIPE) / BAR * 1.06; ascii.compose(0, 1, (x, y) => ((rows - 1 - y) / rows * .75 + hash(x, y) * .25) < u);
  } else if (t < T_RAD0) { chess.update(t); ascii.sample(chess.scene, chess.camera, 0); ascii.compose(0, null); }
  else if (t < T_RAD1) {
    chess.update(t); flowers.update(t); ascii.sample(chess.scene, chess.camera, 0); ascii.sample(flowers.scene, flowers.camera, 1);
    const u = (t - T_RAD0) / (T_RAD1 - T_RAD0) * 1.08, asp = ascii.cw / ascii.ch;
    ascii.compose(0, 1, (x, y) => (Math.hypot((x - cx) * asp, y - cy) / Math.hypot(cx * asp, cy) * .85 + hash(x, y) * .15) < u);
  } else { flowers.update(t); ascii.sample(flowers.scene, flowers.camera, 0); ascii.compose(0, null); }

  if (t >= FL.start - .5) { // fondo de la escena de flores: letras y pétalos
    const lt = t - FL.start;
    if (t >= T_NAME - 1 && !mask) mask = nameMask();
    for (const p of petals) {
      const yy = ((p.y + lt * p.s * .6) % 1), xx = p.x + Math.sin(lt * .6 + p.p) * .03, i = Math.floor(yy * rows) * cols + Math.floor(clamp(xx) * (cols - 1));
      const col = PCOL[p.c]; ascii.put(i, p.c === 2 ? 1 : 6, col[0] * .8, col[1] * .8, col[2] * .8);
    }
    if (mask && t >= T_NAME) {
      const prog = (t - T_NAME) / (4 * BAR), edge = mask.minx + (mask.maxx - mask.minx + 8) * ease(prog);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const a = mask.m[y * cols + x]; if (a < .12 || x > edge) continue;
        const i = y * cols + x;
        if (edge - x < 5 && prog < 1) { ascii.put(i, G_SCRAMBLE + Math.floor(hash(x + Math.floor(t * 12), y) * G_SCRAMBLE_N), .72, .64, .89); continue; }
        const g = 1 + Math.floor(clamp(a) * 10.5), core = a > .7;
        ascii.put(i, g, core ? 1 : .73, core ? .96 : .64, core ? .92 : .89);
      }
    }
  }
  ascii.draw(fade);
  const cr = document.getElementById('cr'); cr.style.opacity = clamp((t - T_CREDIT) / 3) * .85;
}

let clock = null, last = 0;
const loop = now => {
  requestAnimationFrame(loop);
  if (!clock || now - last < 30) return; last = now;
  frame(clock());
};
requestAnimationFrame(loop);

const go = document.getElementById('go');
async function begin() {
  go.classList.add('off');
  document.documentElement.requestFullscreen?.().catch(() => {}); navigator.wakeLock?.request('screen').catch(() => {});
  const a = await startAudio(); clock = () => a.now();
}
document.getElementById('b').onclick = begin;
if (seek != null) { go.classList.add('off'); const s0 = performance.now(); clock = q.has('pause') ? () => seek : () => seek + (performance.now() - s0) / 1000; }
