import type { Context } from "@netlify/functions";
import { corsHeaders, jsonResponse, errorResponse, log } from './utils/helpers';
import { supabaseAdmin } from './utils/supabase-admin';
import { extractText } from './utils/text-extractor';
import { chunkText, estimateTokens } from './utils/chunker';
import { downloadFile } from './utils/google-drive';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const BATCH_SIZE = 1; // process 1 file per call to stay within Netlify 10s/26s timeout

// ============================================
// OpenAI API Helpers
// ============================================

function getOpenAIKey(): string {
    const key = process.env.MOCA_OPENAI_API_KEY;
    if (!key) throw new Error('MOCA_OPENAI_API_KEY not set');
    return key;
}

// Hard ceiling for embedding input — text-embedding-3-small accepts up to
// 8192 tokens. We pre-clip at ~7500 tokens (≈30k chars) to leave headroom for
// tokenizer variance. The chunker normally keeps chunks well below this, but
// this is a defensive last line before the API call.
const EMBED_MAX_CHARS = 30000;
const EMBED_BATCH_SIZE = 50;

/**
 * Generate embeddings with batching + per-chunk fallback.
 *
 * If a batch fails (4xx), we don't crash the whole document — we retry each
 * input individually so a single pathological chunk can be skipped (replaced
 * with a zero vector) without losing the rest of the document. Network/5xx
 * errors still throw so the caller can mark the file failed.
 */
async function generateEmbeddings(
    texts: string[]
): Promise<{ embeddings: number[][]; skipped: number }> {
    const apiKey = getOpenAIKey();
    const embeddings: number[][] = new Array(texts.length);
    let skipped = 0;

    // Pre-clip oversized inputs (defense in depth — chunker should already keep
    // them under cap, but covers the L0 summary path and any future caller).
    const safeTexts = texts.map(t => t.length > EMBED_MAX_CHARS
        ? t.slice(0, EMBED_MAX_CHARS)
        : t);

    for (let i = 0; i < safeTexts.length; i += EMBED_BATCH_SIZE) {
        const batchStart = i;
        const batch = safeTexts.slice(batchStart, batchStart + EMBED_BATCH_SIZE);

        try {
            const batchEmbeddings = await callEmbeddingsAPI(apiKey, batch);
            for (let j = 0; j < batchEmbeddings.length; j++) {
                embeddings[batchStart + j] = batchEmbeddings[j];
            }
        } catch (batchErr: any) {
            // Batch-level 4xx: retry one input at a time so we isolate the
            // bad chunk and recover the rest. We re-throw on network/5xx
            // by checking the structured status on the error.
            if (batchErr.status && batchErr.status >= 500) throw batchErr;

            console.warn(`[embeddings] Batch ${batchStart}/${safeTexts.length} failed (${batchErr.message}) — retrying singly`);
            for (let j = 0; j < batch.length; j++) {
                try {
                    const single = await callEmbeddingsAPI(apiKey, [batch[j]]);
                    embeddings[batchStart + j] = single[0];
                } catch (singleErr: any) {
                    console.warn(`[embeddings] Skip input ${batchStart + j} (${batch[j].length} chars): ${singleErr.message}`);
                    embeddings[batchStart + j] = new Array(1536).fill(0);
                    skipped++;
                }
            }
        }
    }

    return { embeddings, skipped };
}

async function callEmbeddingsAPI(apiKey: string, batch: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: batch }),
    });

    if (!response.ok) {
        const err = await response.text();
        const e: any = new Error(`OpenAI Embeddings error (${response.status}): ${err}`);
        e.status = response.status;
        throw e;
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
}

/**
 * Generate document summary + detect type + extract entities using GPT-4o-mini.
 * This is the "intelligence" layer — runs once per document.
 */
async function analyzeDocument(
    text: string,
    fileName: string,
    filePath: string
): Promise<{
    summary: string;
    docType: string;
    keyTopics: string[];
    dateRange: string | null;
    entities: Array<{ type: string; value: string; normalized: string }>;
}> {
    const apiKey = getOpenAIKey();

    // Use first ~8000 chars for analysis (cost control)
    const analysisText = text.length > 8000 ? text.substring(0, 8000) + '\n\n[...documento troncato per analisi...]' : text;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.1,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Sei un analista documentale di un'agenzia di marketing digitale (Moca Interactive).
Analizza il documento fornito e restituisci un JSON con questa struttura ESATTA:

{
  "summary": "Riassunto del documento in 3-5 frasi. Includi: tipo di documento, soggetto, contenuto chiave, date rilevanti.",
  "doc_type": "contratto|proposta|report|fattura|preventivo|brief|presentazione|email|verbale|strategia|analisi|altro",
  "key_topics": ["topic1", "topic2", "topic3"],
  "date_range": "2024" oppure "Q1 2025" oppure "2023-2025" oppure null se non determinabile,
  "entities": [
    {"type": "servizio", "value": "SEO", "normalized": "seo"},
    {"type": "importo", "value": "€12.000/mese", "normalized": "12000"},
    {"type": "persona", "value": "Mario Rossi", "normalized": "mario rossi"},
    {"type": "azienda", "value": "Randstad Italia", "normalized": "randstad italia"},
    {"type": "prodotto", "value": "Google Ads", "normalized": "google ads"},
    {"type": "kpi", "value": "CTR 3.5%", "normalized": "ctr 3.5"},
    {"type": "data", "value": "1 gennaio 2025", "normalized": "2025-01-01"}
  ]
}

REGOLE per le entities:
- Estrai TUTTE le entità rilevanti (servizi marketing, importi, persone, aziende, KPI, date chiave)
- "normalized" deve essere lowercase, senza simboli valutari, formato ISO per date
- Servizi tipici: SEO, SEM, Google Ads, Meta Ads, Social Media Management, Content Marketing, Email Marketing, Web Development, Analytics, CRO, Branding, PR, Influencer Marketing
- Non inventare entità che non sono nel testo
- Massimo 30 entità per documento`
                },
                {
                    role: 'user',
                    content: `FILE: ${fileName}\nPERCORSO: ${filePath}\n\n---\n\n${analysisText}`
                }
            ]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI analysis error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    try {
        const parsed = JSON.parse(content);
        return {
            summary: parsed.summary || `Documento: ${fileName}`,
            docType: parsed.doc_type || 'altro',
            keyTopics: Array.isArray(parsed.key_topics) ? parsed.key_topics : [],
            dateRange: parsed.date_range || null,
            entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        };
    } catch {
        return {
            summary: `Documento: ${fileName}`,
            docType: 'altro',
            keyTopics: [],
            dateRange: null,
            entities: [],
        };
    }
}

// ============================================
// File Processing Pipeline
// ============================================

async function processFile(
    file: any,
    clientId: string
): Promise<{ success: boolean; chunks: number; error?: string }> {
    const fileId = file.id;

    try {
        await supabaseAdmin
            .from('client_drive_files')
            .update({ processing_status: 'processing' })
            .eq('id', fileId);

        // Skip non-document files (images, videos, audio, etc.)
        const mime = file.mime_type || '';
        if (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')) {
            await supabaseAdmin.from('client_drive_files').update({
                processing_status: 'skipped',
                processing_error: `Tipo file non processabile: ${mime}`,
            }).eq('id', fileId);
            return { success: false, chunks: 0, error: 'File multimediale (skip)' };
        }

        // Size check
        if (file.file_size && file.file_size > MAX_FILE_SIZE) {
            await supabaseAdmin.from('client_drive_files').update({
                processing_status: 'skipped',
                processing_error: `File troppo grande (${Math.round(file.file_size / 1024 / 1024)}MB)`,
            }).eq('id', fileId);
            return { success: false, chunks: 0, error: 'File troppo grande' };
        }

        // 1. DOWNLOAD (using lightweight REST client)
        console.log(`[process] Downloading: ${file.file_name}`);
        const { buffer, effectiveMimeType } = await downloadFile(file.drive_file_id, file.mime_type);

        // 2. EXTRACT TEXT
        console.log(`[process] Extracting: ${file.file_name}`);
        const extraction = await extractText(buffer, effectiveMimeType, file.file_name);

        if (!extraction.text || extraction.text.trim().length < 50) {
            await supabaseAdmin.from('client_drive_files').update({
                processing_status: 'skipped',
                processing_error: extraction.error || 'Nessun testo estraibile',
            }).eq('id', fileId);
            return { success: false, chunks: 0, error: extraction.error || 'Nessun testo' };
        }

        // 3. AI ANALYSIS — summary + doc type + entities
        console.log(`[process] Analyzing with AI: ${file.file_name}`);
        const analysis = await analyzeDocument(extraction.text, file.file_name, file.file_path || '');

        // 4. HIERARCHICAL CHUNKING
        console.log(`[process] Chunking: ${file.file_name} (${extraction.text.length} chars)`);
        const chunks = chunkText(extraction.text, { fileName: file.file_name });

        if (chunks.length === 0) {
            await supabaseAdmin.from('client_drive_files').update({
                processing_status: 'skipped',
                processing_error: 'Testo troppo corto per chunking',
            }).eq('id', fileId);
            return { success: false, chunks: 0, error: 'Testo troppo corto' };
        }

        // 5. GENERATE EMBEDDINGS for all chunks + summary
        console.log(`[process] Embedding ${chunks.length} chunks + summary: ${file.file_name}`);
        const allTexts = [analysis.summary, ...chunks.map(c => c.text)];
        const { embeddings: allEmbeddings, skipped: skippedEmbeddings } = await generateEmbeddings(allTexts);

        if (skippedEmbeddings > 0) {
            console.warn(`[process] ${skippedEmbeddings}/${allTexts.length} chunks skipped (zero-vector) for "${file.file_name}"`);
        }

        const summaryEmbedding = allEmbeddings[0];
        const chunkEmbeddings = allEmbeddings.slice(1);

        // 6. DELETE OLD DATA (re-processing safe)
        await supabaseAdmin.from('client_document_chunks').delete().eq('file_id', fileId);
        await supabaseAdmin.from('client_document_summaries').delete().eq('file_id', fileId);
        // Delete old entity mentions for this file
        await supabaseAdmin.from('client_entity_mentions').delete().eq('file_id', fileId);

        // 7. STORE DOCUMENT SUMMARY
        await supabaseAdmin.from('client_document_summaries').insert({
            client_id: clientId,
            file_id: fileId,
            summary: analysis.summary,
            doc_type: analysis.docType,
            key_topics: analysis.keyTopics,
            date_range: analysis.dateRange,
            embedding: JSON.stringify(summaryEmbedding),
        });

        // 8. STORE CHUNKS with hierarchy
        const yearMatch = (file.file_path || '').match(/\b(20\d{2})\b/);
        const baseMetadata = {
            file_name: file.file_name,
            file_path: file.file_path || '',
            year: analysis.dateRange || (yearMatch ? yearMatch[1] : null),
            doc_type: analysis.docType,
            key_topics: analysis.keyTopics,
        };

        // First pass: insert L1 chunks and collect their IDs
        const l1ChunkIds: Record<number, string> = {}; // index -> uuid

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (chunk.level !== 1) continue;

            const { data: inserted } = await supabaseAdmin
                .from('client_document_chunks')
                .insert({
                    client_id: clientId,
                    file_id: fileId,
                    chunk_index: chunk.index,
                    chunk_text: chunk.text,
                    chunk_level: 1,
                    parent_chunk_id: null,
                    embedding: JSON.stringify(chunkEmbeddings[i]),
                    metadata: { ...baseMetadata, section_title: chunk.sectionTitle || null },
                    token_count: chunk.tokenEstimate,
                })
                .select('id')
                .single();

            if (inserted) {
                l1ChunkIds[chunk.index] = inserted.id;
            }
        }

        // Second pass: insert L2 chunks with parent reference
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (chunk.level !== 2) continue;

            const parentId = chunk.parentIndex !== null ? l1ChunkIds[chunk.parentIndex] : null;

            await supabaseAdmin.from('client_document_chunks').insert({
                client_id: clientId,
                file_id: fileId,
                chunk_index: chunk.index,
                chunk_text: chunk.text,
                chunk_level: 2,
                parent_chunk_id: parentId || null,
                embedding: JSON.stringify(chunkEmbeddings[i]),
                metadata: baseMetadata,
                token_count: chunk.tokenEstimate,
            });
        }

        // 9. STORE ENTITIES (Graph RAG)
        if (analysis.entities.length > 0) {
            for (const entity of analysis.entities) {
                if (!entity.type || !entity.value || !entity.normalized) continue;

                // Upsert entity (increment count if exists)
                const { data: existingEntity } = await supabaseAdmin
                    .from('client_entities')
                    .select('id, occurrence_count')
                    .eq('client_id', clientId)
                    .eq('entity_type', entity.type)
                    .eq('entity_normalized', entity.normalized)
                    .single();

                let entityId: string;

                if (existingEntity) {
                    entityId = existingEntity.id;
                    await supabaseAdmin.from('client_entities').update({
                        occurrence_count: (existingEntity.occurrence_count || 1) + 1,
                        last_seen_at: new Date().toISOString(),
                    }).eq('id', entityId);
                } else {
                    const { data: newEntity } = await supabaseAdmin
                        .from('client_entities')
                        .insert({
                            client_id: clientId,
                            entity_type: entity.type,
                            entity_value: entity.value,
                            entity_normalized: entity.normalized,
                        })
                        .select('id')
                        .single();

                    if (!newEntity) continue;
                    entityId = newEntity.id;
                }

                // Create mention link (entity → file)
                await supabaseAdmin.from('client_entity_mentions').insert({
                    entity_id: entityId,
                    file_id: fileId,
                    context_snippet: analysis.summary.substring(0, 300),
                });
            }
        }

        // 10. MARK COMPLETE
        const totalChunks = chunks.length;
        await supabaseAdmin.from('client_drive_files').update({
            processed: true,
            processing_status: 'completed',
            processing_error: null,
            chunk_count: totalChunks,
            processed_at: new Date().toISOString(),
        }).eq('id', fileId);

        console.log(`[process] Done: ${file.file_name} → ${totalChunks} chunks, ${analysis.entities.length} entities, type: ${analysis.docType}`);
        return { success: true, chunks: totalChunks };

    } catch (error: any) {
        console.error(`[process] Error "${file.file_name}":`, error.message);
        await supabaseAdmin.from('client_drive_files').update({
            processing_status: 'failed',
            processing_error: error.message?.substring(0, 500),
        }).eq('id', fileId);
        return { success: false, chunks: 0, error: error.message };
    }
}

// ============================================
// Auto-Learning: Generate client context from all processed documents
// This runs once after all documents are processed and creates a
// "learned context" that the chat AI uses to better understand the client.
// Stored in client_knowledge as 'rag_learned_context'.
// ============================================

async function updateLearnedContext(clientId: string): Promise<void> {
    // Gather all document summaries for this client
    const { data: summaries } = await supabaseAdmin
        .from('client_document_summaries')
        .select('summary, doc_type, date_range, key_topics, file:client_drive_files!file_id(file_name, file_path)')
        .eq('client_id', clientId);

    // Gather all entities
    const { data: entities } = await supabaseAdmin
        .from('client_entities')
        .select('entity_type, entity_value, occurrence_count')
        .eq('client_id', clientId)
        .order('occurrence_count', { ascending: false })
        .limit(50);

    if (!summaries || summaries.length === 0) return;

    const summaryText = summaries.map((s: any) =>
        `[${s.doc_type}] ${s.file?.file_name || 'file'}${s.date_range ? ` (${s.date_range})` : ''}: ${s.summary}`
    ).join('\n');

    const entityText = (entities || []).map((e: any) =>
        `${e.entity_type}: ${e.entity_value} (${e.occurrence_count}x)`
    ).join(', ');

    const apiKey = getOpenAIKey();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.1,
            max_tokens: 1500,
            messages: [
                {
                    role: 'system',
                    content: `Sei un analista che crea profili sintetici di clienti per un'agenzia di marketing digitale.
Basandoti sui riassunti dei documenti e sulle entita estratte, crea un PROFILO CLIENTE conciso che include:

1. STORIA DEL RAPPORTO: da quando e cliente, come si e evoluto il rapporto nel tempo
2. SERVIZI: quali servizi sono/erano attivi, come sono cambiati negli anni
3. BUDGET/IMPORTI: range di budget se disponibile, evoluzione nel tempo
4. PERSONE CHIAVE: referenti lato cliente e lato agenzia
5. PATTERN IMPORTANTI: rinnovi, ampliamenti, riduzioni, aree di interesse ricorrenti
6. NOTE STRATEGICHE: cosa sembra funzionare bene, aree di opportunita

Scrivi in italiano. Sii conciso ma preciso. Usa solo informazioni presenti nei dati forniti.`
                },
                {
                    role: 'user',
                    content: `DOCUMENTI (${summaries.length}):\n${summaryText}\n\nENTITA ESTRATTE:\n${entityText}`
                }
            ]
        })
    });

    if (!response.ok) return;

    const data = await response.json();
    const learnedContext = data.choices[0]?.message?.content;

    if (!learnedContext) return;

    // Upsert into client_knowledge
    await supabaseAdmin
        .from('client_knowledge')
        .upsert({
            client_id: clientId,
            field_key: 'rag_learned_context',
            field_value: learnedContext,
            field_type: 'generated',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,field_key' });

    console.log(`[process-documents] Auto-learned context updated for client ${clientId}`);
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
        // Auth
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return errorResponse('Missing authorization', 401);

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return errorResponse('Invalid token', 401);

        const { data: userData } = await supabaseAdmin.from('users').select('role, status').eq('id', user.id).single();
        if (!userData || userData.status !== 'active') return errorResponse('User not active', 403);
        if (!['super_admin', 'manager'].includes(userData.role)) return errorResponse('Insufficient permissions', 403);

        // Parse
        const body = await req.json();
        const { client_id, file_ids } = body;
        if (!client_id) return errorResponse('client_id is required');

        // When called explicitly with file_ids (manual retry), include failed
        // files. Without file_ids we only pick up `pending` so a chronically
        // bad file can't keep the auto-loop alive forever.
        const explicit = Array.isArray(file_ids) && file_ids.length > 0;
        const statusesToPick = explicit ? ['pending', 'failed'] : ['pending'];

        let query = supabaseAdmin
            .from('client_drive_files')
            .select('*')
            .eq('client_id', client_id)
            .in('processing_status', statusesToPick);

        if (explicit) query = query.in('id', file_ids);

        const { data: pendingFiles } = await query
            .order('synced_at', { ascending: true })
            .limit(BATCH_SIZE);

        if (!pendingFiles?.length) {
            return jsonResponse({ success: true, message: 'Nessun file da processare', processed: 0, remaining: 0 });
        }

        const { count: totalRemaining } = await supabaseAdmin
            .from('client_drive_files')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', client_id)
            .in('processing_status', statusesToPick);

        await log('info', `[process-documents] Processing ${pendingFiles.length} files (${totalRemaining} total pending)`, null, user.id);

        const results: Array<{ fileName: string; success: boolean; chunks: number; error?: string }> = [];

        for (const file of pendingFiles) {
            const result = await processFile(file, client_id);
            results.push({ fileName: file.file_name, ...result });
        }

        const successCount = results.filter(r => r.success).length;
        const remaining = Math.max(0, (totalRemaining || 0) - pendingFiles.length);

        // When all files are processed, auto-generate learned context for this client
        if (remaining === 0 && successCount > 0) {
            try {
                await updateLearnedContext(client_id);
            } catch (e: any) {
                console.warn('[process-documents] Auto-learn context failed (non-blocking):', e.message);
            }
        }

        await log('info', `[process-documents] Done: ${successCount}/${pendingFiles.length} ok, ${remaining} remaining`, { results }, user.id);

        return jsonResponse({
            success: true,
            message: `Processati ${successCount}/${pendingFiles.length} file`,
            processed: successCount,
            failed: results.filter(r => !r.success).length,
            total_chunks: results.reduce((sum, r) => sum + r.chunks, 0),
            remaining,
            results,
        });

    } catch (error: any) {
        console.error('[process-documents] Error:', error);
        await log('error', `[process-documents] Error: ${error.message}`, { stack: error.stack });
        return errorResponse(`Errore: ${error.message}`, 500);
    }
};
