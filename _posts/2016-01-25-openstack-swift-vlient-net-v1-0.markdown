---
title:  "SwiftClient v1.0"
description: "First release of OpenStack Swift client for DNXCore 5.0"
date:   2016-01-20 12:00:00
categories: [Open Source]
tags: [OpenStack Swift]
redirect_from:
  - /2016/01/openstack-swift-client-for-net-core-and-asp-net-5/
---

Veritech Solutions is happy to announce [SwiftClient](https://github.com/vtfuture/SwiftClient), an open-source .NET client for OpenStack Swift that covers most of the Swift API, handles authentication and large object streaming.

It can be installed via NuGet from [nuget.org/packages/SwiftClient](https://www.nuget.org/packages/SwiftClient/) and it's compatible with .NET Framework 4.5, DNX 4.5.1 and DNXCore 5.0.

Besides the Swift .NET client, the project contains an ASP.NET 5 demo and a cross-platform console application suitable for bulk upload of an entire directory tree and large object operations. Our build process runs on Ubuntu and Windows, testing is done against a Swift docker container before each publish on NuGet.

Any contributions are welcomed, fell free to open an issue on our [GitHub repository](https://github.com/vtfuture/SwiftClient) to get in contact with us.

### Achieve high availability and scalability with OpenStack Swift and SwiftClient

OpenStack Swift is an eventually consistent storage system designed to scale horizontally without any single point of failure. All objects are stored with multiple copies and are replicated across zones and regions making Swift  withstand failures in storage and network hardware. Swift can be used as a stand-alone distributed storage system on top of Linux without the need of expensive hardware solutions like NAS or SAN. 
Data is stored and served directly over HTTP making Swift the ideal solution when dealing with applications running in Docker containers.

Lets assume you have an ASP.NET 5 MVC app that needs to manage documents, photos and video files uploaded by users. In order for your application to achieve HA and scalability you can host the app inside a container and launch a minimum of two containers with a load balancer in front. Now days this can be easily done with Docker and Nginx on Ubuntu Server.

The same architecture can be applied to the storage with Swift. You'll need to set up a minimum of two swift servers, each containing a proxy and a storage node. Ideally these servers or VMs should be hosted in different regions/datacenters. Adding both swift proxy endpoints to SwfitClient config will ensure that any app instance will share the same storage and if a swift node becomes unreachable due to a restart or network failure all app instances will silently fail-over to the 2nd node.

![Swift Cluster]({{ "assets/swift-cluster.png" | relative_url }})

You can read more on OpenStack Swift architecture on our [wiki](https://github.com/vtfuture/SwiftClient/wiki).