---
title:  "RequireJS.NET v2.1"
description: "Changelog and release notes"
date:   2016-07-19 12:00:00
categories: [Open Source]
tags: [RequireJS.NET]
---

### New in RequireJS.NET v2.2

- All packages now target .NET 4.5 only, dependencies updated to Json 9.0 and MVC 5.2
- Compressor fixes and improvements see pull request [#72](https://github.com/vtfuture/RequireJSDotNet/pull/72) introduces breaking changes
- Compressor relative file paths fix see pull request [#62](https://github.com/vtfuture/RequireJSDotNet/pull/62)
- Compressor dir aliases support see pull request [#59](https://github.com/vtfuture/RequireJSDotNet/pull/59)
- RequireJS EntryPointResolver controller path formats and areas into arrays see pull request [#69](https://github.com/vtfuture/RequireJSDotNet/pull/69)
- RequireJS configuration caching, see example [here](http://requirejsnet.veritech.io/setup.html#render)
- up-to-date documentation [requirejsnet.veritech.io](http://requirejsnet.veritech.io)

### Upgrade from Compressor v2.1.x

- The Compressor package is a now tool package and the dll is no longer referenced in project 
- [RequireJsNet.Compressor.targets](https://github.com/vtfuture/RequireJSDotNet/blob/master/RequireJsNet.Compressor/RequireJsNet.Compressor.targets) is automatically included into the cproj file, `RequireJs.json` files are now processed on build by default
- Compressor 2.0.x build task must be update with the new path `AssemblyFile="...\packages\RequireJsNet.Compressor.2.2.3\tools\RequireJsNet.Compressor.dll"`
- for more details on how to configure Compressor 2.2 in Visual Studio and on a build server see [requirejsnet.veritech.io/compressor](http://requirejsnet.veritech.io/compressor.html)
