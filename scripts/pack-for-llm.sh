#!/usr/bin/env bash
# Concatenates all git-tracked source files into a single .txt for pasting into an LLM chatbot.
# Skips binary/lockfile noise (images, icons, package-lock) that add tokens with no signal.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

OUT="${1:-waiting-game-source.txt}"

SKIP_EXTS='png|ico|icns|jpg|jpeg|gif|webp|lock'
SKIP_PATHS='(^|/)(package-lock\.json|Cargo\.lock)$'

{
  echo "=== waiting-game: packed source, generated $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo

  git ls-files | while IFS= read -r f; do
    ext="${f##*.}"
    if [[ "$ext" =~ ^($SKIP_EXTS)$ ]] || [[ "$f" =~ $SKIP_PATHS ]]; then
      continue
    fi
    echo "=== FILE: $f ==="
    cat "$f"
    echo
  done
} > "$OUT"

echo "Wrote $OUT ($(wc -l < "$OUT" | tr -d ' ') lines, $(du -h "$OUT" | cut -f1))"
