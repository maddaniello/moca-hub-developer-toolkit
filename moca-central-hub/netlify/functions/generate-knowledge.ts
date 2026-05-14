import type { Context } from "@netlify/functions";
import { corsHeaders, jsonResponse, errorResponse, log } from './utils/helpers';
import { supabaseAdmin } from './utils/supabase-admin';

export default async (req: Request, context: Context) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        // Verify auth token
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse('Missing or invalid authorization header', 401);
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return errorResponse('Invalid token', 401);
        }

        // Check user role
        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role, status')
            .eq('id', user.id)
            .single();

        if (!userData || userData.status !== 'active') {
            return errorResponse('User not active', 403);
        }

        if (!['super_admin', 'manager'].includes(userData.role)) {
            return errorResponse('Insufficient permissions', 403);
        }

        const body = await req.json();
        const { client_id, ai_provider, file_ids } = body;

        if (!client_id) {
            return errorResponse('client_id is required');
        }

        if (!ai_provider || !['openai', 'anthropic', 'gemini'].includes(ai_provider)) {
            return errorResponse('Valid ai_provider is required (openai, anthropic, gemini)');
        }

        // Get unanalyzed files for this client
        let fileQuery = supabaseAdmin
            .from('client_files')
            .select('*')
            .eq('client_id', client_id)
            .eq('analyzed', false);

        if (file_ids && file_ids.length > 0) {
            fileQuery = fileQuery.in('id', file_ids);
        }

        const { data: files, error: filesError } = await fileQuery;

        if (filesError) {
            return errorResponse('Error fetching files: ' + filesError.message, 500);
        }

        if (!files || files.length === 0) {
            return errorResponse('No unanalyzed files found');
        }

        // Get AI API key from client configurations
        const keyMap: Record<string, string> = {
            openai: 'OPENAI_API_KEY',
            anthropic: 'ANTHROPIC_API_KEY',
            gemini: 'GEMINI_API_KEY',
        };

        let apiKey = '';

        // 1. Try client-specific key
        const { data: configData } = await supabaseAdmin
            .from('configurations')
            .select('config_value')
            .eq('client_id', client_id)
            .eq('config_key', keyMap[ai_provider])
            .single();

        if (configData?.config_value) {
            apiKey = configData.config_value;
        } else {
            // 2. Fallback to global Hub API keys (env vars)
            const envKey = process.env[keyMap[ai_provider]] || '';
            if (envKey) {
                apiKey = envKey;
            }
        }

        if (!apiKey) {
            return errorResponse(`API key ${keyMap[ai_provider]} non configurata. Configura la chiave sul cliente o le chiavi globali del Hub.`);
        }

        // Download and extract text from files
        let combinedText = '';
        for (const file of files) {
            try {
                const { data: fileData, error: downloadError } = await supabaseAdmin
                    .storage
                    .from('client-files')
                    .download(file.file_path);

                if (downloadError || !fileData) {
                    await log('warning', `Failed to download file ${file.file_name}`, { error: downloadError });
                    continue;
                }

                // Extract text - use pdf-parse for PDFs, text() for others
                // For text-based files, extract directly. PDFs should be uploaded in Contracts section for proper AI analysis.
                const text = await fileData.text();
                combinedText += `\n\n--- File: ${file.file_name} ---\n${text}`;
            } catch (err) {
                await log('warning', `Error processing file ${file.file_name}`, { error: String(err) });
            }
        }

        if (!combinedText.trim()) {
            return errorResponse('Could not extract text from any of the files');
        }

        // Security: limit input size to prevent abuse and sanitize
        const MAX_INPUT_CHARS = 100000; // ~100KB of text
        if (combinedText.length > MAX_INPUT_CHARS) {
            combinedText = combinedText.substring(0, MAX_INPUT_CHARS) + '\n\n[... contenuto troncato per limiti di sicurezza ...]';
        }

        // Get existing knowledge to provide context
        const { data: existingKnowledge } = await supabaseAdmin
            .from('client_knowledge')
            .select('field_value')
            .eq('client_id', client_id)
            .eq('field_key', 'generated_knowledge')
            .single();

        const existingText = existingKnowledge?.field_value || '';

        // Get system prompt from DB (or use default)
        const DEFAULT_KB_PROMPT = `Sei un analista esperto di brand e comunicazione. Analizza i seguenti documenti di un cliente e estrai informazioni utili come:
- Chi e il cliente (descrizione azienda/brand)
- Servizi/prodotti offerti
- Tone of voice e stile comunicativo
- Brand identity e valori
- Target audience
- Competitor principali (se menzionati)
- Qualsiasi altra informazione rilevante per creare contenuti e strategie`;

        let basePrompt = DEFAULT_KB_PROMPT;
        const { data: promptData } = await supabaseAdmin
            .from('system_prompts')
            .select('prompt_value')
            .eq('prompt_key', 'knowledge_generation')
            .single();
        if (promptData?.prompt_value) {
            basePrompt = promptData.prompt_value;
        }

        const systemPrompt = `${basePrompt}

${existingText ? `IMPORTANTE: Esiste gia una knowledge base per questo cliente. NON ripetere informazioni gia presenti. Aggiungi SOLO informazioni NUOVE che emergono dai nuovi documenti. Ecco la knowledge base esistente:\n\n${existingText}\n\n---\nOra analizza i NUOVI documenti e fornisci SOLO le informazioni aggiuntive:` : 'Fornisci un riassunto strutturato e dettagliato:'}`;

        // Call AI provider
        let generatedText = '';

        if (ai_provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: combinedText },
                    ],
                    max_tokens: 4000,
                    temperature: 0.3,
                }),
            });

            const result = await response.json();
            if (result.error) throw new Error(result.error.message);
            generatedText = result.choices?.[0]?.message?.content || '';

        } else if (ai_provider === 'anthropic') {
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
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: combinedText },
                    ],
                    temperature: 0.3,
                }),
            });

            const result = await response.json();
            if (result.error) throw new Error(result.error.message);
            generatedText = result.content?.[0]?.text || '';

        } else if (ai_provider === 'gemini') {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${systemPrompt}\n\n${combinedText}` }],
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 4000,
                    },
                }),
            });

            const result = await response.json();
            if (result.error) throw new Error(result.error.message);
            generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        if (!generatedText) {
            return errorResponse('AI did not generate any content');
        }

        // Save/update the generated knowledge
        const newValue = existingText
            ? `${existingText}\n\n--- Aggiornamento ${new Date().toLocaleDateString('it-IT')} ---\n${generatedText}`
            : generatedText;

        await supabaseAdmin
            .from('client_knowledge')
            .upsert({
                client_id,
                field_key: 'generated_knowledge',
                field_value: newValue,
                field_type: 'generated',
            }, {
                onConflict: 'client_id,field_key',
            });

        // Mark files as analyzed
        const analyzedIds = files.map(f => f.id);
        await supabaseAdmin
            .from('client_files')
            .update({ analyzed: true })
            .in('id', analyzedIds);

        await log('info', `Knowledge generated for client ${client_id}`, {
            files_analyzed: files.length,
            ai_provider,
        }, user.id);

        return jsonResponse({
            success: true,
            generated_text: generatedText,
            files_analyzed: files.length,
        });

    } catch (error: any) {
        await log('error', 'Error in generate-knowledge', { error: error.message });
        return errorResponse('Internal error: ' + error.message, 500);
    }
};
