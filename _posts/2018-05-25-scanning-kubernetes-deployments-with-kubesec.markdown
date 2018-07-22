---
title:  "Scanning Kubernetes resources with Kubesec"
description: "Using Kubesec.io as a kubectl plugin"
date:   2018-05-25 00:00:00
categories: [Open Source]
tags: [Kubernetes]
---


[Kubectl-kubesec](https://github.com/stefanprodan/kubectl-kubesec) is a kubectl plugin for scanning Kubernetes pods, deployments, daemonsets and statefulsets with [kubesec.io](https://kubesec.io)

### Install

Download and extract the scan plugin to `~/.kube/plugins/scan`:

```bash
mkdir -p ~/.kube/plugins/scan && \
curl -sL https://github.com/stefanprodan/kubectl-kubesec/releases/download/0.2.0/kubectl-kubesec_0.2.0_`uname -s`_amd64.tar.gz | tar xzvf - -C ~/.kube/plugins/scan
```

### Usage

Scan a Deployment:

```bash
kubectl -n kube-system plugin scan deployment/kubernetes-dashboard
```

Result:

```
kubernetes-dashboard kubesec.io score 7
-----------------
Advise
1. containers[] .securityContext .runAsNonRoot == true
Force the running image to run as a non-root user to ensure least privilege
2. containers[] .securityContext .capabilities .drop
Reducing kernel capabilities available to a container limits its attack surface
3. containers[] .securityContext .readOnlyRootFilesystem == true
An immutable root filesystem can prevent malicious binaries being added to PATH and increase attack cost
4. containers[] .securityContext .runAsUser > 10000
Run as a high-UID user to avoid conflicts with the host's user table
5. containers[] .securityContext .capabilities .drop | index("ALL")
Drop all capabilities and add only those required to reduce syscall attack surface
```

Scan a DaemonSet:

```bash
kubectl -n kube-system plugin scan daemonset/metadata-proxy-v0.1
```

Result:

```
daemonset/metadata-proxy-v0.1 kubesec.io score -32
-----------------
Critical
1. containers[] .securityContext .privileged == true
Privileged containers can allow almost completely unrestricted host access
2. .spec .hostNetwork
Sharing the host's network namespace permits processes in the pod to communicate with processes bound to the host's loopback adapter
-----------------
Advise
1. containers[] .securityContext .runAsNonRoot == true
Force the running image to run as a non-root user to ensure least privilege
2. containers[] .securityContext .capabilities .drop
Reducing kernel capabilities available to a container limits its attack surface
3. containers[] .securityContext .readOnlyRootFilesystem == true
An immutable root filesystem can prevent malicious binaries being added to PATH and increase attack cost
4. containers[] .securityContext .runAsUser > 10000
Run as a high-UID user to avoid conflicts with the host's user table
5. containers[] .securityContext .capabilities .drop | index("ALL")
Drop all capabilities and add only those required to reduce syscall attack surface
```

Scan a StatefulSet:

```bash
kubectl plugin scan statefulset/memcached
```

Result:

```
statefulset/memcached kubesec.io score 2
-----------------
Advise
1. .spec .volumeClaimTemplates[] .spec .accessModes | index("ReadWriteOnce")
2. containers[] .securityContext .runAsNonRoot == true
Force the running image to run as a non-root user to ensure least privilege
3. containers[] .securityContext .capabilities .drop
Reducing kernel capabilities available to a container limits its attack surface
4. containers[] .securityContext .readOnlyRootFilesystem == true
An immutable root filesystem can prevent malicious binaries being added to PATH and increase attack cost
5. containers[] .securityContext .runAsUser > 10000
Run as a high-UID user to avoid conflicts with the host's user table
```

Scan a Pod:

```bash
kubectl -n kube-system plugin scan pod/tiller-deploy-5c688d5f9b-ztjbt
```

Result:

```
pod/tiller-deploy-5c688d5f9b-ztjbt kubesec.io score 3
-----------------
Advise
1. containers[] .securityContext .runAsNonRoot == true
Force the running image to run as a non-root user to ensure least privilege
2. containers[] .securityContext .capabilities .drop
Reducing kernel capabilities available to a container limits its attack surface
3. containers[] .securityContext .readOnlyRootFilesystem == true
An immutable root filesystem can prevent malicious binaries being added to PATH and increase attack cost
4. containers[] .securityContext .runAsUser > 10000
Run as a high-UID user to avoid conflicts with the host's user table
5. containers[] .securityContext .capabilities .drop | index("ALL")
Drop all capabilities and add only those required to reduce syscall attack surface
```
