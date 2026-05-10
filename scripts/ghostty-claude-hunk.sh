#!/usr/bin/env bash
set -euo pipefail

# Open a new Ghostty tab split side-by-side, both panes cd'd into the directory
# this script was invoked from. Left pane runs Claude Code, right pane shows a
# live, auto-reloading diff of the working tree. Focus is left in the Claude
# Code pane. Assumes Ghostty is already running.
#
# Prerequisites:
#   npm i -g hunkdiff

CWD=$(printf '%q' "$PWD")
CLAUDE_ARGS=${GHOSTTY_CLAUDE_ARGS:-}

osascript <<EOF
tell application "Ghostty" to activate
delay 0.3
tell application "System Events"
    -- new tab
    keystroke "t" using command down
    delay 0.4
    -- left pane
    keystroke "cd $CWD && claude $CLAUDE_ARGS"
    keystroke return
    delay 0.1
    -- split right; focus moves to the new pane
    keystroke "d" using command down
    delay 0.4
    -- right pane
    keystroke "cd $CWD && hunk diff --watch"
    keystroke return
    delay 0.1
    -- move focus back to left pane (Claude Code)
    key code 123 using {command down, option down}
end tell
EOF
