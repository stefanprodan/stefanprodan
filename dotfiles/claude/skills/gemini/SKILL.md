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

Write tasks (Gemini may edit files and run commands):

```shell
cd <working directory> && gemini -m gemini-3-pro-preview --approval-mode yolo --skip-trust -p "$(cat <<'TASK'
<task prompt>
TASK
)" 2>&1 | grep -vE '^\[STARTUP\]|^YOLO mode is enabled'
```

Read-only tasks (reviews, research, searches) — use `plan` mode for a HARD
read-only guarantee, no prompt-instruction guard needed:

```shell
cd <working directory> && gemini -m gemini-3-pro-preview --approval-mode plan --skip-trust -p "$(cat <<'TASK'
<task prompt>
TASK
)" 2>&1 | grep -vE '^\[STARTUP\]'
```

- `-m gemini-3-pro-preview` is the default for this skill. Fallback if it's
  unavailable: `gemini-2.5-pro`.
- `--approval-mode yolo` auto-approves all tool calls (required to let Gemini
  act non-interactively); `--approval-mode plan` is read-only. `auto_edit`
  (auto-approve edits only) is the middle ground.
- `--skip-trust` trusts the workspace for the session so it doesn't block on a
  trust prompt. Gemini has no working-dir flag — `cd` into the directory first.
- The `grep -v` strips Gemini's startup noise (`[STARTUP] …` lines, and the
  `YOLO mode is enabled` banner in yolo mode). Relay only Gemini's response.

## Composing the task prompt

Gemini runs in a separate context and inherits nothing from this session, so
the prompt must be self-contained:

- State the working directory (absolute path) on the first line.
- Reference on-disk files by path — Gemini reads them itself. Do not read files
  solely to paste them into the prompt; that duplicates Gemini's work. (Content
  you already have in context is fine to summarize for framing.)
- Paste in full anything that is NOT on disk: plan text, review findings,
  conversation decisions, diffs you were handed.
- State constraints: scope limits, style ("minimal surgical edits matching
  the file's existing style"), things not to touch.
- Dictate the output format so the relay is mechanical. Reviews: path:line,
  severity (high/medium/low), one-paragraph rationale, and whether the
  finding was verified or suspected. Edits: list every modified file with
  line numbers and a one-line summary per change. Searches: path:line plus a
  one-line role description.
- For reviews, tell Gemini to be critical and flag problems, not confirm that
  things look good.

## Parallel and large tasks

Gemini sessions that write code and run tests can produce enormous stdout
(build logs, test output). Never let that hit the conversation raw:

- Redirect every potentially long run to a log:
  `... -p "$(cat <<'TASK' ... TASK)" > /tmp/gemini-<task>.log 2>&1`
- Make the prompt end with: "End your reply with a section titled SUMMARY:
  files changed (path: one line each), tests run and their result, and
  anything left undone."
- After the run, read only the summary
  (`awk '/SUMMARY/,0' /tmp/gemini-<task>.log` or `tail -40`). Grep into the
  full log only when the summary reports a failure, and pull just the relevant
  error excerpt.

To orchestrate several Gemini tasks, launch each `gemini` command as a
background Bash call (`run_in_background: true`), collect summaries as the
processes exit, verify each, and re-dispatch failures to Gemini with the error
excerpt. Decomposition, sequencing, and verification stay with you — do not
introduce intermediate agents. (Gemini also has native `-w/--worktree` to run
in a fresh git worktree, useful for parallel write tasks on one repo.)

Concurrency rule: parallel is always safe for read-only tasks (reviews,
research, searches). Write tasks conflict on the same checkout (same files,
same git index), so parallelize them only across disjoint repos/directories
or one git worktree per run (merge after verification); otherwise run write
tasks sequentially.

## After Gemini finishes

- Verify edits cheaply: `git diff --stat` first, full diffs only where the
  stat looks suspicious, plus one smoke run if the project has an obvious one.
  Never assume Gemini's changes are correct, but also never re-review the whole
  work product — that recreates the duplication this skill exists to avoid.
- Relay reviews/findings essentially verbatim (minus the startup noise). Do not
  soften or reorder severities.
- Report any files Gemini modified.

## Auth and known noise

- Gemini CLI authenticates via Google login or a `GEMINI_API_KEY`. If a run
  fails with an auth error, the user must re-auth (run `gemini` interactively
  and sign in, or export `GEMINI_API_KEY`). You cannot fix auth
  non-interactively — surface it and stop.
- The `[STARTUP] Phase 'cleanup_ops' …` lines and the `YOLO mode is enabled`
  banner are benign noise Gemini always prints. They are NOT signals — the
  `grep -v` in the invocation drops them.
