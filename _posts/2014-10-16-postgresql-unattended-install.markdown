---
title:  "PostgreSQL unattended install"
description: "A PowerShell module that automates PostgreSQL unattended install and configuration for Windows Server."
date:   2014-10-16 12:00:00
categories: [Scripts]
tags: [PostgreSQL]
---

I often find myself in the situation where I need to install and configure PostgreSQL on a new VM running Windows. Because repetitive tasks are annoying and error prone, I've decided to automate this process as much as I can using PowerShell.

The [Install-PostgreSQL](https://gallery.technet.microsoft.com/PostgreSQL-unattended-059a76c8) PowerShell module does the following: 

* creates a local windows user that PostgreSQL will use (called postgres by default)
* the password use for the creation of this account will be the same as the one used for PostgreSQL's postgres superuser account
* creates postgres user profile
* downloads the PostgreSQL installer provided by EnterpriseDB
* installs PostgreSQL unattended using the supplied parameters
* sets the postgres windows user as the owner of any PostgreSQL files and folders
* sets PostgreSQL windows service to run under the postgres local user
* creates the pgpass.conf file in AppData
* copies configuration files to data directory
* opens the supplied port that PostgreSQL will use in the Windows Firewall

### Usage

On the machine you want to install PostgreSQL, download [Install-Postgres.zip](https://gallery.technet.microsoft.com/PostgreSQL-unattended-059a76c8) file and extract it to the PowerShell Modules directory, usually located under `Documents\WindowsPowerShell`.
Open PowerShell as Administrator and run `Import-Module Install-Postgres`. Before running the unattended install you should customize the PostgreSQL configuration files located in `Install-Postgres\Config` directory.
You can also add a `recovery.conf` file if you plan to use this PostgreSQL cluster as a standby slave. All conf files located in `Install-Postgres\Config` will be copied to the PostgreSQL data directory once the server is installed.

Install PostgreSQL with defaults:

```powershell
Import-Module Install-Postgres
Install-Postgres -User "postgres" -Password "ChangeMe!"
```

Install PostgreSQL full example: 

```powershell
Install-Postgres  
-User "postgres"  
-Password "ChangeMe!"  
-InstallUrl "http://get.enterprisedb.com/postgresql/postgresql-9.3.5-1-windows-x64.exe"  
-InstallPath "C:\Program Files\PostgreSQL\9.3"  
-DataPath "C:\Program Files\PostgreSQL\9.3\data"  
-Locale "Romanian, Romania"  
-Port 5432  
-ServiceName "postgresql"
```

