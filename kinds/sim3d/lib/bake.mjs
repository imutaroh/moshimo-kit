// 台本から全コマの数値を計算する入口。
//   node kinds/sim3d/lib/bake.mjs projects/<ID>
//
// 作品のフォルダの episode.json（台本）と story.mjs（作品の設定。無くてもよい）を読み、
// episode.json の acts の順に acts/<幕>.mjs を呼んで、baked/ に scene.json・tracks.bin・hud.json を書く。
//   SIM3D_ONLY=<幕>       その幕だけ作る（ほかの範囲は黒い仮のカットになる）。試し撮り用
//   SIM3D_BAKED=<フォルダ> 計算結果の出力先を変える（既定は projects/<ID>/baked/）。試し撮りが本番の結果を上書きしないように
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { makeContext, bakedDir } from "./context.mjs";

const dir = resolve(process.argv[2] ?? "");
if (!existsSync(join(dir, "episode.json"))) { console.error(`台本が無い: ${join(dir, "episode.json")}\n  node kinds/sim3d/lib/bake.mjs projects/<ID>`); process.exit(1); }
const ep = JSON.parse(readFileSync(join(dir, "episode.json"), "utf8"));
const cfgFile = join(dir, "story.mjs");
// story.mjs の default export は、設定の値か、ep を受け取って設定を返す関数
const mod = existsSync(cfgFile) ? (await import(pathToFileURL(cfgFile).href)).default : {};
const cfg = typeof mod === "function" ? mod(ep) : mod;
const ctx = makeContext(ep, cfg);
const only = process.env.SIM3D_ONLY;
if (only && !(only in (ep.acts ?? {}))) { console.error(`幕が無い: ${only}（episode.json の acts: ${Object.keys(ep.acts ?? {}).join(" ")}）`); process.exit(1); }
for (const act of Object.keys(ep.acts ?? {})) {
  if (only && only !== act) continue;
  const file = join(dir, "acts", `${act}.mjs`);
  if (!existsSync(file)) { console.log(`（${act} はまだ無い）`); continue; }
  (await import(pathToFileURL(file).href)).default(ctx);
}
const stat = ctx.finish(bakedDir(dir));
console.log(`コマ ${ctx.N}（${ctx.N / ctx.FPS}秒） 物体 ${stat.objects} 部品 ${stat.parts} 数値 ${(stat.floats * 4 / 1e6).toFixed(1)}MB${only ? `  ※ ${only} だけ` : ""}`);
