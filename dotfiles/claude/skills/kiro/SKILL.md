---
name: kiro
description: >
  Delegate a task to Kiro AI (Opus LLM) by running kiro-cli directly from the
  main conversation. Use whenever the user says /kiro, "use kiro", "ask kiro",
  or wants a Kiro second opinion, review, research pass, or fix. Kiro runs in
  its own context with tools scoped to the working directory.
---

# Kiro Delegation

Run kiro-cli yourself with Bash. Do not spawn a subagent to do it: wrapper
agents have repeatedly either duplicated Kiro's reading at full token cost or
skipped kiro-cli entirely and done the task themselves. You compose the
prompt, Kiro does the work, you verify and relay.

## Invocation

A Kiro run routinely takes 10-30 minutes, longer than the foreground Bash
limit, so always run it with `run_in_background: true` and redirect to a log.
Never run it in the foreground.

```shell
cd <working directory> && kiro-cli chat --no-interactive --model=claude-opus-4.8 --trust-all-tools 2>&1 <<'TASK' | sed -u 's/\x1b\[[0-9;?]*[a-zA-Z]//g' | sed -u '/^$/d' > /tmp/kiro-<task>.log
<task prompt>
TASK
```

When it finishes, read the summary first (`awk '/SUMMARY/,0'
/tmp/kiro-<task>.log`); grep the full log only when the summary reports a
failure, pulling just the error excerpt.

The run is in the background and notifies you when it finishes, so don't poll.
For a mid-run peek, run a bare `tail -n 20 /tmp/kiro-<task>.log` (no `sleep`
prefix; the harness blocks `sleep N; tail`). A growing log means it is working;
a flat one only hints it may be stuck, since Kiro buffers its own stdout. If it
goes silent, wrap the tool in `stdbuf -oL` or a PTY (`script -q /dev/null
kiro-cli ...`).

- For review/research/analysis, state "Do NOT modify any files" in the prompt.
- The output interleaves tool-activity lines ("Reading file: ...", "Completed
  in 0.1s") with Kiro's response; `sed` strips ANSI codes (the log still holds
  both, so relay only the response), and `-u` runs it unbuffered so each line
  flushes to the log instead of block-buffering.

## Composing the task prompt

Kiro inherits nothing from this session, so the prompt must be self-contained:

- State the working directory (absolute path) on the first line.
- Reference on-disk files by path (Kiro reads them itself); don't paste contents
  you'd be making it re-read. Paste in full anything NOT on disk: plan text,
  review findings, decisions, diffs you were handed.
- State constraints (scope, style, what not to touch) and dictate the output
  format so the relay is mechanical: reviews as path:line + severity
  (high/medium/low) + one-line rationale + verified/suspected; edits as
  file:lines + one-line summary each; searches as path:line + role.
- End with: "SUMMARY: files changed (path: one line each), tests run + result,
  anything left undone."
- For reviews, tell it to be critical and flag problems, not reassure.

## Parallel tasks

Launch each task as its own background Bash call (each redirects to its own
`/tmp/kiro-<task>.log`), end your turn, then collect summaries as they exit,
verify, and re-dispatch failures with the error excerpt. Decomposition and
verification stay with you, no intermediate agents. Read-only tasks always
parallelize safely; write tasks conflict on the same checkout, so run them
sequentially or isolate each in its own worktree/repo and merge after
verification.

## After Kiro finishes

- Verify edits cheaply: `git diff --stat`, full diffs only where it looks
  suspicious, plus one smoke run if the project has an obvious one. Never assume
  the changes are correct, but don't re-review the whole product (that recreates
  the duplication this skill avoids).
- Relay reviews/findings essentially verbatim; don't soften or reorder
  severities. Report any files modified.

## Auth and known noise

- kiro-cli is already authenticated: `KIRO_API_KEY` is in the session env
  (Claude is launched via `op run`). Call it bare; never wrap in `op run`.
- The "Failed to retrieve MCP settings" warning is benign noise kiro-cli always
  prints to stderr; `2>&1` lands it in the log (so real errors reach the log
  too). It is NOT a signal, ignore it when relaying.
