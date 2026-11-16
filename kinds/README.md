# 作り方（kind）の決まり

このリポジトリは、動画の「作り方」を `kinds/<作り方>/` に1つずつ持つ。1本の動画は `projects/<ID>/` に置き、どの作り方で作るかを `project.json` の `kind` に書く。
入口の `./studio` は、`project.json` を読んで、その作り方のスクリプトを呼ぶだけ。作り方の中身（何で描くか、台本の形、部品）は、作り方ごとに自由に決めてよい。

## 作り方が持つファイル

```
kinds/<作り方>/
  kind.json     { "summary": "1行の説明", "for": "どんな動画に向くか" }
  GUIDE.md      この作り方で1本を作る手順と、合格の基準。エージェントは、作り始める前にこれを読む
  new.sh        新しい動画の雛形を projects/<ID>/ に作る
  render.sh     完成品を書き出す
  preview.sh    試し撮り（任意。無い作り方は、GUIDE.md に確かめ方を書く）
  template/     new.sh が写す雛形
  …             あとは自由（src/、lib/、scripts/ など）
```

## スクリプトの約束

`./studio` は、リポジトリの直下を作業フォルダにして、次の形で呼ぶ。

```
kinds/<作り方>/<スクリプト> <ID> [追加の引数...]
```

| 環境変数 | 中身 |
| --- | --- |
| `STUDIO_ROOT` | リポジトリの直下（絶対パス） |
| `STUDIO_KIND` | `kinds/<作り方>`（絶対パス） |
| `STUDIO_PROJECT` | `projects/<ID>`（絶対パス） |
| `STUDIO_OUT` | `out/<ID>`（絶対パス）。書き出した物はここに置く |

- **`new.sh <ID> <題名>`**：`$STUDIO_PROJECT` を作り、`template/` を写して、ID と題名を埋める。`project.json` は `./studio` が後から書くので、作らなくてよい。**作った直後に、何も直さずに `./studio render <ID>` が通ること**（動く見本から直し始められるように）。読み上げを使う作り方（`explainer-short`・`lesson`）だけは例外で、「new → 読みの確認 → 読み上げ → render」の順で通ればよい（読み上げの音声は Git に入れないので、雛形に付けられない）。その場合、読み上げが無いまま render を打つと、足りない物と次に打つコマンドを出して止まること
- **`render.sh <ID> [...]`**：**音つきの完成品を `$STUDIO_OUT/<ID>.mp4` に書き出す**（h264・yuv420p・aac）。途中の物（無音の映像など）は `$STUDIO_OUT/` の別の名前にする。失敗したら 0 以外で終わる
  - Remotion には `--codec=h264 --pixel-format=yuv420p --color-space=bt709` を付ける。`--color-space=bt709` が無いと、色の形式がフルレンジの `yuvj420p` になり、投稿先や再生機によって濃さが変わって見える。`./studio check` が形式を表示する
  - 音が無い動画にも、無音の音声トラックを付ける（音声トラックの無い mp4 は、投稿先で弾かれることがある）
  - 追加の引数に `--frames=…` が付いたときは、一部分だけの書き出し。**完成品の `<ID>.mp4` を上書きせず**、`$STUDIO_OUT/<ID>_part.mp4` のような別の名前で出し、その道を表示する。`--frames` 以外の引数（`--log=error` など）は、完成品の書き出しにそのまま渡す
- **`preview.sh <ID> [...]`**：書き出しの前に目で確かめるための物を、`$STUDIO_OUT/preview/` に置く。**コマを並べた jpg は必ず作る**（短い範囲を書き出して並べるか、節目のコマを静止画で抜いて並べる）。動きを見るための mp4 は、作り方に合う形で（常に作る、範囲を指定したときだけ作る、など）。引数の意味は作り方ごとに決め、GUIDE.md に書く

## 場所の決まり

- Remotion などの依存は、リポジトリ直下の `package.json` に1つだけ。作り方の中に `package.json` や `node_modules` を作らない。書き出しは、リポジトリの直下で `npx remotion render kinds/<作り方>/…/index.ts …` のように呼ぶ（直下の `remotion.config.ts` が効く）
- Remotion の publicDir は、書き出しのたびに `out/.public/<ID>/`（試し撮りは `out/.public/<ID>@<何か>/`）に組み、`--public-dir` で渡す。同時に2つ書き出しても混ざらないように、動画ごと・試し撮りごとに分ける
- 複数の作り方で使う素材は `shared/`（フォント、3D 素材、キャラクター、効果音）。1つの作り方しか使わない物は、その作り方の中に置く
- 作り直せる中間物（計算結果、読み上げの音声）は `projects/<ID>/` の中の、Git に入れないフォルダ（`baked/`・`voice/`）に置く
- **絶対パスを書かない。** スクリプトも文書も、リポジトリの直下からの相対の道で書く（フォルダの名前や場所を変えても動くように）
- `./studio`・直下の `package.json`・`remotion.config.ts`・`tsconfig.json`・`.gitignore` は、作り方からは変えない。足したい依存や無視したいファイルがあるときは、理由と一緒に伝える

## 新しい作り方を足すとき

1. `kinds/<名前>/` に上のファイルを置く
2. `./studio new <名前> <試しのID>` → `./studio render <試しのID>` → `./studio check <試しのID>` が通ることを確かめ、コマを目で見る
3. `GUIDE.md` に、手順・台本の形・合格の基準・確かめ方を書く
4. 直下の `CLAUDE.md` の「作り方の選び方」の表に1行足す
