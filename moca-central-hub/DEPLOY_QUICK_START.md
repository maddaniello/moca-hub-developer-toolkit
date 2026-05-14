# 🚀 Quick Start - Deploy Moca Hub su Netlify

## 📋 Cosa Fare ADESSO (15 minuti)

### 1️⃣ PREPARA IL DATABASE (5 minuti)

**A. Crea l'utente admin in Supabase:**
1. Vai su [Supabase Dashboard](https://supabase.com/dashboard) → Authentication → Users
2. Clicca "Add user" → "Create new user"
3. Email: `admin@mocainteractive.com`, Password: sceglila tu
4. **COPIA IL USER ID** (UUID) dell'utente creato

**B. Crea il client nel database:**
1. Table Editor → Tabella `clients` → Insert row
2. name: `Moca Interactive`, email: `admin@mocainteractive.com`, status: `active`
3. **COPIA IL CLIENT ID** (UUID)

**C. Collega utente auth a tabella users:**
1. Table Editor → Tabella `users` → Insert row
2. Compila:
   - id: `<User ID copiato>`
   - client_id: `<Client ID copiato>`
   - email: `admin@mocainteractive.com`
   - name: `Admin Moca`
   - role: `admin`
   - level: `5`
   - status: `active`

---

### 2️⃣ PUBBLICA SU GITHUB (3 minuti)

```bash
# Nel terminale, nella cartella del progetto:
git init
git add .
git commit -m "Initial commit: Moca Hub"
git branch -M main

# Vai su github.com e crea un nuovo repository "moca-hub"
# Poi esegui (sostituisci USERNAME con il tuo):
git remote add origin https://github.com/USERNAME/moca-hub.git
git push -u origin main

# Crea branch develop:
git checkout -b develop
git push -u origin develop
git checkout main
```

---

### 3️⃣ DEPLOY SU NETLIFY (5 minuti)

1. Vai su [Netlify](https://app.netlify.com)
2. "Add new site" → "Import an existing project"
3. Connetti GitHub → Seleziona `moca-hub`
4. Configura:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Aggiungi variabili ambiente:
   - `VITE_SUPABASE_URL` = Il tuo URL Supabase
   - `VITE_SUPABASE_ANON_KEY` = La tua Anon Key

   *Dove trovarli?* Supabase → Settings → API

6. Clicca "Deploy site"

---

### 4️⃣ TESTA IL SITO (2 minuti)

1. Aspetta che il deploy finisca
2. Apri l'URL fornito da Netlify
3. Login con: `admin@mocainteractive.com` e la password scelta
4. ✅ Dovresti vedere la Dashboard!

---

## 📚 Guide Complete

- **Deploy dettagliato**: Leggi `GUIDA_DEPLOY_NETLIFY.md`
- **Setup italiano**: Leggi `GUIDA_SETUP_ITALIANO.md`
- **README tecnico**: Leggi `README.md`

---

## ⚠️ Problemi?

**Non riesco a fare login:**
- Verifica che l'ID utente in `users` sia IDENTICO all'ID in Supabase Auth
- Controlla che le variabili ambiente su Netlify siano corrette

**Pagina bianca:**
- Vai su Netlify → Deploys → Guarda i log
- Verifica che `netlify.toml` sia nel repository

**"Policy violation":**
- Le RLS policies sono già configurate
- Verifica che l'utente sia nella tabella `users`

---

## 🎯 URLs Finali

- **Production**: `https://tuo-nome.netlify.app`
- **Staging**: `https://develop--tuo-nome.netlify.app`

Puoi cambiare "tuo-nome" da Netlify → Site settings → Change site name

---

🎉 **Fatto! Il tuo Moca Hub è online!**
