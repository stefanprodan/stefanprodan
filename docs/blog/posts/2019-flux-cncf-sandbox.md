---
date: 2019-08-20
authors: [stefanprodan]
description: >
  Weaveworks donates Flux to the Cloud Native Computing Foundation.
categories:
  - Flux
hide:
  - toc
---

# Flux project joins CNCF sandbox

Flux, the Kubernetes GitOps operator, has been accepted as a Sandbox project by the Cloud Native Computing Foundation.

<!-- more -->

Built to drive Weaveworks’ own deployment pipeline, [Flux](https://fluxcd.io) is a tool that automatically
ensures that the state of a Kubernetes cluster matches the config in Git.
It uses an operator in the cluster to trigger deployments inside Kubernetes,
which means you don't need a separate Continuous Deployment tool.
It monitors all relevant image repositories, detects new images, triggers deployments
and updates the desired running configuration based on that (and a configurable policy).

Flux led us to the concept of GitOps in which management operations can be executed
automatically by orchestrators, not manually or by scripts or CI tools.
Alexis Richardson, Weaveworks CEO, coined the term **GitOps** in 2017,
and now the expression has taken off in the Kubernetes community.

![Flux CD](assets/flux-cd-diagram.png)

Driven by GitOps enthusiasts, the Flux community expanded and
the number of integrations grew, most notable being the Helm Operator
which brings GitOps to the Helm world.
Members of Weaveworks’ Engineering and Developer Experience teams -
Michael Bridgen, Daniel Holbach, Stefan Prodan, and Hidde Beydals -
started the effort to move Flux into the CNCF which has now completed.

!!! Quote

    As a CNCF TOC member, I was happy to sponsor Flux as a Sandbox project.
    I've seen quite a bit of interest in the GitOps methodology within the
    CNCF community and was impressed by how Flux leverages the capabilities
    of Kubernetes and also plays well with other familiar tools and technologies
    in the ecosystem. I am looking forward to seeing Flux's journey through the
    next iterations in the space of cloud native application delivery.

    **Michelle Noorali, CNCF**

Read the official announcement on the
[Weavework website](https://www.weave.works/blog/flux-joins-the-cncf-sandbox).
