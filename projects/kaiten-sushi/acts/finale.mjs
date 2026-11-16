// 幕「宇宙・跡地・締め」：物語の36〜69秒と、締めのカード（69〜74秒）。
//   宇宙（36〜52）：地球を回る皿 → 地球を出る → 地球が小さくなる → 月 → 太陽 → 太陽系 → 銀河
//   跡地（52〜69）：夕焼けの更地に、カウンターとレーンとヤマダと大将だけが残る → 光の柱 → 「玉子、まだですか」
// 宇宙の場面は、場面ごとに原点のまわりへ模型の縮尺で置く（描ける距離は 0.05〜3000m）。星は、カメラに付いてくる遠い殻にする。
import { V, Q, T, box, cyl, sphere, torus, cone, model, rng, clamp, ease, lerp } from "../../../kinds/sim3d/lib/mvscene.mjs";
import { seg, patch } from "../../../kinds/sim3d/lib/motion.mjs";
import * as kit from "../kit.mjs";

const YOLK = "#FFD23F", GLOW = "#FFF3C4", DUST = "#D8C7A8";

export default (ctx) => {
  const { sc, m, ep, fOf, tOf } = ctx;
  const R = (t0, t1) => ctx.range(t0, t1);
  const EM = (c, opacity = 1) => m(c, { emissive: 1, opacity });

  // ---------- 小道具 ----------
  // 筋：a（しっぽ）から b（頭）へ伸びる光る箱。変換は seg(a, b, 太さ)（lib/motion.mjs）
  const streakParts = (color) => [box(EM(color), [0, 0, 0], [1, 1, 1])];
  const HIDE = T([0, -20000, 0], Q.id(), 1e-4);
  // 球面の向き（乱数で一様に）
  const dirRand = (r) => { for (;;) { const v = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1], l = V.len(v); if (l > 0.1 && l <= 1) return V.mul(v, 1 / l); } };
  // 平たい斑（球の表面に貼る）は patch（lib/motion.mjs）
  const shotSpace = (sunFrom, bloom = 0.6, extra = {}) => ({ ...ctx.LOOKS.space, sun: { ...ctx.LOOKS.space.sun, from: sunFrom }, post: { ...ctx.LOOKS.space.post, bloom }, ...extra });
  const camAt = (f) => (sc.camera[f] ? sc.camera[f].slice(0, 3) : [0, 0, 0]);

  // 地球（中心 c・半径 rad）の部品。海・大陸・砂漠・氷・雲・大気のふち
  const earthParts = (c, rad, seed = 7) => {
    const r = rng(seed), p = [sphere(m("#2B6CB0"), c, rad), sphere(m("#2F80C8"), c, rad * 0.995)];
    for (let i = 0; i < 26; i++) { const d = dirRand(r), a = rad * (0.08 + r() * 0.17); p.push(patch(m(i % 5 === 0 ? "#C9B37E" : i % 3 === 0 ? "#3E8E4E" : "#4FA35E"), c, rad, d, a, rad * 0.02, -rad * 0.006)); }
    for (const s of [1, -1]) p.push(patch(m("#F2F6FA"), c, rad, [0, s, 0], rad * 0.32, rad * 0.03, -rad * 0.01));
    for (let i = 0; i < 30; i++) { const d = dirRand(r), a = rad * (0.05 + r() * 0.12); p.push(patch(m("#E6ECF2", { opacity: 0.85 }), c, rad, d, a, rad * 0.008, rad * 0.012)); }
    return p;
  };
  const airParts = (c, rad) => [sphere(m("#8FD0FF", { opacity: 0.18 }), c, rad * 1.04), sphere(m("#BFE6FF", { opacity: 0.08 }), c, rad * 1.09)];
  // 月（中心 c・半径 rad）。クレーターは暗い斑と明るいふち
  const moonParts = (c, rad, seed = 3, n = 34) => {
    const r = rng(seed), p = [sphere(m("#B9BDC4"), c, rad)], th = Math.min(rad * 0.02, 0.12);
    for (let i = 0; i < 8; i++) p.push(patch(m("#8E939C"), c, rad, dirRand(r), rad * (0.2 + r() * 0.2), th, -th * 0.4)); // 海（暗い所）
    for (let i = 0; i < n; i++) {
      const d = dirRand(r), a = rad * (0.04 + r() * 0.1);
      p.push(patch(m("#D4D7DC"), c, rad, d, a * 1.25, th, -th * 0.3), patch(m("#7E838C"), c, rad, d, a, th, -th * 0.1));
    }
    return p;
  };
  // 人工衛星（箱の組み合わせ）。大きさ s
  const satelliteParts = (s = 1, gold = true) => [
    box(m(gold ? "#D9A441" : "#D8DCE2"), [0, 0, 0], [0.5 * s, 0.5 * s, 0.7 * s]),
    box(m("#23356B"), [-0.95 * s, 0, 0], [1.2 * s, 0.03 * s, 0.5 * s]), box(m("#23356B"), [0.95 * s, 0, 0], [1.2 * s, 0.03 * s, 0.5 * s]),
    box(m("#AEB4BC"), [0, 0, 0], [2.0 * s, 0.04 * s, 0.04 * s]),
    cone(m("#E5E8EC"), [0, 0.25 * s, 0.3 * s], 0.22 * s, 0.25 * s), sphere(EM("#FF5A4A"), [0.2 * s, 0.27 * s, -0.3 * s], 0.04 * s),
  ];
  // 宇宙ステーション（白い筒と、長い骨組みと、たくさんの太陽電池）。大きさ s
  const stationParts = (s = 1) => {
    const p = [box(m("#C8CDD4"), [0, 0, 0], [5.2 * s, 0.12 * s, 0.12 * s])];
    for (const x of [-2.3, -1.6, 1.6, 2.3]) for (const z of [-1, 1]) p.push(box(m("#2A3F7A"), [x * s, 0, z * 0.85 * s], [0.55 * s, 0.02 * s, 1.5 * s]), box(m("#8A93A0"), [x * s, 0, z * 0.85 * s], [0.04 * s, 0.03 * s, 1.5 * s]));
    p.push(cyl(m("#EEF0F2"), [0, 0, 0], 0.22 * s, 2.2 * s, Q.axis([1, 0, 0], Math.PI / 2)), cyl(m("#E2E5E9"), [0, 0, 0], 0.2 * s, 1.4 * s, Q.axis([0, 0, 1], Math.PI / 2)));
    p.push(box(m("#F2F2F2"), [0.5 * s, 0.25 * s, 0.6 * s], [0.6 * s, 0.02 * s, 0.35 * s]), box(m("#D9A441"), [0, -0.3 * s, -0.7 * s], [0.4 * s, 0.4 * s, 0.4 * s]));
    p.push(sphere(EM("#FF4D4D"), [2.6 * s, 0.1 * s, 0], 0.05 * s), sphere(EM("#7CFF8A"), [-2.6 * s, 0.1 * s, 0], 0.05 * s));
    return p;
  };

  // ==================== 宇宙 1：地球（36〜42秒） ====================
  const RE = 4, RO = 4.75, UP = [0, 1, 0];
  const radial = (th) => [Math.cos(th), 0, Math.sin(th)];
  const tangent = (th) => [-Math.sin(th), 0, Math.cos(th)];
  const onRing = (th, rr = RO, h = 0) => [rr * Math.cos(th), h, rr * Math.sin(th)];
  const plateQ = (rUp, spin) => Q.mul(Q.fromY(rUp), Q.yaw(spin));
  const E1 = R(36, 37.1), E2 = R(37.1, 38), E3 = R(38, 39), E4 = R(39, 40), E5 = R(40, 42);
  const EARTH = [E1[0], E5[1]];
  const earth = sc.add("fi-earth", earthParts([0, 0, 0], RE));
  earth.anim(...EARTH, (f) => T([0, 0, 0], Q.yaw(-0.22 * (tOf(f) - 36))));
  sc.add("fi-air", airParts([0, 0, 0], RE)).at(E2[0], E2[1]).at(E4[0], E5[1]); // 大気のふち（寄りでは外す。近いと板に見える）

  // 皿の輪。輪の上の位置は「玉子からの角度のずれ」で決める
  const RING_N = 56, RING_GAP = (Math.PI * 2) / RING_N;
  // 輪がどれだけ回ったか（玉子の角度）。寄りではゆっくり、引きでは速く
  const eggTh = (t) => (t < 37.1 ? 0.35 + 0.12 * (t - 36) : 1.0 + 1.25 * (t - 37.1));
  // 寄り（36〜37.1）：玉子と、その前後の本物の皿
  const NEAR = 10;
  for (let k = 0; k <= NEAR; k++) {
    const egg = k === 0, r = rng(400 + k), wob = r() * 6, spin0 = r() * 6;
    sc.add(egg ? "fi-egg-orbit" : "fi-plate-orbit", kit.plateParts(egg ? "sushi-egg" : kit.sushiKind(k + 9), k % 2 === 0)).anim(...E1, (f) => {
      const t = tOf(f), th = eggTh(t) + k * RING_GAP, h = egg ? 0 : Math.sin(t * 2 + wob) * 0.04;
      return T(onRing(th, RO + (egg ? 0 : (k % 3) * 0.03), h), plateQ(radial(th), spin0 + (egg ? 0.4 : 0.9) * t));
    });
  }
  // 逆向きに回る、となりの列の皿（すれ違う）
  for (let k = 0; k < 16; k++) {
    const r = rng(600 + k), spin0 = r() * 6;
    sc.add("fi-plate-pass", kit.plateParts(kit.sushiKind(k + 3), k % 2 === 1)).anim(...E1, (f) => {
      const t = tOf(f), th = eggTh(36) + 1.3 - k * RING_GAP * 1.1 - 0.75 * (t - 36);
      return T(onRing(th, RO + 0.1, 0.62 + Math.sin(t * 3 + k) * 0.02), plateQ(radial(th), spin0 + 2 * t));
    });
  }
  // 引き（37.1〜38）：輪は光の筋
  for (let i = 0; i < RING_N; i++) {
    const egg = i === 0, len = egg ? 0.55 : 0.36, w = egg ? 0.12 : 0.07;
    sc.add(egg ? "fi-egg-ring" : "fi-ring", streakParts(egg ? YOLK : GLOW)).anim(...E2, (f) => {
      const th = eggTh(tOf(f)) + i * RING_GAP;
      return seg(onRing(th - len / RO), onRing(th), w);
    });
  }
  // 宇宙ステーション：寄りのカットで、皿の列の上を逆向きに通り過ぎる
  sc.add("fi-station", stationParts(0.3)).anim(...E1, (f) => {
    const t = tOf(f), th = eggTh(t) + lerp(0.75, -0.25, (t - 36) / 1.1);
    return T(onRing(th, RO + 0.6, -0.45), Q.mul(Q.fromY(radial(th)), Q.yaw(0.3 + 0.2 * (t - 36))));
  });
  sc.add("fi-station-far", stationParts(0.35)).anim(E2[0], E4[1], (f) => {
    const t = tOf(f), th = 2.9 - 0.5 * (t - 37.1);
    return T(onRing(th, RE + 1.1, 0.7), Q.mul(Q.fromY(radial(th)), Q.yaw(t)));
  });
  for (let i = 0; i < 5; i++) { // 小さな人工衛星
    const r = rng(90 + i), th0 = r() * 6.28, rr = RE + 1.4 + r() * 1.2, tilt = (r() > 0.5 ? 1 : -1) * (0.7 + r() * 0.9), w = 0.15 + r() * 0.2;
    sc.add("fi-sat", satelliteParts(0.1 + r() * 0.06, i % 2 === 0)).anim(...EARTH, (f) => { const t = tOf(f), th = th0 + w * t; return T(onRing(th, rr, tilt), Q.euler(t * 0.7 + i, t * 0.5, 0.3)); });
  }

  // 寄り：玉子に付いていくカメラ。地球は下、皿の列は前へ弧を描いて続く
  ctx.shot("fi-e1", E1, shotSpace([0.4, 0.5, 0.75]), (f, k) => {
    const t = tOf(f), th = eggTh(t), p = onRing(th), rU = radial(th), tg = tangent(th);
    const side = lerp(0.55, 0.15, ease(k));
    const off = V.add(V.add(V.mul(tg, -0.95), V.mul(rU, 0.55)), V.mul(UP, side));
    return { pos: V.add(p, off), target: V.add(V.sub(p, V.mul(off, 0.5)), V.mul(rU, 0.1)), up: rU, fov: 52 };
  });
  // 引き：輪になって回る筋と地球
  ctx.shot("fi-e2", E2, shotSpace([0.6, 0.45, 0.7]), ctx.dolly({ pos: [3.6, 8, 19.6], target: [0, -1.2, 0], fov: 40 }, { pos: [1.6, 6.8, 20.8], target: [0, -1, 0] }));
  ctx.tag("地球", 37.25, 37.95, () => [-0.5, 0.4, RE * 0.97]);
  ctx.tag("玉子", 37.2, 37.95, (f) => onRing(eggTh(tOf(f)), RO, 0.06));

  // ---------- 地球を出ていく（38〜40） ----------
  // 玉子：輪を離れて、ぐるりと回りながら外へ
  const leave = (u, th0, out = 1) => { const rr = RO + 0.6 * u + 8.4 * u ** 3 * out, th = th0 + 0.9 * u; return { p: onRing(th, rr, 1.2 * u * u * out), th }; };
  const TH38 = 0.4;
  sc.add("fi-egg-leave", kit.plateParts("sushi-egg")).anim(...E3, (f) => { const u = tOf(f) - 38, { p, th } = leave(u, TH38); return T(p, plateQ(radial(th), 0.5 + 1.4 * u)); });
  for (let k = 1; k <= 9; k++) { // まわりの皿も、少しずつ遅れて離れていく
    const r = rng(500 + k), d = -(0.06 + k * 0.035), lag = r() * 0.4, h = (r() - 0.5) * 0.7;
    sc.add("fi-plate-leave", kit.plateParts(kit.sushiKind(k), k % 2 === 0)).anim(...E3, (f) => {
      const u = Math.max(0, tOf(f) - 38 - lag * 0.5), { p, th } = leave(u * (0.85 + r() * 0.0), TH38 + d);
      return T(V.add(p, [0, h, 0]), plateQ(radial(th), k + 2 * u));
    });
  }
  // 輪に残っている皿（遠くで回り続ける筋）
  for (let i = 5; i < RING_N - 4; i += 2) sc.add("fi-ring3", streakParts(GLOW)).anim(...E3, (f) => { const th = TH38 + 0.6 * (tOf(f) - 38) + i * RING_GAP; return seg(onRing(th - 0.08), onRing(th), 0.06); });
  ctx.shot("fi-e3", E3, shotSpace([0.3, 0.6, 0.75]), (f, k) => {
    const u = tOf(f) - 38, { p, th } = leave(u, TH38), rU = radial(th), tg = tangent(th);
    const off = V.add(V.add(V.mul(tg, -0.3), V.mul(rU, 0.95)), V.mul(UP, 0.4));
    const pos = V.add(p, V.mul(off, 1 + 2.5 * u * u));
    return { pos, target: V.lerp(p, [0, 0, 0], 0.03), up: tg, fov: 52 };
  });
  ctx.tag("玉子", 38.15, 38.9, (f) => V.add(leave(tOf(f) - 38, TH38).p, [0, 0.06, 0]));

  // 引き（39〜40）：皿が四方へ飛び出していく
  const burst = [];
  {
    const r = rng(77);
    for (let i = 0; i < 64; i++) {
      const egg = i === 0, th = egg ? 1.15 : r() * 6.28, t0 = egg ? 39.15 : 39 + r() * 0.85;
      const dir = egg ? V.norm([0.35, 0.42, 1]) : V.norm(V.add(V.add(radial(th), V.mul(tangent(th), 0.5)), [0, (r() - 0.5) * 1.2, 0]));
      burst.push({ egg, th, t0, dir, from: onRing(th, RO, 0), acc: 12 + r() * 10 });
    }
    for (const b of burst) {
      const head = (t) => V.add(b.from, V.mul(b.dir, b.acc * (t - b.t0) ** 2 + 1.2 * (t - b.t0)));
      sc.add(b.egg ? "fi-egg-burst" : "fi-burst", streakParts(b.egg ? YOLK : GLOW)).anim(...E4, (f) => {
        const t = tOf(f);
        if (t < b.t0) return seg(onRing(b.th + 1.0 * (t - 39) - 0.07), onRing(b.th + 1.0 * (t - 39)), 0.06); // 飛び出す前は輪の上
        const h = head(t), tail = head(Math.max(b.t0, t - 0.09));
        return seg(V.sub(tail, V.mul(b.dir, 0.12)), h, b.egg ? 0.13 : 0.065);
      });
      b.head = head;
    }
  }
  const C4 = [11.6, 6.8, 23.6];
  sc.add("fi-sat-near", satelliteParts(0.24, true)).anim(...E4, (f) => T(V.add(C4, [-0.7, 0.35, -1.7]), Q.euler(0.5 + 0.3 * (tOf(f) - 39), 2.2 + 0.4 * (tOf(f) - 39), 0.2)));
  ctx.shot("fi-e4", E4, shotSpace([0.5, 0.5, 0.7]), ctx.dolly({ pos: C4, target: [0.8, 1.6, 0], fov: 46 }, { pos: V.add(C4, [1.2, 0.8, 3.2]), target: [1.2, 2, 0] }));
  ctx.tag("玉子", 39.3, 39.95, (f) => burst[0].head(Math.max(39.15, tOf(f))));

  // ---------- 地球が小さくなる（40〜42）：カメラが一気に下がる。筋はカメラを追い越して外へ ----------
  const D5 = V.norm([0.3, 0.28, 1]);
  const dist5 = (t) => 22 * Math.exp(Math.log(280 / 22) * clamp((t - 40) / 2) ** 1.25);
  const RIGHT5 = V.norm(V.cross(V.mul(D5, -1), UP)), UP5 = V.cross(RIGHT5, V.mul(D5, -1));
  const MOON5 = V.add(V.add(V.mul(RIGHT5, -22), V.mul(UP5, -16)), V.mul(D5, -60));
  sc.add("fi-moon5", moonParts(MOON5, 1.8, 5, 16)).at(...E5);
  {
    const r = rng(55);
    for (let i = 0; i < 46; i++) {
      const egg = i === 0, t0 = egg ? 40.25 : 40 + r() * 1.9, dir = egg ? V.norm(V.add(D5, [0.06, -0.035, 0])) : V.norm(V.add(V.mul(D5, 0.6 + r()), V.mul(dirRand(r), 0.9)));
      const v = egg ? 180 : 60 + r() * 180, from = V.mul(dir, RE + 0.2);
      sc.add(egg ? "fi-egg-out" : "fi-out", streakParts(egg ? YOLK : GLOW)).anim(Math.max(E5[0], fOf(t0)), E5[1], (f) => {
        const u = Math.max(0, tOf(f) - t0), h = V.add(from, V.mul(dir, v * u)), L = Math.min(v * u, v * 0.06 + 0.8);
        const w = (egg ? 0.18 : 0.09) * (1 + V.len(h) / 24);
        return seg(V.sub(h, V.mul(dir, L)), h, w);
      });
    }
  }
  ctx.shot("fi-e5", E5, shotSpace([0.5, 0.45, 0.75]), (f) => {
    const t = tOf(f), d = dist5(t);
    return { pos: V.mul(D5, d), target: [0, -0.04 * d, 0], fov: 42 };
  });
  ctx.tag("地球", 40.4, 41.9, () => [0, -RE * 0.6, RE * 0.6]);
  ctx.tag("月", 41.1, 41.9, () => V.add(MOON5, V.mul(UP5, -1.4)));


  // 筋の束：spawn(i) が {t0, from, dir, v, len, w, egg} を返す。範囲 rng の中で飛ばす
  const flight = (id, rangeF, n, spawn) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = spawn(i), f0 = Math.max(rangeF[0], fOf(s.t0)), f1 = Math.min(rangeF[1], fOf(s.t0 + (s.life ?? 3)));
      if (f1 < f0) continue;
      const head = (t) => V.add(s.from, V.mul(s.dir, s.v * (t - s.t0)));
      sc.add(s.egg ? id + "-egg" : id, streakParts(s.egg ? YOLK : GLOW)).anim(f0, f1, (f) => { const t = tOf(f), h = head(t); return seg(V.sub(h, V.mul(s.dir, s.len)), h, s.w); });
      out.push({ ...s, head });
    }
    return out;
  };

  // ==================== 宇宙 2：月（42〜46秒） ====================
  const M1 = R(42, 44), M2 = R(44, 46);
  sc.add("fi-moon", moonParts([0, 0, 0], 10, 3, 40)).anim(...M1, (f) => T([0, 0, 0], Q.yaw(0.05 * (tOf(f) - 42))));
  sc.add("fi-earth-m1", [...earthParts([0, 0, 0], 9, 8), ...airParts([0, 0, 0], 9)]).anim(...M1, (f) => T([-260, 70, -620], Q.yaw(0.3 * (tOf(f) - 42))));
  sc.add("fi-orbiter", satelliteParts(0.9, false)).anim(...M1, (f) => { const t = tOf(f) - 42; return T([-13 + 3.2 * t, 6.5 - 0.8 * t, 9], Q.euler(0.4, 1.2 + 0.5 * t, 0.2)); });
  const moonFly = flight("fi-mstreak", M1, 34, (i) => {
    const r = rng(1200 + i), egg = i === 0;
    return egg ? { egg, t0: 42.35, from: [-70, 3, 26], dir: V.norm([1, 0.02, -0.08]), v: 120, len: 14, w: 0.9, life: 1.2 }
      : { t0: 41.6 + r() * 2.4, from: [-90, -16 + r() * 28, -30 + r() * 70], dir: V.norm([1, (r() - 0.5) * 0.1, (r() - 0.5) * 0.3]), v: 120 + r() * 120, len: 10 + r() * 14, w: 0.45, life: 1.6 };
  });
  ctx.shot("fi-m1", M1, shotSpace([-0.7, 0.3, 0.6]), ctx.dolly({ pos: [-30, 9, 52], target: [-2, 6, 0], fov: 40 }, { pos: [-12, 5, 58], target: [3, 5, 0] }));
  ctx.tag("月", 42.3, 43.9, () => [-1, 3.5, 9.3]);
  ctx.tag("玉子", 42.45, 42.95, (f) => moonFly[0].head(tOf(f)));
  // 月の地面から：大きい月の上。地球が昇り、頭の上を筋が渡っていく
  // 地面は平らな箱（大きい球の低い多面体は、近くで見ると板が浮いて見えるため）。クレーターの輪・暗い窪み・岩・着陸船
  {
    const r = rng(1300), g = [box(m("#A9AEB6"), [0, -0.5, -150], [500, 1, 400])];
    for (let i = 0; i < 40; i++) {
      const x = (r() - 0.5) * 60, z = 1 - r() * 70, a = 0.5 + r() ** 2 * 4;
      g.push(cyl(m("#8A8F98"), [x, 0.005, z], a, 0.02), { ...torus(m("#C9CDD3"), [x, 0.02, z], a * 1.08), t: T([x, 0.02, z], Q.id(), [a * 1.08, 2.2, a * 1.08]) });
    }
    for (let i = 0; i < 90; i++) { const x = (r() - 0.5) * 30, z = 1.2 - r() * 40, s2 = 0.06 + r() ** 2 * 0.5; g.push(sphere(m(i % 3 ? "#9EA3AB" : "#C3C6CC"), [x, s2 * 0.25, z], [s2, s2 * 0.6, s2 * 0.8])); }
    g.push(box(m("#D9A441"), [2.2, 0.75, -5.5], [0.9, 0.6, 0.9]), box(m("#C8CDD4"), [2.2, 1.25, -5.5], [0.6, 0.45, 0.6]), cyl(m("#8A93A0"), [2.2, 0.35, -5.5], 0.35, 0.25));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.push(box(m("#AEB4BC"), [2.2 + dx * 0.55, 0.3, -5.5 + dz * 0.55], [0.06, 0.65, 0.06], Q.euler(dz * 0.35, 0, -dx * 0.35)));
    g.push(cyl(m("#E5E8EC"), [0.6, 0.5, -4.2], 0.015, 1.0), box(m("#D7263D"), [0.82, 0.88, -4.2], [0.42, 0.26, 0.01]), box(m("#FFFFFF"), [0.82, 0.88, -4.19], [0.14, 0.14, 0.01]));
    for (let i = 0; i < 8; i++) g.push(box(m("#8A8F98"), [0.3 + i * 0.25, 0.01, -3.2 - i * 0.2], [0.12, 0.02, 0.18])); // 足あと
    sc.add("fi-moon-ground", g).at(...M2);
  }
  sc.add("fi-earth-m2", [...earthParts([0, 0, 0], 16, 8), ...airParts([0, 0, 0], 16)]).anim(...M2, (f) => T([62, 58 + 8 * (tOf(f) - 44), -260], Q.yaw(0.25 * (tOf(f) - 44))));
  const skyFly = flight("fi-sstreak", M2, 30, (i) => {
    const r = rng(1400 + i), egg = i === 0;
    return egg ? { egg, t0: 44.5, from: [-40, 64, -240], dir: V.norm([1, 0.02, 0]), v: 110, len: 30, w: 3.0, life: 1.6 }
      : { t0: 43.5 + r() * 2.5, from: [-120, i % 3 ? 40 + r() * 50 : 55 + r() * 20, i % 3 ? -60 - r() * 150 : -235], dir: V.norm([1, (r() - 0.5) * 0.1, (r() - 0.5) * 0.1]), v: 80 + r() * 90, len: 14 + r() * 20, w: i % 3 ? 1.5 : 2.4, life: 2.5 };
  });
  ctx.shot("fi-m2", M2, shotSpace([-0.8, 0.35, -0.5]), ctx.dolly({ pos: [-0.5, 0.55, -0.4], target: [1.6, 1.05, -5.2], fov: 52 }, { pos: [-0.2, 0.6, -0.9], target: [1.7, 1.1, -5.2] }));

  // ==================== 宇宙 3：太陽（46〜49秒） ====================
  const S1 = R(46, 47.5), S2 = R(47.5, 49), RS = 120;
  {
    const r = rng(1500), p = [sphere(EM("#FFC25A"), [0, 0, 0], RS)];
    for (let i = 0; i < 40; i++) p.push(patch(EM(i % 4 === 0 ? "#FFE9A8" : "#FF9A2E"), [0, 0, 0], RS, dirRand(r), RS * (0.06 + r() * 0.12), RS * 0.01, RS * 0.002));
    for (let i = 0; i < 7; i++) p.push(patch(EM("#B4471A"), [0, 0, 0], RS, V.norm([0.2 + r() * 0.6 - 0.3, 0.3 + r() * 0.6, 0.6 + r() * 0.3]), RS * (0.02 + r() * 0.03), RS * 0.006, RS * 0.006)); // 黒点
    for (let i = 0; i < 14; i++) { // 紅炎：ふちから立つ輪
      const d = dirRand(r), tg = V.norm(V.cross(d, dirRand(r)));
      p.push({ ...torus(EM(i % 2 ? "#FF7A1A" : "#FFC24A"), V.mul(d, RS * 0.97), RS * (0.1 + r() * 0.12)), t: T(V.mul(d, RS * 0.97), Q.fromY(tg), RS * (0.1 + r() * 0.12)) });
    }
    p.push(sphere(EM("#FFD27A", 0.25), [0, 0, 0], RS * 1.05), sphere(EM("#FFC25A", 0.1), [0, 0, 0], RS * 1.18), sphere(EM("#FFB547", 0.05), [0, 0, 0], RS * 1.45));
    sc.add("fi-sun", p).anim(S1[0], S2[1], (f) => T([0, 0, 0], Q.yaw(0.02 * (tOf(f) - 46))));
  }
  sc.add("fi-mercury", [sphere(m("#7D7470"), [0, 0, 0], 7), patch(m("#5E5652"), [0, 0, 0], 7, V.norm([0.3, 0.5, 0.8]), 2, 0.2)]).anim(...S1, (f) => T([-290 + 12 * (tOf(f) - 46), -60, 300]));
  const sunFly = flight("fi-sunstreak", S1, 40, (i) => {
    const r = rng(1600 + i), egg = i === 0;
    return egg ? { egg, t0: 46.3, from: [-720, 40, 330], dir: V.norm([1, -0.03, -0.12]), v: 760, len: 70, w: 4.5, life: 1.2 }
      : { t0: 45.6 + r() * 1.9, from: [-800, -150 + r() * 380, 120 + r() * 300], dir: V.norm([1, (r() - 0.5) * 0.08, -0.15 + (r() - 0.5) * 0.15]), v: 600 + r() * 500, len: 50 + r() * 60, w: 2.6, life: 2 };
  });
  ctx.shot("fi-s1", S1, shotSpace([-0.5, 0.3, 0.8], 1.0), ctx.dolly({ pos: [-430, 70, 600], target: [-215, 10, 0], fov: 44 }, { pos: [-370, 55, 560], target: [-200, 5, 0] }));
  ctx.tag("太陽", 46.2, 47.4, () => [-112, -6, 42]);
  // ふちを、すれすれに
  const S2C = (t) => [-60 + 60 * (t - 47.5), 215, 165];
  const sun2Fly = flight("fi-sun2streak", S2, 36, (i) => {
    const r = rng(1700 + i), egg = i === 0;
    return egg ? { egg, t0: 47.6, from: [-130, 200, 85], dir: V.norm([1, 0.01, 0]), v: 150, len: 24, w: 1.4, life: 1.5 }
      : { t0: 47.0 + r() * 2.0, from: [-360, 170 + r() * 80, 20 + r() * 110], dir: V.norm([1, 0.02 + (r() - 0.5) * 0.06, (r() - 0.5) * 0.1]), v: 200 + r() * 250, len: 30 + r() * 40, w: 1.3, life: 2 };
  });
  ctx.shot("fi-s2", S2, shotSpace([0.2, 0.6, 0.8], 1.0), (f) => { const c = S2C(tOf(f)); return { pos: c, target: V.add(c, [0, -50, -160]), fov: 56 }; });
  ctx.tag("玉子", 47.8, 48.7, (f) => V.sub(sun2Fly[0].head(tOf(f)), [12, 0, 0]));

  // ==================== 宇宙 4：太陽系と銀河（49〜52秒） ====================
  const G1 = R(49, 50.4), G2 = R(50.4, 52);
  const ORBITS = [10, 15, 21, 28, 44, 62, 80, 96], PCOL = ["#9A918C", "#E3C48F", "#3A7BD5", "#C2552D", "#D9B98B", "#E8D5A0", "#9FD6E0", "#4A6FD9"], PR = [0.8, 1.2, 1.3, 1, 3.6, 3, 2.2, 2.1];
  {
    const r = rng(1800), p = [sphere(EM("#FFD27A"), [0, 0, 0], 5), sphere(EM("#FFC65C", 0.25), [0, 0, 0], 7.5), sphere(EM("#FFB547", 0.1), [0, 0, 0], 12)];
    ORBITS.forEach((rr, i) => {
      const n = Math.round(rr * 2.2);
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.283; p.push(sphere(EM("#5A6E9A"), [Math.cos(a) * rr, 0, Math.sin(a) * rr], 0.18 + rr * 0.002)); }
      const a = r() * 6.28; p.push(sphere(m(PCOL[i]), [Math.cos(a) * rr, 0, Math.sin(a) * rr], PR[i]));
      if (i === 5) p.push({ ...torus(m("#CDB98A"), [Math.cos(a) * rr, 0, Math.sin(a) * rr], 5.5), t: T([Math.cos(a) * rr, 0, Math.sin(a) * rr], Q.euler(0.4, 0, 0.2), [5.5, 2, 5.5]) });
    });
    for (let i = 0; i < 160; i++) { const a = r() * 6.283, rr = 34 + r() * 6; p.push(sphere(m("#8C8378"), [Math.cos(a) * rr, (r() - 0.5) * 1.2, Math.sin(a) * rr], 0.25 + r() * 0.3)); } // 小惑星帯
    sc.add("fi-solar", p).anim(...G1, (f) => T([0, 0, 0], Q.yaw(0.12 * (tOf(f) - 49))));
  }
  const solarFly = [];
  for (let i = 0; i < 26; i++) {
    const r = rng(1900 + i), egg = i === 0, a = egg ? 2.2 : r() * 6.283, dir = V.norm([Math.cos(a), egg ? 0.08 : (r() - 0.5) * 0.3, Math.sin(a)]), t0 = egg ? 49.05 : 49 + r() * 1.1, v = egg ? 85 : 70 + r() * 60;
    const head = (t) => V.mul(dir, 5 + v * Math.max(0, t - t0));
    sc.add(egg ? "fi-solar-egg" : "fi-solar-streak", streakParts(egg ? YOLK : GLOW)).anim(Math.max(G1[0], fOf(t0)), G1[1], (f) => { const t = tOf(f), h = head(t); return seg(V.mul(dir, 5 + Math.max(0, V.len(h) - 5 - 45)), h, egg ? 1.2 : 0.55); });
    solarFly.push(head);
  }
  ctx.shot("fi-g1", G1, shotSpace([0.3, 1, 0.4], 0.9), (f, k) => { const d = 120 * Math.exp(1.0 * ease(k)); return { pos: [0, d * 0.82, d * 0.6], target: [0, 0, -d * 0.05], fov: 46 }; });
  ctx.tag("太陽系", 49.15, 50.3, () => [0, -6, 4]);
  // 銀河：渦を巻く星の粒。太陽系の札から、筋が外へ伸びる
  const GAL_Q = Q.euler(0.5, 0.3, 0);
  const galRot = (f) => Q.mul(GAL_Q, Q.yaw(0.06 * (tOf(f) - 50.4)));
  {
    const r = rng(2000), p = [];
    for (let i = 0; i < 260; i++) { const a = r() * 6.283, rad = Math.abs(r() + r() - 1) * 70; p.push(sphere(EM(i % 3 ? "#FFE2A8" : "#FFF3D6"), [Math.cos(a) * rad, (r() - 0.5) * 22 * (1 - rad / 80), Math.sin(a) * rad], 1.4 + r() * 1.8)); }
    for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 300; i++) {
      const k = i / 300, rad = 40 + k * 330, a = arm * 2.094 + k * 4.6 + (r() - 0.5) * 0.45;
      p.push(sphere(EM(i % 6 === 0 ? "#FFC2E0" : i % 4 ? "#DCE9FF" : "#FFFFFF"), [Math.cos(a) * rad + (r() - 0.5) * 26, (r() - 0.5) * 8, Math.sin(a) * rad + (r() - 0.5) * 26], 0.9 + r() * 1.8));
    }
    for (let i = 0; i < 40; i++) { const k = r(), rad = 50 + k * 300, a = (i % 3) * 2.094 + k * 4.6; p.push(sphere(EM(i % 2 ? "#6A5AC8" : "#3A6AC8", 0.05), [Math.cos(a) * rad, 0, Math.sin(a) * rad], [18 + r() * 14, 3, 18 + r() * 14])); }
    sc.add("fi-galaxy", p).anim(...G2, (f) => T([0, 0, 0], galRot(f)));
  }
  const HOME = [235, 0, 70];
  const homeAt = (f) => Q.rot(galRot(f), HOME);
  const outDir = (f) => V.norm(V.add(V.mul(V.norm(homeAt(f)), 0.4), Q.rot(galRot(f), [0, 1, 0])));
  const grow = (f) => 6 + 420 * ease(clamp((tOf(f) - 50.55) / 1.35)) ** 1.2;
  sc.add("fi-gal-egg", streakParts(YOLK)).anim(...G2, (f) => { const h = homeAt(f); return seg(h, V.add(h, V.mul(outDir(f), grow(f))), 5); });
  sc.add("fi-gal-white", streakParts(GLOW)).anim(...G2, (f) => { const h = V.add(homeAt(f), [4, 0, 4]); return seg(h, V.add(h, V.mul(outDir(f), grow(f) * 0.86)), 3); });
  sc.add("fi-gal-home", [sphere(EM("#FFFFFF"), [0, 0, 0], 4), sphere(EM("#FFD23F", 0.35), [0, 0, 0], 9)]).anim(...G2, (f) => T(homeAt(f)));
  ctx.shot("fi-g2", G2, shotSpace([0.3, 1, 0.4], 0.9), ctx.dolly({ pos: [-80, 520, 980], target: [110, -40, 30], fov: 48, up: [0, 1, 0] }, { pos: [-60, 600, 1120], target: [110, -20, 30] }));
  ctx.tag("太陽系", 50.5, 51.9, (f) => homeAt(f));
  ctx.tag("銀河", 50.6, 51.9, () => [-40, -30, 120]);


  // ==================== 跡地（52〜69秒）と締め（69〜74秒） ====================
  const RU = [fOf(52), ctx.END[1]];
  const YX = kit.SEATS[kit.YAMADA_SEAT], YZ = kit.SEAT_Z, CH = kit.CHEF_POS;
  const YHEAD = [YX, 1.3, YZ], CHEAD = [CH[0], CH[1] + 1.12, CH[2]];
  {
    const r = rng(5200), g = [box(m("#6E5240"), [0, -0.1, 0], [260, 0.2, 260])];
    // 焦げ跡と灰
    for (let i = 0; i < 34; i++) { const a = r() * 6.28, d = 2 + r() * 22; g.push(cyl(m(i % 3 ? "#3A2A22" : "#56443A"), [Math.cos(a) * d, 0.004 + i * 0.0002, Math.sin(a) * d], 0.8 + r() * 2.6, 0.008)); }
    // 床板の残り（焦げて、ところどころ抜けている）
    for (let i = 0; i < 40; i++) {
      if (r() < 0.35) continue;
      const x = -4.875 + i * 0.25, z0 = -0.85 + r() * 0.8, z1 = 3.3 - r() * 1.6;
      g.push(box(m(["#8A6A48", "#6B4E34", "#4A3626", "#9A7852"][i % 4]), [x, 0.015, (z0 + z1) / 2], [0.235, 0.03, z1 - z0]));
    }
    // 厨房の一段高い床（大将の足場）。端は崩れている
    g.push(box(m("#8E9299"), [-0.4, kit.KITCHEN_Y / 2, -1.6], [5.6, kit.KITCHEN_Y, 1.5]), box(m("#6F737A"), [2.7, 0.12, -1.5], [0.8, 0.24, 1.1], Q.euler(0, 0.3, 0.2)));
    // 壁の根もと（低く崩れた残り）
    const stub = (x, z, w, d) => g.push(box(m(r() < 0.5 ? "#E6DCCB" : "#5A463A"), [x, 0.1 + r() * 0.25, z], [w, 0.2 + r() * 0.6, d]));
    for (let x = -4.8; x < 5; x += 0.9) { if (r() < 0.7) stub(x, -2.55, 0.8, 0.2); if (r() < 0.45) stub(x, 3.42, 0.8, 0.2); }
    for (let z = -2.2; z < 3.3; z += 0.9) { if (r() < 0.6) stub(-5.1, z, 0.2, 0.8); if (r() < 0.6) stub(5.1, z, 0.2, 0.8); }
    // 瓦礫
    for (let i = 0; i < 90; i++) {
      const a = r() * 6.28, d = 5.6 + r() ** 1.4 * 24, sz = 0.15 + r() * 1.1;
      g.push(box(m(["#E6DCCB", "#7A3B3B", "#5B3B22", "#8C8C8C", "#C9B79A"][i % 5]), [Math.cos(a) * d, sz * 0.22, Math.sin(a) * d * 0.8 + 0.3], [sz, sz * 0.45, sz * 0.8], Q.euler((r() - 0.5) * 0.6, r() * 6, (r() - 0.5) * 0.6)));
    }
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = 6 + r() * 12, L = 1.5 + r() * 2.5; g.push(box(m("#4A3626"), [Math.cos(a) * d, 0.1, Math.sin(a) * d], [0.14, 0.14, L], Q.euler(0.1, r() * 6, 0.15))); } // 焼けた柱
    const deb = ["debris-plate-a", "debris-plate-b", "debris-door", "debris-bumper", "debris-tire", "debris-spoiler-a", "debris-door-window", "debris-drivetrain"];
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = 5.8 + r() * 10; g.push(model(kit.car(deb[i % deb.length]), { w: 0.7 + r() * 0.7, pos: [Math.cos(a) * d, 0, Math.sin(a) * d], quat: Q.euler((r() - 0.5) * 0.4, r() * 6, (r() - 0.5) * 0.4) })); }
    g.push(model(kit.car("sedan"), { w: 2.0, pos: [-8.5, 0.9, 7.5], quat: Q.euler(0, 0.6, 1.57) }), model(kit.car("taxi"), { w: 2.0, pos: [9.5, 0, -6], quat: Q.euler(0, 2.2, 0.15) }));
    // 割れた皿と倒れた椅子
    for (let i = 0; i < 16; i++) { const x = (r() - 0.5) * 9, z = r() < 0.5 ? 0.6 + r() * 2.4 : -0.6 - r() * 0.3; g.push(model(kit.food("plate-broken"), { w: 0.2 + r() * 0.1, pos: [x, z > 0.05 && z < 0.5 ? kit.COUNTER_Y : 0.01, z], quat: Q.yaw(r() * 6) })); }
    kit.SEATS.forEach((x, i) => { if (i !== kit.YAMADA_SEAT) g.push(model(kit.furn("stoolBar"), { h: 0.62, pos: [x + (r() - 0.5) * 0.6, 0.14, kit.SEAT_Z + 0.4 + r() * 0.6], quat: Q.euler(0, r() * 6, 1.57) })); });
    g.push(model(kit.furn("stoolBar"), { h: 0.62, pos: [YX, 0, YZ] }));
    // ヤマダの醤油皿（湯のみは動かすので別）
    for (const it of kit.seatItems()) if (it.seat === kit.YAMADA_SEAT && (it.kind === "soy" || it.kind === "chopstick")) g.push(kit.itemPart(it));
    // 遠くの街の影（霧で夕焼け色に沈む）と、低い夕日
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * 6.28 + r() * 0.1, d = 34 + r() * 26, h = 6 + r() * 18, n = String.fromCharCode(97 + (i % 14));
      g.push(model(kit.city(`low-detail-building-${n}`), { h, pos: [Math.cos(a) * d, 0, Math.sin(a) * d], quat: Q.yaw(r() * 6) }));
      if (i % 2) g.push(box(m("#5A4048"), [Math.cos(a + 0.07) * (d + 6), h * 0.35, Math.sin(a + 0.07) * (d + 6)], [5 + r() * 6, h * 0.7, 5]));
    }
    g.push(sphere(EM("#FFF1D6"), V.mul(V.norm([-5, 1.4, -3]), 44), 4.2));
    // 地面の残り火
    for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = 1.5 + r() * 14; g.push(sphere(EM(i % 2 ? "#FF7A2A" : "#FFB347"), [Math.cos(a) * d, 0.03, Math.sin(a) * d], 0.03 + r() * 0.05)); }
    sc.add("fi-ruin", g).at(...RU);
    sc.add("fi-counter", [...kit.counterParts(m), ...kit.laneBaseParts(m)]).at(...RU);
  }
  // ---------- レーン：赤く焼け → 白く光り → 光の柱 → 静まる ----------
  const BELT_RED = [fOf(52), fOf(60.4)], BELT_WHITE = [fOf(59.6), fOf(66.3)], BELT_CALM = [fOf(66.2), RU[1]];
  const kf = (a, b) => (f) => clamp((tOf(f) - a) / (b - a));
  sc.add("fi-belt-red", [kit.beltPart(EM("#FF4A1A")), box(EM("#FF7A2A", 0.35), [0, kit.LANE_Y + 0.03, kit.LANE_Z], [10.1, 0.06, 0.5])]).at(...BELT_RED).fade(...BELT_RED, (f) => 1 - kf(59.6, 60.4)(f));
  sc.add("fi-belt-white", [{ ...kit.beltPart(EM("#FFF6E6")), t: T([0, kit.LANE_Y - 0.008, kit.LANE_Z], Q.id(), [10, 0.02, 0.3]) }, box(EM("#FFFFFF", 0.4), [0, kit.LANE_Y + 0.04, kit.LANE_Z], [10.2, 0.08, 0.62])]).at(...BELT_WHITE).fade(...BELT_WHITE, (f) => kf(59.6, 60.4)(f) * (1 - kf(66.0, 66.3)(f)));
  sc.add("fi-belt-calm", [{ ...kit.beltPart(m("#2F3338")), t: T([0, kit.LANE_Y - 0.006, kit.LANE_Z], Q.id(), [10, 0.02, 0.3]) }]).at(...BELT_CALM);
  // ベルトの上を走る光の箱（流れ続ける筋）
  for (let i = 0; i < 22; i++) {
    const r = rng(5300 + i), per = 0.35 + r() * 0.5, ph = r() * per, len = 0.6 + r() * 1.4, sp = 26 + r() * 10, dz = (r() - 0.5) * 0.16;
    sc.add("fi-belt-run", streakParts(i % 4 ? "#FFE2B0" : "#FFFFFF")).anim(fOf(52), fOf(66.2), (f) => {
      const u = ((tOf(f) + ph) % per) / per, x = -5.5 + u * 11 + len / 2;
      if (x - len > 5 || x < -5) return HIDE;
      return T([clamp(x - len / 2, -5 + len / 2, 5 - len / 2), kit.LANE_Y + 0.02, kit.LANE_Z + dz], Q.id(), [Math.min(len, 10), 0.025, 0.05]);
    });
  }
  // 火花：ベルトから舞い上がって消える
  for (let i = 0; i < 80; i++) {
    const r = rng(5400 + i), per = 0.8 + r() * 0.9, ph = r() * per, x0 = (r() - 0.5) * 9.6, h = 1.2 + r() * 2.4, dx = (r() - 0.5) * 0.8, dz = (r() - 0.5) * 0.8, sz = 0.018 + r() * 0.03;
    sc.add("fi-spark", [sphere(EM(i % 3 ? "#FFB060" : "#FFF3C4"), [0, 0, 0], 1)]).anim(fOf(52), fOf(66.3), (f) => {
      const u = ((tOf(f) + ph) % per) / per, hot = tOf(f) < 60 ? 1 : 1.3;
      return T([x0 + dx * u + Math.sin(u * 9 + i) * 0.05, kit.LANE_Y + 0.03 + h * hot * (1 - (1 - u) ** 2), kit.LANE_Z + dz * u], Q.id(), sz * (1 - u * 0.85));
    });
  }
  // 煙：瓦礫から立ちのぼる
  const SMOKE = [[-7, 0, -4], [8, 0, 3], [-3, 0, 9], [11, 0, -9], [-12, 0, 2], [6.5, 0, -7]];
  SMOKE.forEach((s0, j) => {
    for (let i = 0; i < 6; i++) {
      const r = rng(5500 + j * 10 + i), per = 3.2 + r() * 1.5, ph = (i / 6) * per;
      const puff = sc.add("fi-smoke", [sphere(m(j % 2 ? "#8A7A70" : "#A08E82", { opacity: 0.32 }), [0, 0, 0], 1)]);
      const u = (f) => ((tOf(f) + ph) % per) / per;
      puff.anim(...RU, (f) => { const k = u(f); return T(V.add(s0, [Math.sin(k * 3 + j) * 0.6 + k * 1.5, 0.4 + k * 7, k * 0.8]), Q.id(), 0.4 + k * 1.8); });
      puff.fade(...RU, (f) => { const k = u(f); return clamp(k / 0.15) * (1 - k); });
    }
  });
  // 光の柱（64〜66）：レーンから上へ伸びる
  const COL = [fOf(64), fOf(66.3)];
  const colH = (f) => 0.2 + 240 * ease(kf(64, 64.9)(f)) ** 1.6;
  sc.add("fi-column", [box(EM("#FFFFFF"), [0, 0, 0], [1.1, 1, 0.3])]).anim(...COL, (f) => T([0, kit.LANE_Y + colH(f) / 2, kit.LANE_Z], Q.id(), [1, colH(f), 1]));
  sc.add("fi-column-glow", [box(EM("#FFF3C4", 0.22), [0, 0, 0], [1.8, 1, 0.9])]).anim(...COL, (f) => T([0, kit.LANE_Y + colH(f) / 2, kit.LANE_Z], Q.id(), [1, colH(f), 1])).fade(...COL, (f) => 1 - kf(66.0, 66.3)(f));
  ctx.hit(64.05, 0.6);
  ctx.flash(66, 1, 20);
  ctx.calm(66.3, 69);

  // ---------- 人 ----------
  // オチ：68.3秒、黄色い筋がヤマダの顔の手前を横切る。ヤマダは筋を追って体ごと右へ振り向く
  const PASS = 68.3, turnK = (t) => ease(clamp((t - (PASS + 0.08)) / 0.3));
  const yam = kit.person(sc, "fi-yamada", ep.cast.yamada.look).at(RU[0], fOf(68.1) - 1, kit.seatT(kit.YAMADA_SEAT))
    .anim(fOf(68.1), RU[1], (f) => T([YX, kit.SIT_Y, YZ], Q.yaw(Math.PI - 0.7 * turnK(tOf(f)))));
  const DRINK = [fOf(56), fOf(60) - 1];
  yam.clip(RU[0], DRINK[0] - 1, "sit", () => 0.1).clip(...DRINK, "holding-right", () => 0.05).clip(DRINK[1] + 1, RU[1], "sit", () => 0.1);
  const chef = kit.person(sc, "fi-chef", ep.cast.chef.look).at(...RU, T(CH));
  const BOW = [fOf(67.35), fOf(68.0)];
  chef.clip(RU[0], fOf(66) - 1, "interact-left").clip(fOf(66), BOW[0] - 1, "idle").clip(...BOW, "emote-yes", (f) => Math.min((f - BOW[0]) / 30, 0.62)).clip(BOW[1] + 1, RU[1], "idle");
  // 湯のみ：56〜60 は口もとへ運んで飲む
  const cupIt = kit.seatItems().find((it) => it.seat === kit.YAMADA_SEAT && it.kind === "cup");
  const MOUTH = [YX + 0.14, 1.0, YZ - 0.2];
  sc.add("fi-cup", [kit.itemPart(cupIt, [0, 0, 0], Q.id())]).anim(...RU, (f) => {
    const t = tOf(f);
    if (t > PASS) { const u = t - PASS; return T(cupIt.pos, Q.mul(cupIt.quat, Q.axis([0, 0, 1], -0.25 * Math.exp(-u * 4) * Math.sin(u * 30)))); }
    if (t < 56.3 || t > 59.8) return T(cupIt.pos, cupIt.quat);
    const lift = ease(clamp((t - 56.3) / 0.6)) * (1 - ease(clamp((t - 59.1) / 0.6))), sip = ease(clamp((t - 57.0) / 0.5)) * (1 - ease(clamp((t - 58.4) / 0.5)));
    return T(V.lerp(cupIt.pos, MOUTH, lift), Q.mul(Q.yaw(1.2), Q.axis([1, 0, 0], -1.0 * sip)));
  });
  // 湯気
  for (let i = 0; i < 5; i++) {
    const per = 1.4, ph = (i / 5) * per, st = sc.add("fi-steam", [sphere(m("#FFFFFF", { opacity: 0.35 }), [0, 0, 0], 1)]);
    st.anim(...RU, (f) => { const k = ((tOf(f) + ph) % per) / per, base = sc.objects.length && cupIt.pos; const t = tOf(f), blow = t > PASS ? 0.35 * k * Math.exp(-(t - PASS) * 1.2) : 0; return T(V.add(base, [Math.sin(k * 5 + i) * 0.02 + blow, 0.16 + k * 0.3 - blow * 0.3, 0]), Q.id(), 0.02 + k * 0.04); });
    st.fade(...RU, (f) => { const t = tOf(f), k = ((t + ph) % per) / per; return t > 56.2 && t < 59.9 ? 0 : clamp(k / 0.2) * (1 - k); });
  }
  // オチ：黄色い筋が1本、ヤマダの目の前を通り過ぎる
  // 黄色い筋：顔の手前（y 1.1・z 0.65）を、右から左へ一瞬で（画面を横切るのは約0.17秒）。通ったあとに薄い残光
  const headX = (t) => -1 + 22.5 * (t - PASS), SY = 1.1, SZ = YZ - 0.37;
  sc.add("fi-last-egg", [box(EM(YOLK), [0, 0, 0], [1, 1, 1])]).anim(fOf(PASS), fOf(PASS + 0.3), (f) => { const h = headX(tOf(f)); return T([h - 1.6, SY, SZ], Q.id(), [3.2, 0.09, 0.05]); });
  const AFTER = [fOf(PASS + 0.07), fOf(PASS + 0.55)];
  sc.add("fi-last-glow", [box(EM("#FFE58A", 0.5), [0, 0, 0], [1, 1, 1])]).at(...AFTER, T([1.0, SY, SZ], Q.id(), [7, 0.07, 0.04])).fade(...AFTER, (f) => (1 - kf(PASS + 0.12, PASS + 0.55)(f)) ** 1.3);

  // ---------- カット ----------
  const LR = (post = {}, extra = {}) => ({ ...ctx.LOOKS.ruin, post: { ...ctx.LOOKS.ruin.post, ...post }, ...extra });
  ctx.shot("fi-r1", R(52, 54), LR(), (f, k) => { const a = lerp(0.85, 0.35, ease(k)), d = lerp(8, 7.2, k); return { pos: [d * Math.sin(a), lerp(2.9, 2.5, k), 0.3 + d * Math.cos(a)], target: [0.2, 0.9, -0.2], fov: 46 }; });
  ctx.tag(ep.cast.yamada.name, 52.3, 53.9, () => YHEAD);
  ctx.tag(ep.cast.chef.name, 52.5, 53.9, () => CHEAD);
  ctx.shot("fi-r2", R(54, 56), LR({ bloom: 0.75 }), ctx.dolly({ pos: [7.0, 1.4, -0.05], target: [-2, 0.85, -0.1], fov: 44 }, { pos: [5.8, 1.3, -0.1], target: [-2, 0.85, -0.12] }));
  ctx.shot("fi-r3", R(56, 58), LR({ focus: 3.0, aperture: 0.00005 }), ctx.dolly({ pos: [0.95, 1.5, -2.3], target: [0.6, 1.12, 1.0], fov: 34 }, { pos: [0.8, 1.45, -1.9], target: [0.6, 1.12, 1.0] }));
  ctx.shot("fi-r4", R(58, 60), LR(), ctx.dolly({ pos: [1.75, 1.5, -1.25], target: [0.55, 1.08, 1.0], fov: 36 }, { pos: [1.6, 1.47, -1.1], target: [0.55, 1.08, 1.0] }));
  ctx.shot("fi-r5", R(60, 64), LR({ ao: 0.6, bloom: 0.8 }, { fog: { color: "#E9B98F", near: 60, far: 260 }, shadowExtent: 30 }), (f, k) => {
    const h = 5 * Math.exp(Math.log(46 / 5) * ease(k) ** 1.2), rot = 0.7 * k;
    return { pos: [0.3, h, 0.25], target: [0.3, 0, 0.24], up: [Math.sin(rot), 0, -Math.cos(rot)], fov: 50 };
  });
  ctx.shot("fi-r6", R(64, 65), LR({ bloom: 0.35 }), ctx.dolly({ pos: [17, 0.9, 14], target: [0, 7, -0.2], fov: 56 }, { pos: [16, 0.95, 13.2], target: [0, 10, -0.2] }));
  ctx.shot("fi-r7", R(65, 66), LR({ bloom: 0.4 }, { fog: { color: "#E9B98F", near: 45, far: 220 }, shadowExtent: 20 }), ctx.dolly({ pos: [30, 6, 7], target: [0, 17, -0.2], fov: 54 }, { pos: [27, 6.5, 6.3], target: [0, 20, -0.2] }));
  // 66〜67.7：ヤマダの正面（レーンの向こうから）。67.7〜：レーンの端から2人を横に。黄色い筋は2人のあいだをレーンに沿って通る
  const YCLOSE = { pos: [0.75, 1.85, -1.5], target: [0.62, 0.95, 1.0], fov: 37 };
  ctx.shot("fi-r8a", R(66, 67.2), LR({ focus: 2.6, aperture: 0.00005 }), ctx.dolly({ ...YCLOSE, pos: [0.8, 1.9, -1.8] }, YCLOSE));
  ctx.shot("fi-r8b", R(67.2, 68.1), LR({ focus: 3.6, aperture: 0.00005 }), ctx.dolly({ pos: [1.0, 1.6, 2.0], target: [-0.55, 1.25, -1.3], fov: 32 }, { pos: [0.92, 1.58, 1.8], target: [-0.55, 1.25, -1.3] }));
  const LAST = { ...YCLOSE, pos: [0.72, 1.83, -1.4] };
  ctx.shot("fi-r8c", R(68.1, 69), LR({ focus: 2.5, aperture: 0.00005 }), ctx.dolly(YCLOSE, LAST));
  ctx.shot("fi-end", ctx.END, LR({ focus: 2.5, aperture: 0.00005 }), () => LAST);
  ctx.bubble("玉子、まだですか", 66.35, 67.15, () => [YX + 0.2, 1.12, YZ]);
  ctx.bubble("へい、ただいま", 67.5, 68.05, () => [CH[0], CH[1] + 1.0, CH[2]]);

  // ==================== 星（宇宙の全カット） ====================
  // 遠い星：カメラに付いてくる殻（どこから見ても同じ空）。近い星くず：その場面に置く（カメラが動くと流れて、奥行きが出る）
  const SPACE = R(36, 52);
  {
    const r = rng(2026), far = [];
    for (let i = 0; i < 520; i++) {
      const d = dirRand(r), dist = 1700 + r() * 900, s = (1.2 + r() ** 3 * 4.5) * dist / 2000;
      far.push(sphere(EM(i % 9 === 0 ? "#FFE3A8" : i % 7 === 0 ? "#BFD4FF" : "#FFFFFF"), V.mul(d, dist), s));
    }
    sc.add("fi-stars", far).anim(...SPACE, (f) => T(camAt(f)));
  }
};
