# GitHub and GHCR authentication via 1Password

Use the [1Password CLI](https://developer.1password.com/docs/cli) as the
credential helper for both `git` (github.com) and `docker` (ghcr.io), so
GitHub PATs are never written to the macOS keychain or to disk.

## Threat model

Both Git and Docker on macOS default to credential helpers that cache
tokens in the login keychain. The keychain ACL on those entries grants
silent read access to the helper binaries.

Infostealer embedded in npm post-install scripts or
compromised IDE plugins can read the keychain entries and extract the tokens with:

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

With 1Password as the helper, tokens are fetched per-operation, gated by 1Password's biometric session,
and never persisted in the keychain, shell history, or disk.

## Git setup (github.com)

Prerequisite: 1Password desktop app installed, with the **Connect with
1Password CLI** integration enabled (Settings → Developer).

Install the `op` CLI with Homebrew:

```sh
brew install 1password-cli
```

### 1. Store a GitHub PAT in 1Password

Create a fine-grained PAT on GitHub and save it in 1Password as `github-pat` (type API Credentials).
Make sure to fill in the expiry date to get notified about renewal.

### 2. Create the credential helper script

`~/.local/bin/git-credential-1password-github`:

```bash
#!/usr/bin/env bash
set -euo pipefail

[ "${1:-}" = "get" ] || exit 0

token=$(/opt/homebrew/bin/op read op://<vault>/github-pat/credential)

printf 'username=x-access-token\n'
printf 'password=%s\n' "$token"
```

Replace `<vault>` with the actual value.

```bash
chmod +x ~/.local/bin/git-credential-1password-github
```

The script only responds to `get`;
`store` and `erase` are no-ops, so git won't try to persist anything.

### 3. Update `~/.gitconfig`

```gitconfig
[credential "https://github.com"]
    helper =
    helper = /Users/<your-username>/.local/bin/git-credential-1password-github
```

Replace `<your-username>` with the actual value.

The empty `helper =` inside the github.com section clears any helper
inherited from the system-level `/opt/homebrew/etc/gitconfig` (which
Homebrew ships as `osxkeychain`). Other HTTPS hosts (GitLab, Bitbucket, etc.)
continue to use whatever helper the inherited config specifies.

### 4. Purge existing keychain entries

```bash
printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain erase
```

Verify nothing comes back:

```bash
printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain get
# (empty)
```

### 5. Verify the helper

```bash
printf 'protocol=https\nhost=github.com\n\n' | git credential fill
# protocol=https
# host=github.com
# username=x-access-token
# password=<token from 1Password>
```

The first time `op read` is invoked from this script, 1Password shows a Touch ID prompt.

Running `git push` from a new shell will trigger the Touch ID prompt
again, even while the 1Password app remains unlocked. The desktop app
authorizes `op` calls per parent process, so every new shell needs a
fresh approval the first time it invokes the helper. After that, all
git operations in that shell run silently until the 1Password session
times out or the app is locked.

### 6. GitHub CLI

For `gh` use the official [1Password shell plugin](https://developer.1password.com/docs/cli/shell-plugins/github/).
It wraps each `gh` invocation with `op run`, injecting the PAT
into `GITHUB_TOKEN` per command, so nothing is ever written to
`~/.config/gh/hosts.yml` nor the keychain.

```bash
op plugin init gh
```

Pick the same PAT item from step 1. `op` writes a shim to
`~/.config/op/plugins.sh`; source it from your shell config:

```bash
# in ~/.bash_profile (or ~/.zshrc)
source ~/.config/op/plugins.sh
```

Verify:

```bash
gh auth status
# github.com
#   ✓ Logged in to github.com account <you>
```

The first `gh` call in a new shell triggers a 1Password Touch ID prompt,
same as the git and docker helpers.

### 7. IDE integration

If you prefer to use IntelliJ, GoLand, or any other JetBrains IDE to push commits,
enable the "Use credential helper" option in "Settings > Version Control > Git".

Every push invokes the `git-credential-1password-github` script and triggers a
1Password Touch ID prompt — unlike a shell, where authorization persists for the
lifetime of the session, the IDE re-prompts on each push.

## Docker setup (ghcr.io)

Docker config supports `credHelpers` (per-host overrides) alongside
`credsStore` (the global default), so Docker Desktop continues to handle
Docker Hub and other registries while ghcr.io is routed to 1Password.

### 1. Store a GHCR PAT in 1Password

Create a classic PAT on GitHub by navigating to https://github.com/settings/tokens/new?scopes=write:packages
(this URL will avoid granting repo access). Save the PAT in 1Password as `ghcr-pat` (type API Credentials).

### 2. Create the credential helper script

`~/.local/bin/docker-credential-1password-ghcr`:

```bash
#!/usr/bin/env bash
set -euo pipefail

OP=/opt/homebrew/bin/op
OP_REF=op://<vault>/ghcr-pat/credential
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

Replace `<vault>` with the actual value.

```bash
chmod +x ~/.local/bin/docker-credential-1password-ghcr
```

Docker looks for `docker-credential-<name>` on `$PATH`, so the file name
suffix (`1password-ghcr`) is what you reference from config.

### 3. Update `~/.docker/config.json`

```json
{
    "credsStore": "desktop",
    "credHelpers": {
        "ghcr.io": "1password-ghcr"
    }
}
```

Keep `credsStore` for everything else; `credHelpers` overrides only for ghcr.io.

### 4. Purge the cached credential

```bash
docker logout ghcr.io
```

Verify Docker Desktop's store no longer has it:

```bash
echo 'https://ghcr.io' | docker-credential-desktop get
# credentials not found in native keychain
```

### 5. Verify the helper

As with the git helper, the first invocation triggers a 1Password Touch ID prompt.
Approve it once per session.

```bash
echo 'https://ghcr.io' | docker-credential-1password-ghcr get
# {"ServerURL":"https://ghcr.io","Username":"x-access-token","Secret":"<token>"}
```

End-to-end: `docker pull ghcr.io/<owner>/<private-image>` should succeed
without ever calling `docker login`.

## Day-to-day operations

- `git push` / `fetch` / `pull` to github.com, and `docker pull` / `push`
  against ghcr.io → small pause while `op read` runs. Biometric prompt only
  after the 1Password session times out or the app is locked.
- If the 1Password desktop app is closed, `op read` fails and the
  underlying tool reports an auth error.
