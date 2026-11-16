# moshimo-kit

「もし〇〇が2秒ごとに2倍になったら？」の 3D 縦動画（1080×1920・30fps・音つき）を、Claude Code に話しかけて作るためのフォルダです。コードを書く必要はありません。

## 使い方

1. このページの緑の「Code」ボタン →「Download ZIP」でダウンロードし、ダブルクリックで開く
2. Claude のデスクトップアプリで「Code」を開き、入力欄の下で「Local」と、開いたフォルダを選ぶ
3. 「はじめて使います。準備をしてください」と送る
4. 準備ができたら「もし〇〇が2秒ごとに2倍になったら？の動画を作りたい」と送る

あとは Claude が聞いてくることに答えます。Claude 向けの進め方は [`CLAUDE.md`](CLAUDE.md) にあります。

## 入っている物

| 物 | 中身 |
| --- | --- |
| 作り方 | `kinds/sim3d/`：台本から全コマを計算し、Remotion と Three.js で描く |
| 見本 | `projects/sim3d-sample/`（リンゴ・17秒）、`projects/kaiten-sushi/`（回転寿司・79秒） |
| 3D 素材 | `shared/models/kenney/`：Kenney の5集（人・車・食べ物・家具・店とビル、約470個） |
| 大人の人物 | `shared/models/quaternius/`：Quaternius の12体（スーツ・私服・作業着など。歩く・手をふる・倒れるなどの動きつき） |
| 文字 | `shared/fonts/`：IBM Plex Sans JP / Mono |

手元に無い物を描きたいときは、Claude が外の素材サイト（Poly Haven、Poly Pizza など）から候補を探し、ライセンスを見せて確認を取ってから足します。

## 必要な物

- Mac
- Claude Code が使える Claude のアカウント（有料プラン、または会社のアカウント）
- Node.js と ffmpeg（無ければ Claude が入れ方を案内します）

## ライセンス

- 動画の土台の [Remotion](https://www.remotion.dev/license) は、個人・3人までの会社・評価の目的なら無料です。4人以上の会社の仕事で使うときは、会社向けのライセンスが要ります（詳しくは `knowledge/oss.md`）
- 3D 素材は [Kenney](https://kenney.nl/)（CC0）と [Quaternius](https://quaternius.com/) の「Ultimate Modular Men / Women」（CC0）、フォントは IBM Plex（SIL OFL 1.1）。ライセンスのファイルは `shared/` の中にあります
