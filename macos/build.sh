#!/bin/bash
set -euo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_ROOT="$(mktemp -d /tmp/bmw-import-build.XXXXXX)"
DEST="$BUILD_ROOT/BMW Import.app"
NODE="${BMW_NODE:-$(command -v node || true)}"
[[ -x "$NODE" ]] || { echo "Install Node.js 22+ or set BMW_NODE." >&2; exit 1; }
mkdir -p "$DEST/Contents/MacOS" "$DEST/Contents/Resources/app" "$DEST/Contents/Resources/initialData/quotes"
cp "$SOURCE/macos/AppIcon.icns" "$DEST/Contents/Resources/AppIcon.icns"
cp "$NODE" "$DEST/Contents/Resources/node"
cp "$SOURCE/server.mjs" "$DEST/Contents/Resources/app/"
cp -R "$SOURCE/public" "$DEST/Contents/Resources/app/"
if [[ "${BMW_PERSONAL_BUILD:-0}" == "1" ]]; then
 cp -R "$SOURCE/data/." "$DEST/Contents/Resources/initialData/"
fi
xcrun swiftc "$SOURCE/macos/main.swift" -o "$DEST/Contents/MacOS/BMWImport" -framework Cocoa -framework WebKit -target arm64-apple-macos13.5 -module-cache-path /tmp/bmw-swift-cache
cat > "$DEST/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>BMWImport</string>
<key>CFBundleIdentifier</key><string>local.bmwimport.desktop</string>
<key>CFBundleName</key><string>BMW Import</string>
<key>CFBundleDisplayName</key><string>BMW Import</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.5.0</string>
<key>CFBundleVersion</key><string>7</string>
<key>LSMinimumSystemVersion</key><string>13.5</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST
xattr -cr "$DEST"
codesign --force --sign - "$DEST/Contents/Resources/node"
codesign --force --sign - "$DEST"
codesign --verify --deep --strict "$DEST"
OUTPUT="${BMW_OUTPUT:-$SOURCE/dist}"
mkdir -p "$OUTPUT"
ditto "$DEST" "$OUTPUT/BMW Import.app"
xattr -cr "$OUTPUT/BMW Import.app"
codesign --verify --deep --strict "$OUTPUT/BMW Import.app"
ditto -c -k --sequesterRsrc --keepParent "$DEST" "$OUTPUT/BMW-Import-0.5.0-Apple-Silicon.zip"
if [[ "${BMW_PERSONAL_BUILD:-0}" != "1" ]]; then
 mkdir -p "$BUILD_ROOT/payload/Applications"
 ditto "$DEST" "$BUILD_ROOT/payload/Applications/BMW Import.app"
 pkgbuild --analyze --root "$BUILD_ROOT/payload" "$BUILD_ROOT/components.plist"
 /usr/libexec/PlistBuddy -c "Add :0:BundleIsRelocatable bool false" "$BUILD_ROOT/components.plist"
 pkgbuild --root "$BUILD_ROOT/payload" --component-plist "$BUILD_ROOT/components.plist" --identifier local.bmwimport.installer --version 0.5.0 --install-location / "$BUILD_ROOT/component.pkg"
 cat > "$BUILD_ROOT/distribution.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
<title>BMW Import</title>
<options customize="never" hostArchitectures="arm64" require-scripts="false"/>
<allowed-os-versions><os-version min="13.5"/></allowed-os-versions>
<domains enable_localSystem="true" enable_currentUserHome="false" enable_anywhere="false"/>
<choices-outline><line choice="default"/></choices-outline>
<choice id="default" visible="false"><pkg-ref id="local.bmwimport.installer"/></choice>
<pkg-ref id="local.bmwimport.installer" version="0.5.0" onConclusion="none">component.pkg</pkg-ref>
</installer-gui-script>
XML
 productbuild --distribution "$BUILD_ROOT/distribution.xml" --package-path "$BUILD_ROOT" "$OUTPUT/BMW-Import-0.5.0-Apple-Silicon.pkg"
fi
printf 'Built: %s\n' "$OUTPUT"
