// 本編「もし回転寿司のレーンが、2秒ごとに2倍速になっていったら？」の、作品だけの設定。
// 仕組み（時間の変換・カット・揺れの掛け方・画面の文字の組み立て）は kinds/sim3d/lib/context.mjs。ここは中身だけを書く。
import { clamp } from "../../kinds/sim3d/lib/mvscene.mjs";
import { gate } from "../../kinds/sim3d/lib/context.mjs";
import { comma, short } from "../../kinds/sim3d/lib/doubling.mjs";

// 単位の言い換え：2倍になった回数 n のときのレーンの速さを、読みやすい単位で
const valueOf = (v0, MAXN) => (n) => {
  if (n >= MAXN) return ["秒速 30万", "km"];
  const v = v0 * 2 ** n;
  if (v < 1) return [`秒速 ${Math.round(v * 100)}`, "cm"];
  if (v < 340) return [`時速 ${short(v * 3.6)}`, "km"];
  if (v < 1000) return [`秒速 ${comma(v)}`, "m"];
  const km = v / 1000;
  return km < 10000 ? [`秒速 ${km < 20 ? km.toFixed(1) : comma(km)}`, "km"] : [`秒速 ${short(km / 1e4)}万`, "km"];
};

// 2倍になる回数の上限：0.04 × 2^33 が光の速さを初めて超える
const MAXN = 33;

// episode.json（ep）を受け取って設定を返す。v0（はじめの速さ）と lightSpeed（上限）は ep.story から読む
export default (ep) => ({
  // 光：lib の既定（inside outside aerial space）に、跡地の夕焼けを足す
  looks: {
    ruin: { background: "#E9B98F", sun: { from: [-5, 3, 3], color: "#FFD2A6", intensity: 1.0 }, ambient: { color: "#F2D2B6", intensity: 0.9 }, shadows: true, shadowExtent: 9, fog: { color: "#E9B98F", near: 14, far: 70 }, post: { ao: 1.0, bloom: 0.55 } },
  },
  // 冒頭（動画の0〜5秒）：結末の先見せ（0〜2.6秒）と、店内の時計（2.6〜5秒）
  intro: { ahead: 0, clock: 2.6 },
  // 光の速さで頭打ち
  doubling: { cap: ep.story.lightSpeed, maxSteps: MAXN },
  title: {
    lines: [[{ t: "もし" }, { t: "回転寿司のレーン", accent: true }, { t: "が、" }], [{ t: "2秒ごとに" }, { t: "2倍速", accent: true }, { t: "に" }], [{ t: "なっていったら？" }]],
    sub: "※店の人もお客さんも無敵とします",
  },
  counter: { label: "レーンの速さ", valueOf: valueOf(ep.story.v0, MAXN) },
  // 比較の札：2倍になった回数 → 文言
  pills: {
    0: "ふつうの回転寿司", 5: "人が歩く速さ", 6: "ジョギングの速さ", 7: "自転車の速さ", 8: "100m走の世界記録なみ", 9: "一般道の制限速度を超えた",
    10: "プロ野球の速球なみ", 11: "新幹線なみ", 12: "リニアの最高記録なみ", 13: "ほぼ音の速さ", 14: "音の約2倍", 15: "ライフルの弾より速い",
    18: "人工衛星になれる速さ", 19: "地球を出られる速さ", 20: "太陽系を出られる速さ", 24: "銀河を出られる速さ",
    26: "光の約1%", 28: "光の約4%", 29: "光の約7%", 30: "光の約14%", 31: "光の約29%", 32: "光の約57%", 33: "これより速くは回れない",
  },
  // 店内の時計（冒頭の後半だけ）
  clock: (ctx, f, sec) => (f >= ctx.INTRO.clock[0] ? { label: "店内の時計", text: sec < 3 ? "12:29:57" : sec < 4 ? "12:29:58" : "12:29:59", a: gate(sec, 2.6, ctx.ep.story.introSec, 0.25) } : null),
  // 注意書き（光の速さに届いた後）
  note: (ctx, t) => (t >= 66.2 ? { text: "※ここから先は空想です。光より速くは進めません", a: gate(t, 66.2, ctx.ep.story.storySec + 1) } : null),
  // 揺れの大きさの時間割：速さとともに大きくなり、2倍になる瞬間に突き上げる
  shake: (ctx, f, t) => {
    const { stepOf, STEP } = ctx, n = stepOf(Math.max(0, t));
    let amp = 0;
    if (f < ctx.INTRO.clock[0]) amp = 0.01; // 冒頭の先見せは、はじめから少し揺らす
    else if (t >= 8) {
      amp = t < 24 ? Math.min(0.014, 0.001 * 1.42 ** (n - 4)) : t < 32 ? 0.012 : t < 36 ? 0.004 : t < 52 ? 0.0015 : 0.003 + 0.008 * clamp((t - 52) / 14);
      if (n >= 4 && n < MAXN) amp += (t < 36 ? 0.018 : 0.005) * Math.exp(-9 * (t - n * STEP));
    }
    return amp;
  },
  // 2倍になった瞬間に、画角を少し狭めて戻す（5回目から、光の速さに届くまで）
  fovKick: (ctx, f, t) => {
    const n = ctx.stepOf(Math.max(0, t));
    return n >= 5 && n < MAXN && t < 66 ? 1 - 0.045 * Math.exp(-10 * (t - n * ctx.STEP)) : null;
  },
  // 幕で使う道具：レーン（ベルト）が進んだ距離（m）
  extend: (ctx) => { ctx.beltDistance = ctx.doubling.distance; },
});
