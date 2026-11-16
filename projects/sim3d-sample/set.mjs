// 舞台（動かない部屋と、寸法）。幕（acts/*.mjs）はここから取って使う。
// 座標：x=右、y=上、z=手前。単位は m。人物は三頭身（立った背丈 約1.08m）なので、小物は現実より大きめに作る。
// 書き換える所：部屋の広さと色、置く家具、机とリンゴの寸法
import { box, model, glbInfo } from "../../kinds/sim3d/lib/mvscene.mjs";
import { furn } from "../../kinds/sim3d/lib/assets.mjs";

export const ROOM = { x: [-3.5, 3.5], z: [-2.5, 3.5], h: 2.8 };     // 部屋の広さ（手前 z=3.5 側には壁を置かない＝カメラを置く側）
export const TABLE_W = 1.6;                                        // 机の幅（x）
const t = glbInfo(furn("table")).size;
export const TABLE_TOP = (t[1] * TABLE_W) / t[0];                  // 机の天板の高さ（素材の比率から決まる。約0.62m）
export const TABLE_D = (t[2] * TABLE_W) / t[0];                    // 机の奥行き（z）
export const APPLE = 0.16;                                         // リンゴの直径
export const ME_POS = [-1.05, 0, 0.1];                             // わたしの立つ場所（机の左。右＝+x を向く）

// 動かない物をまとめて返す。m は色の関数（ctx.m）
export const roomParts = (m) => [
  // 床（板を並べる）と、奥・左の壁
  ...Array.from({ length: 14 }, (_, i) => box(m(i % 2 ? "#C9A27A" : "#BE966C"), [ROOM.x[0] + 0.25 + i * 0.5, -0.03, 0.5], [0.49, 0.06, ROOM.z[1] - ROOM.z[0]])),
  box(m("#EFE4D2"), [0, ROOM.h / 2, ROOM.z[0] - 0.1], [ROOM.x[1] - ROOM.x[0], ROOM.h, 0.2]),
  box(m("#E6D8C2"), [ROOM.x[0] - 0.1, ROOM.h / 2, 0.5], [0.2, ROOM.h, ROOM.z[1] - ROOM.z[0]]),
  box(m("#9C7650"), [0, 0.06, ROOM.z[0] + 0.01], [ROOM.x[1] - ROOM.x[0], 0.12, 0.03]), // 幅木
  // 家具（Kenney の furniture-kit。名前は ls shared/models/kenney/furniture-kit/）
  model(furn("rugRectangle"), { w: 2.6, pos: [0, 0.001, 0.1] }),
  model(furn("table"), { w: TABLE_W, pos: [0, 0, 0] }),
  model(furn("bookcaseOpen"), { h: 1.7, pos: [-1.6, 0, ROOM.z[0] + 0.25] }),
  model(furn("bookcaseClosedWide"), { h: 1.2, pos: [0.4, 0, ROOM.z[0] + 0.25] }),
  model(furn("pottedPlant"), { h: 1.1, pos: [2.2, 0, ROOM.z[0] + 0.5] }),
  model(furn("lampRoundFloor"), { h: 1.6, pos: [-2.8, 0, -1.3] }),
  model(furn("loungeSofa"), { w: 1.8, pos: [2.4, 0, -0.6], quat: [0, -0.7071068, 0, 0.7071068] }),
  box(m("#F6EFE2"), [1.6, 1.75, ROOM.z[0] + 0.02], [0.9, 0.6, 0.03]), // 壁の絵
  box(m("#7DA3C9"), [1.6, 1.75, ROOM.z[0] + 0.04], [0.76, 0.46, 0.01]),
];
