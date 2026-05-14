# Linee Guida Standard per App Satellite Moca Hub

Questo documento definisce lo standard per allineare tutte le app satellite del Moca Hub in termini di layout, storico, impostazioni prompt AI e integrazione con il Hub centrale. Usalo come riferimento per ogni nuova chat Claude Code o per sviluppare nuove app.

---

## 1. Architettura Generale

### Stack Tecnologico (Standard)
- **Frontend:** React 18+ / TypeScript / Vite / Tailwind CSS
- **Backend:** Netlify Functions (serverless)
- **Database:** Supabase (progetto unico condiviso con Moca Hub)
- **Auth:** Moca SDK (`public/moca-sdk.js` + `src/lib/moca-context.tsx`)
- **Icons:** lucide-react (NO emoji nel codice)
- **Font:** Figtree (Google Fonts)
- **Lingua UI:** Italiano
- **Favicon:** `https://mocainteractive.com/favicon-96x96.png` (uguale per tutte le app)

### Favicon Standard (in `index.html`)
```html
<link rel="icon" type="image/png" sizes="96x96" href="https://mocainteractive.com/favicon-96x96.png" />
```

### Struttura Entry Point (`src/App.tsx`)
```tsx
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Dashboard from './pages/Dashboard';
import { APP_NAME } from './lib/constants';

function App() {
  useMoca();
  return (
    <div className="flex flex-col min-h-screen bg-moca-bg font-figtree">
      <Header appName={APP_NAME} />
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <Dashboard />
      </main>
      <Footer appName={APP_NAME} />
    </div>
  );
}
```

### File `src/lib/constants.ts` (obbligatorio per ogni app)
```ts
export const APP_ID = 'nome-app-kebab-case';   // es: 'ads-library-scraper', 'trustpilot-analyzer'
export const APP_NAME = 'Nome App per UI';       // es: 'Ads Scraper', 'Trustpilot Analyzer'
```

---

## 2. Colori e Theme (Tailwind)

Definiti in `src/index.css`:
```css
--color-moca-red: #E52217;
--color-moca-red-light: #FFE7E6;
--color-moca-black: #191919;
--color-moca-gray: #8A8A8A;
--color-moca-bg: #FAFAFA;
--font-figtree: 'Figtree', sans-serif;
```

---

## 3. Header Standard

**File:** `src/components/layout/Header.tsx`

```tsx
import { ArrowLeft } from 'lucide-react';
import { useMoca } from '../../lib/moca-context';

interface HeaderProps {
    appName?: string;
}

export default function Header({ appName = 'App Name' }: HeaderProps) {
    const { client } = useMoca();

    return (
        <header className="bg-moca-black text-white h-16 flex items-center justify-between px-4 sticky top-0 z-50">
            {/* Left: Back + App Name */}
            <div className="flex items-center gap-4 flex-1">
                <button
                    onClick={() => window.location.href = 'https://moca-central-hub.netlify.app'}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors group flex items-center gap-2"
                    aria-label="Torna al Hub"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-300 group-hover:text-white" />
                </button>
                <div className="hidden sm:flex flex-col">
                    <span className="text-sm font-medium tracking-wide">{appName}</span>
                </div>
            </div>

            {/* Center: Client Logo */}
            <div className="flex-1 flex justify-center items-center">
                {client?.logo_url ? (
                    <img src={client.logo_url} alt={client.name || 'Client Logo'}
                         className="h-8 md:h-10 object-contain max-w-[150px]" />
                ) : (
                    <div className="h-8 md:h-10 px-4 bg-white/10 rounded flex items-center justify-center font-bold tracking-wider">
                        MOCA
                    </div>
                )}
            </div>

            {/* Right: Powered by Moca */}
            <div className="flex items-center justify-end gap-4 flex-1">
                <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-moca-red opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-moca-red"></span>
                    </span>
                    Powered by Moca
                </div>
            </div>
        </header>
    );
}
```

**Regola:** L'unica cosa che cambia tra app e il valore della prop `appName`.

---

## 4. Footer Standard

**File:** `src/components/layout/Footer.tsx`

```tsx
interface FooterProps {
    appName?: string;
}

export default function Footer({ appName = 'App Name' }: FooterProps) {
    const currentYear = new Date().getFullYear();
    return (
        <footer className="bg-white border-t border-moca-red-light py-6 mt-auto">
            <div className="max-w-7xl mx-auto px-4 text-center">
                <p className="text-sm text-moca-gray">
                    &copy; {currentYear} Moca - {appName}. Tutti i diritti riservati.
                </p>
            </div>
        </footer>
    );
}
```

---

## 5. Moca Context (`src/lib/moca-context.tsx`)

Ogni app deve avere questo file con:
- `getAllConfigs()` esposto nel context
- Mock mode con `client.id` e `user.id` per sviluppo locale
- Interfaccia:

```tsx
interface MocaContextType {
    authenticated: boolean;
    loading: boolean;
    user: any | null;
    client: any | null;
    getConfig: (key: string) => string | null;
    getAllConfigs: () => Record<string, string>;
}
```

**App che necessitano migrazione del context:**
- `moca-schede-prodotto-hub` — usa HubContext custom, va sostituito con MocaSDK
- `app-reviewer-hub` — usa factory pattern in `lib/moca.ts`, va allineato

---

## 6. Storico (History) - Standard Supabase per Client

### Principio
Lo storico e legato al `client_id`, non al `user_id`. Tutti i membri del team di un cliente vedono lo stesso storico.

### Tabella Supabase (una per app)
Ogni app crea la propria tabella per lo storico. Naming convention: `{app_id}_searches` o simile.

Campi obbligatori:
```sql
CREATE TABLE IF NOT EXISTS {nome_tabella} (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,         -- chi ha eseguito la ricerca
    client_id TEXT,                -- per quale cliente (filtro principale)
    created_at TIMESTAMPTZ DEFAULT now(),
    -- ...campi specifici dell'app...
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_{nome}_client_id ON {nome_tabella}(client_id);
CREATE INDEX IF NOT EXISTS idx_{nome}_created_at ON {nome_tabella}(created_at DESC);

-- RLS aperta (auth gestita da Moca SDK)
ALTER TABLE {nome_tabella} ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accesso completo {nome_tabella}"
ON {nome_tabella} FOR ALL USING (true) WITH CHECK (true);
```

### Query standard
```ts
// Fetch storico
const { data } = await supabase
    .from('tabella')
    .select('*')
    .eq('client_id', String(client.id))
    .order('created_at', { ascending: false });

// Insert con client_id
await supabase.from('tabella').insert({
    user_id: String(user.id),
    client_id: String(client.id),
    // ...dati specifici
});

// Delete
await supabase.from('tabella').delete()
    .eq('id', id)
    .eq('client_id', String(client.id));
```

### Migrazione da localStorage (per app che gia hanno storico su localStorage)
Le app che usano localStorage (`reddit-scraper-hub`, `moca-social-scraper`, `maps-hub`) devono:
1. Creare tabella Supabase
2. Sostituire `localStorage.getItem/setItem` con query Supabase
3. Filtrare per `client_id` invece di chiave locale

---

## 7. Tab Impostazioni con Prompt AI Editabili

### Tabella Supabase (condivisa tra tutte le app)
La tabella `app_prompts` e GIA creata (una volta sola) ed e condivisa:

```sql
-- GIA CREATA con supabase-migration-v2.sql
CREATE TABLE IF NOT EXISTS app_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id TEXT NOT NULL,
    app_id TEXT NOT NULL,          -- identifica l'app (da constants.ts)
    prompt_key TEXT NOT NULL,       -- es: 'system_prompt', 'batch_prompt'
    prompt_value TEXT NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, app_id, prompt_key)
);
```

### File da creare per ogni app

#### `src/lib/prompt-definitions.ts`
Definisce i prompt specifici dell'app con valori default:
```ts
export interface PromptDefinition {
    key: string;           // chiave unica (es: 'system_prompt')
    label: string;         // nome visualizzato in UI
    description: string;   // descrizione per l'utente
    defaultValue: string;  // il prompt di default (quello attualmente hardcoded)
}

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
    {
        key: 'system_prompt',
        label: 'System Prompt',
        description: 'Il prompt di sistema principale...',
        defaultValue: `Sei un esperto...`   // ESTRARRE dal codice attuale dell'app
    },
    // ...altri prompt dell'app
];
```

**Per ogni app, i prompt da estrarre sono diversi:**

| App | File sorgente prompt | Prompt da estrarre |
|-----|---------------------|-------------------|
| ads-library-scraper | `src/lib/ai-analyzer.ts` | system_prompt, batch_prompt, synthesis_prompt |
| trustpilot-analyzer | `netlify/functions/analyze.ts` | map_prompt, reduce_prompt |
| reddit-scraper | `netlify/functions/analyze-themes.ts` + altri | keyword_expansion, analysis_prompt |
| moca-social-scraper | `netlify/functions/analyze.ts` | sentiment_prompt, communication_prompt |
| moca-schede-prodotto | `src/components/steps/Step5Generation.tsx` | generation_prompt |
| app-reviewer-hub | `netlify/functions/analyze-batch.ts` + `analyze-consolidate.ts` | batch_prompt, consolidation_prompt |
| maps-hub | Non ha AI prompts | N/A (solo scraper) |
| feedaty-review-scraper | Non ha AI prompts | N/A (solo scraper) |
| fb-reviews-hub | Non ha AI prompts | N/A (solo scraper) |

**Nota:** Le app senza AI (maps, feedaty, fb-reviews) avranno la tab Impostazioni vuota o nascosta.

#### `src/lib/prompt-utils.ts` (identico per tutte le app)
```ts
const SENSITIVE_PATTERNS = /API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIALS/i;

export function resolvePromptVariables(
    promptText: string,
    configs: Record<string, string>,
    client: { id?: string; name?: string; email?: string; logo_url?: string } | null,
    knowledge?: Record<string, string>
): string {
    return promptText.replace(/\{\{([^}]+)\}\}/g, (match, varName: string) => {
        const trimmed = varName.trim();
        // Client fields
        if (trimmed === 'client.id') return client?.id || match;
        if (trimmed === 'client.name') return client?.name || match;
        if (trimmed === 'client.email') return client?.email || match;
        if (trimmed === 'client.logo_url') return client?.logo_url || match;
        // Knowledge base
        if (trimmed === 'knowledge') return knowledge?.['generated_knowledge'] || match;
        if (trimmed.startsWith('knowledge.') && knowledge) {
            return knowledge[trimmed.slice('knowledge.'.length)] || match;
        }
        // Security: skip sensitive config values
        if (SENSITIVE_PATTERNS.test(trimmed)) return match;
        // Config values
        if (configs[trimmed] !== undefined) return configs[trimmed];
        return match;
    });
}
```

#### `src/hooks/useKnowledge.ts` (identico per tutte le app)
Hook che carica TUTTI i campi knowledge dalla tabella `client_knowledge` per il client corrente.
I campi sono dinamici: nuovi campi creati nel Moca Hub appaiono automaticamente come variabili.
- `{{knowledge}}` = shortcut per il campo `generated_knowledge` (conoscenza generata da AI)
- `{{knowledge.FIELD_KEY}}` = qualsiasi campo custom creato nel Hub
Riferimento completo: `ads-library-scraper-hub/src/hooks/useKnowledge.ts`

#### `src/hooks/usePrompts.ts` (identico per tutte le app)
Hook con: `loadPrompts`, `savePrompt`, `resetPrompt`, `getEffectivePrompt`.
Usa `APP_ID` da constants.ts per filtrare per app.
Riferimento completo: `ads-library-scraper-hub/src/hooks/usePrompts.ts`

#### Componenti Settings (identici per tutte le app)
Copiare da `ads-library-scraper-hub/src/components/settings/`:
- `SettingsTab.tsx` — container con lista prompt editor + variabili knowledge
- `PromptEditor.tsx` — textarea + drag-and-drop variabili + salva/reset
- `VariableChip.tsx` — chip draggabile (3 categorie: client=rosso, config=blu, knowledge=viola)

### Integrazione nel Dashboard
Aggiungere terza tab "Impostazioni" nella tab bar:
```tsx
const [activeTab, setActiveTab] = useState<'search' | 'history' | 'settings'>('search');

// Nel JSX della tab bar:
<button onClick={() => setActiveTab('settings')} className={...}>
    <Settings className="w-4 h-4" /> Impostazioni
</button>

// Nel render condizionale:
{activeTab === 'settings' && <SettingsTab />}
```

### Integrazione nei prompt AI
Dove l'app chiama l'AI, usare i prompt custom con knowledge:
```ts
import { usePrompts } from '../hooks/usePrompts';
import { useKnowledge } from '../hooks/useKnowledge';
import { resolvePromptVariables } from '../lib/prompt-utils';

const { getEffectivePrompt } = usePrompts();
const { getAllConfigs, client } = useMoca();
const { knowledge } = useKnowledge();

// Prima di chiamare l'AI:
const systemPrompt = resolvePromptVariables(
    getEffectivePrompt('system_prompt'),
    getAllConfigs(),
    client,
    knowledge
);
```

Per le app che usano Netlify Functions per l'AI:
- Passare il prompt custom dal frontend nella request body
- La funzione Netlify usa il prompt ricevuto invece di quello hardcoded

---

## 8. Supabase - Configurazione

### Progetto unico
Tutte le app usano lo stesso progetto Supabase del Moca Hub.

### Variabili d'ambiente (`.env`)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_MOCA_HUB_URL=https://moca-central-hub.netlify.app
```

### File `src/lib/supabase.ts` (standard)
```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Se l'app non ha ancora `@supabase/supabase-js`:
```bash
npm install @supabase/supabase-js
```

---

## 9. Checklist per Allineare un'App Esistente

### Fase 1: Setup Base
- [ ] Creare `src/lib/constants.ts` con `APP_ID` e `APP_NAME`
- [ ] Verificare/aggiornare `src/lib/moca-context.tsx` (aggiungere `getAllConfigs`, mock con `client.id`)
- [ ] Installare `@supabase/supabase-js` se mancante
- [ ] Creare `src/lib/supabase.ts` se mancante
- [ ] Configurare `.env` con Supabase URL e Key

### Fase 2: Header e Footer
- [ ] Sostituire Header con versione standard (prop `appName`)
- [ ] Sostituire Footer con versione standard (prop `appName`)
- [ ] Aggiornare `App.tsx` per passare `APP_NAME`

### Fase 3: Storico
- [ ] Creare tabella Supabase per lo storico dell'app (con `client_id`)
- [ ] Sostituire localStorage con query Supabase
- [ ] Filtrare per `client_id` (non `user_id`)
- [ ] Aggiungere `client_id` negli insert

### Fase 4: Impostazioni Prompt (solo app con AI)
- [ ] Creare `src/lib/prompt-definitions.ts` estraendo i prompt attuali
- [ ] Copiare `src/lib/prompt-utils.ts` (identico)
- [ ] Copiare `src/hooks/usePrompts.ts` (identico)
- [ ] Copiare `src/hooks/useKnowledge.ts` (identico)
- [ ] Copiare `src/components/settings/` (3 componenti)
- [ ] Aggiungere tab "Impostazioni" nel Dashboard
- [ ] Integrare prompt custom nelle chiamate AI

### Fase 5: Verifica
- [ ] `npm run build` senza errori
- [ ] Test Header/Footer visivamente
- [ ] Test storico: crea, visualizza, elimina
- [ ] Test impostazioni: modifica prompt, salva, reset
- [ ] Test drag-and-drop variabili
- [ ] Test analisi AI con prompt custom

---

## 10. Stato Attuale delle App

| App | Header | Footer | Storico | Impostazioni | Moca SDK |
|-----|--------|--------|---------|-------------|----------|
| ads-library-scraper | DONE | DONE | DONE (Supabase) | DONE | DONE |
| trustpilot-analyzer | DA FARE | DA FARE | DA FARE | DA FARE (ha AI) | OK |
| reddit-scraper | DA FARE | DA FARE | DA FARE (localStorage->Supabase) | DA FARE (ha AI) | OK |
| moca-social-scraper | DA FARE | DA FARE | DA FARE (localStorage->Supabase) | DA FARE (ha AI) | OK |
| moca-schede-prodotto | DA FARE | DA FARE | DA FARE | DA FARE (ha AI) | DA MIGRARE (HubContext) |
| maps-hub | DA FARE | DA FARE | DA FARE (localStorage->Supabase) | N/A (no AI) | OK |
| feedaty-review-scraper | DA FARE | DA FARE | DA FARE | N/A (no AI) | OK |
| fb-reviews-hub | DA FARE | DA FARE | DA FARE | N/A (no AI) | OK |
| app-reviewer-hub | DA FARE | DA FARE | DA FARE | DA FARE (ha AI) | DA ALLINEARE |

---

## 11. Riferimento: App Pilota

L'implementazione di riferimento completa e in:
```
/Users/danielepisciottano/Desktop/APP-HUB/ads-library-scraper-hub/
```

File chiave da usare come template:
- `src/lib/constants.ts`
- `src/lib/moca-context.tsx`
- `src/lib/prompt-definitions.ts`
- `src/lib/prompt-utils.ts`
- `src/hooks/useKnowledge.ts`
- `src/hooks/usePrompts.ts`
- `src/components/layout/Header.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/settings/SettingsTab.tsx`
- `src/components/settings/PromptEditor.tsx`
- `src/components/settings/VariableChip.tsx`
- `src/pages/Dashboard.tsx` (per il pattern 3-tab)

---

## 12. Prompt per Nuove Chat Claude Code

Quando apri una nuova chat per allineare un'app specifica, usa questo prompt:

```
Devo allineare l'app trustpilot-analyzer-hub agli standard del Moca Hub.

Leggi le linee guida in /Users/danielepisciottano/Desktop/APP-HUB/STANDARD-APP-GUIDELINES.md

Usa come riferimento l'app pilota gia completata:
/Users/danielepisciottano/Desktop/APP-HUB/ads-library-scraper-hub/

L'app da allineare si trova in:
/Users/danielepisciottano/Desktop/APP-HUB/trustpilot-analyzer-hub

Segui la checklist nella sezione 9 delle linee guida.
La tabella app_prompts su Supabase e gia creata (condivisa tra tutte le app).

Cose da fare:
1. Header e Footer standard (parametrizzati con appName)
2. Storico su Supabase filtrato per client_id
3. Tab Impostazioni con prompt AI editabili e variabili drag-and-drop
4. Build senza errori
```
