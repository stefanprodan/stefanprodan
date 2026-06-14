#!/usr/bin/env bash
# Symlink the Claude Code config tracked in this repo into ~/.claude/ so the CLI
# discovers it: skills, the status line script, and hook scripts.
# Safe to re-run (idempotent).
#
# NOTE: this does NOT manage ~/.claude/settings.json (which references these
# scripts via $HOME/.claude/... paths). settings.json is mutated by Claude Code
# itself (plugin toggles, /config); keep it as a real file. The wiring it needs
# is documented in README.md.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.claude"

link() { # link <repo-relative-src> <dest-abs>
  local src="$SRC/$1" dst="$2"
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    echo "skip: a real path already exists at $dst (move or remove it first)" >&2
    return
  fi
  mkdir -p "$(dirname "$dst")"
  ln -sfn "$src" "$dst"
  echo "linked $dst -> $src"
}

# Skills (one symlink per skill directory)
mkdir -p "$DEST/skills"
for skill_dir in "$SRC"/skills/*/; do
  link "skills/$(basename "$skill_dir")" "$DEST/skills/$(basename "$skill_dir")"
done

# Status line + hooks
chmod +x "$SRC"/status/*.sh "$SRC"/hooks/*.sh
link "status/statusline.sh" "$DEST/status/statusline.sh"
link "hooks/load-agents-md.sh" "$DEST/hooks/load-agents-md.sh"
