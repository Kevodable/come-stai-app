// github-config.js
//
// Nessun segreto qui dentro: solo il puntatore al repository/file dati.
// Il token GitHub NON vive in questo file - ogni persona lo inserisce una
// volta sola nell'app stessa (schermata "Token GitHub" al primo accesso),
// e resta salvato solo in locale (localStorage) sul proprio dispositivo.
// Questo evita che un vero token finisca mai nella cronologia del
// repository - GitHub revoca automaticamente i propri token se li rileva
// esposti in un repo pubblico, quindi va tenuto fuori da qui.

self.GITHUB_CONFIG = {
  // Proprietario del repository (utente o organizzazione GitHub)
  owner: "kevodable",

  // Nome del repository che contiene data/moods.json
  repo: "come-stai-app",

  // Branch su cui vive il file dati
  branch: "main",

  // Percorso del file JSON dentro il repository
  path: "data/moods.json",
};
