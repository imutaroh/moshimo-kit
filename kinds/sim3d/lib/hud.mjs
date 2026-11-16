// 画面の文字の見た目（位置・大きさ・色）。既定値は hud-defaults.json。
// 作品の episode.json の hud には、変えたい所だけを書く（深くたどって上書きする）。
//   node kinds/sim3d/lib/hud.mjs <作品の episode.json> <出力先>
// で、hud を「既定値＋作品の上書き」にした episode.json を書く（render.sh が書き出し用のフォルダに置く。再生機はこれを読む）。
// fontSans / fontMono の「assets/fonts/…」は、書き出し用のフォルダの fonts/ を指す決まり（再生機の Hud.ts が assets/ を外す）。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HUD_DEFAULTS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "hud-defaults.json"), "utf8"));
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
export const mergeDeep = (base, over) => {
  if (!isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base?.[k]) ? mergeDeep(base[k], v) : v;
  return out;
};
export const withHud = (ep) => ({ ...ep, hud: mergeDeep(HUD_DEFAULTS, ep.hud ?? {}) });

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) { console.error("node kinds/sim3d/lib/hud.mjs <episode.json> <出力先>"); process.exit(1); }
  writeFileSync(dst, JSON.stringify(withHud(JSON.parse(readFileSync(src, "utf8"))), null, 2) + "\n");
}
