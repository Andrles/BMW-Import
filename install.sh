#!/bin/bash
set -euo pipefail
# Pinned release; download and verify before asking for administrator access.
VERSION="0.6.0"
ASSET="BMW-Import-${VERSION}-Apple-Silicon.pkg"
SHA256="d7502c093d1af6daf4f4d26cf1655d6120227b30fe76d97cd91155f15cfa045f"
URL="https://github.com/Andrles/BMW-Import/releases/download/v${VERSION}/${ASSET}"
[[ "$(uname -s)" == "Darwin" ]] || { echo "Requires macOS." >&2; exit 1; }
[[ "$(uname -m)" == "arm64" ]] || { echo "Requires Apple Silicon. On Apple Silicon, run Terminal without Rosetta." >&2; exit 1; }
OS_VERSION="0.6.0"
OS_MAJOR="${OS_VERSION%%.*}"
OS_REST="${OS_VERSION#*.}"
OS_MINOR="${OS_REST%%.*}"
if (( OS_MAJOR < 13 || (OS_MAJOR == 13 && OS_MINOR < 5) )); then
 echo "Requires macOS 13.5 or later." >&2; exit 1
fi
WORK_DIR="$(mktemp -d /tmp/bmw-import-install.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT
printf 'Downloading BMW Import %s…\n' "$VERSION"
curl --fail --location --proto '=https' --tlsv1.2 --retry 3 "$URL" -o "$WORK_DIR/$ASSET"
printf '%s  %s\n' "$SHA256" "$WORK_DIR/$ASSET" | shasum -a 256 -c -
echo "Installing into /Applications. Existing reports remain in Application Support."
echo "This community build is not notarized by Apple. No security settings are changed."
sudo /usr/sbin/installer -pkg "$WORK_DIR/$ASSET" -target /
echo "Installed: /Applications/BMW Import.app"
