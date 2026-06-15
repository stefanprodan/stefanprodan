#!/usr/bin/env bash
# Claude Code status line. Reads the session JSON on stdin and prints one line:
# ⎇ <branch|dir> | <model> | <ctx_usage%> ctx | <wk_usage%> wk
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

# Determine Git branch with fallback to the current dir name.
branch=$(cd "$current_dir" 2>/dev/null && git branch --show-current 2>/dev/null || true)
if [ -n "$branch" ]; then
  line="⎇ $branch | $model"
else
  line="▸ $(basename "$current_dir") | $model"
fi

# Append session context usage and weekly limit usage if data is present.
{ [ -n "$ctx_usage" ] && [ "$ctx_usage" != "0" ]; } && line="$line | ${ctx_usage}% ctx"
{ [ -n "$wk_usage" ] && [ "$wk_usage" != "0" ]; } && line="$line | ${wk_usage}% wk"

# Print the final status.
echo "$line"

# Persist the account-wide 5h/7d rate limits for cctop
{
  cctop_dir="$HOME/.claude/cctop"; cctop_f="$cctop_dir/usage.json"
  cctop_now=$(date +%s)
  cctop_mt=$(stat -f %m "$cctop_f" 2>/dev/null || stat -c %Y "$cctop_f" 2>/dev/null || echo 0)
  if [ $(( cctop_now - cctop_mt )) -ge 30 ]; then
    cctop_snap=$(echo "$input" \
      | jq -c '.rate_limits | objects | select(length > 0)
               | {rate_limits: ., captured_at: (now|floor)}' 2>/dev/null)
    if [ -n "$cctop_snap" ]; then
      mkdir -p "$cctop_dir"
      cctop_tmp=$(mktemp "$cctop_dir/usage.json.XXXXXX") \
        && printf '%s' "$cctop_snap" > "$cctop_tmp" \
        && mv -f "$cctop_tmp" "$cctop_f"
    fi
  fi
} || true
