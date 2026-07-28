/* ------------------------------------------------------------------
   Yaadein, wrapped for Android.

   This is deliberately a thin shell. The product lives on the web and
   ships from Railway; putting a copy of it in the binary would mean the
   demo device drifts from production the moment anyone pushes. So the
   app is a WebView pointed at the live site, and everything here exists
   only to fix the four things a bare WebView gets wrong:

     1. the microphone, which is the whole product and is off by default
     2. the back button, which otherwise closes the app mid-conversation
     3. venue wi-fi, which needs a retry that an elder can find
     4. Google sign-in, which Google blocks inside WebViews outright

   Only (4) is a compromise — see onShouldStartLoadWithRequest.
   ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useKeepAwake } from 'expo-keep-awake';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';

const APP_URL = 'https://www.yaadeinapp.com/';
const APP_ORIGIN = 'https://www.yaadeinapp.com';

/* Matches the site's own <meta name="theme-color">, so the shell and the
   page it hosts are the same colour and there's no flash between them. */
const BG = '#f5f5f3';
const INK = '#1e2033';
const INK_SOFT = '#6b7092';

/* Hold the splash until the page has actually painted, otherwise the app
   opens on a white rectangle while the SPA boots. */
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  /* A conversation is long pauses by design — an elder searching for a word
     shouldn't have the screen lock on them mid-sentence. Costs battery, which
     on a demo device plugged in at a booth is not a cost. */
  useKeepAwake();

  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  /* Bumping this remounts the WebView. After a network failure the view is
     left blank and reload() on a blank view is unreliable, so a fresh mount
     is the honest way to retry. */
  const [attempt, setAttempt] = useState(0);

  /* Android's hardware back should walk the SPA's history, not kill the app.
     Falling through to `false` on the first page keeps the normal exit. */
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && !failed) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, failed]);

  const settle = useCallback(() => {
    setLoading(false);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const retry = useCallback(() => {
    setFailed(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  /* Anything that isn't our own origin opens in the system browser.

     This is mostly about Google. Clerk's "Continue with Google" leaves our
     origin for accounts.google.com, and Google refuses to render OAuth in a
     WebView at all (`disallowed_useragent`) — so keeping it inside would
     dead-end on an error page with no way back. Chrome at least completes.

     The catch, and it is a real one: the session lands in Chrome's cookie
     jar, not ours, so the family dashboard won't be signed in when the user
     comes back. The elder's voice flow needs no session and is unaffected,
     which is why this is survivable for a demo rather than a blocker. */
  const onShouldStartLoadWithRequest = useCallback((req: { url: string }) => {
    const { url } = req;
    if (url.startsWith(APP_ORIGIN) || url.startsWith('about:') || url.startsWith('data:')) {
      return true;
    }
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* No backgroundColor prop: Android is always edge-to-edge from SDK 54
            on, and the status bar takes its colour from the SafeAreaView. */}
        <StatusBar style="dark" />

        {failed ? (
          <View style={styles.center}>
            <Text style={styles.title}>Can't reach Yaadein</Text>
            <Text style={styles.body}>
              Check the wi-fi and try again.
            </Text>
            <Pressable
              onPress={retry}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.buttonLabel}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <WebView
              key={attempt}
              ref={webRef}
              source={{ uri: APP_URL }}
              style={styles.web}
              /* The microphone. react-native-webview's Android chrome client
                 answers the page's getUserMedia prompt by asking Android for
                 RECORD_AUDIO, but only if it's declared in the manifest —
                 see android.permissions in app.json. Both halves are needed. */
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              javaScriptEnabled
              domStorageEnabled
              /* The site keeps the elder's number on the device, so the jar
                 has to survive an app restart. */
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              /* Route target=_blank through the handler above instead of
                 letting Android silently swallow the popup. */
              setSupportMultipleWindows={false}
              onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
              onNavigationStateChange={(nav: WebViewNavigation) => setCanGoBack(nav.canGoBack)}
              onLoadEnd={settle}
              /* onError is transport-level (DNS, no route). onHttpError fires
                 for 5xx from Railway — but also for any failing sub-request,
                 so only the main document is allowed to trip the retry screen. */
              onError={() => {
                setFailed(true);
                settle();
              }}
              onHttpError={({ nativeEvent }) => {
                if (nativeEvent.url?.startsWith(APP_URL) && nativeEvent.statusCode >= 500) {
                  setFailed(true);
                  settle();
                }
              }}
            />
            {loading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color={INK_SOFT} />
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: { fontSize: 24, color: INK, marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 16, color: INK_SOFT, marginBottom: 28, textAlign: 'center' },
  button: {
    backgroundColor: INK,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 999,
  },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: { color: '#fff', fontSize: 18 },
});
