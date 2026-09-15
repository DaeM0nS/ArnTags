#!/usr/bin/env bash
set -euo pipefail

SOURCE_SVG="${1:-public/favicon.svg}"
DEST_DIR="${2:-ios/App/App/Assets.xcassets/AppIcon.appiconset}"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "rsvg-convert is required. Install librsvg2-bin (Linux) or librsvg (macOS)." >&2
  exit 1
fi

if [ ! -f "$SOURCE_SVG" ]; then
  echo "Source icon not found: $SOURCE_SVG" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

make_png() {
  local size="$1"
  local name="$2"
  rsvg-convert -w "$size" -h "$size" "$SOURCE_SVG" -o "$DEST_DIR/$name"
}

make_png 40   "AppIcon-20@2x.png"
make_png 60   "AppIcon-20@3x.png"
make_png 58   "AppIcon-29@2x.png"
make_png 87   "AppIcon-29@3x.png"
make_png 80   "AppIcon-40@2x.png"
make_png 120  "AppIcon-40@3x.png"
make_png 120  "AppIcon-60@2x.png"
make_png 180  "AppIcon-60@3x.png"
make_png 20   "AppIcon-20-ipad@1x.png"
make_png 40   "AppIcon-20-ipad@2x.png"
make_png 29   "AppIcon-29-ipad@1x.png"
make_png 58   "AppIcon-29-ipad@2x.png"
make_png 40   "AppIcon-40-ipad@1x.png"
make_png 80   "AppIcon-40-ipad@2x.png"
make_png 76   "AppIcon-76-ipad@1x.png"
make_png 152  "AppIcon-76-ipad@2x.png"
make_png 167  "AppIcon-83.5@2x.png"
make_png 1024 "AppIcon-1024.png"

cat > "$DEST_DIR/Contents.json" <<'JSON'
{
  "images": [
    { "idiom": "iphone", "size": "20x20", "scale": "2x", "filename": "AppIcon-20@2x.png" },
    { "idiom": "iphone", "size": "20x20", "scale": "3x", "filename": "AppIcon-20@3x.png" },
    { "idiom": "iphone", "size": "29x29", "scale": "2x", "filename": "AppIcon-29@2x.png" },
    { "idiom": "iphone", "size": "29x29", "scale": "3x", "filename": "AppIcon-29@3x.png" },
    { "idiom": "iphone", "size": "40x40", "scale": "2x", "filename": "AppIcon-40@2x.png" },
    { "idiom": "iphone", "size": "40x40", "scale": "3x", "filename": "AppIcon-40@3x.png" },
    { "idiom": "iphone", "size": "60x60", "scale": "2x", "filename": "AppIcon-60@2x.png" },
    { "idiom": "iphone", "size": "60x60", "scale": "3x", "filename": "AppIcon-60@3x.png" },
    { "idiom": "ipad", "size": "20x20", "scale": "1x", "filename": "AppIcon-20-ipad@1x.png" },
    { "idiom": "ipad", "size": "20x20", "scale": "2x", "filename": "AppIcon-20-ipad@2x.png" },
    { "idiom": "ipad", "size": "29x29", "scale": "1x", "filename": "AppIcon-29-ipad@1x.png" },
    { "idiom": "ipad", "size": "29x29", "scale": "2x", "filename": "AppIcon-29-ipad@2x.png" },
    { "idiom": "ipad", "size": "40x40", "scale": "1x", "filename": "AppIcon-40-ipad@1x.png" },
    { "idiom": "ipad", "size": "40x40", "scale": "2x", "filename": "AppIcon-40-ipad@2x.png" },
    { "idiom": "ipad", "size": "76x76", "scale": "1x", "filename": "AppIcon-76-ipad@1x.png" },
    { "idiom": "ipad", "size": "76x76", "scale": "2x", "filename": "AppIcon-76-ipad@2x.png" },
    { "idiom": "ipad", "size": "83.5x83.5", "scale": "2x", "filename": "AppIcon-83.5@2x.png" },
    { "idiom": "ios-marketing", "size": "1024x1024", "scale": "1x", "filename": "AppIcon-1024.png" }
  ],
  "info": { "version": 1, "author": "xcode" }
}
JSON

echo "Generated iOS app icons in $DEST_DIR from $SOURCE_SVG"