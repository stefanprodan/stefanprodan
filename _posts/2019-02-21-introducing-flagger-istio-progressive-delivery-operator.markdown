---
title:  "Introducing Flagger the Istio progressive delivery operator"
description: "Automated canary deployments for Kubernetes"
date:   2019-02-21 00:00:00
categories: [Open Source]
tags: [Istio, Kubernetes]
---

Continuous delivery is accepted as an enterprise software practice, and is a natural evolution of well-established continuous integration principles. However continuous deployment continues to be notably rare, perhaps due to the complexity of management and the fear of failed deployments impacting system availability.

[Flagger](https://github.com/stefanprodan/flagger) is an open source Kubernetes operator that aims to untangle this complexity. It automates the promotion of canary deployments by using Istio’s traffic shifting and Prometheus metrics to analyse the application’s behaviour during a controlled rollout.

### Install Flagger with Helm

Flagger requires a Kubernetes cluster **v1.11** or newer with the following admission controllers enabled:

* MutatingAdmissionWebhook
* ValidatingAdmissionWebhook 

Flagger depends on [Istio](https://istio.io/docs/setup/kubernetes/quick-start/) **v1.0.3** or newer 
with traffic management, telemetry and Prometheus enabled. 

A minimal Istio installation should contain the following services:

* istio-pilot
* istio-ingressgateway
* istio-sidecar-injector
* istio-telemetry
* prometheus

Add Flagger Helm repository:

```bash
helm repo add flagger https://flagger.app
```

Deploy Flagger in the _**istio-system**_ namespace:

```bash
helm upgrade -i flagger flagger/flagger \
--namespace=istio-system \
--set metricsServer=http://prometheus.istio-system:9090 \
--set slack.url=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
--set slack.channel=general \
--set slack.user=flagger
```

You can install Flagger in any namespace as long as it can talk to the Istio Prometheus service on port 9090. The Slack settings are optional.

Flagger comes with a Grafana dashboard made for monitoring the canary analysis. Deploy Grafana in the _**istio-system**_ namespace:

```bash
helm upgrade -i flagger-grafana flagger/grafana \
--namespace=istio-system \
--set url=http://prometheus.istio-system:9090 \
--set user=admin \
--set password=change-me
```

### Istio ingress gateway setup

Flagger can expose services outside the mesh, for this you'll need to have on Istio ingress gateway.

Create a generic Istio gateway to expose services outside the mesh on HTTP:

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: public-gateway
  namespace: istio-system
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "*"
```

Save the above resource as public-gateway.yaml and then apply it:

```bash
kubectl apply -f ./public-gateway.yaml
```

No production system should expose services on the internet without SSL. To secure the Istio ingress gateway with cert-manager, CloudDNS and Let’s Encrypt please read Flagger GKE [documentation](https://docs.flagger.app/install/flagger-install-on-google-cloud).

### Deploy web applications with Flagger

Flagger takes a Kubernetes deployment and optionally a horizontal pod autoscaler (HPA), then creates a series of objects (Kubernetes deployments, ClusterIP services and Istio virtual services). These objects expose the application on the mesh and drive the canary analysis and promotion.

![Flagger overview diagram](https://raw.githubusercontent.com/stefanprodan/flagger/master/docs/diagrams/flagger-canary-overview.png)

Create a test namespace with Istio sidecar injection enabled:

```bash
export REPO=https://raw.githubusercontent.com/stefanprodan/flagger/master

kubectl apply -f ${REPO}/artifacts/namespaces/test.yaml
```

Create a deployment and a horizontal pod autoscaler:

```bash
kubectl apply -f ${REPO}/artifacts/canaries/deployment.yaml
kubectl apply -f ${REPO}/artifacts/canaries/hpa.yaml
```

Deploy the load testing service to generate traffic during the canary analysis:

```bash
helm upgrade -i flagger-loadtester flagger/loadtester \
--namepace=test
```

Create a canary custom resource (replace `example.com` with your own domain):

```yaml
apiVersion: flagger.app/v1alpha3
kind: Canary
metadata:
  name: podinfo
  namespace: test
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: podinfo
  progressDeadlineSeconds: 60
  autoscalerRef:
    apiVersion: autoscaling/v2beta1
    kind: HorizontalPodAutoscaler
    name: podinfo
  service:
    port: 9898
    gateways:
    - public-gateway.istio-system.svc.cluster.local
    hosts:
    - app.istio.example.com
  canaryAnalysis:
    interval: 30s
    threshold: 10
    maxWeight: 50
    stepWeight: 5
    metrics:
    - name: istio_requests_total
      threshold: 99
      interval: 30s
    - name: istio_request_duration_seconds_bucket
      threshold: 500
      interval: 30s
    webhooks:
      - name: load-test
        url: http://flagger-loadtester.test/
        timeout: 5s
        metadata:
          cmd: "hey -z 1m -q 10 -c 2 http://podinfo.test:9898/"
```

Save the above resource as podinfo-canary.yaml and then apply it:

```bash
kubectl apply -f ./podinfo-canary.yaml
```

The above analysis, if it succeeds, will run for five minutes while validating the HTTP metrics every half minute. You can determine the minimum time that it takes to validate and promote a canary deployment using the formula: `interval * (maxWeight / stepWeight)`. The Canary CRD fields are documented [here](https://docs.flagger.app/how-it-works#canary-custom-resource).

After a couple of seconds Flagger will create the canary objects:

```bash
# applied 
deployment.apps/podinfo
horizontalpodautoscaler.autoscaling/podinfo
canary.flagger.app/podinfo

# generated 
deployment.apps/podinfo-primary
horizontalpodautoscaler.autoscaling/podinfo-primary
service/podinfo
service/podinfo-canary
service/podinfo-primary
virtualservice.networking.istio.io/podinfo
```

Open your browser and navigate to `app.istio.example.com`, you should see the version number of the demo app.

### Automated canary analysis and promotion

Flagger implements a control loop that gradually shifts traffic to the canary while measuring key performance indicators like HTTP requests success rate, requests average duration and pod health. Based on analysis of the KPIs a canary is promoted or aborted, and the analysis result is published to Slack.

![Flagger Canary Stages](https://raw.githubusercontent.com/stefanprodan/flagger/master/docs/diagrams/flagger-canary-steps.png)

A canary deployment is triggered by changes in any of the following objects:

* Deployment PodSpec (container image, command, ports, env, etc)
* ConfigMaps mounted as volumes or mapped to environment variables
* Secrets mounted as volumes or mapped to environment variables

Trigger a canary deployment by updating the container image:

```bash
kubectl -n test set image deployment/podinfo \
podinfod=quay.io/stefanprodan/podinfo:1.4.1
```

Flagger detects that the deployment revision changed and starts to analyse it:

```
kubectl -n test describe canary/podinfo

Events:

New revision detected podinfo.test
Scaling up podinfo.test
Waiting for podinfo.test rollout to finish: 0 of 1 updated replicas are available
Advance podinfo.test canary weight 5
Advance podinfo.test canary weight 10
Advance podinfo.test canary weight 15
Advance podinfo.test canary weight 20
Advance podinfo.test canary weight 25
Advance podinfo.test canary weight 30
Advance podinfo.test canary weight 35
Advance podinfo.test canary weight 40
Advance podinfo.test canary weight 45
Advance podinfo.test canary weight 50
Copying podinfo.test template spec to podinfo-primary.test
Waiting for podinfo-primary.test rollout to finish: 1 of 2 updated replicas are available
Promotion completed! Scaling down podinfo.test
```

Note that if you apply new changes to the deployment during the canary analysis, Flagger will restart the analysis.

You can list all canaries with:

```bash
watch kubectl get canaries --all-namespaces

NAMESPACE   NAME      STATUS        WEIGHT   LASTTRANSITIONTIME
test        podinfo   Progressing   15       2019-01-16T14:05:07Z
prod        frontend  Succeeded     0        2019-01-15T16:15:07Z
prod        backend   Failed        0        2019-01-14T17:05:07Z
```

During the analysis the canary’s progress can be monitored with Grafana:

![Grafana canary dashbaord](https://raw.githubusercontent.com/stefanprodan/flagger/docs/screens/flagger-grafana-dashboard.png)

If you’ve enabled the Slack notifications, you should receive the following messages:

![Flagger Slack notifications](https://raw.githubusercontent.com/stefanprodan/flagger/master/docs/screens/slack-canary-notifications.png)

### Automated rollback

During the canary analysis it is possible to generate synthetic HTTP 500 errors and high response latency to test if Flagger pauses the rollout.

Create a tester pod and exec into it:

```bash
kubectl -n test run tester \
--image=quay.io/stefanprodan/podinfo:1.2.1 \
-- ./podinfo --port=9898

kubectl -n test exec -it tester-xx-xx s
```

Generate HTTP 500 errors:

```bash
watch curl http://podinfo-canary:9898/status/500
```

Generate latency:

```bash
watch curl http://podinfo-canary:9898/delay/1
```

When the number of failed checks reaches the canary analysis threshold, the traffic is routed back to the primary, the canary is scaled to zero and the rollout is marked as failed.

If you’ve enabled the Slack notifications, you’ll receive a message if the progress deadline is exceeded, or if the analysis reached the maximum number of failed checks:

![Rollback notifications](https://raw.githubusercontent.com/stefanprodan/flagger/master/docs/screens/slack-canary-failed.png)

### Conclusions

With Flagger you don’t have to worry about keeping code and configuration changes in sync. Flagger keeps track of ConfigMaps and Secrets referenced by a Kubernetes Deployment and triggers a canary analysis if any of those objects change. When promoting a workload in production, both code (container images) and configuration (config maps and secrets) are being synchronised.

Flagger's canary analysis can be easily extended with webhooks for running system integration/acceptance tests, load tests, or any other custom validation. Since Flagger is declarative and reacts to Kubernetes events, it can be used in GitOps pipelines together with Weave Flux or JenkinsX.

If you have any suggestion on improving Flagger please submit an issue or PR on GitHub at [stefanprodan/flagger](https://github.com/stefanprodan/flagger). Contributions are more than welcome!
