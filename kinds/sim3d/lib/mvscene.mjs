// 場面データ（mvscene/1）を組み立てて書き出す道具。lib/bake.mjs と、作品の幕（acts/*.mjs）から使う。
// 形式の説明は kinds/sim3d/docs/FORMAT.md。座標は x=右, y=上, z=手前。単位はメートル。
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glbInfo } from "./glb.mjs";

// ---------- ベクトルと回転 ----------
export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; },
  lerp: (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k],
};
export const Q = {
  id: () => [0, 0, 0, 1],
  axis: (ax, ang) => { const a = V.norm(ax), s = Math.sin(ang / 2); return [a[0] * s, a[1] * s, a[2] * s, Math.cos(ang / 2)]; },
  mul: (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ],
  rot: (q, v) => { // ベクトルを回す
    const u = [q[0], q[1], q[2]], s = q[3];
    return V.add(V.add(V.mul(u, 2 * V.dot(u, v)), V.mul(v, s * s - V.dot(u, u))), V.mul(V.cross(u, v), 2 * s));
  },
  yaw: (ang) => Q.axis([0, 1, 0], ang),
  euler: (rx, ry, rz) => Q.mul(Q.mul(Q.axis([0, 1, 0], ry), Q.axis([1, 0, 0], rx)), Q.axis([0, 0, 1], rz)), // y → x → z の順
  // 3つの軸（物体の x・y・z が世界でどこを向くか）から回転を作る。カメラに貼りつく板などに使う
  fromBasis: (x, y, z) => {
    const tr = x[0] + y[1] + z[2];
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; return [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, 0.25 * s]; }
    if (x[0] > y[1] && x[0] > z[2]) { const s = Math.sqrt(1 + x[0] - y[1] - z[2]) * 2; return [0.25 * s, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s]; }
    if (y[1] > z[2]) { const s = Math.sqrt(1 + y[1] - x[0] - z[2]) * 2; return [(y[0] + x[1]) / s, 0.25 * s, (z[1] + y[2]) / s, (z[0] - x[2]) / s]; }
    const s = Math.sqrt(1 + z[2] - x[0] - y[1]) * 2;
    return [(z[0] + x[2]) / s, (z[1] + y[2]) / s, 0.25 * s, (x[1] - y[0]) / s];
  },
  // ローカル +y を dir に向ける（細長い物を進行方向へ寝かせるときに使う）
  fromY: (dir) => {
    const d = V.norm(dir), c = d[1];
    if (c > 0.9999) return [0, 0, 0, 1];
    if (c < -0.9999) return [1, 0, 0, 0];
    return Q.axis(V.cross([0, 1, 0], d), Math.acos(c));
  },
};
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ease = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// 位置・回転・拡大をまとめた「変換」。[px,py,pz, qx,qy,qz,qw, sx,sy,sz]
export const T = (pos = [0, 0, 0], quat = [0, 0, 0, 1], scale = [1, 1, 1]) =>
  [...pos, ...quat, ...(typeof scale === "number" ? [scale, scale, scale] : scale)];
// 親の変換 a の中に子の変換 b を置いたときの、世界での変換
export const compose = (a, b) => {
  const pa = a.slice(0, 3), qa = a.slice(3, 7), sa = a.slice(7, 10);
  const pb = b.slice(0, 3), qb = b.slice(3, 7), sb = b.slice(7, 10);
  const p = V.add(pa, Q.rot(qa, [pb[0] * sa[0], pb[1] * sa[1], pb[2] * sa[2]]));
  return [...p, ...Q.mul(qa, qb), sa[0] * sb[0], sa[1] * sb[1], sa[2] * sb[2]];
};

// ---------- 場面 ----------
export class Scene {
  constructor(video) {
    this.video = { ...video, frameCount: Math.round(video.fps * video.durationSec) };
    this.materials = new Map();
    this.objects = [];
    this.shots = [];
    this.bin = [];
    this.camera = new Array(this.video.frameCount).fill(null);
    this.ids = new Set();
  }
  get N() { return this.video.frameCount; }

  // 色の名前を返す。同じ設定は使い回す。emissive > 0 は光を受けず自分の色で光る
  mat(color, { emissive = 0, opacity = 1 } = {}) {
    const id = `${color}|${emissive}|${opacity}`;
    if (!this.materials.has(id)) this.materials.set(id, { id, color, emissive, opacity });
    return id;
  }

  // 物体を足す。parts = [{shape, material, t}]。返り値に .at() / .anim() で「いつ・どこに居るか」を足していく
  add(id, parts) {
    let unique = id, k = 2;
    while (this.ids.has(unique)) unique = `${id}#${k++}`;
    this.ids.add(unique);
    const scene = this;
    const obj = {
      id: unique, parts, segments: [], opacity: [], clips: [],
      // 素材に入っている動き（歩く・座るなど）を再生する。fn(f) は、その動きの中の何秒目かを返す。
      // fade コマかけて、直前の動きからなめらかに切り替える
      clip(from, to, name, fn = (f) => (f - from) / scene.video.fps, fade = 4) {
        if (to < from) return obj;
        const o = scene.bin.length;
        for (let f = from; f <= to; f++) scene.bin.push(fn(f));
        obj.clips.push({ from, to, clip: name, o, fade });
        return obj;
      },
      // from〜to のコマのあいだ、同じ場所に置く
      at(from, to, t = T()) { if (to >= from) obj.segments.push({ from, to, t: t.map(round5) }); return obj; },
      // from〜to のコマのあいだ、コマごとに fn(f) の変換で動かす
      anim(from, to, fn) {
        if (to < from) return obj;
        const o = scene.bin.length;
        for (let f = from; f <= to; f++) scene.bin.push(...fn(f));
        obj.segments.push({ from, to, o });
        return obj;
      },
      // 透明度をコマごとに変える（0〜1。素材の透明度に掛ける）
      fade(from, to, fn) {
        const o = scene.bin.length;
        for (let f = from; f <= to; f++) scene.bin.push(fn(f));
        obj.opacity.push({ from, to, o });
        return obj;
      },
    };
    this.objects.push(obj);
    return obj;
  }

  // カット（カメラが切り替わる単位）。背景色と光を決める
  shot(name, from, to, look) {
    this.shots.push({ name, from, to, ...look });
    return { from, to };
  }
  // カメラをコマごとに決める。fn(f, k) は {pos, target, fov, up?} を返す（k は 0〜1 の進み具合）
  cam(from, to, fn) {
    for (let f = from; f <= to; f++) {
      const c = fn(f, to > from ? (f - from) / (to - from) : 0);
      this.camera[f] = [...c.pos, ...c.target, ...(c.up || [0, 1, 0]), c.fov];
    }
  }
  // 世界の点を画面の px に写す（名札や吹き出しの位置決めに使う）
  project(f, p) {
    const c = this.camera[f];
    const pos = c.slice(0, 3), fw = V.norm(V.sub(c.slice(3, 6), pos));
    const right = V.norm(V.cross(fw, c.slice(6, 9))), up = V.cross(right, fw);
    const d = V.sub(p, pos), depth = V.dot(d, fw), tan = Math.tan((c[9] * Math.PI) / 360);
    const { width: W, height: H } = this.video;
    return { x: (1 + V.dot(d, right) / (depth * tan * (W / H))) / 2 * W, y: (1 - V.dot(d, up) / (depth * tan)) / 2 * H, depth };
  }

  write(dir, hudFrames) {
    for (let f = 0; f < this.N; f++) if (!this.camera[f]) throw new Error(`カメラが決まっていないコマ: ${f}`);
    const covered = new Array(this.N).fill(0);
    for (const s of this.shots) for (let f = s.from; f <= s.to; f++) covered[f]++;
    const bad = covered.findIndex((c) => c !== 1);
    if (bad >= 0) throw new Error(`カットの抜けか重なり: コマ ${bad}`);
    const camO = this.bin.length;
    for (const c of this.camera) this.bin.push(...c);
    const objects = this.objects.filter((o) => o.segments.length).map((o) => ({
      id: o.id,
      parts: o.parts.map((p) => ({ shape: p.shape, ...(p.src ? { src: p.src } : { material: p.material }), t: p.t.map(round5) })),
      segments: o.segments.sort((a, b) => a.from - b.from),
      ...(o.opacity.length ? { opacity: o.opacity } : {}),
      ...(o.clips.length ? { clips: o.clips.sort((a, b) => a.from - b.from) } : {}),
    }));
    const models = [...new Set(objects.flatMap((o) => o.parts.filter((p) => p.src).map((p) => p.src)))].sort();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "tracks.bin"), Buffer.from(new Float32Array(this.bin).buffer));
    writeFileSync(join(dir, "scene.json"), JSON.stringify({
      format: "mvscene/1", video: this.video,
      materials: [...this.materials.values()],
      models, objects, camera: { o: camO }, shots: this.shots,
    }));
    writeFileSync(join(dir, "hud.json"), JSON.stringify({ fps: this.video.fps, frameCount: this.N, frames: hudFrames }));
    return { objects: objects.length, parts: objects.reduce((s, o) => s + o.parts.length, 0), floats: this.bin.length, materials: this.materials.size };
  }
}
const round5 = (x) => Math.round(x * 1e5) / 1e5;

// ---------- 素材（3D モデル） ----------
// 素材を、指定の大きさに合わせて置く部品を作る。src は shared/ からの道（例 "models/kenney/food-kit/sushi-egg.glb"）
//   h / w / d のどれか：高さ・幅・奥行きがその長さ（m）になるように拡大する。k を渡せば倍率をそのまま使う
//   pos：素材の「底の中心」を置く場所。feet: true のときは、素材の原点（人物の足もと）を置く
export const model = (src, { h, w, d, k, pos = [0, 0, 0], quat = [0, 0, 0, 1], feet = false } = {}) => {
  const info = glbInfo(src);
  const scale = k ?? (h ? h / info.size[1] : w ? w / info.size[0] : d ? d / info.size[2] : 1);
  const base = feet ? [0, 0, 0] : [(info.min[0] + info.max[0]) / 2, info.min[1], (info.min[2] + info.max[2]) / 2];
  return { shape: "model", src, t: T(V.sub(pos, Q.rot(quat, V.mul(base, scale))), quat, scale) };
};
export { glbInfo };

// ---------- 形を作る近道 ----------
export const part = (shape, material, pos, scale, quat = [0, 0, 0, 1]) => ({ shape, material, t: T(pos, quat, scale) });
export const box = (material, pos, size, quat) => part("box", material, pos, size, quat);
// 円柱：半径 r・高さ h（軸は y）
export const cyl = (material, pos, r, h, quat) => part("cyl", material, pos, [r, h, r], quat);
export const sphere = (material, pos, r) => part("sphere", material, pos, typeof r === "number" ? [r, r, r] : r);
export const cone = (material, pos, r, h, quat) => part("cone", material, pos, [r, h, r], quat);
// 輪：大きい半径 R（管の太さは R の 8%）。軸は y
export const torus = (material, pos, R, quat) => part("torus", material, pos, [R, R, R], quat);
