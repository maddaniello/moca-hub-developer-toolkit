-- ============================================
-- Migration: RAG Client Intelligence System
-- Date: 2026-05-05
-- Description: Adds pgvector extension, tables for Google Drive file sync,
--              document chunks with embeddings, and chat history
--              to enable AI-powered client knowledge retrieval.
-- ============================================

-- 1. Enable pgvector extension for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Table: client_drive_files
-- Tracks files synced from Google Drive per client.
-- Each row = one file discovered in the client's Drive folder.
-- ============================================
CREATE TABLE IF NOT EXISTS client_drive_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    drive_file_id text NOT NULL,              -- Google Drive file ID
    file_name text NOT NULL,
    file_path text NOT NULL DEFAULT '',        -- path within the Drive folder (e.g., "2025/contratti/")
    mime_type text,
    file_size bigint,
    drive_modified_at timestamptz,             -- last modified on Drive
    processed boolean DEFAULT false,           -- has been chunked + embedded?
    processing_status text DEFAULT 'pending'   -- pending | processing | completed | failed | skipped
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    processing_error text,                     -- error message if failed
    chunk_count integer DEFAULT 0,             -- how many chunks generated
    synced_at timestamptz DEFAULT now(),        -- when synced from Drive
    processed_at timestamptz,                  -- when processing completed
    created_at timestamptz DEFAULT now(),
    UNIQUE(client_id, drive_file_id)            -- prevent duplicate files per client
);

-- ============================================
-- Table: client_document_chunks
-- Stores text chunks with vector embeddings for RAG retrieval.
-- Each document is split into ~500-800 token chunks.
-- ============================================
CREATE TABLE IF NOT EXISTS client_document_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    file_id uuid NOT NULL REFERENCES client_drive_files(id) ON DELETE CASCADE,
    chunk_index integer NOT NULL,               -- position within the document (0-based)
    chunk_text text NOT NULL,                   -- the actual text content
    embedding vector(1536),                     -- OpenAI text-embedding-3-small output dimension
    metadata jsonb DEFAULT '{}'::jsonb,         -- { year, doc_type, file_name, page, section }
    token_count integer,                        -- approximate token count of chunk
    created_at timestamptz DEFAULT now()
);

-- ============================================
-- Table: client_chat_history
-- Stores conversation messages for the AI chat per client.
-- ============================================
CREATE TABLE IF NOT EXISTS client_chat_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id uuid NOT NULL DEFAULT gen_random_uuid(), -- groups messages in a conversation
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content text NOT NULL,
    sources jsonb DEFAULT '[]'::jsonb,          -- [{ file_name, file_id, chunk_id, relevance_score }]
    model text,                                 -- which AI model was used (e.g., "gpt-4o-mini")
    tokens_used integer,                        -- total tokens consumed
    created_at timestamptz DEFAULT now()
);

-- ============================================
-- Indexes for performance
-- ============================================

-- Drive files: query by client, check for duplicates
CREATE INDEX IF NOT EXISTS idx_drive_files_client_id ON client_drive_files(client_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_client_status ON client_drive_files(client_id, processing_status);

-- Document chunks: semantic search needs client filter + vector index
CREATE INDEX IF NOT EXISTS idx_doc_chunks_client_id ON client_document_chunks(client_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_file_id ON client_document_chunks(file_id);

-- IVFFlat vector index for fast similarity search (rebuild after bulk inserts)
-- Using lists=100 as a starting point; increase if you have >100k chunks per client
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding ON client_document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Chat history: query by client + user, order by time
CREATE INDEX IF NOT EXISTS idx_chat_history_client_id ON client_chat_history(client_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_session ON client_chat_history(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_history_user ON client_chat_history(user_id, created_at DESC);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE client_drive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_chat_history ENABLE ROW LEVEL SECURITY;

-- Super admins: full access to everything
CREATE POLICY "super_admin_full_access_drive_files"
    ON client_drive_files FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid()
        AND users.role = 'super_admin' AND users.status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid()
        AND users.role = 'super_admin' AND users.status = 'active'
    ));

CREATE POLICY "super_admin_full_access_doc_chunks"
    ON client_document_chunks FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid()
        AND users.role = 'super_admin' AND users.status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid()
        AND users.role = 'super_admin' AND users.status = 'active'
    ));

CREATE POLICY "super_admin_full_access_chat_history"
    ON client_chat_history FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid()
        AND users.role = 'super_admin' AND users.status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid()
        AND users.role = 'super_admin' AND users.status = 'active'
    ));

-- Managers: full access to their assigned clients
CREATE POLICY "manager_access_drive_files"
    ON client_drive_files FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id
        WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active'
        AND user_clients.client_id = client_drive_files.client_id
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id
        WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active'
        AND user_clients.client_id = client_drive_files.client_id
    ));

CREATE POLICY "manager_access_doc_chunks"
    ON client_document_chunks FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id
        WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active'
        AND user_clients.client_id = client_document_chunks.client_id
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id
        WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active'
        AND user_clients.client_id = client_document_chunks.client_id
    ));

CREATE POLICY "manager_access_chat_history"
    ON client_chat_history FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id
        WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active'
        AND user_clients.client_id = client_chat_history.client_id
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id
        WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active'
        AND user_clients.client_id = client_chat_history.client_id
    ));

-- Specialists/External: read-only access to their assigned clients
CREATE POLICY "specialist_read_drive_files"
    ON client_drive_files FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_clients
        WHERE user_clients.user_id = auth.uid()
        AND user_clients.client_id = client_drive_files.client_id
    ));

CREATE POLICY "specialist_read_doc_chunks"
    ON client_document_chunks FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_clients
        WHERE user_clients.user_id = auth.uid()
        AND user_clients.client_id = client_document_chunks.client_id
    ));

-- Chat history: users can read and write their own messages
CREATE POLICY "user_own_chat_history"
    ON client_chat_history FOR ALL TO authenticated
    USING (
        client_chat_history.user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM user_clients
            WHERE user_clients.user_id = auth.uid()
            AND user_clients.client_id = client_chat_history.client_id
        )
    )
    WITH CHECK (
        client_chat_history.user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM user_clients
            WHERE user_clients.user_id = auth.uid()
            AND user_clients.client_id = client_chat_history.client_id
        )
    );

-- Anon access for satellite apps (read-only on chunks for RAG queries)
CREATE POLICY "anon_read_doc_chunks"
    ON client_document_chunks FOR SELECT TO anon
    USING (true);

-- ============================================
-- Function: match_documents
-- Core RAG retrieval function — finds most relevant chunks
-- by cosine similarity to a query embedding.
-- Called from the chat endpoint.
-- ============================================
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_client_id uuid,
    match_count integer DEFAULT 8,
    match_threshold float DEFAULT 0.7
)
RETURNS TABLE (
    id uuid,
    file_id uuid,
    chunk_index integer,
    chunk_text text,
    metadata jsonb,
    file_name text,
    file_path text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.file_id,
        c.chunk_index,
        c.chunk_text,
        c.metadata,
        f.file_name,
        f.file_path,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM client_document_chunks c
    JOIN client_drive_files f ON f.id = c.file_id
    WHERE c.client_id = match_client_id
      AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================
-- Trigger: auto-update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_drive_file_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.synced_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
