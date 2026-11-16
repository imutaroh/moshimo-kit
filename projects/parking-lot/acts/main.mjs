// 幕「main」：冒頭（動画の0〜2秒）と、物語の0〜12秒と、締めのカード。幕は1つだけ。
// 車：1台目は冒頭に通路を走ってきて区画に入る。2〜16台目は2秒ごとに上から落ちてきて区画に入る。
// 17〜32台目は物語10秒に空から降ってきて、屋根に乗り、通路と道路に転がる。
import { Q, T, model, rng } from "../../../kinds/sim3d/lib/mvscene.mjs";
import { car, chara, person, glbInfo } from "../../../kinds/sim3d/lib/assets.mjs";
import { makeActing, makeToss, hold, smooth } from "../../../kinds/sim3d/lib/motion.mjs";
import * as set from "../set.mjs";

export default (ctx) => {
  const { sc, m, ep, fOf, tOf, FPS, N, STEP } = ctx;
  const ALL = [0, N - 1];
  const END_T = ep.story.storySec + ep.story.endSec; // 締めのカードの終わり（物語の秒）
  const R = rng(11);
  const FWD = 0; // 車の素材の前の向きを +z とみなす向きの補正
  const yawOf = (dx, dz) => Math.atan2(dx, dz) + FWD;

  // ---------- 駐車場（動かない物） ----------
  sc.add("lot", set.lotParts(m)).at(...ALL);

  const kindOf = (i) => set.CAR_KINDS[(i * 5 + 2) % set.CAR_KINDS.length];
  const carPart = (i, center = false) => {
    const n = kindOf(i), { h } = set.carSize(n);
    return { parts: [model(car(n), { w: set.CAR_W, pos: [0, center ? -h / 2 : 0, 0] })], h };
  };
  // 区画の中の向き：通路に頭を向けずに、奥へ頭から入れる（通路より奥の段は -z、手前の段は +z を向く）
  const parkYaw = (z) => (z < set.AISLE_Z ? yawOf(0, -1) : yawOf(0, 1));

  // ---------- 1台目：冒頭に通路を走ってきて、曲がって区画に入る ----------
  {
    const [sx, sz] = set.SLOTS[0], A = set.AISLE_Z;
    const p0 = [-8, A], p1 = [sx - 1.6, A], c = [sx, A], p2 = [sx, sz];
    const t0 = -ep.story.introSec, t1 = -0.5, t2 = 0.9;
    const posAt = (t) => {
      if (t < t1) { const k = (t - t0) / (t1 - t0); return { p: [p0[0] + (p1[0] - p0[0]) * k, p0[1]], d: [1, 0] }; }
      const k = smooth(t, t1, t2), a = 1 - k;
      const p = [a * a * p1[0] + 2 * a * k * c[0] + k * k * p2[0], a * a * p1[1] + 2 * a * k * c[1] + k * k * p2[1]];
      const kk = Math.min(k, 0.999), aa = 1 - kk;
      const d = [2 * aa * (c[0] - p1[0]) + 2 * kk * (p2[0] - c[0]), 2 * aa * (c[1] - p1[1]) + 2 * kk * (p2[1] - c[1])];
      return { p, d };
    };
    const { parts } = carPart(0);
    sc.add("car-0", parts).anim(...ALL, (f) => {
      const { p, d } = posAt(tOf(f));
      return T([p[0], 0, p[1]], Q.yaw(yawOf(d[0], d[1])));
    });
  }

  // ---------- 2〜16台目：2秒ごとに、上から落ちてきて弾む ----------
  // i 番目の車が現れる物語の秒（1 番は 2 秒、2〜3 番は 4 秒、4〜7 番は 6 秒、8〜15 番は 8 秒）
  const bornAt = (i) => STEP * Math.ceil(Math.log2(i + 1));
  const G = 22; // 落ちる速さ（ジオラマなので、本物より速く落とす）
  for (let i = 1; i < 16; i++) {
    const t0 = bornAt(i), j = i - 2 ** Math.floor(Math.log2(i)); // j：同じ回に増えた中の何番目か
    const h0 = 1.4 + j * 0.45; // 同じ回の車は、同時に現れて、高さをずらして順に着く
    const tf = Math.sqrt((2 * h0) / G);
    const [x, z] = set.SLOTS[i], yaw = parkYaw(z) + (R() - 0.5) * 0.08;
    const { parts } = carPart(i);
    sc.add(`car-${i}`, parts).anim(fOf(t0), ALL[1], (f) => {
      const u = tOf(f) - t0;
      if (u < tf) return T([x, h0 - 0.5 * G * u * u, z], Q.yaw(yaw));
      const v = u - tf, s = 0.18 * Math.exp(-v * 9) * Math.cos(v * 26); // 着いた瞬間につぶれて、戻る
      const y = 0.08 * Math.max(0, Math.sin(v * 16)) * Math.exp(-v * 8);
      return T([x, y, z], Q.yaw(yaw), [1 + s * 0.5, 1 - s, 1 + s * 0.5]);
    });
  }

  // ---------- 17〜32台目：10秒に空から降り、屋根に乗り、あふれる ----------
  const onStalls = (x, z) => Math.abs(x) < 3 && ((z > -5.5 && z < -0.5) || (z > 2.5 && z < 7.5));
  for (let i = 16; i < 32; i++) {
    const { parts, h } = carPart(i, true);
    const roof = 0.95 + h / 2, ground = h / 2;
    const toss = makeToss({ fps: FPS, until: END_T, floorAt: (x, z) => (onStalls(x, z) ? roof : ground), walls: { x: 7.5, zMin: -6.5, zMax: 11.2 } });
    const a = R() * Math.PI * 2, sp = 1.2 + R() * 2.2, k = i - 16;
    const p = [(R() - 0.5) * 6.5, 3.5 + k * 0.4, -4.5 + R() * 11];
    const fly = toss(10, p, [Math.cos(a) * sp, -1.5, Math.sin(a) * sp], { spin: [R() - 0.5, R() - 0.5, R() - 0.5], w: 2 + R() * 3, bounce: 0.35, q0: Q.yaw(R() * 6.28) });
    sc.add(`rain-${k}`, parts).anim(fOf(10), ALL[1], (f) => { const [pp, q] = fly(tOf(f)); return T(pp, q); });
  }

  // ---------- 係員 ----------
  const me = person(sc, "me", ep.cast.me.look).at(...ALL, T(set.ME_POS, Q.yaw(-0.35)));
  const acting = makeActing({ from: ALL[0], to: ALL[1], fOf, tOf });
  acting(me, [[-2, "idle", (u) => u], [0.5, "emote-yes", (u) => u], [1.85, "idle", (u) => u], [6.2, "emote-no", (u) => u], [8, "idle", (u) => u], [10.2, "die", hold(glbInfo(chara(ep.cast.me.look)).clips.die)]]);
  const head = [set.ME_POS[0], 1.12, set.ME_POS[2]];

  // ---------- カット ----------
  const look = { ...ctx.LOOKS.outside, shadowExtent: 18, post: { ao: 0.8, bloom: 0.3 } };
  const cut = (name, range, a, b) => ctx.shot(name, range, look, ctx.dolly(a, b));
  cut("intro", ctx.INTRO.all, { pos: [9, 9, 14], target: [-0.5, 0, 0], fov: 46 }, { pos: [7, 7, 11.5] });
  cut("side", ctx.range(0, 2), { pos: [-5.8, 1.7, 4.9], target: [-2.1, 0.5, -0.8], fov: 44 }, { pos: [-5.3, 1.5, 4.3] });
  cut("front", ctx.range(2, 4), { pos: [6.8, 2.1, 2.2], target: [-0.6, 0.4, -1.4], fov: 42 }, { pos: [5.9, 1.8, 1.9] });
  cut("low", ctx.range(4, 6), { pos: [-3.6, 0.6, 2.6], target: [0.2, 0.5, -1.6], fov: 44 }, { pos: [-2.2, 0.6, 2.9], target: [1.6, 0.5, -1.6] });
  cut("face", ctx.range(6, 8), { pos: [-5.4, 1.2, 5.0], target: [-2.5, 0.55, -0.8], fov: 40 }, { pos: [-5.0, 1.05, 4.4] });
  cut("top", ctx.range(8, 10), { pos: [0, 15, 5.5], target: [0, 0, 1.0], fov: 50 }, { pos: [0, 17, 6.0] });
  cut("out", [fOf(10), ctx.END[1]], { pos: [5.5, 3.2, 13.5], target: [0, 1.0, 0.5], fov: 46 }, { pos: [8.5, 5.5, 17.5], fov: 48 });

  // ---------- 効果 ----------
  ctx.tag(ep.cast.me.name, 0, 2, () => head);
  ctx.bubble("まだ来るの？", 6.3, 7.9, () => [head[0], 0.85, head[2]]);
  ctx.flash(10, 0.8, 10);
  ctx.hit(10, 0.6);
};
