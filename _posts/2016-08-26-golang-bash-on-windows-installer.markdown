---
title:  "Go installer for Bash on Windows"
description: "Go lang install script for Bash on Ubuntu on Windows"
date:   2016-08-26 12:00:00
categories: [Scripts]
tags: [GoLang]
---

This bash script installs Go lang tools in `/usr/local/go`, creates `$HOME/go` directory and sets `GOPATH` environment variable to `$HOME/go/bin`.

```bash
#!/bin/bash
set -e

GVERSION="1.7"
GFILE="go$GVERSION.linux-amd64.tar.gz"

GOPATH="$HOME/go"
GOROOT="/usr/local/go"
if [ -d $GOROOT ]; then
    echo "Installation directory already exists $GOROOT"
    exit 1
fi

mkdir -p "$GOROOT"
chmod 777 "$GOROOT"

wget --no-verbose https://storage.googleapis.com/golang/$GFILE -O $TMPDIR/$GFILE
if [ $? -ne 0 ]; then
    echo "Go download failed! Exiting."
    exit 1
fi

tar -C "/usr/local" -xzf $TMPDIR/$GFILE

touch "$HOME/.bashrc"
{
    echo '# GoLang'
    echo 'export PATH=$PATH:/usr/local/go/bin'
    echo 'export GOPATH=$HOME/go'
    echo 'export PATH=$PATH:$GOPATH/bin'
} >> "$HOME/.bashrc"
source "$HOME/.bashrc"
echo "GOROOT set to $GOROOT"

mkdir -p "$GOPATH" "$GOPATH/src" "$GOPATH/pkg" "$GOPATH/bin" "$GOPATH/out"
chmod 777 "$GOPATH" "$GOPATH/src" "$GOPATH/pkg" "$GOPATH/bin" "$GOPATH/out"
echo "GOPATH set to $GOPATH"

rm -f $TMPDIR/$GFILE
```

You can run the one-line installer using this [gist](https://gist.githubusercontent.com/stefanprodan/29d738c3049a8714297a9bdd8353f31c) as source:

```bash
cd $HOME
curl -s -L <GIST_RAW_URL> | sudo bash
``` 

The gist raw URL can be found [here](https://gist.githubusercontent.com/stefanprodan/29d738c3049a8714297a9bdd8353f31c/raw/1f3ae2cf97cb2faff52a8a3d98f0b6415d86c810/win10-bash-go-install.sh).

After running the script, type `exit` to close the current session. Open a new bash session and run `go env` to verify the installation.   