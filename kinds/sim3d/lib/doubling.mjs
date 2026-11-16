// 「N秒ごとに2倍」の計算。この作り方の動画で繰り返し使う。
//   何回2倍になったか（stepOf）、その時の値（speedAt）、ここまでに進んだ距離（distance）、×の札（badgeOf）、
//   画面左上の数字のかたまり（mainHud）。
// 値の単位の言い換え（秒速◯cm→時速◯km など）と、比較の札の文言は作品ごとに違うので、作品の story.mjs に書く。
import { clamp } from "./mvscene.mjs";

// 数の書き方：3桁ごとのカンマ／10未満は小数1桁
export const comma = (x) => Math.round(x).toLocaleString("en-US");
export const short = (x) => (x < 10 ? x.toFixed(1) : comma(x));

// v0：はじめの値　every：何秒ごとに2倍か　cap：これ以上は増えない上限（無ければ省く）
// maxSteps：2倍になる回数の上限。省くと cap から決める（v0 × 2^n が cap を初めて超える n）
export const makeDoubling = ({ v0, every, cap = Infinity, maxSteps }) => {
  const MAXN = maxSteps ?? (Number.isFinite(cap) ? Math.ceil(Math.log2(cap / v0)) : Infinity);
  const STEP = every;
  // 物語の t 秒までに、何回2倍になったか（0〜MAXN）
  const stepOf = (t) => clamp(Math.floor(t / STEP + 1e-9), 0, MAXN);
  // 物語の t 秒の値（物語が始まる前は v0）
  const speedAt = (t) => Math.min(cap, v0 * 2 ** stepOf(Math.max(0, t)));
  // 物語の t 秒までに進んだ距離（値を速さとみなして積み上げる）。物語が始まる前も v0 で進んでいる
  const distance = (t) => {
    if (t <= 0) return v0 * t;
    const n = stepOf(t);
    let d = 0;
    for (let k = 0; k < n; k++) d += v0 * 2 ** k * STEP;
    return d + v0 * 2 ** n * (t - n * STEP);
  };
  // ×の札（×2、×1,024、×3.3万、×85.9億）
  const badgeOf = (n) => { const x = 2 ** n; return "×" + (x < 1e4 ? comma(x) : x < 1e8 ? short(x / 1e4) + "万" : short(x / 1e8) + "億"); };
  // 2倍になった直後の 0.25 秒だけ、札を少し大きくする
  const badgeScale = (t) => { const n = stepOf(Math.max(0, t)), since = t - n * STEP; return n >= 1 && since < 0.25 ? Math.round((1 + 0.3 * (1 - since / 0.25) ** 2) * 1000) / 1000 : 1; };
  return { v0, STEP, MAXN, cap, stepOf, speedAt, distance, badgeOf, badgeScale };
};

// 画面左上の数字のかたまり（hud.json の main）。label は「速さ」「数」など、valueOf(n) は [値, 単位] を返す
export const mainHud = (d, t, { label, valueOf, countUnit = "秒目" }) => {
  const n = d.stepOf(Math.max(0, t));
  const [value, unit] = valueOf(n);
  return { count: String(Math.floor(t + 1e-9) + 1), countUnit, label, value, unit, badge: d.badgeOf(n), badgeScale: d.badgeScale(t), a: Math.round(clamp(t / 0.4) * 100) / 100 };
};
