// 回転寿司の店の部品（店のセット）。寸法と、素材の置き方をここにまとめる。幕（acts/）のスクリプトはここから取って使う。
// 素材の道・人物・小物の置き方は作品に依らないので kinds/sim3d/lib/assets.mjs にあり、ここから同じ名前で出し直している。
// 絵柄は「三頭身の人物に合わせたジオラマ」。人物が頭でっかちなので、皿や寿司は現実より大きめに作る（PROP 倍）。
// 座標：x=右、y=上、z=手前。客はカウンターに沿って x 方向に並び、奥（-z）を向いて座る。レーンは x 方向に流れる。
import { Q, T, box, cyl, sphere, model, rng } from "../../kinds/sim3d/lib/mvscene.mjs";
import { food, furn } from "../../kinds/sim3d/lib/assets.mjs";

// ---------- 素材の道・人物・小物（lib から） ----------
export { food, furn, chara, car, city, person, itemPart, K } from "../../kinds/sim3d/lib/assets.mjs";

// ---------- 寸法 ----------
export const PROP = 1.55;          // 小物の拡大率
export const SIT_Y = 0.42;         // 椅子に座らせるとき、人物を持ち上げる量（clip "sit" と組で使う）
export const KITCHEN_Y = 0.4;      // 厨房の床の高さ（一段高い）
export const ROOM = { x: [-5, 5], z: [-2.4, 3.3], h: 3.0 };          // 店内の広さ
export const DOOR = { x: [3.0, 4.2], h: 2.2 };                       // 出口（手前の壁 z=ROOM.z[1] にある）
export const WINDOWS = [[-4.2, -2.4], [-1.8, 0.0], [0.6, 2.4]];      // 手前の壁の窓（x の範囲）
export const WIN_Y = [1.0, 2.4];
export const COUNTER_Y = 0.93, COUNTER_Z = [0.05, 0.5];              // 客席側のカウンター
export const LANE_Y = 0.97, LANE_Z = -0.17, LANE_W = 0.3;            // レーン（上面の高さ、中心の z、幅）
export const SEAT_Z = 1.02, SEATS = [-3.1, -1.86, -0.62, 0.62, 1.86, 3.1]; // 席の x。ヤマダは SEATS[YAMADA_SEAT]
export const YAMADA_SEAT = 3;
export const PREP_Y = 0.92, PREP_Z = -0.78;                          // 厨房の作業台
export const CHEF_POS = [-0.6, KITCHEN_Y, -1.3];
export const WOOD = "#B98A55", WOOD_DARK = "#7A5230", WOOD_LIGHT = "#D9B382", CREAM = "#F1E6D2", STEEL = "#C5CAD1";
const HX = ROOM.x[1], WALL_Z = ROOM.z[0], CEIL_Y = ROOM.h;
const SUSHI = ["sushi-salmon", "maki-roe", "sushi-salmon", "maki-salmon", "maki-vegetable"];

// ---------- 人物 ----------
// 人物は person(sc, id, look)（lib/assets.mjs）。席 i に座っているときの置き場所
export const seatT = (i) => T([SEATS[i], SIT_Y, SEAT_Z], Q.yaw(Math.PI));

// ---------- 皿 ----------
// 皿1枚の部品。kind は food-kit の名前（"sushi-salmon" "sushi-egg" "maki-roe" など）。null なら空の皿
export const plateParts = (kind, two = true) => {
  const parts = [model(food("plate"), { w: 0.168 * PROP })];
  if (!kind) return parts;
  const size = (kind.startsWith("maki") ? 0.045 : 0.075) * PROP;
  for (const s of two ? [-1, 1] : [0]) parts.push(model(food(kind), { d: size, pos: [s * 0.032 * PROP, 0.012 * PROP, 0], quat: Q.yaw(Math.PI / 2) }));
  return parts;
};
export const sushiKind = (i) => SUSHI[i % SUSHI.length];

// ---------- 店の動かない部分 ----------
// 壁・床・天井・棚など。m は色の関数（(色, 設定) => 素材）
export const shellParts = (m) => {
  const r = rng(11), p = [];
  for (let i = 0; i < 40; i++) p.push(box(m(i % 3 === 0 ? "#B7925F" : i % 3 === 1 ? "#C29C68" : "#AD8856"), [-HX + 0.125 + i * 0.25, -0.03, 0.45], [0.245, 0.06, ROOM.z[1] - ROOM.z[0]]));
  // 奥の壁：下は板張り、上は塗り壁
  p.push(box(m(CREAM), [0, CEIL_Y / 2, WALL_Z - 0.1], [HX * 2, CEIL_Y, 0.2]));
  for (let i = 0; i < 25; i++) p.push(box(m(i % 2 ? "#8A5E37" : "#946740"), [-HX + 0.2 + i * 0.4, 0.55, WALL_Z + 0.015], [0.39, 1.1, 0.03]));
  p.push(box(m(WOOD_DARK), [0, 1.12, WALL_Z + 0.03], [HX * 2, 0.05, 0.06]));
  // 左右の壁
  for (const sx of [-1, 1]) p.push(box(m(CREAM), [sx * (HX + 0.1), CEIL_Y / 2, 0.45], [0.2, CEIL_Y, ROOM.z[1] - ROOM.z[0] + 0.4]));
  // 奥の棚：吊り戸棚、棚板、瓶、せいろ、冷蔵庫、植木、品書き
  for (let i = 0; i < 9; i++) p.push(model(furn(i % 2 ? "kitchenCabinetUpper" : "kitchenCabinetUpperDouble"), { w: 0.88, pos: [-4 + i * 1.0, 1.9, WALL_Z + 0.2] }));
  p.push(box(m(WOOD), [0, 1.42, WALL_Z + 0.16], [HX * 2 - 1.4, 0.04, 0.3]));
  p.push(model(furn("kitchenFridgeLarge"), { h: 1.9, pos: [-4.55, KITCHEN_Y, WALL_Z + 0.45] }), model(furn("pottedPlant"), { h: 1.2, pos: [4.5, 0, WALL_Z + 0.5] }));
  for (let i = 0; i < 7; i++) p.push(box(m(["#F7F2E4", "#E9C46A", "#F7F2E4", "#D7263D"][i % 4]), [-3.6 + i * 1.2, 2.55, WALL_Z + 0.02], [0.9, 0.34, 0.03]), box(m("#3A2E24"), [-3.6 + i * 1.2, 2.55, WALL_Z + 0.04], [0.6, 0.05, 0.01]));
  // 厨房：一段高い床、作業台とその上の物
  p.push(box(m("#8E9299"), [0, KITCHEN_Y / 2, -1.6], [HX * 2, KITCHEN_Y, 1.5]));
  p.push(box(m(STEEL), [0, PREP_Y / 2 - 0.01, PREP_Z], [HX * 2, PREP_Y - 0.02, 0.5]), box(m("#DCE0E5"), [0, PREP_Y - 0.01, PREP_Z], [HX * 2, 0.02, 0.52]));
  const onPrep = (src, x, z, opt = {}) => p.push(model(src, { pos: [x, PREP_Y, z], ...opt }));
  for (let i = -3; i <= 3; i++) {
    const x = i * 1.35 + 0.2;
    onPrep(food("cutting-board-japanese"), x, -0.72, { d: 0.42, quat: Q.yaw(Math.PI / 2) });
    onPrep(food(i % 2 ? "fish" : "rice-ball"), x - 0.02, -0.72, i % 2 ? { d: 0.3, quat: Q.yaw(Math.PI / 2 + 0.2) } : { h: 0.07 });
    onPrep(food("cooking-knife"), x + 0.32, -0.7, { w: 0.24, quat: Q.yaw(0.5) });
    onPrep(food("bowl-broth"), x - 0.42, -0.86, { w: 0.2 });
    onPrep(food(["sushi-salmon", "maki-salmon", "maki-roe"][(i + 3) % 3]), x + 0.5, -0.88, { d: 0.07 });
    onPrep(food("pot"), x - 0.75, -0.8, { w: 0.26 });
  }
  void r;
  return p;
};
// 天井と梁（真上から撮るカットでは外す）
export const ceilingParts = (m) => [box(m("#EDE3D0"), [0, CEIL_Y + 0.05, 0.45], [HX * 2, 0.1, ROOM.z[1] - ROOM.z[0]]), box(m(WOOD_DARK), [0, CEIL_Y - 0.08, LANE_Z], [HX * 2, 0.16, 0.12])];
// 手前の壁（窓と出口を残して埋める）。外からも中からも同じ物を使う
export const frontWallParts = (m) => {
  const z = ROOM.z[1] + 0.1, p = [], holes = [...WINDOWS.map((w) => [...w, WIN_Y[0], WIN_Y[1]]), [...DOOR.x, 0, DOOR.h]].sort((a, b) => a[0] - b[0]);
  let x = ROOM.x[0];
  for (const [a, b, y0, y1] of holes) {
    if (a > x) p.push(box(m(CREAM), [(x + a) / 2, CEIL_Y / 2, z], [a - x, CEIL_Y, 0.2]));
    if (y0 > 0) p.push(box(m(CREAM), [(a + b) / 2, y0 / 2, z], [b - a, y0, 0.2]));
    p.push(box(m(CREAM), [(a + b) / 2, (y1 + CEIL_Y) / 2, z], [b - a, CEIL_Y - y1, 0.2]));
    x = b;
  }
  p.push(box(m(CREAM), [(x + ROOM.x[1]) / 2, CEIL_Y / 2, z], [ROOM.x[1] - x, CEIL_Y, 0.2]));
  for (let i = 0; i < 4; i++) p.push(box(m(i % 2 ? "#FAFAFA" : "#D7263D"), [DOOR.x[0] + 0.15 + i * 0.3, DOOR.h - 0.22, z + 0.12], [0.29, 0.44, 0.03])); // のれん
  return p;
};
// 窓ガラス1枚ぶん（i は WINDOWS の番号）。割れる演出のために、1枚ずつ別の物体にできるよう分けてある
export const windowGlassPart = (m, i) => box(m("#BFE3F2", { opacity: 0.35 }), [(WINDOWS[i][0] + WINDOWS[i][1]) / 2, (WIN_Y[0] + WIN_Y[1]) / 2, ROOM.z[1] + 0.1], [WINDOWS[i][1] - WINDOWS[i][0], WIN_Y[1] - WIN_Y[0], 0.04]);
// カウンター（天板・前板・足かけ）
export const counterParts = (m) => [
  box(m(WOOD_LIGHT), [0, COUNTER_Y - 0.025, (COUNTER_Z[0] + COUNTER_Z[1]) / 2], [HX * 2, 0.05, COUNTER_Z[1] - COUNTER_Z[0]]),
  box(m(WOOD), [0, (COUNTER_Y - 0.05) / 2, COUNTER_Z[0] + 0.12], [HX * 2, COUNTER_Y - 0.05, 0.22]),
  box(m(STEEL), [0, 0.22, COUNTER_Z[1] + 0.02], [HX * 2, 0.03, 0.03]),
];
// レーン（台と縁）。ベルトの色は場面で変えたいので、別にしてある
export const laneBaseParts = (m) => [
  box(m(WOOD_DARK), [0, (LANE_Y - 0.02) / 2, LANE_Z], [HX * 2, LANE_Y - 0.02, LANE_W + 0.1]),
  ...[-1, 1].map((dz) => box(m("#E7E1D5"), [0, LANE_Y + 0.004, LANE_Z + dz * (LANE_W / 2 + 0.012)], [HX * 2, 0.03, 0.024])),
];
export const beltPart = (material) => box(material, [0, LANE_Y - 0.01, LANE_Z], [HX * 2, 0.02, LANE_W]);
// 棚の瓶（1本ずつ落とせるように、置き場所の一覧で返す）。[{src, h, pos, quat}]
export const shelfBottles = () => {
  const r = rng(23), names = ["soda-bottle", "wine-red", "wine-white", "bottle-oil", "bottle-ketchup", "bottle-musterd"], out = [];
  for (let i = 0; i < 34; i++) {
    const x = -4 + i * 0.24 + (r() - 0.5) * 0.04;
    if (i % 9 === 4) out.push({ src: food("steamer"), w: 0.26, pos: [x, 1.44, WALL_Z + 0.17], quat: Q.id() });
    else out.push({ src: food(names[Math.floor(r() * names.length)]), h: 0.24 + r() * 0.08, pos: [x, 1.44, WALL_Z + 0.12 + r() * 0.1], quat: Q.yaw(r() * 6) });
  }
  return out;
};
// 吊り照明の置き場所（1つずつ揺らせるように、一覧で返す）。吊り元は天井、灯りは y = ROOM.h - 0.86 あたり
export const LAMPS = [-4.4, -3.3, -2.2, -1.1, 0, 1.1, 2.2, 3.3, 4.4].map((x) => [x, CEIL_Y, 0.28]);
export const lampParts = (m) => [cyl(m("#3A2E24"), [0, -0.33, 0], 0.008, 0.5), model(furn("lampSquareCeiling"), { h: 0.3, pos: [0, -0.86, 0] }), sphere(m("#FFF1C9", { emissive: 1 }), [0, -0.84, 0], 0.05)];
// 席ごとの物の置き場所。[{kind: "cup"|"soy"|"chopstick"|"plate"|"eating", src, 置き方..., seat}]。動かしたい物は1つずつ物体にする
export const seatItems = () => {
  const r = rng(31), out = [], z = 0.3, eat = ["sushi-salmon", "maki-vegetable", "sushi-salmon", null, "maki-roe", "sushi-salmon"];
  SEATS.forEach((x, i) => {
    out.push({ seat: i, kind: "cup", src: food("cup-tea"), h: 0.095 * PROP, pos: [x + 0.26, COUNTER_Y, z + 0.06], quat: Q.yaw(0.6 + i) });
    out.push({ seat: i, kind: "soy", src: food("soy"), w: 0.085 * PROP, pos: [x - 0.02, COUNTER_Y, z - 0.12], quat: Q.id() });
    for (const d of [0, 0.022]) out.push({ seat: i, kind: "chopstick", src: food("chopstick"), d: 0.22 * PROP, pos: [x - 0.2 + d, COUNTER_Y, z + 0.1], quat: Q.yaw(0.25) });
    const stack = 2 + ((i * 3) % 5);
    for (let k = 0; k < stack; k++) out.push({ seat: i, kind: "plate", level: k, src: food("plate"), w: 0.165 * PROP, pos: [x - 0.4 + (r() - 0.5) * 0.012, COUNTER_Y + k * 0.016 * PROP, z - 0.08 + (r() - 0.5) * 0.012], quat: Q.id() });
    out.push({ seat: i, kind: "eating", src: food("plate"), w: 0.165 * PROP, pos: [x + 0.03, COUNTER_Y, z + 0.08], quat: Q.id(), sushi: eat[i] });
  });
  return out;
};
// seatItems / shelfBottles の1件を部品にするのは itemPart(it)（lib/assets.mjs）
