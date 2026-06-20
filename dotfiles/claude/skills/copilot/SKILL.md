---
name: copilot
description: >
  Delegate a task to GitHub Copilot CLI (GPT-5.5, high reasoning) by running
  copilot directly from the main conversation. Use whenever the user says
  /copilot, "use copilot", "ask copilot", or wants a Copilot second opinion,
  review, research pass, or fix. Copilot runs in its own context with tools
  scoped to the working directory.
---

# Copilot Delegation

Run `copilot` yourself with Bash. Do not spawn a subagent to do it: wrapper
agents tend to either duplicate Copilot's reading at full token cost or skip
copilot entirely and do the task themselves. You compose the prompt, Copilot
does the work, you verify and relay.

## Invocation

A Copilot run routinely takes 10-30 minutes, longer than the foreground Bash
limit, so always run it with `run_in_background: true` and redirect to a log.
Never run it in the foreground.

```shell
copilot -C <working directory> --model gpt-5.5 --effort high --allow-all --no-color --log-level none -p "$(cat <<'TASK'
<task prompt>
TASK
)" 2>&1 | sed -u -E '/^(Changes|AI Credits|Tokens)[[:space:]]/d' | sed -u '/^$/d' > /tmp/copilot-<task>.log
```

When it finishes, read the summary first (`awk '/SUMMARY/,0'
/tmp/copilot-<task>.log`); grep the full log only when the summary reports a
failure, pulling just the error excerpt.

The run is in the background and notifies you when it finishes, so don't poll.
For a mid-run peek, run a bare `tail -n 20 /tmp/copilot-<task>.log` (no `sleep`
prefix; the harness blocks `sleep N; tail`). A growing log means it is working;
a flat one only hints it may be stuck, since Copilot buffers its own stdout. If
it goes silent, wrap the tool in `stdbuf -oL` or a PTY (`script -q /dev/null
copilot ...`).

- `--model gpt-5.5 --effort high` is the default.
- `--allow-all` is REQUIRED for non-interactive (`-p`) mode; without it Copilot
  refuses to run tools (it enables all tools, paths, and URLs).
- For review/research/analysis, state "Do NOT modify any files" in the prompt
  (Copilot can edit files, so this is the read-only guard).
- `sed` strips the footer block (`Changes …`, `AI Credits …`, `Tokens …`); `-u`
  runs it unbuffered so each line flushes to the log instead of block-buffering.

## Composing the task prompt

Copilot inherits nothing from this session, so the prompt must be
self-contained:

- The working directory is set with `-C`; restating it in the prompt is fine but
  not required.
- Reference on-disk files by path (Copilot reads them itself); don't paste
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
`/tmp/copilot-<task>.log`), end your turn, then collect summaries as they exit,
verify, and re-dispatch failures with the error excerpt. Decomposition and
verification stay with you, no intermediate agents. Read-only tasks always
parallelize safely; write tasks conflict on the same checkout, so run them
sequentially or isolate each in its own worktree/repo and merge after
verification.

## After Copilot finishes

- Verify edits cheaply: `git diff --stat`, full diffs only where it looks
  suspicious, plus one smoke run if the project has an obvious one. Never assume
  the changes are correct, but don't re-review the whole product (that recreates
  the duplication this skill avoids).
- Relay reviews/findings essentially verbatim; don't soften or reorder
  severities. Report any files modified.

## Auth and known noise

- Copilot authenticates via GitHub. On "Authentication failed" the user must
  re-auth: run `copilot` interactively and use `/login`, or set a valid
  `COPILOT_GITHUB_TOKEN` / `GH_TOKEN` (needs "Copilot Requests" permission). You
  can't fix auth non-interactively, so surface it and stop.
- The footer (`Changes`, `AI Credits`, `Tokens`) is benign accounting output;
  the `sed` filter drops it.
