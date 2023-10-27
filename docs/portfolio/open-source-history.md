# Past Contributions to Open Source Projects

Open source projects that I helped maintain and contributed to with passion.

## Kustomizer

:fontawesome-solid-user-graduate: creator & maintainer
:fontawesome-solid-calendar-days: 2020-2022

Kustomizer is an experimental package manager for distributing Kubernetes configuration
as OCI artifacts. It offers commands to publish, fetch, diff, customize, validate,
apply and prune Kubernetes resources.

This project served as a testing bench for features that made their way into Flux.
Kustomizer is the project where features like staged-apply, garbage collection
and diffing were first introduced.

The server-side apply engine used by Flux
[kustomize-controller](https://github.com/fluxcd/kustomize-controller), and
the OCI artifacts management in [Flux](open-source.md#flux)
and [Timoni](open-source.md#timoni) are all derived from experiments in Kustomizer.

:fontawesome-brands-git-alt: [github.com/stefanprodan/kustomizer](https://github.com/stefanprodan/kustomizer)

:fontawesome-solid-code: `golang`, `kubernetes`

## Helm Operator (Flux v1)

:fontawesome-solid-user-graduate: maintainer
:fontawesome-solid-calendar-days: 2018-2022

The Helm Operator was initially developed by Weaveworks, as an extension to Flux v1.
It was the first project in CNCF that made possible to declaratively manage
Helm releases using Kubernetes CRDs.

In 2019, we showcased the Flux Helm Operator at Helm Summit in Amsterdam,
after that, the project took off. The GitOps practices gained
traction in the Helm community and brought a new wave of users to Flux.

In 2020, the Flux team started migrating the Helm Operator users to Flux v2,
and in 2022 the project was archived in favor of Flux v2 and its
[helm-controller](https://github.com/fluxcd/helm-controller).

:fontawesome-brands-git-alt: [github.com/fluxcd/helm-operator](https://github.com/fluxcd/helm-operator)

:fontawesome-solid-code: `golang`, `helm`, `kubernetes`

## Service Mesh Interface

:fontawesome-solid-user-graduate: maintainer
:fontawesome-solid-calendar-days: 2019-2021

SMI was created to provide a standard interface for service meshes on Kubernetes
and a basic feature set for the most common service mesh use cases.
It was accepted as a [CNCF](https://cncf.io) Sandbox project in March 2020.

I've joined the project early on and, I've implemented the SMI APIs in
[Flagger](open-source.md#flagger). Which made Flagger compatible
with the Linkerd service mesh. Later on, both Flagger and Linkerd adopted 
Kubernetes Gateway API.

In 2023, SMI was archived in favor of the Gateway API
[GAMMA Initiative](https://kubernetes.io/blog/2023/08/29/gateway-api-v0-8/).

:fontawesome-brands-git-alt: [github.com/servicemeshinterface/smi-spec](https://github.com/servicemeshinterface/smi-spec)

:fontawesome-brands-git-alt: [github.com/servicemeshinterface/smi-sdk-go](https://github.com/servicemeshinterface/smi-sdk-go)

:fontawesome-solid-code: `golang`, `kubernetes`

## MGOB

:fontawesome-solid-user-graduate: creator & maintainer
:fontawesome-solid-calendar-days: 2017-2020

MongoDB dockerized backup agent that runs backups on a schedule with
retention policies, S3 & SFTP upload, notifications and Prometheus instrumentation.

While working full-time on Flux, I lost interest in MongoDB and archived the project.
Thanks to Sam Lin, the project lives on and has a new home at
[github.com/maxisam/mgob](https://github.com/maxisam/mgob).

:fontawesome-brands-git-alt: [github.com/stefanprodan/mgob](https://github.com/stefanprodan/mgob)

:fontawesome-solid-code: `golang`

## Syros

:fontawesome-solid-user-graduate: creator & maintainer
:fontawesome-solid-calendar-days: 2017-2018

DevOps tool built on top of VMware Vsphere, Docker, NATS and MongoDB
for managing the deployment of microservices across multiple regions and environments.

This project was born during my SRE days, while working on-call for a large
EU organisation in the energy sector. After quiting the SRE job and joining
Weaveworks, I've archived this project and fully embraced Kubernetes.

:fontawesome-brands-git-alt: [github.com/stefanprodan/syros](https://github.com/stefanprodan/syros)

:fontawesome-solid-code: `golang`, `vuejs`

## ASP.NET Throttle

:fontawesome-solid-user-graduate: creator & maintainer
:fontawesome-solid-calendar-days: 2014-2017

ASP.NET rate limiting solution designed to control the rate of requests that clients
can make to a Web API or MVC app based on IP address, client API Key and request route.

In 2016, I gave up on the .NET ecosystem and one of my former colleagues, Cristi Pufu,
took over the maintainership of the ASP.NET Core middlewares.

:fontawesome-brands-git-alt: [github.com/stefanprodan/AspNetCoreRateLimit](https://github.com/stefanprodan/AspNetCoreRateLimit)

:fontawesome-brands-git-alt: [github.com/stefanprodan/WebApiThrottle](https://github.com/stefanprodan/WebApiThrottle)

:fontawesome-solid-code: `C#`
