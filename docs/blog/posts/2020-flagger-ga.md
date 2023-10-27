---
date: 2020-06-17
authors: [stefanprodan]
description: >
  Announcing the first General Availability release of Flagger.
categories:
  - Flagger
hide:
  - toc
---

# Flagger v1 - General Availability Release

I am thrilled to announce the **v1.0.0** General Availability (GA) release of
Flagger, the Progressive Deliver Operator for Kubernetes.

:fontawesome-solid-heart: Thanks to all users who helped us in the past three months
testing the release candidates.

<!-- more -->

![Flagger](assets/flagger-v1-ga.png)

After two years of development and in collaboration with the Cloud Native
community, [Flagger](https://flagger.app) goes GA with builtin support for
Istio, Linkerd, App Mesh, Gloo, Contour and NGINX Ingress.

Stable Kubernetes APIs

- **Canary** CRD for configuring progressive traffic shifting, A/B testing and Blue/Green deployment.
- **MetricTemplate** CRD for defining SLOs based on Prometheus, Datadog and AWS CloudWatch metrics.
- **AlertProvider** CRD for configuring alerting on a per-canary basis for Slack, MS Teams, Discord and Rocket.

Flagger was designed to give developers confidence in automating production
releases with progressive delivery techniques. It is made to reduce the risk of
introducing a new software version in production by gradually shifting traffic
to the new version while measuring metrics like HTTP/gRPC request success rate and latency.

Flagger is compatible with CI/CD solutions made for Kubernetes and due to its declarative APIs,
it can be used in GitOps pipelines together with tools like [Flux](https://fluxcd.io).

To find out more please visit [flagger.app](https://flagger.app).
