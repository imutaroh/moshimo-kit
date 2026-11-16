// 音を計算で作る（録音や素材は使わない）。→ baked/audio.wav（試し撮りのときは SIM3D_BAKED の場所）
// 道具（add・noiseGen と、tick blip clink thump burst whoosh の部品、duckBefore、write）は kinds/sim3d/lib/audio.mjs。
// 書き換える所：「いつ何を鳴らすか」。秒は動画の秒なので、物語の秒は at(t) で直す
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { makeMix } from "../../kinds/sim3d/lib/audio.mjs";
import { bakedDir } from "../../kinds/sim3d/lib/context.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ep = JSON.parse(readFileSync(join(here, "episode.json"), "utf8"));
const { introSec, storySec, doubleEverySec: STEP } = ep.story;
const mix = makeMix({ durSec: ep.video.durationSec, seed: 1 });
const { rand, add, noiseGen, tick, blip, clink, thump, burst, whoosh } = mix;
const at = (t) => introSec + t; // 物語の秒 → 動画の秒

// 冒頭：低いうなりと、時計
{ const n = noiseGen(0.03); add(0, introSec, (u, k) => n() * 2 * (1 - k * 0.5)); }
for (let s = 0.5; s < introSec + 8; s += 1) tick(s, 0.25 * (s < introSec ? 1 : 0.6));
// 2倍になるたびの「ピッ」。1回ごとに高くなる。車が落ちて着く「コトッ」も重ねる
for (let n = 1; n * STEP < storySec; n++) {
  blip(at(n * STEP), 440 * 2 ** (n / 6), 0.35);
  for (let i = 0; i < Math.min(2 ** (n - 1), 8); i++) clink(at(n * STEP) + 0.18 + rand() * 0.08, 0.08, rand() * 2 - 1);
}
// 10秒：空から車が降って、あふれる。直前を一瞬しぼってから、ドンと、転がる音
mix.duckBefore(at(10));
thump(at(10), 0.9, 44, 1.4); burst(at(10), 0.5, 0.6, 0.6); whoosh(at(9.9), 0.3, 0.5, 0);
for (let i = 0; i < 30; i++) clink(at(10.2 + rand() * 1.6), 0.12, rand() * 2 - 1);
// 締め：和音
for (const [i, hz] of [262, 330, 392, 523].entries()) add(at(storySec) + 0.2 + i * 0.07, 1.6, (u, k) => Math.sin(2 * Math.PI * hz * u) * 0.09 * Math.sin(Math.PI * k) ** 0.6);

const wav = join(bakedDir(here), "audio.wav"), peak = mix.write(wav);
console.log(`音 ${ep.video.durationSec}秒 → ${relative(process.cwd(), wav)}（最大音量 ${peak.toFixed(2)} を 0.92 にそろえた）`);
