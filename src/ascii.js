import * as THREE from '../vendor/three.module.js';
import { clamp } from './util.js';

// glifos: 0-11 rampa de densidad, 12-16 contornos, 17+ barajado de "descifrado"
const RAMP = ['·', '.', ':', '-', '=', '+', '*', 'o', 'O', '0', '#', '@'];
export const GL = [...RAMP, '/', '\\', '|', '_', '-', ...'$%&?<>~^;!'];
export const G_SCRAMBLE = 17, G_SCRAMBLE_N = GL.length - 17;
const BG = '#07060B';

export class Ascii {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.S = 3;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    const c = this.canvas; c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
    const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fs = clamp(Math.min(W / 105, H / 80), 5.2, 13);
    this.font = `700 ${fs}px ui-monospace,"Cascadia Mono",Menlo,Consolas,"Courier New",monospace`;
    ctx.font = this.font;
    this.cw = ctx.measureText('M').width; this.ch = Math.round(fs * 1.2); this.dpr = dpr;
    const cols = this.cols = Math.floor(W / this.cw), rows = this.rows = Math.floor(H / this.ch);
    this.x0 = (W - cols * this.cw) / 2; this.y0 = (H - rows * this.ch) / 2;
    this.aspect = (cols * this.cw) / (rows * this.ch);
    const S = this.S, n = cols * rows;
    this.rts?.forEach(r => r.dispose());
    this.rts = [0, 1].map(() => {
      const rt = new THREE.WebGLRenderTarget(cols * S, rows * S, { depthBuffer: true });
      rt.texture.colorSpace = THREE.SRGBColorSpace; return rt;
    });
    this.buf = new Uint8Array(cols * S * rows * S * 4);
    this.layers = [0, 1].map(() => ({ r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) }));
    this.fr = new Float32Array(n); this.fg = new Float32Array(n); this.fb = new Float32Array(n); this.fa = new Float32Array(n);
    this.gl = new Int8Array(n).fill(-1);
    this.atlas = new Map();
  }

  // Dibuja la escena 3D en un buffer pequeño y lo promedia en celdas
  sample(scene, cam, k) {
    const { S, cols, rows, renderer: r, buf } = this, W = cols * S, H = rows * S, rt = this.rts[k], L = this.layers[k];
    r.setRenderTarget(rt); r.clear(); r.render(scene, cam);
    r.readRenderTargetPixels(rt, 0, 0, W, H, buf); r.setRenderTarget(null);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let n = 0, R = 0, G = 0, B = 0;
      for (let sy = 0; sy < S; sy++) {
        const row = (H - 1 - (y * S + sy)) * W + x * S;
        for (let sx = 0; sx < S; sx++) { const i = (row + sx) * 4; if (buf[i + 3] > 127) { n++; R += buf[i]; G += buf[i + 1]; B += buf[i + 2]; } }
      }
      const i = y * cols + x; L.a[i] = n / (S * S);
      if (n) { L.r[i] = R / n / 255; L.g[i] = G / n / 255; L.b[i] = B / n / 255; } else L.r[i] = L.g[i] = L.b[i] = 0;
    }
  }

  // Mezcla capa A y B celda a celda (useB(x,y) -> bool) y elige glifo
  compose(a, b, useB) {
    const { cols, rows, fr, fg, fb, fa, gl } = this, A = this.layers[a], Bl = b == null ? null : this.layers[b];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, S = Bl && useB(x, y) ? Bl : A;
      fr[i] = S.r[i]; fg[i] = S.g[i]; fb[i] = S.b[i]; fa[i] = S.a[i];
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, a0 = fa[i];
      if (a0 < 0.12) { gl[i] = -1; continue; }
      const r = fr[i], g = fg[i], bb = fb[i], L = 0.299 * r + 0.587 * g + 0.114 * bb, m = Math.max(r, g, bb, 0.001);
      let glyph = 1 + Math.floor(clamp(L * 1.1) * 10.99), k = clamp(0.38 + L * 1.05);
      if (a0 < 0.88) { // contorno de siluetas
        const l = x > 0 ? fa[i - 1] : 0, rr = x < cols - 1 ? fa[i + 1] : 0, u = y > 0 ? fa[i - cols] : 0, d = y < rows - 1 ? fa[i + cols] : 0;
        const gx = rr - l, gy = d - u;
        if (Math.hypot(gx, gy) > 0.35) {
          glyph = Math.abs(gx) > Math.abs(gy) * 2 ? 14 : Math.abs(gy) > Math.abs(gx) * 2 ? (gy > 0 ? 16 : 15) : (gx * gy > 0 ? 12 : 13);
          k = 0.95;
        }
      }
      gl[i] = glyph; fr[i] = r / m * k; fg[i] = g / m * k; fb[i] = bb / m * k;
    }
  }

  // Pone un glifo en una celda vacía (capas de fondo: letras, pétalos)
  put(i, glyph, r, g, b) { if (this.gl[i] < 0) { this.gl[i] = glyph; this.fr[i] = r; this.fg[i] = g; this.fb[i] = b; } }

  draw(fade = 1) {
    const { ctx, cols, rows, cw, ch, x0, y0, gl, fr, fg, fb, atlas, dpr } = this;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, innerWidth, innerHeight);
    const tw = Math.ceil(cw * dpr), th = Math.ceil(ch * dpr);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, g = gl[i]; if (g < 0) continue;
      const q = ((clamp(fr[i] * fade) * 15 + .5 | 0) << 8) | ((clamp(fg[i] * fade) * 15 + .5 | 0) << 4) | (clamp(fb[i] * fade) * 15 + .5 | 0);
      if (!q) continue;
      const key = g * 4096 + q; let t = atlas.get(key);
      if (!t) {
        t = document.createElement('canvas'); t.width = tw; t.height = th;
        const c = t.getContext('2d'); c.font = this.font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.scale(dpr, dpr);
        c.fillStyle = `rgb(${(q >> 8) * 17},${((q >> 4) & 15) * 17},${(q & 15) * 17})`;
        c.fillText(GL[g], cw / 2, ch / 2 + 0.5); atlas.set(key, t);
      }
      ctx.drawImage(t, x0 + x * cw, y0 + y * ch, cw, ch);
    }
  }
}
