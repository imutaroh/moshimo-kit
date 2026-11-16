// 再生機の入口。HyperFrames が1コマ撮るたびに出す「hf-seek」の知らせ（その時刻）を受けて、そのコマの 3D と HUD を描く。
// 描くコマは、時刻×fps に、書き出す範囲の先頭のコマ（data-start-frame）を足したもの。
// 場面データ・3D 素材・フォントを読み終えるまでは、window.__hf.buildReady で HyperFrames に撮影を待たせる。
import { loadEpisode } from "./data";
import { createHud, loadFonts } from "./Hud";
import { createStage } from "./Player";

type HfSeek = CustomEvent<{ time: number }>;
type HfWindow = Window & { __hf?: { buildReady?: Record<string, Promise<unknown>> }; __hfStartupError?: string };

const root = document.getElementById("root")!;
const canvas = document.getElementById("gl") as HTMLCanvasElement;
const hudEl = document.getElementById("hud")!;
const fps = Number(root.dataset.fps);
const startFrame = Number(root.dataset.startFrame ?? 0);

let lastTime = 0;
let draw: ((f: number) => void) | null = null;
const frameAt = (t: number) => startFrame + Math.round(t * fps);

// 同じ時刻への移動では知らせが来ないので、読み終えたときに「いまの時刻」のコマを描き直す
window.addEventListener("hf-seek", (e) => {
  lastTime = (e as HfSeek).detail.time;
  draw?.(frameAt(lastTime));
});

const ready = (async () => {
  const data = await loadEpisode();
  await loadFonts(data.episode.hud);
  const { width, height, frameCount } = data.scene.video;
  const stage = createStage(canvas, data, width, height);
  const hud = createHud(hudEl, data.episode.hud, data.hud.frames, width);
  draw = (f) => {
    const g = Math.min(Math.max(f, 0), frameCount - 1);
    stage.draw(g);
    hud.draw(g);
  };
  draw(frameAt(lastTime));
})();
const w = window as HfWindow;
ready.catch((err) => {
  // 読めないまま撮らせない（黒い動画が出来てしまう）。HyperFrames は window.__hfStartupError に文字が入ると、書き出しを失敗で止める
  w.__hfStartupError = `再生機の読み込みに失敗した（3D 素材・場面データ・フォントのどれかが読めない）: ${err instanceof Error ? err.message : String(err)}`;
  console.error("[mvscene] 読み込みに失敗:", err);
});
w.__hf ??= {};
w.__hf.buildReady ??= {};
w.__hf.buildReady.mvscene = ready;
