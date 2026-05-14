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
            openaiModel = 'gpt-4o-mini',
            placeName,
            reviews,
            samplingEnabled = true,
            customPrompt,
            customSystemPrompt
        } = JSON.parse(event.body);

        if (!openaiApiKey || !placeName || !reviews) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: openaiApiKey, placeName, reviews' })
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
                        strengths: ['Dati insufficienti per l\'analisi'],
                        weaknesses: ['Nessuna recensione con testo disponibile'],
                        priorities: ['Incoraggiare i clienti a lasciare recensioni dettagliate'],
                        recommendations: ['Migliorare la quantità e qualità delle recensioni'],
                        suggestions: ['Implementare campagne di richiesta recensioni']
                    }
                })
            };
        }

        let positiveReviews, negativeReviews;
        let charLimit = 200;
        let analysisType = 'CAMPIONAMENTO (Presale)';

        if (samplingEnabled) {
            positiveReviews = reviewsWithText.filter(r => (r.stars || 0) >= 4).slice(0, 20);
            negativeReviews = reviewsWithText.filter(r => (r.stars || 0) <= 2).slice(0, 20);
        } else {
            positiveReviews = reviewsWithText.filter(r => (r.stars || 0) >= 4);
            negativeReviews = reviewsWithText.filter(r => (r.stars || 0) <= 2);
            charLimit = 1000;
            analysisType = 'ANALISI COMPLETA';
        }

        const positiveTexts = positiveReviews.map(r => `- ${(r.text || '').substring(0, charLimit)}`).join('\n')
            || '- Nessuna recensione positiva con testo';
        const negativeTexts = negativeReviews.map(r => `- ${(r.text || '').substring(0, charLimit)}`).join('\n')
            || '- Nessuna recensione negativa con testo';

        // Default prompt template (deve combaciare con lib/prompt-definitions.js)
        const DEFAULT_PROMPT = `Analizza le seguenti recensioni di Google Maps per "{{place_name}}".
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
- Concentrati su pattern ricorrenti. Scrivi in italiano. Rispondi SOLO con JSON valido.`;

        const DEFAULT_SYSTEM = 'Sei un esperto di analisi del sentiment e customer experience. Rispondi sempre in formato JSON valido.';

        const promptTemplate = (customPrompt && customPrompt.trim()) || DEFAULT_PROMPT;
        const systemPrompt = (customSystemPrompt && customSystemPrompt.trim()) || DEFAULT_SYSTEM;

        const vars = {
            place_name: placeName,
            analysis_type: analysisType,
            positive_count: String(positiveReviews.length),
            negative_count: String(negativeReviews.length),
            positive_reviews: positiveTexts,
            negative_reviews: negativeTexts,
            total_reviews: String(reviewsWithText.length)
        };

        const prompt = resolveVars(promptTemplate, vars);

        console.log(`Analyzing ${reviewsWithText.length} reviews for ${placeName} (${positiveReviews.length} pos, ${negativeReviews.length} neg samples)`);

        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2500
        });

        const analysisText = completion.choices[0].message.content.trim()
            .replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(analysisText);

        console.log('Analysis completed successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                analysis
            })
        };

    } catch (error) {
        console.error('Error analyzing place:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to analyze place',
                message: error.message
            })
        };
    }
};
