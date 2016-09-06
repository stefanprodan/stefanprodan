---
title:  "NGINX reverse proxy for ASP.NET Core apps running on Docker Swarm"
description: "Configure NGINX as a reverse proxy with web sockets support, compression and caching for ASP.NET Core apps hosted with Docker Swarm Mode"
date:   2016-09-05 12:00:00
categories: [Guides]
tags: [.NET Core, Docker]
---

In this article we will configure NGINX as a reverse proxy with web sockets support, compression and caching for an ASP.NET Core app. Both the reverse proxy and the web app will run in containers on a Docker Swarm cluster. The NGINX reverse proxy will forward the requests to your app service and Docker Swarm will load balance the requests between your app instances.

![NGINX on Docker Swarm]({{ "assets/nginx-proxy-docker-swarm.png" | prepend: site.baseurl }})

I'm using a Windows 10 machine for development but you can follow this tutorial on a Mac or Linux device using Visual Studio Code and Docker.

Windows 10 prerequisites:

* [Docker for Windows](https://docs.docker.com/docker-for-windows/)
* [Visual Studio Code](https://www.visualstudio.com/products/code-vs.aspx)
* [.NET Core SDK](https://www.microsoft.com/net/core#windows)

Let's create an ASP.NET Core app named ***APPX*** and add a Dockerfile in the root directory. 
If you'll use the [Yeoman generator for ASP.NET](https://github.com/omnisharp/generator-aspnet) the Dockefile will be generated for you.

```
FROM microsoft/dotnet:latest

# Set environment variables
ENV ASPNETCORE_URLS="http://*:5000"
ENV ASPNETCORE_ENVIRONMENT="Staging"

# Copy files to app directory
COPY /src/APPX /app

# Set working directory
WORKDIR /app

# Restore NuGet packages
RUN ["dotnet", "restore"]

# Build the app
RUN ["dotnet", "build"]

# Open port
EXPOSE 5000/tcp

# Run the app
ENTRYPOINT ["dotnet", "run"]
```   

Open PowerShell, navigate to your project root directory and build the APPX image:

```powershell
docker build -t appx-img .
```

Enable Swarm mode on your Docker server and create an overlay network for our app cluster:

```powershell
if(!(docker info).contains("Swarm: active")){
 docker swarm init
}

$network = "appx-net"
if(!(docker network ls --filter name=$network -q)){
 docker network create --driver overlay $network
}
```

Now that we have our app bundled as a container image, let's run it as a service on Docker Swarm and scale it to 3 replicas.

```powershell
docker service create --name appx --network appx-net --replicas 3 appx-img
```

Note that I am not exposing the 5000 port, we will use NGNIX as our public-facing web server so we don't want to expose Kestrel on the Internet.

Create a directory named ***nginx*** inside the appx project and add a Dockerfile to it:

```
FROM nginx
COPY ./nginx.conf /etc/nginx/nginx.conf
```

This Dockerfile will create our NGINX image using the official one and copy our custom nginx.conf. Our configuration enables web sockets, compression, client and server caching of static files for the ***appx.local*** website:

```bash
worker_processes 2; # 2 * Number of CPUs

# max connections = worker_processes * worker_connections * (K / average $request_time)
events { 
	worker_connections 2048; 
}

http {
	# enable web sockets protocol
	map $http_upgrade $connection_upgrade {
		default upgrade;
		'' close;
	}

	# enable compression
	gzip on;
	gzip_http_version 1.0;
	gzip_proxied any;
	gzip_min_length 256;
	gzip_types text/plain text/css application/json application/x-javascript text/xml application/xml application/xml+rss text/javascript application/vnd.ms-fontobject application/x-font-ttf font/opentype image/svg+xml image/x-icon;
		
	# hide server version
	server_tokens off;

	# log only warn | error | crit 
	error_log /var/log/nginx/error.log warn;

	# disable access log
	access_log  /dev/null;

	# let the upstream services handle 404 and 50x errors
	proxy_intercept_errors off;
	
	# enable disk caching of 1GB
	proxy_cache_path /tmp/nginx levels=1:2 keys_zone=STATIC:10m inactive=60m max_size=1g;
	proxy_cache_key "$scheme$request_method$host$request_uri";
	
	# register appx service
	upstream appx {
		server appx:5000;
	}

	# map appx.local domain to appx service
	server {
		listen 80;
		server_name appx.local www.appx.local;
		
		location / {
			proxy_pass http://appx;
			proxy_http_version 1.1;
			proxy_set_header Upgrade $http_upgrade;
			proxy_set_header Connection $connection_upgrade;
			proxy_set_header Host $host;
			proxy_cache_bypass $http_upgrade;
			proxy_set_header X-Real-IP $remote_addr;
			proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

			# enable static file caching
			location ~ \.(svg|jpg|jpeg|gif|png|ico|css|js|woff2)$ {
				# browser caching
				expires 30d;
				add_header Cache-Control "public";
				# server caching
				proxy_cache STATIC;
				proxy_cache_valid 200 301 302 30m;
				proxy_cache_bypass  $http_cache_control;		  
				add_header X-Proxy-Cache $upstream_cache_status;	
				proxy_pass  http://appx;			
			}
		}
	}
}
```

For a deep dive in NGINX cache policies see this [article](https://serversforhackers.com/nginx-caching).

Now that we have configured NGINX, let's build the image and run the reverse proxy on port 80. If you have IIS installed, stop it before running the NGINX service.

Open PowerShell, navigate to the nginx directory and run the following commands:

```powershell
docker build -t nginx-img .
docker service create --name nginx --mode=global --network appx-net --publish 80:80 nginx-img
```

Note that I are creating the nginx service with the `global` flag so Docker Swarm can distribute one copy of a container to every node of a cluster.

In order to access the appx cluster we need to map the ***appx.local*** domain to localhost. Open the Windows ***hosts*** file and add this entry:

```
127.0.0.1 appx.local
127.0.0.1 www.appx.local
```

Flush the DNS cache and then you'll be able to access ***appx.local*** from your browser. On each request, NGNIX forwards the HTTP call to one of the app instances. Docker Swarm built-in load balancer will evenly distribute the requests between the three service instances. You can scale up or down the appx cluster as you wish. 

You can use the NGNIX service to act as reverse proxy for any number of apps running on your Docker Swarm. For each app that you want to expose on the Internet, add a new `server` entry to the nginx.conf and map the domain name and service name like we did with appx.

A working example of this configuration for multiple services is available on GitHub at [stefanprodan/aspnetcore-dockerswarm](https://github.com/stefanprodan/aspnetcore-dockerswarm).