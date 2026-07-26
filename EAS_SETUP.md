# EAS Setup — shareable Android link + over-the-air updates

> **Optional now.** Since the restructure, the same app installs as a PWA on
> Android (and iPhone) straight from the web URL, with no keystore, no APK and
> no Expo account. See [DEPLOYMENT.md](DEPLOYMENT.md#installing-the-app). Keep
> reading only if you specifically want the native Android build.
>
> If you do build an APK, update `EXPO_PUBLIC_API_URL` in `eas.json` first — the
> ngrok URL baked into the current profiles dies once the backend moves to
> Render.

This replaces "email an APK" with a **shareable install link** and lets you push
most future changes **over the air** (no rebuild/reinstall). Everything runs from
the `mobile/` folder.

Config is already in place: `eas.json` (build profiles + your API/Client-ID env)
and `app.json` (`runtimeVersion`). `expo-updates` is installed.

## One-time setup

1. **Create a free Expo account** at https://expo.dev/signup (or use an existing one).

2. **Log in** (from `C:\coding\banker_lapp\mobile`):
   ```bash
   cd C:\coding\banker_lapp\mobile
   npx eas-cli login
   ```

3. **Link the project** (creates it on Expo and writes the project id into app.json):
   ```bash
   npx eas-cli init
   ```

4. **Reuse your existing keystore** so Google Sign-In keeps working and installs
   update in place (important — don't let EAS generate a new one):
   ```bash
   npx eas-cli credentials
   ```
   - Platform: **Android**
   - Build profile: **preview**
   - Choose **Keystore: Set up a new keystore** → **Upload a keystore**
   - Keystore path: `android/app/banker-lapp-release.keystore`
   - Key alias: `banker-lapp`
   - Keystore and key password: the value you used when the keystore was
     generated. It is deliberately **not** recorded in this repo — it is the
     credential that signs the APK people install. If you don't have it, it is
     in `mobile/android/keystore.properties` on your machine (gitignored).

   *(SHA-1 stays `3B:DF:72:B3:6D:EF:ED:49:84:83:B8:A9:A2:04:E9:B6:25:B3:5D:22`, so no Google Cloud changes are needed.)*

## Build a shareable Android app

```bash
npx eas-cli build --platform android --profile preview
```
When it finishes, EAS gives you a **URL / QR code**. Send that to your friends —
they open it on their phone and install (Android will ask to allow install from
that source, same as before, but now it's a link, not a file). You can also see
all builds at https://expo.dev → your project → Builds.

## Push updates over the air (no rebuild)

For any change that's **JavaScript/UI only** (most of what we do — screens,
dialogs, logic), publish it instantly to everyone who installed the `preview`
build:

```bash
npx eas-cli update --branch preview --message "what changed"
```
Their app picks it up on next launch. No new APK, no reinstall.

> Rebuild (the `eas build` step) is only needed when **native** code changes:
> adding a native module, changing the app icon/splash, or bumping the native
> config. Pure JS/asset changes go out via `eas update`.

## Notes
- The backend still needs a public URL — your ngrok tunnel (baked into the build
  via `eas.json` env) or a cloud deploy. If that URL ever changes, update
  `eas.json` and run a new `eas build`.
- iOS/TestFlight is a separate setup (needs an Apple Developer account, $99/yr) —
  see the notes at the end of DEPLOYMENT.md when you're ready.
