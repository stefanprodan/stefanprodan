---
name: kiro
description: >
  Delegate a task to Kiro AI (GPT-5.6 Sol, high reasoning) by running kiro-cli directly from the
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
cd <working directory> && kiro-cli chat --no-interactive --model=gpt-5.6-sol --effort high --trust-all-tools 2>&1 <<'TASK' | sed -u 's/\x1b\[[0-9;?]*[a-zA-Z]//g' | sed -u '/^$/d' > /tmp/kiro-<task>.log
<task prompt>
TASK
```

When it finishes, read the summary first (`awk '/SUMMARY/,0'
/tmp/kiro-<task>.log`); grep the full log only when the summary reports a
failure, pulling just the error excerpt.

The run is in the background and notifies you when it finishes, so don't poll.
For a mid-run peek, run a bare `tail -n 20 /tmp/kiro-<task>.log` (no `sleep`
prefix; the harness blocks `sleep N; tail`). If the log stays empty from the
start, Kiro is buffering its stdout: wrap the tool in `stdbuf -oL` or a PTY
(`script -q /dev/null kiro-cli ...`).

- For review/research/analysis, state "Do NOT modify any files" in the prompt.
- The output interleaves tool-activity lines ("Reading file: ...", "Completed
  in 0.1s") with Kiro's response; `sed` strips ANSI codes (the log still holds
  both, so relay only the response), and `-u` runs it unbuffered so each line
  flushes to the log instead of block-buffering.

## Liveness watch

A finished run notifies you; a hung one never does, and a hung Kiro looks
exactly like a working one. A stalled run once cost an hour while it was
being reported as working. So right after every launch, arm a Monitor on the
log that fires when the log has been flat for 8 minutes or kiro-cli is gone:

```shell
L=/tmp/kiro-<task>.log; while true; do
  if ! pgrep -f kiro-cli >/dev/null; then echo "kiro-cli exited; log $(wc -l <"$L") lines"; exit 0; fi
  age=$(( $(date +%s) - $(stat -f %m "$L") ))
  if [ "$age" -ge 480 ]; then echo "STALL: log flat for ${age}s"; exit 0; fi
  sleep 20
done
```

- Pass it to the Monitor tool with `timeout_ms: 1800000` (the maximum). When
  the monitor expires and the run is still going, re-arm it.
- Judge liveness by the log's mtime against `date`, never by its tail: the
  last lines of a stalled log read like work in progress.
- With parallel runs, arm one monitor per log. `pgrep -f kiro-cli` sees any
  of them, so the exit line is only reliable for the last run standing; the
  stall check is per log and always holds.
- On STALL: `pkill -9 -f kiro-cli` (a plain kill leaves a child that keeps
  editing files; with parallel runs it ends all of them), say so, then take
  the task over or re-dispatch it. Do not wait for it to recover.

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
