#!/usr/bin/env bash
# 完成品を書き出す。./studio render <ID> [remotion render の引数...] から呼ばれる → out/<ID>/<ID>.mp4（音つき）
#   1. 計算結果（projects/<ID>/baked/）が無いか、台本・作品のコード・lib より古ければ、計算し直す（音も）
#   2. publicDir を out/.public/<ID>/ に組む
#   3. 無音で書き出し（out/<ID>/<名前>.silent.mp4）、音を重ねて out/<ID>/<名前>.mp4 にする
#      sound.mjs が無い動画は、無音の音声トラック（aac・48kHz・ステレオ）を付ける
#
# 追加の引数（例 --frames=0-59）は Remotion に渡す。音は、そのコマの位置から重ねる。
# 出力の名前（<名前>）は SIM3D_OUT_NAME で変えられる。既定は <ID>。
# ただし --frames があって SIM3D_OUT_NAME が無いときは <ID>_part にする（完成品を一部分だけの物で上書きしないように）。
source "$(dirname "$0")/_common.sh" "$@"
shift
stale && { echo "計算し直す（台本か作品のコードか lib が新しい）"; bake; }

NAME="${SIM3D_OUT_NAME:-$ID}"
for a in "$@"; do case "$a" in --frames=*) [ -n "${SIM3D_OUT_NAME:-}" ] || NAME="${ID}_part";; esac; done
PUB="$ROOT/out/.public/$ID"
build_public "$PUB" "$PROJ/baked"
SILENT="$OUT/$NAME.silent.mp4" FINAL="$OUT/$NAME.mp4"
render_video "$PUB" "$SILENT" "$@"

AUDIO="$PROJ/baked/audio.wav"
if [ -f "$AUDIO" ]; then
  offset="$(node -p "$(first_frame "$@") / $FPS")"
  ffmpeg -y -v error -i "$SILENT" -ss "$offset" -i "$AUDIO" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$FINAL"
  trash "$SILENT"
else
  # 音が無い動画にも、無音の音声トラック（aac・48kHz・ステレオ、映像と同じ長さ）を付ける（契約）
  echo "音が無い（projects/$ID/sound.mjs が無い）ので、無音の音声トラックを付ける" >&2
  ffmpeg -y -v error -i "$SILENT" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$FINAL"
  trash "$SILENT"
fi
echo "${FINAL#"$ROOT"/}"
