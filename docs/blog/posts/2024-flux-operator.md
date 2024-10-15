---
date: 2024-10-15
authors: [stefanprodan]
slug: flux-operator
description: >
  Declarative Lifecycle Management for Flux CD
categories:
  - Flux
---

# Introducing the Flux Operator - GitOps on Autopilot Mode

In this article, we introduce the Flux Operator, a new component in the Flux CD ecosystem
that automates the lifecycle management of Flux components and streamlines the GitOps
workflows for Kubernetes clusters.

<!-- more -->

We've been working on the [Flux Operator](https://github.com/controlplaneio-fluxcd/flux-operator)
since the beginning of 2024, and we are excited to announce that the project is being used in production
by several organizations. We are confident that the operator will simplify the adoption of GitOps practices
for organizations of all sizes, and we are looking forward to the feedback from the Flux community.

## Features

The operator offers an alternative to the Flux Bootstrap procedure, it removes the operational burden of
managing Flux across fleets of clusters by fully automating the installation, configuration, and
upgrade of the Flux controllers based on a declarative API.

### Advanced Configuration Made Easy

The operator simplifies the configuration of Flux multi-tenancy lockdown,
sharding, horizontal and vertical scaling, persistent storage, and allows fine-tuning the Flux
controllers with Kustomize patches.

When it comes to upgrading Flux, the operator provides a seamless experience by automatically
applying the latest Flux version based on the specified semver range, without any manual intervention.
Moreover, the operator migrates the Flux custom resources stored in Kubernetes etcd
to the latest API version, keeping the custom resources in sync with their definitions.

For a detailed guide on how to configure Flux using the operator please see the
[Flux Controllers Configuration](https://fluxcd.control-plane.io/operator/flux-config/) documentation.
A dedicated guide on how to horizontally scale the Flux controllers can be found 
at [Flux Sharding Configuration](https://fluxcd.control-plane.io/operator/flux-sharding/).

### Cluster Synchronization

The operator offers flexible synchronization strategies where users can choose
to sync the cluster state from Git repositories, OCI artifacts and S3-compatible storage.

On high-regulated environments, the operator can be configured to fetch the desired state from
container registries which reside in private networks alongside the Kubernetes clusters. The
operator supports OIDC-based authentication when fetching OCI Artifacts from private registries
eliminating the need for static credentials and long-lived tokens.

Find more information about the Flux synchronization strategies in the
[Flux Cluster Sync Configuration](https://fluxcd.control-plane.io/operator/flux-sync/) guide.

### Deep Insights

The operator provides deep insights into the delivery pipelines managed by Flux,
including detailed reports and Prometheus metrics about the Flux controllers
readiness status, reconcilers statistics, and cluster state synchronization.

The automatically generated report can be queried using the Kubernetes API and is
available as a custom resource called `FluxReport`. The operator exports metrics
for all Flux custom resources found in the cluster, users no longer need to 
rely on kube-state-metrics to monitor Flux. For more information, see the
[Flux Monitoring and Reporting](https://fluxcd.control-plane.io/operator/monitoring/) guide.

### OpenShift Compatibility

The operator makes Flux compatible with Red Hat OpenShift and can be installed on OpenShift and OKD
clusters using the Operator Lifecycle Manager (OLM) directly from the
Red Hat Community Operators catalog or from [OperatorHub.io](https://operatorhub.io/operator/flux-operator).

### Enterprise Support

The operator is a key component of the ControlPlane
[Enterprise offering](https://fluxcd.control-plane.io/distribution/), and is designed to automate the
rollout of new Flux versions, CVE patches and hotfixes to production environments in a secure and reliable way.

The operator periodically checks if ControlPlane has patched the Flux images with the latest security updates
and automatically applies the patches to the Flux controllers running in the cluster.

The operator is end-to-end tested along with the ControlPlane Flux distribution on the latest Kubernetes going
back six minor versions, ensuring compatibility with the most popular Kubernetes distributions such as
Amazon EKS, Azure AKS, Google GKE and Red Hat OpenShift. 

## Get Started with the Flux Operator

To install the operator on Kubernetes, users have multiple options,
including Helm, Terraform, OpenTofu, OperatorHub, Pulumi, and kubectl. The operator deployment
does not require any additional configuration, as it comes with sensible defaults.

Example of installing the Flux Operator using Helm:

```shell
helm install flux-operator oci://ghcr.io/controlplaneio-fluxcd/charts/flux-operator \
  --namespace flux-system \
  --create-namespace
```

Example of configuring the Flux instance:

```yaml
apiVersion: fluxcd.controlplane.io/v1
kind: FluxInstance
metadata:
  name: flux
  namespace: flux-system
  annotations:
    fluxcd.controlplane.io/reconcileEvery: "1h"
    fluxcd.controlplane.io/reconcileTimeout: "5m"
spec:
  distribution:
    version: "2.x"
    registry: "ghcr.io/fluxcd"
    artifact: "oci://ghcr.io/controlplaneio-fluxcd/flux-operator-manifests"
  components:
    - source-controller
    - kustomize-controller
    - helm-controller
    - notification-controller
    - image-reflector-controller
    - image-automation-controller
  cluster:
    type: kubernetes
    multitenant: false
    networkPolicy: true
    domain: "cluster.local"
  kustomize:
    patches:
      - target:
          kind: Deployment
          name: "(kustomize-controller|helm-controller)"
        patch: |
          - op: add
            path: /spec/template/spec/containers/0/args/-
            value: --concurrent=10
          - op: add
            path: /spec/template/spec/containers/0/args/-
            value: --requeue-dependency=5s
  sync:
    kind: GitRepository
    url: "https://github.com/fluxcd/flux2-kustomize-helm-example.git"
    ref: "refs/heads/main"
    path: "clusters/production"
```

The Flux instance can be customized in various ways. For more information, refer to the
[configuration guide](https://fluxcd.control-plane.io/operator/flux-config/) and the
[cluster sync guide](https://fluxcd.control-plane.io/operator/flux-sync/).

On production environments, the operator installation and the Flux instance configuration
can be done at cluster provisioning time using Terraform, OpenTofu or any other IaC tool
that supports Helm. For an example of how to install the operator with Terraform, see the
[Terraform module example](https://github.com/controlplaneio-fluxcd/flux-operator/tree/main/config/terraform).

## Migration to the Flux Operator

For existing Flux installations, the migration to the Flux Operator is straightforward and
can be done without any downtime. The operator is designed to take over the management of
the Flux components seamlessly from Flux CLI, Helm, Terraform and was tested with Flux
installations going back to v2.2.

For a detailed guide on how to migrate from Flux CLI bootstrap to the Flux Operator,
please see the [Flux Migration Guide](https://fluxcd.control-plane.io/operator/flux-bootstrap-migration/).

## What's Next?

We plan to evolve the Flux Operator with more features that will further simplify the GitOps workflows
and Flux usage in production environments.

For the next release, we are working on adding a high-level abstraction for defining and managing
Flux resources and related Kubernetes objects as a single deployable unit.
The new API is designed to reduce the complexity of Kustomize overlays by providing a compact way
of defining different configurations for a set of workloads per tenant and/or environment.

A preview of the new API will be available in the upcoming release, and we encourage the
Flux community to provide feedback and help us shape the future of the operator.

Stay tuned for more updates and please follow the Flux Operator project on
[GitHub](https://github.com/controlplaneio-fluxcd/flux-operator).
