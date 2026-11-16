// 幕「main」：冒頭と、物語と、締めのカード。この雛形は幕が1つだけ。
// 幕を増やすときは episode.json の acts に名前を足し、acts/<名前>.mjs を作る。各幕は自分の時間の範囲だけを受け持つ。
// 書き方の決まりと ctx の道具の一覧は kinds/sim3d/docs/ACTS.md。
//
// 書き換える所：
//   1. 動く物（ここではリンゴ）の数と出方 … 「リンゴ」の節
//   2. 人物の動き … 「わたし」の節（動きの名前は docs/ACTS.md）
//   3. カット … 「カット」の節。beat ごとにカメラの位置を変える
//   4. 名札・吹き出し・白フラッシュ・衝撃 … 「効果」の節
//
// 秒は、なるべく台本（episode.json の story と beats）から計算している。台本の秒を変えたら、
// 「台本の秒を変えたら、ここも直す」と書いた行（決め打ちの秒が残っている所）を見直す。一覧は GUIDE.md の「秒を変えたときに直す所」。
import { Q, T, model, rng } from "../../../kinds/sim3d/lib/mvscene.mjs";
import { food, chara, person, glbInfo } from "../../../kinds/sim3d/lib/assets.mjs";
import { makeActing, makeToss, hold } from "../../../kinds/sim3d/lib/motion.mjs";
import * as set from "../set.mjs";

export default (ctx) => {
  const { sc, m, ep, fOf, tOf, FPS, N, STEP } = ctx;
  const ALL = [0, N - 1]; // この幕が受け持つコマの範囲（冒頭から締めのカードまで全部）
  const { storySec, endSec } = ep.story;
  const BURST = STEP * ctx.MAXN; // 最後に2倍になる物語の秒（雛形では 2秒 × 5回 = 10秒）。あふれる瞬間
  const beats = ctx.beatsOf("main"); // この幕の beats（カット・名札・吹き出しの秒は、ここから取る）
  const R = rng(7); // 乱数は必ず種つき（同じ入力なら同じ出力にする）

  // ---------- 部屋（動かない物） ----------
  sc.add("room", set.roomParts(m)).at(...ALL);

  // ---------- リンゴ ----------
  // 物体の原点をリンゴの中心にする（転がしたときに中心まわりに回るように）
  const appleParts = () => [model(food("apple"), { h: set.APPLE, pos: [0, -set.APPLE / 2, 0] })];
  const top = set.TABLE_TOP + set.APPLE / 2; // 机に乗ったリンゴの中心の高さ
  // 台本の秒を変えたら、ここも直す（はじめの16個＝最後の2倍の前の数。2倍の回数を変えたら、ます目の数も変える）
  // はじめの16個：机の上の 4×4 のます目。まん中に近い所から順に埋まる
  const grid = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) grid.push([(i - 1.5) * 0.19, (j - 1.5) * 0.19]);
  grid.sort((a, b) => Math.hypot(...a) - Math.hypot(...b) || a[0] - b[0] || a[1] - b[1]);
  // i 番目のリンゴが現れる物語の秒（0 番は最初から。1 番は 2 秒、2〜3 番は 4 秒、4〜7 番は 6 秒…）
  const bornAt = (i) => (i === 0 ? -ep.story.introSec - 1 : STEP * Math.ceil(Math.log2(i + 1)));
  grid.forEach(([x, z], i) => {
    const t0 = bornAt(i), from = Math.max(0, fOf(t0));
    // 上から落ちてきて、ぽんと弾む
    sc.add("apple", appleParts()).anim(from, ALL[1], (f) => {
      const u = tOf(f) - t0, y = u < 0.18 ? top + 0.4 * (1 - u / 0.18) ** 2 : top + 0.03 * Math.max(0, Math.sin((u - 0.18) * 18)) * Math.exp(-(u - 0.18) * 8);
      return T([x, y, z], Q.yaw(i * 1.7));
    });
  });
  // 残りの16個（BURST 秒）：上から降ってきて、山の上で跳ね、机からあふれて床を転がる。投げた物の動きは lib の makeToss
  const floorAt = (x, z) => {
    if (Math.abs(x) < 0.38 && Math.abs(z) < 0.38) return set.TABLE_TOP + set.APPLE * 1.5; // リンゴの山の上
    if (Math.abs(x) < set.TABLE_W / 2 && Math.abs(z) < set.TABLE_D / 2) return top;      // 机の上
    return set.APPLE / 2;                                                                // 床
  };
  // 落ちたリンゴどうしの当たりは計算しない（makeToss は1個ずつ跳ねるだけ）。数が多いと重なるので、降らせる数と散らばりで加減する
  const toss = makeToss({ fps: FPS, until: storySec + endSec, floorAt, walls: { x: 3.3, zMin: set.ROOM.z[0] + 0.1, zMax: set.ROOM.z[1] } });
  // 台本の秒を変えたら、ここも直す（降らせる16個＝最後の2倍で増える数）
  for (let i = 0; i < 16; i++) {
    const t0 = BURST + i * 0.03, a = R() * Math.PI * 2, sp = 0.8 + R() * 1.4;
    const fly = toss(t0, [(R() - 0.5) * 0.5, 1.5 + R() * 0.4, (R() - 0.5) * 0.5], [Math.cos(a) * sp, -0.5, Math.sin(a) * sp], { spin: [R() - 0.5, 0.2, R() - 0.5], w: 6 + R() * 6, bounce: 0.45 });
    sc.add("apple-rain", appleParts()).anim(fOf(t0), ALL[1], (f) => { const [p, q] = fly(tOf(f)); return T(p, q); });
  }

  // ---------- わたし ----------
  // 人物は person(sc, id, 見た目)。見た目は mini-characters の名前（male-a〜f、female-a〜f）
  const me = person(sc, "me", ep.cast.me.look).at(...ALL, T(set.ME_POS, Q.yaw(Math.PI / 2)));
  // 動きを物語の秒で並べる：[開始秒, 動きの名前, (u => 動きの中の秒)]。最後の姿勢で止めるときは hold(動きの長さ)
  const acting = makeActing({ from: ALL[0], to: ALL[1], fOf, tOf });
  // 台本の秒を変えたら、ここも直す（首をふる beat の番号 3、倒れるのは BURST の 0.15 秒後）
  acting(me, [[-ep.story.introSec, "idle", (u) => u], [beats[3].from, "emote-no", (u) => u], [beats[4].from, "idle", (u) => u], [BURST + 0.15, "die", hold(glbInfo(chara(ep.cast.me.look)).clips.die)]]);
  const head = [set.ME_POS[0], 1.12, set.ME_POS[2]]; // 頭のてっぺんのあたり（名札・吹き出しが指す点）

  // ---------- カット ----------
  // ctx.shot(名前, コマの範囲, 光, カメラ)。範囲は ctx.range(物語の秒, 物語の秒) か ctx.INTRO.all・ctx.END で作る（コマ番号を自分で計算しない）
  // カメラは ctx.dolly({pos, target, fov}, {終わりの pos, target, fov}) で、2点のあいだをゆっくり動かす
  // 顔と主役は画面の y 650〜1170px に（上は数字、下は字幕が重なる）。位置は ctx.sc.project(f, [x,y,z]) で確かめられる
  const look = { ...ctx.LOOKS.inside, post: { ao: 1.0, bloom: 0.3 } };
  const cut = (name, range, a, b) => ctx.shot(name, range, look, ctx.dolly(a, b));
  cut("intro", ctx.INTRO.all, { pos: [3.2, 2.8, 4.2], target: [-0.3, 0.5, 0], fov: 40 }, { pos: [2.4, 2.3, 3.6] });
  // beat ごとのカメラ（beats と同じ順・同じ数）。[名前, 始めのカメラ, 終わりのカメラ]
  const CAMS = [
    ["front", { pos: [-0.2, 1.25, 3.3], target: [-0.55, 0.85, 0], fov: 42 }, { pos: [-0.3, 1.15, 3.0] }],
    ["right", { pos: [1.9, 1.25, 2.3], target: [-0.45, 0.62, 0], fov: 40 }, { pos: [1.6, 1.05, 2.0] }],
    ["low", { pos: [0.75, 0.82, 1.05], target: [0, 0.6, 0], fov: 40 }, { pos: [0.55, 0.78, 0.9] }],
    ["face", { pos: [0.1, 1.05, 2.7], target: [-0.75, 1.0, 0.05], fov: 34 }, { pos: [-0.05, 1.0, 2.45] }],
    ["top", { pos: [0, 3.0, 0.75], target: [0, 0.5, 0.05], fov: 36 }, { pos: [0, 2.5, 0.6] }],
    ["out", { pos: [1.4, 1.5, 2.6], target: [-0.2, 0.45, 0], fov: 42 }, { pos: [2.8, 2.4, 4.4], fov: 46 }],
  ];
  if (CAMS.length !== beats.length) throw new Error(`beats は ${beats.length} 本、カメラは ${CAMS.length} 本。acts/main.mjs の CAMS を beats の数にそろえる`);
  // 最後のカットは締めのカード（ctx.END）まで続ける。カードの裏で 0.5 秒かけて黒くなる
  beats.forEach((b, i) => cut(CAMS[i][0], i === beats.length - 1 ? [fOf(b.from), ctx.END[1]] : ctx.range(b.from, b.to), CAMS[i][1], CAMS[i][2]));

  // ---------- 効果 ----------
  // 台本の秒を変えたら、ここも直す（名札は最初の beat、吹き出しは首をふる beat の番号 3 の中）
  ctx.tag(ep.cast.me.name, beats[0].from, beats[0].to, () => head);                    // 名札（暗い札）
  ctx.bubble("え、増えてる？", beats[3].from + 0.3, beats[3].to - 0.1, () => head);      // 台詞（白い吹き出し）
  ctx.flash(BURST, 0.8, 10);                                                           // 白フラッシュ：BURST 秒から、強さ 0.8 で 10 コマ
  ctx.hit(BURST, 0.6);                                                                 // 衝撃：画面が大きく揺れて収まる
};
