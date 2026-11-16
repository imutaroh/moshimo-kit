#!/usr/bin/env bash
# 試し撮り：幕を1つだけ計算して、短い範囲を書き出す。
#   ./studio preview <ID> <幕> [開始秒 終了秒] [刻み秒]
#     幕       episode.json の acts の名前（acts/<幕>.mjs）
#     開始・終了 物語の秒（物語0秒＝冒頭の終わり。冒頭は負の数）。省くと、その幕の beats の最初から最後まで
#     刻み秒   コマ一覧の1コマの間隔（既定 0.5）
#   → out/<ID>/preview/<幕>_<開始>-<終了>.mp4（音なし）と、コマを横6列に並べた .jpg
# 計算結果は out/<ID>/preview/baked-<幕>/、書き出し用のフォルダは out/.public/<ID>@<幕>/ に、幕ごとに分けて置く
# （本番の計算結果を上書きしない。ほかの幕の試し撮りと同時に走っても混ざらない。同じ幕を同時に2つは走らせない）
usage() { echo "使い方: ./studio preview <ID> <幕> [開始秒 終了秒] [刻み秒]（秒は数。例: ./studio preview $1 <幕> -2 4 0.5。冒頭は負の数）" >&2; exit 1; }
source "$(dirname "$0")/_common.sh" "$@"
act="${2:-}"
[ -n "$act" ] || usage "$ID"
acts="$(node -p 'Object.keys(require(process.argv[1]).acts ?? {}).join(" ")' "$PROJ/episode.json")"
[[ " $acts " == *" $act "* ]] || { echo "幕が無い: ${act}（episode.json の acts: ${acts}）" >&2; exit 1; }
[ -f "$PROJ/acts/$act.mjs" ] || { echo "幕のファイルが無い: projects/$ID/acts/$act.mjs" >&2; exit 1; }
num='^-?[0-9]+([.][0-9]+)?$'
a="${3:-}" b="${4:-}" step="${5:-0.5}"
if [ -n "$a" ] || [ -n "$b" ]; then [[ "$a" =~ $num && "$b" =~ $num ]] || usage "$ID"; fi
[[ "$step" =~ $num ]] && [ "$(node -p "$step > 0")" = true ] || usage "$ID"

# 範囲（物語の秒）→ コマの範囲
read -r t0 t1 from to <<<"$(node -e '
  const ep = require(process.argv[1]), [act, a, b] = process.argv.slice(2), bs = ep.beats.filter((x) => x.act === act);
  if ((a === "" || b === "") && !bs.length) { console.log("NaN NaN 0 -1"); process.exit(0); }
  const t0 = a !== "" ? +a : Math.min(...bs.map((x) => x.from)), t1 = b !== "" ? +b : Math.max(...bs.map((x) => x.to));
  const fps = ep.video.fps, n = Math.round(fps * ep.video.durationSec), f = (t) => Math.max(0, Math.min(n, Math.round((ep.story.introSec + t) * fps)));
  console.log(t0, t1, f(t0), f(t1) - 1);
' "$PROJ/episode.json" "$act" "$a" "$b")"
[ "$to" -ge "$from" ] || { echo "範囲が空: ${t0}〜${t1} 秒（beats に幕「${act}」が無いときは、開始と終了の秒を渡す）" >&2; exit 1; }

name="${act}_${t0}-${t1}" dir="$OUT/preview"
mkdir -p "$dir"
start=$(date +%s)
export SIM3D_ONLY="$act" SIM3D_BAKED="$dir/baked-$act"
node "$KIND/lib/bake.mjs" "$PROJ"
PUB="$ROOT/out/.public/$ID@$act"
build_public "$PUB" "$SIM3D_BAKED" "$from" "$(( to - from + 1 ))"
render_video "$PUB" "$dir/$name.mp4" >/dev/null
# コマ一覧：step 秒ごとに1コマ、横6列。左上から右へ進む
every="$(node -p "Math.max(1, Math.round($step * $FPS))")"
rows="$(node -p "Math.ceil(Math.ceil(($to - $from + 1) / $every) / 6)")"
ffmpeg -y -v error -i "$dir/$name.mp4" -vf "select='not(mod(n,$every))',scale=360:-1,tile=6x$rows" -frames:v 1 -q:v 3 "$dir/$name.jpg"
echo "${dir#"$ROOT"/}/$name.mp4（物語 ${t0}〜${t1} 秒・コマ ${from}〜${to}）"
echo "${dir#"$ROOT"/}/$name.jpg（${step} 秒ごと・横6列）  $(( $(date +%s) - start )) 秒"
