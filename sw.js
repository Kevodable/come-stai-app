// sw.js
// Service worker minimale: serve solo a ricevere le notifiche push di
// Firebase Cloud Messaging quando l'app e' in background/chiusa, e a
// rendere l'app installabile come PWA. Non fa caching offline dei dati:
// lo stato deve sempre arrivare fresco da GitHub.

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");
importScripts("./firebase-config.js");

firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

// Il messaggio arriva come "data" puro (non "notification"): la
// costruiamo qui una sola volta, cosi' non c'e' rischio di doppioni con
// la visualizzazione automatica del browser.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || "Come stai?", {
    body: data.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    data: { url: data.url || "./" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
