# 🚀 Guida Completa: Deploy Moca Hub su Netlify

## 📋 Pre-requisiti

Prima di iniziare, assicurati di avere:
- ✅ Un account GitHub (crea uno su https://github.com se non ce l'hai)
- ✅ Un account Netlify (crea uno su https://netlify.com se non ce l'hai)
- ✅ Un progetto Supabase funzionante con le tabelle create
- ✅ Git installato sul tuo computer

---

## 🎯 PARTE 1: Preparare il Database Supabase

### Step 1.1: Verifica che le Tabelle Siano Create

1. Vai alla tua [Dashboard Supabase](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Nel menu laterale, clicca su **"Table Editor"**
4. Verifica che esistano queste tabelle:
   - ✅ `clients`
   - ✅ `users`
   - ✅ `configurations`
   - ✅ `applications`
   - ✅ `application_access`
   - ✅ `logs`
   - ✅ `audit_logs`

**Se le tabelle NON esistono**: Sono già state create automaticamente dal sistema di migration. Se hai problemi, vai su **SQL Editor** e esegui il file di migration.

### Step 1.2: Crea il Primo Utente Admin

Questo è FONDAMENTALE per poter accedere all'applicazione!

#### A. Crea un utente in Supabase Auth

1. Nella Dashboard Supabase, vai su **"Authentication"** → **"Users"** (nel menu laterale)
2. Clicca sul pulsante **"Add user"** in alto a destra
3. Seleziona **"Create new user"**
4. Compila il form:
   - **Email**: `admin@mocainteractive.com` (o la tua email preferita)
   - **Password**: Scegli una password sicura (ricordala!)
   - **Auto Confirm User**: Lascia selezionato ✅
5. Clicca su **"Create user"**
6. **IMPORTANTISSIMO**: Nella lista utenti, **copia il User ID (UUID)** dell'utente appena creato
   - Lo trovi nella colonna "ID"
   - Sarà qualcosa tipo: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - **COPIALO e tienilo da parte!**

#### B. Crea un Client nel Database

1. Nella Dashboard Supabase, vai su **"Table Editor"**
2. Seleziona la tabella **`clients`**
3. Clicca su **"Insert"** → **"Insert row"**
4. Compila:
   - **name**: `Moca Interactive`
   - **email**: `admin@mocainteractive.com`
   - **status**: `active` (seleziona dal dropdown)
5. Clicca su **"Save"**
6. **IMPORTANTE**: Dopo aver salvato, clicca sulla riga appena creata e **copia il `id` (UUID)**
   - Sarà qualcosa tipo: `b2c3d4e5-f6a7-8901-bcde-f12345678901`
   - **COPIALO e tienilo da parte!**

#### C. Collega l'Utente Auth alla Tabella Users

1. Sempre in **"Table Editor"**, seleziona la tabella **`users`**
2. Clicca su **"Insert"** → **"Insert row"**
3. Compila TUTTI i campi:
   - **id**: Incolla qui il **User ID** copiato dallo Step A
   - **client_id**: Incolla qui il **Client ID** copiato dallo Step B
   - **email**: `admin@mocainteractive.com` (stessa email di prima)
   - **name**: `Admin Moca` (o il tuo nome)
   - **role**: `admin` (seleziona dal dropdown)
   - **level**: `5`
   - **status**: `active` (seleziona dal dropdown)
4. Clicca su **"Save"**

✅ **Perfetto!** Ora hai un utente admin funzionante!

---

## 🗂️ PARTE 2: Pubblicare il Codice su GitHub

### Step 2.1: Crea un Repository su GitHub

1. Vai su [GitHub](https://github.com)
2. Clicca sul **"+"** in alto a destra → **"New repository"**
3. Compila:
   - **Repository name**: `moca-hub` (o il nome che preferisci)
   - **Description**: "Moca Hub - Centralized Management System"
   - **Visibility**: Scegli **Private** (consigliato) o Public
   - **NON** selezionare "Add a README file"
   - **NON** selezionare ".gitignore"
   - **NON** selezionare "Choose a license"
4. Clicca su **"Create repository"**
5. **Lascia aperta questa pagina**, ti servirà l'URL del repository

### Step 2.2: Pubblica il Codice

Apri il terminale nella cartella del tuo progetto e esegui questi comandi uno alla volta:

```bash
# 1. Inizializza git (se non è già fatto)
git init

# 2. Aggiungi tutti i file
git add .

# 3. Crea il primo commit
git commit -m "Initial commit: Moca Hub complete"

# 4. Crea il branch main
git branch -M main

# 5. Collega al repository GitHub
# Sostituisci <USERNAME> con il tuo username GitHub
# Sostituisci <REPOSITORY> con il nome del repository (es. moca-hub)
git remote add origin https://github.com/<USERNAME>/<REPOSITORY>.git

# 6. Pusha il codice su GitHub
git push -u origin main
```

**Esempio concreto**:
```bash
git remote add origin https://github.com/mocainteractive/moca-hub.git
git push -u origin main
```

### Step 2.3: Crea il Branch Develop (per staging)

```bash
# 1. Crea e cambia al branch develop
git checkout -b develop

# 2. Pusha il branch develop
git push -u origin develop

# 3. Torna al branch main
git checkout main
```

✅ **Ottimo!** Il codice è ora su GitHub!

---

## 🌐 PARTE 3: Deploy su Netlify

### Step 3.1: Connetti GitHub a Netlify

1. Vai su [Netlify](https://app.netlify.com)
2. Fai login (o crea un account se non ce l'hai)
3. Nella dashboard, clicca su **"Add new site"** → **"Import an existing project"**
4. Seleziona **"Deploy with GitHub"**
5. Se è la prima volta, autorizza Netlify ad accedere a GitHub
6. Nella lista dei repository, trova **`moca-hub`** (o il nome che hai usato)
   - Se non lo vedi, clicca su **"Configure Netlify on GitHub"** e dai accesso al repository
7. Clicca sul repository

### Step 3.2: Configura il Build

Nella schermata di configurazione:

1. **Branch to deploy**: Lascia `main`
2. **Base directory**: Lascia vuoto
3. **Build command**: `npm run build`
4. **Publish directory**: `dist`
5. Clicca su **"Show advanced"** → **"New variable"** e aggiungi le variabili d'ambiente:

   **Variabile 1:**
   - Key: `VITE_SUPABASE_URL`
   - Value: Il tuo URL Supabase (es. `https://yourproject.supabase.co`)

   **Variabile 2:**
   - Key: `VITE_SUPABASE_ANON_KEY`
   - Value: La tua Supabase Anon Key

   **Dove trovo questi valori?**
   - Vai su Supabase Dashboard → Settings → API
   - **URL** lo trovi in "Project URL"
   - **Anon Key** lo trovi in "Project API keys" → `anon` `public`

6. Clicca su **"Deploy site"**

🎉 **Netlify inizierà il deploy!** Aspetta 2-3 minuti.

### Step 3.3: Verifica il Deploy

1. Quando il deploy è completato, vedrai **"Site is live"** con un URL tipo:
   - `https://random-name-123456.netlify.app`
2. Clicca sull'URL per aprire il sito
3. Dovresti vedere la pagina di login di Moca Hub!

### Step 3.4: Personalizza il Dominio (opzionale)

1. Nel tuo sito Netlify, vai su **"Site settings"**
2. Clicca su **"Change site name"**
3. Inserisci un nome personalizzato (es. `moca-hub`)
4. Il tuo sito sarà ora disponibile su: `https://moca-central-hub.netlify.app`

### Step 3.5: Configura il Branch Develop per Staging

1. Nel tuo sito Netlify, vai su **"Site settings"** → **"Build & deploy"**
2. Scorri fino a **"Branch deploys"**
3. Clicca su **"Configure"**
4. In "Branch deploy contexts", seleziona **"Let me add individual branches"**
5. Aggiungi il branch: `develop`
6. Clicca su **"Save"**

Ora avrai:
- **Production**: `https://moca-central-hub.netlify.app` (branch `main`)
- **Staging**: `https://develop--moca-central-hub.netlify.app` (branch `develop`)

---

## 🧪 PARTE 4: Testa l'Applicazione Online

### Step 4.1: Primo Login

1. Vai al tuo sito: `https://moca-central-hub.netlify.app` (o il tuo URL)
2. Dovresti vedere la pagina di login con il logo Moca
3. Inserisci le credenziali:
   - **Email**: `admin@mocainteractive.com` (o l'email che hai usato)
   - **Password**: La password che hai creato in Supabase Auth
4. Clicca su **"Sign In"**

✅ **Se tutto funziona**, vedrai la Dashboard!

### Step 4.2: Test Completo delle Funzionalità

Ora testa ogni sezione:

#### 1. Dashboard
- ✅ Vedi le statistiche (totale clienti, utenti, applicazioni)
- ✅ Vedi la tabella "Recent Logins"

#### 2. Clienti
- ✅ Clicca su "Clients" nel menu
- ✅ Dovresti vedere "Moca Interactive"
- ✅ Clicca su **"Add Client"**
- ✅ Crea un client di test:
  - Name: `Test Company`
  - Email: `test@example.com`
  - Status: Active
- ✅ Clicca "Create"
- ✅ Verifica che appaia nella lista

#### 3. Utenti
- ✅ Clicca su "Users" nel menu
- ✅ Dovresti vedere il tuo utente admin
- ✅ Clicca su **"Add User"**
- ✅ **IMPORTANTE**: Prima devi creare un altro utente in Supabase Auth!
  - Vai su Supabase → Authentication → Users → Add user
  - Crea l'utente con email e password
  - Copia il User ID
- ✅ Torna su Moca Hub e compila:
  - Client: Seleziona "Test Company"
  - Email: L'email dell'utente creato
  - Name: Un nome a tua scelta
  - Role: User
  - Level: 2
- ✅ Clicca "Create"

#### 4. Configurazioni
- ✅ Clicca su "Configurations" nel menu
- ✅ Seleziona "Test Company" dal dropdown
- ✅ Clicca su **"Add Configuration"**
- ✅ Compila:
  - Config Key: `OPENAI_API_KEY`
  - Config Value: `sk-test-123456789` (valore fake per test)
  - Type: API Key
  - Mark as sensitive: ✅
- ✅ Clicca "Create"
- ✅ Verifica che il valore sia mascherato (mostra solo `••••••••89`)

#### 5. Applicazioni
- ✅ Clicca su "Applications" nel menu
- ✅ Clicca su **"Add Application"**
- ✅ Compila:
  - Name: `CRM System`
  - Description: `Customer relationship management`
  - URL: `https://crm.example.com`
  - Status: Active
- ✅ Clicca "Create"
- ✅ Clicca su **"Access"** sull'applicazione appena creata
- ✅ Concedi accesso a "Test Company"
- ✅ Seleziona Access Level: Full
- ✅ Clicca "Grant Access"

#### 6. Logging & Debug
- ✅ Clicca su "Logging & Debug" nel menu
- ✅ Verifica che vedi i log delle operazioni

#### 7. API Documentation
- ✅ Clicca su "API Documentation" nel menu
- ✅ Scorri e verifica che la documentazione sia completa
- ✅ Prova a copiare un esempio cURL

#### 8. Logout
- ✅ Clicca sul pulsante "Logout" in alto a destra
- ✅ Verifica di tornare alla pagina di login

---

## 🎨 PARTE 5: Personalizzazioni (Opzionale)

### Cambiare il Favicon

1. Nel progetto, vai su `public/` (crea la cartella se non esiste)
2. Aggiungi il tuo `favicon.ico` o `favicon.svg`
3. Modifica `index.html`:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```
4. Pusha le modifiche:
```bash
git add .
git commit -m "Update favicon"
git push origin main
```

### Aggiungere un Dominio Personalizzato

1. Nel sito Netlify, vai su **"Domain settings"**
2. Clicca su **"Add custom domain"**
3. Inserisci il tuo dominio (es. `hub.mocainteractive.com`)
4. Segui le istruzioni per configurare i DNS

---

## 🐛 Troubleshooting

### Problema: "Errore di login"

**Soluzione**:
1. Verifica che l'utente esista in Supabase Auth
2. Verifica che l'utente sia collegato nella tabella `users` con l'ID corretto
3. Controlla che le variabili d'ambiente su Netlify siano corrette

### Problema: "Cannot read properties of undefined"

**Soluzione**:
1. Vai su Netlify → Site settings → Environment variables
2. Verifica che `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` siano impostate
3. Se le hai appena aggiunte, fai un nuovo deploy:
   - Vai su Deploys → Trigger deploy → Deploy site

### Problema: "Pagina bianca dopo il deploy"

**Soluzione**:
1. Vai su Netlify → Deploys → Seleziona l'ultimo deploy
2. Clicca su "Deploy log" e cerca errori
3. Se vedi errori TypeScript, controlla il codice localmente con `npm run build`

### Problema: "404 su route diverse dalla home"

**Soluzione**:
Il file `netlify.toml` dovrebbe già gestirlo, ma se persiste:
1. Verifica che `netlify.toml` sia presente nella root del progetto
2. Verifica che contenga:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Problema: "Row Level Security policy violation"

**Soluzione**:
1. Vai su Supabase → Table Editor → Seleziona la tabella
2. Verifica che RLS sia abilitato
3. Vai su Supabase → SQL Editor
4. Verifica che le policies siano state create correttamente

---

## 📊 Monitoraggio

### Netlify Analytics (Opzionale)

1. Nel tuo sito Netlify, vai su **"Analytics"**
2. Puoi abilitare le analytics per monitorare:
   - Visite al sito
   - Errori 404
   - Performance

### Supabase Logs

1. Vai su Supabase Dashboard → Logs
2. Qui puoi vedere:
   - Query al database
   - Errori di autenticazione
   - Performance delle query

---

## 🎯 Checklist Finale

Prima di considerare il deploy completo:

- [ ] Sito accessibile online
- [ ] Login funzionante con utente admin
- [ ] Dashboard mostra statistiche corrette
- [ ] Posso creare/modificare clienti
- [ ] Posso creare/modificare utenti
- [ ] Posso aggiungere configurazioni
- [ ] Posso registrare applicazioni
- [ ] I log vengono registrati
- [ ] Il design Moca è corretto (colori rossi, logo visibile)
- [ ] Logout funziona
- [ ] Branch develop deployato su URL staging

---

## 🚀 Deploy Futuri

Quando modifichi il codice:

### Per Production (main)
```bash
git add .
git commit -m "Descrizione modifiche"
git push origin main
```
→ Deploy automatico su `https://moca-central-hub.netlify.app`

### Per Staging (develop)
```bash
git checkout develop
git add .
git commit -m "Descrizione modifiche"
git push origin develop
git checkout main
```
→ Deploy automatico su `https://develop--moca-central-hub.netlify.app`

---

## 🎉 Congratulazioni!

Hai completato con successo il deploy di Moca Hub su Netlify!

L'applicazione è ora:
- ✅ Online e accessibile 24/7
- ✅ Sicura con HTTPS
- ✅ Scalabile grazie a Netlify
- ✅ Con database robusto su Supabase
- ✅ Con deploy automatici da GitHub

**Prossimi passi consigliati**:
1. Configura backup automatici del database Supabase
2. Aggiungi monitoraggio degli errori (es. Sentry)
3. Configura email notifications per eventi importanti
4. Implementa 2FA per utenti admin
5. Aggiungi più applicazioni al registry

**Hai bisogno di aiuto?** Consulta la documentazione o contatta il team Moca Interactive.
