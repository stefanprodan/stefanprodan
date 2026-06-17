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
limit. So there is one way to run it: always `run_in_background: true`, always
redirect to a log. Never run it in the foreground.

```shell
copilot -C <working directory> --model gpt-5.5 --effort high --allow-all --no-color --log-level none -p "$(cat <<'TASK'
<task prompt>
TASK
)" 2>&1 | sed -E '/^(Changes|AI Credits|Tokens)[[:space:]]/d' | sed '/^$/d' > /tmp/copilot-<task>.log
```

When it finishes, read first the summary (`awk '/SUMMARY/,0'
/tmp/copilot-<task>.log`); grep the full log only when the summary reports a
failure, pulling just the error excerpt.

- `--model gpt-5.5 --effort high` is the default for this skill.
- `--allow-all` is REQUIRED for non-interactive (`-p`) mode; without it Copilot
  refuses to run tools. It enables all tools, paths, and URLs (equivalent to
  `--allow-all-tools --allow-all-paths --allow-all-urls`).
- For review/research/analysis tasks, state "Do NOT modify any files" in the
  task prompt (Copilot can edit files, so this is the read-only guard).
- The `sed` filter strips the footer block (`Changes …`, `AI Credits …`,
  `Tokens …`); the log holds only Copilot's response.

## Composing the task prompt

Copilot runs in a separate context and inherits nothing from this session, so
the prompt must be self-contained:

- The working directory is set with `-C`; you don't need to restate it, but
  naming it in the prompt does no harm.
- Reference on-disk files by path, Copilot reads them itself. Do not read files
  solely to paste them into the prompt; that duplicates Copilot's work. (Content
  you already have in context is fine to summarize for framing.)
- Paste in full anything that is NOT on disk: plan text, review findings,
  conversation decisions, diffs you were handed.
- State constraints: scope limits, style ("minimal surgical edits matching the
  file's existing style"), things not to touch.
- Dictate the output format so the relay is mechanical. Reviews: path:line,
  severity (high/medium/low), one-paragraph rationale, and whether the finding
  was verified or suspected. Edits: list every modified file with line numbers
  and a one-line summary per change. Searches: path:line plus a one-line role
  description.
- End the prompt with: "End your reply with a section titled SUMMARY: files
  changed (path: one line each), tests run and their result, and anything left
  undone."
- For reviews, tell Copilot to be critical and flag problems, not confirm that
  things look good.

## Parallel tasks

To orchestrate several Copilot tasks, launch each as its own background Bash
call (each already redirects to its own `/tmp/copilot-<task>.log`), end your
turn, then collect summaries as the processes exit, verify each, and re-dispatch
failures with the error excerpt. Decomposition, sequencing, and verification
stay with you, do not introduce intermediate agents.

Concurrency rule: parallel is always safe for read-only tasks (reviews,
research, searches). Write tasks conflict on the same checkout (same files, same
git index), so parallelize them only across disjoint repos/directories or one
git worktree per run (merge after verification); otherwise run write tasks
sequentially.

## After Copilot finishes

- Verify edits cheaply: `git diff --stat` first, full diffs only where the stat
  looks suspicious, plus one smoke run if the project has an obvious one. Never
  assume Copilot's changes are correct, but also never re-review the whole work
  product, that recreates the duplication this skill exists to avoid.
- Relay reviews/findings essentially verbatim (minus the footer). Do not soften
  or reorder severities.
- Report any files Copilot modified.

## Auth and known noise

- Copilot authenticates via GitHub. If a run prints "Authentication failed", the
  user must re-auth: run `copilot` interactively and use `/login`, or set a
  valid `COPILOT_GITHUB_TOKEN` / `GH_TOKEN` (needs the "Copilot Requests"
  permission). You cannot fix auth non-interactively, surface it and stop.
- The footer (`Changes`, `AI Credits`, `Tokens`) is benign accounting output,
  not part of the response. The `sed` filter in the invocation drops it.
