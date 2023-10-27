---
date: 2023-07-05
authors: [stefanprodan]
description: >
  Announcing the first General Availability release of Flux v2 and its GitOps APIs.
categories:
  - Flux
hide:
  - toc
---

# Flux v2 - GitOps General Availability Release

I am thrilled to announce the **v2.0.0** General Availability (GA) release of Flux and its GitOps components.

:fontawesome-solid-heart: Big thanks to all the Flux contributors that helped us reach this milestone,
and a special shoutout to the Flux community who supported us over the years!

<!-- more -->

![Flux stats](assets/flux-ga-stats.png)

It has been a fantastic journey of rebuilding the original Flux into a microservices architecture,
adding Flagger as a subproject, getting validated as a graduated project in the
[Cloud Native Computing Foundation](https://cncf.io), and now reaching GA with Flux 2.0.

In April 2020, we've decided to redesign Flux from the ground up using modern technologies 
such as Kubernetes controller runtime and Custom Resource Definitions.
The decision was made to break Flux functionally into specialised components
and APIs with a focus on extensibility, observability and security.
After three years of intense development and hundreds of pre-releases,
we are marking the GitOps features of Flux as stable and production ready.

Components promoted to GA:

- **GitRepository** API of [source-controller](https://github.com/fluxcd/source-controller)
- **Kustomization** API of [kustomize-controller](https://github.com/fluxcd/kustomize-controller)
- **Receiver** API of [notification-controller](https://github.com/fluxcd/notification-controller)
- **Bootstrap Git** commands of [Flux CLI](https://github.com/fluxcd/flux2)

For more information about Flux GA, please see the following articles:

- [Flux Announces GA of v2 - cncf.io](https://www.cncf.io/blog/2023/07/20/flux-announces-ga-of-v2/)
- [Announcing Flux 2.0 GA - fluxcd.io](https://fluxcd.io/blog/2023/07/flux-ga/)
- [What Flux CD GA Means For You & Your Organization - weave.works](https://www.weave.works/blog/flux-cd-ga)


