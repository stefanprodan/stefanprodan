#!/usr/bin/env bash
# Verify that every URL path in scripts/urls.txt resolves to a file in site/dist/.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
dist="$repo_root/site/dist"
urls="$repo_root/scripts/urls.txt"

[ -d "$dist" ] || { echo "error: $dist not found, run 'npm run build' first" >&2; exit 1; }

fail=0
count=0
while IFS= read -r path; do
  [ -n "$path" ] || continue
  count=$((count + 1))
  if [[ "$path" == */ ]]; then
    target="$dist${path}index.html"
  else
    target="$dist$path"
  fi
  if [ ! -f "$target" ]; then
    echo "MISSING: $path"
    fail=1
  fi
done < "$urls"

if [ "$fail" -eq 0 ]; then
  echo "OK: all $count URLs from urls.txt exist in dist/"
else
  exit 1
fi
