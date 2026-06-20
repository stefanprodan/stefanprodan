---
name: gemini
description: >
  Delegate a task to Gemini CLI (Gemini 3 Pro) by running gemini directly from
  the main conversation. Use whenever the user says /gemini, "use gemini",
  "ask gemini", or wants a Gemini second opinion, review, research pass, or fix.
  Gemini runs in its own context with tools scoped to the working directory.
---

# Gemini Delegation

Run `gemini` yourself with Bash. Do not spawn a subagent to do it: wrapper
agents tend to either duplicate Gemini's reading at full token cost or skip
gemini entirely and do the task themselves. You compose the prompt, Gemini
does the work, you verify and relay.

## Invocation

A Gemini run routinely takes 10-30 minutes, longer than the foreground Bash
limit, so always run it with `run_in_background: true` and redirect to a log.
Never run it in the foreground.

Write tasks (Gemini may edit files and run commands):

```shell
cd <working directory> && gemini -m gemini-3-pro-preview --approval-mode yolo --skip-trust -p "$(cat <<'TASK'
<task prompt>
TASK
)" 2>&1 | grep --line-buffered -vE '^\[STARTUP\]|^YOLO mode is enabled' > /tmp/gemini-<task>.log
```

Read-only tasks use `plan` mode (hard read-only, no prompt guard needed):

```shell
cd <working directory> && gemini -m gemini-3-pro-preview --approval-mode plan --skip-trust -p "$(cat <<'TASK'
<task prompt>
TASK
)" 2>&1 | grep --line-buffered -vE '^\[STARTUP\]' > /tmp/gemini-<task>.log
```

When it finishes, read the summary first (`awk '/SUMMARY/,0'
/tmp/gemini-<task>.log`); grep the full log only on a reported failure.

The run is in the background and notifies you when it finishes, so don't poll.
For a mid-run peek, run a bare `tail -n 20 /tmp/gemini-<task>.log` (no `sleep`
prefix; the harness blocks `sleep N; tail`). A growing log means it is working;
a flat one only hints it may be stuck, since Gemini buffers its own stdout. If
it goes silent, wrap the tool in `stdbuf -oL` or a PTY (`script -q /dev/null
gemini ...`).

- `-m gemini-3-pro-preview` is the default; fallback `gemini-2.5-pro`.
- `--approval-mode yolo` auto-approves all tool calls (needed non-interactively);
  `plan` is read-only; `auto_edit` approves edits only.
- `--skip-trust` trusts the workspace (no trust prompt). Gemini has no
  working-dir flag, so `cd` in first.
- `grep -v` strips startup noise (`[STARTUP] …`, `YOLO mode is enabled`);
  `--line-buffered` flushes each line to the log instead of block-buffering.

## Composing the task prompt

Gemini inherits nothing from this session, so the prompt must be self-contained:

- State the working directory (absolute path) on the first line.
- Reference on-disk files by path (Gemini reads them itself); don't paste
  contents you'd be making it re-read. Paste in full anything NOT on disk: plan
  text, review findings, decisions, diffs you were handed.
- State constraints (scope, style, what not to touch) and dictate the output
  format so the relay is mechanical: reviews as path:line + severity
  (high/medium/low) + one-line rationale + verified/suspected; edits as
  file:lines + one-line summary each; searches as path:line + role.
- End with: "SUMMARY: files changed (path: one line each), tests run + result,
  anything left undone."
- For reviews, tell it to be critical and flag problems, not reassure.

## Parallel tasks

Launch each task as its own background Bash call (each redirects to its own
`/tmp/gemini-<task>.log`), end your turn, then collect summaries as they exit,
verify, and re-dispatch failures with the error excerpt. Decomposition and
verification stay with you, no intermediate agents. Read-only tasks always
parallelize safely; write tasks conflict on the same checkout, so run them
sequentially or isolate each in its own worktree/repo and merge after
verification (Gemini has native `-w/--worktree` for this).

## After Gemini finishes

- Verify edits cheaply: `git diff --stat`, full diffs only where it looks
  suspicious, plus one smoke run if the project has an obvious one. Never assume
  the changes are correct, but don't re-review the whole product (that recreates
  the duplication this skill avoids).
- Relay reviews/findings essentially verbatim; don't soften or reorder
  severities. Report any files modified.

## Auth and known noise

- Auth is Google login or `GEMINI_API_KEY`. On an auth error the user must
  re-auth (run `gemini` interactively and sign in, or export the key); you can't
  fix it non-interactively, so surface it and stop.
- The `[STARTUP] …` lines and `YOLO mode is enabled` banner are benign noise;
  the `grep -v` drops them.
