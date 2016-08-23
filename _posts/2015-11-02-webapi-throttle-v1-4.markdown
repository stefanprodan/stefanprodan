---
title:  "WebApiThrottle v1.4"
description: "Changelog and release notes"
date:   2015-11-02 12:00:00
categories: [Open Source]
tags: [Rate limiting]
---

### Change log

* Added the ability to resolve IP addresses based on custom logic, this allows scenario's such as extracting client's IP from akamai headers
* Demo and readme update to include CustomIpAddressParser
* Use HashAlgorithm.Create(string) so that .NET loads FIPS-compliant hash algorithms if available on the local machine
* Added QuotaExceededContent for object/json responses
* Added support for json responses
* Microsoft.AspNet.WebApi and Microsoft.AspNet.WebApi.WebHost dependencies removed
* Update Microsoft.AspNet.WebApi.Core dependency to 5.2.3
* Update Microsoft.Owin dependency to 3.0.1
* Fix white-list loading from config files

***NuGet dependencies graph***

![dependencies](https://cloud.githubusercontent.com/assets/3797675/6398966/27e0d99a-bdf8-11e4-8ea1-e74e794d1880.png)


