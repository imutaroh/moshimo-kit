// 舞台：店の前の駐車場（16区画）と、手前の道路、まわりの建物。幕（acts/*.mjs）はここから取って使う。
// 座標：x=右、y=上、z=手前。単位は m。人物は三頭身（立った背丈 約1.08m）なので、車も小さめ（幅 1.1m）のジオラマの寸法。
import { box, model, glbInfo, Q } from "../../kinds/sim3d/lib/mvscene.mjs";
import { furn, car, city } from "../../kinds/sim3d/lib/assets.mjs";

// 駐車場の広さ（アスファルトの面）
export const LOT = { x: [-4.2, 4.2], z: [-5.6, 7.6] };
// 区画：横に4列 × 縦に4段。1区画は幅 1.5m・奥行き 2.5m
export const STALL_W = 1.5, STALL_D = 2.5;
export const COLS = [-2.25, -0.75, 0.75, 2.25];
export const ROWS = [-4.25, -1.75, 3.75, 6.25];   // 区画の中心の z。-0.5〜2.5 は通路
export const AISLE_Z = 1.0;                       // 通路のまん中
export const ROAD_Z = [8.2, 11.4];                // 手前の道路
export const CAR_W = 1.1;                         // 車の幅（x）

// 車の種類（Kenney の car-kit）と、その高さ・奥行き（幅を CAR_W にしたとき）
export const CAR_KINDS = ["sedan", "taxi", "suv", "hatchback-sports", "van", "police", "sedan-sports", "suv-luxury", "delivery"];
export const carSize = (n) => { const s = glbInfo(car(n)).size; return { h: (s[1] * CAR_W) / s[0], d: (s[2] * CAR_W) / s[0] }; };

// 16区画を、埋まる順に並べる：2段目（1台目の段）→ 3段目 → 1段目 → 4段目。段の中は、まん中から
export const SLOTS = [
  [COLS[1], ROWS[1]], [COLS[2], ROWS[1]], [COLS[0], ROWS[1]], [COLS[3], ROWS[1]],
  [COLS[1], ROWS[2]], [COLS[2], ROWS[2]], [COLS[0], ROWS[2]], [COLS[3], ROWS[2]],
  [COLS[1], ROWS[0]], [COLS[2], ROWS[0]], [COLS[0], ROWS[0]], [COLS[3], ROWS[0]],
  [COLS[1], ROWS[3]], [COLS[2], ROWS[3]], [COLS[0], ROWS[3]], [COLS[3], ROWS[3]],
];
export const ME_POS = [-3.55, 0, 0.6];            // 係員の立つ場所（通路の左の端。手前 +z を向く）

// 動かない物をまとめて返す。m は色の関数（ctx.m）
export const lotParts = (m) => {
  const W = m("#F4F1E8"), Y = m("#F2C744");
  const parts = [
    // 地面（芝）と、アスファルト、歩道、道路
    box(m("#8DBA6A"), [0, -0.06, 0], [80, 0.1, 80]),
    box(m("#5E6670"), [0, -0.01, (LOT.z[0] + LOT.z[1]) / 2], [LOT.x[1] - LOT.x[0], 0.02, LOT.z[1] - LOT.z[0]]),
    box(m("#B9B4AA"), [0, 0.02, 7.9], [40, 0.06, 0.6]),
    box(m("#4A5058"), [0, -0.005, (ROAD_Z[0] + ROAD_Z[1]) / 2], [40, 0.02, ROAD_Z[1] - ROAD_Z[0]]),
    box(m("#B9B4AA"), [0, 0.02, 11.7], [40, 0.06, 0.6]),
    ...Array.from({ length: 14 }, (_, i) => box(W, [-19 + i * 3, 0.01, (ROAD_Z[0] + ROAD_Z[1]) / 2], [1.4, 0.01, 0.12])), // 道路の中央線
    box(m("#C9C2B4"), [0, 0.02, -6.3], [10, 0.06, 1.4]),                                                          // 店の前の歩道
  ];
  // 区画の白線（各段の左右と奥）と、車止め
  for (const z of ROWS) {
    for (let i = 0; i <= 4; i++) parts.push(box(W, [-3 + i * 1.5, 0.006, z], [0.07, 0.012, STALL_D]));
    const back = z < AISLE_Z ? z - STALL_D / 2 : z + STALL_D / 2;
    parts.push(box(W, [0, 0.006, back], [6.07, 0.012, 0.07]));
    for (const x of COLS) parts.push(box(m("#D8D2C6"), [x, 0.05, back + (z < AISLE_Z ? 0.35 : -0.35)], [0.7, 0.1, 0.14]));
  }
  // 通路の矢印（黄色の筋）
  parts.push(box(Y, [-1.5, 0.006, AISLE_Z], [1.2, 0.012, 0.1]), box(Y, [1.5, 0.006, AISLE_Z], [1.2, 0.012, 0.1]));
  // 店とまわりの建物（Kenney の city-kit-commercial）
  parts.push(
    model(city("building-c"), { w: 8.0, pos: [0, 0, -11.4] }),
    model(city("building-e"), { w: 7.0, pos: [-9.5, 0, -9.5] }),
    model(city("building-h"), { w: 5.0, pos: [9.0, 0, -8.5] }),
    model(city("building-skyscraper-a"), { w: 5.0, pos: [-6, 0, -22] }),
    model(city("low-detail-building-b"), { w: 3.0, pos: [7, 0, -20] }),
    model(city("low-detail-building-wide-a"), { w: 8.0, pos: [14, 0, -14] }),
    model(city("low-detail-building-wide-a"), { w: 8.0, pos: [-15, 0, 16], quat: Q.yaw(Math.PI) }),
    model(city("building-e"), { w: 7.0, pos: [10, 0, 17], quat: Q.yaw(Math.PI) }),
  );
  // 街灯・植木・コーン（ふちを埋める）
  for (const [x, z] of [[-4.6, -4], [4.6, -4], [-4.6, 4.5], [4.6, 4.5]]) parts.push(model(furn("lampRoundFloor"), { h: 2.6, pos: [x, 0, z] }));
  for (const [x, z] of [[-4.8, -1.2], [4.8, -1.2], [-4.8, 7.0], [4.8, 7.0], [-3.2, -6.3], [3.2, -6.3]]) parts.push(model(furn("pottedPlant"), { h: 1.0, pos: [x, 0, z] }));
  for (const [x, z] of [[-4.4, 2.6], [-4.4, -0.6], [4.4, 2.6], [4.4, -0.6]]) parts.push(model(car("cone"), { h: 0.45, pos: [x, 0, z] }));
  return parts;
};
