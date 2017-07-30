---
title:  "Continuous integration with Jenkins and disposable containers"
description: "A Jenkins CI Server Docker image suitable for running CD workflows inside disposable containers"
date:   2016-09-22 12:00:00
categories: [Guides]
tags: [Jenkins,Docker]
---

This article shows how you can use a Jenkins CI Server running in a Docker container, to do continuous integration and treat build environments as on-demand and disposable entities. Say goodbye to dedicated VMs for each build environment. Using containers as building blocks helps you recreate dev, test, QA and production environments in a deployment pipeline with just a few lines of code.  

![Jenkins CI disposable containers]({{ "assets/jenkins-disposable-dontainers.png" | relative_url }})


### Jenkins Docker image

The [stefanprodan/jenkins](https://hub.docker.com/r/stefanprodan/jenkins/) is a Jenkins CI Server image suitable for running CD work-flows inside disposable containers using Jenkins Docker Pipeline and the Docker daemon present on the host system. Note that this is not a "Docker in Docker" Jenkins setup. This image requires the Docker socket to be mounted inside the Jenkins container. All the Docker commands issued by the Jenkins Docker Pipeline will be executed on the host system. This image also has Ansible installed, to facilitate container orchestration over SSH.

The image is based on the official Jenkins image. Each time the official image is updated, Docker Hub will automatically trigger a rebuild of [stefanprodan/jenkins](https://hub.docker.com/r/stefanprodan/jenkins/) image. 

### Running the Jenkins container

First, you will need to set up persistent storage for Jenkins and the Ansible inventory. You will need a directory for each on the host, and you will need to give the `jenkins` user (UID 1000) ownership of both.

For Jenkins:

```bash
JENKINS_HOME=/home/$(whoami)/jenkins_home
mkdir $JENKINS_HOME
chown -R 1000 $JENKINS_HOME
```

For Ansible:

```bash
ANSIBLE_INVENTORY=/home/$(whoami)/ansible
mkdir $ANSIBLE_INVENTORY
chown -R 1000 $ANSIBLE_INVENTORY
```

Run Jenkins container by mounting the Docker socket, jenkins_home and ansible directory:

```
docker run -d --name jenkins \ 
	-p 8080:8080 -p 50000:50000 \ 
	-v /var/run/docker.sock:/var/run/docker.sock \ 
	-v /home/$(whoami)/jenkins_home:/var/jenkins_home \ 
	-v /home/$(whoami)/ansible:/etc/ansible \ 
	stefanprodan/jenkins
```

If the host system has an older Docker engine version, you have to specify the host Docker API version in Jenkins run command:

```
docker run -d --name jenkins \ 
	-e DOCKER_API_VERSION='1.21' \
	-p 8080:8080 -p 50000:50000 \ 
	-v /var/run/docker.sock:/var/run/docker.sock \ 
	-v /home/$(whoami)/jenkins_home:/var/jenkins_home \ 
	-v /home/$(whoami)/ansible:/etc/ansible \ 
	stefanprodan/jenkins
```

After starting the container, you can access Jenkins at `http://localhost:8080`. Look in the logs for the admin password that Jenkins is generating on first run:

```
docker logs jenkins
```

After you log in, chose ***Select plugins to install*** and uncheck all.

These are the pre-installed plugins in the Jenkins image:

* Ant
* Ansible
* Build Timeout
* GitHub
* Gradle
* Pipeline
* Purge Job History
* CloudBees Docker Pipeline
* Credentials Binding
* Simple Theme Plugin
* SSH Agent
* SSH Slaves
* Timestamper
* Workspace Cleanup
* Xunit

### CI with disposable containers showcase

Create a new item and chose ***Pipeline*** as your build template. Go to ***configure*** and in the ***Pipeline*** section, use the following groovy script:

```groovy
node {
	stage('aspnetcore'){
		def dotnet = docker.image('microsoft/aspnetcore-build')
		dotnet.inside('-u root') {
			sh("dotnet --version")
			sh("bower --version")
			sh("gulp --version")
		}
	}
	stage('nodejs'){
		def nodejs = docker.image('node')
		nodejs.inside {
			sh("node --version")
		}
	}
	stage('golang'){
		def golang = docker.image('golang')
		golang.inside {
			sh("go version")
		}
	}
	stage('ansible'){
		sh("ansible --version")
	}
	stage('docker'){
		sh """
		docker info
		docker images
		"""
	}
}
``` 

The above pipeline shows how you can run three different build environments (aspnetcore, nodejs and golang) without installing any dependency on your build server. 
At each stage, Jenkins pulls the specified build environment, runs the build tools, then disposes the containers. The build artifacts are persisted on the Jenkins workspace so you can use them in other stages of your CD workflow. 

The Dockerfile is available on GitHub at [stefanprodan/jenkins](https://github.com/stefanprodan/jenkins). Contributions are more than welcome!