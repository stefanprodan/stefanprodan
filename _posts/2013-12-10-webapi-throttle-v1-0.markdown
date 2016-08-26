---
title:  "WebApiThrottle v1.0"
description: "First release of WebApiThrottle for ASP.NET Web API"
date:   2013-12-10 12:00:00
categories: [Open Source]
tags: [Rate limiting]
redirect_from:
  - /2013/12/asp-net-web-api-throttling-handler/
---

### [>> See the full documentation on WebApiThrottle repo](https://github.com/stefanprodan/WebApiThrottle)

ASP.NET Web API Throttling handler is designed to control the rate of requests that clients can make to a Web API based on IP address, client API key and request route. WebApiThrottle is compatible with Web API v2 and can be installed via NuGet, the package is available at [nuget.org/packages/WebApiThrottle](https://www.nuget.org/packages/WebApiThrottle/).

Web API throttling can be configured using the built-in ThrottlePolicy. You can set multiple limits for different scenarios like allowing an IP or Client to make a maximum number of calls per second, per minute, per hour or even per day. You can define these limits to address all requests made to an API or you can scope the limits to each API route. 

WebApiThrottle is open sourced and MIT licensed. The project is hosted on GitHub at [github.com/stefanprodan/WebApiThrottle](https://github.com/stefanprodan/WebApiThrottle), for questions regarding throttling or any problems you've encounter please submit an issue on GitHub.
