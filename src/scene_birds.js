import * as THREE from '../vendor/three.module.js';
import { C, toon, addLights, fitFov } from './palette.js';
import { rng } from './util.js';
import { makeLeaf } from './scene_morpho.js';

const PI2 = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
// Colibrí real: foto CC0 (goodfreephotos.com) recortada a assets/bird.png. Pico en (.84, .03) de la imagen, mira a la derecha.
const TIP = [.84, .03], AR = 543 / 549;

// flor de trompeta con borde ondulado; abre hacia -X
function trumpet(color) {
  const g = new THREE.Group(), pts = [[.02, 0], [.07, .05], [.09, .5], [.13, .9], [.28, 1.2], [.36, 1.3]].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 24), pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i), k = 1 + .14 * Math.max(0, y - .9) * Math.sin(5 * Math.atan2(pa.getZ(i), pa.getX(i))); pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); }
  geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, toon(color, { side: THREE.DoubleSide })), n = new THREE.Mesh(geo, toon(C.mant, { side: THREE.DoubleSide })); n.scale.set(.8, .97, .8);
  g.add(o, n); g.rotation.z = Math.PI / 2; return g;
}

export function makeBirds() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 1.7, .1, 100);
  scene.fog = new THREE.Fog(C.bg, 12, 30); addLights(scene);
  const R = rng(33);
  const leaves = Array.from({ length: 10 }, (_, i) => { const l = makeLeaf(C.salviaOsc, 2.5 + R() * 1.5); l.userData = { ux: (i % 2 ? 1 : -1) * (.5 + R() * .6), y: -5 + R() * 8, rz: (i % 2 ? -1 : 1) * (.5 + R() * .8) }; l.position.z = -8 - R() * 4; scene.add(l); return l; });
  const tex = new THREE.TextureLoader().load('assets/bird.png'); tex.colorSpace = THREE.SRGBColorSpace;
  const bird = new THREE.Mesh(new THREE.PlaneGeometry(AR, 1), new THREE.MeshBasicMaterial({ map: tex, alphaTest: .45, side: THREE.DoubleSide })); scene.add(bird);
  const flower = trumpet(C.rosa), stem = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1, 5), toon(C.salvia)), fleaf = makeLeaf(C.salvia, 1.6); scene.add(flower, stem, fleaf);
  const N = 160, pp = new Float32Array(N * 3), base = Array.from({ length: N }, () => [(R() - .5) * 22, R() * 16 - 8, R() * 14 - 8, R() * PI2]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: C.mant, size: 3, sizeAttenuation: false })); dust.frustumCulled = false; scene.add(dust);
  let W = 6, H = 6, hw = 5, bx = 0, by = 0;
  const setAspect = a => {
    fitFov(camera, a, 46, .62);
    const hh = Math.tan(camera.fov * Math.PI / 360) * 11; hw = hh * a;
    H = Math.min(hh * 1.5, hw * 1.5 / AR); W = H * AR; // el pájaro llena la pantalla
    bx = -W * .04; by = -H * .05; bird.scale.set(H, H, 1); bird.position.set(bx, by, 0);
    const tip = new THREE.Vector3(bx + (TIP[0] - .5) * W, by + (.5 - TIP[1]) * H, 0), s = W * .17;
    flower.scale.setScalar(s); flower.position.set(tip.x + W * .03 + 1.3 * s, tip.y - .02 * H, -.3);
    const bot = new THREE.Vector3(flower.position.x + 1.3 * s + .4, -hh - 1, -.6), top = flower.position.clone().add(new THREE.Vector3(1.3 * s * .9, 0, 0));
    stem.scale.set(1, top.distanceTo(bot), 1); stem.position.copy(top).add(bot).multiplyScalar(.5); stem.quaternion.setFromUnitVectors(UP, top.clone().sub(bot).normalize());
    fleaf.position.set(stem.position.x, -hh * .45, -.7); fleaf.rotation.z = -.9; fleaf.scale.setScalar(Math.max(1, hh / 4));
    leaves.forEach(l => { l.position.x = l.userData.ux * hw * .9; l.position.y = l.userData.y * hh / 5; l.rotation.z = l.userData.rz; });
  };
  return {
    scene, camera, setAspect,
    update(t) {
      const lt = t - 18;
      bird.position.set(bx + .02 * W * Math.sin(lt * 1.3), by + .025 * H * Math.sin(lt * 2.2), 0);
      bird.rotation.set(0, .22 * Math.sin(lt * .5), .035 * Math.sin(lt * 1.7)); // vaivén de colibrí en el aire
      flower.rotation.x = .05 * Math.sin(lt * .8);
      const a = dust.geometry.attributes.position;
      base.forEach((b, i) => a.setXYZ(i, b[0] + Math.sin(t * .3 + b[3]) * .4, ((b[1] + t * .3 + 8) % 16) - 8, b[2]));
      a.needsUpdate = true;
      camera.position.set(0, 0, 11); camera.lookAt(0, 0, 0);
    },
  };
}
