// 幕の中で使う、作品に依らない動きの道具。どれも「同じ入力なら同じ出力」の純粋な計算。
import { V, Q, T, sphere, clamp, ease } from "./mvscene.mjs";

// a〜b のあいだで 0→1 になめらかに変わる（a より前は 0、b より後は 1）
export const smooth = (t, a, b) => ease((t - a) / (b - a));

// 角度：a から b を向く向き（y 軸まわり。+z が 0）と、近いほうを回って a→b を k で補う
export const yawTo = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]);
export const lerpAng = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };

// 動きの中の秒を、長さ dur の動きの最後の姿勢で止める（.clip の fn に渡す。例 hold(glbInfo(…).clips.die)）
export const hold = (dur) => (x) => Math.min(Math.max(0, x), dur - 0.02);

// 跳ねる：τ 秒前に速さ v（m/秒）で突き上げられた物の高さ（2回目は小さく跳ねて止まる）
export const hop = (tau, v) => {
  if (tau <= 0) return 0;
  const t1 = (2 * v) / 9.8;
  if (tau < t1) return v * tau - 4.9 * tau * tau;
  const v2 = v * 0.35, t2 = (2 * v2) / 9.8, s = tau - t1;
  return s < t2 ? v2 * s - 4.9 * s * s : 0;
};

// 2点 a・b を結ぶ太さ w の筋の変換（box か cyl の単位の形に使う）。光の筋・柱・線に
export const seg = (a, b, w) => { const d = V.sub(b, a), L = Math.max(1e-4, V.len(d)); return T(V.mul(V.add(a, b), 0.5), Q.fromY(d), [w, L, w]); };

// 半径 rad の球（中心 center）の表面の、向き dir の所に貼る斑（つぶれた球の部品）。大陸・クレーター・模様に
//   a：斑の広がり　thick：厚み　lift：表面から浮かせる量
export const patch = (mat, center, rad, dir, a, thick, lift = 0) => ({ ...sphere(mat, V.add(center, V.mul(dir, rad + lift)), [a, thick, a]), t: T(V.add(center, V.mul(dir, rad + lift)), Q.fromY(dir), [a, thick, a]) });

// 人の動き（.clip）を、物語の秒の区切りで並べる道具を作る。from〜to はその幕が受け持つコマの範囲
//   const acting = makeActing({ from: FROM, to: TO, fOf: ctx.fOf, tOf: ctx.tOf });
//   acting(人物, [[t0, 動きの名前, (u => 動きの中の秒)], ...])   次の区切りの t0 まで続く。最初は from から、最後は to まで
export const makeActing = ({ from: FROM, to: TO, fOf, tOf }) => (obj, list) => {
  list.forEach(([t0, name, fn], i) => {
    const from = i === 0 ? FROM : Math.max(FROM, fOf(t0));
    const to = i === list.length - 1 ? TO : Math.min(TO, fOf(list[i + 1][0]) - 1);
    if (to >= from) obj.clip(from, to, name, (f) => (fn ? fn(tOf(f) - t0) : 0.1));
  });
  return obj;
};

// 投げた物の動きを作る道具。重力で落ち、面で跳ねて止まる。部屋の壁では跳ね返る
//   fps：動画の fps　until：計算する終わり（物語の秒）
//   floorAt(x, z)：その場所の面の高さ（床・机など）　walls：{ x, zMin, zMax }（|x| と z の範囲。壁の内側）
// 返り値 toss(t0, p, v, opts) は、t0 に p から速さ v で飛ばした物の (t) => [pos, quat]。
//   opts：spin（回る軸）・w（回る速さ）・q0（はじめの向き）・bounce（跳ね返り）・walls（false なら壁も面も無視し、y=0 で止まる）
export const makeToss = ({ fps: FPS, until, floorAt, walls: box }) => (t0, p, v, { spin = [1, 0, 0], w = 8, q0 = Q.id(), bounce = 0.3, walls = true } = {}) => {
  const dt = 1 / FPS / 4, steps = Math.ceil((until - t0) * FPS * 4) + 8, ax = V.norm(spin);
  const out = [];
  let pos = [...p], vel = [...v], ang = 0, wn = w;
  for (let s = 0; s <= steps; s++) {
    if (s % 4 === 0) out.push([[...pos], Q.mul(Q.axis(ax, ang), q0)]);
    vel[1] -= 9.8 * dt;
    pos = V.add(pos, V.mul(vel, dt));
    ang += wn * dt;
    if (walls) {
      if (Math.abs(pos[0]) > box.x) { pos[0] = Math.sign(pos[0]) * box.x; vel[0] *= -0.35; }
      if (pos[2] < box.zMin) { pos[2] = box.zMin; vel[2] *= -0.35; }
      if (pos[2] > box.zMax) { pos[2] = box.zMax; vel[2] *= -0.35; }
    }
    const floor = walls ? floorAt(pos[0], pos[2]) : 0;
    if (pos[1] < floor) {
      pos[1] = floor;
      if (vel[1] < -0.6) { vel[1] *= -bounce; vel[0] *= 0.6; vel[2] *= 0.6; wn *= 0.5; }
      else { vel[1] = 0; vel[0] *= 0.985; vel[2] *= 0.985; wn *= 0.97; }
    }
  }
  return (t) => out[clamp(Math.round((t - t0) * FPS), 0, out.length - 1)];
};
