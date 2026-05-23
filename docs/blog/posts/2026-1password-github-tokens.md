---
date: 2026-05-22
authors: [stefanprodan]
description: >
  A minimal-disruption macOS setup that fetches GitHub PATs from 1Password,
  gated by Touch ID, instead of caching them in the keychain.
categories:
  - Security
---

# Locking GitHub PATs behind Touch ID with 1Password

A macOS setup recipe for routing GitHub authentication through the
1Password CLI instead of the login keychain.
It covers `git` and JetBrains IDEs against github.com, the `gh` CLI, and
`docker` against ghcr.io.

<!-- more -->

With this configuration, GitHub PATs live only in the 1Password vault and
are fetched per shell session, gated by macOS Touch ID.

## Threat model

Both Git and Docker on macOS default to credential helpers that cache
tokens in the login keychain. The keychain ACL on those entries grants
silent read access to the helper binaries.

Infostealers embedded in compromised AI agent skills, npm post-install scripts,
or IDE plugins can read the keychain entries and extract the GitHub PATs with:

```bash
# Git
printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain get
# username=<your github handle>
# password=<your github token>

# Docker
echo 'https://ghcr.io' | docker-credential-desktop get
# {"ServerURL":"https://ghcr.io","Username":"<your github handle>,"Secret":"<your ghcr token>"}
```

If GitHub credentials are stored on disk, the infostealer can discover them with:

```bash
trufflehog filesystem --only-verified --no-update \
    ~/.bash_profile ~/.bashrc ~/.bash_history ~/.npmrc \
    ~/.gitconfig ~/.docker/config.json ~/.config ~/.ssh
```

## Prerequisites

Install the 1Password desktop app and enable the **Connect with 1Password
CLI** integration (Settings → Developer).

Install the `op` CLI with Homebrew:

```sh
brew install 1password-cli
```

This doc assumes a 1Password vault named `dev` for storing GitHub PATs.
Substitute another name in the `op://` references below if you use one.

## Git setup (github.com)

Git's credential helper config supports per-host scoping, so we point
`https://github.com` at a custom helper that reads from 1Password, while
leaving other HTTPS hosts (GitLab, Bitbucket, etc.) unaffected.

Create a fine-grained PAT on GitHub and save it in 1Password as `github-pat`
(type API Credentials). Fill in the expiry date so 1Password notifies you to
rotate it.

Write a credential helper at `~/.local/bin/git-credential-1password-github`:

```bash
#!/usr/bin/env bash
set -euo pipefail

[ "${1:-}" = "get" ] || exit 0

token=$(/opt/homebrew/bin/op read op://dev/github-pat/credential)

printf 'username=x-access-token\n'
printf 'password=%s\n' "$token"
```

Make it executable:

```bash
chmod +x ~/.local/bin/git-credential-1password-github
```

The script only responds to `get`; `store` and `erase` are no-ops, so git
won't try to persist anything.

Wire it into `~/.gitconfig`, scoped to github.com:

```gitconfig
[credential "https://github.com"]
    helper =
    helper = /Users/<your-username>/.local/bin/git-credential-1password-github
```

Replace `<your-username>` with the actual value. The empty `helper =` inside
the github.com section clears any helper inherited from the system-level
`/opt/homebrew/etc/gitconfig` (which Homebrew ships as `osxkeychain`); other
HTTPS hosts continue to use whatever the inherited config specifies.

Purge any existing keychain entry:

```bash
printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain erase
```

Verify by cloning a private repo:

```bash
git clone https://github.com/org/private-repo
```

The first `git clone`, `pull`, or `push` from a new shell triggers the
Touch ID prompt, even while 1Password is unlocked. The desktop app authorizes `op`
calls per parent process, so every new shell needs a fresh approval the first
time it invokes the helper. After that, all git operations in that shell run
silently until the 1Password session times out or the app is locked.

## Docker setup (ghcr.io)

Docker config supports `credHelpers` (per-host overrides) alongside
`credsStore` (the global default), so Docker Desktop continues to handle
Docker Hub and other registries while ghcr.io is routed to 1Password.

Create a classic PAT scoped to `write:packages` via
[github.com/settings/tokens/new?scopes=write:packages](https://github.com/settings/tokens/new?scopes=write:packages)
(this URL avoids granting repo access). Save it in 1Password as `ghcr-pat`
(type API Credentials).

Write a helper at `~/.local/bin/docker-credential-1password-ghcr`:

```bash
#!/usr/bin/env bash
set -euo pipefail

OP=/opt/homebrew/bin/op
OP_REF=op://dev/ghcr-pat/credential
USERNAME=x-access-token

case "${1:-}" in
    get)
        url=$(cat)
        case "$url" in
            ghcr.io|https://ghcr.io*)
                token=$($OP read "$OP_REF")
                printf '{"ServerURL":"%s","Username":"%s","Secret":"%s"}\n' "$url" "$USERNAME" "$token"
                ;;
            *)
                printf '{"ServerURL":"%s","Username":"","Secret":""}\n' "$url"
                exit 1
                ;;
        esac
        ;;
    list)
        printf '{"ghcr.io":"%s"}\n' "$USERNAME"
        ;;
    store|erase)
        cat >/dev/null
        ;;
    *)
        exit 1
        ;;
esac
```

Make it executable:

```bash
chmod +x ~/.local/bin/docker-credential-1password-ghcr
```

Docker looks for `docker-credential-<name>` on `$PATH`, so the file name
suffix (`1password-ghcr`) is what you reference from config. Update
`~/.docker/config.json` to route ghcr.io specifically:

```json
{
    "credsStore": "desktop",
    "credHelpers": {
        "ghcr.io": "1password-ghcr"
    }
}
```

Keep `credsStore` for everything else; `credHelpers` overrides only for
ghcr.io.

Purge the cached credential:

```bash
docker logout ghcr.io
```

Verify the new helper:

```bash
docker pull ghcr.io/stefanprodan/podinfo
```

As with the git helper, the first invocation triggers a 1Password Touch ID
prompt. Approve it once per shell session.

## JetBrains IDEs

If you prefer to use IntelliJ, GoLand, or any other JetBrains IDE to push commits,
enable the "Use credential helper" option in "Settings > Version Control > Git".

The first push from each IDE session invokes the `git-credential-1password-github`
script and triggers a 1Password Touch ID prompt. Subsequent pushes from the same
IDE process run silently until the 1Password session times out or the app is locked,
at which point the next push re-prompts.

## GitHub CLI

For `gh` use the official [1Password shell plugin](https://developer.1password.com/docs/cli/shell-plugins/github/).
It wraps each `gh` invocation with `op run`, injecting the PAT
into `GITHUB_TOKEN` per command, so nothing is ever written to
`~/.config/gh/hosts.yml` nor the keychain.

Generate a dedicated fine-grained PAT for the GitHub CLI and save it in
1Password (a separate item from `github-pat`, scoped to whatever `gh`
operations you actually need). Then initialize the plugin and pick that
item when prompted:

```bash
op plugin init gh
```

`op` writes a shim to `~/.config/op/plugins.sh`; source it from your shell config:

```bash
# in ~/.bash_profile (or ~/.zprofile)
source ~/.config/op/plugins.sh
```

Verify:

```bash
gh auth status
```

The first `gh` call in a new shell triggers a 1Password Touch ID prompt,
same as the git helper.

## Limitations

This setup raises the bar for credential theft but does not eliminate it.
Once a shell session is authorized (by `git push`, `docker push`, or any
other invocation of `op read`), the helper runs silently for the rest of
the 1Password unlock window. Any process inside that shell can fetch the
PAT from the vault without a Touch ID prompt:

```bash
printf 'protocol=https\nhost=github.com\n\n' | git credential fill
```

That window is the weak link:

- An infostealer that lands in an authorized shell inherits the same
  access the helper has and can exfiltrate the PAT directly.
- AI coding agents running as subprocesses of an authorized shell
  inherit that authorization too. Treat them as untrusted: do not run
  `git push` or `docker push` from inside an agent session, and do not
  let an agent invoke `op read` on your behalf.

The Touch ID prompt itself carries no useful context: it does not show
which vault or item is being requested, and it does not show which
process triggered the request. A legitimate `git push` from your terminal
and a stealthy `op read` from a background daemon look identical at the
prompt. You cannot make a security decision from the prompt alone, only
from what you know you were just doing.

**Recommendation**: keep a dedicated terminal window for `git push` and
`docker push`, and run nothing else in it: no AI agents, no npm commands,
no third-party scripts. Anything running in that shell after authorization
has silent read access to the PAT until the 1Password session times out.

