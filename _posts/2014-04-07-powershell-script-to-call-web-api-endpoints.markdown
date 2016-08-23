---
title:  "Monitor ASP.NET Web API endpoints"
description: "A PowerShell script that calls Web API endpoints at regular times and sends error details to Windows Application Event Log."
date:   2014-04-07 12:00:00
categories: [Scripts]
tags: [PowerShell]
---

Calling ASP.NET Web API endpoints at regular intervals can be easily done using Windows Task Scheduler and PowerShell's Invoke-RestMethod. The following script makes a GET call for each supplied endpoint, if a call fails then the endpoint’s URL and the error details are sent to Windows Application Event Log.

```powershell
#Base url
$urlPrefix = "http://localhost/MyApp.Server/";

#Endpoints
$endpoints = @(
"api/status/ping", 
"api/alerts/check", 
"api/jobs/run"
);

$headers = @{"Client-Token"="my-app-client-secret-token"};

function Log([string] $url, $exception){
    #Create EventLog source if it doesn't exist
    $eventSource = "MyApp Job";
    if (![System.Diagnostics.EventLog]::SourceExists($eventSource)){
        New-Eventlog -LogName "Application" -Source $eventSource;
    }

    #Write warning to EventLog
    $message = "Call failed URL: " + $url + " Details: " + $exception;
    Write-EventLog -LogName "Application"`
     -Source $eventSource -EventId 1 -EntryType Warning -Message $message;
}

#Call each endpoint 
foreach ($endpoint in $endpoints) {
    Write-Output -InputObject $endpoint;

    try {
        $response = Invoke-RestMethod -Uri ($urlPrefix + $endpoint)`
         -method GET -ContentType "application/json" -Headers $headers;
        Write-Output -InputObject $response;
    }
    catch {
        Write-Output -InputObject $_.Exception.Response.StatusCode.Value__;
        Log -url ($urlPrefix + $endpoint) -exception $_.Exception.Message;      
    }
}
```

### Setup
Download [MonitorEndpoints.ps1](https://gist.github.com/stefanprodan/10017196) from GitHub Gist and open it with Windows PowerShell ISE, change the base URL, endpoints, headers and event source name to suite your needs. After you’ve tested the script, comment out the <code>Write-Output</code> lines and save the file.

Open Windows Task Scheduler and create a new task. Setup the task to run whatever the user is logged on or not with highest privileges.

Add a recursive trigger, I’ve set mine to repeat every minute indefinitely, one minute is the minimum value accepted by the Windows Scheduler.

Go to the Actions tab and add a new action: 

```
powershell -ExecutionPolicy Bypass -File "C:\Jobs\KeepAlive.ps1"
```

I find Windows Task Scheduler to be very easy to use and pretty useful combined with PowerShell scripting. You can export the task as xml and import it on the production server. The PowerShell file could be kept in a VS.NET solution on TFS or Git and published to the server using WebDeploy and MsBuild like an app, this way you can version you scripts and automate the deployment process.
