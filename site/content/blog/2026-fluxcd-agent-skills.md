---
title: "Introducing the Flux CD Agent Skills"
description: >
  Reusable AI skills for generating Kubernetes manifests, auditing GitOps repositories, and debugging live clusters
date: 2026-07-02
slug: fluxcd-agent-skills
categories:
  - Flux
---

The Flux project maintainers have released the official
**GitOps Agent Skills** for Flux CD,
and this post walks through what they do and how to use them.

![Flux CD GitOps Agent Skills](/blog/assets/flux-agent-skills-banner.png)

## Why Agent Skills for GitOps

Ask a general-purpose AI assistant to write Flux manifests and the
weaknesses show quickly. It confidently emits deprecated API versions, invents spec field,
or reaches for `flux bootstrap` when your platform standardized on the Flux Operator.
The model's knowledge of the Flux APIs is whatever happened to be current when it was trained,
and it has no way to tell a remembered field from an invented one.

Agent skills solve this by packaging expert knowledge that the agent loads
on demand. A skill is a set of markdown instructions, reference documents,
schemas, and scripts that steer the agent through a task using current,
authoritative information instead of frozen training data. The Flux skills
bundle curated reference docs written by the maintainers, OpenAPI schemas
and executable scripts that ground the agent's claims in deterministic tool output.

The three skills are designed to work together, and the agent picks the
right one based on context: `gitops-knowledge` for questions and manifest
generation, `gitops-repo-audit` for validating and auditing repository
contents, and `gitops-cluster-debug` for troubleshooting live clusters.

## Getting Started

The recommended installation method is the Flux Operator CLI, which
verifies the cosign signature of the OCI artifact, confirming it was
published by the Flux team:

```shell
flux plugin install operator
```

Then, from the root of your GitOps repository:

```shell
flux operator skills install ghcr.io/fluxcd/agent-skills --agent claude-code
```

This extracts the skills to `.agents/skills` and creates per-skill
symlinks for the chosen agent. If your agent supports the conventional
`.agents/skills` path, you can omit the `--agent` flag. To update the
skills later, run `flux operator skills update`.

For Claude Code and Codex you can also install from the marketplace:

```text
/plugin marketplace add fluxcd/agent-skills
/plugin install gitops-skills@fluxcd
```

Or with Vercel's skills tool, which works across agents:

```shell
npx skills add fluxcd/agent-skills
```

### Required Tools

The skills rely on a few CLIs being available in the environment:

- [flux](https://fluxcd.io/flux/installation/#install-the-flux-cli)
- [flux-schema](https://fluxcd.io/flux/cli-plugins/flux-schema/) (install with `flux plugin install schema`)
- [flux-operator-mcp](https://fluxoperator.dev/docs/mcp/install/) (for the cluster debugging skill)
- kustomize or kubectl (for building overlays)

A [Brewfile](https://raw.githubusercontent.com/fluxcd/agent-skills/refs/heads/main/Brewfile) is provided for easy installation on macOS and Linux.

## GitOps Knowledge Skill

This skill turns the agent into a Flux CD and Flux Operator expert. It
answers questions about GitOps concepts and generates YAML for all Flux
custom resources, from HelmRelease and Kustomization to ResourceSets,
image automation, and notifications.

The skill encodes the decision trees a Flux maintainer would walk through:
which source type fits which delivery model, when to use a ResourceSet
instead of a Kustomization, how to choose between Git-based and Gitless
image automation. It also carries the canonical YAML patterns and a list
of the mistakes agents make most often, like using Go template delimiters
in ResourceSets or setting mutually exclusive HelmRelease fields.

Before generating YAML for any custom resource, the agent reads the
bundled OpenAPI schema to verify exact field names, types, and enum
values. After writing manifests, it validates them with
[Flux Schema](https://github.com/fluxcd/flux-schema) and fixes any
violations before showing you the result. The generate-validate-fix loop
means the YAML you get has already passed the same checks the Kubernetes
API server would apply.

Example prompts:

```text
What's the recommended GitOps structure for a multi-cluster fleet?
```

```text
Generate a HelmRelease for oci://ghcr.io/my-org/frontend,
and a Kustomization to deploy it in the staging cluster.
```

```text
How do I set up preview environments for pull requests with Flux Operator?
```

The skill works best inside a GitOps repository that contains an
`AGENTS.md` describing your organization's structure,
cluster topology, and secret management approach. The agent combines the
skill's reference files with the repository context to generate manifests
tailored to your setup.

## GitOps Repo Audit Skill

This skill turns the agent into a GitOps repository auditor. It works
entirely on local files (no cluster access needed) and walks through six
phases: discovery, manifest validation, API compliance, best practices
assessment, security review, and a final report with recommendations
prioritized by severity.

Each phase is grounded in deterministic tooling rather than the agent's
own reading of the files. Discovery runs `flux schema discover` to build a
structured inventory of directories, resources, and Flux objects.
Validation runs `flux schema validate` on both raw manifests and rendered
overlays. API compliance runs `flux migrate --dry-run` to pinpoint
deprecated API versions with exact file paths and line numbers. The best
practices and security phases then work from maintainer-written checklists
covering RBAC, multi-tenancy, secrets management, source authentication,
and supply chain security.

To run a full audit, ask:

```text
Audit the current repo and provide a GitOps report.
```

In Claude Code, you can also invoke the skill directly with
`/gitops-repo-audit`. Targeted prompts work too: you can validate the repo
without a full audit, or audit only the files with changes, which makes
the skill useful as a pre-push check during day-to-day work.

For larger setups, the repository includes a
[Claude Code guide](https://github.com/fluxcd/agent-skills/blob/main/docs/claude-agent-setup.md)
for orchestrating Flux sub-agents that audit multiple repositories
(fleet, infra, and apps repos) and aggregate the results into an
HTML report.

## GitOps Cluster Debug Skill

This skill turns the agent into a Flux troubleshooter for live Kubernetes
clusters. It connects through the
[Flux MCP server](https://fluxoperator.dev/mcp-server/) and follows the
same debugging playbooks the maintainers use: check the Flux installation
health, trace a failing HelmRelease or Kustomization from its source
through to the managed workloads, analyze controller and pod logs, and
walk dependency chains to find the actual root cause instead of the
symptom.

The skill ships dedicated workflows for the failures users hit most:
sources stuck on fetch failed, image automation not committing tag
updates, alerts not being delivered, and ResourceSets with failing input
providers. The result is a root cause analysis report with the dependency
chain, the evidence from status conditions and logs, and prioritized
remediation steps.

Example prompts:

```text
Check the Flux installation on my current cluster.
```

```text
Debug the failing HelmRelease podinfo in the apps namespace.
```

```text
Troubleshoot the Kustomization flux-system/infra-controllers in the staging cluster.
```

The MCP server can be configured in Claude Code with:

```bash
claude mcp add --scope user --transport stdio flux-operator-mcp \
  --env KUBECONFIG=$HOME/.kube/config \
  -- flux-operator-mcp serve --read-only
```

With the `--read-only` flag, the agent can inspect but not mutate the
cluster. The MCP server also masks Kubernetes Secrets, so the agent sees
only the data key names, never the values.

## Measuring the Impact

The skills are developed with an eval harness that runs each scenario with
and without the skill, asserting on the correctness of the generated
manifests and audit findings. The
[benchmarks](https://github.com/fluxcd/agent-skills/tree/main/benchmarks)
are published in the repository alongside the skill releases.

For the v0.1.0 release, the overall results:

| Skill             | Model           | With Skill     | Baseline     |
|-------------------|-----------------|----------------|--------------|
| gitops-knowledge  | Claude Opus 4.8 | 121/121 (100%) | 87/121 (72%) |
| gitops-knowledge  | Claude Sonnet 5 | 119/121 (98%)  | 84/121 (69%) |
| gitops-repo-audit | Claude Opus 4.8 | 73/76 (96%)    | 54/76 (71%)  |
| gitops-repo-audit | Claude Sonnet 5 | 71/76 (93%)    | 54/76 (71%)  |

The gap is widest exactly where you would expect: newer APIs like
ResourceSets and preview environments, where the Opus 4.8 baseline scores
33% and the skill brings it to 100%. Even frontier models cannot know APIs
that shipped after their training cutoff, and that is precisely what the
skills correct.

## Feedback Welcome

The agent skills are Apache 2.0 licensed and developed in the open at
[fluxcd/agent-skills](https://github.com/fluxcd/agent-skills). We are
looking for users to try them out and report back on accuracy, usefulness,
and any gaps when steering agents through GitOps tasks. If you have
suggestions for improvements or ideas for new skills, please
[open an issue](https://github.com/fluxcd/agent-skills/issues/new) on
GitHub.
