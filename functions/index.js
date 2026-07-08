// functions/index.js
//
// UNICA Cloud Function dell'app: riceve una richiesta HTTP POST dal
// frontend (fetch) subito dopo che il nuovo stato e' stato salvato con
// successo su GitHub, legge da Firestore ("tokens" collection) il token
// FCM dell'ALTRA persona e le invia una notifica push con l'Admin SDK.
//
// Nessun altro dato (mood, storia) passa da Firebase: tutto il resto
// vive in data/moods.json su GitHub.

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Deve rimanere in sync con PERSON_NAMES in app.js
const PERSON_NAMES = {
  personA: "Persona A",
  personB: "Persona B",
};

function otherPerson(person) {
  return person === "personA" ? "personB" : "personA";
}

exports.sendMoodNotification = functions.https.onRequest(async (req, res) => {
  // Chiamata direttamente dal browser via fetch(): serve CORS.
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { fromPerson, emoji, label, intensity } = req.body || {};
  if (!fromPerson || !emoji || !PERSON_NAMES[fromPerson]) {
    res.status(400).json({ error: "fromPerson ('personA'|'personB') ed emoji sono obbligatori" });
    return;
  }

  const toPerson = otherPerson(fromPerson);

  try {
    const tokenDoc = await admin.firestore().collection("tokens").doc(toPerson).get();
    if (!tokenDoc.exists || !tokenDoc.data().token) {
      res.status(200).json({ sent: false, reason: `Nessun token registrato per ${toPerson}` });
      return;
    }

    const token = tokenDoc.data().token;
    const fromName = PERSON_NAMES[fromPerson];
    const intensityWord = { 1: "lieve", 2: "media", 3: "forte" }[intensity];
    const body = label
      ? `${fromName} ora si sente ${emoji} ${label}${intensityWord ? ` (${intensityWord})` : ""}`
      : `${fromName} ora si sente ${emoji}`;

    await admin.messaging().send({
      token,
      notification: {
        title: "Come stai?",
        body,
      },
      webpush: {
        fcmOptions: { link: "/" },
      },
    });

    res.status(200).json({ sent: true });
  } catch (err) {
    // Token scaduto/non piu' valido (es. app disinstallata): lo rimuoviamo
    // cosi' i prossimi invii non falliscono inutilmente.
    if (
      err.code === "messaging/registration-token-not-registered" ||
      err.code === "messaging/invalid-registration-token"
    ) {
      await admin.firestore().collection("tokens").doc(toPerson).delete().catch(() => {});
      res.status(200).json({ sent: false, reason: "Token non piu' valido, rimosso." });
      return;
    }
    console.error("Invio notifica fallito", err);
    res.status(500).json({ error: "Invio notifica fallito", details: err.message });
  }
});
