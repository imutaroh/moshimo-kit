# 回転寿司（kaiten-sushi）

「もし回転寿司のレーンが、2秒ごとに2倍速になっていったら？」。79秒・30fps・1080×1920。作り方は sim3d（`kinds/sim3d/GUIDE.md`）。
幕の書き方の一般の決まりは `kinds/sim3d/docs/ACTS.md`。ここには、この作品だけの決まりを書く。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `episode.json` | 台本（beats 29本）、配役、幕の順、締めのカード、数字の出どころ（`sources`） |
| `story.mjs` | 作品の設定：題、速さの単位の言い換え、比較の札、店内の時計、注意書き、揺れの時間割、跡地の光（`ruin`）、`ctx.beltDistance` |
| `kit.mjs` | 店のセット：部屋・カウンター・レーン・棚・照明・席の小物と、その寸法 |
| `acts/outside.mjs` | 冒頭の先見せ（動画の0〜2.6秒）と、物語の24〜36秒（駐車場と街） |
| `acts/interior.mjs` | 冒頭の店内（動画の2.6〜5秒）と、物語の0〜24秒 |
| `acts/finale.mjs` | 物語の36〜69秒（宇宙・跡地）と、締めのカード |
| `sound.mjs` | 音の台本 |

## 時間

- 最初の5秒が冒頭、次の69秒が物語、最後の5秒が締めのカード
- 冒頭は `ctx.INTRO.ahead`（結末の先見せ。物語 -5〜-2.4 秒）と `ctx.INTRO.clock`（店内の時計。-2.4〜0 秒）に分かれる（`story.mjs` の `intro`）
- レーンの速さは秒速4cm から2秒ごとに2倍。33回目（物語66秒）で光の速さに届いて止まる

## 3幕で揃えること

- **玉子は黄色**。玉子の皿は `kit.plateParts("sushi-egg")`。光の筋になってからは `#FFD23F`（emissive）。ほかの皿の筋は `#FFF3C4`（emissive）
- 土ぼこりは `#D8C7A8` の球（opacity 0.5 から消えていく）
- 配役：ヤマダ＝`male-d`（席は `kit.SEATS[kit.YAMADA_SEAT]`）、大将＝`female-e`（`kit.CHEF_POS`）、客5人＝`ctx.ep.cast.guests`、警官＝`male-c`
- 物語24秒の時点：客5人は出口から駐車場へ走り出ている。店に残っているのはヤマダと大将だけ。まん中の窓（`kit.WINDOWS[1]`）は割れている
- 物語52秒からの跡地：建物は無い。同じ場所にカウンターとレーン、ヤマダ（同じ席）、大将（同じ場所）だけが残っている
- レーンの皿は物語16秒（秒速10m）から、1コマに進む距離が皿の間隔の半分を超える。そこからは光の筋にする

## 座標

- 店は `kit.ROOM`（x -5〜5、z -2.4〜3.3、高さ 3）。客は z=1.02 に並んで奥（-z）を向く。レーンは x 方向に流れる
- 出口は手前の壁（z=3.3）の x 3.0〜4.2。**駐車場と街は z > 3.3 の側**
- 小物は現実の `kit.PROP`（1.55）倍。座らせるときは人物を `kit.SIT_Y` 持ち上げて clip `sit` と組で使う

## 確かめ方

```sh
./studio preview kaiten-sushi <幕> <開始秒> <終了秒> [刻み秒]   # 例: ./studio preview kaiten-sushi outside -5 -2.4 0.25
./studio render kaiten-sushi && ./studio check kaiten-sushi
```

道具（`kinds/sim3d/lib/`）を直したときは、計算結果が変わっていないことを sha256 で確かめられる（この作品は同じ入力なら1バイトも変わらない）。

```sh
node kinds/sim3d/lib/bake.mjs projects/kaiten-sushi && node projects/kaiten-sushi/sound.mjs
shasum -a 256 projects/kaiten-sushi/baked/*
```

2026-11-14 に元のリポジトリから移したときの値：

```
00835011f441c6cd9bbfeacd3a78da0913b1365a70a09ad5e5d8e84da2114ec0  scene.json
68c263cf207d800b88454209f18a053a7f9dd80f110fd8e736afdbf8542b6de5  tracks.bin
51a40c98962fb3a776d9277df9735d56b0f47c3e7dfa3194e046c43f28b4f95f  hud.json
ebd66de0ffa5b4e34e56a7813d4d8f574a6bb6a391d6fc115719fb456c41956e  audio.wav
```
