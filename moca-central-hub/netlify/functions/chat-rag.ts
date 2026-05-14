import type { Context } from "@netlify/functions";
import { corsHeaders, jsonResponse, errorResponse, log } from './utils/helpers';
import { supabaseAdmin } from './utils/supabase-admin';

/**
 * Chat RAG Endpoint
 *
 * Flow:
 * 1. Receive user message + client_id + session_id
 * 2. Generate embedding of the user query
 * 3. Hybrid search: vector similarity + full-text keyword match
 * 4. Fetch document summaries for context breadth
 * 5. Find related documents via entity graph
 * 6. Build prompt with retrieved context
 * 7. Call GPT-4o-mini with conversation history + context
 * 8. Save messages to chat history
 * 9. Return response with cited sources
 */

const MAX_CONTEXT_CHUNKS = 12;
const MAX_HISTORY_MESSAGES = 10;
const MODEL = 'gpt-4o-mini';

function getOpenAIKey(): string {
    const key = process.env.MOCA_OPENAI_API_KEY;
    if (!key) throw new Error('MOCA_OPENAI_API_KEY not set');
    return key;
}

// --- Step 2: Embed the user query ---
async function embedQuery(text: string): Promise<number[]> {
    const apiKey = getOpenAIKey();
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    });

    if (!response.ok) throw new Error(`Embedding error: ${response.status}`);
    const data = await response.json();
    return data.data[0].embedding;
}

// --- Step 3: Hybrid search (vector + keyword) ---
async function hybridSearch(
    queryEmbedding: number[],
    queryText: string,
    clientId: string
): Promise<Array<{
    id: string;
    file_id: string;
    chunk_text: string;
    chunk_level: number;
    file_name: string;
    file_path: string;
    metadata: any;
    combined_score: number;
}>> {
    const { data, error } = await supabaseAdmin.rpc('match_documents_hybrid', {
        query_embedding: JSON.stringify(queryEmbedding),
        query_text: queryText,
        match_client_id: clientId,
        match_count: MAX_CONTEXT_CHUNKS,
        match_threshold: 0.55,
        keyword_weight: 0.3,
        vector_weight: 0.7,
    });

    if (error) {
        console.error('[chat-rag] Hybrid search error:', error.message);
        return [];
    }

    return data || [];
}

// --- Step 4: Get document summaries for broad context ---
async function getRelevantSummaries(
    queryEmbedding: number[],
    clientId: string
): Promise<Array<{ summary: string; doc_type: string; file_name: string; date_range: string | null }>> {
    // Find top 5 most relevant document summaries
    const { data, error } = await supabaseAdmin
        .from('client_document_summaries')
        .select(`
            summary, doc_type, date_range, key_topics,
            file:client_drive_files!file_id(file_name, file_path)
        `)
        .eq('client_id', clientId);

    if (error || !data) return [];

    // We can't do vector search via the JS client on summary embeddings directly,
    // so we return all summaries and let the LLM sort relevance via prompt.
    // For large volumes (>50 docs), we'd add a dedicated RPC function.
    // For now, return top 8 summaries (most clients have <50 docs)
    return data.slice(0, 8).map((d: any) => ({
        summary: d.summary,
        doc_type: d.doc_type,
        file_name: d.file?.file_name || 'Documento',
        date_range: d.date_range,
    }));
}

// --- Step 5: Get entities for this client (for graph context) ---
async function getClientEntities(clientId: string): Promise<string> {
    const { data } = await supabaseAdmin
        .from('client_entities')
        .select('entity_type, entity_value, occurrence_count')
        .eq('client_id', clientId)
        .order('occurrence_count', { ascending: false })
        .limit(30);

    if (!data || data.length === 0) return '';

    // Group by type
    const grouped: Record<string, string[]> = {};
    for (const e of data) {
        if (!grouped[e.entity_type]) grouped[e.entity_type] = [];
        grouped[e.entity_type].push(e.entity_value);
    }

    const parts: string[] = [];
    if (grouped.servizio) parts.push(`Servizi attivi/storici: ${grouped.servizio.join(', ')}`);
    if (grouped.azienda) parts.push(`Aziende coinvolte: ${grouped.azienda.join(', ')}`);
    if (grouped.persona) parts.push(`Persone di riferimento: ${grouped.persona.join(', ')}`);
    if (grouped.importo) parts.push(`Importi rilevanti: ${grouped.importo.join(', ')}`);
    if (grouped.prodotto) parts.push(`Prodotti/Piattaforme: ${grouped.prodotto.join(', ')}`);
    if (grouped.kpi) parts.push(`KPI rilevanti: ${grouped.kpi.join(', ')}`);

    return parts.join('\n');
}

// --- Step 6: Load conversation history ---
async function getConversationHistory(
    sessionId: string,
    clientId: string
): Promise<Array<{ role: string; content: string }>> {
    const { data } = await supabaseAdmin
        .from('client_chat_history')
        .select('role, content')
        .eq('session_id', sessionId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
        .limit(MAX_HISTORY_MESSAGES);

    return (data || []).map(m => ({ role: m.role, content: m.content }));
}

// --- Step 7: Build the RAG prompt ---

// Default system prompt — used if no custom prompt is set in system_prompts table
const DEFAULT_RAG_PROMPT = `Sei un consulente senior di Moca Interactive.

CHI E MOCA INTERACTIVE:
Moca Interactive e un'agenzia di performance marketing con sede a Padova, con oltre 200 clienti tra startup e aziende strutturate.
L'agenzia offre tre aree di servizio:

1. STRATEGY — Analisi competitiva, Scenario e Competitor Analysis, E-commerce Management, Paid Media e SEO Strategy, TikTok Strategy, Academy e Masterclass
2. PERFORMANCE — Search/Video/Social Advertising, Programmatic, Experience Optimization e A/B Test, UX/UI Design, Copywriting, Email Marketing, SEO Onsite e Offsite, Digital Creative Production, Landing Page
3. DATA E TECH — Marketing Automation, ESP e CDP, Data Strategy e Tracking, Data Analytics e Visualization, Adtech

STRUTTURA CONTRATTUALE TIPICA:
- I clienti hanno contratti annuali o semestrali con fee mensile fisso
- Ogni contratto include una lista di servizi attivi e KPI concordati
- I rinnovi possono modificare servizi e importi rispetto all'anno precedente
- I preventivi/proposte precedono i contratti e contengono dettagli sui servizi proposti

COME DEVI RISPONDERE:
- Rispondi SOLO basandoti sui documenti forniti nel contesto
- Se non hai informazioni sufficienti, dillo chiaramente e suggerisci quali documenti potrebbero contenere la risposta
- Cita sempre i documenti fonte (es. "Secondo il contratto 2025...", "Dalla proposta Q1 2026...")
- Rispondi in italiano, in modo professionale ma conversazionale
- Per suggerimenti strategici, basati sulla storia documentata del cliente e sui servizi Moca
- Quando confronti periodi diversi, specifica chiaramente le date
- Per importi/budget, cita i numeri esatti dai documenti
- Distingui sempre tra servizi ATTUALI e PASSATI in base all'anno
- NON inventare mai informazioni non presenti nei documenti`;

/**
 * Load custom system prompt from database (editable via UI).
 * Falls back to DEFAULT_RAG_PROMPT if not set.
 */
async function loadSystemPrompt(): Promise<string> {
    try {
        const { data } = await supabaseAdmin
            .from('system_prompts')
            .select('prompt_value')
            .eq('prompt_key', 'rag_chat_system')
            .single();

        if (data?.prompt_value) return data.prompt_value;
    } catch {
        // Table might not have the row yet — use default
    }
    return DEFAULT_RAG_PROMPT;
}

/**
 * Load auto-learned context for a specific client.
 * This is updated automatically each time documents are processed.
 * Stored in client_knowledge with field_key = 'rag_learned_context'.
 */
async function loadLearnedContext(clientId: string): Promise<string> {
    try {
        const { data } = await supabaseAdmin
            .from('client_knowledge')
            .select('field_value')
            .eq('client_id', clientId)
            .eq('field_key', 'rag_learned_context')
            .single();

        return data?.field_value || '';
    } catch {
        return '';
    }
}

async function buildSystemPrompt(
    clientName: string,
    clientId: string,
    summaries: Array<{ summary: string; doc_type: string; file_name: string; date_range: string | null }>,
    entityContext: string
): Promise<string> {
    const summaryBlock = summaries.length > 0
        ? summaries.map(s =>
            `- [${s.doc_type.toUpperCase()}] "${s.file_name}"${s.date_range ? ` (${s.date_range})` : ''}: ${s.summary}`
        ).join('\n')
        : 'Nessun documento ancora indicizzato.';

    const today = new Date();
    const currentDate = today.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentYear = today.getFullYear();

    // Load custom or default system prompt
    const basePrompt = await loadSystemPrompt();

    // Load auto-learned context for this client
    const learnedContext = await loadLearnedContext(clientId);

    return `${basePrompt}

CLIENTE: ${clientName}

DATA ODIERNA: ${currentDate}
ANNO CORRENTE: ${currentYear}

CONTESTO TEMPORALE:
- I documenti/contratti del ${currentYear} sono ATTUALI (in corso)
- I documenti del ${currentYear - 1} sono dello SCORSO ANNO
- I documenti di anni precedenti (${currentYear - 2} e prima) sono STORICI
- Quando l'utente chiede "attualmente", "adesso", "in corso" → riferisciti all'anno ${currentYear}
- Quando l'utente chiede "l'anno scorso" → riferisciti al ${currentYear - 1}
- I percorsi dei file spesso contengono l'anno nella cartella (es. "${currentYear - 1}/Contratti/")

PANORAMICA DOCUMENTI DEL CLIENTE:
${summaryBlock}

${entityContext ? `ENTITA CHIAVE ESTRATTE:\n${entityContext}\n` : ''}${learnedContext ? `CONTESTO APPRESO DAI DOCUMENTI:\n${learnedContext}\n` : ''}`;
}

function buildUserPromptWithContext(
    userMessage: string,
    chunks: Array<{ chunk_text: string; file_name: string; file_path: string; chunk_level: number; combined_score: number }>
): string {
    if (chunks.length === 0) {
        return userMessage;
    }

    const contextBlock = chunks.map((c, i) => {
        const source = `[${c.file_name}${c.file_path ? ` / ${c.file_path}` : ''}]`;
        const level = c.chunk_level === 1 ? ' (sezione)' : '';
        return `--- Fonte ${i + 1}${level}: ${source} ---\n${c.chunk_text}`;
    }).join('\n\n');

    return `CONTESTO DAI DOCUMENTI:\n\n${contextBlock}\n\n---\n\nDOMANDA DELL'UTENTE:\n${userMessage}`;
}

// --- Step 8: Call LLM ---
async function callLLM(
    systemPrompt: string,
    history: Array<{ role: string; content: string }>,
    userPromptWithContext: string
): Promise<{ content: string; tokensUsed: number }> {
    const apiKey = getOpenAIKey();

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userPromptWithContext },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: 0.3,
            max_tokens: 2000,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`LLM error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
        content: data.choices[0]?.message?.content || 'Nessuna risposta generata.',
        tokensUsed: data.usage?.total_tokens || 0,
    };
}

// ============================================
// Main Handler
// ============================================

export default async (req: Request, context: Context) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        // --- Auth ---
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return errorResponse('Missing authorization', 401);

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return errorResponse('Invalid token', 401);

        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role, status, name')
            .eq('id', user.id)
            .single();

        if (!userData || userData.status !== 'active') return errorResponse('User not active', 403);

        // --- Parse request ---
        const body = await req.json();
        const { client_id, message, session_id } = body;

        if (!client_id) return errorResponse('client_id is required');
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return errorResponse('message is required');
        }

        const sessionId = session_id || crypto.randomUUID();

        // Get client info
        const { data: client } = await supabaseAdmin
            .from('clients')
            .select('id, name')
            .eq('id', client_id)
            .single();

        if (!client) return errorResponse('Client not found', 404);

        // --- RAG Pipeline ---

        // 1. Embed the query
        console.log(`[chat-rag] Embedding query for "${client.name}": "${message.substring(0, 80)}..."`);
        const queryEmbedding = await embedQuery(message);

        // 2. Hybrid search (vector + keyword)
        console.log(`[chat-rag] Hybrid search...`);
        const chunks = await hybridSearch(queryEmbedding, message, client_id);
        console.log(`[chat-rag] Found ${chunks.length} relevant chunks`);

        // 3. Get document summaries for broad context
        const summaries = await getRelevantSummaries(queryEmbedding, client_id);

        // 4. Get entity context (graph)
        const entityContext = await getClientEntities(client_id);

        // 5. Load conversation history
        const history = await getConversationHistory(sessionId, client_id);

        // 6. Build prompts
        const systemPrompt = await buildSystemPrompt(client.name, client_id, summaries, entityContext);
        const userPromptWithContext = buildUserPromptWithContext(message, chunks);

        // 7. Call LLM
        console.log(`[chat-rag] Calling ${MODEL}...`);
        const llmResponse = await callLLM(systemPrompt, history, userPromptWithContext);
        console.log(`[chat-rag] Response received (${llmResponse.tokensUsed} tokens)`);

        // 8. Build sources array
        const sources = chunks.slice(0, 5).map(c => ({
            file_name: c.file_name,
            file_id: c.file_id,
            chunk_id: c.id,
            relevance_score: Math.round(c.combined_score * 100) / 100,
        }));

        // 9. Save user message + assistant response to history
        const now = new Date().toISOString();

        await supabaseAdmin.from('client_chat_history').insert([
            {
                client_id,
                user_id: user.id,
                session_id: sessionId,
                role: 'user',
                content: message,
                sources: [],
                model: null,
                tokens_used: null,
                created_at: now,
            },
            {
                client_id,
                user_id: user.id,
                session_id: sessionId,
                role: 'assistant',
                content: llmResponse.content,
                sources,
                model: MODEL,
                tokens_used: llmResponse.tokensUsed,
                created_at: new Date(Date.now() + 1).toISOString(), // +1ms to ensure ordering
            },
        ]);

        // 10. Return response
        return jsonResponse({
            success: true,
            session_id: sessionId,
            message: llmResponse.content,
            sources,
            model: MODEL,
            tokens_used: llmResponse.tokensUsed,
            chunks_found: chunks.length,
        });

    } catch (error: any) {
        console.error('[chat-rag] Error:', error);
        await log('error', `[chat-rag] Error: ${error.message}`, { stack: error.stack });
        return errorResponse(`Errore: ${error.message}`, 500);
    }
};
