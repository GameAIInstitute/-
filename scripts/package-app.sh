#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="image-similarity-checker"
DIST_DIR="$ROOT_DIR/dist"
mkdir -p "$DIST_DIR"

echo "[package] Preparing package output in $DIST_DIR"

# If electron-builder is already available in local dependencies, use it.
if [[ -x "$ROOT_DIR/node_modules/.bin/electron-builder" ]]; then
  echo "[package] Found electron-builder, creating unpacked app bundle"
  "$ROOT_DIR/node_modules/.bin/electron-builder" --dir
  echo "[package] Done: see dist/ for unpacked artifacts"
  exit 0
fi

# Fallback path for restricted environments where dependency install is blocked.
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_PATH="$DIST_DIR/${APP_NAME}-source-${TIMESTAMP}.tar.gz"

echo "[package] electron-builder not found in node_modules."
echo "[package] Creating source archive fallback: $ARCHIVE_PATH"

tar \
  --exclude='./dist' \
  --exclude='./node_modules' \
  --exclude='./.git' \
  -czf "$ARCHIVE_PATH" \
  .

cat <<MSG
[package] Source archive created.
[package] To produce native installers (.dmg/.exe/.AppImage), install electron-builder in an environment with npm access, then rerun:
  npm run package:app
MSG
