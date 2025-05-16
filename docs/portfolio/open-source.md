# Open Source Projects

Open source projects that I currently maintain and I deeply care about.

## Flux Operator MCP Server

:fontawesome-solid-user-graduate: creator & maintainer
:fontawesome-solid-calendar-days: 2025-present

The [Flux MCP Server](https://github.com/controlplaneio-fluxcd/flux-operator/tree/main/cmd/mcp)
connects AI assistants to Kubernetes clusters running Flux Operator, enabling seamless interaction
through natural language. It serves as a bridge between AI tools and GitOps pipelines,
allowing you to analyze deployment across environments, troubleshoot issues,
and perform operations using conversational prompts.

:fontawesome-brands-git-alt: [controlplaneio-fluxcd/flux-operator](https://github.com/controlplaneio-fluxcd/flux-operator)

:fontawesome-solid-code: `golang`, `kubernetes`

## Timoni

:fontawesome-solid-user-graduate: creator & maintainer
:fontawesome-solid-calendar-days: 2023-present

[Timoni](https://timoni.sh) is a package manager for Kubernetes, powered by CUE lang.

The Timoni project strives to improve the UX of authoring Kubernetes configs.
Instead of mingling Go templates with YAML like Helm, or layering YAML
on top of each-other like Kustomize, Timoni relies on cuelang's type safety,
code generation and data validation features to offer a better experience of creating,
packaging and delivering apps to Kubernetes.

:fontawesome-brands-git-alt: [github.com/stefanprodan/timoni](https://github.com/stefanprodan/timoni)

:fontawesome-solid-code: `golang`, `cuelang`, `kubernetes`

## Flagger

:fontawesome-solid-user-graduate: creator & maintainer
:fontawesome-solid-calendar-days: 2018-present

[Flagger](https://flagger.app) is a Kubernetes controller that offers advanced deployment strategies
(Canary releases, A/B testing, Blue/Green mirroring) and integrates with various
ingress controllers, service mesh, and monitoring solutions.

Flagger was initially developed in 2018 at Weaveworks by Stefan Prodan.
In 2020 Flagger became a CNCF project,
part of [Flux](#flux) family of GitOps tools.

:fontawesome-brands-git-alt: [github.com/fluxcd/flagger](https://github.com/fluxcd/flagger)

:fontawesome-solid-code: `golang`, `kubernetes`

## Flux

:fontawesome-solid-user-graduate: core maintainer
:fontawesome-solid-calendar-days: 2017-present

[Flux](https://fluxcd.io) is a popular Continuous Delivery solution for Kubernetes,
trusted and backed by organizations around the world.

Flux v2 is constructed with the [GitOps Toolkit](https://toolkit.fluxcd.io/components/)
a set of composable APIs and specialized tools for keeping Kubernetes clusters in sync
with sources of configuration (like Git, OCI & Helm repositories), and automating updates to
configuration when there is new code to deploy.

Global corporations including Orange, SAP, Volvo, RingCentral and State institutions like
[U.S. Department of Defense](https://www.cncf.io/blog/2021/09/30/how-to-get-robust-gitops-the-u-s-department-of-defense-uses-flux-and-helm/)
rely on Flux’s enterprise-level security and CD scalability.
Similarly, providers like AWS, Microsoft, GitLab, Red Hat and VMware
trust Flux to deliver GitOps to their enterprise customers.

Flux was initially developed by Weaveworks and made open source in 2016.
In 2019 Flux was donated to [Cloud Native Computing Foundation](http://cncf.io),
and in 2022 Flux become a CNCF
[graduated project](https://www.cncf.io/announcements/2022/11/30/flux-graduates-from-cncf-incubator/),
joining the ranks of Kubernetes, Prometheus, Envoy and others in this category.

:fontawesome-brands-git-alt: [github.com/fluxcd/flux2](https://github.com/fluxcd/flux2)

:fontawesome-brands-git-alt: [github.com/fluxcd/source-controller](https://github.com/fluxcd/source-controller)

:fontawesome-brands-git-alt: [github.com/fluxcd/kustomize-controller](https://github.com/fluxcd/kustomize-controller)

:fontawesome-brands-git-alt: [github.com/fluxcd/helm-controller](https://github.com/fluxcd/helm-controller)

:fontawesome-brands-git-alt: [github.com/fluxcd/notification-controller](https://github.com/fluxcd/notification-controller)

:fontawesome-brands-git-alt: [github.com/fluxcd/pkg](https://github.com/fluxcd/pkg)

:fontawesome-solid-code: `golang`, `kubernetes`

## Podinfo

:fontawesome-solid-user-graduate: creator & maintainer
:fontawesome-solid-calendar-days: 2018-present

Podinfo is a tiny web application made with Go that showcases best
practices of running microservices in Kubernetes.

Podinfo is used by CNCF projects like [Flux](#flux) and [Flagger](#flagger)
for end-to-end testing, benchmarks, how-to guides and workshops.

:fontawesome-brands-git-alt: [github.com/stefanprodan/podinfo](https://github.com/stefanprodan/podinfo)

:fontawesome-solid-code: `golang`

