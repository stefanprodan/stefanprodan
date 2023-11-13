---
date: 2023-11-13
authors: [stefanprodan]
description: >
  Distribution and Lifecycle Management for Cloud-Native Applications
categories:
  - Timoni
hide:
  - toc
---

# Introducing Timoni - Next-Gen Package Manager for Kubernetes

I'm excited to formally introduce [Timoni](https://github.com/stefanprodan/timoni),
a personal project that I've started at the beginning of this year with the goal of
offering a better experience when creating, packaging and
delivering apps to Kubernetes.

Instead of using Go templates with YAML like Helm or layering YAML
like Kustomize, Timoni relies on [CUE](https://cuelang.org/)'s
type safety, code generation, and data validation features to
improve the UX of authoring Kubernetes configs.

<!-- more -->

![Timoni intro](presentations/2023-timoni/timoni-1.png)
![Who is Timoni for](presentations/2023-timoni/timoni-2.png)
![What is Timoni](presentations/2023-timoni/timoni-3.png)
![Timoni features](presentations/2023-timoni/timoni-4.png)
![Timoni app definition and distribution](presentations/2023-timoni/timoni-5.png)
![Timoni module](presentations/2023-timoni/timoni-6.png)
![Timoni module development](presentations/2023-timoni/timoni-7.png)
![Timoni module distribution](presentations/2023-timoni/timoni-8.png)
![Timoni app composition and lifecycle](presentations/2023-timoni/timoni-9.png)
![Timoni bundle](presentations/2023-timoni/timoni-10.png)
![Timoni bundle operations](presentations/2023-timoni/timoni-11.png)
![Timoni bundle multi-cluster](presentations/2023-timoni/timoni-12.png)
![Timoni vs helm](presentations/2023-timoni/timoni-13.png)
![Timoni resources](presentations/2023-timoni/timoni-14.png)
![How to contribute to Timoni](presentations/2023-timoni/timoni-15.png)
![Timoni thank you for watching](presentations/2023-timoni/timoni-16.png)

