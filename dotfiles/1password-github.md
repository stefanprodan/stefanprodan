# GitHub and GHCR authentication via 1Password

Use the [1Password CLI](https://developer.1password.com/docs/cli) as the
credential helper for both `git` (github.com) and `docker` (ghcr.io), so
GitHub PATs are never written to the macOS keychain or to disk.

## Threat model

Both git and Docker on macOS default to credential helpers that cache
tokens in the login keychain. The keychain ACL on those entries grants
silent read access to the helper binaries — which are plain CLIs that dump
credentials to stdout when invoked:

```bash
# Git
printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain get
# username=<you>
# password=<your github token>

# Docker
echo 'https://ghcr.io' | docker-credential-desktop get
# {"ServerURL":"https://ghcr.io","Username":"x-access-token","Secret":"<your ghcr token>"}
```

Any process running as your user — a malicious npm postinstall script, a
compromised IDE plugin — can invoke either binary and walk away with the
token. No Touch ID, no GUI prompt.

With 1Password as the helper, tokens are fetched per-operation via
`op read`, gated by 1Password's biometric session, and never persisted in
the keychain.

## Git setup (github.com)

Prerequisite: 1Password desktop app installed, with the **Connect with
1Password CLI** integration enabled (Settings → Developer).

### 1. Store a GitHub PAT in 1Password

Create a fine-grained PAT on GitHub, save it as a new item in 1Password, and
note its `op://` reference. Get it with:

```bash
op item get <item-name> --reveal --format json | jq '.fields'
```

The path will look like `op://<vault>/<item>/password`.

### 2. Create the credential helper script

`~/.local/bin/git-credential-1password-github`:

```bash
#!/usr/bin/env bash
set -euo pipefail

[ "${1:-}" = "get" ] || exit 0

token=$(/opt/homebrew/bin/op read op://<vault>/<item>/password)

printf 'username=<your-github-handle>\n'
printf 'password=%s\n' "$token"
```

```bash
chmod +x ~/.local/bin/git-credential-1password-github
```

The script only responds to `get`. `store` and `erase` are no-ops, so git
won't try to persist anything.

### 3. Update `~/.gitconfig`

```gitconfig
[credential]
    helper =
[credential "https://github.com"]
    helper = /Users/<you>/.local/bin/git-credential-1password-github
```

The empty `helper =` clears any helper inherited from the system-level
`/opt/homebrew/etc/gitconfig` (which Homebrew ships as `osxkeychain`).

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
# username=<you>
# password=<token from 1Password>
```

## Docker setup (ghcr.io)

Docker config supports `credHelpers` (per-host overrides) alongside
`credsStore` (the global default), so Docker Desktop continues to handle
Docker Hub and other registries while ghcr.io is routed to 1Password.

### 1. Store a GHCR PAT in 1Password

Create a classic PAT on GitHub by navigating to https://github.com/settings/tokens/new?scopes=write:packages
(this URL will avoid granting repo access), save it as a 1Password item, and note its `op://` reference.

### 2. Create the credential helper script

`~/.local/bin/docker-credential-1password-ghcr`:

```bash
#!/usr/bin/env bash
set -euo pipefail

OP=/opt/homebrew/bin/op
OP_REF=op://<vault>/<item>/password
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

```bash
echo 'https://ghcr.io' | docker-credential-1password-ghcr get
# {"ServerURL":"https://ghcr.io","Username":"x-access-token","Secret":"<token>"}
```

End-to-end: `docker pull ghcr.io/<owner>/<private-image>` should succeed
without ever calling `docker login`.

## Day-to-day

- `git push` / `fetch` / `pull` to github.com, and `docker pull` / `push`
  against ghcr.io → small pause while `op read` runs. Biometric prompt only
  after the 1Password session times out or the app is locked.
- `git commit`, `add`, `log`, `rebase`, ... → unchanged, no helper invoked.
- If the 1Password desktop app is closed, `op read` fails and the
  underlying tool reports an auth error.
