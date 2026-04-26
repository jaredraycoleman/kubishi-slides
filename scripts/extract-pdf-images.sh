#!/bin/bash
# Extract one image per slide from a Google-Slides-exported PDF.
#
# Usage: extract-pdf-images.sh <pdf-path> <output-dir>
#
# For each PDF page, picks the largest embedded image (skips small decorative
# graphics), converts it to WebP (quality 82, max width 1024), saves as
# slide-NN.webp, and prints a JSON manifest.
#
# Requires: pdfimages (poppler), magick or convert (ImageMagick), jq.
set -euo pipefail

PDF="$1"
OUT="$2"

if [[ ! -f "$PDF" ]]; then echo "PDF not found: $PDF" >&2; exit 1; fi
mkdir -p "$OUT"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pdfimages -png -p "$PDF" "$TMP/img"

# magick (IM7) preferred; fall back to convert
if command -v magick >/dev/null 2>&1; then CONVERT="magick"; else CONVERT="convert"; fi

# For each page, pick the largest image
manifest_entries=()
for page_dir in $(ls "$TMP" | sed -E 's/img-([0-9]+)-.*/\1/' | sort -u); do
  page_num=$((10#$page_dir))
  largest=$(ls -S "$TMP"/img-${page_dir}-*.png 2>/dev/null | head -1 || true)
  if [[ -z "${largest:-}" ]]; then continue; fi
  # Skip if image is tiny (< 20KB — likely decorative)
  size=$(stat -c%s "$largest")
  if (( size < 20000 )); then continue; fi

  dest=$(printf "%s/slide-%02d.webp" "$OUT" "$page_num")
  $CONVERT "$largest" -resize '1024x1024>' -quality 82 -define webp:method=6 "$dest" 2>/dev/null
  manifest_entries+=("$(printf '"%d": "slide-%02d.webp"' "$page_num" "$page_num")")
done

# Print manifest
echo "{"
for i in "${!manifest_entries[@]}"; do
  if (( i < ${#manifest_entries[@]} - 1 )); then
    echo "  ${manifest_entries[$i]},"
  else
    echo "  ${manifest_entries[$i]}"
  fi
done
echo "}"
