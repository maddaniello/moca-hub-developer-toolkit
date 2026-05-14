-- ============================================
-- Migration: Enhanced RAG System
-- Date: 2026-05-05
-- Description: Adds hybrid search (full-text + vector),
--              hierarchical chunk levels, document summaries,
--              and entity extraction for Graph RAG capabilities.
-- ============================================

-- ============================================
-- 1. Enhance client_document_chunks with hierarchy + full-text search
-- ============================================

-- Add chunk level for hierarchical retrieval
-- L0 = document summary, L1 = section, L2 = detail paragraph
ALTER TABLE client_document_chunks
    ADD COLUMN IF NOT EXISTS chunk_level integer DEFAULT 2
        CHECK (chunk_level IN (0, 1, 2));

-- Add parent reference for hierarchy (L2 points to L1, L1 points to L0)
ALTER TABLE client_document_chunks
    ADD COLUMN IF NOT EXISTS parent_chunk_id uuid REFERENCES client_document_chunks(id) ON DELETE SET NULL;

-- Add full-text search vector column (Italian + English)
ALTER TABLE client_document_chunks
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Auto-generate tsvector on insert/update
CREATE OR REPLACE FUNCTION update_chunk_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('italian', coalesce(NEW.chunk_text, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.chunk_text, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_update_chunk_search_vector ON client_document_chunks;
CREATE TRIGGER trig_update_chunk_search_vector
    BEFORE INSERT OR UPDATE OF chunk_text ON client_document_chunks
    FOR EACH ROW EXECUTE FUNCTION update_chunk_search_vector();

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_doc_chunks_search_vector
    ON client_document_chunks USING gin(search_vector);

-- Index for chunk level queries
CREATE INDEX IF NOT EXISTS idx_doc_chunks_level
    ON client_document_chunks(client_id, chunk_level);

-- ============================================
-- 2. Document summaries table
-- Stores AI-generated summary for each processed file
-- ============================================
CREATE TABLE IF NOT EXISTS client_document_summaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    file_id uuid NOT NULL REFERENCES client_drive_files(id) ON DELETE CASCADE,
    summary text NOT NULL,                      -- AI-generated document summary
    doc_type text,                              -- detected type: 'contratto', 'proposta', 'report', 'fattura', 'email', 'altro'
    key_topics text[] DEFAULT '{}',             -- main topics extracted
    date_range text,                            -- temporal scope: '2024', 'Q1 2025', '2023-2025'
    embedding vector(1536),                     -- summary embedding for document-level search
    created_at timestamptz DEFAULT now(),
    UNIQUE(file_id)                             -- one summary per file
);

CREATE INDEX IF NOT EXISTS idx_doc_summaries_client ON client_document_summaries(client_id);
CREATE INDEX IF NOT EXISTS idx_doc_summaries_type ON client_document_summaries(client_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_doc_summaries_embedding ON client_document_summaries
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- RLS for document summaries
ALTER TABLE client_document_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_doc_summaries"
    ON client_document_summaries FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid()
        AND users.role = 'super_admin' AND users.status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid()
        AND users.role = 'super_admin' AND users.status = 'active'
    ));

CREATE POLICY "manager_access_doc_summaries"
    ON client_document_summaries FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id
        WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active'
        AND user_clients.client_id = client_document_summaries.client_id
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id
        WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active'
        AND user_clients.client_id = client_document_summaries.client_id
    ));

CREATE POLICY "specialist_read_doc_summaries"
    ON client_document_summaries FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_clients
        WHERE user_clients.user_id = auth.uid()
        AND user_clients.client_id = client_document_summaries.client_id
    ));

CREATE POLICY "anon_read_doc_summaries"
    ON client_document_summaries FOR SELECT TO anon
    USING (true);

-- ============================================
-- 3. Entity extraction table (Graph RAG nodes)
-- Stores entities found across documents for cross-referencing
-- ============================================
CREATE TABLE IF NOT EXISTS client_entities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    entity_type text NOT NULL
        CHECK (entity_type IN ('servizio', 'persona', 'importo', 'data', 'azienda', 'prodotto', 'kpi', 'altro')),
    entity_value text NOT NULL,                 -- e.g. "SEO", "€12.000/mese", "Mario Rossi"
    entity_normalized text,                     -- lowercase normalized for dedup: "seo", "12000", "mario rossi"
    first_seen_at timestamptz DEFAULT now(),
    last_seen_at timestamptz DEFAULT now(),
    occurrence_count integer DEFAULT 1,
    UNIQUE(client_id, entity_type, entity_normalized)
);

-- Entity-to-document relationships (Graph RAG edges)
CREATE TABLE IF NOT EXISTS client_entity_mentions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid NOT NULL REFERENCES client_entities(id) ON DELETE CASCADE,
    file_id uuid NOT NULL REFERENCES client_drive_files(id) ON DELETE CASCADE,
    chunk_id uuid REFERENCES client_document_chunks(id) ON DELETE SET NULL,
    context_snippet text,                       -- surrounding text where entity was found
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entities_client ON client_entities(client_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON client_entities(client_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_normalized ON client_entities(client_id, entity_normalized);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON client_entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_file ON client_entity_mentions(file_id);

-- RLS for entities
ALTER TABLE client_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_entity_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_entities"
    ON client_entities FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));

CREATE POLICY "manager_access_entities"
    ON client_entities FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id
        WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active'
        AND user_clients.client_id = client_entities.client_id
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id
        WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active'
        AND user_clients.client_id = client_entities.client_id
    ));

CREATE POLICY "read_entities"
    ON client_entities FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM user_clients WHERE user_clients.user_id = auth.uid() AND user_clients.client_id = client_entities.client_id));

CREATE POLICY "anon_read_entities"
    ON client_entities FOR SELECT TO anon USING (true);

CREATE POLICY "super_admin_full_access_entity_mentions"
    ON client_entity_mentions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));

CREATE POLICY "manager_access_entity_mentions"
    ON client_entity_mentions FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM client_entities e JOIN user_clients uc ON uc.client_id = e.client_id
        JOIN users u ON u.id = uc.user_id
        WHERE e.id = client_entity_mentions.entity_id
        AND u.id = auth.uid() AND u.role = 'manager' AND u.status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM client_entities e JOIN user_clients uc ON uc.client_id = e.client_id
        JOIN users u ON u.id = uc.user_id
        WHERE e.id = client_entity_mentions.entity_id
        AND u.id = auth.uid() AND u.role = 'manager' AND u.status = 'active'
    ));

CREATE POLICY "read_entity_mentions"
    ON client_entity_mentions FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM client_entities e JOIN user_clients uc ON uc.client_id = e.client_id
        WHERE e.id = client_entity_mentions.entity_id AND uc.user_id = auth.uid()
    ));

CREATE POLICY "anon_read_entity_mentions"
    ON client_entity_mentions FOR SELECT TO anon USING (true);

-- ============================================
-- 4. Enhanced match_documents function — Hybrid Search
-- Combines vector similarity + full-text keyword matching
-- with document summary context
-- ============================================
DROP FUNCTION IF EXISTS match_documents(vector(1536), uuid, integer, float);

CREATE OR REPLACE FUNCTION match_documents_hybrid(
    query_embedding vector(1536),
    query_text text,
    match_client_id uuid,
    match_count integer DEFAULT 10,
    match_threshold float DEFAULT 0.65,
    keyword_weight float DEFAULT 0.3,
    vector_weight float DEFAULT 0.7
)
RETURNS TABLE (
    id uuid,
    file_id uuid,
    chunk_index integer,
    chunk_text text,
    chunk_level integer,
    metadata jsonb,
    file_name text,
    file_path text,
    similarity float,
    keyword_rank float,
    combined_score float
)
LANGUAGE plpgsql
AS $$
DECLARE
    ts_query tsquery;
BEGIN
    -- Build tsquery from search text (Italian)
    ts_query := plainto_tsquery('italian', query_text);

    RETURN QUERY
    SELECT
        c.id,
        c.file_id,
        c.chunk_index,
        c.chunk_text,
        c.chunk_level,
        c.metadata,
        f.file_name,
        f.file_path,
        (1 - (c.embedding <=> query_embedding))::float AS similarity,
        COALESCE(ts_rank_cd(c.search_vector, ts_query), 0)::float AS keyword_rank,
        (
            vector_weight * (1 - (c.embedding <=> query_embedding)) +
            keyword_weight * COALESCE(ts_rank_cd(c.search_vector, ts_query), 0) * 10
        )::float AS combined_score
    FROM client_document_chunks c
    JOIN client_drive_files f ON f.id = c.file_id
    WHERE c.client_id = match_client_id
      AND (
          -- Either vector similarity is above threshold
          (1 - (c.embedding <=> query_embedding)) > match_threshold
          -- OR full-text search matches
          OR c.search_vector @@ ts_query
      )
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- ============================================
-- 5. Function to find related documents via shared entities
-- (Graph traversal for connected documents)
-- ============================================
CREATE OR REPLACE FUNCTION find_related_documents(
    source_file_id uuid,
    match_client_id uuid,
    max_results integer DEFAULT 5
)
RETURNS TABLE (
    file_id uuid,
    file_name text,
    file_path text,
    shared_entities text[],
    relevance_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH source_entities AS (
        SELECT DISTINCT em.entity_id, e.entity_value, e.entity_type
        FROM client_entity_mentions em
        JOIN client_entities e ON e.id = em.entity_id
        WHERE em.file_id = source_file_id
    ),
    related AS (
        SELECT
            em.file_id,
            array_agg(DISTINCT e.entity_value) AS shared_entities,
            count(DISTINCT em.entity_id)::float / GREATEST(count(DISTINCT se.entity_id)::float, 1) AS relevance_score
        FROM client_entity_mentions em
        JOIN source_entities se ON se.entity_id = em.entity_id
        JOIN client_entities e ON e.id = em.entity_id
        WHERE em.file_id != source_file_id
        GROUP BY em.file_id
    )
    SELECT
        r.file_id,
        f.file_name,
        f.file_path,
        r.shared_entities,
        r.relevance_score
    FROM related r
    JOIN client_drive_files f ON f.id = r.file_id
    WHERE f.client_id = match_client_id
    ORDER BY r.relevance_score DESC
    LIMIT max_results;
END;
$$;
