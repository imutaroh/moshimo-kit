// 3D 素材（.glb）の中身を読む。台本（bake.mjs）で「この素材を高さ 3cm で置く」と書けるように、
// 素材のもとの大きさ（外接する箱）と、入っている動きの名前・長さを取り出す。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// 素材の置き場所はリポジトリ直下の shared/（この lib から見て ../../../shared）
export const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "shared");
const cache = new Map();

const mul = (a, b) => { // 4x4 行列（列優先の16個）の積
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const trs = (n) => {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
};
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// src は shared/ からの道（publicDir からの道と同じ）（例 "models/kenney/food-kit/sushi-egg.glb"）
// 返り値：{ min, max, size, clips: { 名前: 長さ（秒） } }。骨で動く人物の箱は、動かす前の姿勢での値
export const glbInfo = (src) => {
  if (cache.has(src)) return cache.get(src);
  const buf = readFileSync(join(ASSETS, src));
  if (buf.toString("ascii", 0, 4) !== "glTF") throw new Error(`glb ではない: ${src}`);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const visit = (index, parent) => {
    const node = json.nodes[index], world = mul(parent, trs(node));
    if (node.mesh !== undefined) {
      for (const prim of json.meshes[node.mesh].primitives) {
        const acc = json.accessors[prim.attributes.POSITION];
        if (!acc?.min || !acc?.max) continue;
        // 骨で動くメッシュは、ノードの変換が効かない（骨が決める）ので、そのままの値を使う
        const m = node.skin !== undefined ? IDENT : world;
        for (let i = 0; i < 8; i++) {
          const p = [i & 1 ? acc.max[0] : acc.min[0], i & 2 ? acc.max[1] : acc.min[1], i & 4 ? acc.max[2] : acc.min[2]];
          for (let a = 0; a < 3; a++) { const v = m[a] * p[0] + m[4 + a] * p[1] + m[8 + a] * p[2] + m[12 + a]; min[a] = Math.min(min[a], v); max[a] = Math.max(max[a], v); }
        }
      }
    }
    for (const child of node.children || []) visit(child, world);
  };
  for (const root of json.scenes[json.scene ?? 0].nodes) visit(root, IDENT);
  const clips = {};
  for (const anim of json.animations || []) {
    let length = 0;
    for (const s of anim.samplers) length = Math.max(length, json.accessors[s.input].max?.[0] ?? 0);
    clips[anim.name] = length;
  }
  const info = { min, max, size: max.map((v, a) => v - min[a]), clips };
  cache.set(src, info);
  return info;
};
