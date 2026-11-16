// 本編の音を、計算で作る（録音や素材は使わない）。
//   node projects/kaiten-sushi/sound.mjs  →  baked/audio.wav（48kHz・ステレオ・16bit。SIM3D_BAKED があればそこへ）
// 音を足す道具（add・noiseGen・blip などの部品・書き出し）は kinds/sim3d/lib/audio.mjs。ここは「いつ何を鳴らすか」の台本だけ。
//
// 設計：静かな店（時計の音）→ 速さが倍になるたびの「ピッ」と、太っていくレーンのうなり
//       → 皿の当たる音・ガラス・音の壁・屋根 → 宇宙に出た瞬間ほぼ無音 → 跡地の風と高鳴り → 会話 → 締めの和音
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { makeMix } from "../../kinds/sim3d/lib/audio.mjs";
import { bakedDir } from "../../kinds/sim3d/lib/context.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ep = JSON.parse(readFileSync(join(here, "episode.json"), "utf8"));
const DUR = ep.video.durationSec;
const { introSec: INTRO, storySec: STORY, doubleEverySec: STEP } = ep.story;
const mix = makeMix({ durSec: DUR, seed: 4242 });
const { SR, TAU, rand, smooth, add, noiseGen, tick, blip, clink, thump, burst, whoosh } = mix;
const at = (storySec) => INTRO + storySec; // 物語の秒 → 動画の秒

// ---------- 冒頭 ----------
thump(0.02, 0.8); burst(0.02, 0.5, 1.6, 0.35);
{ const n = noiseGen(0.03); add(0, 2.6, (u, k) => n() * 5 * (1 - k * 0.5) * 0.5); }          // 低いうなり
for (let i = 0; i < 9; i++) whoosh(0.2 + i * 0.26, 0.12, 0.35, rand() * 2 - 1);
for (const s of [3, 4]) tick(s, 0.5);                                                          // 時計
blip(INTRO, 880, 0.4, 0.5);                                                                    // 12:30:00

// 店内のざわめき（時計のカットから12秒まで）と、ときどき鳴る食器
{ const hum = noiseGen(0.04); add(2.6, at(13) - 2.6, (u, k) => hum() * 1.3 * Math.min(1, u * 3) * (1 - smooth(k, 0.8, 1))); }
for (let t = 2.8; t < at(11); t += 0.5 + rand() * 0.9) clink(t, 0.035, rand() * 2 - 1);

// ---------- 物語 ----------
// 秒針。店が静かなうちだけ聞こえる
for (let s = 1; s < 14; s++) tick(at(s), 0.28 * (1 - smooth(s, 8, 14)), 2000);
// 速さが2倍になるたびの「ピッ」。1回ごとに半音ずつ高くなる。宇宙では小さく、こだまが付く
for (let n = 1; n <= 33; n++) {
  const t = n * STEP, space = t >= 36 && t < 52, hz = 330 * 2 ** (n / 12);
  blip(at(t), hz, space ? 0.16 : 0.34);
  if (space) { blip(at(t) + 0.28, hz, 0.07); blip(at(t) + 0.56, hz, 0.03); }
}
// レーンのうなり。速さが倍になるたびに音程が上がる。36秒（宇宙）で消える
{
  let phase = 0, hzNow = 40;
  add(at(4), 32, (u) => {
    const t = 4 + u, n = Math.floor(t / STEP), target = 40 * 2 ** (n / 5.5);
    hzNow += (target - hzNow) * 0.0006;
    phase += (TAU * hzNow) / SR;
    const vol = 0.05 + 0.3 * smooth(t, 4, 30);
    return (Math.sin(phase) + 0.5 * Math.sin(phase * 2.01) + 0.3 * Math.sin(phase * 3.02)) * vol * 0.45 * (1 - smooth(t, 35.9, 36.05));
  });
}
// 風とうなり（雑音）。15秒あたりから右肩上がりに太る。24秒からは波打つ。36秒で切れる
{
  const low = noiseGen(0.015), mid = noiseGen(0.12);
  add(at(8), 28, (u) => {
    const t = 8 + u, grow = smooth(t, 8, 30), pulse = t > 24 ? 0.75 + 0.25 * Math.sin(TAU * 2.2 * t) : 1;
    return (low() * 9 * grow + mid() * 1.2 * smooth(t, 14, 30)) * pulse * 0.55 * (1 - smooth(t, 35.9, 36.05));
  });
}
// 皿が当たる音。12秒から増えていく
for (let t = 12; t < 24; ) { clink(at(t), 0.1 + 0.12 * smooth(t, 12, 22), rand() * 2 - 1); t += (0.5 / (1 + (t - 12) * 1.1)) * (0.5 + rand()); }
// 皿が角を曲がれずに壁へ当たる（14.4〜16秒）
for (let t = 14.4; t < 16; t += 0.22 + rand() * 0.2) { thump(at(t), 0.16, 140, 0.18); for (let i = 0; i < 3; i++) clink(at(t) + rand() * 0.12, 0.16, 0.6); }
// 皿の山が崩れる（16.3〜17.8秒）
for (let i = 0; i < 44; i++) clink(at(16.3 + rand() ** 1.4 * 1.5), 0.17, rand() * 2 - 1);
// 窓ガラスが割れる（20秒）
burst(at(20), 0.7, 0.6, 0.95); thump(at(20), 0.35, 70, 0.6);
for (let i = 0; i < 26; i++) clink(at(20.02) + rand() * 0.7, 0.2, rand() * 2 - 1);
// 棚の瓶が落ちる（20.5〜22秒）と、椅子が倒れる音（22〜23.4秒）
for (let t = 20.5; t < 22; t += 0.1 + rand() * 0.12) { clink(at(t), 0.14, -0.4); if (rand() < 0.4) thump(at(t) + 0.05, 0.14, 120, 0.2); }
for (const t of [22.1, 22.35, 22.6, 23.0, 23.2]) { thump(at(t) + 0.25, 0.3, 90, 0.4); burst(at(t) + 0.25, 0.25, 0.25, 0.4); }
// 足音（出口へ走り、駐車場へ）
for (let t = 22; t < 26.4; t += 0.11 + rand() * 0.05) add(at(t), 0.05, (u) => Math.sin(TAU * 110 * u) * Math.exp(-u * 70) * 0.16, rand() * 2 - 1);
// 警官の笛（24.3秒・25.2秒）
for (const t of [24.3, 25.2]) add(at(t), 0.42, (u, k) => Math.sin(TAU * 2750 * u + 3 * Math.sin(TAU * 38 * u)) * 0.11 * Math.sin(Math.PI * k) ** 0.4, -0.5);
// 車の警報
for (let t = 26.1; t < 31.9; t += 0.53) add(at(t), 0.26, (u, k) => Math.sin(TAU * (k < 0.5 ? 1180 : 890) * u) * 0.045 * Math.sin(Math.PI * k), 0.5);
// 音の壁（28秒）。直前を一瞬しぼってから鳴らす
thump(at(28), 1.1, 38, 2.0); burst(at(28), 0.9, 1.2, 0.5); burst(at(28.02), 0.5, 2.2, 0.06);
// 屋根が飛ぶ（30秒）
thump(at(30), 0.9, 52, 1.6); burst(at(30), 0.7, 0.9, 0.7); whoosh(at(30.05), 0.5, 1.4, 0.3);
for (let i = 0; i < 14; i++) { const t = 30.6 + rand() * 1.3; thump(at(t), 0.18, 80 + rand() * 60, 0.3); } // 瓦礫
// 流れ星（32〜34秒）
for (let i = 0; i < 9; i++) whoosh(at(32 + i * 0.22), 0.2, 0.5 + rand() * 0.4, rand() * 2 - 1);
// 街に寿司が降る（34〜36秒）：落ちてくる音と、地面に当たる音。35.3秒に、巨大な玉子が車に乗る
for (let t = 34.1; t < 35.95; t += 0.16 + rand() * 0.16) { whoosh(at(t) - 0.25, 0.1, 0.3, rand() * 2 - 1); thump(at(t), 0.22, 70 + rand() * 50, 0.3); }
thump(at(35.3), 0.95, 44, 1.0); burst(at(35.3), 0.6, 0.5, 0.6); for (let i = 0; i < 10; i++) clink(at(35.32) + rand() * 0.4, 0.15, 0.2);

// 宇宙（36〜52秒）：ほぼ無音。低い持続音だけ
add(at(36), 16, (u, k) => (Math.sin(TAU * 58 * u) + 0.6 * Math.sin(TAU * 87.3 * u)) * 0.07 * (0.7 + 0.3 * Math.sin(TAU * 0.3 * u)) * Math.sin(Math.PI * k) ** 0.5);
for (let i = 0; i < 20; i++) whoosh(at(38 + i * 0.7), 0.035, 0.9, rand() * 2 - 1);

// 跡地（52〜66秒）：風。レーンの高鳴りが、光の速さへ向けてせり上がる
{
  const wind = noiseGen(0.06);
  add(at(52), 14.6, (u, k) => wind() * 5.5 * (0.3 + 0.5 * k) * (0.8 + 0.2 * Math.sin(TAU * 0.4 * u)) * Math.min(1, u * 2));
  let ph = 0;
  add(at(52), 14, (u, k) => { ph += (TAU * 180 * 2 ** (k * 5)) / SR; return (Math.sin(ph) + 0.3 * Math.sin(ph * 2)) * 0.05 * (0.3 + k * k * 2.4) * Math.min(1, u * 2); });
  for (let t = 52.3; t < 66; t += 0.08 + rand() * 0.25) clink(at(t), 0.035 + 0.05 * smooth(t, 52, 66), rand() * 2 - 1); // 火花
}
// 光の柱が立つ（64秒）
thump(at(64.05), 0.6, 60, 1.2); { let ph = 0; add(at(64.05), 1.9, (u, k) => { ph += (TAU * 220 * 2 ** (k * 2.5)) / SR; return Math.sin(ph) * 0.08 * k; }); }
// 光の速さ（66秒）
thump(at(66), 1.2, 34, 2.4); burst(at(66), 1.0, 1.0, 0.9); burst(at(66.02), 0.4, 2.5, 0.04);
// 会話：吹き出しが出る音（SAY の秒は、幕の吹き出しの出る時刻に合わせる）
const SAY = [66.4, 67.5], EGG = 68.3;
for (const [i, [a, b]] of [[660, 880], [520, 390]].entries()) { blip(at(SAY[i]), a, 0.3, 0.12); blip(at(SAY[i]) + 0.1, b, 0.3, 0.2); }
// 玉子が目の前を通り過ぎる：一瞬の風切りと、高い音が下がりながら遠ざかる
whoosh(at(EGG) - 0.12, 0.55, 0.34, 0);
{ let ph = 0; add(at(EGG), 0.7, (u, k) => { ph += (TAU * 1900 * 2 ** (-k * 1.6)) / SR; return Math.sin(ph) * 0.2 * (1 - k) ** 2; }, 0.6); }
{ const wind = noiseGen(0.05); add(at(66.6), STORY - 66.6, (u, k) => wind() * 0.5 * (1 - k * 0.5)); }

// ---------- 締め ----------
const END = INTRO + STORY;
for (const [i, hz] of [262, 330, 392, 523].entries()) add(END + 0.4 + i * 0.07, 4.3, (u, k) => Math.sin(TAU * hz * u) * 0.09 * Math.sin(Math.PI * k) ** 0.6);
blip(END + 0.9, 1047, 0.25, 0.8);

// ---------- 大きな音の直前を一瞬しぼる（溜め） ----------
for (const t of [28, 30, 66]) mix.duckBefore(at(t));

// ---------- 音割れを防いで書き出す ----------
const wav = join(bakedDir(here), "audio.wav"), peak = mix.write(wav);
console.log(`音 ${DUR}秒 → ${relative(process.cwd(), wav)}（最大音量 ${peak.toFixed(2)} を 0.92 にそろえた）`);
