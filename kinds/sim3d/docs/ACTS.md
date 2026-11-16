# 幕の書き方

1本の動画は、幕（act）に分けて作る。幕は `projects/<ID>/acts/<名前>.mjs` の1ファイルで、`export default (ctx) => { ... }` の形をしている。
幕の名前と順番は `episode.json` の `acts` に書く（`lib/bake.mjs` はこの順に幕を呼ぶ）。台本は `episode.json` の `beats`（物語の何秒から何秒に、何が起きて、字幕は何か）。幕は、自分の beats の `event` を絵にする。

数字（何秒目・値・倍率・比較の札）と字幕は、台本と作品の設定（`story.mjs`）から自動で画面に出る。幕では書かない。
動く見本は `kinds/sim3d/template/acts/main.mjs`（短い）と `projects/kaiten-sushi/acts/`（79秒・3幕）。

## 時間の決まり

- 動画は「冒頭（`story.introSec` 秒）→ 物語（`story.storySec` 秒）→ 締めのカード（`story.endSec` 秒）」の3つに分かれる
- **「物語の秒」**で考える。物語0秒＝冒頭の終わり。冒頭は負の数（`-introSec`〜0）
- コマの範囲は、必ず次のどれかで作る（自分でコマ番号を計算しない。幕の境目で重なりや抜けが出る）
  - `ctx.range(t0, t1)` 物語 t0〜t1 秒（両端を含むコマの範囲 `[from, to]`）
  - `ctx.INTRO.all`（冒頭の全部）。`story.mjs` の `intro` で冒頭を名前つきに区切ると `ctx.INTRO.<名前>` も使える
  - `ctx.END`（締めのカード。0.5秒で黒くなり、文字が出る）
- 物体は、自分の幕の範囲の中だけに置く（`.at(from, to)` / `.anim(from, to)`。範囲の外では表示されない）。ほかの幕の時間に物を残さない
- どの幕も作らなかった範囲は、`lib/context.mjs` が黒い仮のカットで埋める（幕を1つずつ作って試し撮りできるように）。全部の幕がそろったら、黒い範囲が残っていないことを確かめる
- 同じ入力なら必ず同じ出力にする。乱数は `rng(種)`（種つき）だけを使い、`Math.random()` や時刻を使わない

## 道具（ctx）

| 道具 | 中身 |
| --- | --- |
| `ctx.sc` | 場面。`sc.add(id, parts)` で物体を足し、`.at(from, to, T)`・`.anim(from, to, f => T)`・`.fade(from, to, f => 0〜1)`・`.clip(from, to, 動きの名前, f => 動きの中の秒)` を続ける。定義は `lib/mvscene.mjs` |
| `ctx.m(色, {emissive, opacity})` | 色（素材）。`emissive: 1` は自分で光る（影を受けない） |
| `ctx.shot(名前, 範囲, 光, カメラ)` | カットを1つ決める。光は `ctx.LOOKS` の名前（lib の既定は `inside` `outside` `aerial` `space`。作品の `story.mjs` の `looks` で足せる）か、`{...ctx.LOOKS.inside, post: {...}}` のように一部を変えた値。カメラは `(f, k) => ({pos, target, fov, up?})`（k は 0〜1） |
| `ctx.dolly(a, b)` | 2点のあいだをゆっくり動くカメラ。`ctx.shot` の4つめに渡す。b は変わる所だけ書けばよい |
| `ctx.tag(文字, t0, t1, f => [x,y,z])` | 名札（暗い札）。世界の点を指す |
| `ctx.bubble(文字, t0, t1, f => [x,y,z])` | 台詞（白い吹き出し） |
| `ctx.flash(t, 強さ, コマ数)` | 白フラッシュ（カメラの前に白い板を数コマ） |
| `ctx.hit(t, 強さ)` | 衝撃。画面が大きく揺れて収まる |
| `ctx.calm(t0, t1)` | 揺らさない時間（静かな会話など） |
| `ctx.fOf(t)` `ctx.tOf(f)` `ctx.F(秒)` | 物語の秒→コマ、コマ→物語の秒、長さ（秒）→コマ数 |
| `ctx.FPS` `ctx.N` `ctx.F0` `ctx.END0` | fps、全コマ数、物語0秒のコマ、締めの最初のコマ |
| `ctx.stepOf(t)` `ctx.speedAt(t)` `ctx.STEP` `ctx.MAXN` `ctx.doubling` | 「N秒ごとに2倍」：何回2倍になったか、その時の値、何秒ごとか、2倍の回数の上限。`ctx.doubling.distance(t)` は値を速さとみなして進んだ距離。定義は `lib/doubling.mjs` |
| `ctx.ep` `ctx.beatsOf(幕)` | 台本（`episode.json`）、その幕の beats |
| ほか | 作品の `story.mjs` の `extend(ctx)` が足した道具（例：回転寿司の `ctx.beltDistance`） |

手ぶれは自動で付く（大きさは作品の `story.mjs` の `shake` が決める）。カメラは揺らさずに書く。

光の `post` は `{ ao, bloom, focus, aperture }`。`focus`（ピントの距離 m）と `aperture`（0.00006 くらい）を入れると、遠くと手前がぼける。

## 部品（作品に依らない物）

| ファイル | 中身 |
| --- | --- |
| `lib/mvscene.mjs` | ベクトル `V`、回転 `Q`（`Q.yaw` `Q.euler` `Q.fromY` `Q.fromBasis`）、変換 `T(pos, quat, scale)`、`clamp` `ease` `lerp` `rng`、形 `box cyl sphere cone torus`、3D 素材 `model(src, {h|w|d|k, pos, quat, feet})` |
| `lib/assets.mjs` | 素材の道 `food` `furn` `chara` `car` `city`、人物 `person(sc, id, 見た目)`、小物 `itemPart(it)`、人物の拡大率 `K`、`glbInfo` |
| `lib/motion.mjs` | `smooth`（なめらかな 0→1）、`yawTo` `lerpAng`（向き）、`hold`（動きの最後の姿勢で止める）、`hop`（跳ねる高さ）、`seg`（2点を結ぶ筋）、`patch`（球に貼る斑）、`makeActing`（人物の動きを秒で並べる）、`makeToss`（投げた物が落ちて跳ねる。**物どうしの当たりは計算しない**ので、たくさん降らせると重なる。避け方は GUIDE.md の落とし穴） |

作品だけの部品（部屋・家具の配置・寸法）は、作品のフォルダの1ファイル（雛形では `set.mjs`、回転寿司では `kit.mjs`）にまとめ、幕はそこから取る。

- 座標：x=右、y=上、z=手前。単位は m
- 人物は三頭身（立った背丈 約1.08m、頭の幅 約0.7m）。座った人の頭のてっぺんは y≒1.25。小物は現実より大きめに作る（回転寿司は 1.55 倍）。これは「ジオラマの寸法」で、わざとそうしている
- 人物の動き（`.clip` の名前）：`idle walk sprint jump fall crouch sit drive die pick-up emote-yes emote-no holding-right holding-left holding-both interact-right interact-left attack-melee-right attack-kick-right` ほか。全部の名前と長さは `glbInfo(chara("male-d")).clips`。動きの中の秒が長さを超えるとくり返す。最後の姿勢で止めるときは `hold(長さ)`
- 素材の前の向き（人物・車は +z）と、人物に合う大きさの目安は、GUIDE.md の「素材の向きと大きさの目安」の表
- 素材は `shared/models/kenney/` に5集（food-kit、furniture-kit、mini-characters、car-kit、city-kit-commercial）。`ls` で名前を見て、`model(src, {h|w|d|k, pos, quat})` で大きさを決めて置く。もとの大きさは `glbInfo(src).size`
- 場面データの仕様は `docs/FORMAT.md`

## 絵の合格の基準

回転寿司の前の版は「同じコマばかりで、見続けたいと思えない」と言われた。原因は、1枚に写る物の少なさと、同じ構図の長さだった。

1. **1枚に写る物の量を保つ。** 寄りの絵でも、背景に部屋・街・小物が入るようにする。何も無い面を大きく写さない
2. **同じ構図を2秒より長く続けない。** beat ごとにカメラの位置を変える。3〜4秒ある beat は、中で切るか、カメラか物を動かし続ける
3. **beat ごとに、その場面でしか起きない出来事が、動きとして見えること。** 止め絵で説明できる絵ではなく、0.1秒刻みで見て物が動いていること
4. **顔と主役は、画面の y 650〜1170px（1920 中）に置く。** その上は数字、下は字幕が重なる。名札と台詞の指す点も y 650 より下にする。`ctx.sc.project(f, [x,y,z])` で画面上の位置を数で確かめられる。冒頭は、題名が y 470〜800 に重なる
5. **名札・吹き出しの指す点は、画面の x 40〜1040px・y>120 に収める。** 外に出たコマでは、何も言わずに描かれない。計算結果の `hud.json`（形は `{ fps, frameCount, frames }`。名札は `frames[コマ].tags`、吹き出しは `frames[コマ].bubbles` の中）で、出したい秒のコマが空になっていないかを数える（例は GUIDE.md の手順6）
6. **速すぎる物は筋にする。** 1コマに進む距離が物の間隔の半分を超えると、逆向きにゆっくり動いて見える。そこからは、進行方向に伸ばした光る箱（`seg` で作る筋）に切り替える
7. カメラを壁の外や物の中に置かない（壁しか写らない）

## 気をつけること

- `ctx.sc.project(f, …)` は、そのコマのカメラが決まった後でしか呼べない（決まっていないコマで呼ぶと落ちる）。名札の `f => …` は書き出しの最後に呼ばれるので大丈夫だが、幕の中で直に呼ぶときは `ctx.shot` の後にする
- 幕の中で共有ファイル（lib、ほかの幕、作品の部品ファイル）を変えない。足りない道具は自分の幕の中に書き、報告で「共通にしたほうがよい物」として挙げる
