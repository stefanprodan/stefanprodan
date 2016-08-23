---
title:  "WebApiThrottle v1.2"
description: "Changelog and release notes"
date:   2014-05-11 12:00:00
categories: [Open Source]
tags: [Rate limiting]
---
### Features

* Update rate limits at runtime with `PolicyCacheRepository` and `ThrottleManage` - [documentation]
(https://github.com/stefanprodan/WebApiThrottle/blob/master/README.md#update-rate-limits-at-runtime)
* New interface `IPolicyRepository` used for for storing and retrieving of policy data (global limits, clients rate limits and white-lists) - [documentation](https://github.com/stefanprodan/WebApiThrottle/blob/master/README.md#storing-throttle-metrics)
* New helper class `ThrottleManager` used for customizing the cache keys with prefix/suffix and for policy cache refresh
* Attribute-based rate limiting with `ThrottlingFilter` and `EnableThrottlingAttribute` - [documentation] (https://github.com/stefanprodan/WebApiThrottle/blob/master/README.md#attribute-based-rate-limiting-with-throttlingfilter-and-enablethrottlingattribute)

### Upgrade from older versions
There are no breaking changes in v1.2, you can safely update via [NuGet](https://www.nuget.org/packages/WebApiThrottle/).

If you want to use the rate limits update feature, you'll need to change the `ThrottlingHandler` initialization code and use the new constructor `ThrottlingHandler(ThrottlePolicy policy, IPolicyRepository policyRepository, IThrottleRepository repository, IThrottleLogger logger)`.

**Register message handler** (IIS hosting)

```cs
config.MessageHandlers.Add(new ThrottlingHandler(
    policy: new ThrottlePolicy(perSecond: 1, perMinute: 20, perHour: 100, perDay: 1500)
    {
        IpThrottling = true,
        ClientThrottling = true,
        EndpointThrottling = true
    },
    policyRepository: new PolicyCacheRepository(),
    repository: new CacheRepository(),
    logger: null));
```
**Register action filter with rate limits loaded from app.config** (IIS hosting)

```cs
config.Filters.Add(new ThrottlingFilter(
    policy: ThrottlePolicy.FromStore(new PolicyConfigurationProvider()),
    policyRepository: new PolicyCacheRepository(),
    repository: new CacheRepository(),
    logger: null));
```

**Update policy from code** (IIS hosting)

``` cs
    //init policy repo
    var policyRepository = new PolicyCacheRepository();

    //get policy object from cache
    var policy = policyRepository.FirstOrDefault(ThrottleManager.GetPolicyKey());

    //update client rate limits
    policy.ClientRules["api-client-key-1"] =
        new RateLimits { PerMinute = 80, PerHour = 800 };

    //add new client rate limits
    policy.ClientRules.Add("api-client-key-3",
        new RateLimits { PerMinute = 60, PerHour = 600 });

    //apply policy updates
    ThrottleManager.UpdatePolicy(policy, policyRepository);
```

**Register message handler with rate limits loaded from app.config** (Owin self-hosting)

```cs
config.MessageHandlers.Add(new ThrottlingHandler(
    policy: ThrottlePolicy.FromStore(new PolicyConfigurationProvider()),
    policyRepository: new PolicyMemoryCacheRepository(),
    repository: new MemoryCacheRepository(),
    logger: null));
```


