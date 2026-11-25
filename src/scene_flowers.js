import * as THREE from '../vendor/three.module.js';
import { C, toon, addLights, shadows, fitFov } from './palette.js';
import { clamp, easeOutBack, rng } from './util.js';
import { LOOP } from './audio.js';
import { makeMorphoFly } from './scene_morpho.js';

const PI2 = Math.PI * 2, Y = new THREE.Vector3(0, 1, 0);
export const FL = { start: 2 * LOOP + .3, spin: PI2 / LOOP };

const petalGeo = (sx, sy, sz, off) => { const g = new THREE.SphereGeometry(1, 8, 6); g.scale(sx, sy, sz); g.translate(0, 0, off); return g; };
const GEO = {
  lily: petalGeo(.17, .035, .55, .5), tulip: petalGeo(.2, .05, .62, .55), daisy: petalGeo(.035, .01, .14, .13), leaf: petalGeo(.14, .02, .5, .45),
  dot: new THREE.SphereGeometry(1, 8, 6), stem: new THREE.CylinderGeometry(.045, .045, 1, 5),
};

// rosa: capas de copa con borde ondulado, cada una girada respecto a la anterior
function rose(color, R) {
  const g = new THREE.Group(), c = new THREE.Color(color);
  for (let l = 0; l < 5; l++) {
    const rb = .22 + .13 * l, rt = rb * (.72 + .13 * l), h = .56 - .05 * l;
    const geo = new THREE.LatheGeometry([[0, 0], [rb * .6, .03], [rb, h * .35], [rb * 1.05, h * .7], [rt, h]].map(([r, y]) => new THREE.Vector2(r, y)), 22);
    const pa = geo.attributes.position, ph = R() * PI2;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i), y = pa.getY(i), k = 1 + .16 * (y / h) * Math.sin(5 * Math.atan2(z, x) + ph);
      pa.setXYZ(i, x * k, y + .05 * (y / h) * Math.sin(3 * Math.atan2(z, x) + ph), z * k);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, toon(c.clone().multiplyScalar(.74 + .07 * l), { side: THREE.DoubleSide }));
    m.position.y = .03 * l; m.rotation.y = l * .7; g.add(m);
  }
  const b = new THREE.Mesh(GEO.dot, toon(c.clone().multiplyScalar(.7))); b.scale.set(.15, .2, .15); b.position.y = .22; g.add(b);
  return g;
}

function petals(geo, n, color, tilt, radius, rollOff = 0, tilt2 = null) {
  const g = new THREE.Group(), mat = toon(color, { side: THREE.DoubleSide });
  for (let i = 0; i < n; i++) {
    const o = new THREE.Group(); o.rotation.y = i / n * PI2 + rollOff; o.position.set(Math.sin(o.rotation.y) * radius, 0, Math.cos(o.rotation.y) * radius);
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -(tilt2 && i % 2 ? tilt2 : tilt); o.add(m); g.add(o);
  }
  return g;
}

function lily(R) {
  const g = new THREE.Group();
  g.add(petals(GEO.lily, 3, C.crema, .5, 0), petals(GEO.lily, 3, 0xF1E6F4, .85, 0, Math.PI / 3));
  const dot = (x, y, z, s, c) => { const m = new THREE.Mesh(GEO.dot, toon(c)); m.scale.setScalar(s); m.position.set(x, y, z); g.add(m); };
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI2; dot(Math.cos(a) * .22, .26, Math.sin(a) * .22, .06, C.mant); dot(Math.cos(a) * .11, .12, Math.sin(a) * .11, .035, C.mant); }
  dot(0, .08, 0, .1, C.mant);
  return g;
}
const tulip = color => { const g = new THREE.Group(); g.add(petals(GEO.tulip, 6, color, 1.2, .1)); return g; };
function daisy() {
  const g = new THREE.Group(); g.add(petals(GEO.daisy, 12, C.crema, .1, .06));
  const m = new THREE.Mesh(GEO.dot, toon(C.mant)); m.scale.set(.07, .04, .07); m.position.y = .02; g.add(m); return g;
}
const leaf = () => { const m = new THREE.Mesh(GEO.leaf, toon(C.salvia, { side: THREE.DoubleSide })); m.rotation.x = -.35; const g = new THREE.Group(); g.add(m); return g; };

export function makeFlowers() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1.7, .1, 100); addLights(scene, 6, [3, 10, 7]);
  const R = rng(5), root = new THREE.Group(); scene.add(root);
  // florero + lazo + plato
  const vaseMat = toon(C.lila, { side: THREE.DoubleSide });
  const vase = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.75, 0], [.95, .2], [1.15, .9], [1.1, 1.5], [.7, 2.2], [.5, 2.5], [.56, 2.72], [.7, 2.8], [.6, 2.82], [.46, 2.6]].map(([r, y]) => new THREE.Vector2(r, y)), 36), vaseMat);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, .08, 36), toon(C.crema)); plate.position.y = -.04;
  const bowG = new THREE.Group(), ribbon = toon(C.rosa, { side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .1, 8, 30), ribbon); ring.rotation.x = Math.PI / 2; bowG.add(ring);
  [-1, 1].forEach(s => { const lp = new THREE.Mesh(new THREE.TorusGeometry(.24, .07, 8, 16), ribbon); lp.position.set(s * .28, 0, .62); lp.rotation.y = s * .5; bowG.add(lp);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(.16, .75, .03), ribbon); tl.position.set(s * .16, -.45, .66); tl.rotation.z = s * .2; bowG.add(tl); });
  const knot = new THREE.Mesh(GEO.dot, ribbon); knot.scale.setScalar(.14); knot.position.set(0, 0, .64); bowG.add(knot);
  bowG.position.y = 2.18; bowG.scale.set(1, 1, 1);
  vase.scale.y = .62; bowG.position.y = 1.38; const vaseG = new THREE.Group(); vaseG.add(vase, plate, bowG); root.add(vaseG);

  // ramo
  const bq = new THREE.Group(); bq.position.y = 1.75; root.add(bq);
  const fl = [], ctr = new THREE.Vector3(0, -.2, 0), mouth = new THREE.Vector3(0, -.1, 0);
  const dome = (i, n, maxA, rad, sq = .85) => {
    const u = (i + .5) / n, th = Math.acos(1 - u * (1 - Math.cos(maxA))), ph = i * 2.399963;
    return new THREE.Vector3(Math.sin(th) * Math.cos(ph) * rad * 1.05, Math.cos(th) * rad * sq + .9, Math.sin(th) * Math.sin(ph) * rad * 1.05);
  };
  const place = (obj, pos, scale, delay, stem = true, roll = true) => {
    const nrm = pos.clone().sub(ctr).normalize();
    obj.position.copy(pos); obj.quaternion.setFromUnitVectors(Y, nrm); if (roll) obj.rotateY(R() * PI2);
    bq.add(obj);
    if (stem) { const len = pos.distanceTo(mouth), s = new THREE.Mesh(GEO.stem, toon(C.salvia)); s.scale.set(1, len, 1); s.position.copy(pos).add(mouth).multiplyScalar(.5); s.quaternion.setFromUnitVectors(Y, pos.clone().sub(mouth).normalize()); bq.add(s); fl.push({ o: s, sc: new THREE.Vector3(1, len, 1), delay: 0 }); }
    fl.push({ o: obj, sc: new THREE.Vector3(1, 1, 1).multiplyScalar(scale), delay });
  };
  // 22 flores principales: orden entremezclado como en la foto
  const kinds = ['rl', 'lily', 'rp', 'tw', 'rp', 'rl', 'lily', 'tp', 'rp', 'rl', 'lily', 'tw', 'rp', 'rl', 'tw', 'lily', 'rp', 'rl', 'tp', 'lily', 'rp', 'rl'];
  kinds.forEach((k, i) => {
    const o = k === 'rl' ? rose(C.lila, R) : k === 'rp' ? rose(C.rosa, R) : k === 'lily' ? lily(R) : tulip(k === 'tw' ? C.crema : C.rosa);
    const sc = k[0] === 'r' ? .8 : k === 'lily' ? .9 : .88;
    place(o, dome(i, kinds.length, 1.25, 2.05), sc, 1.2 + i * .25 + R() * .2);
  });
  for (let i = 0; i < 24; i++) place(daisy(), dome(i, 24, 1.45, 2.25, .8).add(new THREE.Vector3((R() - .5) * .3, (R() - .5) * .2, (R() - .5) * .3)), 1, 2 + R() * 6, true);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * PI2 + .2, p = new THREE.Vector3(Math.cos(a) * 1.35, .55 + R() * .5, Math.sin(a) * 1.35), o = leaf();
    o.position.copy(p); o.quaternion.setFromUnitVectors(Y, new THREE.Vector3(Math.cos(a), .9, Math.sin(a)).normalize()); o.rotateY(R() - .5);
    o.rotation.order = 'YXZ'; bq.add(o); fl.push({ o, sc: new THREE.Vector3(1, 1, 1).multiplyScalar(1.1), delay: .6 + R() });
  }
  fl.forEach(f => f.o.scale.setScalar(0));
  shadows(scene);
  // visitantes del ramo: 3 morpho dan vueltas
  const mf = [0, 1, 2].map(() => { const k = makeMorphoFly(); scene.add(k.g); return k; });

  const setAspect = a => fitFov(camera, a, 38, .75);
  return {
    scene, camera, setAspect,
    update(t) {
      const lt = t - FL.start;
      root.rotation.y = lt * FL.spin * .85 + .3;
      const v = easeOutBack(lt / 1.2); vaseG.scale.set(clamp(v, 0, 1.2), clamp(v, 0, 1.2), clamp(v, 0, 1.2));
      fl.forEach(f => f.o.scale.copy(f.sc).multiplyScalar(clamp(easeOutBack((lt - f.delay) / 1.4), 0, 1.3)));
      mf.forEach((k, i) => {
        const a = lt * .35 * (i % 2 ? -1 : 1) + i * 2.1, ap = clamp((lt - 6 - i * 1.5) / 2);
        k.g.position.set(2.3 * Math.cos(a), 5.2 + .3 * i + .6 * Math.sin(lt * .5 + i), 3 * Math.sin(a)); k.g.scale.setScalar(.5 * ap);
        k.g.rotation.set(.5, 0, .3 * Math.cos(a)); k.flap(.15 + .55 * (1 + Math.sin(lt * 6 + i * 2)));
      });
      camera.position.set(0, 4.05 + .15 * Math.sin(lt * .4), 10.5); camera.lookAt(0, 3.75 + (innerWidth / innerHeight < 1 ? .3 : 0), 0);
    },
  };
}
