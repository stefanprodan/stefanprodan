---
title:  "PostgreSQL base backup automation"
description: "A PowerShell module that automates PostgreSQL full cluster backups for Windows Server."
date:   2014-10-20 12:00:00
categories: [Scripts]
tags: [PostgreSQL]
---

PostgreSQL base backup tool (pg_basebackup) was introduced with v9.1 and is primary used for creating a ready to go standby replica. Since v9.3 pg_basebackup supports WAL segments streaming via the `-X stream` option. With `-X stream` on, pg_basebackup will open a second connection to the server and start streaming the transaction log in parallel with the cluster files. The resulting backup file contains all the needed data to start a fresh replica or to restore the main cluster to it's original state. Version 9.4, currently in beta, will further improve pg_basebackup by allowing you to relocate not only the data store but also any table spaces you might have.

If you are running PostgreSQL on Windows and you are looking for an automated way of doing full cluster backups then Backup-Postgres PowerShell script is a good starting point.

The [Backup-Postgres](https://gallery.technet.microsoft.com/PostgreSQL-base-backup-1f3a79a8) script does the following: 

* checks if there is enough free space to make a new backup based on the last backup size (works only with a local backup path)
* purges expired backups based on the supplied expire date
* creates a new folder for each backup inside the root backup directory (the root path can be defined as local or network share)
* calls pb_basebackup tool to begin a tar gzip backup of every table space, along with all required WAL segments (via "--xlog" option)
* writes any encountered errors to Windows Event Log
* writes backup elapsed time to Windows Event Log

### Configure PostgreSQL server

I'm assuming you have PostgreSQL version 9.3.x or newer installed on Windows Server 2012 or newer.

In order to make a base backup of the entire cluster using pg_basebackup tool you'll have to configure your server for streaming replication. PostgreSQL base backup uses the replication protocol to make a binary copy of the database cluster files and WAL segments without interfering with other connected clients. This kind of backup enables point-in-time recovery and can be used as a starting point for a streaming replication standby server.

***Enable streaming replication***

Open postgres.conf located (by default, on a 64-bit install) in C:\Program Files\PostgreSQL\9.3\data\ and make the following changes: 

```
wal_level = hot_standby
max_wal_senders = 3  
wal_keep_segments = 10
```

You should adjust the `wal_keep_segments` based on the amount of changes your server receives while in backup. By default, each WAL segment has 16MB, if you expect to have more than 160MB of changes in the time it will take to make the backup, then increase it.

***Create a dedicated backup user***

Open psql located in `C:\Program Files\PostgreSQL\9.3\bin\`, login as postgres and run the following command:

```sql
CREATE USER pgbackup REPLICATION LOGIN ENCRYPTED PASSWORD 'pgbackup-pass';
```

***Allow streaming replication connections from pgbackup on locahost***

Open `pg_hab.conf` located in `C:\Program Files\PostgreSQL\9.3\data\` and make the following changes:

```
host    replication    pgbackup    ::1/128    md5
```

### Configure Windows Server

Create a local Windows user named postgres. It doesn't need to have administrator rights, but it should have full access to the backup folder.
Log off from Windows and log in as postgres, navigate to `C:\Users\postgres\AppData\Roaming\` and create a folder named postgresql. Inside postgresql create a file named pgpass.conf with the following content:

```
localhost:5432:*:pgbackup:pgbackup-pass
```

The pg_basebackup tool will look for this file to fetch the password.
Open `Backup-Postgres.ps1` and modify the following variables to match your configuration:

```powershell
# path settings
$BackupRoot = 'C:\Database\Backup';
$BackupLabel = (Get-Date -Format 'yyyy-MM-dd_HHmmss');

# pg_basebackup settings
$PgBackupExe = 'C:\Program Files\PostgreSQL\9.3\bin\pg_basebackup.exe';
$PgUser = 'pgbackup';

# purge settings
$ExpireDate = (Get-Date).AddDays(-7);
```

Now it's time to schedule the backup, open Windows Task Scheduler and create a new task. Setup the task to run whatever the user is logged on or not with highest privileges, use the postgres user for this. Add a recursive trigger, I've set mine to repeat every day indefinitely. You should carefully chose the best time to start the backup and that's when the server is less used. You should specify in the settings tab the rule Do not start a new instance if the task is already running, this will prevent running multiple backups in parallel.
Go to the Actions tab and add a new action:

```
powershell -ExecutionPolicy Bypass -File "C:\Jobs\Backup-Postgres.ps1"
```

### Restore cluster from base backup

In order to restore a base backup with multiple table spaces, you'll have to extract each table space archive to it's original path. Since Windows doesn't have native support for tar.gz you can use the 7zip command line.
With 7zip you can extract a tar.gz archive without storing the intermediate tar file, 7zip can write to stdout and read from stdin using the following command:

```
7z x "base.tar.gz" -so | 7z x -aoa -si -ttar -o "C:\Program Files\PostgreSQL\9.3\data"
```

***Restore steps***

1) Stop Postgres server

2) Delete the data folder content and all table spaces content (if you have enough free space, you should make a backup copy of the current data and table spaces)

3) Run the 7zip command and extract each archive to its corresponding folder

4)  Create a recovery.conf file in data folder with the following content, specifying the postgres password.

```
standby_mode = 'on'
primary_conninfo = 'host=localhost port=5432 user=postgres password=PG-PASS'
```

5) Open `pg_hba.conf` file and comment all existing rules, this will prevent external clients from accessing the server while in recovery.

6) Start Postgres server. When Postgres starts it will process all WAL files and once recovery is finished the `recovery.conf` file gets renamed to `recovery.done`.

7) Restore `pg_hba.conf` to its original state and restart Postgres.

After getting used to the restore process you could automate it with PowerShell.




