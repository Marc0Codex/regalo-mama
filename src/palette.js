import * as THREE from '../vendor/three.module.js';
// Paleta cerrada sacada del ramo
export const C = {
  bg: 0x07060B, lila: 0xB9A3E3, rosa: 0xF2A7C3, crema: 0xFFF6EC, mant: 0xF6DC8A,
  salvia: 0xA9C8A0, agua: 0x9FD3E6, menta: 0xBFE8D8,
  lilaOsc: 0x6C5AA8, salviaOsc: 0x5E8F7A, salviaMed: 0x86C3A8,
};
// Sombreado en 4 bandas: da el aspecto ilustrado y glifos limpios
const g = new THREE.DataTexture(new Uint8Array([38, 78, 120, 165, 212, 255]), 6, 1, THREE.RedFormat);
g.minFilter = g.magFilter = THREE.NearestFilter; g.needsUpdate = true;
export const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: g, ...o });
export const addLights = (scene, shadow = 0, pos = [4, 9, 6]) => {
  scene.add(new THREE.HemisphereLight(0xd9ccff, 0x4a3a78, 1.25)); // cielo lila / suelo violeta: sombras con color
  const k = new THREE.DirectionalLight(0xfff0dc, 2.6); k.position.set(...pos); scene.add(k);
  if (shadow) {
    k.castShadow = true; k.shadow.mapSize.set(2048, 2048); k.shadow.bias = -.0005; k.shadow.normalBias = .03; k.shadow.radius = 3;
    Object.assign(k.shadow.camera, { left: -shadow, right: shadow, top: shadow, bottom: -shadow, near: 1, far: 50 }); k.shadow.camera.updateProjectionMatrix();
  }
  const r = new THREE.DirectionalLight(0xb9a3e3, 1.3); r.position.set(-6, 3, -5); scene.add(r); // contraluz lila
  const f = new THREE.DirectionalLight(0xf2a7c3, .5); f.position.set(-5, 1, 6); scene.add(f); // relleno rosa
};
export const shadows = scene => scene.traverse(o => { if (o.isMesh && !o.material.isShaderMaterial) o.castShadow = o.receiveShadow = true; });
// Mantiene el ancho de vista del encuadre horizontal en pantallas verticales
export const fitFov = (cam, aspect, vfov, minAspect = 1.3) => {
  cam.aspect = aspect;
  cam.fov = aspect >= minAspect ? vfov : 2 * Math.atan(Math.tan(vfov * Math.PI / 360) * minAspect / aspect) * 180 / Math.PI;
  cam.updateProjectionMatrix();
};
