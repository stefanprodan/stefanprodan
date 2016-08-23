---
title:  "WebApiThrottle v1.3"
description: "OWIN rate limiting middleware"
date:   2014-10-21 12:00:00
categories: [Open Source]
tags: [Rate limiting]
---

### OWIN Middleware

Introducing ThrottlingMiddleware, an OWIN middleware component that works the same as the ThrottlingHandler. With the ThrottlingMiddleware you can target endpoints outside of the WebAPI area, like OAuth middleware or SignalR endpoints.

Configuration example:

``` cs
public class Startup
{
    public void Configuration(IAppBuilder appBuilder)
    {

    //throtting middleware with policy loaded from config
    appBuilder.Use(typeof(ThrottlingMiddleware),
        ThrottlePolicy.FromStore(new PolicyConfigurationProvider()),
        new PolicyCacheRepository(),
        new CacheRepository(),
        null);

    }
}
```

More examples [here](https://github.com/stefanprodan/WebApiThrottle#rate-limiting-with-throttlingmiddleware)


