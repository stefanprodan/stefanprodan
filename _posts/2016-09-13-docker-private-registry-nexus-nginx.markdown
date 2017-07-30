---
title:  "Setting up a Docker Private Registry with authentication using Nexus and Nginx"
description: "Self-hosted secure Docker Registry with Nexus Repository OSS, Nginx and Docker"
date:   2016-09-13 12:00:00
categories: [Guides]
tags: [Docker]
---

This article shows how you can set up a Docker Private Registry with authentication and SSL using Nexus Repository OSS.

Nexus Repository OSS is a universal repository manager with support for all major package formats and types. It's a free solution for storing and sharing Docker images and other components like NuGet or NPM packages across the deployment pipeline while keeping your proprietary and third-party images private and secure.

![Nexus Docker Registry]({{ "assets/nexus-docker.png" | relative_url }})

I am using an Ubuntu Server 16.04 and Docker 1.12 to host the Nexus Repository and NGINX containers.

### Running Nexus Repository container

First you have to build your own Nexus 3 docker image and expose port 8081 and 5000. Nexus management UI will run on 8081 while Docker Registry will run on 5000. This Docker image can be found on Docker Hub at [stefanprodan/nexus](https://hub.docker.com/r/stefanprodan/nexus/).

Create a directory named nexus and add a Dockerfile with the following content:

```sh
FROM alpine:3.4

ENV NEXUS_VERSION="3.0.2-02" \
    NEXUS_DATA="/nexus-data" \
    JAVA_MIN_MEM="1200M" \
    JAVA_MAX_MEM="1200M" \
    JKS_PASSWORD="changeit"

RUN set -x \
    && apk --no-cache add \
        openjdk8-jre-base \
        openssl \
        su-exec \
    && mkdir "/opt" \
    && wget -qO - "https://download.sonatype.com/nexus/3/nexus-${NEXUS_VERSION}-unix.tar.gz" \
    | tar -zxC "/opt" \
    && adduser -S -h ${NEXUS_DATA} nexus \
	&& sed \
		-e "s|-Xms1200M|-Xms${JAVA_MIN_MEM}|g" \
		-e "s|-Xmx1200M|-Xmx${JAVA_MAX_MEM}|g" \
		-e "s|karaf.home=.|karaf.home=/opt/nexus-${NEXUS_VERSION}|g" \
		-e "s|karaf.base=.|karaf.base=/opt/nexus-${NEXUS_VERSION}|g" \
		-e "s|karaf.etc=etc|karaf.etc=/opt/nexus-${NEXUS_VERSION}/etc|g" \
		-e "s|java.util.logging.config.file=etc|java.util.logging.config.file=/opt/nexus-${NEXUS_VERSION}/etc|g" \
		-e "s|karaf.data=data|karaf.data=${NEXUS_DATA}|g" \
		-e "s|java.io.tmpdir=data/tmp|java.io.tmpdir=${NEXUS_DATA}/tmp|g" \
		-i "/opt/nexus-${NEXUS_VERSION}/bin/nexus.vmoptions" \
	&& mkdir -p "${NEXUS_DATA}" \
	&& chown -R nexus "${NEXUS_DATA}"

EXPOSE 8081 5000

WORKDIR "/opt/nexus-${NEXUS_VERSION}"

VOLUME ${NEXUS_DATA}

CMD ["su-exec", "nexus", "bin/nexus", "run"]
```

Next you need to create a dedicated docker network for your registry:

```sh
docker network create intranet
```

Now you can build the nexus image and run the nexus container:

```sh
docker build -t nexus-img .

docker run -d --name nexus \
    -v /path/to/nexus-data:/nexus-data \
    --restart unless-stopped \
    --network intranet nexus-img
```

Replace `/path/to/nexus-data` with your own location.

### Running NGINX as reverse proxy for Nexus

Create a directory named nginx and add a Dockerfile with the following content:

```
FROM nginx
COPY ./nginx.conf /etc/nginx/nginx.conf
```

In the same directory create the nginx.conf file with the following content:

```sh
worker_processes 2;

events { 
	worker_connections 1024; 
}

http {
	error_log /var/log/nginx/error.log warn;
	access_log  /dev/null;
	proxy_intercept_errors off;
	proxy_send_timeout 120;
	proxy_read_timeout 300;
	
	upstream nexus {
        server nexus:8081;
	}

	upstream registry {
        server nexus:5000;
	}

	server {
        listen 80;
        server_name nexus.demo.com;

        keepalive_timeout  5 5;
        proxy_buffering    off;

        # allow large uploads
        client_max_body_size 1G;

        location / {
		# redirect to docker registry
		if ($http_user_agent ~ docker ) {
			proxy_pass http://registry;
		}
		proxy_pass http://nexus;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}

```

Replace `nexus.demo.com` with your own domain. The NGINX server detects if a call is made by the docker client, based on user agent, and redirects that call to the Docker Registry.

Build and run the NGINX container:

```sh
docker build -t nginx-img .

docker run -d --publish 80:80 --name nginx \
    --restart unless-stopped \
    --network intranet \
    nginx-img
```

Now you can access the Nexus UI by navigation to your nexus sub-domain. The default credentials are `admin` / `admin123`, you should change them before proceeding with the setup. Nexus can be configured to support static or dynamic user and group definitions and can authenticate users against LDAP or Active Directory.

Navigate to the repository administration page and create a new repository by selecting the ***docker (hosted)*** recipe. In the repository connectors section, check ***Create an HTTP connector at specified port*** and insert ***5000*** as the port value. For a detailed walkthrough check the nexus documentation on [Docker Registry](https://books.sonatype.com/nexus-book/3.0/reference/docker.html).  

At this point, the Docker Registry is up and running, but you can't access it from a docker client because Docker requires the registry to run on SSL. 

You can use letsencrypt [certbot](https://github.com/certbot/certbot) to generate a certificate for nexus sub-domain or you can use CloudFlare to manage your domain and enable the free Flexible SSL option. Since certbot NGINX plug-in is still experimental I opted for the CloudFlare certificate. 

Once you've configured the certificate you can start using the Docker Private Registry by logging in with your nexus credentials:

```sh
docker login nexus.demo.com
```

[Nexus Repository OSS](https://www.sonatype.com/nexus-repository-oss) is used by more than 100,000 development teams, if you need to run a self-hosted Docker Registry you should consider using Nexus.


 
