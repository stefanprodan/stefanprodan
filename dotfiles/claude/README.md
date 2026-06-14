# Claude Code config

Version-controlled [Claude Code](https://docs.claude.com/en/docs/claude-code)
config, symlinked into `~/.claude/` so the CLI discovers it.

## Contents

- `skills/` — custom skills (each a directory with a `SKILL.md`):
  - **kiro** — delegate a task to Kiro CLI.
  - **copilot** — delegate a task to GitHub Copilot CLI.
  - **gemini** — delegate a task to Gemini CLI.
- `status/statusline.sh` — status line: `⎇ branch | model | ctx%` (or `▸ dir` when not in a git repo).
- `hooks/load-agents-md.sh` — SessionStart hook: if a repo has `AGENTS.md` but
  no `CLAUDE.md`, tell Claude to read and follow `AGENTS.md`.

## Install

Symlink everything into `~/.claude/` (idempotent, safe to re-run):

```bash
./dotfiles/claude/install.sh
```

Claude Code follows the symlinks, so edits made here take effect immediately —
no copy step. Add a new skill by creating `skills/<name>/SKILL.md` and
re-running the install script.

## Plugins

Plugins are **not** managed by `install.sh` — Claude Code tracks them in
`~/.claude/plugins/` and `~/.claude/settings.json`. Listed here so they can be
re-added on a fresh machine via `/plugin` (or `claude plugin install`).

Custom marketplace (third-party):

- **chrome-devtools-mcp** (`ChromeDevTools/chrome-devtools-mcp`) — Chrome
  DevTools control over MCP: browser automation, performance traces, network
  and console inspection.

  ```bash
  claude plugin marketplace add ChromeDevTools/chrome-devtools-mcp
  claude plugin install chrome-devtools-mcp@chrome-devtools-plugins
  ```

From the official marketplace (`anthropics/claude-plugins-official`):
`frontend-design`, `skill-creator`, `feature-dev`, `gopls-lsp`,
`code-simplifier`, `code-review`, `claude-md-management`.

## settings.json wiring

`install.sh` does **not** manage `~/.claude/settings.json` — Claude Code mutates
it (plugin toggles, `/config`), so it stays a real file. It only needs to
*reference* the scripts above. Ensure these entries exist:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash \"$HOME/.claude/status/statusline.sh\""
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$HOME/.claude/hooks/load-agents-md.sh\"",
            "statusMessage": "Loading AGENTS.md"
          }
        ]
      }
    ]
  }
}
```
