# shellcheck shell=bash
# render.sh・preview.sh の共通の下ごしらえ（source して使う）。
#   $1 = 動画の ID。./studio から呼ばれると STUDIO_ROOT・STUDIO_KIND・STUDIO_PROJECT・STUDIO_OUT が入っている。
#   直に呼んだとき（kinds/sim3d/render.sh <ID>）は、このファイルの場所から決める。
set -euo pipefail
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
# publicDir を組む：fonts/・models/（shared/ の写し）と episode/（台本と計算結果）
#   $1 = publicDir　$2 = 計算結果のフォルダ
build_public() {
  local pub="$1" baked="$2"
  mkdir -p "$pub/episode"
  rsync -a --delete "$ROOT/shared/fonts/" "$pub/fonts/"
  rsync -a --delete "$ROOT/shared/models/" "$pub/models/"
  # 再生機が読む episode.json は、hud を「既定値＋作品の上書き」にした物
  node "$KIND/lib/hud.mjs" "$PROJ/episode.json" "$pub/episode/episode.json"
  cp -f "$baked/scene.json" "$baked/tracks.bin" "$baked/hud.json" "$pub/episode/"
}
# 無音で書き出す。$1 = publicDir　$2 = 出力先　残りは remotion render に渡す
render_video() {
  local pub="$1" file="$2"; shift 2
  mkdir -p "$(dirname "$file")"
  npx remotion render kinds/sim3d/player/src/index.ts mvscene "$file" \
    --codec=h264 --pixel-format=yuv420p --color-space=bt709 --muted --gl=angle --public-dir="$pub" "$@"
}
# 引数の中の --frames=a-b の a（無ければ 0）
first_frame() {
  local a
  for a in "$@"; do case "$a" in --frames=*) a="${a#--frames=}"; echo "${a%%-*}"; return;; esac; done
  echo 0
}
