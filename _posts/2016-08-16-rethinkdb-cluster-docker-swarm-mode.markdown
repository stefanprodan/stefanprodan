---
title:  "Setting up a RethinkDB Cluster on Docker Swarm Mode"
description: "Step by step guide for Docker on Windows"
date:   2016-08-16 12:00:00
categories: [Guides]
tags: [RethinkDB, Docker]
---

First we need to enable Swarm Mode and create a dedicated network for our RethinkDB cluster:

```powershell
# initialize swarm
docker swarm init

# create RethinkDB overlay network
docker network create --driver overlay rdb-net
```

We start building our RethinkDB cluster by running a single RethinkDB server, we will remove this instance later on:

```powershell
# create and start rethinkdb primary 
docker service create --name rdb-primary --network rdb-net --replicas 1 rethinkdb:latest rethinkdb --bind all --no-http-admin
```

Now we can create a secondary RethinkDB node that will join the `rdb-primary` node and form a cluster:

```powershell
# create and start rethinkdb secondary
docker service create --name rdb-secondary --network rdb-net --replicas 1 rethinkdb:latest rethinkdb --bind all --no-http-admin --join rdb-primary
```

Scale the secondary node so we can have a minimum of 3 nodes needed for RethinkDB automatic fail-over mechanism:

```powershell
# up 3 nodes (primary + two secondary) to enable automatic failover
docker service scale rdb-secondary=2
```

We now have a functional RethinkDB cluster, but we are not done yet. 
Because we started the primary node without a join command, our cluster has a single point of failure.
If for some reason `rdb-primary` container crashes, the Docker Swarm engine will recreate and start this container, but he can't join the existing cluster. If we start new `rdb-secondary` instances, they will join the new `rdb-primary` container and form another cluster.

To resolve this issue we have to remove the `rdb-primary` service and recreate it with the `join` command like so:

```powershell
# remove primary
docker service rm rdb-primary

# recreate primary with --join flag
docker service create --name rdb-primary --network rdb-net --replicas 1 rethinkdb:latest rethinkdb --bind all --no-http-admin --join rdb-secondary
```

Now we can also scale the primary node:

```powershell
# start two rdb-primary instances
docker service scale rdb-primary=2
```

At this point we have 4 nodes in our cluster, two `rdb-primary` and two `rdb-secondary`. We can further scale any of these two services and they will all join our cluster. If a `rdb-primary` or `rdb-secondary` instance crashes, the Docker Swarm will automatically start another container that will join our current cluster.

Last step is to create a RethinkDB proxy node, we expose port 8080 for the web admin and port 28015 so we can connect to the cluster from our app:

```powershell
# create and start rethinkdb proxy 
docker service create --name rdb-proxy --network rdb-net --publish 8080:8080 --publish 28015:28015 rethinkdb:latest rethinkdb proxy --bind all --join rdb-primary
```

Open a browser and navigate to `http://localhost:8080` to check the cluster state. In the servers page you should see 4 servers connected to the cluster.

if we run `docker service ls` we should get:

```
ID            NAME           REPLICAS  IMAGE             
157bd7yg7d60  rdb-secondary  2/2       rethinkdb:latest  
41eloiad4jgp  rdb-primary    2/2       rethinkdb:latest  
67oci5m1wksi  rdb-proxy      1/1       rethinkdb:latest 
```

I've compiled all the above commands into a Powershell script that runs the RethinkDB cluster on Docker for Windows. Here is the script:

**rethinkdb-swarm-up.ps1**

```powershell
# create and start rethinkdb primary 
docker service create --name rdb-primary --network rdb-net rethinkdb:latest rethinkdb --bind all --no-http-admin

Start-Sleep -s 5

# create and start rethinkdb secondary
docker service create --name rdb-secondary --network rdb-net rethinkdb:latest rethinkdb --bind all --no-http-admin --join rdb-primary

Start-Sleep -s 5

# up 3 nodes (primary + 2 secondary) to enable automatic failover
docker service scale rdb-secondary=2

Start-Sleep -s 5

# remove primary
docker service rm rdb-primary

# recreate primary with --join flag
docker service create --name rdb-primary --network rdb-net rethinkdb:latest rethinkdb --bind all --no-http-admin --join rdb-secondary

Start-Sleep -s 5

# start 2 rdb-primary instances
docker service scale rdb-primary=2

Start-Sleep -s 5

# create and start rethinkdb proxy 
docker service create --name rdb-proxy --network rdb-net --publish 8080:8080 --publish 28015:28015 rethinkdb:latest rethinkdb proxy --bind all --join rdb-primary
```

And the tear down script:

```powershell
docker service rm rdb-proxy
docker service rm rdb-primary
docker service rm rdb-secondary
```


Source code and documentation can be found in github.com/stefanprodan/aspnetcore-dockerswarm [repository](https://github.com/stefanprodan/aspnetcore-dockerswarm/).
