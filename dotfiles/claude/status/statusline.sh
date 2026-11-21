#!/usr/bin/env bash
# Claude Code status line. Reads the session JSON on stdin and prints one line:
# <pc> <computer> | <branch-icon> <branch|dir> | <model> | <ctx_usage%> ctx | <wk_usage%> wk
# Icons are Nerd Font glyphs (needs a Nerd Font in the terminal).
# Wired via settings.json -> statusLine.command
# Statusline docs: https://code.claude.com/docs/en/statusline.md
set -euo pipefail

# Read the session data in JSON format.
input=$(cat)

# Single jq pass: tab-separated fields read straight into shell vars.
IFS=$'\t' read -r current_dir model ctx_usage wk_usage < <(
  echo "$input" | jq -r '[
    .workspace.current_dir,
    .model.display_name,
    ((.context_window.used_percentage // 0) | round),
    ((.rate_limits.seven_day.used_percentage // 0) | round)
  ] | @tsv'
)

# Nerd Font glyphs as UTF-8 bytes (macOS bash 3.2 has no \u escapes).
icon_pc=$(printf '\xef\x84\x88')      # nf-fa-desktop U+F108
icon_branch=$(printf '\xee\x9c\xa5')  # nf-dev-git_branch U+E725
icon_dir=$(printf '\xef\x81\xbb')     # nf-fa-folder U+F07B

# Computer name (macOS), falling back to the short hostname.
computer=$(scutil --get ComputerName 2>/dev/null || hostname -s)

# Determine Git branch with fallback to the current dir name.
branch=$(cd "$current_dir" 2>/dev/null && git branch --show-current 2>/dev/null || true)
if [ -n "$branch" ]; then
  line="$icon_pc $computer | $icon_branch $branch | $model"
else
  line="$icon_pc $computer | $icon_dir $(basename "$current_dir") | $model"
fi

# Append session context usage and weekly limit usage if data is present.
{ [ -n "$ctx_usage" ] && [ "$ctx_usage" != "0" ]; } && line="$line | ${ctx_usage}% ctx"
{ [ -n "$wk_usage" ] && [ "$wk_usage" != "0" ]; } && line="$line | ${wk_usage}% wk"

# Print the final status.
echo "$line"

# Persist the account-wide 5h/7d rate limits
cctop_exe="$HOME/go/src/github.com/stefanprodan/cctop/cctop.ts"
printf '%s' "$input" | "$cctop_exe" --capture-usage || true
