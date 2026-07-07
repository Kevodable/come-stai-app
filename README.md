# Come stai? 💛

PWA a 2 utenti per condividere lo stato emotivo del momento, con timeline
diario e notifiche push. Nessun backend proprietario: i dati vivono in
`data/moods.json` su GitHub, le notifiche passano da una singola Cloud
Function Firebase.

## Struttura del progetto

```
index.html                     pagina unica dell'app
style.css                      stile "diario di coppia"
app.js                         logica: profilo, polling, scrittura su GitHub, timeline, notifiche
sw.js                          service worker (solo per le push FCM in background)
manifest.json                  manifest PWA
icons/                         icone 192/512/512-maskable/apple-touch-icon
data/moods.json                dati correnti + storico (stato attuale + history)

github-config.example.js       TEMPLATE - copialo in github-config.js
firebase-config.example.js     TEMPLATE - copialo in firebase-config.js

functions/index.js             Cloud Function HTTP "sendMoodNotification"
functions/package.json
firebase.json
firestore.rules
firestore.indexes.json
```

`github-config.js` e `firebase-config.js` sono nel `.gitignore`: **non
verranno mai committati** dal tuo git locale. Leggi bene la sezione
"Nota importante sul deploy dei file di configurazione" più sotto, perche'
riguarda direttamente come funziona (o non funziona) il sito online.

---

## Come funziona (in breve)

- **Lettura**: il browser legge `data/moods.json` da
  `raw.githubusercontent.com` ogni ~18 secondi (con un parametro random per
  evitare la cache) e aggiorna la UI se qualcosa e' cambiato.
- **Scrittura**: quando tocchi un'emoji, il browser chiama le GitHub
  Contents API per leggere il file corrente, aggiungere il nuovo evento
  alla `history`, aggiornare `current`, e fare il commit.
- **Notifiche**: subito dopo un salvataggio riuscito, il browser chiama
  una Cloud Function Firebase che legge da Firestore il token FCM
  dell'altra persona e le invia una push ("[Nome] ora si sente 😴").

## ⚠️ Nota di sicurezza sul token GitHub

Il Personal Access Token viene usato **lato client**, cioe' dentro il
codice che gira nel browser di chi visita il sito. Questo significa che
**chiunque apra gli strumenti sviluppatore puo' leggerlo**. Per questo:

1. Il token deve essere **fine-grained** e avere **solo** il permesso
   "Contents: Read and write" su **questo unico repository**.
2. Se possibile, tieni il repository dei dati **privato**.
3. Puoi revocare il token in qualsiasi momento da
   github.com/settings/tokens?type=beta, senza dover toccare il codice:
   basta rigenerarne uno nuovo e aggiornare `github-config.js`.

## ⚠️ Nota importante sul deploy dei file di configurazione

`github-config.js` e `firebase-config.js` sono ignorati da git apposta,
cosi' non finiscono per sbaglio nei tuoi commit quotidiani. **Ma** GitHub
Pages serve solo cio' che e' effettivamente presente nel repository: se
questi due file non ci sono, il sito pubblicato non funzionera' (mancano
token e configurazione Firebase).

Quindi, ogni volta che pubblichi o aggiorni il sito, devi far arrivare
questi due file (con i valori reali) DENTRO al repository su GitHub,
tenendoli pero' fuori dal tuo storico di commit locale. Due modi semplici:

- **Opzione A (consigliata) - upload manuale via interfaccia web GitHub**:
  vai sul repository su github.com → "Add file" → "Upload files" →
  trascina i tuoi `github-config.js` e `firebase-config.js` gia' compilati
  → commit direttamente dal browser. Non tocchi mai il tuo git locale, il
  file non compare mai nei tuoi `git log`/`git push` di routine.
- **Opzione B - da terminale, solo quando serve**: `git add -f
  github-config.js firebase-config.js && git commit -m "config" && git
  push`. Il flag `-f` forza l'aggiunta nonostante il `.gitignore`. Usalo
  solo per questo scopo specifico.

In entrambi i casi, il file finira' comunque nella cronologia del
repository su GitHub (e li' e' visibile a chiunque abbia accesso al repo).
Per questo la vera protezione e': permessi minimi sul token + repository
privato, non "nascondere" il file.

---

## 1. Creare un Personal Access Token fine-grained (permessi minimi)

1. Vai su https://github.com/settings/tokens?type=beta e clicca
   **"Generate new token"**.
2. **Token name**: es. `come-stai-app-data`.
3. **Expiration**: scegli una scadenza (es. 90 giorni) - ricordati di
   rigenerarlo quando scade.
4. **Repository access** → **"Only select repositories"** → seleziona
   solo il repository che contiene `data/moods.json` (es.
   `kevodable/come-stai-app`).
5. **Permissions** → **Repository permissions** → **Contents** → imposta
   **"Read and write"**. Lascia tutti gli altri permessi su "No access".
6. Clicca **"Generate token"** e copia il token (inizia con `github_pat_`):
   viene mostrato una sola volta.
7. Copia `github-config.example.js` in `github-config.js` e incolla il
   token nel campo `token`, insieme a `owner`, `repo`, `branch` e `path`
   corretti.

Per revocare il token in futuro: stessa pagina → click sul token →
**"Delete"**.

## 2. Creare il progetto Firebase minimale (Firestore + Functions + Messaging)

Niente Hosting: usiamo solo Firestore, Cloud Functions e Cloud Messaging.

1. Vai su https://console.firebase.google.com → **"Aggiungi progetto"** →
   dai un nome (es. `come-stai-app`) → completa la creazione (Google
   Analytics non serve, puoi disattivarlo).
2. **Firestore**: nel menu laterale → **Build → Firestore Database** →
   **"Crea database"** → modalita' **production** → scegli una region.
   Non serve creare manualmente la collection "tokens": verra' creata
   automaticamente al primo salvataggio del token da parte dell'app.
3. **Cloud Messaging**: nel menu laterale → **Build → Messaging** (basta
   che la sezione risulti abilitata; la vera configurazione la fai al
   punto 3 qui sotto per la VAPID key).
4. **App Web**: Project settings (icona ingranaggio) → in fondo a "Your
   apps" clicca l'icona `</>` per aggiungere una Web App → dalle un nome →
   NON serve configurare Firebase Hosting quando te lo chiede → copia i
   valori mostrati (`apiKey`, `authDomain`, `projectId`,
   `storageBucket`, `messagingSenderId`, `appId`) dentro
   `firebase-config.js` (copialo prima da `firebase-config.example.js`).
5. **Piano Blaze**: le Cloud Functions richiedono il piano a consumo
   "Blaze" (ha comunque una fascia gratuita generosa). Project settings →
   **Usage and billing** → **"Modify plan"** → **Blaze**.
6. Installa la CLI Firebase in locale (richiede Node.js):
   ```
   npm install -g firebase-tools
   firebase login
   ```
7. Nella cartella del progetto, collega la CLI al progetto Firebase creato:
   ```
   firebase use --add
   ```
   e seleziona il progetto appena creato quando richiesto (i file
   `firebase.json`, `firestore.rules`, `firestore.indexes.json` sono gia'
   pronti in questo repository).

## 3. Generare la VAPID key (necessaria per le notifiche push sul Web)

1. Console Firebase → **Project settings** → tab **"Cloud Messaging"**.
2. Scorri fino a **"Web configuration" → "Web Push certificates"**.
3. Clicca **"Generate key pair"**.
4. Copia la chiave generata dentro `firebase-config.js`, nel campo
   `FIREBASE_VAPID_KEY`.

## 4. Deployare le Cloud Functions

1. Installa le dipendenze:
   ```
   cd functions
   npm install
   cd ..
   ```
2. Pubblica le regole Firestore e la function:
   ```
   firebase deploy --only firestore:rules
   firebase deploy --only functions
   ```
3. Al termine, il terminale mostra l'URL della function, del tipo:
   `https://<region>-<project-id>.cloudfunctions.net/sendMoodNotification`
4. Incolla quell'URL in `firebase-config.js`, nel campo
   `NOTIFY_FUNCTION_URL`.

## 5. Pubblicare il sito su GitHub Pages

1. Crea (o usa) un repository GitHub e pusha tutti i file (tranne
   `github-config.js` / `firebase-config.js`, che restano gitignored):
   ```
   git add .
   git commit -m "Come stai? - PWA iniziale"
   git push -u origin main
   ```
2. Aggiungi i file di configurazione reali direttamente sul repository
   GitHub (vedi "Nota importante sul deploy dei file di configurazione"
   sopra: upload manuale via interfaccia web, oppure `git add -f`).
3. Su GitHub: **Settings** del repository → **Pages** → **"Build and
   deployment"** → Source: **"Deploy from a branch"** → Branch: `main`,
   cartella `/ (root)` → **Save**.
4. Dopo un minuto il sito sara' online su
   `https://<tuo-utente>.github.io/<nome-repo>/`.
5. Su iPhone: apri quell'URL in **Safari** → tasto **Condividi** →
   **"Aggiungi alla schermata Home"**. Da quel momento l'app si apre a
   schermo intero come un'app nativa, ed e' li' che va aperta per poter
   attivare le notifiche (richiede iOS 16.4+).
6. Apri l'app dalla home screen, scegli il tuo profilo ("Chi sei?"), poi
   tocca **"🔔 Attiva notifiche"**.

Fatto: ogni volta che una delle due persone tocca un'emoji, l'altra vede
lo stato aggiornarsi entro ~18 secondi e riceve una notifica push.
