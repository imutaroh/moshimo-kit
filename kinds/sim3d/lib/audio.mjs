// 音を計算で作る道具（録音や素材は使わない）。作品の sound.mjs から使う。
//
//   const mix = makeMix({ durSec: ep.video.durationSec, seed: 4242 });
//   mix.blip(5.0, 880, 0.4);            // 動画の 5 秒目に「ピッ」
//   mix.write(join(bakedDir(here), "audio.wav"));
//
// 秒はすべて「動画の秒」。物語の秒から変えるときは introSec を足す。
// 乱数は mix.rand の1本だけを使う。呼ぶ順番が変わると音も変わるので、部品の呼び出しを並べ替えるときは注意する。
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { rng, clamp } from "./mvscene.mjs";

export const makeMix = ({ durSec, sr = 48000, seed = 4242 }) => {
  const SR = sr, N = SR * durSec;
  const L = new Float32Array(N), R = new Float32Array(N);
  const TAU = Math.PI * 2, rand = rng(seed);
  const smooth = (x, a, b) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

  // from 秒から len 秒のあいだ、fn(経過秒, 0〜1の進み具合) の値を足す。pan は -1（左）〜1（右）
  const add = (from, len, fn, pan = 0) => {
    const i0 = Math.max(0, Math.floor(from * SR)), i1 = Math.min(N, Math.floor((from + len) * SR));
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = i0; i < i1; i++) { const u = (i - i0) / SR, v = fn(u, u / len); L[i] += v * gl * 1.41; R[i] += v * gr * 1.41; }
  };
  // 雑音。cut は 0〜1（小さいほど、こもった低い音）
  const noiseGen = (cut) => { let s = 0; return () => (s += (rand() * 2 - 1 - s) * cut); };

  // ---------- 部品 ----------
  const tick = (t, vol, hz = 2400) => add(t, 0.03, (u) => Math.sin(TAU * hz * u) * Math.exp(-u * 160) * vol);              // 時計のカチッ
  const blip = (t, hz, vol, len = 0.16) => add(t, len, (u) => (Math.sin(TAU * hz * u) + 0.4 * Math.sin(TAU * hz * 2 * u)) * Math.exp(-u * 24) * vol); // ピッ
  const clink = (t, vol, pan) => { const hz = 2600 + rand() * 3800; add(t, 0.09, (u) => Math.sin(TAU * hz * u) * Math.exp(-u * 60) * vol, pan); }; // 食器・ガラスのカチャ
  const thump = (t, vol, hz = 46, len = 1.4) => add(t, len, (u) => Math.sin(TAU * (hz + 30 * Math.exp(-u * 18)) * u) * Math.exp(-u * 3.2) * vol); // ドン
  const burst = (t, vol, len, cut = 0.5) => { const n = noiseGen(cut); add(t, len, (u, k) => n() * (1 - k) ** 2 * vol); };                 // ザッ（雑音が減っていく）
  const whoosh = (t, vol, len, pan) => { const n = noiseGen(0.25); add(t, len, (u, k) => n() * Math.sin(Math.PI * k) ** 2 * vol * 3, pan); }; // ヒュッ

  // 大きな音の直前（t 秒の手前 0.14 秒）を一瞬しぼる（溜め）
  const duckBefore = (t) => {
    const i1 = Math.floor(t * SR), i0 = i1 - Math.floor(0.14 * SR);
    for (let i = i0; i < i1; i++) { const g = 1 - smooth(i, i0, i0 + 0.05 * SR) * 0.92; L[i] *= g; R[i] *= g; }
  };

  // 音割れを防ぎ（tanh で丸める）、いちばん大きい所を 0.92 にそろえて、48kHz・ステレオ・16bit の wav を書く。返り値は丸めた後の最大音量
  const write = (file) => {
    let peak = 0;
    for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.1); R[i] = Math.tanh(R[i] * 1.1); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
    const gain = 0.92 / (peak || 1), buf = Buffer.alloc(44 + N * 4);
    buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
    for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * gain * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * gain * 32767), 46 + i * 4); }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, buf);
    return peak;
  };

  return { SR, N, L, R, TAU, rand, smooth, add, noiseGen, tick, blip, clink, thump, burst, whoosh, duckBefore, write };
};
