#!/bin/bash
# Builds „Calibre Covers.app" — the window around lab/calibre/app.ts (ROADMAP 5.16b).
#
#   lab/calibre/macos/build.sh              # into ~/Applications
#   lab/calibre/macos/build.sh <folder>     # somewhere else
#
# Run it from the checkout the app should use: the project folder is written
# into the app, so an app built from a worktree stops working when the
# worktree goes. node's folder is written in as well, because an app started
# from the Finder does not see the shell's PATH (nvm). Needs the Xcode command
# line tools (swiftc). After moving the project or changing node: build again.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
OUT="${1:-$HOME/Applications}"
APP="$OUT/Calibre Covers.app"
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "node was not found in PATH." >&2; exit 1; }
command -v swiftc >/dev/null || { echo "swiftc was not found. Install the Xcode command line tools: xcode-select --install" >&2; exit 1; }

mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O -o "$APP/Contents/MacOS/CalibreCovers" "$HERE/CalibreCovers.swift" -framework Cocoa -framework WebKit

WORK="$(mktemp -d)"
(cd "$ROOT" && npx tsx lab/calibre/macos/icon.ts "$WORK/icon.png")
mkdir "$WORK/AppIcon.iconset"
for size in 16 32 128 256 512; do
  sips -z $size $size "$WORK/icon.png" --out "$WORK/AppIcon.iconset/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) "$WORK/icon.png" --out "$WORK/AppIcon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$WORK/AppIcon.iconset" -o "$APP/Contents/Resources/AppIcon.icns"
rm -r "$WORK"

xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g'; }
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>CalibreCovers</string>
  <key>CFBundleIdentifier</key><string>com.buyitscovers.calibre-covers</string>
  <key>CFBundleName</key><string>Calibre Covers</string>
  <key>CFBundleDisplayName</key><string>Calibre Covers</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
  <key>CalibreProjectDir</key><string>$(xml "$ROOT")</string>
  <key>CalibreNodeBin</key><string>$(xml "$(dirname "$NODE")")</string>
</dict>
</plist>
PLIST

codesign --force -s - "$APP" >/dev/null 2>&1 || echo "note: the app could not be signed ad hoc; it still runs on this Mac."
echo "Built: $APP"
echo "Uses:  $ROOT"
