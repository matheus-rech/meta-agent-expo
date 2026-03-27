# Meta Agent Mobile — Build Guide

## GitHub Actions (Recommended)

Push to `main` and GitHub Actions handles everything:

| Workflow | Runner | Output | Trigger |
|----------|--------|--------|---------|
| `build-android.yml` | `ubuntu-latest` | APK / AAB | Push to main, PRs |
| `build-ios.yml` | `macos-26` | .app (simulator) | Push to main, PRs |
| `deploy-web.yml` | `ubuntu-latest` | GitHub Pages | Push to main |

### Setup

1. Create the GitHub repo and push:
```bash
cd meta-agent-expo
git init && git add . && git commit -m "Meta Agent Mobile"
gh repo create meta-agent-mobile --public --source=. --push
```

2. Enable GitHub Pages:
   - Go to Settings → Pages → Source: **GitHub Actions**

3. That's it. Web deploys on every push. Android builds an unsigned debug APK. iOS builds a simulator .app.

### Android Signed Release

Add these secrets in Settings → Secrets → Actions:

| Secret | What |
|--------|------|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i release.keystore` output |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (e.g., `meta-agent`) |
| `ANDROID_KEY_PASSWORD` | Key password |

Generate a keystore if you don't have one:
```bash
keytool -genkeypair -v -keystore release.keystore \
  -alias meta-agent -keyalg RSA -keysize 2048 -validity 10000
```

### iOS TestFlight

Uncomment the signing jobs in `build-ios.yml` and add these secrets:

| Secret | What |
|--------|------|
| `IOS_CERTIFICATE_BASE64` | P12 distribution cert (base64) |
| `IOS_CERTIFICATE_PASSWORD` | P12 password |
| `IOS_PROVISION_PROFILE` | .mobileprovision file (base64) |
| `APPSTORE_CONNECT_KEY_ID` | App Store Connect API key ID |
| `APPSTORE_CONNECT_ISSUER` | Issuer ID |
| `APPSTORE_CONNECT_KEY` | .p8 private key contents |

## Local Development

```bash
npm install

# Run on web
npx expo start --web

# Run on iOS simulator
npx expo prebuild --platform ios
cd ios && pod install && cd ..
npx expo run:ios

# Run on Android emulator
npx expo prebuild --platform android
npx expo run:android
```

## EAS (Optional)

If you prefer EAS over GitHub Actions:
```bash
npx eas-cli@latest build --platform all
```

The `eas.json` is pre-configured with development, preview, and production profiles.
