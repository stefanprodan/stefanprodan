-- Open a new Ghostty tab split side-by-side, both panes cd'd into the directory
-- this script was invoked from. Left pane runs Claude Code, right pane shows a
-- live, auto-reloading diff of the working tree. Focus is left in the Claude
-- Code pane. Assumes Ghostty is already running.
--
-- Usage:
--   alias gch='osascript ~/path/to/ghostty-claude-hunk.applescript'
--
-- Prerequisites:
--   npm i -g hunkdiff

set cwd to quoted form of (system attribute "PWD")
set claudeArgs to system attribute "GHOSTTY_CLAUDE_ARGS"

tell application "Ghostty" to activate
delay 0.3
tell application "System Events"
	-- new tab
	keystroke "t" using command down
	delay 0.4
	-- left pane
	keystroke "cd " & cwd & " && claude " & claudeArgs
	keystroke return
	delay 0.1
	-- split right; focus moves to the new pane
	keystroke "d" using command down
	delay 0.4
	-- right pane
	keystroke "cd " & cwd & " && hunk diff --watch"
	keystroke return
	delay 0.1
	-- move focus back to left pane (Claude Code)
	key code 123 using {command down, option down}
end tell
