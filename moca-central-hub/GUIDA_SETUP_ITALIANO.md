# Guida Setup Moca Hub (Italiano)

## Panoramica del Progetto

Hai appena creato **Moca Hub**, un sistema centralizzato di gestione utenti, clienti e configurazioni per l'ecosistema Moca. Questa applicazione è il cuore di un'architettura a microservizi e fornisce:

- ✅ Autenticazione centralizzata con Supabase
- ✅ Gestione clienti (multi-tenant)
- ✅ Gestione utenti con ruoli e permessi granulari
- ✅ Configurazioni specifiche per cliente (API keys, variabili)
- ✅ Registry delle applicazioni con controllo degli accessi
- ✅ Sistema di logging e debug
- ✅ Documentazione API completa
- ✅ Design seguendo la brand identity Moca (rosso #E52217)

## Stato Attuale

✅ **Completato**:
- Database schema creato con tutte le tabelle
- Sistema di autenticazione configurato
- Tutte le pagine implementate (Dashboard, Clienti, Utenti, Configurazioni, Applicazioni, Logs, API Docs)
- Design Moca applicato (colori, font Figtree, logo)
- Build funzionante

## Prossimi Passi per Avviare l'Applicazione

### 1. Creare il Primo Utente Admin

Per accedere all'applicazione, devi prima creare un utente admin. Segui questi passaggi:

#### A. Crea un utente in Supabase Auth

1. Vai alla [Dashboard di Supabase](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Nel menu laterale, vai su **Authentication** → **Users**
4. Clicca su **"Add user"** → **"Create new user"**
5. Inserisci:
   - **Email**: `admin@mocainteractive.com` (o l'email che preferisci)
   - **Password**: Scegli una password sicura
   - Lascia "Auto Confirm User" selezionato
6. Clicca su **"Create user"**
7. **IMPORTANTE**: Copia l'**User ID (UUID)** che appare nella lista utenti

#### B. Crea il client e collega l'utente

1. Nella Dashboard di Supabase, vai su **Table Editor**
2. Seleziona la tabella **`clients`**
3. Clicca su **"Insert"** → **"Insert row"**
4. Inserisci:
   - **name**: `Moca Interactive`
   - **email**: `admin@mocainteractive.com`
   - **status**: `active`
5. Clicca su **"Save"**
6. **Copia il `id` (UUID)** del client appena creato

#### C. Collega l'utente auth alla tabella users

1. Vai sulla tabella **`users`**
2. Clicca su **"Insert"** → **"Insert row"**
3. Inserisci:
   - **id**: `<l'UUID copiato da Supabase Auth>`
   - **client_id**: `<l'UUID del client creato prima>`
   - **email**: `admin@mocainteractive.com`
   - **name**: `Admin Moca`
   - **role**: `admin`
   - **level**: `5`
   - **status**: `active`
4. Clicca su **"Save"**

**Alternativa SQL**: Puoi anche eseguire le query SQL nel file `setup-first-admin.sql` fornito nel progetto.

### 2. Avviare l'Applicazione in Locale

```bash
# Assicurati di essere nella directory del progetto
npm run dev
```

Vai su `http://localhost:5173` e fai login con:
- **Email**: `admin@mocainteractive.com`
- **Password**: La password che hai creato in Supabase Auth

### 3. Testare le Funzionalità

Una volta loggato come admin, puoi:

1. **Dashboard**: Vedi le statistiche del sistema
2. **Clienti**: Crea nuovi clienti
3. **Utenti**: Crea nuovi utenti e assegnali ai clienti
4. **Configurazioni**: Aggiungi configurazioni (es. API key di OpenAI)
5. **Applicazioni**: Registra le applicazioni dell'ecosistema
6. **Logs**: Monitora i log di sistema in tempo reale
7. **API Docs**: Consulta la documentazione API

## Struttura dei Ruoli

### Admin (Livello 5)
- Accesso completo a tutto
- Può creare/modificare/eliminare clienti
- Può gestire utenti di tutti i clienti
- Può gestire tutte le configurazioni
- Può gestire il registry delle applicazioni

### Manager (Livello 3-4)
- Può gestire utenti del proprio cliente
- Può gestire configurazioni del proprio cliente
- Può visualizzare le applicazioni
- Non può creare/eliminare clienti

### User (Livello 1-2)
- Accesso limitato ai dati del proprio cliente
- Può accedere alle applicazioni assegnate
- Permessi di modifica limitati

### Viewer (Livello 1)
- Solo lettura
- Può visualizzare dati e applicazioni assegnate
- Nessun permesso di modifica

## Deploy su Netlify

### 1. Preparare il Repository GitHub

```bash
# Inizializza git (se non già fatto)
git init

# Crea il repository su GitHub e poi:
git remote add origin <url-del-tuo-repo>

# Crea i branch
git checkout -b main
git add .
git commit -m "Initial commit: Moca Hub complete"
git push -u origin main

# Crea il branch develop
git checkout -b develop
git push -u origin develop
```

### 2. Configurare Netlify

1. Vai su [Netlify](https://www.netlify.com)
2. Clicca su **"Add new site"** → **"Import an existing project"**
3. Connetti il tuo repository GitHub
4. Configura il build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Branch to deploy**: `main`

5. Aggiungi le variabili d'ambiente:
   - `VITE_SUPABASE_URL`: Il tuo URL Supabase
   - `VITE_SUPABASE_ANON_KEY`: La tua chiave anonima Supabase

6. Abilita i **Branch deploys** per `develop`:
   - Site settings → Build & deploy → Branch deploys
   - Aggiungi `develop` come branch da deployare

### 3. URL dei Deploy

- **Production** (main): `https://moca-central-hub.netlify.app`
- **Staging** (develop): `https://develop--moca-central-hub.netlify.app`

## Note Importanti sulla Sicurezza

1. **Row Level Security (RLS)**: Tutte le tabelle hanno RLS abilitato
2. **Isolamento Multi-tenant**: I dati sono isolati per cliente
3. **Controllo Permessi**: I permessi sono controllati sia lato client che lato database
4. **API Keys Mascherate**: Le API keys sensibili sono mascherate nell'interfaccia
5. **Audit Logging**: Tutte le operazioni sono tracciate

## Funzionalità Netlify Functions (Opzionale)

Le istruzioni menzionano l'uso di Netlify Functions per operazioni server-side. Per implementarle:

1. Crea una cartella `netlify/functions` nella root del progetto
2. Aggiungi le tue serverless functions
3. Configura in `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
```

## Prossimi Sviluppi

Per estendere l'applicazione, considera:

1. **Netlify Functions**: Implementa endpoint API serverless
2. **Background Jobs**: Usa Netlify Background Functions per operazioni lunghe
3. **Email Notifications**: Integra notifiche email (es. Sendgrid)
4. **OAuth Providers**: Aggiungi login con Google/GitHub
5. **2FA**: Implementa autenticazione a due fattori
6. **Export Data**: Aggiungi funzionalità di export CSV/PDF
7. **Advanced Analytics**: Dashboard analytics avanzate

## Risorse Utili

- **Supabase Docs**: https://supabase.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Tailwind CSS**: https://tailwindcss.com/docs
- **React Docs**: https://react.dev

## Supporto

Per domande o problemi:
1. Controlla i log nella pagina "Logging & Debug"
2. Verifica la configurazione delle variabili d'ambiente
3. Controlla i log di Netlify (se in produzione)
4. Verifica le RLS policies in Supabase

## Checklist Pre-Deploy

Prima di fare il deploy in produzione:

- [ ] Creato almeno un client
- [ ] Creato almeno un utente admin
- [ ] Testato login/logout
- [ ] Testato creazione utenti
- [ ] Testato gestione clienti
- [ ] Verificato che le RLS policies funzionino
- [ ] Configurato variabili d'ambiente su Netlify
- [ ] Testato il build locale (`npm run build`)
- [ ] Verificato che il brand Moca sia applicato correttamente

## Congratulazioni! 🎉

Hai completato con successo la creazione di Moca Hub! L'applicazione è pronta per essere utilizzata e deployata.
