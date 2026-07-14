---
title: "A Kubernetes Schema Catalog for AI Agents"
description: >
  JSON Schemas for the Kubernetes ecosystem, served to AI agents over MCP as a free public service
date: 2026-07-14
slug: cloud-native-schema-catalog
categories:
  - Flux
---

Introducing the [Ecosystem Schema Catalog](https://schemas.fluxoperator.dev),
a hosted collection of JSON Schemas covering the Kubernetes ecosystem of controllers,
together with a public MCP server that gives AI agents direct access to it. This post
covers why agents need such a thing and how to wire it into yours.

![Kubernetes Ecosystem Schema Catalog](/blog/assets/schema-catalog-banner.png)

## The Training Data Problem

Anyone who has asked an AI assistant to generate Kubernetes manifests knows the
failure mode: the YAML looks plausible, the field names are almost right, and
the error only surfaces when the manifest hits the cluster. The model's
knowledge of an API is whatever happened to be current when it was trained,
while CRDs ship new versions every few weeks. Worse, the model has no way to
tell a field it remembers from a field it invented, and it will defend both
with equal confidence.

Agents thrive when they can verify their own work. For code, that feedback
loop is the compiler and the test suite. For Kubernetes manifests, the only
authoritative source of truth is the API server, so agents either dry-run
against a live cluster, which requires credentials and carries risk, or they
fall back to web search, which is slow, expensive in tokens, and routinely
lands on documentation for the wrong version.

The missing piece is a way for an agent to look up the real schema of any
resource, current as of the latest upstream release, without a cluster and
without crawling the web. That is what the catalog provides.

## The Ecosystem Schema Catalog

The catalog is built by extracting JSON Schemas from upstream stable releases
and rebuilding daily. At launch, it covers 110 projects and close to 9000
schemas: the Kubernetes and OpenShift built-in kinds, all the CNCF projects
that ship CRDs, and the cloud provider operators for AWS, Azure, and GCP.

Everything is served from Cloudflare's global network, where you can also
search and [browse every project](https://schemas.fluxoperator.dev/catalog/) and schema.
Alongside the raw schemas, the catalog publishes LLM-optimized indexes,
so an agent can locate the right group, version, and kind in a couple of
small requests instead of pulling down the whole collection.

Because clusters rarely run the latest release of anything, the catalog keeps
versioned snapshots for the six most recent minor releases of Kubernetes,
OpenShift, and Flux. An agent working on a repository that targets Kubernetes
v1.35 can resolve schemas exactly as that minor defines them.

## An MCP Server as a Public Good

The catalog is exposed as a remote MCP server, operated by the Flux Operator
team as a free public service, with no authentication or API key required:

```text
https://schemas.fluxoperator.dev/mcp
```

Think of it as an LLM-friendly `kubectl explain` for the whole Kubernetes
ecosystem, with no cluster attached. The agent can search for projects, list
the kinds they define, and fetch field definitions down to individual JSON
paths, always against the current upstream APIs rather than the versions
frozen into its training data.

Connecting an agent takes one command. For Claude Code:

```shell
claude mcp add --transport http flux-schema-catalog https://schemas.fluxoperator.dev/mcp
```

For Codex:

```shell
codex mcp add flux-schema-catalog --url https://schemas.fluxoperator.dev/mcp
```

And for other MCP clients such as Cursor, VS Code, or Windsurf, add the
server to the project's `.mcp.json`:

```json
{
  "mcpServers": {
    "flux-schema-catalog": {
      "type": "http",
      "url": "https://schemas.fluxoperator.dev/mcp"
    }
  }
}
```

## Measuring the Impact

To see whether the catalog actually changes agent behavior, I gave the same
agent four tasks against recently shipped CRDs: two field lookups, one
manifest to write from scratch, and one manifest review with planted errors.

From training data alone, the agent got one task of four right. It invented
enum values and flagged valid fields as errors. With the MCP server connected
it scored four of four, using **57% fewer tokens** and **80% fewer tool calls** than
reaching the same score with web search. Smaller models depend on the catalog
even more: Haiku scored zero of four from memory and four of four with the
MCP server, at a quarter of the web search cost.

The full benchmark details and per-client setup instructions are in the
[AI agents guide](https://schemas.fluxoperator.dev/agents).

## Closing the Loop with Validation

Schema lookup helps an agent write the manifest correctly the first time.
To verify the result, the catalog also backs
[Flux Schema](https://github.com/fluxcd/flux-schema), a CLI plugin that
validates manifests using the same evaluation semantics as the Kubernetes
API server, including the CEL rules embedded in CRDs:

```shell
flux plugin install schema

flux schema validate ./manifests -s ecosystem -o json
```

The structured output gives the agent each violation with its JSON path, so
the generate-validate-fix loop runs entirely locally: no cluster, no
credentials, no waiting for a failed reconciliation to find out a field name
was wrong.

To validate with older versions of Kubernetes, we can use the `-s`
flag multiple times:

```shell
flux schema validate ./manifests \
  -s https://schemas.fluxoperator.dev/catalog/versions/kubernetes/v1.36 \
  -s https://schemas.fluxoperator.dev/catalog/versions/flux/v2.8 \
  -s ecosystem
```

For running the same validation in CI, the catalog can be used in
[GitHub Actions](https://schemas.fluxoperator.dev/cli/#ci).

## Growing the Catalog

The catalog grows with the community: if a project you rely on is missing
from [schemas.fluxoperator.dev](https://schemas.fluxoperator.dev), request it
by opening an
[issue](https://github.com/controlplaneio-fluxcd/schema-catalog/issues/new?template=add-project.yaml),
and the daily rebuilds will pick it up once added.
