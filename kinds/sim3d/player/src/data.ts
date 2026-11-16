// 場面データ（mvscene/1、kinds/sim3d/docs/FORMAT.md）を読み込む。
// kinds/sim3d/render.sh が、書き出し用のフォルダ（out/.public/<ID>/）の episode/ に作品のファイルを置く。
// 再生機のページ（index.html）はそのフォルダの直下にあるので、ページからの相対の道で引く。
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// 書き出し用のフォルダの中の道（fonts/…・models/…・episode/…）を、ページから引ける URL にする
export const assetUrl = (path: string) => `./${path}`;

export type Transform = number[]; // [px,py,pz, qx,qy,qz,qw, sx,sy,sz]
export type Material = { id: string; color: string; emissive: number; opacity: number };
// shape が "model" の部品は、src（書き出し用のフォルダからの道）の 3D 素材（.glb）を置く。material は無い
export type Part = { shape: "box" | "cyl" | "cone" | "sphere" | "torus" | "model"; material?: string; src?: string; t: Transform };
export type Segment = { from: number; to: number; t?: Transform; o?: number };
export type OpacityTrack = { from: number; to: number; o: number };
// 素材に入っている動きの再生。tracks[o + (f - from)] が、その動きの中の何秒目か。fade コマかけて直前の動きから切り替える
export type ClipTrack = { from: number; to: number; clip: string; o: number; fade: number };
export type SceneObject = { id: string; parts: Part[]; segments: Segment[]; opacity?: OpacityTrack[]; clips?: ClipTrack[] };
export type Shot = {
  name: string;
  from: number;
  to: number;
  background: string;
  sun: { from: [number, number, number]; color: string; intensity: number };
  ambient: { color: string; intensity: number };
  shadows: boolean;
  shadowExtent: number;
  fog?: { color: string; near: number; far: number }; // 遠くをかすませる（空気のもや）
  post?: { ao?: number; bloom?: number; focus?: number; aperture?: number }; // 継ぎ目の陰・光のにじみ・ぼけ
};
export type VideoSpec = { width: number; height: number; fps: number; durationSec: number; frameCount: number };
export type SceneJson = {
  format: string;
  video: VideoSpec;
  materials: Material[];
  models?: string[];
  objects: SceneObject[];
  camera: { o: number };
  shots: Shot[];
};

// hud.json の frames[f]。null の項目は描かない。a は不透明度
type A = { a: number };
export type HudFrame = {
  f: number;
  title: ({ lines: { t: string; accent?: boolean }[][]; sub?: string | null } & A) | null;
  clock: ({ label: string; text: string } & A) | null;
  main:
    | ({ count: string; countUnit: string; label: string; value: string; unit: string; badge: string | null; badgeScale: number } & A)
    | null;
  pill: ({ text: string } & A) | null;
  caption: ({ lines: string[] } & A) | null;
  tags: ({ text: string; x: number; y: number } & A)[] | null;
  bubbles: ({ text: string; x: number; y: number } & A)[] | null;
  card: ({ lines: string[]; small?: string[] | null } & A) | null;
  note: ({ text: string } & A) | null;
  black: number | null;
};

// episode.json の hud（位置は px）
type Box = { paddingX: number; paddingY: number; radius: number };
export type HudStyle = {
  fontSans: string;
  fontMono: string;
  text: string;
  ink: string;
  panel: string;
  accent: string;
  shadow: { blurPx: number; offsetY: number; color: string };
  topShade: { height: number; color: string };
  title: { centerX: number; y: number; fontPx: number; lineHeight: number; sub: { fontPx: number; gap: number } };
  clock: { centerX: number; y: number; labelPx: number; textPx: number; gap: number };
  main: {
    x: number;
    tag: { text: string; y: number; fontPx: number } & Box;
    count: { y: number; fontPx: number; unitPx: number; unitGap: number };
    label: { y: number; fontPx: number };
    value: { y: number; fontPx: number; unitPx: number; unitGap: number };
    badge: { rightX: number; y: number; fontPx: number } & Box;
  };
  pill: { x: number; y: number; fontPx: number } & Box;
  caption: { centerX: number; centerY: number; fontPx: number; lineHeight: number } & Box;
  tag: { fontPx: number; stemPx: number } & Box;
  bubble: { fontPx: number; stemPx: number } & Box;
  card: {
    centerX: number;
    centerY: number;
    fontPx: number;
    lineHeight: number;
    smallPx: number;
    smallGap: number;
    smallLineHeight: number;
    smallColor: string;
  };
  noteText: { centerX: number; y: number; fontPx: number; color: string };
};
export type EpisodeJson = { id: string; format?: string; video: Omit<VideoSpec, "frameCount">; hud: HudStyle };

export type Loaded = { episode: EpisodeJson; scene: SceneJson; tracks: Float32Array; hud: { frames: HudFrame[] }; models: Map<string, GLTF> };

const getJson = async <T,>(path: string): Promise<T> => {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new Error(`読めない: ${path} (${res.status})`);
  return (await res.json()) as T;
};

// 1つのタブで1回だけ読む（コマごとに読み直さない）
let cache: Promise<Loaded> | null = null;
export const loadEpisode = (): Promise<Loaded> => {
  if (!cache) {
    cache = (async () => {
      const [episode, scene, hud, buf] = await Promise.all([
        getJson<EpisodeJson>("episode/episode.json"),
        getJson<SceneJson>("episode/scene.json"),
        getJson<{ frames: HudFrame[] }>("episode/hud.json"),
        fetch(assetUrl("episode/tracks.bin")).then((r) => {
          if (!r.ok) throw new Error(`読めない: tracks.bin (${r.status})`);
          return r.arrayBuffer();
        }),
      ]);
      if (scene.format !== "mvscene/1") throw new Error(`形式が違う: ${scene.format}`);
      // 3D 素材。kinds/sim3d/render.sh が shared/models を書き出し用のフォルダの models/ に置く
      const loader = new GLTFLoader();
      const models = new Map<string, GLTF>();
      await Promise.all((scene.models ?? []).map(async (src) => models.set(src, await loader.loadAsync(assetUrl(src)))));
      return { episode, scene, hud, tracks: new Float32Array(buf), models };
    })();
  }
  return cache;
};

