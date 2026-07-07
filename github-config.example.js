// github-config.example.js
//
// COPIA questo file in "github-config.js" (stesso nome senza ".example")
// e inserisci i tuoi valori reali. "github-config.js" e' elencato in
// .gitignore: git non lo tracciera' mai, quindi il tuo vero token NON
// finira' mai nella cronologia del repository pubblico.
//
// ATTENZIONE - LEGGERE PRIMA DI USARE:
// Questo token viene usato lato client (dentro app.js, nel browser).
// Chiunque apra gli strumenti sviluppatore del sito puo' leggerlo dal
// codice sorgente caricato. Per questo motivo:
//   1. Il token DEVE essere "fine-grained" e limitato SOLO al permesso
//      "Contents: Read and write" su QUESTO SINGOLO repository.
//   2. Se possibile, tieni il repository dei DATI (o l'intero repo, se
//      unico) privato.
//   3. Puoi revocare/rigenerare il token in qualsiasi momento da
//      https://github.com/settings/tokens?type=beta
//   4. Se il token venisse esposto, revocalo subito e generane uno nuovo:
//      basta rifare il file github-config.js, non serve toccare il codice.
//
// Vedi il README.md per le istruzioni passo-passo su come creare il
// token fine-grained.

self.GITHUB_CONFIG = {
  // Proprietario del repository (utente o organizzazione GitHub)
  owner: "kevodable",

  // Nome del repository che contiene data/moods.json
  // (puo' essere lo stesso repo che ospita il sito, oppure un repo
  // separato e privato dedicato solo ai dati)
  repo: "come-stai-app",

  // Branch su cui vive il file dati
  branch: "main",

  // Percorso del file JSON dentro il repository
  path: "data/moods.json",

  // Personal Access Token fine-grained con permesso
  // "Contents: Read and write" SOLO su questo repository.
  // NON committare mai il vero token in un file tracciato da git.
  token: "INSERISCI_QUI_IL_TUO_TOKEN_FINE_GRAINED",
};
