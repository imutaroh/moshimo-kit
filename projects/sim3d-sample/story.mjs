// この動画だけの設定。仕組みは kinds/sim3d/lib/context.mjs（決められる項目の一覧も、そのファイルの頭にある）。
// 書き換える所：題（title）、左上の数字の名前と単位（counter）、比較の札（pills）、揺れ（shake・fovKick）
import { comma } from "../../kinds/sim3d/lib/doubling.mjs";

// 題を行に分ける：「、」で切り、13文字を超える行は、半分より後ろの「が・に・を・は」の後で切る
const splitTitle = (title) => title.split(/(?<=[、，])/).flatMap((line) => {
  if (line.length <= 13) return [line];
  const at = [...line].findIndex((c, i) => i >= line.length / 2 - 2 && "がにをは".includes(c));
  return at > 0 && at < line.length - 1 ? [line.slice(0, at + 1), line.slice(at + 1)] : [line];
});

export default (ep) => ({
  // 冒頭の大きな題。episode.json の title を「、」で行に分ける。強調したい語は { t: "語", accent: true } にする
  title: { lines: splitTitle(ep.title).map((s) => [{ t: s }]), sub: null },
  // 2倍になる回数の上限。v0 × 2^5 = 32 個で止める（上限が無いなら maxSteps を消す）
  // 台本の秒を変えたら、ここも直す（物語の長さ ÷ 2倍の間隔。あふれる瞬間 BURST ＝ 2倍の間隔 × maxSteps は、幕と音がここから計算する）
  doubling: { maxSteps: 5 },
  // 左上の数字：n は2倍になった回数。[値, 単位] を返す
  counter: { label: "リンゴの数", valueOf: (n) => [comma(ep.story.v0 * 2 ** n), "個"] },
  // 比較の札：2倍になった回数 → 文言（無い回は出ない）。台本の秒を変えたら、ここも直す（回数）
  pills: { 0: "ふつうの机", 3: "ひと袋ぶん", 4: "机がいっぱい", 5: "あふれた" },
  // 揺れ：3回目から少しずつ大きく。0 なら揺らさない（衝撃 ctx.hit の揺れは別に足される）
  shake: (ctx, f, t) => { const n = ctx.stepOf(Math.max(0, t)); return t >= 0 && n >= 3 ? 0.002 * (n - 2) : 0; },
  // 2倍になった瞬間に、画角を少し狭めて戻す（揺れているコマだけに効く）
  fovKick: (ctx, f, t) => { const n = ctx.stepOf(Math.max(0, t)); return n >= 1 ? 1 - 0.03 * Math.exp(-10 * (t - n * ctx.STEP)) : null; },
});
