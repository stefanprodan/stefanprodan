---
title:  "Blazing fast free blog hosting powered by Jekyll, GitHub Pages and CloudFlare"
description: "Build a blog on Windows with Jekyll, host it for free on GitHub Pages with DNS and SSL from CloudFlare"
date:   2016-08-24 12:00:00
categories: [Guides]
tags: [Jekyll]
---

Jekyll is one of the best static site generator out there. Along with GitHub pages, it offers the best hosting solutions for personal blogs and it's 100% free. 

Jekyll and GitHub pages have lots of advantages over a classic CMS solution like Wordpress. Your blog being a complete static website it's lightning fast and you don't have to deal with security updates, database optimizations, caching plugins and so on. 

All you need to do, to publish a new blog post, is to create a Markdown file and commit it to your free GitHub repo. Say goodbye to WYSIWYG editors, you can write and preview your blog post with Visual Studio Code or any other Markdown editors. If you like traditional CMS-style UI you can use [Jekyll admin plugin](https://jekyll.github.io/jekyll-admin/) to author content and administer Jekyll sites. 

Jekyll is not officially-supported on Windows but recently one of the main components of `github-pages` gem has been improved and runs smoothly on Windows 10.

### Install Jekyll on Windows 10 x64

First you need to download the latest version of Ruby and Ruby DevKit from [rubyinstaller.org](http://rubyinstaller.org/downloads/).

* install Ruby x64 to `C:\Ruby` (check “Add Ruby executables to your PATH”)
* extract Ruby DevKit x64 to `C:\RubyDevKit`
* open PowerShell as Administrator and run the following script:

```powershell
cd C:\RubyDevKit

# initialize DevKit
ruby dk.rb init

# bind DevKit to Ruby installation
ruby dk.rb install
```

* install Jekyll prerequisites:

```powershell
gem install bundler
gem install wdm
gem install nokogiri
```

Note that ***Nokogiri*** version must be ***v1.6.8*** or newer, older versions weren't fully compatible with Windows 10.

* install GitHub pages:

```powershell
gem install github-pages
```

### Setup your blog repository 

Go to GitHub and create a public repository named `blog`, then clone it on your PC. Download a theme from [Jekyll Themes website](http://jekyllthemes.org/) and extract it in your blog local repository.

Look for a file named `Gemfile.lock`, it should be in the root folder. You have to delete this file because most themes are made before `nokogiri` v1.6.8 release and it will crash your Jekyll build.

Open the `_config.yml` file and add this line to it:

```yaml
encoding: utf-8
```

Open PowerShell as Administrator and `cd` into your blog folder. First you need to install the gems required by the theme, in order to do that run the following command:

```powershell
bundle install
```

A new `Gemfile.lock` will be generated in the root folder. Now you can start Jekyll built-in web server to run your blog:

```powershell
jekyll serve
```

Navigate to `http://127.0.0.1:4000/` with your favorite browser to see your new blog. 
You can start adding pages and customize the theme, Jekyll will detect any modification and rebuild the site automatically.

### Setup hosting

After you are done customizing the theme and you've added your first blog post, commit the modification to the master branch. 
On GitHub, go to your repository settings and select the master branch as the source of the ***GitHub Pages***. Your blog will be published to `http://username.github.io/blog`.

I presume you have a custom domain for your blog. First set [CloudFlare](https://cloudflare.com) as your DNS provider. 
Go to ***DNS settings*** page on CloudFlare and add two CNAME records:

```
CNAME your_blog.com your_username.github.io
CNAME wwww your_username.github.io
```

Create a `CNAME` file in your blog repository and add your blog domain to it:

```
your_blog.com
```

Commit the file to master branch and then you will be able to access your blog using your custom domain.

As a final step, you could setup a free SSL certificate for your domain. Go to ***Crypto*** page on CloudFlare and select  ***Flexible*** from the SSL options. After your certificate has been issued you can force your domain to always redirect to the HTTPS version. Go to ***Page Rules*** page on CloudFlare and create a new rule. In the ***URL matches*** field add this pattern `http://*your_blog.com/*` and from the rules drop-down select ***Always Use HTTPS***.

That's it, you now have a blazing fast blog on HTTPS with HTTP/2 support, backed up by a global CDN without any costs. Not many hosting companies can offer that and definitely not for free.
 

 
 
