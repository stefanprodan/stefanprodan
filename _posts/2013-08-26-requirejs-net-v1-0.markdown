---
title:  "RequireJS.NET v1.0"
description: "First release of RequireJS for ASP.NET MVC"
date:   2013-08-26 12:00:00
categories: [Open Source]
tags: [RequireJS.NET]
redirect_from:
  - /2012/09/intro-requirejs-for-asp-net-mvc/
  - /2013/08/setup-requirejs-for-asp-net-mvc-using-nuget/
  - /2012/09/ajax-polling-with-amplify-and-requirejs-for-asp-net-mvc/
  - /requirejs-for-asp-net-mvc/
---

### [>> See the full documentation on RequireJS.NET website](http://requirejsnet.veritech.io/)

Writing modular JavaScript is the first step in bringing the front-end development closer to the server-side OOP, for a C# programmer, the Module Pattern applied to JavaScript means that you can emulate the .NET class behavior by having public/private members and methods. With RequireJS you can go even further, by declaring a module you can specify dependencies to other modules, the same way as you do in a .NET project when you add references to other .NET components. Before a module is loaded by the browser, RequireJS will look for the dependencies required by that module to function, it will fetch asynchronously from the server, all the other modules needed and then will let the browser execute your module code. RequireJS.NET helps you structure the JavaScript code in such a manner that any C# programmer can understand and use it without advanced JS programming skills.

Advantages of using RequireJS with ASP.NET MVC:

* better JavaScript code re-usability
* reliable object and dependency management
* suitable for large and complex applications
* loads JavaScript files asynchronously

The .NET implementation has the following features:

* JavaScript file structure integrated with the MVC structure
* dependencies declaration and module path configuration using JSON or XML
* JavaScript code-behind for each Razor view
* Passing values between ASP.NET and JavaScript

RequireJS.NET is an open source project released under the terms of the MIT and GPL licenses. 

Source code and documentation are available on [GitHub](https://github.com/vtfuture/RequireJSDotNet/).
