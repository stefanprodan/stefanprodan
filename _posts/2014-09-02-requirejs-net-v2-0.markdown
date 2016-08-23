---
title:  "RequireJS.NET v2.0"
description: "Changelog and release notes"
date:   2014-09-02 12:00:00
categories: [Open Source]
tags: [RequireJS.NET]
---

It's been two years since my first attempt to integrate RequireJS with ASP.NET MVC. Being my first open-source project it was fun and challenging. Version 2.0, developed and maintained by [VeriTech](http://veritech.io), comes with new features and major improvements especially to the bundling component.

### Change log

* new [JSON config](https://github.com/vtfuture/RequireJSDotNet/wiki/Configuration-files) format compatible with require.js configuration object, the XML format from v1.x is deprecated
* passing values between ASP.NET and JavaScript done via a global filter ([RequireOptionFilter](https://github.com/vtfuture/RequireJSDotNet/wiki/Passing-values-between-ASP.NET-and-JavaScript)), the `RequireController` is no longer need and has been removed
* breaking changes in [RenderRequireJsSetup](https://github.com/vtfuture/RequireJSDotNet/wiki/Rendering-the-configuration-entrypoint) HTML helper, it takes a single argument of type ```RequireRendererConfiguration```
* auto bundling capabilities
* compressor and config parser refactoring
* export .resx files to JavaScript in i18n format (MsBuild task)
* project website with updated tutorials [requirejsnet.veritech.io](http://requirejsnet.veritech.io)
* up-to-date documentation [wiki](https://github.com/vtfuture/RequireJSDotNet/wiki/)
* various bug fixes

#### Upgrade from v1.x

If you are currently using RequireJS.NET v1.x be aware that v2 introduced [breaking changes](https://github.com/vtfuture/RequireJSDotNet/wiki/Changes), please follow the [upgrade guide](https://github.com/vtfuture/RequireJSDotNet/wiki/Upgrading-to-2.0).