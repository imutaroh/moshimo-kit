// 幕「店の外」：冒頭の先見せ（物語 -5〜-2.4 秒）と、物語の24〜36秒（駐車場と街）。
// 店は原点（kit.ROOM）。駐車場は z > 3.3 の側、その先に道路と街。
// 動く物は「出来事の時計」（clk）で書き、冒頭の先見せと本編で同じ動きを、別の時刻・別のアングルで使い回す。
import { Q, T, V, box, cyl, sphere, torus, model, rng, clamp, ease, lerp } from "../../../kinds/sim3d/lib/mvscene.mjs";
import { hop, hold, yawTo, lerpAng } from "../../../kinds/sim3d/lib/motion.mjs";
import * as kit from "../kit.mjs";

export default (ctx) => {
  const { sc, m, ep, fOf, tOf, FPS } = ctx;
  const AH = ctx.INTRO.ahead, ST = ctx.range(24, 36), SPANS = [AH, ST];
  const HIDE = T([0, -500, 0], Q.id(), 0.0001);
  const isAh = (f) => f <= AH[1];
  const AH_SLOW = 0.3, AH_DSLOW = 0.16, AH_DUST0 = 0.03, AH_ROOF0 = 0.08; // 先見せはスローモーション（屋根 0.3倍、土ぼこり 0.16倍）
  // 出来事の時計（秒）。本編は物語の秒から、冒頭はすべてが同時に起きている瞬間を見せる
  const clk = (f) => {
    if (isAh(f)) { const s = f / FPS; return { ah: true, run: 9, dust: AH_DUST0 + s * AH_DSLOW, roof: AH_ROOF0 + s * AH_SLOW, streak: 0.15 + s * 0.5, alarm: s + 1, glow: s + 3 }; }
    const t = tOf(f);
    return { ah: false, t, run: t - 24, dust: t - 28, roof: t - 30, streak: t - 32, alarm: t - 25.3, glow: t - 26 };
  };
  // 動かない物：先見せと本編の両方に置く
  const still = (id, parts, t = T()) => { const o = sc.add(id, parts); SPANS.forEach((r) => o.at(...r, t)); return o; };
  // 動く物：fn(f) が変換か null（null は隠す）。spans で出す範囲を絞れる
  const dyn = (id, parts, fn, spans = SPANS) => { const o = sc.add(id, parts); spans.forEach((r) => o.anim(...r, (f) => fn(f) ?? HIDE)); return o; };
  const R = rng(4242);
  const pick = (a) => a[Math.floor(R() * a.length)];

  // ---------- 地面と道路 ----------
  const LOT = { x: [-15, 15], z: [3.5, 20.4] };
  const ROAD_Z = 26.4, ROAD_W = 8;               // 店の前の大通り（x 方向）
  const ROADS_Z = [ROAD_Z, -20, -66, 72, 118, -112], ROADS_X = [-34, 34, -96, 96, -158, 158];
  const ground = [box(m("#C7C1B4"), [0, -0.06, 0], [520, 0.1, 520])];
  for (const z of ROADS_Z) {
    ground.push(box(m("#43474D"), [0, 0.0, z], [520, 0.04, ROAD_W]));
    ground.push(box(m("#D9D4C8"), [0, 0.03, z - ROAD_W / 2 - 1], [520, 0.08, 2]), box(m("#D9D4C8"), [0, 0.03, z + ROAD_W / 2 + 1], [520, 0.08, 2]));
    for (let x = -258; x < 260; x += 6) ground.push(box(m("#E8C547"), [x, 0.025, z], [3, 0.01, 0.18]));
    for (const s of [-1, 1]) ground.push(box(m("#F2F2F2"), [0, 0.025, z + s * (ROAD_W / 2 - 0.3)], [520, 0.01, 0.14]));
  }
  for (const x of ROADS_X) ground.push(box(m("#43474D"), [x, 0.005, 0], [ROAD_W, 0.04, 520]), box(m("#D9D4C8"), [x - ROAD_W / 2 - 1, 0.025, 0], [2, 0.08, 520]), box(m("#D9D4C8"), [x + ROAD_W / 2 + 1, 0.025, 0], [2, 0.08, 520]));
  // 横断歩道（駐車場の出口の横）
  for (let i = 0; i < 9; i++) ground.push(box(m("#F4F4F4"), [17.5 + i * 0.9, 0.03, ROAD_Z], [0.5, 0.01, ROAD_W - 1]));
  still("out-ground", ground);

  // ---------- 駐車場 ----------
  const lot = [box(m("#575C63"), [0, 0.01, (LOT.z[0] + LOT.z[1]) / 2], [LOT.x[1] - LOT.x[0], 0.04, LOT.z[1] - LOT.z[0]])];
  // 舗装のつぎはぎ・油じみ（地面を1色にしない）
  for (let i = 0; i < 26; i++) lot.push(box(m(pick(["#4E5359", "#61666D", "#5B5F66", "#4A4E54"])), [lerp(-14, 14, R()), 0.032, lerp(4, 20, R())], [1 + R() * 3.5, 0.005, 0.6 + R() * 2.5], Q.yaw(R() * 0.3)));
  for (let i = 0; i < 10; i++) lot.push(cyl(m("#3F4247"), [lerp(-13, 13, R()), 0.035, lerp(5, 19, R())], 0.3 + R() * 0.5, 0.005));
  // 店の前の歩道
  lot.push(box(m("#D3CDBF"), [0, 0.06, 4.3], [30, 0.12, 1.8]));
  for (let x = -14.5; x < 15; x += 1.2) lot.push(box(m("#BDB6A7"), [x, 0.125, 4.3], [0.04, 0.01, 1.8]));
  // 白線：手前の列（店向き）と奥の列（道路向き）
  const STALL = 2.6, ROW1 = [5.6, 9.6], ROW2 = [15.2, 19.2];
  for (const [z0, z1] of [ROW1, ROW2]) {
    for (let x = -14.3; x <= 14.4; x += STALL) lot.push(box(m("#EDEDED"), [x, 0.035, (z0 + z1) / 2], [0.12, 0.01, z1 - z0]));
    lot.push(box(m("#EDEDED"), [0, 0.035, z1 === ROW1[1] ? z1 : z0], [28.6, 0.01, 0.12]));
  }
  // 通路の矢印
  for (const x of [-8, 0, 8]) lot.push(box(m("#EDEDED"), [x, 0.035, 12.4], [1.6, 0.01, 0.2]), box(m("#EDEDED"), [x + 0.7, 0.035, 12.1], [0.5, 0.01, 0.15], Q.yaw(0.7)), box(m("#EDEDED"), [x + 0.7, 0.035, 12.7], [0.5, 0.01, 0.15], Q.yaw(-0.7)));
  // 車止め
  for (let x = -13; x <= 13.5; x += STALL) lot.push(box(m("#B9B4AA"), [x, 0.09, ROW1[0] + 0.4], [1.3, 0.16, 0.2]), box(m("#B9B4AA"), [x, 0.09, ROW2[1] - 0.4], [1.3, 0.16, 0.2]));
  // 植え込み（道路側と左右の縁）
  const hedge = (x, z, w, d) => {
    lot.push(box(m("#9C978B"), [x, 0.2, z], [w, 0.4, d]), box(m("#4F8A3C"), [x, 0.5, z], [w - 0.2, 0.3, d - 0.2]));
    for (let i = 0; i < Math.max(w, d) / 1.1; i++) lot.push(sphere(m(i % 2 ? "#5E9B45" : "#467F35"), [x + (w > d ? -w / 2 + 0.6 + i * 1.1 : 0), 0.75, z + (w > d ? 0 : -d / 2 + 0.6 + i * 1.1)], 0.55));
  };
  hedge(-9.5, 20.0, 11, 0.9); hedge(9.5, 20.0, 11, 0.9); hedge(-15.4, 12, 0.9, 15); hedge(15.4, 9, 0.9, 9);
  still("out-lot", lot);

  // ---------- 街灯・のぼり・信号 ----------
  const poles = [];
  const streetLamp = (x, z, h = 5.6, face = 1) => poles.push(cyl(m("#5D6168"), [x, h / 2, z], 0.08, h), box(m("#5D6168"), [x, h, z - face * 0.6], [0.1, 0.1, 1.3]), box(m("#FFF7DE", { emissive: 1 }), [x, h - 0.08, z - face * 1.1], [0.35, 0.08, 0.5]), box(m("#5D6168"), [x, h + 0.02, z - face * 1.1], [0.45, 0.12, 0.6]));
  for (const x of [-14.6, -5, 5, 14.6]) streetLamp(x, 20.9, 5.6, -1);
  for (const x of [-40, -24, -8, 8, 24, 40]) streetLamp(x, ROAD_Z + 5.4, 5.6, 1);
  const NOBORI = ["#D7263D", "#2E5EAA", "#F2B134", "#D7263D", "#2E5EAA"];
  for (const [i, x] of [-4.6, -3.0, 5.4, 6.4, 7.4].entries()) poles.push(cyl(m("#F2F2F2"), [x, 1.6, 4.9], 0.03, 3.2), box(m(NOBORI[i]), [x + 0.33, 1.95, 4.9], [0.62, 2.1, 0.02]), box(m("#FFFFFF"), [x + 0.33, 2.2, 4.92], [0.16, 1.2, 0.01]));
  // 信号（出口の横の交差点）
  const signal = (x, z, yaw) => {
    poles.push(cyl(m("#5D6168"), [x, 2.4, z], 0.09, 4.8));
    const q = Q.yaw(yaw), at = (lx, ly, lz) => V.add([x, 0, z], Q.rot(q, [lx, ly, lz]));
    poles.push(box(m("#3A3D42"), at(0, 4.4, 0.25), [1.3, 0.42, 0.3], q));
    poles.push(sphere(m("#2A2C30"), at(-0.4, 4.4, 0.42), 0.13), sphere(m("#F2C230"), at(0, 4.4, 0.42), 0.13), sphere(m("#FF3B30", { emissive: 1 }), at(0.4, 4.4, 0.42), 0.13));
  };
  signal(16.4, 21.2, 0); signal(26, 31.6, Math.PI); signal(-33, 21.2, 0);
  // ガードレールとごみ箱・自販機（店の右わき）
  for (let x = 16; x < 33; x += 2) poles.push(cyl(m("#C9CDD2"), [x, 0.35, 21.4], 0.04, 0.7));
  poles.push(box(m("#E9ECEF"), [24.5, 0.6, 21.4], [17, 0.18, 0.05]));
  poles.push(box(m("#D7263D"), [6.0, 0.9, 3.0], [0.8, 1.8, 0.7]), box(m("#BFE3F2", { emissive: 1 }), [6.0, 1.15, 3.36], [0.6, 0.9, 0.02]), box(m("#2E5EAA"), [7.0, 0.9, 3.0], [0.8, 1.8, 0.7]), box(m("#F7F2E4", { emissive: 1 }), [7.0, 1.15, 3.36], [0.6, 0.9, 0.02]));
  still("out-poles", poles);

  // ---------- 街：建物 ----------
  const BLD = "abcdefghijklmn".split("").map((c) => kit.city("building-" + c));
  const SKY = "abcde".split("").map((c) => kit.city("building-skyscraper-" + c));
  const LOW = "abcdefghijklmn".split("").map((c) => kit.city("low-detail-building-" + c));
  const near = [];
  // 道路の向こう側（店の正面に見える並び）：手前（-z）を向ける
  for (let x = -58, i = 0; x <= 58; x += 9.2, i++) near.push(model(i % 4 === 2 ? SKY[i % 5] : BLD[(i * 5) % 14], { k: i % 4 === 2 ? 7.5 : 9, pos: [x, 0, ROAD_Z + 11.5 + (i % 3) * 0.6], quat: Q.yaw(Math.PI) }));
  // 駐車場の左右：駐車場を向ける
  for (const s of [-1, 1]) for (let z = 15, i = 0; z >= -14; z -= 9.4, i++) near.push(model(i % 3 === 1 ? SKY[(i + 2) % 5] : BLD[(i * 3 + (s > 0 ? 4 : 9)) % 14], { k: i % 3 === 1 ? 7.5 : 9, pos: [s * 23, 0, z], quat: Q.yaw(-s * Math.PI / 2) }));
  // 店の裏
  for (let x = -14, i = 0; x <= 14; x += 9.4, i++) near.push(model(BLD[(i * 7 + 2) % 14], { k: 9, pos: [x, 0, -11] }));
  still("out-city-near", near);
  // 遠くの街区（上空のカット用）：道路の格子のあいだを建物で埋める
  const far = [];
  const xs = [-200, ...[...ROADS_X].sort((a, b) => a - b), 200], zs = [-160, ...[...ROADS_Z].sort((a, b) => a - b), 170];
  for (let a = 0; a + 1 < xs.length; a++) for (let b = 0; b + 1 < zs.length; b++) {
    const x0 = xs[a] + 9, x1 = xs[a + 1] - 9, z0 = zs[b] + 9, z1 = zs[b + 1] - 9;
    if (x0 < 0 && x1 > 0 && z0 < 0 && z1 > 0) continue; // 店のある街区は上で作った
    const nearRow = x0 < 0 && x1 > 0 && z0 > ROAD_Z && z0 < ROAD_Z + 20; // 道路の向こうの並びは上で作った
    for (let x = x0; x <= x1; x += 13) for (let z = z0; z <= z1; z += 13) {
      const d = Math.hypot(x, z), r = R();
      if (r < 0.12 || (nearRow && z < ROAD_Z + 20 && Math.abs(x) < 62)) continue;
      const tall = r > 0.86 && d < 150;
      far.push(model(tall ? pick(SKY) : d < 90 ? pick(BLD) : pick(LOW), tall ? { k: 8 + R() * 4, pos: [x, 0, z], quat: Q.yaw(Math.floor(R() * 4) * Math.PI / 2) } : d < 90 ? { k: 9 + R() * 2, pos: [x, 0, z], quat: Q.yaw(Math.floor(R() * 4) * Math.PI / 2) } : { h: 10 + R() * 22, pos: [x, 0, z] }));
    }
  }
  still("out-city-far", far);

  // ---------- 店の外側 ----------
  const front = 3.3 + 0.2;
  const shop = [...kit.shellParts(m), ...kit.frontWallParts(m), ...kit.counterParts(m), ...kit.laneBaseParts(m)];
  // 外壁の腰板（窓の下）と、窓の上の赤い帯
  for (const [a, b] of kit.WINDOWS) shop.push(box(m(kit.WOOD_DARK), [(a + b) / 2, 0.5, front + 0.02], [b - a + 0.3, 1.0, 0.06]), box(m(kit.WOOD_DARK), [(a + b) / 2, kit.WIN_Y[0], front + 0.08], [b - a + 0.3, 0.08, 0.2]));
  shop.push(box(m("#B3202F"), [0, 2.72, front + 0.03], [10.4, 0.28, 0.06]));
  for (const x of [-5.05, 5.05]) shop.push(box(m(kit.WOOD_DARK), [x, 1.5, front], [0.22, 3.0, 0.24]));
  // 提灯（出口の両わき）
  for (const x of [2.7, 4.5]) shop.push(cyl(m("#D7263D", { emissive: 1 }), [x, 2.3, front + 0.25], 0.17, 0.42), cyl(m("#2A2420"), [x, 2.55, front + 0.25], 0.12, 0.06), cyl(m("#2A2420"), [x, 2.06, front + 0.25], 0.12, 0.06));
  // 割れた窓の破片（歩道に散っている）
  for (let i = 0; i < 18; i++) shop.push(box(m("#CFEAF5", { opacity: 0.7 }), [lerp(-2.2, 0.4, R()), 0.13, lerp(3.7, 5.2, R())], [0.12 + R() * 0.2, 0.01, 0.08 + R() * 0.15], Q.yaw(R() * 3)));
  still("out-shop", shop);
  // 店内のヤマダと大将（窓から見える）
  kit.person(sc, "out-yamada", ep.cast.yamada.look).at(...AH, kit.seatT(kit.YAMADA_SEAT)).at(...ST, kit.seatT(kit.YAMADA_SEAT)).clip(...AH, "sit", () => 0.1).clip(...ST, "sit", () => 0.1);
  kit.person(sc, "out-chef", ep.cast.chef.look).at(...AH, T(kit.CHEF_POS)).at(...ST, T(kit.CHEF_POS)).clip(...AH, "interact-left").clip(...ST, "interact-left");

  // ---------- 土ぼこりの輪（28秒の音の壁）：店から広がる。半径 ringR(u)、ある距離に届く時刻 ringAt(d) ----------
  const RING0 = 5, RINGMAX = 30, RINGK = 0.65, SHOP_C = [0, 0, 0.45];
  const ringR = (u) => RING0 + RINGMAX * (1 - Math.exp(-RINGK * Math.max(0, u)));
  const ringAt = (d) => -Math.log(1 - clamp((d - RING0) / RINGMAX, 0, 0.999)) / RINGK;
  const distShop = (p) => Math.max(RING0, Math.hypot(p[0] - SHOP_C[0], p[2] - SHOP_C[2]));
  // 跳ねる hop(τ, v) は lib/motion.mjs

  // ---------- 車（駐車場と道路）。ハザードが点滅し、音の壁で跳ねる ----------
  const CARS = [
    ["sedan", -11.7, 7.6, 0], ["suv", -6.5, 7.6, Math.PI], ["hatchback-sports", -3.9, 7.6, 0], ["police", 9.5, 7.6, Math.PI], ["van", 12.1, 7.6, 0],
    ["taxi", -10.4, 17.2, Math.PI], ["suv-luxury", -5.2, 17.2, 0], ["sedan-sports", 2.6, 17.2, Math.PI], ["delivery", 7.8, 17.2, 0], ["sedan", 13.0, 17.2, Math.PI],
  ];
  const carT = (c, f) => {
    const [, x, z, yaw] = c, k = clk(f), d = distShop([x, 0, z]), tau = k.dust - ringAt(d);
    const v = 4.2 * clamp(12 / d, 0.4, 1.3), y = hop(tau, v);
    const dir = V.norm([x, 0, z - SHOP_C[2]]), tilt = y > 0 ? -Math.sin(Math.min(1, tau / 0.9) * Math.PI) * 0.35 : 0;
    return T([x + dir[0] * Math.min(0.6, Math.max(0, tau) * 1.2), y, z + dir[2] * Math.min(0.6, Math.max(0, tau) * 1.2)], Q.mul(Q.axis(V.cross([0, 1, 0], dir), -tilt), Q.yaw(yaw)));
  };
  const blink = (f, rate = 3) => { const a = clk(f).alarm; return a > 0 && Math.floor(a * rate) % 2 === 0 ? 1 : 0; };
  CARS.forEach((c, i) => {
    const info = kit.car(c[0]);
    dyn("out-car", [model(info, { w: 1.5 })], (f) => carT(c, f));
    const L = c[0] === "police" ? 1.45 : 1.2, lights = [];
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) lights.push(box(m("#FFA21F", { emissive: 1 }), [sx * 0.62, 0.62, sz * L], [0.2, 0.12, 0.08]));
    dyn("out-hazard", lights, (f) => carT(c, f)).fade(...AH, (f) => blink(f + i)).fade(...ST, (f) => blink(f + i * 2));
    if (c[0] === "police") {
      dyn("out-siren-r", [box(m("#FF2A2A", { emissive: 1 }), [-0.3, 1.36, 0], [0.5, 0.14, 0.25])], (f) => carT(c, f)).fade(...AH, (f) => blink(f, 5)).fade(...ST, (f) => blink(f, 5));
      dyn("out-siren-b", [box(m("#2A6BFF", { emissive: 1 }), [0.3, 1.36, 0], [0.5, 0.14, 0.25])], (f) => carT(c, f)).fade(...AH, (f) => 1 - blink(f, 5)).fade(...ST, (f) => 1 - blink(f, 5));
    }
  });

  // ---------- 客5人と警官 ----------
  const DOOR = [3.6, 0, 3.9], OUT = [3.6, 0, 5.4], RUN_V = 6;
  const GUESTS = ep.cast.guests.map((look, i) => ({ look, start: 23.6 + i * 0.25, end: [[-0.8, 0, 11.4], [1.4, 0, 12.2], [3.6, 0, 10.8], [6.0, 0, 11.8], [-2.6, 0, 12.0]][i] }));
  GUESTS.forEach((g) => {
    const L1 = V.len(V.sub(OUT, DOOR)), L2 = V.len(V.sub(g.end, OUT));
    g.arrive = g.start + (L1 + L2) / RUN_V;
    g.runYaw = yawTo(OUT, g.end);
    g.faceYaw = yawTo(g.end, [g.end[0] * 0.3, 0, 1.5]);
    g.dir = V.norm([g.end[0], 0, g.end[2] - SHOP_C[2]]);
    g.fallAt = ringAt(distShop(g.end)) + 0.05; // 輪が届く（dust 時計の秒）
  });
  // 吹き飛び：輪が届いてからの秒 τ で、後ろへ押され、少し浮く
  const pushed = (g, tau) => { const p = 2.4 * (1 - Math.exp(-4 * Math.max(0, tau))); return [g.end[0] + g.dir[0] * p, hop(tau, 2.2), g.end[2] + g.dir[2] * p]; };
  const guestT = (g, f) => {
    const k = clk(f);
    if (!k.ah && k.t >= 30) return T(V.add(pushed(g, 9), [0, 0, 0]), Q.yaw(g.faceYaw));
    const tau = k.dust - g.fallAt;
    if (tau > 0) return T(pushed(g, tau), Q.yaw(g.faceYaw));
    if (k.ah) return T(g.end, Q.yaw(g.faceYaw));
    const t = k.t, d = (t - g.start) * RUN_V, L1 = V.len(V.sub(OUT, DOOR));
    if (d < 0) return null;
    if (d < L1) return T(V.lerp(DOOR, OUT, d / L1), Q.yaw(lerpAng(0, g.runYaw, d / L1)));
    if (t < g.arrive) return T(V.lerp(OUT, g.end, (d - L1) / V.len(V.sub(g.end, OUT))), Q.yaw(g.runYaw));
    return T(g.end, Q.yaw(lerpAng(g.runYaw, g.faceYaw, ease((t - g.arrive) / 0.45))));
  };
  GUESTS.forEach((g, i) => {
    const o = kit.person(sc, "out-guest" + i, g.look);
    SPANS.forEach((r) => o.anim(...r, (f) => guestT(g, f) ?? HIDE));
    // 先見せ：ひっくり返るところ
    const ahF0 = clamp(Math.round(((g.fallAt - AH_DUST0) / AH_DSLOW) * FPS), AH[0] + 1, AH[1]), ahN = Math.round((0.33 / AH_DSLOW) * FPS);
    o.clip(AH[0], ahF0 - 1, "idle").clip(ahF0, Math.min(AH[1], ahF0 + ahN - 1), "fall", (f) => hold(0.33)(((f - ahF0) / FPS) * AH_DSLOW)).clip(ahF0 + ahN, AH[1], "die", (f) => hold(0.33)(((f - ahF0 - ahN) / FPS) * AH_DSLOW));
    // 本編：走る → 振り返って立ちつくす → 28秒でひっくり返る → 30秒からは座りこんで見上げる
    const fArr = fOf(g.arrive), fFall = fOf(28 + g.fallAt);
    o.clip(ST[0], fArr - 1, "sprint", (f) => tOf(f) - g.start).clip(fArr, fFall - 1, "idle").clip(fFall, fFall + 9, "fall", (f) => hold(0.33)((f - fFall) / FPS))
      .clip(fFall + 10, fOf(30) - 1, "die", (f) => hold(0.33)((f - fFall - 10) / FPS)).clip(fOf(30), ST[1], "sit", () => 0.1);
  });
  // 警官：出口の先で、手を振って客を通す。28秒に吹き飛ぶ
  const POLICE = { end: [0.6, 0, 6.6] };
  POLICE.faceYaw = yawTo(POLICE.end, [3.4, 0, 6.4]);
  POLICE.dir = V.norm([POLICE.end[0], 0, POLICE.end[2] - SHOP_C[2]]);
  POLICE.fallAt = ringAt(distShop(POLICE.end)) + 0.05;
  const cop = kit.person(sc, "out-police", ep.cast.police);
  SPANS.forEach((r) => cop.anim(...r, (f) => { const tau = clk(f).dust - POLICE.fallAt; return T(tau > 0 ? pushed(POLICE, tau) : POLICE.end, Q.yaw(POLICE.faceYaw)); }));
  {
    const fFall = fOf(28 + POLICE.fallAt);
    const ahF0 = clamp(Math.round(((POLICE.fallAt - AH_DUST0) / AH_DSLOW) * FPS), AH[0] + 1, AH[1]), ahN = Math.round((0.33 / AH_DSLOW) * FPS);
    cop.clip(AH[0], ahF0 - 1, "interact-right").clip(ahF0, Math.min(AH[1], ahF0 + ahN - 1), "fall", (f) => hold(0.33)(((f - ahF0) / FPS) * AH_DSLOW)).clip(ahF0 + ahN, AH[1], "die", (f) => hold(0.33)(((f - ahF0 - ahN) / FPS) * AH_DSLOW));
    cop.clip(ST[0], fFall - 1, "interact-right").clip(fFall, fFall + 9, "fall", (f) => hold(0.33)((f - fFall) / FPS)).clip(fFall + 10, ST[1], "die", (f) => hold(0.33)((f - fFall - 10) / FPS));
  }
  ctx.bubble("ピーッ！ こっちへ！", 24.2, 25.8, () => [POLICE.end[0], 1.35, POLICE.end[2]]);

  // ---------- 窓ガラス（28秒に割れて飛ぶ）と、窓からもれる光 ----------
  const glassOn = (f) => clk(f).dust < 0;
  [0, 2].forEach((i) => dyn("out-glass", [kit.windowGlassPart(m, i)], (f) => (glassOn(f) ? T() : null)));
  for (let i = 0; i < 36; i++) {
    const w = kit.WINDOWS[[0, 2, 1][i % 3]], p0 = [lerp(w[0], w[1], R()), lerp(kit.WIN_Y[0], kit.WIN_Y[1], R()), front + 0.1];
    const v = [(R() - 0.5) * 6, 2 + R() * 4, 8 + R() * 10], spin = V.norm([R() - 0.5, R() - 0.5, R() - 0.5]), sp = 8 + R() * 10;
    dyn("out-shard", [box(m("#DFF3FA", { opacity: 0.8 }), [0, 0, 0], [0.14 + R() * 0.2, 0.18 + R() * 0.2, 0.02])], (f) => {
      const u = clk(f).dust;
      if (u < 0 || u > 1.6) return null;
      const y = Math.max(0.02, p0[1] + v[1] * u - 4.9 * u * u);
      return T([p0[0] + v[0] * u, y, p0[2] + v[2] * u], Q.axis(spin, sp * Math.min(u, y > 0.02 ? 9 : u)));
    });
  }
  // 窓と出口の光：26秒から明滅し、28秒からは白くあふれる
  const glowParts = [...kit.WINDOWS.map(([a, b]) => box(m("#FFE7A8", { emissive: 1 }), [(a + b) / 2, (kit.WIN_Y[0] + kit.WIN_Y[1]) / 2, 3.2], [b - a, kit.WIN_Y[1] - kit.WIN_Y[0], 0.02])), box(m("#FFE7A8", { emissive: 1 }), [3.6, 1.1, 3.2], [1.2, 2.2, 0.02])];
  const flick = (f) => { const g = clk(f).glow; if (g < 0) return 0.15; if (g > 2) return 0.55; const n = rng(1000 + f)(); return n > 0.45 ? 0.3 + 0.3 * n : 0.08; };
  const glow = sc.add("out-glow", glowParts);
  SPANS.forEach((r) => glow.at(...r).fade(...r, flick));
  still("out-belt", [kit.beltPart(m("#FFF3C4", { emissive: 1 }))]);

  // ---------- 屋根と看板：30秒に回りながら飛ぶ（28〜30秒は、がたがた揺れる） ----------
  const ROOF0 = [0, kit.ROOM.h, 0.45];
  const roofParts = [box(m("#4A4440"), [0, 0.15, 0], [10.8, 0.3, 6.4])];
  for (let i = 0; i < 6; i++) roofParts.push(box(m(i % 2 ? "#5A524C" : "#3F3935"), [0, 0.34, -2.6 + i * 1.04], [10.6, 0.1, 0.9]));
  roofParts.push(box(m("#B3202F"), [0, 0.12, 3.22], [10.9, 0.36, 0.08]));
  // 看板：赤い板に白い丸3つ、上に大きな寿司
  roofParts.push(box(m("#C8102E"), [0.8, 1.1, 2.7], [5.4, 1.5, 0.3]), box(m("#F7F2E4"), [0.8, 1.1, 2.86], [5.0, 1.15, 0.02]), box(m("#C8102E"), [0.8, 1.1, 2.88], [4.8, 0.95, 0.02]));
  for (const x of [-0.9, 0.8, 2.5]) roofParts.push(cyl(m("#FFFFFF"), [x, 1.1, 2.92], 0.38, 0.04, Q.axis([1, 0, 0], Math.PI / 2)), cyl(m("#2A2420"), [x, 1.1, 2.95], 0.16, 0.03, Q.axis([1, 0, 0], Math.PI / 2)));
  for (const x of [-1.4, 3.0]) roofParts.push(box(m("#5D6168"), [x, 0.4, 2.5], [0.12, 0.6, 0.12]));
  roofParts.push(model(kit.food("sushi-salmon"), { w: 2.2, pos: [0.8, 1.85, 2.7], quat: Q.yaw(Math.PI / 2) }));
  const roofT = (f) => {
    const u = clk(f).roof;
    if (u < -2) return T(ROOF0);
    if (u < 0) { const a = (u + 2) / 2, j = rng(500 + f); return T(V.add(ROOF0, [(j() - 0.5) * 0.12 * a, 0.05 + j() * 0.35 * a * a, (j() - 0.5) * 0.12 * a]), Q.euler((j() - 0.5) * 0.06 * a, 0, (j() - 0.5) * 0.08 * a)); }
    return T(V.add(ROOF0, [1.6 * u, 9 * u + 3 * u * u, -1.2 * u]), Q.axis(V.norm([0.6, 0.25, 1]), 2.4 * u + 0.6 * u * u));
  };
  dyn("out-roof", roofParts, roofT);
  // 屋根の抜けた穴から立つ光の柱
  const beam = sc.add("out-beam", [cyl(m("#FFF3C4", { emissive: 1, opacity: 0.55 }), [0, 0.5, 0], 1, 1)]);
  const beamOn = (f) => clamp((clk(f).roof - 0.15) / 0.6);
  SPANS.forEach((r) => beam.anim(...r, (f) => (beamOn(f) > 0 ? T([0, 2.8, 0.45], Q.id(), [4.2, 6 + 220 * ease(beamOn(f)), 2.6]) : HIDE)).fade(...r, (f) => 0.35 + 0.4 * beamOn(f)));

  // ---------- 瓦礫：屋根から飛び出して降る（30〜32秒） ----------
  const DEBRIS = ["debris-door", "debris-tire", "debris-plate-a", "debris-plate-b", "debris-bumper", "debris-spoiler-a", "debris-plate-small-a", "debris-door-window"];
  for (let i = 0; i < 46; i++) {
    const kind = i % 3, high = i % 4 === 3;
    const parts = kind === 0 ? [box(m(pick(["#4A4440", "#5A524C", "#F1E6D2", "#7A5230"])), [0, 0, 0], [0.4 + R() * 0.9, 0.12 + R() * 0.2, 0.4 + R() * 0.7])]
      : kind === 1 ? [model(kit.car(pick(DEBRIS)), { h: 0.5 + R() * 0.5 })] : [model(kit.food("plate"), { w: 0.6 + R() * 0.3 })];
    const l = R() * 0.5, p0 = high ? [lerp(-8, 10, R()), 16 + R() * 14, lerp(4, 14, R())] : [lerp(-4.5, 4.5, R()), 3.2, lerp(-1.8, 2.8, R())];
    const v = high ? [(R() - 0.5) * 2, -2 - R() * 4, (R() - 0.5) * 2] : [(p0[0]) * 0.6 + (R() - 0.5) * 5, 6 + R() * 8, 2 + R() * 7];
    const spin = V.norm([R() - 0.5, R() - 0.5, R() - 0.5]), sp = 5 + R() * 8;
    dyn("out-debris", parts, (f) => {
      const u = clk(f).roof - l;
      if (u < 0) return null;
      let y = p0[1] + v[1] * u - 4.9 * u * u, tl = u;
      if (y < 0.05) { // 着地：その場に止まる
        const tg = (v[1] + Math.sqrt(v[1] * v[1] + 19.6 * (p0[1] - 0.05))) / 9.8;
        tl = tg; y = 0.05;
      }
      return T([p0[0] + v[0] * tl, y, p0[2] + v[2] * tl], Q.axis(spin, sp * tl));
    });
  }

  // ---------- 光の筋：店から四方へ飛ぶ皿（32〜34秒。先見せでは低く・遅く） ----------
  const STREAKS = [];
  for (let i = 0; i < 64; i++) STREAKS.push({ egg: i === 5, l: i === 5 ? 0.15 : R() * 1.8, az: i === 5 ? 0.75 : i * 2.39996 + R() * 0.3, vh: i === 5 ? 34 : 40 + R() * 55, vy: i === 5 ? 20 : 12 + R() * 22, w: 0.6 + R() * 0.27 });
  // 筋の状態：先頭の位置・向き・長さ・太さ
  const streakAt = (s, f) => {
    const k = clk(f), ah = k.ah, u = k.streak - s.l * (ah ? 0.6 : 1);
    if (u < 0 || u > 3.4) return null;
    // 先見せ：屋根の穴から低く、駐車場の上を扇のように飛ぶ
    const vh = ah ? (9 + s.vh * 0.12) * (s.egg ? 0.75 : 1) : s.vh, vy = ah ? 3 + s.vy * 0.25 : s.vy, g = ah ? 5 : 14;
    const az = ah ? Math.PI / 2 + Math.sin(s.az) * 1.25 : s.az;
    const pos = [Math.cos(az) * vh * u, 3.5 + vy * u - 0.5 * g * u * u, 0.45 + Math.sin(az) * vh * u], vel = [Math.cos(az) * vh, vy - g * u, Math.sin(az) * vh];
    if (pos[1] < -2) return null;
    const L = (ah ? clamp(V.len(vel) * 0.35, 2.5, 7) * (s.egg ? 1.3 : 1) : clamp(V.len(vel) * 0.32, 10, 40)), w = ah ? 0.14 * (s.egg ? 1.5 : 1) : s.w * (s.egg ? 2 : 1);
    return { pos, dir: V.norm(vel), L, w, ah };
  };
  // 尾は3つに分けて、後ろほど細く薄くする。先頭に明るい球
  const TAIL = [[1, 1], [0.6, 0.55], [0.3, 0.25]];
  STREAKS.forEach((s) => {
    const color = s.egg ? "#FFD23F" : "#FFF3C4", spans = [AH, ctx.range(32, 34)];
    TAIL.forEach(([wk, a], k) => {
      const o = dyn("out-streak", [box(m(color, { emissive: 1 }), [0, 0, 0], [1, 1, 1])], (f) => { const st = streakAt(s, f); if (!st) return null; const seg = st.L / 3; return T(V.sub(st.pos, V.mul(st.dir, seg * (k + 0.5))), Q.fromY(st.dir), [st.w * wk, seg * 1.02, st.w * wk]); }, spans);
      spans.forEach((r) => o.fade(...r, () => a));
    });
    dyn("out-streakhead", [sphere(m(s.egg ? "#FFE680" : "#FFFFFF", { emissive: 1 }), [0, 0, 0], 1)], (f) => { const st = streakAt(s, f); return st ? T(st.pos, Q.id(), st.w * (st.ah ? 1.3 : 1.6)) : null; }, spans);
  });
  { const egg = STREAKS[5]; ctx.tag("玉子", 32.25, 33.9, (f) => { const st = streakAt(egg, f); return st ? st.pos : null; }); }

  // ---------- 街の通り（34〜36秒）：寿司が降り、巨大な玉子が車の屋根に乗る ----------
  const STREET = ctx.range(34, 36);
  const EGG_CAR = { x: 6, z: 24.4, land: 35.3 };
  const ROAD_CARS = [["sedan", EGG_CAR.x, EGG_CAR.z, Math.PI / 2], ["taxi", 15, 28.4, -Math.PI / 2], ["van", 21, 24.4, Math.PI / 2], ["suv", -4, 28.4, -Math.PI / 2]];
  const squash = (t) => { const u = t - EGG_CAR.land; if (u < 0) return 1; return 1 - 0.45 * ease(u / 0.3) + 0.05 * Math.exp(-5 * u) * Math.sin(u * 22); };
  ROAD_CARS.forEach((c, i) => {
    const egg = i === 0;
    dyn("out-roadcar", [model(kit.car(c[0]), { w: 1.5 })], (f) => T([c[1], 0, c[2]], Q.yaw(c[3]), egg ? [1, squash(tOf(f)), 1] : 1), [STREET]);
    const lights = [];
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) lights.push(box(m("#FFA21F", { emissive: 1 }), [sx * 0.62, 0.62, sz * 1.2], [0.2, 0.12, 0.08]));
    dyn("out-roadhazard", lights, (f) => T([c[1], 0, c[2]], Q.yaw(c[3]), egg ? [1, squash(tOf(f)), 1] : 1), [STREET]).fade(...STREET, (f) => (egg && tOf(f) < EGG_CAR.land ? 0 : Math.floor(tOf(f) * 4 + i) % 2));
  });
  // 巨大な玉子：黄色い筋を引いて落ち、車をつぶす
  const EGG_H = 1.3, eggK = 2.7 / 0.17;
  const eggY = (t) => { const u = t - EGG_CAR.land; return u < 0 ? EGG_H - u * 9 : EGG_H * squash(t) - 0.08; };
  dyn("out-bigegg", [model(kit.food("sushi-egg"), { k: eggK, quat: Q.yaw(Math.PI / 2) })], (f) => { const t = tOf(f), y = eggY(t); return y > 60 ? null : T([EGG_CAR.x, y, EGG_CAR.z], Q.euler(0, 0, t < EGG_CAR.land ? (EGG_CAR.land - t) * 1.5 : 0)); }, [STREET]);
  dyn("out-eggtrail", [box(m("#FFD23F", { emissive: 1, opacity: 0.85 }), [0, 0.5, 0], [1, 1, 1])], (f) => { const t = tOf(f), y = eggY(t); return t >= EGG_CAR.land || y > 60 ? null : T([EGG_CAR.x, y + 1.2, EGG_CAR.z], Q.id(), [0.6, 18, 0.6]); }, [STREET]);
  // つぶれた瞬間の土ぼこり
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + (i / 11) * Math.PI; // 車の向こう側（カメラから遠い側）だけ
    dyn("out-eggdust", [sphere(m("#D8C7A8", { opacity: 0.5 }), [0, 0, 0], 1)], (f) => { const u = tOf(f) - EGG_CAR.land; if (u < 0 || u > 1.2) return null; const r = 1.4 + 2.2 * (1 - Math.exp(-3 * u)); return T([EGG_CAR.x + Math.cos(a) * r * 1.3, 0.3, EGG_CAR.z + Math.sin(a) * r], Q.id(), 0.35 + u * 0.4); }, [STREET])
      .fade(...STREET, (f) => clamp(1 - (tOf(f) - EGG_CAR.land) / 1.2));
  }
  // 降ってくる寿司
  const RAIN = ["sushi-salmon", "sushi-egg", "sushi-salmon", "sushi-salmon", "sushi-egg"]; // 握りだけ（巻きは空中で黒い岩に見える）
  for (let i = 0; i < 32; i++) {
    const kind = RAIN[i % RAIN.length], size = 0.8 + R() * 0.6, land = 33.7 + R() * 2.2, x = lerp(-6, 10, R()), z = lerp(20.5, 29.5, R()), yaw = R() * 6, spin = V.norm([R() - 0.5, 0.3, R() - 0.5]);
    if (Math.hypot(x - 13, z - 31) < 8 || Math.hypot(x - EGG_CAR.x, z - EGG_CAR.z) < 2.2) continue; // カメラの目の前と、玉子の車には落とさない
    const yOf = (t) => (t < land ? (land - t) * 30 : hop(t - land, 2.2));
    dyn("out-rain", [model(kit.food(kind), { d: size })], (f) => { const t = tOf(f), y = yOf(t); return y > 70 ? null : T([x, y, z], t < land ? Q.axis(spin, t * 7) : Q.mul(Q.yaw(yaw), Q.axis([1, 0, 0], 0.15 * Math.exp(-3 * (t - land))))); }, [STREET]);
    dyn("out-raintrail", [box(m("#FFF3C4", { emissive: 1, opacity: 0.8 }), [0, 0.5, 0], [1, 1, 1])], (f) => { const t = tOf(f), y = yOf(t); return t >= land || y > 70 ? null : T([x, y + size * 0.6, z], Q.id(), [0.16, 7, 0.16]); }, [STREET]);
  }
  // 通りの人：見上げて、跳びのく
  const WALKERS = [["male-e", [8.4, 0, 31.0], "jump"], ["female-a", [7.6, 0, 29.6], "emote-no"], ["male-g", [3.2, 0, 21.4], "idle"]];
  WALKERS.forEach(([look, pos, clipName]) => kit.person(sc, "out-walker", look).at(...STREET, T(pos, Q.yaw(yawTo(pos, [EGG_CAR.x, 0, EGG_CAR.z])))).clip(...STREET, clipName));

  // ---------- 土ぼこりの輪（28秒）。先見せでも使う ----------
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + R() * 0.1, j = 0.85 + R() * 0.3, sz = 0.7 + R() * 0.8, yy = R();
    const d = sc.add("out-dust", [sphere(m("#D8C7A8", { opacity: 0.5 }), [0, 0, 0], 1)]);
    const pos = (f) => { const u = clk(f).dust, ah = isAh(f); if (u < 0 || u > 1.9 || (ah && Math.sin(a) > 0.25)) return null; const r = ringR(u) * j; return T([SHOP_C[0] + Math.cos(a) * r, 0.3 + yy * (0.4 + 1.0 * u), SHOP_C[2] + Math.sin(a) * r * 0.85], Q.id(), sz * (0.8 + 0.8 * u) * (ah ? 0.6 : 1)); };
    SPANS.forEach((r) => d.anim(...r, (f) => pos(f) ?? HIDE).fade(...r, (f) => clamp(1 - clk(f).dust / 1.9)));
  }
  // 音の壁そのもの：白い輪が土ぼこりの先を走る
  for (const [k, y] of [[1.08, 0.5], [1.0, 1.6]]) {
    const ring = sc.add("out-shock", [torus(m("#FFFFFF", { opacity: 0.45 }), [0, 0, 0], 1)]);
    SPANS.forEach((r) => ring.anim(...r, (f) => { const u = clk(f).dust; return u < 0 || u > 1.6 ? HIDE : T([SHOP_C[0], y, SHOP_C[2]], Q.id(), [ringR(u) * k, 10 + 18 * u, ringR(u) * k * 0.85]); }).fade(...r, (f) => clamp(1 - clk(f).dust / 1.6) * (isAh(f) ? 0.3 : 1)));
  }
  // 店のまわりに残って立ちのぼる土ぼこり
  for (let i = 0; i < 22; i++) {
    const x = lerp(-6, 6, R()), z = lerp(-1, 5, R()), sz = 1 + R() * 1.2, rise = 0.6 + R() * 1.4, t0 = R() * 0.3;
    const d = sc.add("out-dust2", [sphere(m("#D8C7A8", { opacity: 0.5 }), [0, 0, 0], 1)]);
    SPANS.forEach((r) => d.anim(...r, (f) => { const u = clk(f).dust - t0; return u < 0 || u > 4 ? HIDE : T([x * (1 + 0.15 * u), 0.5 + rise * u, z + 0.3 * u], Q.id(), sz * (0.6 + 0.5 * u) * (isAh(f) ? 0.55 : 1)); }).fade(...r, (f) => clamp(0.6 - (clk(f).dust - t0) / 6)));
  }
  ctx.flash(28, 1, 9);
  ctx.hit(28, 1);
  ctx.hit(30.05, 0.5);

  // ---------- カット：beat ごとに別の構図 ----------
  const out = { ...ctx.LOOKS.outside, post: { ao: 0.8, bloom: 0.45 } };
  // 冒頭の先見せ：駐車場の地面すれすれから、スローモーションで店を見上げる（店は画面の下半分、屋根と光の筋は題名の奥）
  // カメラは飛ぶ屋根を追って上を向く。注視点を屋根より上に置き、屋根の中心が画面の y 850〜1300px に来るようにする（題名の裏は空と筋）
  ctx.shot("out-ahead", AH, out, (f, k) => { const r = roofT(f); return { pos: V.lerp([12.6, 1.9, 19.9], [11.6, 2.1, 18.9], ease(k)), target: [r[0] * 0.6 - 0.5, r[1] + 3.4, r[2] + 0.6], fov: 54 }; });
  // 24〜26：駐車場の通路から店の正面。客が出口から走ってくる、警官が誘導する
  ctx.shot("out-a", ctx.range(24, 26), out, ctx.dolly({ pos: [-2.2, 2.0, 15.0], target: [2.8, 1.1, 5], fov: 46 }, { pos: [-1.6, 1.9, 14.4], target: [2.8, 1.1, 5] }));
  // 26〜28：振り返って店を見る客の顔の寄り。うしろで車のハザード。店の光が顔に当たって明滅する（光の色をコマごとに切り替える）
  const g1 = GUESTS[1].end, camB = (f) => { const k = clamp((f - fOf(26)) / (fOf(28) - fOf(26))); return { pos: [g1[0] - 1.1 + 1.8 * ease(k), 1.05, g1[2] - 2.7], target: [g1[0] + 0.1, 0.7, g1[2] + 0.4], fov: 29 }; };
  const warm = { ...out, sun: { ...out.sun, color: "#FFD08A", intensity: 1.3 }, ambient: { color: "#FFE2B8", intensity: 1.1 } };
  for (let f = fOf(26), n = 0; f < fOf(28); f += 7, n++) ctx.shot("out-b" + n, [f, Math.min(f + 6, fOf(28) - 1)], n % 2 ? warm : out, camB);
  // 28〜30：音の壁。高めの斜めから、店・土ぼこりの輪・跳ねる車・ひっくり返る客を一度に見せる
  ctx.shot("out-c", ctx.range(28, 30), out, ctx.dolly({ pos: [-10, 5.2, 20], target: [1.5, 0.4, 7], fov: 52 }, { pos: [-9, 4.6, 18.6] }));
  // 30〜32：座りこんだ客の背中ごしに見上げる。屋根が回りながら飛び、瓦礫が降る
  const g1s = pushed(GUESTS[1], 9);
  ctx.shot("out-d", ctx.range(30, 32), out, ctx.dolly({ pos: [g1s[0] + 0.3, 1.4, g1s[2] + 3.1], target: [0.4, 3.6, 1], fov: 66 }, { target: [0.8, 6.2, 1] }));
  // 32〜34：街の上空。店から光の筋が四方へ
  ctx.shot("out-e", ctx.range(32, 34), { ...ctx.LOOKS.aerial, post: { bloom: 0.6 } }, ctx.dolly({ pos: [42, 100, 92], target: [0, 0, 2], fov: 50 }, { pos: [34, 84, 78] }));
  // 34〜36：街の通り。歩道から、店の方角を背に寿司が降り、玉子が車に乗る
  ctx.shot("out-f", ctx.range(34, 36), out, ctx.dolly({ pos: [13.5, 2.7, 31.4], target: [4.5, 1.3, 23.0], fov: 52 }, { pos: [12.6, 2.5, 30.6] }));
};
