#!/usr/bin/env bash
# SessionStart hook: if the repo root has an AGENTS.md but no CLAUDE.md, tell
# Claude to read and follow AGENTS.md for the session.
# Wired via settings.json -> hooks.SessionStart.
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
if [ -f "$root/AGENTS.md" ] && [ ! -f "$root/CLAUDE.md" ]; then
  jq -n '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:"Read AGENTS.md at the repository root in full now, and follow it for the rest of the session."}}'
fi 2>/dev/null || true
