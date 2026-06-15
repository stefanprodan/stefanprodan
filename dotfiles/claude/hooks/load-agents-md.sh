#!/usr/bin/env bash
# SessionStart hook: loads AGENTS.md if exists and no CLAUDE.md in present.
# Wired via settings.json -> hooks.SessionStart
# Hooks docs: https://code.claude.com/docs/en/hooks.md
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
if [ -f "$root/AGENTS.md" ] && [ ! -f "$root/CLAUDE.md" ]; then
  jq -n '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:"Read AGENTS.md at the repository root in full now, and follow it for the rest of the session."}}'
fi 2>/dev/null || true
