# Flux Cluster — GitOps Graph

Cluster: `kind-flux` (2 nodes, arm64, k8s v1.36.1) — Flux v2.9.4 via flux-operator v0.58.1,
synced from `oci://flux-registry:5000/flux-cluster` (`dev` tag).

```mermaid
flowchart TB
  subgraph REG["OCI registry flux-registry:5000"]
    MONO[("flux-cluster :dev<br/>(git monorepo)")]
    CMCH[("charts/cert-manager")]
    MSCH[("charts/metrics-server")]
  end

  subgraph BOOT["Bootstrap — flux-system"]
    FI["FluxInstance: flux"]
    ORF["OCIRepository: flux-system"]
    KF["K: flux-system<br/><i>clusters/dev/</i>"]
    KIR["K: infra-reconcilers<br/><i>infra/reconcilers</i>"]
    KATR["K: apps-test-reconcilers<br/><i>apps/reconcilers</i>"]
    KASR["K: apps-staging-reconcilers<br/><i>apps/reconcilers</i>"]
  end

  subgraph GEN["Artifact pipeline — flux-system"]
    AGC["ArtifactGenerator: infra-core"]
    AGK["ArtifactGenerator: infra-controllers"]
    AGG["ArtifactGenerator: infra-configs"]
    AGA["ArtifactGenerator: apps"]
    RSIC["RS/RSIP: infra-core"]
    RSIK["RS/RSIP: infra-controllers"]
    RSIG["RS/RSIP: infra-configs"]
    RSIA["RS/RSIP: apps"]
  end

  subgraph EA["ExternalArtifacts (flux-system)"]
    EAC["core-dev"]
    EAK1["cert-manager-dev"]
    EAK2["monitoring-dev"]
    EAG["cert-manager-dev-configs"]
    EAT1["backend-test"]
    EAT2["frontend-test"]
    EAS1["backend-staging"]
    EAS2["frontend-staging"]
  end

  subgraph COMP["Components"]
    KIC["K: infra-core"]
    KCM["K: cert-manager"]
    KMON["K: monitoring"]
    KCMG["K: cert-manager-configs"]
    KBE_T["K: backend<br/>apps-test"]
    KFE_T["K: frontend<br/>apps-test"]
    KBE_S["K: backend<br/>apps-staging"]
    KFE_S["K: frontend<br/>apps-staging"]
    ORCM["OCIRepository: cert-manager-chart"]
    ORMS["OCIRepository: metrics-server-chart"]
    HRCM["HelmRelease: cert-manager"]
    HRMS["HelmRelease: metrics-server"]
  end

  subgraph WL["Workloads"]
    NSINF["namespaces cert-manager, monitoring<br/>+ allow-egress NetworkPolicies"]
    DCM["Deployments: cert-manager, cainjector, webhook"]
    DMS["Deployment: metrics-server"]
    DAT["Deployments: backend, frontend (apps-test)"]
    DAS["Deployments: backend, frontend (apps-staging)"]
  end

  FI -->|sync 1m, path clusters/dev/| ORF
  MONO --- ORF
  ORF -->|clusters/dev/| KF
  KF -->|creates| KIR & KATR & KASR
  KIR -->|creates| AGC & AGK & AGG & RSIC & RSIK & RSIG
  KATR & KASR -->|creates| AGA & RSIA
  ORF --> AGC & AGK & AGG & AGA

  AGC -->|generates| EAC
  AGK -->|generates| EAK1 & EAK2
  AGG -->|generates| EAG
  AGA -->|generates| EAT1 & EAT2 & EAS1 & EAS2

  EAC -->|sourceRef| KIC
  EAK1 -->|sourceRef| KCM
  EAK2 -->|sourceRef| KMON
  EAG -->|sourceRef| KCMG
  EAT1 -->|sourceRef| KBE_T
  EAT2 -->|sourceRef| KFE_T
  EAS1 -->|sourceRef| KBE_S
  EAS2 -->|sourceRef| KFE_S

  CMCH --- ORCM
  MSCH --- ORMS
  KCM -->|creates| HRCM & ORCM
  KMON -->|creates| HRMS & ORMS
  HRCM -.->|chartRef| ORCM
  HRMS -.->|chartRef| ORMS

  KIC --> NSINF
  HRCM --> DCM
  HRMS --> DMS
  KBE_T & KFE_T --> DAT
  KBE_S & KFE_S --> DAS
```

## How it flows

1. **Source of truth** — one git monorepo published as the `flux-cluster:dev` OCI image; the FluxInstance syncs `clusters/dev/` every 1m.
2. **Bootstrap** — `K:flux-system` applies the FluxInstance, the `flux-vars` ConfigMap, and the 3 reconciler Kustomizations.
3. **Fan-out** — reconcilers create the 4 ArtifactGenerators and the ResourceSets/ResourceSetInputProviders; generators expand monorepo paths (`apps/{app}/envs/{env}`, `infra/components/{app}/...`, `infra/core/...`) into 14 per-app/env ExternalArtifacts.
4. **Delivery** — ResourceSets materialize a Kustomization per app/component, each sourcing its ExternalArtifact; app Kustomizations live in tenant namespaces (`apps-test`, `apps-staging`).
5. **Charts** — infra Kustomizations create the chart OCIRepositories and HelmReleases, which pull charts from the separate chart images.

## Notes

- All 12 Kustomizations and 2 HelmReleases are Ready; nothing failing or suspended.
- 6 `-prod` ExternalArtifacts (`backend-prod`, `frontend-prod`, `cert-manager-prod`, `monitoring-prod`, `cert-manager-prod-configs`, `core-prod`) are generated but have no consumers on this cluster — there is no `apps-prod` namespace or prod reconciler.
- HelmReleases are consumed via `chartRef`: `cert-manager` → `oci://flux-registry:5000/charts/cert-manager` (v1.21.1), `metrics-server` → `oci://flux-registry:5000/charts/metrics-server` (v3.14.0).
