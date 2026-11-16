# 場面データの形式（mvscene/1）

`kinds/sim3d/lib/bake.mjs` が、作品の幕（`projects/<ID>/acts/*.mjs`）を呼んで、動画の全コマを次の3ファイルに書き出す。再生機（`kinds/sim3d/player/src/`）はこれを**再生するだけ**で、作品ごとのコードは持たない。

```
projects/<ID>/baked/scene.json   物体・素材・カット・カメラの在りか
projects/<ID>/baked/tracks.bin   コマごとの数値。Float32（リトルエンディアン）がただ並んだもの
projects/<ID>/baked/hud.json     コマごとの画面の文字
projects/<ID>/episode.json       動画の大きさと、HUD の見た目（位置・大きさ・色）の上書き

書き出しのとき、render.sh は書き出し用のフォルダ（`out/.public/<ID>/`）を次の形に組み、HyperFrames がその `index.html` を開いて1コマずつ撮る。再生機は、このフォルダからの道で読む。

```
index.html             再生機のページ（kinds/sim3d/player/index.html に大きさ・fps・長さ・先頭のコマを埋めた物）
player.js              再生機（kinds/sim3d/player/src/ を three ごと1つにまとめた物）
episode/episode.json   作品の episode.json の hud を「kinds/sim3d/lib/hud-defaults.json ＋ 作品の上書き」にした物
episode/scene.json・tracks.bin・hud.json   計算結果の写し
fonts/                 shared/fonts の写し
models/                shared/models の写し（scene.json の models と parts の src は、ここからの道）
```
```

座標は x=右、y=上、z=手前（右手系）。単位はメートル。回転は四元数 `[qx,qy,qz,qw]`。Blender のように z が上の道具は、位置を (x, -z, y)、四元数を (w, x, -z, y) に読み替える。

## scene.json

```jsonc
{
  "format": "mvscene/1",
  "video": { "width": 1080, "height": 1920, "fps": 30, "durationSec": 78, "frameCount": 2340 },
  "materials": [ { "id": "…", "color": "#B5814B", "emissive": 0, "opacity": 1 } ],
  "objects": [ {
      "id": "plate12",
      "parts": [ { "shape": "cyl", "material": "…", "t": [px,py,pz, qx,qy,qz,qw, sx,sy,sz] } ],
      "segments": [ { "from": 0, "to": 149, "t": [10個] }, { "from": 150, "to": 899, "o": 12340 } ],
      "opacity": [ { "from": 990, "to": 1049, "o": 55550 } ]
  } ],
  "camera": { "o": 987650 },
  "shots": [ { "name": "S1", "from": 150, "to": 269, "background": "#F2E8D5",
               "sun": { "from": [2,4.5,3], "color": "#FFF4E0", "intensity": 1 },
               "ambient": { "color": "#BFC8D6", "intensity": 1 }, "shadows": true, "shadowExtent": 12 } ]
}
```

### 物体（objects）

- 物体は、部品（parts）をひとまとめにした剛体。部品の `t` は物体の中での位置・回転・拡大
- 物体そのものの位置・回転・拡大は `segments` が決める。コマ f が `from`〜`to`（両端を含む）に入る区間があれば、その区間の変換で**表示する**。どの区間にも入らないコマでは**表示しない**
  - `"t"` がある区間：そのあいだずっと同じ変換
  - `"o"` がある区間：`tracks.bin` の `o + (f - from) * 10` 番目から10個が、そのコマの変換
- 変換は10個の数：位置3、四元数4、拡大3。世界での値（親子関係は無い）
- 部品の `shape` が `model` のときは、`material` の代わりに `src`（3D 素材の道。書き出し用のフォルダからの道、例 `models/kenney/food-kit/apple.glb`）を持つ。使う素材の一覧は scene.json の `models`
- `clips` があれば、素材に入っている動き（歩く・座るなど）を再生する：`{ "from", "to", "clip": 動きの名前, "o", "fade" }`。コマ f の動きの中の秒は `tracks.bin[o + (f - from)]`。`fade` コマかけて直前の動きから切り替える。区間のあいだのコマは、直前の動きの最後の姿勢で止める
- `opacity` があれば、該当コマで `tracks.bin[o + (f - from)]` の1個（0〜1）を素材の不透明度に掛ける。区間の外は 1

### 形（shape）

すべて原点が中心の「単位の形」。大きさは変換の拡大で決まる。面は滑らかにせず、角ばらせる（ローポリの見た目）。

| shape | 単位の形 |
| --- | --- |
| `box` | 1辺 1 の立方体 |
| `cyl` | 半径 1・高さ 1 の円柱（軸は y、20角） |
| `cone` | 底の半径 1・高さ 1 の円すい（軸は y、頂点が +y、20角） |
| `sphere` | 半径 1 の球（経度16・緯度10 程度） |
| `torus` | 大きい半径 1・管の半径 0.08 の輪（軸は y） |

### 素材（materials）

- `color`：sRGB の16進
- `emissive` が 0 より大きい素材：光も影も受けず、`color` そのままの色で光って見える（影も落とさない）
- `opacity` が 1 未満、または物体の `opacity` が 1 未満のとき：半透明で描く（影は落とさない）
- それ以外：光と影を受ける、つやの無い素材

### カメラ

`tracks.bin` の `camera.o + f * 10` 番目から10個：位置3、注視点3、上方向3、縦の画角（度）。

### カット（shots）

全コマは、ちょうど1つのカットに入る。カットごとに背景色と光が決まる。

- `background`：背景（空）の色
- `sun.from`：太陽のある方向（原点から見た向き）。`intensity` 1 が「ふつうの昼の屋内外」。再生機は、intensity 1 のときに素材の色がほぼそのまま出るように自分の単位へ換算する
- `ambient`：影の側を照らす環境光
- `shadows`：false のカットは影を描かない（宇宙など）
- `shadowExtent`：影を計算する範囲の目安（メートル）。カメラの注視点を中心に、この半径が入ればよい

## hud.json

`frames[f]` が、そのコマの画面の文字。値が `null` の項目は描かない。`a` は不透明度（0〜1）。位置・大きさ・色は 書き出し用のフォルダの `episode/episode.json` の `hud`（既定値は `kinds/sim3d/lib/hud-defaults.json`）にある。

```jsonc
{
  "f": 480,
  "title":   { "lines": [[{ "t": "もし" }, { "t": "回転寿司のレーン", "accent": true }, { "t": "が、" }]], "sub": "※…", "a": 1 },
  "clock":   { "label": "店内の時計", "text": "12:29:58", "a": 1 },
  "main":    { "count": "12", "countUnit": "秒目", "label": "レーンの速さ",
               "value": "時速 147", "unit": "km", "badge": "×1,024", "badgeScale": 1.0, "a": 1 },
  "pill":    { "text": "プロ野球の速球なみ", "a": 1 },
  "caption": { "lines": ["皿が、", "壁に刺さりはじめた"], "a": 1 },
  "tags":    [ { "text": "ヤマダ", "x": 512, "y": 804, "a": 1 } ],
  "bubbles": [ { "text": "へい、お待ち", "x": 300, "y": 700, "a": 1 } ],
  "card":    { "lines": ["玉子は、来なかった"], "small": ["…"], "a": 1 },
  "note":    { "text": "※…", "a": 1 },
  "black":   0.0
}
```

- `title`：冒頭の題。`lines` は行の配列で、各行は文字のかたまりの配列。`accent: true` のかたまりは強調色
- `main`：左上の数字のかたまり（何秒目・ラベル・値と単位・倍率のバッジ）
- `pill`：値の下に出す「○○と同じ」の札
- `caption`：画面中ほどの字幕（1〜2行）
- `tags` / `bubbles`：`x`,`y` は**指している点**の px。そこから上へ細い線（長さは `hud.tag.stemPx` / `hud.bubble.stemPx`）がのび、その上に札や吹き出しが中央揃えで乗る。画面の左右からはみ出すときは、札だけ内側へ寄せる。`tags` は名札（小さな暗い札）、`bubbles` は台詞（白い吹き出し）
- `card`：締めのカード。画面中央に大きい行と小さい行
- `note`：画面下の小さな注記
- `black`：画面全体に重ねる黒の濃さ（0〜1）。HUD の文字は黒の**上**に描く

描く順は、3D → 上部の薄い影（`hud.topShade`）→ `black` → 文字。
