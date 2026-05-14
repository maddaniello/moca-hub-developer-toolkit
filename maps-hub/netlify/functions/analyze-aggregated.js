const { OpenAI } = require('openai');

// Risolve {{var}} dentro un prompt usando il dizionario fornito.
function resolveVars(promptText, vars) {
    return promptText.replace(/\{\{([^}]+)\}\}/g, (match, name) => {
        const trimmed = name.trim();
        if (Object.prototype.hasOwnProperty.call(vars, trimmed)) {
            return vars[trimmed];
        }
        return match;
    });
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const {
            openaiApiKey,
            openaiModel = 'gpt-4o',
            reviews,
            brandName,
            totalPlaces,
            samplingEnabled = true,
            customPrompt,
            customSystemPrompt
        } = JSON.parse(event.body);

        if (!openaiApiKey || !reviews || !brandName) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: openaiApiKey, reviews, brandName' })
            };
        }

        const openai = new OpenAI({ apiKey: openaiApiKey });

        // Filter reviews with text
        const reviewsWithText = reviews.filter(r => r.text && r.text.trim().length > 0);

        if (reviewsWithText.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    analysis: {
                        strengths: ['Dati insufficienti'],
                        weaknesses: ['Nessuna recensione con testo'],
                        priorities: [],
                        recommendations: ['Incoraggiare recensioni testuali'],
                        suggestions: []
                    }
                })
            };
        }

        let positiveReviews, negativeReviews;
        let charLimit = 150;
        let analysisType = 'CAMPIONAMENTO (Presale)';

        if (samplingEnabled) {
            positiveReviews = reviewsWithText.filter(r => (r.stars || 0) >= 4).slice(0, 30);
            negativeReviews = reviewsWithText.filter(r => (r.stars || 0) <= 2).slice(0, 30);
        } else {
            positiveReviews = reviewsWithText.filter(r => (r.stars || 0) >= 4);
            negativeReviews = reviewsWithText.filter(r => (r.stars || 0) <= 2);
            charLimit = 1000;
            analysisType = 'ANALISI COMPLETA';
        }

        const positiveTexts = positiveReviews.map(r => `- ${(r.text || '').substring(0, charLimit)}`).join('\n')
            || '(Nessuna recensione positiva con testo)';
        const negativeTexts = negativeReviews.map(r => `- ${(r.text || '').substring(0, charLimit)}`).join('\n')
            || '(Nessuna recensione negativa con testo)';

        // Default prompt template (deve combaciare con lib/prompt-definitions.js)
        const DEFAULT_PROMPT = `Analizza queste recensioni AGGREGATE di {{total_places}} schede Google Maps del brand "{{brand_name}}".
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
Rispondi SOLO con JSON valido, senza testo aggiuntivo.`;

        const DEFAULT_SYSTEM = 'Sei un consulente strategico esperto in brand reputation e customer experience. Rispondi sempre in formato JSON valido.';

        const promptTemplate = (customPrompt && customPrompt.trim()) || DEFAULT_PROMPT;
        const systemPrompt = (customSystemPrompt && customSystemPrompt.trim()) || DEFAULT_SYSTEM;

        const totalPositive = reviews.filter(r => (r.stars || 0) >= 4).length;
        const totalNegative = reviews.filter(r => (r.stars || 0) <= 2).length;

        const vars = {
            brand_name: brandName,
            total_places: String(totalPlaces || 'diverse'),
            analysis_type: analysisType,
            total_reviews: String(reviews.length),
            positive_count: String(totalPositive),
            negative_count: String(totalNegative),
            positive_reviews: positiveTexts,
            negative_reviews: negativeTexts
        };

        const prompt = resolveVars(promptTemplate, vars);

        console.log(`Starting aggregated analysis for ${brandName} with ${reviews.length} total reviews`);

        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 3500
        });

        const analysisText = completion.choices[0].message.content.trim()
            .replace(/```json/g, '').replace(/```/g, '').trim();

        let analysis;
        try {
            analysis = JSON.parse(analysisText);
        } catch (e) {
            console.error('Failed to parse OpenAI response:', analysisText);
            throw new Error('Invalid JSON response from OpenAI');
        }

        console.log('Aggregated analysis completed successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                analysis
            })
        };

    } catch (error) {
        console.error('Error in aggregated analysis:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to perform aggregated analysis',
                message: error.message
            })
        };
    }
};
