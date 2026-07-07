// firebase-config.example.js
//
// COPIA questo file in "firebase-config.js" (stesso nome senza ".example")
// e inserisci i valori del tuo progetto Firebase. "firebase-config.js" e'
// elencato in .gitignore, quindi non verra' mai committato.
//
// Nota: i valori "firebaseConfig" (apiKey, projectId, ecc.) non sono un
// segreto in senso stretto - Firebase li considera pubblici per design
// (sono visibili in qualsiasi app client). Vengono comunque tenuti fuori
// dal repo per semplicita' e per non dover toccare il codice sorgente
// ad ogni ambiente. La VERA chiave privata dell'Admin SDK NON deve mai
// stare qui: quella vive solo lato server, dentro la Cloud Function
// (funzioni Firebase gestiscono le credenziali admin automaticamente).
//
// Vedi il README.md per le istruzioni su come creare il progetto
// Firebase minimale e recuperare questi valori dalla console.

self.FIREBASE_CONFIG = {
  apiKey: "INSERISCI_API_KEY",
  authDomain: "TUO-PROGETTO.firebaseapp.com",
  projectId: "TUO-PROGETTO",
  storageBucket: "TUO-PROGETTO.appspot.com",
  messagingSenderId: "INSERISCI_SENDER_ID",
  appId: "INSERISCI_APP_ID",
};

// Chiave VAPID pubblica per Firebase Cloud Messaging su web
// (Console Firebase -> Project settings -> Cloud Messaging -> Web Push
// certificates -> "Generate key pair")
self.FIREBASE_VAPID_KEY = "INSERISCI_VAPID_KEY";

// URL della Cloud Function HTTP "sendMoodNotification", ottenuto dopo
// il deploy (es. https://REGION-PROGETTO.cloudfunctions.net/sendMoodNotification)
self.NOTIFY_FUNCTION_URL = "INSERISCI_URL_CLOUD_FUNCTION";
