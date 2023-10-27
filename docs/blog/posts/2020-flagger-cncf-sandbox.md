---
date: 2020-12-22
authors: [stefanprodan]
description: >
  Weaveworks donates Flagger to the CNCF as Flux sub-project.
categories:
  - Flagger
hide:
  - toc
---

# Flagger joins CNCF and the Flux project

I am very happy to announce that Flagger, the Progressive Delivery Operator for Kubernetes,
has joined CNCF as a Flux subproject.

Flagger source code repository is now available at [fluxcd/flagger](https://github.com/fluxcd/flagger).

<!-- more -->

[Flagger](https://flagger.app) was specifically designed for **GitOps** style delivery.
Flagger extends Flux functionality with progressive delivery strategies like Canary Releases,
A/B Testing and Blue/Green.

![Flagger](assets/flagger-flux-gitops.png)

Since the introduction of the GitOps Toolkit, the Flux project has become
a family of GitOps related projects. The Flagger maintainers are looking forward
to making use of the toolkit components and simplifying Flagger this way.
Consolidating the code-bases and thinking in terms of a “Flux Family of Projects”
and writing up the roadmap accordingly should benefit both communities as a whole.

Timeline:

- Approval of Flagger & Flux maintainers to join the Flux project (Nov 2020)
- Approval from Weaveworks to transfer Flagger and its copyright to CNCF (Nov 2020)
- Flagger v1.5.0 released under [fluxcd/flagger](https://github.com/fluxcd/flagger) (Dec 2020)
