import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Guard against double-init (Vite HMR reloads this module on edits)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ----- APP CHECK -----
// DEV = Vite dev server (Replit preview). In production this block is excluded.
// The debug token MUST be registered in Firebase Console → App Check → Debug tokens.
if (import.meta.env.DEV) {
  // @ts-ignore
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = '0271b3e6-775e-4420-bbde-47c6e4140beb';
}

// Wrap in try/catch: on HMR the app instance is reused (getApp()),
// but initializeAppCheck would throw "already-initialized" without the guard.
try {
  initializeAppCheck(app, {
    // Must be the PUBLIC site key (never the secret key)
    provider: new ReCaptchaV3Provider(
      import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6Lcgb4ssAAAAAC4lOhF3eTlXFC5zrjuuIIXmhK3v'
    ),
    isTokenAutoRefreshEnabled: true,
  });
  console.log('[AppCheck] Initialized.');
} catch (e) {
  // "already-initialized" on HMR — safe to ignore, App Check is active
  console.warn('[AppCheck] Skipped (already initialized):', e?.message);
}

// ----- AUTH & FIRESTORE (always AFTER App Check) -----
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
