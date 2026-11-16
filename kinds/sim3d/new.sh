#!/usr/bin/env bash
# 新しい動画の雛形を作る。./studio new sim3d <ID> "題名" から呼ばれる → projects/<ID>/
#   template/ を写し、episode.json の __ID__ と __TITLE__ を埋める。project.json は ./studio が書く。
set -euo pipefail
ID="${1:?使い方: new.sh <ID> <題名>}"
TITLE="${2:-$ID}"
KIND="${STUDIO_KIND:-$(cd "$(dirname "$0")" && pwd)}"
ROOT="${STUDIO_ROOT:-$(cd "$KIND/../.." && pwd)}"
PROJ="${STUDIO_PROJECT:-$ROOT/projects/$ID}"
[ ! -e "$PROJ" ] || { echo "もうある: ${PROJ#"$ROOT"/}" >&2; exit 1; }
mkdir -p "$(dirname "$PROJ")"
cp -R "$KIND/template" "$PROJ"
# JSON の文字列として埋める（題名に " や \ があっても壊れないように）
node -e '
  const fs = require("fs"), [file, id, title] = process.argv.slice(1);
  const s = fs.readFileSync(file, "utf8").replaceAll("\"__ID__\"", JSON.stringify(id)).replaceAll("\"__TITLE__\"", JSON.stringify(title));
  fs.writeFileSync(file, s);
' "$PROJ/episode.json" "$ID" "$TITLE"
echo "${PROJ#"$ROOT"/}/ に雛形を写した。題名は episode.json の title（冒頭の大きな題は story.mjs の title）"
