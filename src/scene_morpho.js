import * as THREE from '../vendor/three.module.js';
import { C, toon, addLights, fitFov } from './palette.js';
import { rng, clamp, easeIn } from './util.js';

const PI2 = Math.PI * 2;

// Ala dibujada en canvas (u hacia afuera desde el cuerpo, v de arriba a abajo): azul eléctrico arriba, café con ocelos abajo
function wingTex(top) {
  const W = 256, H = 320, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const P = (u, v) => [u * W, v * H], B = (a, b, d) => x.bezierCurveTo(...P(...a), ...P(...b), ...P(...d));
  x.beginPath(); x.moveTo(...P(0, .42));
  B([.1, .18], [.5, .02], [.92, .04]); B([1, .12], [.98, .34], [.88, .46]); B([1, .6], [.95, .82], [.7, .97]); B([.45, 1.03], [.2, .9], [.1, .7]); B([.05, .6], [0, .55], [0, .42]);
  x.closePath(); x.save(); x.clip();
  const g = x.createRadialGradient(W * .05, H * .5, 5, W * .05, H * .5, W * 1.05);
  (top ? [[0, '#a6ecff'], [.35, '#3d8bff'], [.75, '#2146c8'], [1, '#101a60']] : [[0, '#8a6048'], [.6, '#5a3d30'], [1, '#33231f']]).forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const dot = (u, v, r, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(u * W, v * H, r * W, r * W * .9, 0, 0, PI2); x.fill(); };
  if (top) {
    x.fillStyle = 'rgba(200,245,255,.28)'; x.beginPath(); x.moveTo(...P(.1, .5)); x.lineTo(...P(.7, .12)); x.lineTo(...P(.8, .3)); x.lineTo(...P(.2, .75)); x.fill();
    [[.78, .1, .028], [.86, .17, .022], [.7, .07, .018]].forEach(([u, v, r]) => dot(u, v, r, '#fff6ec'));
  } else {
    x.strokeStyle = 'rgba(241,217,168,.5)'; x.lineWidth = 7; x.beginPath(); x.moveTo(...P(.3, .3)); B([.5, .38], [.7, .3], [.95, .4]); x.stroke();
    [[.55, .2, .07], [.74, .34, .06], [.38, .72, .07], [.6, .8, .055], [.78, .64, .05]].forEach(([u, v, r]) => { dot(u, v, r, '#f1d9a8'); dot(u, v, r * .66, '#2a1a18'); dot(u, v, r * .2, '#f1d9a8'); });
  }
  x.restore(); x.strokeStyle = top ? '#0a0a18' : '#2a1a18'; x.lineWidth = 26; x.beginPath(); x.moveTo(...P(0, .42));
  B([.1, .18], [.5, .02], [.92, .04]); B([1, .12], [.98, .34], [.88, .46]); B([1, .6], [.95, .82], [.7, .97]); B([.45, 1.03], [.2, .9], [.1, .7]); B([.05, .6], [0, .55], [0, .42]);
  x.save(); x.clip(); x.stroke(); x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

let M;
function mats() {
  if (M) return M;
  const mk = (top, side, k) => { const t = wingTex(top); return toon(0xffffff, { map: t, alphaTest: .5, side, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: k }); };
  const geo = new THREE.PlaneGeometry(1.3, 1.7); geo.translate(.65, 0, 0);
  return M = { geo, top: mk(true, THREE.FrontSide, .55), under: mk(false, THREE.BackSide, .3), body: toon(0x2a1d24) };
}

// mariposa morpho: cuerpo hacia +Y, alas abriéndose hacia ±X. flap(a): 0 = planas, ~1.2 = alas arriba
export function makeMorphoFly() {
  const m = mats(), g = new THREE.Group();
  const bit = (sx, sy, sz, y) => { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), m.body); b.scale.set(sx, sy, sz); b.position.y = y; g.add(b); };
  bit(.07, .3, .07, .05); bit(.05, .45, .05, -.5); bit(.06, .08, .06, .38);
  const wings = [1, -1].map(s => { const w = new THREE.Group(), k = new THREE.Group(); k.add(new THREE.Mesh(m.geo, m.top), new THREE.Mesh(m.geo, m.under)); k.scale.x = s; w.add(k); g.add(w); return w; });
  return { g, flap(a) { wings[0].rotation.y = -a; wings[1].rotation.y = a; } };
}

// hoja lanceolada con nervio central, base en el origen apuntando a +Y
export function makeLeaf(color, len = 2.4) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
  x.beginPath(); x.moveTo(64, 254); x.bezierCurveTo(0, 190, 4, 70, 64, 2); x.bezierCurveTo(124, 70, 128, 190, 64, 254); x.fillStyle = '#fff'; x.fill();
  x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 3; x.beginPath(); x.moveTo(64, 250); x.lineTo(64, 20); x.stroke();
  for (let i = 0; i < 9; i++) { const y = 230 - i * 24; x.beginPath(); x.moveTo(64, y); x.lineTo(14 + i * 3, y - 40); x.moveTo(64, y); x.lineTo(114 - i * 3, y - 40); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(len * .42, len); geo.translate(0, len / 2, 0);
  return new THREE.Mesh(geo, toon(color, { map: t, alphaTest: .5, side: THREE.DoubleSide }));
}

export function makeMorpho() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1.7, .1, 100);
  scene.fog = new THREE.Fog(C.bg, 10, 30); addLights(scene);
  const R = rng(21);
  const leaves = Array.from({ length: 12 }, (_, i) => {
    const l = makeLeaf(C.salviaOsc, 2.5 + R() * 1.5); scene.add(l);
    return { l, ux: (i % 2 ? 1 : -1) * (.55 + R() * .6), y: -6 + R() * 11, z: -14 + R() * 5, rz: (R() - .5) * 1.2, ph: R() * PI2 };
  });
  const N = 200, pp = new Float32Array(N * 3), base = Array.from({ length: N }, () => [(R() - .5) * 22, R() * 16 - 8, R() * 16 - 8, R() * PI2]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: C.mant, size: 3, sizeAttenuation: false })); dust.frustumCulled = false; scene.add(dust);
  const flies = Array.from({ length: 12 }, (_, i) => { const f = makeMorphoFly(); scene.add(f.g); return { f, i, s: .85 + R() * .5, w1: .18 + R() * .17, w2: .25 + R() * .2, p1: R() * PI2, p2: R() * PI2, fr: 5 + R() * 3, z: -(i % 4) * 1.6 }; });
  let hw = 8, hh = 5;
  const setAspect = a => { fitFov(camera, a, 50, .5); hh = Math.tan(camera.fov * Math.PI / 360) * 11; hw = hh * a; };
  return {
    scene, camera, setAspect,
    update(t) {
      const rise = easeIn((t - 15) / 3.6);
      leaves.forEach(o => {
        o.l.position.set(o.ux * hw * .85, o.y + rise * 6, o.z); o.l.rotation.z = o.rz * (o.ux > 0 ? 1 : -1) + .08 * Math.sin(t * .6 + o.ph) + (o.ux > 0 ? .5 : -.5) * .6;
        o.l.scale.setScalar(1);
      });
      flies.forEach(({ f, i, s, w1, w2, p1, p2, fr, z }) => {
        const x = hw * .8 * Math.sin(w1 * t + p1), y = hh * .65 * Math.sin(w2 * t + p2) + rise * hh * 2.2 * (1 + i * .05);
        f.g.position.set(x, y, z + 1.2 * Math.sin(t * .3 + i)); f.g.scale.setScalar(s);
        f.g.rotation.set(.3 * Math.sin(t * .5 + i), Math.sin(t * .4 + i * 1.3) * (1.2 + (i % 3) * .55), .4 * Math.cos(w1 * t + p1));
        const glide = clamp((.5 + .5 * Math.sin(t * .6 + i * 2)) * 2.2); f.flap(.35 + (.12 + .55 * (1 + Math.sin(t * fr + i)) - .35) * glide);
      });
      const a = dust.geometry.attributes.position;
      base.forEach((b, i) => a.setXYZ(i, b[0] + Math.sin(t * .3 + b[3]) * .4, ((b[1] + t * .3 + 8) % 16) - 8, b[2]));
      a.needsUpdate = true;
      camera.position.set(.5 * Math.sin(t * .22), .25 * Math.sin(t * .31), 11); camera.lookAt(0, 0, 0);
    },
  };
}
