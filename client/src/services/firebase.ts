// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
// import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Auth providers
export const googleProvider = new GoogleAuthProvider();

// App Check - DISABLED temporarily
// TODO: Configure reCAPTCHA in Firebase Console -> App Check -> Apps -> [Your App]
// Then set VITE_RECAPTCHA_SITE_KEY in your environment variables
// const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
// if (typeof window !== 'undefined' && RECAPTCHA_SITE_KEY) {
//     initializeAppCheck(app, {
//         provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
//         isTokenAutoRefreshEnabled: true
//     });
// }

export default app;
