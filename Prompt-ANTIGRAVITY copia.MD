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
Reddit Scraper AI — Prompt Dettagliato per lo Sviluppo
Panoramica Applicazione
Applicazione web per lo scraping intelligente di Reddit basata su AI. L'utente fornisce un argomento, un brand (o più brand da confrontare), e l'applicazione:

Usa l'AI per espandere la query in keyword correlate, sinonimi e varianti
Cerca su Reddit tramite API ufficiale tutti i post e commenti rilevanti
Analizza i dati raccolti con l'AI e genera un report esaustivo multilingua con output in italiano
Flusso Operativo
Utente inserisce prompt,\nseleziona country/periodo/AI
Fase 1: Espansione Query\n(AI genera keyword)
Fase 2: Discovery Subreddit\n(API + DB subreddit per paese)
Fase 3: Scraping Posts\n(ricerca + raccolta contenuti)
Fase 4: Scraping Commenti\n(max 5 livelli profondità)
Fase 5: Analisi AI\n(sentiment, temi, report)
Report Finale\n(Web + PDF + Markdown)
Salvataggio in Supabase
Input Utente (Interfaccia)
Campo	Tipo	Dettagli
Prompt / Argomento	Textarea	Testo libero dove l'utente descrive l'argomento, il brand o il confronto tra brand da analizzare
Country	Select	Globale, Italia, USA, UK, Francia, Germania, Spagna (espandibile). Determina i subreddit da interrogare
Periodo	Select	Ultime 24 ore, Ultima settimana, Ultimo mese, Ultimi 6 mesi, Ultimo anno, Tutto
Limite post	Number input	Numero massimo di post da analizzare (default: 100, max: 5000+)
Provider AI	Select	OpenAI, Anthropic, Google Gemini
Modello AI	Select (dinamico)	Cambia in base al provider selezionato. Es: OpenAI → GPT-4o, GPT-4o-mini; Anthropic → Claude 3.5 Sonnet, Claude 3 Haiku; Gemini → 2.0 Flash, 1.5 Pro
Fase 1: Espansione Query con AI
L'AI riceve il prompt dell'utente e genera:

Keyword principali estratte dal prompt
Sinonimi in più lingue (in base alla country selezionata)
Argomenti correlati che potrebbero essere discussi su Reddit
Varianti ortografiche e abbreviazioni comuni
Hashtag e termini gergali usati su Reddit
Nomi subreddit suggeriti dove l'argomento potrebbe essere discusso
Esempio: prompt "Come si parla di Barilla su Reddit in Italia" → Keywords: Barilla, pasta Barilla, pasta italiana, spaghetti Barilla → Correlati: pasta italiana qualità, prezzo pasta, alternativa Barilla, De Cecco vs Barilla → Subreddit suggeriti: r/italy, r/cucina, r/Italia, r/Cooking

Fase 2: Discovery Subreddit
Approccio Ibrido
Database predefinito di subreddit per paese (configurabile, espandibile):
Country	Subreddit principali
Italia	r/italy, r/Italia, r/italianlearning, r/ItaliaPersonalFinance, r/commercialisti, r/cucina
Globale	Nessuna restrizione, cerca in tutti
USA	r/AskAnAmerican, r/politics, r/news, r/personalfinance
UK	r/unitedkingdom, r/CasualUK, r/AskUK
...	Espandibile
Discovery AI-driven: L'AI suggerisce subreddit aggiuntivi in base all'argomento
API Reddit: Usa l'endpoint di ricerca subreddit (/subreddits/search) per trovare subreddit rilevanti alle keyword
Merge e deduplica: Unisce le tre fonti, rimuove duplicati
Fase 3: Scraping Posts via Reddit API
Autenticazione
OAuth2 con client_credentials grant type (script app)
Credenziali: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT
Endpoint base: https://oauth.reddit.com
Endpoint di ricerca
GET /r/{subreddit}/search
Parametri:

q: query di ricerca (keyword)
restrict_sr: true (limita al subreddit specifico)
sort: relevance | hot | top | new | comments
t: hour | day | week | month | year | all
limit: 100 (max per pagina)
after: token per paginazione
Gestione "Ultimi 6 mesi"
L'API non supporta nativamente il filtro "6 mesi". Strategia:

Usare t=year per ottenere i post dell'ultimo anno
Filtrare lato client usando il campo created_utc del post
Scartare i post con created_utc antecedente a 6 mesi fa
Gestione Robustezza
Aspetto	Strategia
Rate Limiting	Max 100 req/min. Implementare coda con delay adattivo. Leggere header X-Ratelimit-Remaining e X-Ratelimit-Reset
Batch Processing	Processare un subreddit alla volta, una keyword alla volta
Timeout	Timeout di 30s per richiesta, retry con backoff esponenziale (max 3 tentativi)
Deduplicazione	Deduplicare post per id (lo stesso post può apparire con keyword diverse)
Paginazione	Seguire il token after per ottenere tutte le pagine fino al limite impostato dall'utente
Error Handling	Gestire 429 (rate limit), 503 (server error), 401 (token scaduto → refresh)
Dati estratti per ogni Post
json
{
  "id": "abc123",
  "subreddit": "italy",
  "title": "Titolo del post",
  "selftext": "Corpo del post",
  "author": "username",
  "created_utc": 1708300000,
  "score": 42,
  "upvote_ratio": 0.95,
  "num_comments": 15,
  "url": "https://reddit.com/r/...",
  "permalink": "/r/italy/comments/...",
  "link_flair_text": "Discussione",
  "is_self": true
}
Fase 4: Scraping Commenti
Endpoint
GET /r/{subreddit}/comments/{article_id}
Parametri:

depth: 5 (massimo 5 livelli di nesting)
limit: numero di commenti top-level da recuperare
sort: top | best | new
Gestione "More Comments"
Quando Reddit restituisce un oggetto "more" con children IDs:

Usare l'endpoint GET /api/morechildren per espandere
Parametri: link_id, children (comma-separated IDs), api_type=json
Rispettare i rate limits anche per queste chiamate aggiuntive
Dati estratti per ogni Commento
json
{
  "id": "xyz789",
  "post_id": "abc123",
  "parent_id": "t1_parent_id",
  "body": "Testo del commento",
  "author": "username",
  "created_utc": 1708300500,
  "score": 10,
  "depth": 1,
  "is_submitter": false
}
Fase 5: Analisi AI e Generazione Report
Pre-processing
Language Detection: Usare una libreria NLP (es. franc, cld3) per rilevare la lingua di ogni post e commento
Raggruppamento per lingua: Organizzare i contenuti per lingua rilevata
Rimozione stopwords: Per ogni lingua, rimuovere le stopwords per la word cloud
Calcolo frequenze: Conteggio termini per la word cloud
Strategia AI (Map-Reduce per grandi volumi)
Data la possibilità di avere migliaia di post/commenti:

Map: Dividere i contenuti in batch (es. 50 post+commenti per batch)
Analisi batch: Ogni batch viene analizzato dall'AI per estrarre:
Temi principali
Sentiment (positivo/negativo/neutro con score)
Menzioni brand/competitor
Thread prioritari
Reduce: Unire i risultati dei batch in un'analisi finale sintetica
Report Generation: L'AI genera il report finale in italiano
Struttura Report
Il report deve essere interamente in italiano e contenere le seguenti sezioni:

1. Riepilogo Esecutivo
Argomento/brand analizzato
Periodo di riferimento
Numero totale di post trovati
Numero totale di commenti analizzati
Numero e lista dei subreddit interrogati
Keyword utilizzate per la ricerca
2. Word Cloud
Immagine SVG/Canvas con i termini più comuni
Escluse stopwords di ogni lingua rilevata
Dimensione proporzionale alla frequenza
Colori differenziati per sentiment (positivo=verde, neutro=grigio, negativo=rosso) se possibile
3. Analisi Linguistica
Distribuzione contenuti per lingua (es. 70% italiano, 25% inglese, 5% altro)
Eventuali differenze tematiche tra lingue
Termini specifici per lingua
4. Temi Principali
Lista dei temi più discussi, ordinati per frequenza
Per ogni tema:
Descrizione del tema
Numero di post/commenti in cui appare
Esempi di citazioni testuali rilevanti (con link al thread originale)
Sentiment prevalente per tema
5. Analisi Sentiment
Score complessivo di percezione (scala 1-10 o positivo/neutro/negativo con percentuali)
Breakdown per tema
Breakdown per subreddit
Evoluzione temporale del sentiment (se i dati lo permettono)
Grafici visuali
6. Competitor e Menzioni
Brand/entità menzionati insieme all'argomento principale
Frequenza menzioni
Sentiment associato a ciascun competitor
Confronto diretto se richiesto dall'utente
7. Thread Prioritari per Intervento
Lista dei thread dove un brand potrebbe intervenire
Criteri: sentiment negativo o neutro con alto engagement, domande senza risposta, lamentele ricorrenti
Per ogni thread:
Link diretto al thread
Sintesi del contenuto
Motivo per cui è prioritario
Suggerimento di risposta generato dall'AI (tono appropriato per Reddit)
8. Ambiti di Intervento Strategico
Aree dove il brand/argomento ha gap di percezione
Opportunità di comunicazione identificate
Rischi reputazionali emergenti
9. Takeaway Strategici
5-10 punti chiave azionabili
Raccomandazioni concrete
Prioritizzazione delle azioni
10. Confronto Brand (se multi-brand)
Sezioni separate per ogni brand con analisi indipendente
Sezione confronto finale con:
Tabella comparativa sentiment
Punti di forza e debolezza relativi
Share of voice (presenza relativa nelle conversazioni)
Raccomandazioni differenziate
Progress Tracking (UX)
L'interfaccia deve mostrare una progress bar dettagliata con le fasi:

[████████░░░░░░░░░░░░] 40% — Fase 2 di 5
✅ Fase 1: Espansione keyword — 12 keyword generate
🔄 Fase 2: Scraping Reddit — Subreddit 3/8 · Post raccolti: 245 · Commenti: 1,230
⬜ Fase 3: Rilevamento lingue
⬜ Fase 4: Analisi AI (batch 0/?)
⬜ Fase 5: Generazione report
Ogni fase deve aggiornare in tempo reale:

Numero di elementi processati
Subreddit corrente
Tempo stimato rimanente (se possibile)
Storico Ricerche (Supabase)
Dati da salvare
Tabella	Campi principali
searches	id, user_id, prompt, country, period, post_limit, ai_provider, ai_model, status, created_at
search_results	id, search_id, total_posts, total_comments, subreddits_queried (JSON), keywords_used (JSON), raw_data_url (link a export)
search_reports	id, search_id, report_html, report_markdown, report_pdf_url, word_cloud_svg, created_at
Interfaccia Storico
Lista ricerche passate con data, prompt, status
Possibilità di riaprire e consultare ogni report
Possibilità di esportare i dati grezzi in CSV e JSON
Possibilità di ri-analizzare dati già scaricati con un modello AI diverso
Export
Formato	Contenuto
Pagina web	Report interattivo con grafici, word cloud, sezioni espandibili
PDF	Report completo formattato per la stampa/condivisione
Markdown	Report in formato .md scaricabile
CSV	Dati grezzi: tutti i post e commenti con metadati
JSON	Dati grezzi strutturati completi
Note Tecniche Reddit API
IMPORTANT

L'API Reddit ha un rate limit di 100 richieste al minuto per OAuth client. L'applicazione DEVE implementare throttling adattivo leggendo gli header di risposta.

WARNING

Il filtro per country non esiste nativamente nell'API Reddit. L'implementazione si basa su un database di subreddit per paese + discovery AI + filtro lingua post-raccolta.

NOTE

Il filtro temporale "Ultimi 6 mesi" non è nativo. Si usa t=year e si filtra lato client per created_utc.

Variabili d'Ambiente Richieste
REDDIT_CLIENT_ID=xxx
REDDIT_CLIENT_SECRET=xxx
REDDIT_USER_AGENT=xxx
Le API key AI e la configurazione Supabase saranno gestite secondo i prompt/architettura preesistenti dell'hub.

## API Esterne Necessarie
- [ ] OpenAI (usa `OPENAI_API_KEY`)
- [ ] Apify (usa `APIFY_API_KEY`)
- [ ] Anthropic (usa `ANTHROPIC_API_KEY`)
- [ ] Tutte le configurazioni di Reddit

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
| `moca-logo-negativo.png` | Dot rosso + testo bianco | **Header su sfondo scuro** (USO PRINCIPALE) |

#### **Favicon**
Usare `moca-logo-positivo.png` ridimensionato come favicon:
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
| Successo / Completato | `checkmark--filled.png` | `CheckCircle` |
| Errore | `error.png` | `XCircle` |
| Avviso | `warning.png` | `AlertCircle` |
| AI / Analisi AI | `ai-status.png` | *(non presente)* |
| Report/Risultati | `report.png` | `ClipboardList` |
| Grafici a barre | `chart--bar.png` | `BarChart` |
| Documento | `document.png` | `FileText` |
| Email | `email.png` | `Mail` |
| Posizione/Mappa | `location.png` | `MapPin` |
| Stella/Preferito | `star.png` / `star--filled.png` | `Star` |
| Tag/Etichette | `tag.png` | `Tag` |

#### **Deploy delle Risorse su Netlify**
Copia loghi e icone nella cartella `public/moca/` di ogni app:
```bash
mkdir -p public/moca/icone
# Loghi
cp /path/to/risorse/loghi-moca/moca-logo-negativo.png public/moca/
cp /path/to/risorse/loghi-moca/moca-logo-positivo.png public/moca/
# Icone (copia SOLO quelle necessarie per l'app)
cp /path/to/risorse/Icone/icone\ nere/search.png public/moca/icone/
cp /path/to/risorse/Icone/icone\ nere/analytics.png public/moca/icone/
# ... aggiungi le altre icone usate dall'app
```
Nel codice React, usa path assoluti dalla root:
```tsx
<img src="/moca/moca-logo-negativo.png" alt="Moca" className="h-8" />
<MocaIcon name="analytics" size={24} />
```
Funziona sia su `localhost:5173` sia su `https://nome-app.netlify.app`.

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
- **Header**: Sticky top, bianco con blur.
  ```tsx
  <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200/50 px-8 py-4 mb-8 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <img src="/moca/moca-logo-positivo.png" alt="Moca" className="h-8" />
      <span className="text-sm text-gray-600 font-medium">[NOME APP]</span>
    </div>
  </header>
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