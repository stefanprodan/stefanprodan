---
layout: ../../layouts/ProseLayout.astro
title: Open Source Projects
description: Open source projects that Stefan Prodan maintains.
---

Open source projects that I currently maintain and I deeply care about.

## Flux Operator Web UI

<span class="meta">creator &amp; maintainer · 2026-present</span>

The [Flux Web UI](https://fluxoperator.dev/web-ui/)
is a lightweight, mobile-friendly web interface providing real-time visibility into the Flux-managed GitOps pipelines.
Designed for DevOps engineers and platform teams, the Flux Web UI offers direct insight
and advanced management capabilities for the application delivery process on Kubernetes clusters.

Repository: [controlplaneio-fluxcd/flux-operator](https://github.com/controlplaneio-fluxcd/flux-operator)

Stack: `javascript`, `golang`, `kubernetes`

## Flux Operator MCP Server

<span class="meta">creator &amp; maintainer · 2025-present</span>

The [Flux MCP Server](https://fluxoperator.dev/mcp-server/)
connects AI assistants to Kubernetes clusters running Flux Operator, enabling seamless interaction
through natural language. It serves as a bridge between AI tools and GitOps pipelines,
allowing you to analyze deployment across environments, troubleshoot issues,
and perform operations using conversational prompts.

Repository: [controlplaneio-fluxcd/flux-operator](https://github.com/controlplaneio-fluxcd/flux-operator)

Stack: `golang`, `kubernetes`

## Flux Operator

<span class="meta">creator &amp; maintainer · 2024-present</span>

The [Flux Operator](https://fluxoperator.dev) simplifies
the installation, configuration, and management of CNCF Flux and its components.
The operator extends Flux with high-level APIs for app delivery with
self-service capabilities, deployment windows,
and preview environments for pull requests testing.

Repository: [controlplaneio-fluxcd/flux-operator](https://github.com/controlplaneio-fluxcd/flux-operator)

Stack: `golang`, `kubernetes`

## Timoni

<span class="meta">creator &amp; maintainer · 2023-present</span>

[Timoni](https://timoni.sh) is a package manager for Kubernetes, powered by CUE lang.

The Timoni project strives to improve the UX of authoring Kubernetes configs.
Instead of mingling Go templates with YAML like Helm, or layering YAML
on top of each-other like Kustomize, Timoni relies on cuelang's type safety,
code generation and data validation features to offer a better experience of creating,
packaging and delivering apps to Kubernetes.

Repository: [github.com/stefanprodan/timoni](https://github.com/stefanprodan/timoni)

Stack: `golang`, `cuelang`, `kubernetes`

## Flagger

<span class="meta">creator &amp; maintainer · 2018-present</span>

[Flagger](https://flagger.app) is a Kubernetes controller that offers advanced deployment strategies
(Canary releases, A/B testing, Blue/Green mirroring) and integrates with various
ingress controllers, service mesh, and monitoring solutions.

Flagger was initially developed in 2018 at Weaveworks by Stefan Prodan.
In 2020 Flagger became a CNCF project,
part of [Flux](#flux) family of GitOps tools.

Repository: [github.com/fluxcd/flagger](https://github.com/fluxcd/flagger)

Stack: `golang`, `kubernetes`

## Flux

<span class="meta">core maintainer · 2017-present</span>

[Flux](https://fluxcd.io) is a popular Continuous Delivery solution for Kubernetes,
trusted and backed by organizations around the world.

Flux v2 is constructed with the [GitOps Toolkit](https://toolkit.fluxcd.io/components/)
a set of composable APIs and specialized tools for keeping Kubernetes clusters in sync
with sources of configuration (like Git, OCI & Helm repositories), and automating updates to
configuration when there is new code to deploy.

Global corporations including Orange, SAP, Volvo, RingCentral and State institutions like
[U.S. Department of Defense](https://www.cncf.io/blog/2021/09/30/how-to-get-robust-gitops-the-u-s-department-of-defense-uses-flux-and-helm/)
rely on Flux's enterprise-level security and CD scalability.
Similarly, providers like AWS, Microsoft, GitLab, Red Hat and VMware
trust Flux to deliver GitOps to their enterprise customers.

Flux was initially developed by Weaveworks and made open source in 2016.
In 2019 Flux was donated to [Cloud Native Computing Foundation](http://cncf.io),
and in 2022 Flux become a CNCF
[graduated project](https://www.cncf.io/announcements/2022/11/30/flux-graduates-from-cncf-incubator/),
joining the ranks of Kubernetes, Prometheus, Envoy and others in this category.

Repositories:

- [github.com/fluxcd/flux2](https://github.com/fluxcd/flux2)
- [github.com/fluxcd/source-controller](https://github.com/fluxcd/source-controller)
- [github.com/fluxcd/source-watcher](https://github.com/fluxcd/source-watcher)
- [github.com/fluxcd/kustomize-controller](https://github.com/fluxcd/kustomize-controller)
- [github.com/fluxcd/helm-controller](https://github.com/fluxcd/helm-controller)
- [github.com/fluxcd/notification-controller](https://github.com/fluxcd/notification-controller)
- [github.com/fluxcd/pkg](https://github.com/fluxcd/pkg)

Stack: `golang`, `kubernetes`

## Podinfo

<span class="meta">creator &amp; maintainer · 2018-present</span>

Podinfo is a tiny web application made with Go that showcases best
practices of running microservices in Kubernetes.

Podinfo is used by CNCF projects like [Flux](#flux) and [Flagger](#flagger)
for end-to-end testing, benchmarks, how-to guides and workshops.

Repository: [github.com/stefanprodan/podinfo](https://github.com/stefanprodan/podinfo)

Stack: `golang`
