---
title:  "RequireJS.NET v2.1"
description: "Changelog and release notes"
date:   2015-01-05 12:00:00
categories: [Open Source]
tags: [RequireJS.NET]
---

### Change log

- added the ability to fully customize entry point resolution see [Overriding entry point path generation](https://github.com/vtfuture/RequireJSDotNet/wiki/Overriding-entry-point-path-generation)
- documentation and example clean-up and improvements
- fixed bug where an exception would be thrown when encountering a shim item with no dependencies
- auto compressor attempts to normalize module names in require definitions
* added configuration parser/mergers unit tests (xUnit)
* added tests for critical paths through ConfigMerger
* added support for module parser to process define(function) modules
* ConfigMerger now also merges OutputPath and IsVirtual of bundles
* ConfigMerger now overrides autobundle outputPath if a new one is set
* fixed ConfigMerger nullchecking of maps collection
* added support for .NET 4.0 and ASP.NET MVC v3 or newer
