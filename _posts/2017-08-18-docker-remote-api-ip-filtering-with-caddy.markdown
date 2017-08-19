---
title:  "Docker Swarm Remote API IP filtering with Caddy"
description: "Setup Caddy reverse proxy for Docker remote API with IP filtering"
date:   2017-08-18 12:00:00
categories: [Open Source]
tags: [Docker]
---

Lately I'm experimenting with Docker Swarm and I was looking for an easy way to expose the Docker remote API 
so I could access the Swarm nodes from my home office and from CI servers. 
I'm using Terraform to create the Swarm hosts and since my IPs can change often I didn't want to include 
them in the Terraform code.

### Setup dockerd

When I provision a Swarm node with Terraform, after installing the Docker engine, 
I expose the Docker remote API on localhost port 2375 using the following systemd config: 

```
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// \
  -H tcp://127.0.0.1:2375 \
  --storage-driver=overlay2 \
  --dns 8.8.4.4 --dns 8.8.8.8 \
  --log-driver json-file \
  --log-opt max-size=50m --log-opt max-file=10
```

Deploying the config can be done with a [script](https://github.com/stefanprodan/caddy-dockerd/tree/master/dockerd) like:

```bash
mkdir -p /etc/systemd/system/docker.service.d
cp docker.conf /etc/systemd/system/docker.service.d/docker.conf

systemctl daemon-reload
systemctl restart docker
```

The Terraform code that does this Docker engine setup can be found at 
[stefanprodan/scaleway-swarm-terraform](https://github.com/stefanprodan/scaleway-swarm-terraform).

### Run Caddy

Now that all the Swarm nodes are exposing the Docker remote API on localhost you can create 
the [caddy-dockerd](https://github.com/stefanprodan/caddy-dockerd) service. 

Connect to a Swarm manager node and run: 

```bash
docker service create -d -e IP=188.27.83.136 \
    --network=host \
    --name=caddy-dockerd \
    --mode global \
    stefanprodan/caddy-dockerd
```

The caddy-dockerd will run on every node and will expose the Docker remote API on port 7575. 
You can restrict access by proving multiple IPv4 or IPv6 or ranges of IPs. 
For more details see the Caddy ipfilter middleware [documentation](https://github.com/pyed/ipfilter/blob/master/README.md). 

### Run Caddy with Docker unix socket 

If you don't wish to expose the Docker remote API with TCP on localhost, you can mount the unix socket inside the Caddy container.

```bash
docker service create -d -e IP=188.27.83.136 \
    --network=host \
    --name=caddy-dockerd \
    --mode global \
    --mount type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock \
    stefanprodan/caddy-dockerd:sock
```

If you opt for the Docker socket reverse proxy you need to use `caddy-dockerd:sock`.

This will also work without Docker Swarm:

```bash
docker run -d -e IP=86.124.244.168 \
    --net=host \
    --name=caddy-dockerd \
    --restart=always \
    -v /var/run/docker.sock:/var/run/docker.sock \
    stefanprodan/caddy-dockerd:sock
```

### Use Docker remote API

On your local machine you can setup the remote access like this:

```bash
$ export DOCKER_HOST=tcp://<DOCKER-IP>:7575

$ docker info
```

### Update the IP filter

If you need to modify the IP environment variable, connect to a manager node and update the caddy-dockerd service like this:

```bash
docker service update \
    --env-add IP=188.27.83.136/30 \
    caddy-dockerd
```

For production systems is bad practice to expose the Docker remote API over HTTP. 
If you must do it, consider protecting the daemon socket by enabling TLS, 
more on this topic can be fond [here](https://docs.docker.com/engine/security/https/).

If you have any questions or suggestions, please leave a comment here or on GitHub at 
[stefanprodan/caddy-dockerd](https://github.com/stefanprodan/caddy-dockerd).
