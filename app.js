// app.js
// Logica dell'app "Come stai?" - nessun framework, solo JS vanilla.
//
// Panoramica:
//  - I DATI (stato corrente + storia) vivono in data/moods.json su GitHub.
//  - LETTURA: raw.githubusercontent.com in polling ogni POLL_MS millisecondi.
//  - SCRITTURA: GitHub Contents API (read-sha -> modifica -> commit).
//  - NOTIFICHE PUSH: dopo un salvataggio riuscito, si chiama una Cloud
//    Function Firebase che notifica l'altra persona via FCM.

// ---------------------------------------------------------------------
// Configurazione facilmente modificabile
// ---------------------------------------------------------------------

// Nomi visualizzati dei due profili fissi. Modifica pure questi valori:
// tutto il resto del codice li legge da qui.
const PERSON_NAMES = {
  personA: "Persona A",
  personB: "Persona B",
};

// Emoji disponibili per impostare il proprio stato
const MOOD_EMOJIS = ["😊", "😍", "😴", "😢", "😡", "😰", "🥳", "😌", "🤒", "😐"];

const POLL_MS = 18000; // 18s: dentro il range 15-20s richiesto
const HISTORY_PAGE_SIZE = 50;
const PROFILE_STORAGE_KEY = "comeStaiApp.myPerson";

const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

// ---------------------------------------------------------------------
// Stato in memoria
// ---------------------------------------------------------------------

const STATE = {
  myPerson: null,
  lastData: null,
  historyShowCount: HISTORY_PAGE_SIZE,
  pollTimer: null,
};

const els = {};

// ---------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if (!isConfigPresent()) {
    document.getElementById("config-missing").classList.remove("hidden");
    return;
  }

  cacheDom();
  buildMoodGrid();
  bindEvents();
  initProfile();
  registerServiceWorker();

  try {
    const data = await fetchMoods();
    handleIncomingData(data);
  } catch (err) {
    console.error("Errore al primo caricamento", err);
    els.otherTime.textContent = "Impossibile contattare GitHub. Riprovo tra poco…";
  }

  STATE.pollTimer = setTimeout(pollLoop, POLL_MS);
  setInterval(() => {
    if (STATE.lastData) renderOtherStatus(STATE.lastData);
  }, 30000);
}

function isConfigPresent() {
  const gh = self.GITHUB_CONFIG;
  const fb = self.FIREBASE_CONFIG;
  if (!gh || !gh.token || gh.token.startsWith("INSERISCI")) return false;
  if (!fb || !fb.apiKey || fb.apiKey.startsWith("INSERISCI")) return false;
  return true;
}

function cacheDom() {
  els.whoAreYou = document.getElementById("who-are-you");
  els.app = document.getElementById("app");
  els.switchProfile = document.getElementById("switch-profile");
  els.otherName = document.getElementById("other-name");
  els.otherEmoji = document.getElementById("other-emoji");
  els.otherTime = document.getElementById("other-time");
  els.notifyBtn = document.getElementById("notify-btn");
  els.notifyHint = document.getElementById("notify-hint");
  els.moodGrid = document.getElementById("mood-grid");
  els.saveStatus = document.getElementById("save-status");
  els.timeline = document.getElementById("timeline");
  els.timelineEmpty = document.getElementById("timeline-empty");
  els.loadMore = document.getElementById("load-more");
  els.tabBtns = Array.from(document.querySelectorAll(".tab-btn"));
}

function bindEvents() {
  document.querySelectorAll(".who-btn").forEach((btn) => {
    btn.addEventListener("click", () => chooseProfile(btn.dataset.person));
  });

  els.switchProfile.addEventListener("click", () => {
    if (confirm("Cambiare profilo su questo dispositivo?")) {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      STATE.myPerson = null;
      els.app.classList.add("hidden");
      els.whoAreYou.classList.remove("hidden");
    }
  });

  els.notifyBtn.addEventListener("click", enableNotifications);

  els.loadMore.addEventListener("click", () => {
    STATE.historyShowCount += HISTORY_PAGE_SIZE;
    if (STATE.lastData) renderTimeline(STATE.lastData);
  });

  els.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchScreen(btn.dataset.screen));
  });
}

function switchScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === screenId));
  els.tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.screen === screenId));
  if (screenId === "screen-history" && STATE.lastData) {
    renderTimeline(STATE.lastData);
  }
}

// ---------------------------------------------------------------------
// Profilo ("Chi sei?") - salvato in localStorage, locale al dispositivo
// ---------------------------------------------------------------------

function initProfile() {
  const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (saved === "personA" || saved === "personB") {
    STATE.myPerson = saved;
    showApp();
  } else {
    els.whoAreYou.classList.remove("hidden");
  }
}

function chooseProfile(person) {
  localStorage.setItem(PROFILE_STORAGE_KEY, person);
  STATE.myPerson = person;
  showApp();
}

function showApp() {
  els.whoAreYou.classList.add("hidden");
  els.app.classList.remove("hidden");
  if (STATE.lastData) renderAll(STATE.lastData);
}

function otherPersonKey() {
  return STATE.myPerson === "personA" ? "personB" : "personA";
}

// ---------------------------------------------------------------------
// Griglia emoji
// ---------------------------------------------------------------------

function buildMoodGrid() {
  els.moodGrid.innerHTML = "";
  MOOD_EMOJIS.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.className = "mood-btn";
    btn.type = "button";
    btn.dataset.emoji = emoji;
    btn.textContent = emoji;
    btn.addEventListener("click", () => setMyMood(emoji));
    els.moodGrid.appendChild(btn);
  });
}

function disableMoodGrid(disabled) {
  els.moodGrid.querySelectorAll(".mood-btn").forEach((b) => (b.disabled = disabled));
}

function setSaveStatus(text) {
  els.saveStatus.textContent = text;
}

// ---------------------------------------------------------------------
// Lettura dati (polling da raw.githubusercontent.com)
// ---------------------------------------------------------------------

function rawUrl() {
  const c = self.GITHUB_CONFIG;
  return `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch}/${c.path}`;
}

function cacheBust(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_=${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fetchMoods() {
  const c = self.GITHUB_CONFIG;
  const headers = {};
  // Serve solo se il repository e' privato; su repo pubblico e' innocuo.
  if (c.token) headers.Authorization = `Bearer ${c.token}`;
  const res = await fetch(cacheBust(rawUrl()), { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Lettura fallita (${res.status})`);
  return res.json();
}

async function pollLoop() {
  try {
    const data = await fetchMoods();
    handleIncomingData(data);
  } catch (err) {
    console.warn("Polling fallito", err);
  } finally {
    STATE.pollTimer = setTimeout(pollLoop, POLL_MS);
  }
}

function handleIncomingData(data) {
  STATE.lastData = data;
  if (!STATE.myPerson) return;
  renderAll(data);
}

function renderAll(data) {
  renderOtherStatus(data);
  renderMySelection(data);
  const historyScreen = document.getElementById("screen-history");
  if (historyScreen.classList.contains("active")) {
    renderTimeline(data);
  }
}

function renderOtherStatus(data) {
  const other = otherPersonKey();
  const info = (data.current && data.current[other]) || {};
  els.otherName.textContent = PERSON_NAMES[other];
  els.otherEmoji.textContent = info.emoji || "🤔";
  els.otherTime.textContent = relativeShort(info.timestamp);
}

function renderMySelection(data) {
  const mine = (data.current && data.current[STATE.myPerson]) || {};
  els.moodGrid.querySelectorAll(".mood-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.emoji === mine.emoji);
  });
}

// ---------------------------------------------------------------------
// Scrittura dati (GitHub Contents API: leggi sha -> modifica -> commit)
// ---------------------------------------------------------------------

function contentsApiUrl() {
  const c = self.GITHUB_CONFIG;
  return `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${c.path}`;
}

async function getFileForWrite() {
  const c = self.GITHUB_CONFIG;
  const res = await fetch(`${contentsApiUrl()}?ref=${encodeURIComponent(c.branch)}`, {
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw statusError(res, "Impossibile leggere il file per la scrittura");
  const json = await res.json();
  const content = JSON.parse(b64DecodeUnicode(json.content.replace(/\n/g, "")));
  return { content, sha: json.sha };
}

async function putFile(newContentObj, sha, message) {
  const c = self.GITHUB_CONFIG;
  const body = {
    message,
    content: b64EncodeUnicode(JSON.stringify(newContentObj, null, 2)),
    sha,
    branch: c.branch,
  };
  const res = await fetch(contentsApiUrl(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw statusError(res, "Scrittura fallita");
  return res.json();
}

function statusError(res, message) {
  const err = new Error(`${message} (${res.status})`);
  err.status = res.status;
  return err;
}

async function setMyMood(emoji) {
  if (!STATE.myPerson) return;
  disableMoodGrid(true);
  setSaveStatus("Salvataggio in corso…");

  const maxAttempts = 3;
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { content, sha } = await getFileForWrite();
      const nowIso = new Date().toISOString();

      content.current = content.current || {};
      content.current[STATE.myPerson] = { emoji, timestamp: nowIso };
      content.history = content.history || [];
      content.history.push({ person: STATE.myPerson, emoji, timestamp: nowIso });

      await putFile(content, sha, `Aggiorna stato di ${PERSON_NAMES[STATE.myPerson]}: ${emoji}`);

      STATE.lastData = content;
      renderAll(content);
      setSaveStatus("Salvato ✓");
      setTimeout(() => setSaveStatus(""), 2000);
      notifyOtherPerson(STATE.myPerson, emoji);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      // 409/422: qualcun altro ha scritto nel frattempo (sha non piu' valido).
      // Ritenta rileggendo il file aggiornato.
      if ((err.status === 409 || err.status === 422) && attempt < maxAttempts) {
        continue;
      }
      break;
    }
  }

  if (lastErr) {
    console.error(lastErr);
    const detail = lastErr.status ? `${lastErr.status}` : lastErr.message;
    setSaveStatus(`⚠️ Salvataggio non riuscito (${detail}). Riprova.`);
  }

  disableMoodGrid(false);
}

// Base64 <-> UTF-8 (necessario per via delle emoji nel JSON)
function b64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)))
  );
}

function b64DecodeUnicode(str) {
  return decodeURIComponent(
    atob(str)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

// ---------------------------------------------------------------------
// Timeline ("Storia") - raggruppata per giorno, stile diario
// ---------------------------------------------------------------------

function renderTimeline(data) {
  const history = data.history || [];
  const total = history.length;

  if (total === 0) {
    els.timeline.innerHTML = "";
    els.timelineEmpty.classList.remove("hidden");
    els.loadMore.classList.add("hidden");
    return;
  }
  els.timelineEmpty.classList.add("hidden");

  const showCount = Math.min(STATE.historyShowCount, total);
  // Gli eventi piu' recenti sono in coda all'array: prendiamo l'ultima
  // porzione e la mostriamo dal piu' recente al piu' vecchio.
  const slice = history.slice(Math.max(0, total - showCount), total).reverse();

  const now = new Date();
  const groups = [];
  let lastLabel = null;
  for (const ev of slice) {
    const d = new Date(ev.timestamp);
    const label = dayLabel(d, now);
    if (label !== lastLabel) {
      groups.push({ label, items: [] });
      lastLabel = label;
    }
    groups[groups.length - 1].items.push(ev);
  }

  els.timeline.innerHTML = groups
    .map(
      (group) => `
      <div class="timeline-day">
        <p class="timeline-day-label">${escapeHtml(group.label)}</p>
        ${group.items.map((ev) => renderTimelineEntry(ev, now)).join("")}
      </div>
    `
    )
    .join("");

  els.loadMore.classList.toggle("hidden", showCount >= total);
}

function renderTimelineEntry(ev, now) {
  const d = new Date(ev.timestamp);
  const name = PERSON_NAMES[ev.person] || ev.person;
  const when = isSameDay(d, now)
    ? `oggi alle ${timeHM(d)}`
    : isSameDay(d, yesterdayOf(now))
    ? `ieri alle ${timeHM(d)}`
    : `alle ${timeHM(d)}`;

  return `
    <div class="timeline-entry">
      <div class="timeline-emoji">${escapeHtml(ev.emoji)}</div>
      <div class="timeline-body">
        <p class="timeline-person">${escapeHtml(name)}</p>
        <p class="timeline-when">${escapeHtml(when)}</p>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// ---------------------------------------------------------------------
// Formattazione date in italiano
// ---------------------------------------------------------------------

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

function timeHM(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isSameDay(a, b) {
  return stripTime(a) === stripTime(b);
}

function yesterdayOf(d) {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return y;
}

function dayLabel(date, now) {
  if (isSameDay(date, now)) return "Oggi";
  if (isSameDay(date, yesterdayOf(now))) return "Ieri";
  const diffDays = Math.round((stripTime(now) - stripTime(date)) / 86400000);
  if (diffDays < 7) return GIORNI[date.getDay()];
  return `${GIORNI[date.getDay()]} ${date.getDate()} ${MESI[date.getMonth()]}`;
}

function relativeShort(timestamp) {
  if (!timestamp) return "nessun dato ancora";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);

  if (diffMin < 1) return "aggiornato adesso";
  if (diffMin < 60) return `aggiornato ${diffMin} minut${diffMin === 1 ? "o" : "i"} fa`;

  if (isSameDay(date, now)) return `aggiornato oggi alle ${timeHM(date)}`;
  if (isSameDay(date, yesterdayOf(now))) return `aggiornato ieri alle ${timeHM(date)}`;

  const diffDays = Math.round((stripTime(now) - stripTime(date)) / 86400000);
  if (diffDays < 7) return `aggiornato ${GIORNI[date.getDay()]} alle ${timeHM(date)}`;
  return `aggiornato il ${date.getDate()} ${MESI[date.getMonth()]} alle ${timeHM(date)}`;
}

// ---------------------------------------------------------------------
// Notifiche push (Firebase Cloud Messaging)
// ---------------------------------------------------------------------

function getFirebaseApp() {
  return firebase.apps.length ? firebase.app() : firebase.initializeApp(self.FIREBASE_CONFIG);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("sw.js");
  } catch (err) {
    console.warn("Registrazione service worker fallita", err);
    return null;
  }
}

function isIosNotStandalone() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return isIos && !isStandalone;
}

function setNotifyHint(text) {
  els.notifyHint.textContent = text;
  els.notifyHint.classList.toggle("hidden", !text);
}

async function enableNotifications() {
  if (isIosNotStandalone()) {
    setNotifyHint(
      "Su iPhone le notifiche funzionano solo dopo aver aggiunto questa pagina alla schermata Home " +
        "(tasto Condividi → Aggiungi a Home), e solo aprendo l'app da li'. Poi torna qui e riprova."
    );
    return;
  }
  if (!("Notification" in window)) {
    setNotifyHint("Le notifiche non sono supportate su questo browser.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotifyHint("Permesso negato. Puoi riattivarlo dalle impostazioni del browser/sistema.");
      return;
    }

    const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
    getFirebaseApp();
    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: self.FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) throw new Error("Token FCM non ottenuto");

    await saveFcmToken(token);
    setNotifyHint("Notifiche attive ✓");

    messaging.onMessage((payload) => {
      const body = (payload.notification && payload.notification.body) || "";
      setSaveStatus(body);
      setTimeout(() => setSaveStatus(""), 4000);
    });
  } catch (err) {
    console.error(err);
    setNotifyHint("Errore nell'attivazione delle notifiche: " + err.message);
  }
}

async function saveFcmToken(token) {
  const db = firebase.firestore();
  await db
    .collection("tokens")
    .doc(STATE.myPerson)
    .set(
      {
        token,
        person: STATE.myPerson,
        updatedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      },
      { merge: true }
    );
}

async function notifyOtherPerson(fromPerson, emoji) {
  const url = self.NOTIFY_FUNCTION_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromPerson, emoji }),
    });
  } catch (err) {
    console.warn("Notifica push non inviata", err);
  }
}
