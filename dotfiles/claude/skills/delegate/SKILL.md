---
name: delegate
description: >
  Delegate a task to another coding agent CLI (OpenCode with GPT-6.1 Sol by
  default, Kiro with GPT-5.6 Sol, or GitHub Copilot with GPT-6 Astra) by
  running it directly from the main conversation. Use whenever the user says
  /delegate, names a tool or model ("use opencode", "ask kiro", "use copilot",
  "review with Sol", "ask Astra"), or wants a second opinion, review, research
  pass, or fix from another model. Several tools can run in parallel for
  side-by-side opinions.
---

# Delegation

Run the CLI yourself with Bash. Do not spawn a subagent to do it: wrapper
agents have repeatedly either duplicated the tool's reading at full token cost
or skipped the CLI entirely and done the task themselves. You compose the
prompt, the tool does the work, you verify and relay.

## Picking the tool

| User says | Tool | Model |
|---|---|---|
| nothing specific, "Sol", "6.1 Sol", "opencode" | OpenCode (default) | `azure/gpt-6.1-sol#high` |
| "kiro", "5.6 Sol" | Kiro | `gpt-5.6-sol`, effort high |
| "copilot", "Astra", "GPT-6" | Copilot | `gpt-6-astra`, effort high |

When the user names several ("have Astra and Sol both review"), run each in
parallel (see Parallel tasks) and present the findings side by side, noting
where they agree and disagree.

## Invocation

A run routinely takes 10-30 minutes, longer than the foreground Bash limit, so
always run it with `run_in_background: true`. Never run it in the foreground.
Log to `/tmp/<tool>-<task>-<n>.log`, where `<n>` is the attempt number
(1, then 2 on a re-dispatch), so a retry never overwrites the log of the
attempt before it.

Every command runs under `timeout --verbose -s KILL 45m`. That is the stall
rule: a hung run looks exactly like a working one (OpenCode prints nothing
while the model reasons), so instead of guessing from the log, any run still
going at 45 minutes is killed. `timeout` kills its process group, which
covers the tool, its server and the commands it spawns; a process that starts
its own group or session can survive. Do not arm a separate watch.

Setup steps and the CLI share one redirect, so a failed `mktemp`, `jq` or
`cd` lands in the log too.

The prompt goes in a heredoc; `PROMPT_EOF` must not appear on a line of its
own inside the prompt (pick another delimiter if it does, or the rest of the
prompt runs as shell).

**OpenCode**

```shell
set -o pipefail; { D=$(mktemp -d) && jq 'del(.mcp)' ~/.config/opencode/opencode.jsonc > "$D/opencode.jsonc" && cd -- "<working directory>" && OPENCODE_CONFIG_DIR="$D" timeout --verbose -s KILL 45m opencode run --standalone --auto --title "<task>" -m 'azure/gpt-6.1-sol#high' "$(cat <<'PROMPT_EOF'
<task prompt>
PROMPT_EOF
)" < /dev/null; rc=$?; rm -rf "$D"; exit $rc; } 2>&1 | sed -u 's/\x1b\[[0-9;?]*[a-zA-Z]//g' > "/tmp/opencode-<task>-<n>.log"
```

- MCP servers are disabled: `OPENCODE_CONFIG_DIR` points at a temporary copy
  of the config without the `mcp` block (there is no CLI flag for it), removed
  when the run ends. Credentials live outside the config dir, so auth is
  unaffected. If `jq` fails, the config has gained comments; strip them or ask
  the user.
- `< /dev/null` is REQUIRED: in a background shell stdin stays open and
  `opencode run` waits on it for extra prompt text forever, before it even
  creates a session.
- `opencode run` has no directory flag; it works in the cwd, hence the `cd`.
- `--auto` is REQUIRED: it auto-approves permissions not explicitly denied in
  the config.
- `--standalone` gives each run its own private server instead of the shared
  background service, so parallel runs don't share state and the kill reaches
  the server.
- `--title` names the session so the user can find and resume it later
  (`opencode session list`). Never resume on your own; when a run is killed or
  fails, report the session title and let the user decide.

**Kiro**

```shell
set -o pipefail; { cd -- "<working directory>" && timeout --verbose -s KILL 45m kiro-cli chat --no-interactive --model=gpt-5.6-sol --effort high --trust-all-tools <<'PROMPT_EOF'
<task prompt>
PROMPT_EOF
} 2>&1 | sed -u 's/\x1b\[[0-9;?]*[a-zA-Z]//g' > "/tmp/kiro-<task>-<n>.log"
```

**Copilot**

```shell
timeout --verbose -s KILL 45m copilot -C "<working directory>" --model gpt-6-astra --reasoning-effort high --allow-all --silent --no-color --log-level none -p "$(cat <<'PROMPT_EOF'
<task prompt>
PROMPT_EOF
)" < /dev/null > "/tmp/copilot-<task>-<n>.log" 2>&1
```

- `--allow-all` is REQUIRED for `-p` mode; without it Copilot refuses to run
  tools.
- `--silent` prints only the agent response, without the stats footer, and
  `--no-color` keeps it free of ANSI codes, so no filter is needed.

**All tools**

- For review/research/analysis, state "Do NOT modify any files" in the
  prompt. It is only an instruction, not a guard (every tool runs with all
  tools allowed); the post-run `git status` check is what catches violations.
- `sed -u` runs unbuffered so each line flushes to the log. Blank lines are
  kept so the response's Markdown survives.
- The run notifies you when it finishes, so don't poll. For a mid-run peek,
  run a bare `tail -n 20 <log>` (no `sleep` prefix; the harness blocks
  `sleep N; tail`). An empty or flat log is normal while the model reasons.

## Collecting the result

- Exit code 137 with `timeout: sending signal KILL to command` in the log
  means the 45-minute limit killed the run; 137 without that line means
  something else killed it. Either way say so, then take the task over or
  re-dispatch it as the next attempt (smaller scope, or with the previous
  attempt's log as context). Any other nonzero code is a failure; pull the
  error excerpt from the end of the log.
- The log interleaves tool activity and command output with the response.
  Every prompt asks for the final answer to start with a `RESULT_BEGIN` line
  (see below), so read from the last such line to the end:
  `awk '/^RESULT_BEGIN$/{b="";f=1;next} f{b=b $0 "\n"} END{printf "%s",b}' <log>`
- The final response holds the findings or edit list followed by the SUMMARY
  block. Relay both; never read only from `SUMMARY` down. If there is no
  `RESULT_BEGIN` line or no SUMMARY, the run ended early: treat it as a
  failure and read the end of the log for the cause.

## Composing the task prompt

The tool inherits nothing from this session, so the prompt must be
self-contained:

- State the working directory (absolute path) on the first line.
- Reference on-disk files by path (the tool reads them itself); don't paste
  contents you'd be making it re-read. Paste in full anything NOT on disk:
  plan text, review findings, decisions, diffs you were handed.
- State constraints (scope, style, what not to touch) and dictate the output
  format so the relay is mechanical: reviews as path:line + severity
  (high/medium/low) + one-line rationale + verified/suspected; edits as
  file:lines + one-line summary each; searches as path:line + role.
- Include, verbatim: "Start your final answer with a line containing only the
  word RESULT_BEGIN, and put nothing after the answer."
- End with: "SUMMARY: files changed (path: one line each), tests run + result,
  anything left undone."
- For reviews, tell it to be critical and flag problems, not reassure.

## Parallel tasks

Launch each task as its own background Bash call with its own log, end your
turn, then collect results as they exit, verify, and re-dispatch failures
with the error excerpt. Decomposition and verification stay with you, no
intermediate agents. Read-only tasks always parallelize safely; write tasks
conflict on the same checkout, so run them sequentially or isolate each in its
own worktree/repo and merge after verification.

## After the run

- Run `git status --short` before every launch, reviews included, and compare
  it after the run with `git status --short` and `git diff --stat`. For a
  read-only task any difference is a violation: report it. For write tasks,
  read full diffs only where they look suspicious, plus one smoke run if the
  project has an obvious one. Never assume the changes are correct, but don't
  re-review the whole product (that recreates the duplication this skill
  avoids).
- Relay reviews/findings essentially verbatim; don't soften or reorder
  severities. Report any files modified and which tool produced what.

## Auth and known noise

You can't fix auth non-interactively; surface it and stop.

- **OpenCode**: Azure credentials are stored in OpenCode (`opencode auth list`
  shows `Azure ... stored`). On an auth error the user runs `opencode auth`.
- **Kiro**: already authenticated, `KIRO_API_KEY` is in the session env
  (Claude is launched via `op run`). Call `kiro-cli` bare; never wrap it in
  `op run`. The "Failed to retrieve MCP settings" warning is benign noise it
  always prints, NOT an auth signal. An expired login prints an explicit
  login message; the user runs `kiro-cli login`.
- **Copilot**: authenticates via GitHub. On "Authentication failed" the user
  runs `copilot` interactively and uses `/login`, or sets a valid
  `COPILOT_GITHUB_TOKEN` / `GH_TOKEN` (needs "Copilot Requests" permission).
