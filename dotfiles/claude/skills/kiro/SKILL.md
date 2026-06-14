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

```shell
cd <working directory> && kiro-cli chat --no-interactive --model=claude-opus-4.8 --trust-all-tools 2>/dev/null <<'TASK' | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g' | sed '/^$/d'
<task prompt>
TASK
```

For review/research/analysis tasks, state "Do NOT modify any files" in the task prompt.

The output interleaves tool-activity lines ("Reading file: ...", "Completed in 0.1s") with Kiro's response.
Relay only the response, not the tool noise.

## Composing the task prompt

Kiro runs in a separate context and inherits nothing from this session, so
the prompt must be self-contained:

- State the working directory (absolute path) on the first line.
- Reference on-disk files by path — Kiro reads them itself. Do not read files
  solely to paste them into the prompt; that duplicates Kiro's work. (Content
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
- For reviews, tell Kiro to be critical and flag problems, not confirm that
  things look good.

## Parallel and large tasks

Kiro sessions that write code and run tests can produce enormous stdout
(build logs, test output). Never let that hit the conversation raw:

- Redirect every potentially long run to a log:
  `... <<'TASK' > /tmp/kiro-<task>.log 2>&1`
- Make the prompt end with: "End your reply with a section titled SUMMARY:
  files changed (path: one line each), tests run and their result, and
  anything left undone."
- After the run, read only the summary (`awk '/SUMMARY/,0' /tmp/kiro-<task>.log`
  or `tail -40`). Grep into the full log only when the summary reports a
  failure, and pull just the relevant error excerpt.

To orchestrate several Kiro tasks, launch each kiro-cli command as a
background Bash call (`run_in_background: true`), collect summaries as the
processes exit, verify each, and re-dispatch failures to Kiro with the error
excerpt. Decomposition, sequencing, and verification stay with you — do not
introduce intermediate agents.

Concurrency rule: parallel is always safe for read-only tasks (reviews,
research, searches). Write tasks conflict on the same checkout (same files,
same git index), so parallelize them only across disjoint repos/directories
or one git worktree per run (merge after verification); otherwise run write
tasks sequentially.

## After Kiro finishes

- Verify edits cheaply: `git diff --stat` first, full diffs only where the
  stat looks suspicious, plus one smoke run if the project has an obvious one.
  Never assume Kiro's changes are correct, but also never re-review the whole
  work product — that recreates the duplication this skill exists to avoid.
- Relay reviews/findings essentially verbatim (minus tool noise). Do not
  soften or reorder severities.
- Report any files Kiro modified.

## Auth and known noise

- kiro-cli is already authenticated: `KIRO_API_KEY` is in the session env
  (Claude is launched via `op run`). Call it bare; never wrap in `op run`.
- The warning "Failed to retrieve MCP settings" is benign noise that kiro-cli
  always prints. It is NOT a signal — ignore it.
