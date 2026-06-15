#!/usr/bin/env bash
# Claude Code status line. Reads the session JSON on stdin and prints one line:
# ⎇ <branch|dir> | <model> | <ctx_usage%> ctx | <wk_usage%> wk
# Wired via settings.json -> statusLine.command
# Statusline docs: https://code.claude.com/docs/en/statusline.md
set -euo pipefail

# Read the session data in JSON format.
input=$(cat)

# Single jq pass: tab-separated fields read straight into shell vars. Keep
# absent middle fields non-empty (tab is IFS-whitespace, so an empty middle
# field collapses and shifts the rest left); trailing fields may be empty.
IFS=$'\t' read -r current_dir model ctx_usage wk_usage < <(
  echo "$input" | jq -r '[
    .workspace.current_dir,
    .model.display_name,
    (.context_window.used_percentage // "0"),
    (.rate_limits.seven_day.used_percentage // "")
  ] | @tsv'
)

# Determine Git branch with fallback to the current dir name.
branch=$(cd "$current_dir" 2>/dev/null && git branch --show-current 2>/dev/null || true)
if [ -n "$branch" ]; then
  line="⎇ $branch | $model"
else
  line="▸ $(basename "$current_dir") | $model"
fi

# Append session context usage and weekly limit usage if data is present.
{ [ -n "$ctx_usage" ] && [ "$ctx_usage" != "0" ]; } && line="$line | ${ctx_usage}% ctx"
[ -n "$wk_usage" ] && line="$line | ${wk_usage}% wk"

# Print the final status.
echo "$line"
