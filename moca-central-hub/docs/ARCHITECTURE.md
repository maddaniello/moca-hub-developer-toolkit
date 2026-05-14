# Moca Hub Architecture & Integration Guide

Questa guida è il riferimento per lo sviluppo di nuove applicazioni da integrare nell'ecosistema Moca Hub.

## Panoramica Architetturale

Moca Hub agisce come **Identity Provider (IdP)** e **Configuration Manager** centralizzato. Le applicazioni satellite (es. "Google Maps Scraper", "Review Analyzer") non devono gestire utenti o password autonomamente, ma fidarsi dell'autenticazione di Moca Hub.

### Flusso di Accesso

1.  **Login Centralizzato**: L'utente accede a Moca Hub.
2.  **App Launch**: L'utente clicca su un'app dal Hub.
3.  **Token Passing**: L'Hub apre l'app passando i parametri di contesto (o l'utente usa il token di sessione condiviso se sullo stesso dominio/localstorage, o tramite parametro URL sicuro).
    *   *Raccomandato*: Le app condividono lo stesso dominio principale (es. `hub.moca.com`, `app1.moca.com`) e condividono i cookie di Supabase, OPPURE le app validano il JWT di Supabase passato via URL/Header.

## Requisiti per Nuove Applicazioni

Ogni nuova applicazione DEVE rispettare questi requisiti:

### 1. Autenticazione
*   Non creare tabelle `users` locali.
*   Utilizzare la stessa istanza Supabase (URL e Anon Key) di Moca Hub per connettersi a `auth`.
*   Verificare che l'utente sia loggato all'avvio:
    ```typescript
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'https://hub.moca.com';
    ```

### 2. Autorizzazione & Configurazione
*   L'app non deve avere "hardcoded" le API Key dei servizi (OpenAI, ecc.).
*   L'app deve richiedere le configurazioni all'Hub in base al `client_id` dell'utente attivo.

**Endpoint per recuperare config:**
`POST /api/get-client-config`
Header: `Authorization: Bearer <user_jwt>`
Body: `{ "config_key": "OPENAI_API_KEY" }`

### 3. Sicurezza RLS
*   Se l'app crea nuove tabelle nel DB condiviso, ogni tabella DEV'ESSERE protetta da RLS.
*   Policy standard: l'utente vede solo i dati creati da lui o appartenenti al suo `client_id` corrente.

### 4. UI/UX
*   Importare il pacchetto di stili / design tokens di Moca (Tailwind config).
*   Non includere Sidebar di navigazione complessa se l'app è pensata per essere usata dentro l'Hub (o fornire un pulsante "Torna all'Hub").

---

## Guida allo Sviluppo

Per lo sviluppo di nuove app, fare riferimento a:

1.  **`APP_INTEGRATION_GUIDE.md`**: Per i dettagli tecnici sull'integrazione e il Design System v2.0.
2.  **`Prompt-ANTIGRAVITY.MD`**: Il prompt di sistema aggiornato per guidare l'AI nella creazione di app conformi alle specifiche Moca.

---

## Esempio Integrazione Client

```typescript
// src/lib/moca-client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function getAppConfig(key: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  const response = await fetch('https://hub.moca.netlify.app/api/get-client-config', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ config_key: key })
  });

  return response.json();
}
```
