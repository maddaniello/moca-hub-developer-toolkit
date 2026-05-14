import type { Context } from "@netlify/functions";
import { corsHeaders, jsonResponse, errorResponse, log } from './utils/helpers';
import { supabaseAdmin } from './utils/supabase-admin';

// Fallback prompt if DB has no entry
const DEFAULT_CONTRACT_PROMPT = `Sei un analista di agenzia di marketing digitale. Analizza il contratto e restituisci SOLO i servizi proposti, divisi per area.

REGOLE IMPORTANTI:
- IGNORA completamente le sezioni "Condizioni Generali di Contratto" e "Privacy Policy"
- IGNORA date di scadenza se non esplicitamente indicate come data specifica
- NON riassumere - riporta il DETTAGLIO di ogni servizio come scritto nel contratto
- Per ogni servizio indica: nome, prezzo, e tutte le attivita incluse nel dettaglio
- Se ci sono sconti o voci di sconto, riportali
- Alla fine indica il TOTALE del contratto

FORMATO OUTPUT (usa esattamente questo formato markdown):

## Riepilogo Contratto

**Cliente:** [nome cliente]
**Totale contratto:** [importo]

---

### [Nome Area/Servizio 1] - [importo]

[Descrizione e dettaglio completo delle attivita incluse, esattamente come nel contratto]

**Incluso:**
- [lista puntata delle attivita]

**Non incluso:** [se specificato]

---

### Sconti
[Se presenti]

---

### Totale: [importo finale]`;

export default async (req: Request, context: Context) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse('Missing authorization', 401);
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return errorResponse('Invalid token', 401);

        const { data: userData } = await supabaseAdmin
            .from('users').select('role, status').eq('id', user.id).single();
        if (!userData || userData.status !== 'active' || !['super_admin', 'manager'].includes(userData.role)) {
            return errorResponse('Insufficient permissions', 403);
        }

        const body = await req.json();
        const { client_id, contract_id, ai_provider } = body;

        if (!client_id || !contract_id) return errorResponse('client_id and contract_id are required');
        if (!ai_provider || !['openai', 'anthropic', 'gemini'].includes(ai_provider)) {
            return errorResponse('Valid ai_provider is required');
        }

        // Get the contract
        const { data: contract } = await supabaseAdmin
            .from('client_contracts').select('*').eq('id', contract_id).eq('client_id', client_id).single();
        if (!contract) return errorResponse('Contract not found');

        // Get AI API key - client first, then global env vars
        const keyMap: Record<string, string> = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' };

        let apiKey = '';
        const { data: configData } = await supabaseAdmin
            .from('configurations').select('config_value').eq('client_id', client_id).eq('config_key', keyMap[ai_provider]).single();

        apiKey = configData?.config_value || process.env[keyMap[ai_provider]] || '';
        if (!apiKey) return errorResponse(`API key ${keyMap[ai_provider]} non configurata.`);

        // Get system prompt from DB (or use default)
        let SYSTEM_PROMPT = DEFAULT_CONTRACT_PROMPT;
        const { data: promptData } = await supabaseAdmin
            .from('system_prompts')
            .select('prompt_value')
            .eq('prompt_key', 'contract_analysis')
            .single();
        if (promptData?.prompt_value) {
            SYSTEM_PROMPT = promptData.prompt_value;
        }

        // Download the contract file as binary
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from('client-files').download(contract.file_path);
        if (downloadError || !fileData) return errorResponse('Failed to download contract file');

        const buffer = Buffer.from(await fileData.arrayBuffer());
        const base64 = buffer.toString('base64');
        const fileSizeMB = buffer.length / (1024 * 1024);

        if (fileSizeMB > 20) return errorResponse('Il PDF e\' troppo grande (max 20MB)');

        let analysisText = '';

        // === ANTHROPIC - Native PDF support ===
        if (ai_provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 4000,
                    system: SYSTEM_PROMPT,
                    messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'document',
                                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
                            },
                            { type: 'text', text: 'Estrai tutti i servizi proposti con i relativi importi e dettagli. Ignora condizioni generali e privacy policy.' },
                        ],
                    }],
                    temperature: 0.2,
                }),
            });
            const result = await response.json();
            if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
            analysisText = result.content?.[0]?.text || '';
        }

        // === OPENAI - PDF as file in message ===
        else if (ai_provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'file',
                                    file: { filename: contract.file_name, file_data: `data:application/pdf;base64,${base64}` },
                                },
                                { type: 'text', text: 'Estrai tutti i servizi proposti con i relativi importi e dettagli. Ignora condizioni generali e privacy policy.' },
                            ],
                        },
                    ],
                    max_tokens: 4000,
                    temperature: 0.2,
                }),
            });
            const result = await response.json();
            if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
            analysisText = result.choices?.[0]?.message?.content || '';
        }

        // === GEMINI - Inline PDF data ===
        else if (ai_provider === 'gemini') {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inline_data: { mime_type: 'application/pdf', data: base64 } },
                            { text: `${SYSTEM_PROMPT}\n\nEstrai tutti i servizi proposti con i relativi importi e dettagli. Ignora condizioni generali e privacy policy.` },
                        ],
                    }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 4000 },
                }),
            });
            const result = await response.json();
            if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
            analysisText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        if (!analysisText) return errorResponse('AI did not generate any analysis');

        // Save analysis
        await supabaseAdmin.from('client_contracts').update({
            analysis: analysisText,
            analyzed_at: new Date().toISOString(),
        }).eq('id', contract_id);

        await log('info', `Contract analyzed for client ${client_id}`, { contract_id, ai_provider }, user.id);

        return jsonResponse({ success: true, analysis: analysisText });

    } catch (error: any) {
        await log('error', 'Error in analyze-contract', { error: error.message });
        return errorResponse('Errore: ' + error.message, 500);
    }
};
