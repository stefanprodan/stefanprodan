# Dev machine macOS setup

## Homebrew

Install Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Install tools

```bash
brew bundle --file=dotfiles/Brewfile
```

## Desktop Apps

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Jetbrains GoLand](https://www.jetbrains.com/go/)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Opera](https://www.opera.com/)
- [Slack](https://slack.com/)
- [Zulip](https://zulip.com/apps/mac)
- [Zoom](https://zoom.us/)
- [Tailscale](https://tailscale.com/)
- [Keybase](https://keybase.io/)
- [Adobe Acrobat Reader](https://get.adobe.com/reader/)
- [SafeNet Authentication Client](https://www.certsign.ro/en/support/safenet-installing-the-device-on-macos/)

## Troubleshooting

Reinstalling Docker Desktop:

```bash
brew uninstall --cask docker --force
brew uninstall --formula docker --force
brew install --cask docker
```
