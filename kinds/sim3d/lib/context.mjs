// 幕（acts/*.mjs）に渡す道具（ctx）を作り、最後に、揺れ・白フラッシュ・画面の文字をまとめて付けて書き出す。
//
// 幕のスクリプトは `export default (ctx) => { ... }` の形で、自分の時間の範囲について
//   - 物体を置く（ctx.sc.add と、assets.mjs・作品の部品）
//   - カットとカメラを決める（ctx.shot）
//   - 名札・台詞・白フラッシュ・衝撃を足す（ctx.tag / ctx.bubble / ctx.flash / ctx.hit）
// を行う。数字（何秒目・値・倍率・比較の札）と字幕は、台本（episode.json）と作品の設定（story.mjs）から自動で出る。
//
// 作品の設定（story.mjs の default export）で決められる物。どれも省ける
//   looks       光の既定値に足す・上書きする物 { 名前: look }
//   intro       冒頭をさらに区切る { 名前: 動画の開始秒 }。ctx.INTRO.<名前> がコマの範囲になる
//   doubling    「N秒ごとに2倍」の上限 { cap, maxSteps }（v0 と doubleEverySec は episode.json の story から読む）
//   title       冒頭の題 { lines, sub }。lines は行の配列、行は [{ t: "文字", accent?: true }] の配列
//   counter     左上の数字 { label, valueOf: (n) => [値, 単位] }
//   pills       比較の札 { 2倍になった回数: "文言" }
//   clock(ctx, f, sec)  冒頭の時計など。{ label, text, a } か null
//   note(ctx, t)        画面下の注意書き。{ text, a } か null
//   shake(ctx, f, t)    揺れの大きさ（0 で揺らさない）。衝撃（ctx.hit）の揺れは、これに足される
//   fovKick(ctx, f, t)  揺れているコマで、画角に掛ける倍率（無ければ null）
//   extend(ctx)         ctx に作品の道具を足す（例：ctx.beltDistance）
import { join } from "node:path";
import { Scene, V, Q, T, box, clamp, ease, lerp, rng } from "./mvscene.mjs";
import { makeDoubling, mainHud } from "./doubling.mjs";

// カットごとの光と後処理の既定値。ctx.shot の look に名前で渡す。{...ctx.LOOKS.inside, post: {...}} のように一部だけ変えてもよい
export const LOOKS = {
  inside: { background: "#EFE6D6", sun: { from: [-3, 5, 4], color: "#FFE9C8", intensity: 1.0 }, ambient: { color: "#FFEBD2", intensity: 0.95 }, shadows: true, shadowExtent: 7, post: { ao: 1.0, bloom: 0.3 } },
  outside: { background: "#BFD9F2", sun: { from: [-4, 7, 6], color: "#FFF6E6", intensity: 1.1 }, ambient: { color: "#DCE6F2", intensity: 0.95 }, shadows: true, shadowExtent: 30, fog: { color: "#D6E4F2", near: 40, far: 260 }, post: { ao: 0.8, bloom: 0.3 } },
  aerial: { background: "#BFD9F2", sun: { from: [-4, 7, 6], color: "#FFF6E6", intensity: 1.1 }, ambient: { color: "#DCE6F2", intensity: 1.0 }, shadows: true, shadowExtent: 160, fog: { color: "#D6E4F2", near: 200, far: 1400 }, post: { bloom: 0.35 } },
  space: { background: "#05070D", sun: { from: [6, 3, 5], color: "#FFFFFF", intensity: 1.25 }, ambient: { color: "#5A6A8A", intensity: 0.35 }, shadows: false, shadowExtent: 0, post: { bloom: 0.6 } },
};

// 計算結果の置き場所。SIM3D_BAKED があればそこ（試し撮り）、無ければ projects/<ID>/baked/。音（sound.mjs）も同じ場所に書く
export const bakedDir = (projectDir) => process.env.SIM3D_BAKED || join(projectDir, "baked");

// 0〜1 の出入り。t が a〜b のあいだで 1、端の fade 秒で 0 へ（0.01 刻み）
export const gate = (t, a, b, fade = 0.18) => Math.round(clamp(Math.min((t - a) / fade, (b - t) / fade)) * 100) / 100;

export const makeContext = (ep, cfg = {}) => {
  const sc = new Scene(ep.video);
  const FPS = ep.video.fps, N = sc.N;
  const { introSec, storySec } = ep.story;
  const F = (sec) => Math.round(sec * FPS);
  const F0 = F(introSec), END0 = F0 + F(storySec);
  const tOf = (f) => (f - F0) / FPS, fOf = (t) => F0 + F(t);
  const looks = { ...LOOKS, ...cfg.looks };
  // 「N秒ごとに2倍」。episode.json の story に doubleEverySec があるときだけ
  const d = ep.story.doubleEverySec ? makeDoubling({ v0: ep.story.v0, every: ep.story.doubleEverySec, ...cfg.doubling }) : null;
  // 冒頭の範囲。cfg.intro で名前つきに区切れる（開始秒の小さい順に並べる）
  const INTRO = { all: [0, F0 - 1] };
  const parts = Object.entries(cfg.intro ?? {});
  parts.forEach(([name, s], i) => { INTRO[name] = [F(s), (i + 1 < parts.length ? F(parts[i + 1][1]) : F0) - 1]; });
  const labels = [], flashes = [], hits = [], calms = [];
  const ctx = {
    ep, sc, FPS, N, F, F0, END0, tOf, fOf, LOOKS: looks, INTRO,
    doubling: d, STEP: d?.STEP, MAXN: d?.MAXN, stepOf: d?.stepOf, speedAt: d?.speedAt,
    m: (color, opt) => sc.mat(color, opt),
    // 物語の t0〜t1 秒のコマの範囲 [from, to]（両端を含む）
    range: (t0, t1) => [fOf(t0), fOf(t1) - 1],
    END: [END0, N - 1], // 締めのカード
    beatsOf: (act) => ep.beats.filter((b) => b.act === act),
    // カットを1つ決める。range = [from, to]、look = LOOKS の名前か、同じ形の値、cam(f, k) は {pos, target, fov, up?} を返す
    shot(name, range, look, cam) {
      sc.shot(name, ...range, typeof look === "string" ? looks[look] : look);
      sc.cam(...range, cam);
    },
    // 2点のあいだをゆっくり動くカメラ（ctx.shot の cam に渡す）
    dolly: (a, b = {}) => (f, k) => ({ pos: V.lerp(a.pos, b.pos ?? a.pos, ease(k)), target: V.lerp(a.target, b.target ?? a.target, ease(k)), fov: lerp(a.fov, b.fov ?? a.fov, ease(k)), up: a.up }),
    // 名札（暗い札）と台詞（白い吹き出し）。物語の t0〜t1 秒に、at(f) の返す場所（世界座標）を指して出す
    tag: (text, t0, t1, at) => labels.push(["tags", text, t0, t1, at]),
    bubble: (text, t0, t1, at) => labels.push(["bubbles", text, t0, t1, at]),
    // 白フラッシュ。物語の t 秒（frame を渡すときは {frame}）から、power（0〜1）の強さで frames コマ
    flash: (t, power = 1, frames = 12) => flashes.push([typeof t === "object" ? t.frame : fOf(t), power, frames]),
    // 衝撃。その瞬間から、画面が大きく揺れて収まる
    hit: (t, power = 1) => hits.push([t, power]),
    // 揺らさない時間（静かな会話など）
    calm: (t0, t1) => calms.push([t0, t1]),
  };
  cfg.extend?.(ctx);

  // ---------- 仕上げ：抜けている範囲を埋め、揺れ・白フラッシュ・画面の文字を付けて書き出す ----------
  ctx.finish = (outDir) => {
    // まだ作っていない幕の範囲は、黒い仮のカットで埋める（幕ごとに試し撮りできるように）
    let gap = null;
    for (let f = 0; f <= N; f++) {
      const empty = f < N && !sc.camera[f];
      if (empty && gap === null) gap = f;
      if (!empty && gap !== null) { ctx.shot(`todo-${gap}`, [gap, f - 1], { ...LOOKS.space, background: "#101216" }, () => ({ pos: [0, 2, 8], target: [0, 1, 0], fov: 40 })); gap = null; }
    }
    // 揺れ：大きさは作品の shake が決める。衝撃（ctx.hit）の揺れを足す。向き（注視点）を主に揺らす
    const noise = (i) => rng(9000 + i)() * 2 - 1;
    const ampAt = (f) => {
      const t = tOf(f);
      if (f >= END0 || calms.some(([a, b]) => t >= a && t < b)) return 0;
      let amp = cfg.shake ? cfg.shake(ctx, f, t) : 0;
      for (const [at, power] of hits) if (t >= at) amp += 0.045 * power * Math.exp(-6 * (t - at)); // 衝撃は、冒頭でも物語の序盤でも効く
      return amp;
    };
    for (let f = 0; f < N; f++) {
      const c = sc.camera[f], amp = ampAt(f);
      if (!amp) continue;
      const dist = V.len(V.sub(c.slice(3, 6), c.slice(0, 3))), t = tOf(f);
      for (let a = 0; a < 3; a++) {
        const k = Math.sin(f * (0.55 + a * 0.23) + a * 2) * 0.8 + Math.sin(f * (1.3 + a * 0.31) + a) * 0.4 + noise(f * 5 + a + 70000) * 0.45;
        c[3 + a] += k * amp * dist;
        c[a] += k * Math.min(0.04, amp * dist * 0.15);
      }
      const kick = cfg.fovKick ? cfg.fovKick(ctx, f, t) : null;
      if (kick != null) c[9] *= kick;
    }
    // 白フラッシュ：カメラの前に貼りついた白い板
    if (flashes.length) {
      const board = sc.add("flash", [box(sc.mat("#FFFFFF", { emissive: 1 }), [0, 0, 0], [1, 1, 0.002])]);
      for (const [start, power, life] of flashes.sort((a, b) => a[0] - b[0])) {
        const to = Math.min(start + life, N - 1);
        board.anim(start, to, (f) => {
          const c = sc.camera[f], pos = c.slice(0, 3), fw = V.norm(V.sub(c.slice(3, 6), pos)), right = V.norm(V.cross(fw, c.slice(6, 9))), up = V.cross(right, fw);
          const h = 2 * Math.tan((c[9] * Math.PI) / 360) * 1.3;
          return T(V.add(pos, fw), Q.fromBasis(right, up, V.mul(fw, -1)), [h * 0.5625, h, 1]);
        });
        board.fade(start, to, (f) => power * (1 - (f - start) / life) ** 1.5);
      }
    }
    // 画面の文字（hud.json）。キーの順は再生機の決まりどおり
    const hud = [];
    for (let f = 0; f < N; f++) {
      const sec = f / FPS, t = tOf(f), story = f >= F0 && f < END0;
      const h = { f, title: null, clock: null, main: null, pill: null, caption: null, tags: [], bubbles: [], card: null, note: null, black: 0 };
      if (f < F0) {
        if (cfg.title) h.title = { lines: cfg.title.lines, sub: cfg.title.sub ?? null, a: gate(sec, 0, introSec, 0.3) };
        if (cfg.clock) h.clock = cfg.clock(ctx, f, sec) ?? null;
      }
      if (story) {
        if (d && cfg.counter) h.main = mainHud(d, t, cfg.counter);
        if (d && cfg.pills) {
          const n = d.stepOf(Math.max(0, t));
          if (cfg.pills[n]) h.pill = { text: cfg.pills[n], a: gate(t, n * d.STEP, n >= d.MAXN ? storySec + 1 : (n + 1) * d.STEP, 0.2) };
        }
        const beat = ep.beats.find((b) => b.caption && t >= b.from + 0.2 && t <= b.to - 0.2);
        if (beat) h.caption = { lines: beat.caption, a: gate(t, beat.from + 0.2, beat.to - 0.2) };
        if (cfg.note) h.note = cfg.note(ctx, t) ?? null;
      }
      if (story || f < F0) {
        for (const [kind, text, a, b, at] of labels) {
          if (t < a || t > b) continue;
          const world = at(f);
          if (!world) continue;
          const p = sc.project(f, world);
          // 画面の x 40〜1040px・y>120 の外に出た札は描かない（端で切れるのを防ぐ）
          if (p.depth > 0 && p.x > 40 && p.x < 1040 && p.y > 120) h[kind].push({ text, x: Math.round(p.x), y: Math.round(p.y), a: gate(t, a, b) });
        }
      }
      if (f >= END0) {
        const u = (f - END0) / FPS;
        h.black = Math.round(clamp(u / 0.5) * 100) / 100;
        if (ep.endCard) h.card = { ...ep.endCard, a: Math.round(clamp((u - 0.4) / 0.5) * 100) / 100 };
      }
      hud.push(h);
    }
    return sc.write(outDir, hud);
  };
  return ctx;
};
