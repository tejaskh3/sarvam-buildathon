# Yaadein — Android shell

A thin WebView wrapper around the live site at
`https://www.yaadeinapp.com/`.

Nothing about the product lives in this binary. The app loads production, so
anything you ship to Railway is live on the demo phone the next time it opens —
no rebuild. The only reason to rebuild is a change to the shell itself
(permissions, icon, the URL).

## Installing on a demo device

1. Download the `.apk` from the EAS build page on the phone itself, or push it
   over USB with `adb install yaadein.apk`.
2. Android will warn about installing outside the Play Store. Allow it for
   whichever app is doing the installing (Chrome, Files). This is expected —
   the build is signed with our own keystore, not a Play key.
3. Open the app. The first time you tap the microphone, Android asks for
   microphone access. **Say yes.** If you say no, the mic prompt does not come
   back on its own — you have to clear it in
   Settings → Apps → Yaadein → Permissions.

Do this once per device *before* the expo, not at it.

## Known limitation: Google sign-in

"Continue with Google" opens in Chrome rather than inside the app, because
Google refuses to serve OAuth to a WebView at all (`disallowed_useragent`).
The sign-in completes, but the session lands in Chrome's cookie jar, so the
family dashboard comes back signed out.

This does not affect the demo. Per `landing-page/src/lib/auth.ts`, the elder
never signs in — the voice page is number-based on the device, and only the
family dashboard sits behind a session.

If the dashboard needs to work in-app, enable Clerk's **email code** strategy.
That runs entirely on our own origin and works inside a WebView with no shell
changes.

## Rebuilding

```sh
EXPO_TOKEN=$(cat ~/.expo-token) npx eas-cli build -p android --profile preview
```

`preview` produces a sideloadable `.apk`. The `production` profile produces an
`.aab`, which is only useful for the Play Store and cannot be sideloaded.

Bump `expo.android.versionCode` in `app.json` if you want a device to treat the
new build as an upgrade rather than refusing to install over the old one.

## Keystore

Generated and held by EAS. Export it with `npx eas-cli credentials` if you ever
need it locally. Losing it means never being able to update this app under the
same identity, so if this outlives the hackathon, export and back it up.
