# shellcheck shell=bash
# render.sh・preview.sh の共通の下ごしらえ（source して使う）。
#   $1 = 動画の ID。./studio から呼ばれると STUDIO_ROOT・STUDIO_KIND・STUDIO_PROJECT・STUDIO_OUT が入っている。
#   直に呼んだとき（kinds/sim3d/render.sh <ID>）は、このファイルの場所から決める。
set -euo pipefail
# HyperFrames に利用状況を外へ送らせない（書き出しのたびに送る機能がある）
export HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1
ID="${1:?使い方: $(basename "$0") <ID> [...]}"
KIND="${STUDIO_KIND:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
ROOT="${STUDIO_ROOT:-$(cd "$KIND/../.." && pwd)}"
PROJ="${STUDIO_PROJECT:-$ROOT/projects/$ID}"
OUT="${STUDIO_OUT:-$ROOT/out/$ID}"
cd "$ROOT"
[ -f "$PROJ/episode.json" ] || { echo "台本が無い: ${PROJ#"$ROOT"/}/episode.json" >&2; exit 1; }
FORMAT="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).format||"")' "$PROJ/episode.json")"
[ "$FORMAT" = "mvscene/1" ] || { echo "この作り方が描けるのは format: mvscene/1 の台本だけ（$ID は \"$FORMAT\"）" >&2; exit 1; }
FPS="$(node -p 'require(process.argv[1]).video.fps' "$PROJ/episode.json")"

# 台本から全コマの数値と音を計算する。SIM3D_BAKED・SIM3D_ONLY はそのまま lib/bake.mjs と sound.mjs に渡る
bake() {
  node "$KIND/lib/bake.mjs" "$PROJ"
  [ ! -f "$PROJ/sound.mjs" ] || node "$PROJ/sound.mjs"
}
# 計算結果が無いか、台本・作品のコード・lib のどれかより古いか（古ければ 0 を返す）
stale() {
  local b="$PROJ/baked" ref
  for ref in scene.json tracks.bin hud.json; do [ -f "$b/$ref" ] || return 0; done
  ref="$b/hud.json"
  if [ -f "$PROJ/sound.mjs" ]; then
    [ -f "$b/audio.wav" ] || return 0
    [ "$b/audio.wav" -nt "$ref" ] || ref="$b/audio.wav" # 古いほうと比べる
  fi
  [ -n "$(find "$PROJ" "$KIND/lib" -type f \( -name '*.mjs' -o -name '*.json' \) -not -path '*/baked/*' -not -name project.json -newer "$ref" 2>/dev/null | head -1)" ]
}
# 書き出し用のフォルダ（HyperFrames が開くページのフォルダ）を組む：
#   index.html（再生機のページ）・player.js（再生機。three も中に入れて1つにまとめる）・fonts/・models/（shared/ の写し）・episode/（台本と計算結果）
#   $1 = フォルダ　$2 = 計算結果のフォルダ　$3 = 書き出す先頭のコマ（既定 0）　$4 = 書き出すコマ数（既定 最後まで）
build_public() {
  local pub="$1" baked="$2" start="${3:-0}" count="${4:-}"
  mkdir -p "$pub/episode"
  rsync -a --delete "$ROOT/shared/fonts/" "$pub/fonts/"
  rsync -a --delete "$ROOT/shared/models/" "$pub/models/"
  # 再生機が読む episode.json は、hud を「既定値＋作品の上書き」にした物
  node "$KIND/lib/hud.mjs" "$PROJ/episode.json" "$pub/episode/episode.json"
  cp -f "$baked/scene.json" "$baked/tracks.bin" "$baked/hud.json" "$pub/episode/"
  npx --no-install esbuild "$KIND/player/src/main.ts" --bundle --format=esm --target=es2020 --outfile="$pub/player.js" --log-level=warning
  # ページの雛形に、大きさ・fps・長さ・先頭のコマを埋める
  node -e '
    const fs = require("fs"), [tpl, scene, out, start, count] = process.argv.slice(1);
    const v = JSON.parse(fs.readFileSync(scene, "utf8")).video, s = Number(start), n = count === "" ? v.frameCount - s : Number(count);
    if (!(Number.isInteger(s) && Number.isInteger(n) && s >= 0 && n > 0 && s + n <= v.frameCount)) throw new Error(`コマの範囲が動画の外: ${s} から ${n} コマ（全部で ${v.frameCount} コマ）`);
    const vals = { WIDTH: v.width, HEIGHT: v.height, FPS: v.fps, DURATION: n / v.fps, START_FRAME: s };
    fs.writeFileSync(out, fs.readFileSync(tpl, "utf8").replace(/\{\{(\w+)\}\}/g, (_, k) => String(vals[k])));
    console.log(n);
  ' "$KIND/player/index.html" "$baked/scene.json" "$pub/index.html" "$start" "$count" >"$pub/.frames"
}
# 無音で書き出す。$1 = 書き出し用のフォルダ　$2 = 出力先　残りは hyperframes render に渡す
#   利用状況の送信（テレメトリー）は、上の export で止めてある
render_video() {
  local pub="$1" file="$2"; shift 2
  mkdir -p "$(dirname "$file")"
  # 並列の数：短い動画は 4、40秒（1200コマ）以上は自動に任せる。10コアの Mac で測った値（2026-11-16）：
  #   17秒の見本は 自動 50秒・4並列 37秒・8並列 44秒。79秒の回転寿司は 自動 164秒・4並列 202秒
  #   --workers を渡せば、後ろに付くその値が効く
  local workers=4
  [ "$(cat "$pub/.frames")" -lt 1200 ] || workers=auto
  npx --no-install hyperframes render "$pub" --output "$file" --format mp4 --crf 18 --workers "$workers" --quiet "$@"
}
# 引数の中の --frames=a-b を「先頭のコマ コマ数」にする（無ければ「0 空」＝最後まで）
frames_range() {
  local a
  for a in "$@"; do case "$a" in --frames=*) a="${a#--frames=}"; echo "${a%%-*} $(( ${a##*-} - ${a%%-*} + 1 ))"; return;; esac; done
  echo "0 "
}
# --frames=… を除いた残りの引数（hyperframes render に渡す物）を、1行に1つずつ出す
other_args() {
  local a
  for a in "$@"; do case "$a" in --frames=*) ;; *) printf '%s\n' "$a";; esac; done
}
# 引数の中の --frames=a-b の a（無ければ 0）
first_frame() {
  local a
  for a in "$@"; do case "$a" in --frames=*) a="${a#--frames=}"; echo "${a%%-*}"; return;; esac; done
  echo 0
}
