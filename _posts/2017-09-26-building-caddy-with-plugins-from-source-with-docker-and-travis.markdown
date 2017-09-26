---
title:  "Building Caddy server with plugins from source with Docker and Travis CI"
description: "Automated build of Caddy with plugins from source with Docker multi-build and Travis CI"
date:   2017-09-26 12:00:00
categories: [Open Source]
tags: [Docker]
---

I am a big fan of Caddy and I use it often in POCs and personal projects. 
I stand by the Caddy team decision to offer the official binary distribution as a payed service and I hope 
it will help the project evolve and make Caddy even better.

In order to keep using the open source Apache 2.0 licensed version, I've made a [project](https://github.com/stefanprodan/caddy-builder) 
to automate the build process of Caddy with plugins from source using Docker multi-build and Travis CI.

### Usage

Clone the caddy-builder repository:

```bash
$ git clone https://github.com/stefanprodan/caddy-builder.git
$ cd caddy-builder
```

Add the Caddy plugins that you want to the `plugins.go` file:

```go
package caddyhttp

import (
	// http.prometheus
	_ "github.com/miekg/caddy-prometheus"
	// http.ipfilter
	_ "github.com/pyed/ipfilter"
)
```

Edit the [docker-compose](https://github.com/stefanprodan/caddy-builder/blob/master/docker-compose.yml) 
file and replace the image prefix with your own repo name:

```yaml
version: "3.3"

services:
  caddy:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        CADDY_VERSION: ${CADDY_VERSION:-0.10.9}
    image: stefanprodan/caddy:${CADDY_VERSION:-0.10.9}
    container_name: caddy
    ports:
      - 80:80
      - 443:443
      - 9180:9180
```

Build the image with Docker Compose:

```bash
CADDY_VERSION=0.10.9 docker-compose build caddy
```

Run Caddy container exposing 80, 443 and 9180 ports:

```bash
docker-compose up -d
```

Remove the container, `www` volume and image:

```bash
docker-compose down -v --rmi all
```

### Build and publish to Docker Hub

You can automate the build and publish process for free with Travis CI. First create a Docker Hub repository, 
add your public GitHub repo to Travis CI and set the `DOCKER_USER` and `DOCKER_PASS` environments variable in the Travis 
project. Before triggering the fist build, replace `stefanprodan` with your own Docker hub user 
in the [.travis.yml](https://github.com/stefanprodan/caddy-builder/blob/master/.travis.yml) file.

```yaml
sudo: required
language: generic

services:
  - docker

env:
  global:
    - CADDY_VERSION: 0.10.9
    - DOCKER_COMPOSE_VERSION: 1.16.1

before_install:
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
  - sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
  - sudo apt-get update
  - sudo apt-get -y install docker-ce
  - sudo service docker restart
  - sudo rm /usr/local/bin/docker-compose
  - curl -L https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-`uname -s`-`uname -m` > docker-compose
  - chmod +x docker-compose
  - sudo mv docker-compose /usr/local/bin

script:
  - CADDY_VERSION=$CADDY_VERSION docker-compose build caddy

after_success:
  - if [ "$TRAVIS_BRANCH" == "master" ]; then
    docker login -u "$DOCKER_USER" -p "$DOCKER_PASS";
    docker tag stefanprodan/caddy:$CADDY_VERSION stefanprodan/caddy:latest;
    docker push stefanprodan/caddy:$CADDY_VERSION;
    docker push stefanprodan/caddy:latest;
    fi
```

When a new Caddy version is released, update the `CADDY_VERSION` variable, commit the changes to GitHub 
and Travis will publish the new image to Docker Hub.

### Running Caddy with Docker

The [stefanprodan/caddy](https://hub.docker.com/r/stefanprodan/caddy/) comes with a default Caddyfile that 
you can override by mounting your own config:

```bash
$ docker run -d --name caddy \
    -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile \
    -p 80:80 \
    stefanprodan/caddy
```

Mount your site root using the `www` volume:

```bash
$ docker run -d --name caddy \
    -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile \
    -v $(pwd)/site:/www \
    -p 80:80 \
    stefanprodan/caddy
```

Expose the Prometheus metric endpoint on `http://localhost:9180/metrics`:

```bash
$ docker run -d --name caddy \
    -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile \
    -v $(pwd)/site:/www \
    -p 80:80 -p 9180:9180 \
    stefanprodan/caddy
```

In your Caddyfile configure the http.prometheus plugin:

```
example.com {
    prometheus 0.0.0.0:9180
    log stdout
    errors stderr
}
```

Persist Let's Encrypt certificates on host:

```bash
$ docker run -d --name caddy \
    -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile \
    -v $(pwd)/certs:/.caddy \
    -p 80:80 -p 443:443 \
    stefanprodan/caddy
```

In your Caddyfile configure the tls email:

```
example.com {
    tls contact@example.com
}
```

### Running Caddy on Docker Swarm

In order to deploy Caddy with a custom config on Docker Swarm, you need to use 
Docker engine version 17.06 or later. The Caddy image has curl installed so 
you can easily define a health check:

```yaml
version: "3.3"

configs:
  caddy_config:
    file: ./Caddyfile

volumes:
  certs: {}

services:
  caddy:
    image: stefanprodan/caddy
    ports:
      - 80:80
      - 443:443
    configs:
      - source: caddy_config
        target: /etc/caddy/Caddyfile
    volumes:
      - certs:/.caddy
    deploy:
      mode: replicated
      replicas: 1    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 5s
      timeout: 1s
      retries: 3
```

### License

The caddy-builder is MIT licensed and the Caddy 
[source code](https://github.com/mholt/caddy/blob/master/LICENSE.txt) is Apache 2.0 licensed. 
Because stefanprodan/caddy is built from source, it's not subject to the 
[EULA](https://github.com/mholt/caddy/blob/545fa844bbd188c1e5bff6926e5c410e695571a0/dist/EULA.txt) for 
Caddy's official binary distributions. If you plan to use Caddy for commercial purposes you should 
run the [official](https://caddyserver.com/pricing) Caddy distribution. 

