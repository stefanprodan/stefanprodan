#!/usr/bin/env bash
# Claude Code status line. Reads the session JSON on stdin and prints one line:
#   ⎇ <branch> | <model> | <ctx%>   when inside a git repo
#   ▸ <dir>    | <model> | <ctx%>   otherwise
# Wired via settings.json -> statusLine.command.
set -euo pipefail

input=$(cat)
current_dir=$(echo "$input" | jq -r '.workspace.current_dir')
cd "$current_dir" 2>/dev/null || true
branch=$(git branch --show-current 2>/dev/null || true)
model=$(echo "$input" | jq -r '.model.display_name')
used=$(echo "$input" | jq -r '.context_window.used_percentage // "0"')

if [ -n "$branch" ]; then
  echo "⎇ $branch | $model | $used%"
else
  dir=$(basename "$current_dir")
  echo "▸ $dir | $model | $used%"
fi
