# Guida all'Integrazione App Moca Hub

Guida completa per sviluppare applicazioni integrate nell'ecosistema Moca Hub.

## Indice

1. [Panoramica Architettura](#panoramica-architettura)
2. [Checklist Integrazione](#checklist-integrazione)
3. [Design System v2.0](#design-system-v20)
4. [Step-by-Step](#step-by-step)
5. [Sviluppo Locale (Mock Mode)](#sviluppo-locale-mock-mode)
6. [Netlify Functions](#netlify-functions)
7. [Deployment](#deployment)

---

## Panoramica Architettura

Moca Hub utilizza un **sistema di launch token** per un'integrazione sicura:

```
Utente clicca "Apri App" → Hub genera token → App valida token → Hub restituisce API keys
```

### Concetti Chiave

- **Launch Token**: Token monouso, scade in 5 minuti.
- **Contesto Client**: Ogni istanza dell'app è legata a un cliente specifico.
- **API Keys**: Configurazioni specifiche del cliente (OpenAI, Apify, ecc.), recuperate via SDK.
- **Session Storage**: I dati di sessione durano 8 ore (o fino alla chiusura del tab).
- **Netlify Functions**: **OBBLIGATORIE** per logica backend, proxy API sicuri e operazioni server-side.

---

## Checklist Integrazione

Usa questa checklist per ogni nuova app:

- [ ] **1. Setup** 
  - [ ] Copia `moca-sdk.js` nel progetto.
  - [ ] Imposta `MOCA_HUB_URL`.
  - [ ] Configura `netlify/functions` per la logica backend.
  
- [ ] **2. Autenticazione**
  - [ ] Chiama `moca.init()` all'avvio.
  - [ ] Mostra "Accesso Negato" se non autenticato.
  
- [ ] **3. Branding & Design (Design System v2.0)**
  - [ ] **Logo Moca**: Deve essere sempre visibile nell'header (a destra).
  - [ ] **Header**: Dark (`#191919`) con testo bianco.
  - [ ] **Sfondo**: Grigio chiaro (`#F3F4F6`).
  - [ ] **Card**: Sfondo bianco con shadow (`bg-white shadow-sm rounded-xl`).
  - [ ] **Font**: Figtree (Google Fonts).
  - [ ] **Icone**: `lucide-react` (NO Emoji).
  - [ ] **Lingua**: Tutto tassativamente in ITALIANO.
  
- [ ] **4. API Keys**
  - [ ] Usa `moca.getConfig()` per recuperare le chiavi.
  - [ ] **MAI** hardcodare chiavi nel codice.
  - [ ] Passa le chiavi alle Netlify Functions se necessario (via headers o body).
  
- [ ] **5. Testing Locale**
  - [ ] Usa `moca.enableMockMode()` per testare su localhost.
  - [ ] Rimuovi i riferimenti alle API key di test prima del deploy (le key devono arrivare dall'Hub).

---

## Design System v2.0 (Riferimento Maps Hub)

Per garantire coerenza visiva, tutte le app devono seguire queste regole:

### Colori
- **Primary**: `#E52217` (Moca Red)
- **Background**: `#F3F4F6`
- **Surface**: `#FFFFFF`
- **Text**: `#191919` (Primary), `#8A8A8A` (Secondary)

### Layout Header
L'header deve essere `sticky` in alto, colore `#191919`, con:
1.  **Sx**: Logo Cliente + Nome Cliente
2.  **Centro**: Titolo App
3.  **Dx**: Logo Moca (bianco/invertito)

---

## Step-by-Step

### 1. Setup con Template

Inizia con una struttura HTML/JS semplice o React+Vite.

### 2. Sviluppo Locale (Mock Mode)

Per testare l'app in locale senza passare dal Hub, configura una sessione mock **PRIMA** di chiamare `init()`.

```javascript
// Esegui SOLO su localhost
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    moca.enableMockMode({
        client: { name: 'Cliente Test', logo_url: 'https://placehold.co/100/E52217/FFFFFF?text=CLIENTE' },
        user: { name: 'Sviluppatore', role: 'admin' },
        configurations: {
            OPENAI_API_KEY: 'sk-tua-chiave-test-PERSONALE-DA-NON-COMITTARE' 
        }
    });
}

// Inizializza SDK
const auth = await moca.init();
```

> **IMPORTANTE**: Assicurati che le chiavi usate nel mock mode non vengano committate su GitHub (usa .env o rimuovile prima del commit).

### 3. Netlify Functions (Backend)

Per operazioni sicure (es. chiamate a database, scraping complesso, o proxy API), usa le Netlify Functions.

Struttura cartelle:
```
/netlify
  /functions
    /api-proxy.js
```

Esempio `netlify/functions/api-proxy.js`:
```javascript
exports.handler = async function(event, context) {
    // Le chiavi vengono passate dall'app frontend che le ha ricevute dal Moca Hub
    const { apiKey, payload } = JSON.parse(event.body);
    
    // ...logica backend...
    
    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Successo" })
    };
}
```

Chiamata dal Frontend:
```javascript
const response = await fetch('/.netlify/functions/api-proxy', {
    method: 'POST',
    body: JSON.stringify({
        apiKey: moca.getConfig('SOME_API_KEY'),
        payload: { ... }
    })
});
```

---

## Deployment

1. **GitHub**: Pusha il codice su GitHub.
2. **Netlify**: Crea un nuovo sito dal repo GitHub.
3. **Variabili d'Ambiente**: Imposta `MOCA_HUB_URL` su Netlify.
4. **Moca Hub**: Registra la URL dell'app (`https://tua-app.netlify.app`) nel pannello Admin di Moca Hub.

### Configurazione Netlify (`netlify.toml`)

```toml
[build]
  publish = "dist" # o "." per siti statici
  functions = "netlify/functions"

[build.environment]
  MOCA_HUB_URL = "https://moca-central-hub.netlify.app"
```
