// 幕「店内」：冒頭の店内（物語 -2.4〜0 秒）と、物語の0〜24秒。
// 世界は1つ。動く物は「物語の秒 t → 変換」の関数を1本ずつ持ち、カットはカメラだけを切り替える。
// （湯のみが滑った・皿の山が崩れた・客がしゃがんだ、は別のカットでもそのまま残る）
import { Q, T, V, box, cyl, model, rng, clamp, ease, lerp } from "../../../kinds/sim3d/lib/mvscene.mjs";
import { smooth, makeActing, makeToss } from "../../../kinds/sim3d/lib/motion.mjs";
import * as kit from "../kit.mjs";

export default (ctx) => {
  const { sc, m, ep, fOf, tOf, beltDistance, speedAt, FPS } = ctx;
  const FROM = ctx.INTRO.clock[0], TO = fOf(24) - 1, ALL = [FROM, TO]; // この幕が受け持つコマの範囲
  const T_END = 24;
  // 物語の秒 t0〜t1 を、この幕の範囲に収めたコマの範囲に
  const R = (t0, t1) => [Math.max(FROM, fOf(t0)), Math.min(TO, fOf(t1) - 1)];
  const Y = kit.YAMADA_SEAT, YX = kit.SEATS[Y];

  // ---------- 動きの道具 ----------
  // 人の動きを、物語の秒の区切りで並べる。[[t0, 動きの名前, (u => 動きの中の秒)], ...]（次の区切りの t0 まで続く）
  const acting = makeActing({ from: FROM, to: TO, fOf, tOf });
  const SIT = (t0) => [t0, "sit", () => 0.1];
  const REACH = (t0) => [t0, "interact-right", (u) => Math.min(u, 0.66)];

  // 床・カウンター・作業台の高さ（落ちる物が止まる面）
  const surface = (x, z) => {
    if (Math.abs(x) > 5) return 0;
    if (z >= kit.COUNTER_Z[0] && z <= kit.COUNTER_Z[1]) return kit.COUNTER_Y;
    if (z >= kit.PREP_Z - 0.25 && z <= kit.PREP_Z + 0.25) return kit.PREP_Y;
    if (z < -0.85) return kit.KITCHEN_Y;
    return 0;
  };
  // 投げた物の動き。t0 に p から速さ v で飛び、重力で落ち、面で跳ねて止まる。壁では跳ね返る（walls: false なら素通り）。
  // 返り値は (t) => [pos, quat]
  const toss = makeToss({ fps: FPS, until: T_END, floorAt: surface, walls: { x: 4.9, zMin: kit.ROOM.z[0] + 0.1, zMax: kit.ROOM.z[1] - 0.06 } });
  // 震え（コマごとに変わる -0.5〜0.5）
  const jit = (seed, t) => rng(seed * 997 + Math.round(t * FPS))() - 0.5;
  const shakeAt = (t) => (t < 11.5 ? 0 : t < 16 ? 0.006 + (0.01 * (t - 11.5)) / 4.5 : t < 20 ? 0.018 : 0.024);

  // ---------- 店（動かない物） ----------
  sc.add("in-shell", [...kit.shellParts(m), ...kit.frontWallParts(m), ...kit.counterParts(m), ...kit.laneBaseParts(m), kit.beltPart(m("#2F3338"))]).at(...ALL);
  // 天井：真上から撮るカット（10〜12秒）では外す
  sc.add("in-ceiling", kit.ceilingParts(m)).at(...R(-2.4, 10)).at(...R(12, 24));
  // レーンの右端の曲がり角（kit には無いので、ここで足す）：回る台と、その軸
  const CORNER = [4.62, kit.LANE_Y, kit.LANE_Z - 0.06];
  sc.add("in-corner", [
    cyl(m(kit.WOOD_DARK), [CORNER[0], (kit.LANE_Y - 0.02) / 2, CORNER[2]], 0.34, kit.LANE_Y - 0.02),
    cyl(m("#2F3338"), [CORNER[0], kit.LANE_Y - 0.01, CORNER[2]], 0.3, 0.02),
    cyl(m("#E7E1D5"), [CORNER[0], kit.LANE_Y + 0.02, CORNER[2]], 0.035, 0.05),
  ]).at(...ALL);
  kit.WINDOWS.forEach((_, i) => sc.add("in-glass", [kit.windowGlassPart(m, i)]).at(...(i === 1 ? R(-2.4, 20) : ALL)));

  // ---------- 吊り照明：10秒から揺れ始め、22秒からは大きく揺れる ----------
  const swingAmp = (t) => (t < 10 ? 0 : t < 16 ? (0.06 * (t - 10)) / 6 : t < 20 ? 0.06 + (0.12 * (t - 16)) / 4 : t < 22 ? 0.18 + (0.12 * (t - 20)) / 2 : 0.3 + 0.45 * smooth(t, 22, 23));
  kit.LAMPS.forEach((pos, i) => {
    const ph = i * 0.9;
    const swing = (f) => {
      const t = tOf(f), a = swingAmp(t);
      return T(pos, Q.mul(Q.axis([0, 0, 1], a * Math.sin(t * 4.2 + ph)), Q.axis([1, 0, 0], 0.4 * a * Math.sin(t * 3.1 + ph * 1.7))));
    };
    sc.add("in-lamp", kit.lampParts(m)).anim(...R(-2.4, 10), swing).anim(...R(12, 24), swing); // 真上のカットでは外す
  });

  // ---------- 棚の瓶：揺れ、20.45秒から1本ずつ落ちる ----------
  kit.shelfBottles().forEach((it, i) => {
    const r = rng(500 + i), tb = 20.45 + ((i * 7) % 34) * 0.045;
    const fall = toss(tb, it.pos, [(r() - 0.5) * 0.8, 0.4 + r() * 0.6, 0.6 + r() * 0.9], { spin: [1, 0, r() - 0.5], w: 7 + r() * 6, q0: it.quat, bounce: 0.25 });
    sc.add("in-bottle", [kit.itemPart(it, [0, 0, 0], Q.id())]).anim(...ALL, (f) => {
      const t = tOf(f);
      if (t >= tb) { const [p, q] = fall(t); return T(p, q); }
      const a = shakeAt(t);
      return T(V.add(it.pos, [jit(i, t) * a, 0, 0]), Q.mul(Q.axis([0, 0, 1], jit(i + 50, t) * a * 8), it.quat));
    });
  });

  // ---------- 席の小物：12秒から震えて滑りだし、15〜17秒にカウンターから飛ぶ。皿の山は16秒から崩れる ----------
  // ヤマダの湯のみだけは、ヤマダが押さえて、18秒台に飲む
  const yamadaCup = {};
  kit.seatItems().forEach((it, j) => {
    const r = rng(900 + j);
    const parts = [kit.itemPart(it, [0, 0, 0], Q.id()), ...(it.sushi ? [model(kit.food(it.sushi), { d: 0.075 * kit.PROP, pos: [0, 0.012 * kit.PROP, 0], quat: Q.yaw(0.5) })] : [])];
    if (it.seat === Y && it.kind === "cup") { yamadaCup.it = it; yamadaCup.parts = parts; return; }
    let fn;
    if (it.kind === "plate") {
      // 皿の山：上の段ほど先に、横へずれて落ちる
      const tc = ({ 0: 17.35, 1: 16.35, 2: 16.9, 3: 17.6, 4: 17.0, 5: 17.2 })[it.seat] + (8 - it.level) * 0.05 + r() * 0.04;
      const fall = toss(tc, it.pos, [0.8 + r() * 1.6, 0.6 + it.level * 0.2, 1.0 + r() * 1.4], { spin: [r() - 0.5, 0, 1], w: 6 + r() * 5, q0: it.quat, bounce: 0.35 });
      fn = (t) => {
        if (t >= tc) return fall(t);
        const a = shakeAt(t) * (1 + it.level * 0.5);
        return [V.add(it.pos, [jit(j, t) * a, 0, jit(j + 7, t) * a]), it.quat];
      };
    } else {
      // 湯のみ・醤油皿・箸・食べかけの皿：震える → +x へ滑る（加速）→ カウンターから飛ぶ
      const ts = 11.5 + r() * 0.4, acc = 0.35 + r() * 0.35, tl = 15.4 + r() * 2.2, turn = (r() - 0.5) * 2;
      const slide = (t) => Math.min(4.75 - it.pos[0], t > ts ? 0.5 * acc * (t - ts) ** 2 : 0); // 右の壁で止まる
      const fall = toss(tl, V.add(it.pos, [slide(tl), 0, 0]), [acc * (tl - ts) + 1.5 + r() * 2, 0.8 + r() * 1.2, 0.6 + r() * 1.6], { spin: [r() - 0.5, r() - 0.5, 1], w: 7 + r() * 6, q0: it.quat });
      fn = (t) => {
        if (t >= tl) return fall(t);
        const a = shakeAt(t);
        return [V.add(it.pos, [slide(t) + jit(j, t) * a, Math.max(0, jit(j + 3, t)) * a * 0.6, jit(j + 9, t) * a]), Q.mul(Q.yaw(slide(t) * turn), it.quat)];
      };
    }
    sc.add("in-" + it.kind, parts).anim(...ALL, (f) => { const [p, q] = fn(tOf(f)); return T(p, q); });
  });

  // ---------- 人 ----------
  const looks = [...ep.cast.guests];
  looks.splice(Y, 0, ep.cast.yamada.look);
  const GUESTS = [0, 1, 2, 4, 5];
  // しゃがむ時刻と、走りだす時刻（席ごと）
  const CROUCH = { 1: 16.3, 0: 17.15, 2: 16.7, 4: 16.95, 5: 17.4 };
  const RUN = { 0: 21.95, 1: 22.0, 2: 22.12, 4: 22.05, 5: 22.0 };
  const RUN_SPEED = 5.4, CROUCH_Z = 0.6;
  // 走る道：しゃがんだ場所 → 椅子のあいだ → 通路 → 出口 → 外（z > 3.3 は駐車場）
  const runPath = (s) => {
    const x = kit.SEATS[s], lane = 1.75 + GUESTS.indexOf(s) * 0.17, mid = x + 0.62;
    return [[x, 0, CROUCH_Z], [mid, 0, 0.8], [mid, 0, lane], [3.5 + (s % 2) * 0.2, 0, Math.min(2.75, lane + 0.5)], [3.6, 0, 3.3], [3.6, 0, 12]];
  };
  const along = (path, d) => {
    for (let k = 0; k < path.length - 1; k++) {
      const a = path[k], b = path[k + 1], L = V.len(V.sub(b, a));
      if (d <= L || k === path.length - 2) return [V.lerp(a, b, clamp(d / L)), Math.atan2(b[0] - a[0], b[2] - a[2])];
      d -= L;
    }
  };
  // 客の動き：〜6秒はふつうに取って食べる → 6〜10秒は取りそこねる → 10〜12秒は次々に手を出す → 12〜16秒はうろたえる → しゃがむ → 走る
  const ACTS = {};
  GUESTS.forEach((i) => {
    const list = [SIT(-2.4)];
    for (let t = -2.0 + i * 0.55; t < 5.4; t += 2.3 + (i % 3) * 0.4) list.push(REACH(t), SIT(t + 0.7));
    if (i === 1) list.push(REACH(6.15), [6.85, "emote-no", (u) => u], SIT(8.05)); // 手もとのカット：取ろうとして空を切り、首を振る
    else list.push(REACH(6.3 + i * 0.25), SIT(7.0 + i * 0.25));
    list.push(REACH(8.6 + i * 0.13), SIT(9.3 + i * 0.13));
    // 10〜12秒：次々に手を出す（左右を交互に）
    for (let t = 10.0 + i * 0.11, k = 0; t < 11.85; t += 0.42, k++) list.push([t, k % 2 ? "interact-left" : "interact-right", (u) => u * 1.6]);
    list.push(SIT(12.0), [13.2 + i * 0.1, "holding-both", () => 0.1], SIT(14.4 + i * 0.07), [15.2 + i * 0.1, "emote-no", (u) => u * 1.4]);
    list.push([CROUCH[i], "crouch", () => 0.1], [RUN[i], "sprint", (u) => u]);
    ACTS[i] = list.sort((a, b) => a[0] - b[0]);
  });
  // ヤマダ：玉子に手を伸ばして届かず、湯のみを押さえ、お茶を飲む。席は立たない
  ACTS[Y] = [SIT(-2.4), REACH(8.75), [9.45, "interact-right", () => 0.38], SIT(9.95), [18.2, "holding-right", () => 0.1], SIT(20.0)];
  // 座ったまま sit 以外の動き（手を伸ばす等）をすると、立ち姿勢のぶん頭が浮く。その間だけ腰を下げて、頭の高さを座りに近づける
  const STAND_DROP = 0.2;
  const clipAt = (list, t) => { let cur = list[0]; for (const e of list) if (e[0] <= t) cur = e; return cur[1]; };
  const standing = (list, t) => !["sit", "crouch", "sprint"].includes(clipAt(list, t));
  const reaching = (list, t) => clipAt(list, t).startsWith("interact");
  const avg4 = (fn) => [0, 1, 2, 3].reduce((n, k) => n + (fn(k / FPS) ? 1 : 0), 0) / 4; // 4コマでならす
  // 手を伸ばすときは、腰を軸に上体ごとレーンのほうへ乗り出す（素材の腕は短く、座ったままではレーンに届かない）
  const LEAN = 0.5;
  const seated = (i, t) => {
    const drop = STAND_DROP * avg4((d) => standing(ACTS[i], t - d)), lean = LEAN * avg4((d) => reaching(ACTS[i], t - d));
    return T([kit.SEATS[i], kit.SIT_Y - drop, kit.SEAT_Z], Q.mul(Q.axis([1, 0, 0], -lean), Q.yaw(Math.PI)));
  };
  const runnerAt24 = {};
  // 椅子：走りだした直後に倒れる（ヤマダの椅子は動かない）
  kit.SEATS.forEach((x, i) => {
    const stool = sc.add("in-stool", [model(kit.furn("stoolBar"), { h: 0.62, pos: [0, 0, 0] })]);
    if (i === Y) { stool.at(...ALL, T([x, 0, kit.SEAT_Z])); return; }
    const tf = RUN[i] + 0.12, dir = i % 2 ? 1 : -1;
    stool.anim(...ALL, (f) => {
      const t = tOf(f), k = clamp((t - tf) / 0.35);
      const ang = (Math.PI / 2) * k * k - (k >= 1 ? 0.1 * Math.sin((t - tf - 0.35) * 18) * Math.exp(-6 * (t - tf - 0.35)) : 0);
      const q = Q.axis([0, 0, 1], -dir * ang);
      const pivot = [x + dir * 0.14, 0, kit.SEAT_Z + 0.25 * k];
      return T(V.add(pivot, Q.rot(q, [-dir * 0.14, 0, 0])), q);
    });
  });
  const people = {};
  kit.SEATS.forEach((x, i) => {
    const who = kit.person(sc, i === Y ? "in-yamada" : "in-guest" + i, looks[i]);
    people[i] = who;
    if (i === Y) { who.anim(...ALL, (f) => seated(i, tOf(f))); acting(who, ACTS[i]); return; }
    const tc = CROUCH[i], tr = RUN[i], path = runPath(i);
    who.anim(...ALL, (f) => {
      const t = tOf(f);
      if (t < tc) return seated(i, t);
      if (t < tr) { // 椅子から降りて、カウンターの下へ
        const k = smooth(t, tc, tc + 0.3);
        return T([x, lerp(kit.SIT_Y, 0, k), lerp(kit.SEAT_Z, CROUCH_Z, k)], Q.yaw(Math.PI));
      }
      const [p, yaw] = along(path, (t - tr) * RUN_SPEED * smooth(t, tr, tr + 0.25));
      return T(p, Q.yaw(yaw));
    });
    acting(who, ACTS[i]);
    const t24 = tOf(TO), [p24] = along(path, (t24 - tr) * RUN_SPEED * smooth(t24, tr, tr + 0.25));
    runnerAt24[looks[i]] = p24.map((v) => Math.round(v * 100) / 100);
  });
  // ヤマダの湯のみ：手もと → 18.3〜18.8 で口もとへ → 19.6〜20.0 で戻す
  {
    const it = yamadaCup.it, mouth = [YX + 0.12, 1.02, 0.66], hold = [YX + 0.2, kit.COUNTER_Y, 0.42];
    sc.add("in-yamada-cup", yamadaCup.parts).anim(...ALL, (f) => {
      const t = tOf(f);
      if (t < 12.6) { const a = shakeAt(t); return T(V.add(it.pos, [jit(77, t) * a, 0, jit(78, t) * a]), it.quat); }
      const base = V.lerp(it.pos, hold, smooth(t, 12.6, 12.9));
      const up = smooth(t, 18.3, 18.8) * (1 - smooth(t, 19.6, 20.0));
      return T(V.lerp(base, mouth, up), Q.mul(Q.axis([1, 0, 0], -0.6 * smooth(t, 18.7, 19.0) * (1 - smooth(t, 19.4, 19.7))), it.quat));
    });
  }
  // 大将：握り続ける。12〜14秒は手を上げて「へい、お待ち」
  const chef = kit.person(sc, "in-chef", ep.cast.chef.look).at(...ALL, T(kit.CHEF_POS));
  acting(chef, [[-2.4, "interact-left", (u) => u], [12.9, "holding-right-shoot", () => 0.1], [13.95, "interact-left", (u) => u]]);
  ctx.bubble("へい、お待ち", 13.05, 13.95, () => [kit.CHEF_POS[0], kit.CHEF_POS[1] + 0.95, kit.CHEF_POS[2]]);

  // ---------- レーンを流れる皿（〜16秒）：ベルトの進んだ距離で位置を決める ----------
  // 玉子の皿（7番）が、物語9.2秒にヤマダの前（x = YX）へ来るように、全部の皿に同じ位相を足す
  const GAP = 0.42, COUNT = 26, LOOP = COUNT * GAP, EGG = 7, PASS_T = 9.2;
  const PH = (((YX + LOOP / 2 - EGG * GAP - beltDistance(PASS_T)) % LOOP) + LOOP) % LOOP;
  const plateX = (i, t) => -LOOP / 2 + ((((i * GAP + PH + beltDistance(t)) % LOOP) + LOOP) % LOOP);
  const STREAK_T = 16, EDGE = CORNER[0] - 0.05;
  const flyers = [];
  for (let i = 0; i < COUNT; i++) {
    const egg = i === EGG, kind = egg ? "sushi-egg" : kit.sushiKind(i), two = i % 3 !== 0;
    sc.add(egg ? "in-egg" : "in-plate", kit.plateParts(kind, two)).anim(...R(-2.4, STREAK_T), (f) => {
      const t = tOf(f), x = plateX(i, t);
      // 14〜16秒は、曲がり角まで来た皿を消し、飛ぶ皿に入れ替える（玉子は飛ばさない）
      const hide = t >= 14 && x > EDGE;
      return T([x, kit.LANE_Y, kit.LANE_Z], Q.id(), hide ? 0.0001 : 1);
    });
    if (!egg) for (let f = fOf(14); f < fOf(STREAK_T); f++) {
      const a = plateX(i, tOf(f - 1)), b = plateX(i, tOf(f));
      if (a <= EDGE && b > EDGE && b - a < 1) flyers.push({ t: tOf(f), kind, two });
    }
  }
  // 曲がれずに飛び出す皿：右の壁と、奥の植木へ
  flyers.forEach((fl, n) => {
    const r = rng(3000 + n), toPlant = n % 3 === 1;
    const v = toPlant ? [-0.1 + r() * 0.3, 2.0 + r() * 1.0, -1.6 - r() * 0.8] : [2.5 + r() * 3, 1.0 + r() * 2.5, (r() - 0.35) * 3.2];
    const fly = toss(fl.t, [EDGE, kit.LANE_Y + 0.02, kit.LANE_Z], v, { spin: [r() - 0.5, 0.3, 1], w: 14 + r() * 10, bounce: 0.35 });
    sc.add("in-flyer", kit.plateParts(fl.kind, fl.two)).anim(...R(fl.t, 24), (f) => { const [p, q] = fly(tOf(f)); return T(p, q); });
  });
  // 皿が当たる植木（kit の植木は棚と一体なので、角の近くに鉢を1つ足して揺らす）
  const POT = [4.45, kit.KITCHEN_Y, -1.35];
  sc.add("in-pot", [model(kit.furn("pottedPlant"), { h: 0.9, pos: [0, 0, 0] })]).anim(...ALL, (f) => {
    const t = tOf(f), k = smooth(t, 14.7, 15.1), wob = t > 14.7 ? 0.25 * Math.sin((t - 14.7) * 16) * Math.exp(-3 * (t - 14.7)) : 0;
    return T(POT, Q.axis([1, 0, 0], -(0.35 * k + wob)));
  });

  // ---------- 16秒から：皿は筋になる ----------
  // 1コマに進む距離が皿の間隔の半分を超えると逆向きに見えるので、進む向きに伸ばした光る箱にする。
  // 細い筋の束：レーンの幅に4本の列、1本は幅 3〜6cm・高さ 1cm・長さ 0.5〜4m。コマごとに位置を散らす（どちら向きにも「ゆっくり動いて」見えない）。
  // 筋のあいだから黒いベルトが見えるようにする。玉子の筋（黄）は少し太く、長い
  const ROWS = [-0.1, -0.035, 0.035, 0.1], STREAKS = 20;
  for (let s = 0; s < STREAKS; s++) {
    const egg = s === 0, row = ROWS[s % ROWS.length], op = egg ? 0.9 : 0.5 + (s % 4) * 0.1;
    sc.add("in-streak", [box(m(egg ? "#FFD23F" : "#FFF3C4", { emissive: 1, opacity: op }), [0, 0, 0], [1, 1, 1])]).anim(...R(STREAK_T, 24), (f) => {
      const t = tOf(f), r = rng(7000 + f * 31 + s);
      const L = egg ? 3 + r() * 2 : 0.5 + r() * 3.5, x = -5 + r() * 10;
      const x0 = Math.max(-5, x - L / 2), x1 = Math.min(5, x + L / 2), w = egg ? 0.075 : 0.03 + r() * 0.03;
      void t;
      return T([(x0 + x1) / 2, kit.LANE_Y + 0.008, kit.LANE_Z + (egg ? 0 : row)], Q.id(), [Math.max(0.01, x1 - x0), 0.01, w]);
    });
  }

  // ---------- 20秒：まん中の窓が割れる ----------
  {
    const [wx0, wx1] = kit.WINDOWS[1], wz = kit.ROOM.z[1] + 0.1;
    for (let n = 0; n < 40; n++) {
      const r = rng(4000 + n), p = [lerp(wx0, wx1, r()), lerp(kit.WIN_Y[0], kit.WIN_Y[1], r()), wz], t0 = 20 + r() * 0.04;
      const fly = toss(t0, p, [(r() - 0.5) * 3, 0.5 + r() * 2.5, 2.5 + r() * 5], { walls: false, spin: [r() - 0.5, r() - 0.5, r() - 0.5], w: 10 + r() * 20, bounce: 0.2 });
      const s = 0.06 + r() * 0.16;
      sc.add("in-shard", [box(m("#CFEAF5", { opacity: 0.75 }), [0, 0, 0], [s, s * (0.6 + r()), 0.02])]).anim(...R(20, 24), (f) => { const [pp, q] = fly(Math.max(t0, tOf(f))); return T(pp, q); });
    }
    // 窓を割った皿（レーンから窓へ）
    sc.add("in-breaker", kit.plateParts("maki-roe", true)).anim(...R(19.8, 20.6), (f) => {
      const t = tOf(f), k = clamp((t - 19.8) / 0.2);
      const p = t < 20 ? V.lerp([-0.7, 1.1, -0.1], [-0.9, 1.75, 3.4], k) : [-0.9 - (t - 20) * 1.5, 1.75 - (t - 20) * 2, 3.4 + (t - 20) * 9];
      return T(p, Q.axis([1, 0, 0], t * 25));
    });
  }
  // ---------- 20〜22秒：皿が壁に刺さる（縁から突っ込み、半分めり込んで震える） ----------
  const STUCK = [
    [20.25, [-2.05, 1.55, 3.27], "f"], [20.45, [0.3, 1.75, 3.27], "f"], [20.7, [-0.9, 0.65, 3.27], "f"], [20.85, [-2.1, 0.7, 3.27], "f"],
    [21.15, [-1.9, 0.98, -2.36], "b"], [21.35, [-1.2, 1.05, -2.36], "b"], [21.55, [-2.35, 0.92, -2.36], "b"], [21.8, [3.4, 1.0, -2.36], "b"],
    [21.6, [4.95, 1.6, 1.4], "r"], [21.75, [-4.95, 1.7, 0.9], "l"], [21.9, [4.95, 1.3, 2.4], "r"], [22.2, [-0.2, 2.45, 3.27], "f"],
  ];
  STUCK.forEach(([ts, p, wall], n) => {
    const r = rng(5000 + n), nrm = { f: [0, 0, 1], b: [0, 0, -1], r: [1, 0, 0], l: [-1, 0, 0] }[wall];
    const from = [p[0] * 0.4, kit.LANE_Y + 0.1, kit.LANE_Z];
    const q = Q.axis(nrm, (r() - 0.5) * 1.4); // 皿は水平のまま縁から刺さる。壁の向きの軸で少し傾ける
    sc.add("in-stuck", kit.plateParts(kit.sushiKind(n), false)).anim(...R(ts - 0.1, 24), (f) => {
      const t = tOf(f), k = clamp((t - (ts - 0.1)) / 0.1);
      const wob = t > ts ? 0.15 * Math.sin((t - ts) * 45) * Math.exp(-7 * (t - ts)) : 0;
      return T(V.lerp(from, p, k), Q.mul(Q.axis(V.cross(nrm, [0, 1, 0]), wob), q));
    });
  });

  // ---------- カット ----------
  // カメラは店の中に置く（壁は x=±5、手前 z=3.3。厨房の作業台は z -1.03〜-0.53、高さ 0.92）
  const look = (focus, bloom = 0.3) => ({ ...ctx.LOOKS.inside, post: { ao: 1.0, bloom, focus, aperture: 0.00006 } });
  const cut = (name, t0, t1, a, b, focus, bloom) => ctx.shot("in-" + name, ctx.range(t0, t1), look(focus, bloom), ctx.dolly(a, b));
  // 冒頭：ふつうの店内。題名が y 470〜800 に重なるので、店は画面の下半分に
  cut("clock", -2.4, 0, { pos: [4.3, 2.55, 3.0], target: [-0.6, 0.55, -0.6], fov: 52 }, { pos: [4.1, 2.45, 2.85] }, 5.5);
  // 0〜1.2秒：厨房側の高い位置から、ヤマダの顔を見下ろす（口までカウンターの上に出す）。1.2〜2秒：ヤマダの右からレーン沿いに、奥の玉子
  cut("yamada-face", 0, 1.2, { pos: [0.62, 1.85, -1.05], target: [0.62, 1.02, 0.95], fov: 40 }, { pos: [0.66, 1.82, -0.98] }, 2.1);
  cut("yamada-over", 1.2, 2, { pos: [1.6, 1.55, 0.3], target: [-1.0, 0.85, -0.17], fov: 36 }, { pos: [1.5, 1.52, 0.27] }, 2.9);
  // 2〜4秒：レーンの高さで、レーンに沿って上流を見る。皿が手前へゆっくり迫る（人の顔は入れない）
  cut("lane-macro", 2, 4, { pos: [2.46, 1.13, -0.17], target: [0.3, 0.98, -0.17], fov: 36 }, { pos: [2.47, 1.13, -0.17] }, 0.55); // 皿は x 2.09→2.25 まで迫る（カメラの下を通らない位置）
  // 4〜6秒：客の列を斜め後ろから
  cut("row", 4, 6, { pos: [-4.7, 2.0, 2.85], target: [-1.2, 0.95, -0.1], fov: 42 }, { pos: [-4.3, 1.9, 2.6] }, 4.3);
  // 6〜8秒：客（席1）の肩ごしに、上からレーンを見下ろす。伸ばした手の先を、狙った皿が抜けていく
  cut("hand", 6, 8, { pos: [-1.2, 2.15, 1.75], target: [-1.85, 0.95, -0.05], fov: 46 }, { pos: [-1.22, 2.1, 1.68] }, 2.0);
  // 8〜10秒：ヤマダの斜め後ろ上から（肩ごし）。玉子がヤマダの前を横切り、伸ばした腕が届かない
  cut("egg-pass", 8, 10, { pos: [1.35, 2.25, 2.1], target: [0.45, 0.95, -0.17], fov: 46 }, { pos: [1.3, 2.2, 2.0] }, 2.7);
  // 10〜12秒：真上から（天井と吊り照明は外してある）
  cut("top", 10, 12, { pos: [-1.0, 2.82, 0.42], target: [-1.0, 0.0, 0.43], fov: 70, up: [1, 0, 0] }, { pos: [-0.6, 2.82, 0.42], target: [-0.6, 0.0, 0.43] }, 1.9, 0.06);
  // 12〜13秒：カウンターの高さで、湯のみと醤油皿が震えて、こちらへ滑ってくる
  cut("cups", 12, 13, { pos: [-0.5, 1.3, 0.5], target: [-3.5, 0.95, 0.3], fov: 44 }, { pos: [-0.45, 1.29, 0.5] }, 1.2);
  // 13〜14秒：ヤマダの頭ごしに、手を上げる大将
  cut("chef", 13, 14, { pos: [0.75, 1.6, 2.1], target: [-0.6, 1.1, -1.3], fov: 34 }, { pos: [0.7, 1.56, 1.95] }, 3.6);
  // 14〜16秒：レーンの右端の曲がり角
  cut("corner", 14, 16, { pos: [3.0, 2.2, 0.3], target: [4.5, 0.9, -0.65], fov: 50 }, { pos: [3.15, 2.1, 0.35] }, 2.2);
  // 16〜18秒：皿の山が崩れ、客がカウンターの下へ（厨房側から）
  cut("stack", 16, 18, { pos: [-1.3, 1.75, -1.1], target: [-2.3, 1.05, 0.6], fov: 46 }, { pos: [-1.4, 1.7, -1.05] }, 1.9);
  // 18〜20秒：ヤマダの真横（右）から。カウンターとレーンの線が斜めに走り、奥にしゃがんだ客と崩れた皿
  cut("yamada-tea", 18, 20, { pos: [3.1, 1.7, 1.25], target: [0.2, 0.92, 0.7], fov: 46 }, { pos: [2.95, 1.68, 1.22] }, 2.6);
  // 20〜21秒：左奥の高い位置から、カウンター・しゃがんだ客・崩れた皿の向こうで窓が割れる
  cut("window", 20, 21, { pos: [-4.6, 1.95, -0.5], target: [-1.6, 1.1, 1.6], fov: 60 }, { pos: [-4.5, 1.9, -0.45] }, 4.0);
  // 21〜22秒：奥の棚に寄る。瓶が落ち、板壁に皿が刺さる
  cut("shelf", 21, 22, { pos: [-1.7, 1.55, 0.3], target: [-1.7, 1.15, -2.3], fov: 44 }, { pos: [-1.7, 1.53, 0.15] }, 2.7);
  // 22〜24秒：客が出口へ走る。ヤマダと大将は動かない
  cut("exit", 22, 24, { pos: [-1.6, 2.4, -0.55], target: [2.4, 0.7, 2.2], fov: 56 }, { pos: [-1.3, 2.35, -0.5] }, 4.0);

  // ---------- 名札・白フラッシュ・衝撃 ----------
  ctx.tag(ep.cast.yamada.name, 0.2, 1.15, () => [YX + 0.22, 1.12, 0.88]);
  ctx.flash(20.0, 0.9, 10);
  ctx.hit(20.0, 1.0);
  ctx.hit(14.75, 0.35);
  ctx.hit(21.0, 0.4);

  // 次の幕への引き渡し（24秒の客の位置）。MV_DEBUG=1 のときだけ出す
  if (process.env.MV_DEBUG) console.log("24秒の客の位置", JSON.stringify(runnerAt24));
};
