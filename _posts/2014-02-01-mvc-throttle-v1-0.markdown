---
title:  "MvcThrottle  v1.0"
description: "First release of MvcThrottle  for ASP.NET MVC"
date:   2014-02-01 12:00:00
categories: [Open Source]
tags: [Rate limiting]
redirect_from:
  - /2014/02/introducing-asp-net-mvc-throttling-filter/
---

### [>> See the full documentation on MvcThrottle repo](https://github.com/stefanprodan/MvcThrottle)

With MvcThrottle you can protect your site from aggressive crawlers, scraping tools or unwanted traffic spikes originated from the same location by limiting the rate of requests that a client from the same IP can make to your site or to specific routes. MvcThrottle is compatible with ASP.NET MVC 5.1 and can be installed via NuGet, the package is available at [nuget.org/packages/MvcThrottle](https://www.nuget.org/packages/MvcThrottle/).

You can set multiple limits for different scenarios like allowing an IP to make a maximum number of calls per second, per minute, per hour or per day. You can define these limits to address all requests made to your website or you can scope the limits to each Controller, Action or URL, with or without query string params.

WebApiThrottle is open sourced and MIT licensed. The project is hosted on GitHub at [github.com/stefanprodan/MvcThrottle](https://github.com/stefanprodan/MvcThrottle), for questions regarding throttling or any problems you've encounter please submit an issue on GitHub.
