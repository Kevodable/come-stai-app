// firebase-config.js
// Config completo: VAPID key e URL della Cloud Function inclusi.

self.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCegRztKjKBq9DKQUmzcW7u0zeP90JIFGQ",
  authDomain: "come-stai-app-dae06.firebaseapp.com",
  projectId: "come-stai-app-dae06",
  storageBucket: "come-stai-app-dae06.firebasestorage.app",
  messagingSenderId: "922603176831",
  appId: "1:922603176831:web:f577b8493226a3dc0b504a",
};

// VAPID key
self.FIREBASE_VAPID_KEY = "BEPXV7OSxRlryxCx2kFQHDoYEgdB-ZB__nfCf9EKXSsPPccd_vWzdFkJyekjeQB_UVdefZWHXC8mZ-NjrUrnTEY";

// URL della Cloud Function HTTP "sendMoodNotification"
self.NOTIFY_FUNCTION_URL = "https://us-central1-come-stai-app-dae06.cloudfunctions.net/sendMoodNotification";
