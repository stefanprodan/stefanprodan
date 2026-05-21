# Git authentication via 1Password

Use the [1Password CLI](https://developer.1password.com/docs/cli) as a git
credential helper so GitHub tokens are never written to the macOS keychain
or to disk.

## Threat model

By default macOS git uses `credential.helper = osxkeychain`. After the first
`git push`, the GitHub PAT lives in the login keychain. The keychain ACL on
that entry grants silent read access to `git-credential-osxkeychain`. The
binary is a plain CLI that prints credentials to stdout:

```bash
printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain get
# username=<you>
# password=<your token>
```

Any process running as your user — a malicious npm postinstall script, a
compromised IDE plugin — can invoke this and walk away with the token. No
Touch ID, no GUI prompt.

With 1Password as the helper, the token is fetched per-operation via
`op read`, gated by 1Password's biometric session, and never persisted in
the keychain.

## Setup

Prerequisite: 1Password 8 desktop app installed, with the **Connect with
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

## Day-to-day

- `git push` / `fetch` / `pull` to github.com → small pause while `op read`
  runs. Biometric prompt only after the 1Password session times out or the
  app is locked.
- `git commit`, `add`, `log`, `rebase`, ... → unchanged, no helper invoked.
- If the 1Password desktop app is closed, `op read` fails and git auth fails
  with a clear error.

