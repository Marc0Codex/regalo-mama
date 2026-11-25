import { A, B } from './k.js';
export const LOOP = 20.13986394557823, LOOPS = 4, TOTAL = LOOP * LOOPS, BAR = LOOP / 12;
// Descifra en memoria; nunca hay un .wav ni un <audio> con enlace.
export async function startAudio() {
  const ctx = new AudioContext(); ctx.resume();
  const raw = new Uint8Array(await (await fetch('assets/song.bin')).arrayBuffer());
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(A, (v, i) => v ^ B[i]), 'AES-GCM', false, ['decrypt']);
  const buf = await ctx.decodeAudioData(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12)));
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const g = ctx.createGain(); src.connect(g).connect(ctx.destination);
  const t0 = ctx.currentTime + 0.2;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + 2.5);
  g.gain.setValueAtTime(1, t0 + TOTAL - BAR); g.gain.linearRampToValueAtTime(0, t0 + TOTAL);
  src.start(t0); src.stop(t0 + TOTAL + 0.1);
  return { now: () => ctx.currentTime - t0 };
}
