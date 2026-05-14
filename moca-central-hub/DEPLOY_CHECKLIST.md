# ✅ Checklist Deploy Moca Hub

Stampa questa pagina o tienila aperta mentre fai il deploy!

---

## 🗄️ DATABASE SUPABASE

### Verifica Tabelle Create
- [ ] Tabella `clients` esiste
- [ ] Tabella `users` esiste
- [ ] Tabella `configurations` esiste
- [ ] Tabella `applications` esiste
- [ ] Tabella `application_access` esiste
- [ ] Tabella `logs` esiste
- [ ] Tabella `audit_logs` esiste

### Crea Utente Admin
- [ ] Creato utente in Supabase Auth (Authentication → Users)
- [ ] Copiato User ID (UUID)
- [ ] Creato client "Moca Interactive" in tabella `clients`
- [ ] Copiato Client ID (UUID)
- [ ] Creato record in tabella `users` collegando User ID e Client ID
- [ ] Verificato che role sia `admin` e level sia `5`

### Test Database
- [ ] Query `SELECT * FROM clients` ritorna almeno 1 riga
- [ ] Query `SELECT * FROM users` ritorna il tuo utente admin
- [ ] L'ID in `users` è IDENTICO all'ID in Authentication

---

## 🐙 GITHUB

### Repository Setup
- [ ] Creato repository su GitHub (pubblico o privato)
- [ ] Copiato URL del repository
- [ ] Eseguito `git init` nel progetto locale
- [ ] Eseguito `git add .`
- [ ] Eseguito `git commit -m "Initial commit"`
- [ ] Eseguito `git branch -M main`
- [ ] Eseguito `git remote add origin <URL>`
- [ ] Eseguito `git push -u origin main`

### Branch Develop
- [ ] Eseguito `git checkout -b develop`
- [ ] Eseguito `git push -u origin develop`
- [ ] Tornato a main con `git checkout main`

### Verifica
- [ ] Su GitHub vedo il codice nel branch `main`
- [ ] Su GitHub vedo il branch `develop`
- [ ] Tutti i file sono presenti (src/, public/, package.json, ecc.)

---

## 🌐 NETLIFY

### Account e Connessione
- [ ] Creato account Netlify (o fatto login)
- [ ] Cliccato "Add new site" → "Import an existing project"
- [ ] Selezionato "Deploy with GitHub"
- [ ] Autorizzato Netlify ad accedere a GitHub
- [ ] Trovato e selezionato il repository `moca-hub`

### Configurazione Build
- [ ] Branch: `main`
- [ ] Build command: `npm run build`
- [ ] Publish directory: `dist`
- [ ] Base directory: (vuoto)

### Variabili Ambiente
- [ ] Aggiunto `VITE_SUPABASE_URL` con valore corretto
- [ ] Aggiunto `VITE_SUPABASE_ANON_KEY` con valore corretto
- [ ] Verificato che le chiavi siano corrette (da Supabase → Settings → API)

### Deploy
- [ ] Cliccato "Deploy site"
- [ ] Aspettato 2-3 minuti
- [ ] Deploy completato con successo (verde ✓)
- [ ] Copiato URL del sito (es. `https://random-123.netlify.app`)

### Personalizzazione
- [ ] Cambiato nome sito (Site settings → Change site name)
- [ ] Nuovo URL: `https://moca-central-hub.netlify.app` (o il nome scelto)

### Branch Deploy per Staging
- [ ] Andato su Site settings → Build & deploy → Branch deploys
- [ ] Aggiunto branch `develop` ai deploy
- [ ] Salvato
- [ ] URL staging: `https://develop--moca-central-hub.netlify.app`

---

## 🧪 TEST APPLICAZIONE

### Login e Dashboard
- [ ] Aperto URL production
- [ ] Vedo pagina login con logo Moca
- [ ] Design corretto (colori rosso #E52217)
- [ ] Login con email e password admin
- [ ] Vedo la Dashboard
- [ ] Widget mostrano statistiche (1 client, 1 user, 0 apps)
- [ ] Tabella "Recent Logins" è visibile

### Test Clienti
- [ ] Cliccato menu "Clients"
- [ ] Vedo "Moca Interactive"
- [ ] Cliccato "Add Client"
- [ ] Creato client di test
- [ ] Client appare nella lista
- [ ] Posso modificare il client
- [ ] Design card corretto con bordo rosso on hover

### Test Utenti
- [ ] Cliccato menu "Users"
- [ ] Vedo il mio utente admin
- [ ] Filtri client e role funzionano
- [ ] Posso vedere dettagli utente

### Test Configurazioni
- [ ] Cliccato menu "Configurations"
- [ ] Selezionato un client dal dropdown
- [ ] Creato una configurazione di test
- [ ] Valori sensibili sono mascherati
- [ ] Posso rivelare valori con icona occhio

### Test Applicazioni
- [ ] Cliccato menu "Applications"
- [ ] Creato un'applicazione di test
- [ ] Aperto gestione accessi
- [ ] Concesso accesso a un client
- [ ] Accesso appare nella lista

### Test Logs
- [ ] Cliccato menu "Logging & Debug"
- [ ] Vedo log delle operazioni

### Test API Docs
- [ ] Cliccato menu "API Documentation"
- [ ] Documentazione completa visibile
- [ ] Posso copiare esempi cURL

### Test Logout
- [ ] Cliccato "Logout" in alto
- [ ] Torno alla pagina login
- [ ] Non posso accedere alle pagine senza login

---

## 🎨 DESIGN E BRAND

- [ ] Logo Moca visibile nell'header
- [ ] Colore principale rosso #E52217
- [ ] Sfondo chiaro con accenti rossi
- [ ] Font Figtree caricato e applicato
- [ ] Navbar nera #191919
- [ ] Card con bordo #FFE7E6
- [ ] Hover effetti con rosso Moca
- [ ] Responsive su mobile (testa con DevTools)

---

## 📱 TEST MULTI-DEVICE

- [ ] Desktop: tutto funziona
- [ ] Tablet: layout responsive
- [ ] Mobile: menu hamburger funziona
- [ ] Mobile: form compilabili
- [ ] Mobile: tabelle scrollabili

---

## 🔒 SICUREZZA

- [ ] URL inizia con HTTPS (automatico su Netlify)
- [ ] Row Level Security abilitato su tutte le tabelle
- [ ] Utenti possono vedere solo dati del loro client
- [ ] Admin può vedere tutto
- [ ] API keys mascherate nell'UI
- [ ] Logout pulisce la sessione

---

## 📊 MONITORAGGIO

- [ ] Netlify Analytics abilitato (opzionale)
- [ ] Supabase Logs attivo
- [ ] Email notifications Netlify configurate (opzionale)

---

## 📚 DOCUMENTAZIONE

- [ ] README.md presente
- [ ] GUIDA_SETUP_ITALIANO.md presente
- [ ] GUIDA_DEPLOY_NETLIFY.md presente
- [ ] setup-first-admin.sql presente
- [ ] .env.example presente

---

## ✅ DEPLOY COMPLETO

- [ ] Tutti i test passati
- [ ] Nessun errore nei log Netlify
- [ ] Nessun errore nei log Supabase
- [ ] Applicazione stabile e performante
- [ ] URL condiviso con team/cliente

---

## 🎉 CONGRATULAZIONI!

Se hai spuntato tutti i checkbox, il deploy è COMPLETO!

**Prossimi passi:**
1. Crea più utenti per testare i permessi
2. Popola il registry delle applicazioni
3. Configura backup database Supabase
4. Aggiungi dominio personalizzato
5. Configura email notifications

**URL Finali:**
- Production: `https://______________________.netlify.app`
- Staging: `https://develop--______________________.netlify.app`

Data deploy: ___________________
Deployato da: ___________________

---

💡 **Tip:** Salva questo file compilato per riferimento futuro!
