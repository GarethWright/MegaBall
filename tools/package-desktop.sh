#!/usr/bin/env bash
# Packages the locally built desktop apps into downloads/ (served by the website at /downloads/).
#   npm run desktop:mac && npm run desktop:win && npm run package:desktop
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p downloads
MAC="src-tauri/target/universal-apple-darwin/release/bundle/dmg"
WIN="src-tauri/target/x86_64-pc-windows-gnu/release"
if ls "$MAC"/*.dmg >/dev/null 2>&1; then cp "$MAC"/*.dmg downloads/MegaballNeo-mac.dmg; fi
if [ -f "$WIN/megaball-neo.exe" ]; then
  STAGE=$(mktemp -d)
  mkdir -p "$STAGE/Megaball Neo"
  cp "$WIN/megaball-neo.exe" "$STAGE/Megaball Neo/Megaball Neo.exe"
  cp "$WIN/WebView2Loader.dll" "$STAGE/Megaball Neo/"
  cat > "$STAGE/Megaball Neo/README.txt" <<'TXT'
Megaball Neo - developed by Loxy
https://megaballneo.com

Run "Megaball Neo.exe". Keep WebView2Loader.dll next to it.
Needs the Microsoft Edge WebView2 runtime (built into Windows 10 and 11).
TXT
  (cd "$STAGE" && zip -qr -9 "$OLDPWD/downloads/MegaballNeo-windows.zip" "Megaball Neo")
  rm -rf "$STAGE"
fi
ls -la downloads
