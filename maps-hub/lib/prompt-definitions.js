// Definisce i prompt AI editabili dell'app maps-hub.
// Le variabili tra {{...}} vengono risolte runtime via prompt-utils.js.
//
// Variabili speciali (oltre a {{client.*}}, {{knowledge.*}}, {{CONFIG_KEY}}):
// - {{place_name}}      → nome scheda Google Maps (solo place_analysis)
// - {{brand_name}}      → nome brand (solo aggregated_analysis)
// - {{total_places}}    → numero schede analizzate (solo aggregated_analysis)
// - {{total_reviews}}   → numero totale recensioni
// - {{positive_count}}  → numero recensioni positive nel campione
// - {{negative_count}}  → numero recensioni negative nel campione
// - {{positive_reviews}}→ testo concatenato recensioni positive
// - {{negative_reviews}}→ testo concatenato recensioni negative
// - {{analysis_type}}   → "CAMPIONAMENTO (Presale)" oppure "ANALISI COMPLETA"
window.PROMPT_DEFINITIONS = [
    {
        key: 'place_analysis_prompt',
        label: 'Analisi Singola Scheda',
        description: 'Prompt usato per analizzare le recensioni di una singola scheda Google Maps. Genera punti di forza, debolezze, priorita e suggerimenti per quel locale.',
        defaultValue: `Analizza le seguenti recensioni di Google Maps per "{{place_name}}".
MODALITA': {{analysis_type}}

RECENSIONI POSITIVE ({{positive_count}}):
{{positive_reviews}}

RECENSIONI NEGATIVE ({{negative_count}}):
{{negative_reviews}}

Totale recensioni: {{total_reviews}}

Fornisci un'analisi strutturata in formato JSON con TUTTI questi campi:
{
  "temi_principali": ["3-5 temi/argomenti principali ricorrenti nelle recensioni (es: qualita servizio, tempi attesa, cortesia staff, pulizia, prezzi)"],
  "strengths": ["3-5 punti di forza emersi dalle recensioni positive"],
  "weaknesses": ["3-5 aree di miglioramento dalle recensioni negative"],
  "priorities": ["3 priorita urgenti da affrontare"],
  "recommendations": ["3-5 raccomandazioni strategiche"],
  "suggestions": ["5-7 suggerimenti concreti e actionable"],
  "esempi_positivi": [{"stars": 5, "text": "Citazione breve di una recensione positiva rappresentativa"}],
  "esempi_negativi": [{"stars": 1, "text": "Citazione breve di una recensione negativa rappresentativa"}]
}

IMPORTANTE:
- "temi_principali": identifica i macro-temi piu discussi dai clienti
- "esempi_positivi": seleziona 2-3 citazioni reali dalle recensioni positive piu rappresentative
- "esempi_negativi": seleziona 2-3 citazioni reali dalle recensioni negative piu rappresentative
- Concentrati su pattern ricorrenti. Scrivi in italiano. Rispondi SOLO con JSON valido.`
    },
    {
        key: 'place_analysis_system',
        label: 'System Prompt - Singola Scheda',
        description: 'Ruolo (system message) usato per l\'analisi di una singola scheda. Definisce il "personaggio" dell\'AI.',
        defaultValue: 'Sei un esperto di analisi del sentiment e customer experience. Rispondi sempre in formato JSON valido.'
    },
    {
        key: 'aggregated_analysis_prompt',
        label: 'Analisi Aggregata Brand',
        description: 'Prompt usato per l\'analisi strategica a livello brand su tutte le schede del cliente. Genera insight aggregati su tutte le sedi.',
        defaultValue: `Analizza queste recensioni AGGREGATE di {{total_places}} schede Google Maps del brand "{{brand_name}}".
MODALITA': {{analysis_type}}

Totale recensioni analizzate: {{total_reviews}}
- Positive (4-5 stelle): {{positive_count}}
- Negative (1-2 stelle): {{negative_count}}

CAMPIONE RECENSIONI POSITIVE:
{{positive_reviews}}

CAMPIONE RECENSIONI NEGATIVE:
{{negative_reviews}}

Fornisci un'analisi STRATEGICA a livello BRAND in formato JSON con TUTTI questi esatti campi:
1. "temi_principali": array di 5-8 temi/argomenti principali ricorrenti nelle recensioni (es: qualita servizio, tempi attesa, cortesia staff, pulizia, prezzi, competenza)
2. "strengths": array di 5-8 punti di forza COMUNI a livello brand
3. "weaknesses": array di 5-8 punti di debolezza RICORRENTI a livello brand
4. "priorities": array di 3 priorita assolute da affrontare subito
5. "recommendations": array di 5-7 azioni strategiche per il brand
6. "suggestions": array di 3-5 suggerimenti tattici immediati
7. "esempi_positivi": array di 2-3 oggetti {"stars": numero, "text": "citazione breve rappresentativa"} selezionati dalle recensioni positive piu significative
8. "esempi_negativi": array di 2-3 oggetti {"stars": numero, "text": "citazione breve rappresentativa"} selezionati dalle recensioni negative piu significative

IMPORTANTE:
- "temi_principali": identifica i macro-temi piu discussi dai clienti trasversalmente alle sedi
- "esempi_positivi/negativi": seleziona citazioni REALI dalle recensioni fornite sopra

Concentrati su PATTERN RICORRENTI e INSIGHT STRATEGICI, non su casi singoli.
Scrivi in ITALIANO.
Rispondi SOLO con JSON valido, senza testo aggiuntivo.`
    },
    {
        key: 'aggregated_analysis_system',
        label: 'System Prompt - Analisi Aggregata',
        description: 'Ruolo (system message) usato per l\'analisi aggregata brand-level.',
        defaultValue: 'Sei un consulente strategico esperto in brand reputation e customer experience. Rispondi sempre in formato JSON valido.'
    }
];
