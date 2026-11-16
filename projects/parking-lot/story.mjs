// この動画だけの設定。仕組みは kinds/sim3d/lib/context.mjs（決められる項目の一覧も、そのファイルの頭にある）。
import { comma } from "../../kinds/sim3d/lib/doubling.mjs";

// 題を行に分ける：「、」で切り、13文字を超える行は、半分より後ろの「が・に・を・は」の後で切る
const splitTitle = (title) => title.split(/(?<=[、，])/).flatMap((line) => {
  if (line.length <= 13) return [line];
  const at = [...line].findIndex((c, i) => i >= line.length / 2 - 2 && "がにをは".includes(c));
  return at > 0 && at < line.length - 1 ? [line.slice(0, at + 1), line.slice(at + 1)] : [line];
});

export default (ep) => ({
  title: { lines: splitTitle(ep.title).map((s) => [{ t: s }]), sub: null },
  // 1台 × 2^5 = 32台で止める
  doubling: { maxSteps: 5 },
  counter: { label: "車の数", valueOf: (n) => [comma(ep.story.v0 * 2 ** n), "台"] },
  // 比較の札：区画は16（set.mjs）。8台で半分、16台で満車
  pills: { 0: "がらがら", 3: "区画の半分", 4: "満車", 5: "満車の2倍" },
  shake: (ctx, f, t) => { const n = ctx.stepOf(Math.max(0, t)); return t >= 0 && n >= 3 ? 0.002 * (n - 2) : 0; },
  fovKick: (ctx, f, t) => { const n = ctx.stepOf(Math.max(0, t)); return n >= 1 ? 1 - 0.03 * Math.exp(-10 * (t - n * ctx.STEP)) : null; },
});
