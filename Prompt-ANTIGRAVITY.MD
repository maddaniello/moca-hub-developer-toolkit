 🚀 PROMPT per Antigravity - Nuova App Moca Hub (Design v2.0)
📋 PRIMA DI INIZIARE - Leggi questi documenti:
1. /APP_INTEGRATION_GUIDE.md
2. /ARCHITECTURE.md
3. /README.md
4. /moca-sdk.js
5. /app-template/index.html
6. /tailwind.config.js
7. /risorse/loghi-moca/ → Loghi ufficiali Moca (4 varianti PNG)
8. /risorse/Icone/ → Libreria icone Moca (~1600 icone in variante bianca e nera)


💬 PROMPT COMPLETO
# Sviluppo App Integrata con Moca Hub
Voglio creare una nuova applicazione chiamata **[NOME_APP]** completamente integrata 
con l'ecosistema Moca Hub.

## Obiettivo
[DESCRIVI COSA DEVE FARE L'APP - es: "Generare schede prodotto con AI"]

## Funzionalità Principali
1. [FUNZIONE 1]
2. [FUNZIONE 2]
3. [FUNZIONE 3]

## API Esterne Necessarie
- [ ] OpenAI (usa `OPENAI_API_KEY`)
- [ ] Apify (usa `APIFY_API_KEY`)
- [ ] Anthropic (usa `ANTHROPIC_API_KEY`)
- [ ] [Altre...]

## Stack Tecnologico OBBLIGATORIO
- **Frontend**: React + Vite + TypeScript
- **Backend**: Netlify Functions (Node.js) -> **OBBLIGATORIO per chiamate API sicure**
- **Styling**: Tailwind CSS + Design System Moca v2.0
- **Icons**: Lucide React (OBBLIGATORIO - NO EMOJI). In alternativa/complemento, usare le icone PNG Moca da `/risorse/Icone/`
- **Lingua**: ITALIANO (Tutta la UI e gli output devono essere rigorosamente in italiano)
- **Deploy**: Netlify

---

## ⚠️ REQUISITI ARCHITETTURALI OBBLIGATORI

### 1. AUTENTICAZIONE & LOCAL TESTING
**NON creare sistema di login autonomo!**
- ✅ USA `moca-sdk.js` per autenticazione.
- ✅ L'app funziona SOLO se lanciata da Moca Hub O se in modalità Mock locale.
- ✅ Implementa **MOCK MODE** per sviluppo locale:
  ```javascript
  // Nel file principale (App.tsx o main.tsx)
  if (window.location.hostname === 'localhost') {
    moca.enableMockMode({
      client: { name: 'Cliente Test', logo_url: 'https://placehold.co/100' },
      user: { name: 'Dev Locale', role: 'admin' },
      configurations: { OPENAI_API_KEY: 'sk-test-...' } // Key di test locale
    });
  }
  const authenticated = await moca.init();
  ```

### 2. GESTIONE API KEYS & BACKEND
**MAI esporre API Keys nel frontend!**
- ✅ Recupera le chiavi API tramite `moca.getConfig('KEY')` nel frontend.
- ✅ Passa le chiavi al backend (Netlify Functions) nel body della richiesta.
- ✅ TUTTA la logica di business (chiamate OpenAI, scraping, ecc.) DEVE stare in `netlify/functions`.

**Esempio Flow:**
1. Frontend recupera Key: `const key = moca.getConfig('OPENAI_API_KEY')`
2. Frontend chiama Backend: `fetch('/.netlify/functions/generate', { body: { apiKey: key, ... } })`
3. Backend esegue logica e ritorna risultato.

### 3. RISORSE GRAFICHE MOCA

#### **Loghi Moca Ufficiali** (in `/risorse/loghi-moca/`)
Ogni app DEVE copiare i loghi necessari nella propria cartella `public/moca/` per il deploy.

| File | Descrizione | Uso |
|------|-------------|-----|
| `moca-logo-positivo.png` | Dot rosso + testo nero | Footer, pagine su sfondo chiaro |
| `moca-logo-bianco.png` | Dot bianco + testo bianco | Sfondi scuri (alternativa discreta) |
| `moca-logo-nero.png` | Dot nero + testo nero | Versione monocromatica su chiaro |
| `moca-logo-negativo.png` | Dot rosso + testo bianco | **Header su sfondo `#191919`** (USO PRINCIPALE) |

#### **Favicon**
Usare `moca-logo-positivo.png` ridimensionato come favicon di ogni app:
```html
<link rel="icon" type="image/png" href="/moca/moca-logo-positivo.png">
```

#### **Icone Moca** (in `/risorse/Icone/`)
Libreria di **~1600 icone PNG** (IBM Carbon Design System) in due varianti:
- **`icone nere/`** — Per sfondi chiari (uso principale)
- **`icone bianche/`** — Per sfondi scuri (header, dark mode)

📖 **Catalogo completo**: Vedi `/risorse/CATALOGO-ICONE.md` per l'elenco categorizzato.

**Regola**: Usa Lucide React come libreria principale per le icone. Usa le icone Moca PNG quando serve un'icona specifica non presente in Lucide o per coerenza visiva con il brand.

**Componente riutilizzabile `MocaIcon`** — Creare in ogni app:
```tsx
// src/components/MocaIcon.tsx
interface MocaIconProps {
  name: string;
  size?: number;
  className?: string;
}

export const MocaIcon = ({ name, size = 20, className = "" }: MocaIconProps) => (
  <img
    src={`/moca/icone/${name}.png`}
    alt={name}
    width={size}
    height={size}
    className={`inline-block ${className}`}
  />
);

// Utilizzo:
// <MocaIcon name="analytics" size={24} />
// <MocaIcon name="ai-status" size={20} />
```

**Icone più comuni per le app Moca Hub:**

| Azione UI | Nome file icona | Lucide equivalente |
|-----------|-----------------|---------------------|
| Cerca | `search.png` | `Search` |
| Indietro / Torna Hub | `arrow--left.png` | `ArrowLeft` |
| Home / Dashboard | `dashboard.png` | `LayoutDashboard` |
| Analisi / Trend | `analytics.png` | `TrendingUp` |
| Filtri | `filter.png` | `Filter` |
| Download report | `download.png` | `Download` |
| Upload file | `upload.png` | `Upload` |
| Salva | `save.png` | `Save` |
| Copia | `copy.png` | `Copy` |
| Elimina | `trash-can.png` | `Trash2` |
| Modifica | `edit.png` | `Pencil` |
| Impostazioni | `settings.png` | `Settings` |
| Utente / Profilo | `user.png` | `User` |
| Notifiche | `notification.png` | `Bell` |
| Successo | `checkmark--filled.png` | `CheckCircle` |
| Errore | `error.png` | `XCircle` |
| Avviso | `warning.png` | `AlertCircle` |
| Info | `information.png` | `Info` |
| AI / Analisi AI | `ai-status.png` | *(non presente)* |
| Report/Risultati | `report.png` | `ClipboardList` |
| Grafici a barre | `chart--bar.png` | `BarChart` |
| Grafici a torta | `chart--pie.png` | `PieChart` |
| Documento | `document.png` | `FileText` |
| Email | `email.png` | `Mail` |
| Link | `link.png` | `Link` |
| Posizione/Mappa | `location.png` | `MapPin` |
| Stella/Preferito | `star.png` / `star--filled.png` | `Star` |
| Tema chiaro/scuro | `light.png` / `asleep.png` | `Sun` / `Moon` |
| Condividi | `share.png` | `Share2` |
| Tag/Etichette | `tag.png` | `Tag` |

#### **Deploy delle Risorse su Netlify**
Quando crei una nuova app, copia loghi e icone nella cartella `public/moca/`:
```bash
mkdir -p public/moca/icone
# Loghi
cp /path/to/risorse/loghi-moca/moca-logo-negativo.png public/moca/
cp /path/to/risorse/loghi-moca/moca-logo-positivo.png public/moca/
# Icone (copia SOLO quelle necessarie per l'app)
cp /path/to/risorse/Icone/icone\ nere/search.png public/moca/icone/
cp /path/to/risorse/Icone/icone\ nere/analytics.png public/moca/icone/
cp /path/to/risorse/Icone/icone\ nere/dashboard.png public/moca/icone/
# ... aggiungi le altre icone usate dall'app
```
Nel codice React, usa path assoluti dalla root:
```tsx
<img src="/moca/moca-logo-negativo.png" alt="Moca" className="h-8" />
<MocaIcon name="analytics" size={24} />
```
Questo funziona sia su `localhost:5173` sia su `https://nome-app.netlify.app`.

---

### 4. BRANDING & DESIGN SYSTEM (Rigido match con Maps Hub)
L'app deve essere indistinguibile da **Maps Hub**.
Usa ESATTAMENTE questi token e classi Tailwind.

#### **COLOR PALETTE**
- **Primary Red**: `bg-[#E52217]` / `text-[#E52217]`
- **Red Light**: `bg-[#FFE7E6]` (usato per bordi card e sfondi light)
- **Black**: `text-[#191919]` (testi principali)
- **Gray**: `text-[#8A8A8A]` (testi secondari)
- **Background**: `bg-[#FAFAFA]` (sfondo pagina)

#### **COMPONENTI UI (Copia queste classi)**
- **Card**:
  ```tsx
  <div className="bg-white rounded-lg border border-[#FFE7E6] shadow-sm p-6 mb-6">
  ```
- **Button Primary**:
  ```tsx
  <button className="bg-[#E52217] text-white px-6 py-2.5 rounded-md font-medium shadow-sm hover:bg-[#cc1f15] transition-colors flex items-center gap-2 disabled:opacity-60">
  ```
- **Button Secondary**:
  ```tsx
  <button className="bg-white text-[#191919] border border-gray-200 px-5 py-2.5 rounded-md font-medium hover:bg-[#F3F4F6] transition-colors flex items-center gap-2">
  ```
- **Input / Select**:
  ```tsx
  <input className="w-full px-3 py-2.5 rounded-md border border-gray-200 focus:outline-none focus:border-[#E52217] focus:ring-4 focus:ring-[#E52217]/5 transition-all bg-white text-[#191919]" />
  ```
- **Section Title**:
  ```tsx
  <h2 className="text-xl font-semibold text-[#191919] mb-5 pb-3 border-b border-gray-100 flex items-center gap-2">
    <Icon className="w-6 h-6 text-[#E52217]" />
    Titolo Sezione
  </h2>
  ```

#### **LAYOUT**
- **Container**: `max-w-5xl mx-auto px-5 pb-10`
- **Header**: Sfondo nero `#191919`, fisso in alto. Il layout è diviso in tre zone:
  - **Sinistra**: Freccia "Torna al Hub" + Logo Moca **negativo** (`/moca/moca-logo-negativo.png` — dot rosso + testo bianco) + Nome applicazione
  - **Centro**: Logo del cliente (da `moca.getClient().logo_url`), centrato con `absolute left-1/2 -translate-x-1/2`
  - **Destra**: Toggle dark mode + "Powered by Moca" con dot rosso animato
  
  ```tsx
  <header className="bg-[#191919] border-b border-gray-800">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        {/* Sinistra: Back + Logo Moca + Nome App */}
        <div className="flex items-center gap-3">
          <a href={HUB_URL} className="text-gray-400 hover:text-[#E52217] transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <img src="/moca/moca-logo-negativo.png" alt="Moca" className="h-8" />
          <span className="text-sm text-gray-300 font-medium">[NOME APP]</span>
        </div>

        {/* Centro: Logo Cliente */}
        {client?.logo_url && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <img src={client.logo_url} alt={client.name} className="h-8 max-w-[140px] object-contain" />
          </div>
        )}

        {/* Destra: Dark mode + Powered by */}
        <div className="flex items-center gap-4">
          <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-gray-800">
            {isDarkMode ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5 text-gray-400" />}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Powered by Moca</span>
            <div className="w-2 h-2 rounded-full bg-[#E52217] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  </header>
  ```

- **Footer**: Sfondo bianco, bordo superiore `#FFE7E6`, testo centrato con copyright e logo Moca positivo.
  ```tsx
  <footer className="bg-white border-t border-[#FFE7E6] mt-auto">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center gap-3">
      <img src="/moca/moca-logo-positivo.png" alt="Moca" className="h-5" />
      <p className="text-center text-sm text-[#8A8A8A]">
        © {new Date().getFullYear()} Moca - [NOME APP]. Tutti i diritti riservati.
      </p>
    </div>
  </footer>
  ```

### 5. LINGUA ITALIANA
- Tutte le label, bottoni, messaggi di errore devono essere in **ITALIANO**.
- I prompt inviati all'AI devono specificare "Rispondi in italiano".

---

## 📁 STRUTTURA PROGETTO (React + Vite)

```
[nome-app]/
├── netlify/
│   └── functions/       # TUTTA la logica server-side qui
│       ├── generate.ts
│       └── scrape.ts
├── public/
│   └── moca/            # Loghi e icone Moca per deploy
│       ├── moca-logo-negativo.png   # Header (sfondo scuro)
│       ├── moca-logo-positivo.png   # Footer (sfondo chiaro)
│       ├── favicon.png              # Favicon (copia di positivo)
│       └── icone/                   # Icone PNG usate dall'app
├── src/
│   ├── components/      # Componenti UI riutilizzabili
│   ├── lib/
│   │   └── moca.ts      # Wrapper per SDK
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── moca-sdk.js          # In public/ o src/
├── index.html           # Con <link rel="icon" href="/moca/favicon.png">
├── package.json
├── vite.config.ts
├── tailwind.config.js   # Con colori Moca
└── netlify.toml
```

## 🎯 IMPLEMENTAZIONE STEP-BY-STEP

1. **Setup**:
   - Crea progetto Vite + React + TS.
   - Installa `lucide-react`, `tailwindcss`.
   - Copia `moca-sdk.js`.

2. **Sviluppo Locale (Mock)**:
   - Implementa `moca.enableMockMode()` in `App.tsx`.
   - Crea file `.env.development` per le chiavi di test (da NON committare).

3. **Backend (Netlify Functions)**:
   - Crea `netlify/functions/api-endpoint.ts`.
   - Implementa la logica di business qui.

4. **UI & Design**:
   - Costruisci l'interfaccia usando i colori Moca e icone Lucide.
   - Assicurati che tutto sia in ITALIANO.

5. **Deploy & Cleanup**:
   - Rimuovi o commenta le chiavi di test hardcoded.
   - Verifica che `netlify.toml` sia configurato.
   - Push su GitHub e Deploy su Netlify.

---

## ✅ CHECKLIST FINALE
- [ ] App usa `moca.init()` all'avvio.
- [ ] Mock Mode funzionante su localhost.
- [ ] Logica business spostata su **Netlify Functions**.
- [ ] Nessuna API Key hardcoded nel frontend (passate dinamicamente).
- [ ] UI completamente in **ITALIANO**.
- [ ] Design conforme (Colori Moca, Font Figtree, Icone Lucide).
- [ ] **NO EMOJI**.
- [ ] Loghi Moca copiati in `public/moca/` (negativo per header, positivo per footer).
- [ ] Icone Moca copiate in `public/moca/icone/` (solo quelle necessarie).
- [ ] Componente `MocaIcon` creato in `src/components/`.
- [ ] Favicon configurata con logo Moca.
- [ ] Deploy Netlify funzionante.