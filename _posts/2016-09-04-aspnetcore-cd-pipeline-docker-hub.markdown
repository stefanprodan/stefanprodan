---
title:  "ASP.NET Core continuous deployment with Docker Hub"
description: "Building a CD pipeline for ASP.NET Core apps with GitHub, AppVeyor and Docker hub"
date:   2016-09-04 12:00:00
categories: [Guides]
tags: [.NET Core, Docker]
---

I'm working on an open source project, an ASP.NET Core app that monitors docker server activity. Since [dockerdash](https://github.com/stefanprodan/dockerdash) needs to run in a container, I have to deliver it as a docker [image](https://hub.docker.com/r/stefanprodan/dockerdash/) on Docker Hub.

I was looking for a way to automate the deployment process in such a manner that my app would be built, tested and released to Docker Hub on every commit. 
Docker Hub can [build images automatically](https://docs.docker.com/docker-hub/builds/) from a GitHub repository as long as the repo contains a Dockerfile. An ASP.NET Core app can be [built inside a docker container](https://docs.microsoft.com/en-us/dotnet/articles/core/docker/building-net-docker-images), so getting it to Docker Hub can be very easy. 

The problem with this approach is that the dotnet onbuild image is very large, it's over 500MB. For deployment, there is a different image available, that contains only the .NET Core (runtime and libraries) and it's optimized for running portable .NET Core applications. Using the runtime image would require the code to be compiled and the compiled output to be copied inside the image. 

Docker Hub can't compile your app outside of a container, for that you need a build server. You can use AppVeyor build server, it has a free subscription plan for open source project and it can build, test and deploy .NET Core apps. But you can't build and push a docker image with AppVeyor, only .net code. My solution is to get the build artifacts out of AppVeyor and back on GitHub on a different branch using AppVeyor git push. Docker Hub will detect a commit on that branch, where the artifacts are, and use them to build the image.

![CD Pipeline]({{ "assets/aspnetcore-cd-dockerhub.png" | relative_url }})

***Continuous deployment pipeline:***

* You commit changes to master branch
* AppVeyor automatically pulls the master branch
* AppVeyor executes the build script
* The build script invokes `dotnet restore`
* The build script invokes `dotnet build`
* The build script invokes `dotnet test`
* The build script invokes `dotnet publish`
* AppVeyor commits changes(dotnet publish output) to local branch
* AppVeyor pushes the commit to the release branch
* Docker Hub automatically pulls the release branch
* Docker Hub builds the image using the Dockerfile
* Docker Hub publishes the image under the `latest` tag 

***AppVeyor build script example:***

```powershell
function EnsurePsbuildInstalled{
    [cmdletbinding()]
    param(
        [string]$psbuildInstallUri = 'https://raw.githubusercontent.com/ligershark/psbuild/master/src/GetPSBuild.ps1'
    )
    process{
        if(-not (Get-Command "Invoke-MsBuild" -errorAction SilentlyContinue)){
            'Installing psbuild from [{0}]' -f $psbuildInstallUri | Write-Verbose
            (new-object Net.WebClient).DownloadString($psbuildInstallUri) | iex
        }
        else{
            'psbuild already loaded, skipping download' | Write-Verbose
        }

        # make sure it's loaded and throw if not
        if(-not (Get-Command "Invoke-MsBuild" -errorAction SilentlyContinue)){
            throw ('Unable to install/load psbuild from [{0}]' -f $psbuildInstallUri)
        }
    }
}

function Exec
{
    [CmdletBinding()]
    param(
        [Parameter(Position=0,Mandatory=1)][scriptblock]$cmd,
        [Parameter(Position=1,Mandatory=0)][string]$errorMessage = ($msgs.error_bad_command -f $cmd)
    )
    & $cmd
    if ($lastexitcode -ne 0) {
        throw ("Exec: " + $errorMessage)
    }
}

if(Test-Path .\release) { Remove-Item .\release -Force -Recurse }

EnsurePsbuildInstalled

exec { & dotnet restore }

Invoke-MSBuild

$revision = @{ $true = $env:APPVEYOR_BUILD_NUMBER; $false = 1 }[$env:APPVEYOR_BUILD_NUMBER -ne $NULL];
$revision = "{0:D4}" -f [convert]::ToInt32($revision, 10)

exec { & dotnet restore .\src\APP }
exec { & dotnet test .\src\APP.TESTS }
exec { & dotnet build .\src\APP }

$release = Join-Path $pwd release
exec { & dotnet publish .\src\APP -c Release -o $release --version-suffix=$revision}

```

Replace `APP` with your app name. For more details on the build script you can check [jbogard/MediatR repo](https://github.com/jbogard/MediatR).

***AppVeyor config file example:***

```yaml
version: '{build}'
pull_requests:
  do_not_increment_build_number: true
branches:
  only:
  - master
nuget:
  disable_publish_on_pr: true
build_script:
- ps: .\Build.ps1
test: off
environment:
  access_token:
    secure: UdsFh1+gLuPPgH0byZBBxH7Ue6tILfmpflXwZJ0ZZu0XeQ2dANyLeN/fWWpKVcOy
  git_email:
    secure: nq2fO/Zi7xCmkD38qvSMsjT/f/Hqpb87wx9Ci4VIjmA=
on_success:
  - git config --global credential.helper store
  - ps: Add-Content "$env:USERPROFILE\.git-credentials" "https://$($env:access_token):x-oauth-basic@github.com`n"
  - git config --global user.email "$($env:git_email)"
  - git config --global user.name "Your name"
  - git config --global core.autocrlf true
  - git checkout master
  - git add .
  - git commit -m "ci deploy"
  - git status
  - git push origin master:release -f
```

Replace `access_token`, `git_email` and `user.name` with your values. You can check the AppVeyor tutorial on [pushing to remote Git repository from a build](https://www.appveyor.com/docs/how-to/git-push/) for more details. 

***Dockerfile example:***

```
FROM microsoft/aspnetcore:1.0.1

# Set ASP.NET Core environment variables
ENV ASPNETCORE_URLS="http://*:5000"
ENV ASPNETCORE_ENVIRONMENT="Production"

# Copy files to app directory
COPY /release /app

# Set working directory
WORKDIR /app

# Open port
EXPOSE 5000/tcp

# Run
ENTRYPOINT ["dotnet", "APP.dll"]
```

Replace `APP` with your app name. 

***Docker Hub build settings example:***

![CD Pipeline]({{ "assets/dockerdash-hub-settings.png" | relative_url }})

A working example of this CD pipeline is available on GitHub at [stefanprodan/dockerdash](https://github.com/stefanprodan/dockerdash).