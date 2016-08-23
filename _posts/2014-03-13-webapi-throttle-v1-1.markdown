---
title:  "WebApiThrottle v1.1"
description: "Changelog and release notes"
date:   2014-03-13 12:00:00
categories: [Open Source]
tags: [Rate limiting]
---

### Features
* self-hosting OWIN support added - [demo project](https://github.com/stefanprodan/WebApiThrottle/tree/master/WebApiThrottler.SelfHostOwinDemo)
* throttler policy can be defined in web.config
* added `IThrottlePolicyProvider` interface that allows loading at app startup the policy rules and settings from a persistent store like a database

### Requirements 
Version 1.1 is compatible with .NET 4.5.x and has the following dependencies:
* Microsoft.AspNet.WebApi (≥ 5.0.0)
* Microsoft.Owin (≥ 2.0.0)
* Newtonsoft.Json (≥ 4.5.11)

To avoid version conflicts redirect bindings for Owin and System.Web.Http in config.

