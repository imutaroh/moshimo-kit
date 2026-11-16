// 3D 素材（shared/models/kenney/ の Kenney の素材集。CC0）の道と、作品に依らない置き方。
// 道は shared/ から（＝ publicDir から）の道。中身の一覧は `ls shared/models/kenney/<集>/`、大きさは glbInfo(道).size
import { model } from "./mvscene.mjs";
export { glbInfo } from "./glb.mjs";

export const food = (n) => `models/kenney/food-kit/${n}.glb`;                         // 食べ物・食器・台所の小物
export const furn = (n) => `models/kenney/furniture-kit/${n}.glb`;                    // 家具・家電・照明
export const chara = (n) => `models/kenney/mini-characters/character-${n}.glb`;       // 人物（male-a〜f、female-a〜f）
export const car = (n) => `models/kenney/car-kit/${n}.glb`;                           // 車
export const city = (n) => `models/kenney/city-kit-commercial/${n}.glb`;              // 店・ビル

// 人物の拡大率。mini-characters をこの倍率で置くと、立った背丈 約1.08m、頭の幅 約0.7m の三頭身になる
export const K = 1.5;
// 人物を1人作る。返り値は物体（.at / .anim で置き場所、.clip で動きを決める）
//   動きの名前：idle walk sprint jump fall crouch sit drive die pick-up emote-yes emote-no holding-right holding-left holding-both
//               interact-right interact-left attack-melee-right attack-kick-right ほか。全部の名前と長さは glbInfo(chara("male-d")).clips
export const person = (sc, id, look, k = K) => sc.add(id, [model(chara(look), { k, feet: true })]);

// 大人の頭身の人物（shared/models/quaternius/ の Quaternius「Ultimate Modular Men / Women」。CC0）
//   見た目：man-suit man-casual man-hoodie man-worker man-farmer man-beach
//           woman-suit woman-dress woman-casual woman-worker woman-punk woman-adventurer
//   動きの名前（Kenney と違い、頭が大文字）：Idle Idle_Neutral Walk Run Wave Interact HitRecieve HitRecieve_2 Death Roll
//           Punch_Left Punch_Right Kick_Left Kick_Right ほか。座る動きは無い。全部は glbInfo(adult("man-suit")).clips
export const adult = (n) => `models/quaternius/${n}.glb`;
// 大人の人物の拡大率。KA で置くと立った背丈 約1.1m になり、三頭身の人物（K）と同じ舞台・カメラにそのまま入る。
//   大人に合わせて舞台を作るときは k を上げ、家具とカメラもその背丈に合わせる（もとの背丈は 約1.85m）
export const KA = 0.6;
export const adultPerson = (sc, id, look, k = KA) => sc.add(id, [model(adult(look), { k, feet: true })]);
// 小物1つを部品にする。it = { src, h|w|d（どれか1つの長さ m）, pos（底の中心）, quat }
export const itemPart = (it, pos = it.pos, quat = it.quat) => model(it.src, { ...(it.h ? { h: it.h } : it.w ? { w: it.w } : { d: it.d }), pos, quat });
