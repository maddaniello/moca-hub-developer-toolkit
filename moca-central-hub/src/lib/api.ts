import { supabase } from './supabase';
import { User, Configuration } from './types';

const API_BASE = '/api';

// Helper to get auth token
async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

// Helper for API calls
async function apiCall<T>(
    endpoint: string,
    options: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        body?: any;
    } = {}
): Promise<{ data: T | null; error: string | null }> {
    const token = await getAuthToken();

    if (!token) {
        return { data: null, error: 'Non autenticato' };
    }

    try {
        const response = await fetch(`${API_BASE}/${endpoint}`, {
            method: options.method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
        });

        const result = await response.json();

        if (!response.ok) {
            return { data: null, error: result.error || 'Errore sconosciuto' };
        }

        return { data: result as T, error: null };
    } catch (error: any) {
        console.error(`API call to ${endpoint} failed:`, error);
        return { data: null, error: error.message || 'Errore di connessione' };
    }
}

// ============================================
// User Management API
// ============================================

export interface CreateUserRequest {
    email: string;
    name: string;
    client_ids: string[]; // Array of client IDs (multi-client support)
    role: 'super_admin' | 'manager' | 'specialist' | 'external';
    level: number;
    job_title?: string; // Ruolo aziendale (es. SEO, ADV, Team Leader)
    status?: 'active' | 'inactive' | 'suspended';
    send_invite?: boolean;
}

export interface CreateUserResponse {
    success: boolean;
    message: string;
    user: User;
    invite_sent: boolean;
    temp_password?: string;
}

export async function createUser(userData: CreateUserRequest): Promise<{ data: CreateUserResponse | null; error: string | null }> {
    return apiCall<CreateUserResponse>('create-user', {
        method: 'POST',
        body: userData,
    });
}

// Delete user (removes from Auth and database)
export interface DeleteUserResponse {
    success: boolean;
    message: string;
}

export async function deleteUser(userId: string): Promise<{ data: DeleteUserResponse | null; error: string | null }> {
    return apiCall<DeleteUserResponse>('delete-user', {
        method: 'POST',
        body: { user_id: userId },
    });
}


// ============================================
// Configuration API
// ============================================

export interface GetConfigRequest {
    client_id?: string;
    config_key?: string;
    config_type?: 'api_key' | 'variable' | 'setting';
}

export interface GetConfigResponse {
    success: boolean;
    client_id?: string;
    config_key?: string;
    config_value?: string;
    config_type?: string;
    configurations?: Configuration[];
}

export async function getClientConfig(params: GetConfigRequest): Promise<{ data: GetConfigResponse | null; error: string | null }> {
    return apiCall<GetConfigResponse>('get-client-config', {
        method: 'POST',
        body: params,
    });
}

// ============================================
// App Launch Token API
// ============================================

export interface GenerateLaunchTokenRequest {
    client_id: string;
    application_id: string;
}

export interface GenerateLaunchTokenResponse {
    success: boolean;
    token: string;
    redirect_url: string;
    expires_at: string;
}

export async function generateLaunchToken(
    params: GenerateLaunchTokenRequest
): Promise<{ data: GenerateLaunchTokenResponse | null; error: string | null }> {
    return apiCall<GenerateLaunchTokenResponse>('generate-launch-token', {
        method: 'POST',
        body: params,
    });
}

// ============================================
// Knowledge Base API
// ============================================

export interface GenerateKnowledgeRequest {
    client_id: string;
    ai_provider: 'openai' | 'anthropic' | 'gemini';
    file_ids?: string[];
}

export interface GenerateKnowledgeResponse {
    success: boolean;
    generated_text: string;
    files_analyzed: number;
}

export async function generateKnowledge(
    params: GenerateKnowledgeRequest
): Promise<{ data: GenerateKnowledgeResponse | null; error: string | null }> {
    return apiCall<GenerateKnowledgeResponse>('generate-knowledge', {
        method: 'POST',
        body: params,
    });
}

// ============================================
// Contract Analysis API
// ============================================

export interface AnalyzeContractRequest {
    client_id: string;
    contract_id: string;
    ai_provider: 'openai' | 'anthropic' | 'gemini';
}

export interface AnalyzeContractResponse {
    success: boolean;
    analysis: string;
}

export async function analyzeContract(
    params: AnalyzeContractRequest
): Promise<{ data: AnalyzeContractResponse | null; error: string | null }> {
    return apiCall<AnalyzeContractResponse>('analyze-contract', {
        method: 'POST',
        body: params,
    });
}

// ============================================
// RAG: Drive Sync API
// ============================================

export interface SyncDriveFolder {
    id: string;
    name: string;
    path: string;
}

export interface SyncDriveResponse {
    success: boolean;
    folder_scanned: string;
    files_found: number;
    new_files: number;
    updated_files: number;
    unchanged_files: number;
    pending_folders: SyncDriveFolder[];
}

export async function syncDriveFolder(
    clientId: string,
    folderId?: string,
    folderPath?: string
): Promise<{ data: SyncDriveResponse | null; error: string | null }> {
    return apiCall<SyncDriveResponse>('sync-drive', {
        method: 'POST',
        body: { client_id: clientId, folder_id: folderId, folder_path: folderPath },
    });
}

// ============================================
// RAG: Process Documents API
// ============================================

export interface ProcessDocumentsResponse {
    success: boolean;
    message: string;
    processed: number;
    failed: number;
    total_chunks: number;
    remaining: number;
    results: Array<{ fileName: string; success: boolean; chunks: number; error?: string }>;
}

export async function processDocuments(
    clientId: string,
    fileIds?: string[]
): Promise<{ data: ProcessDocumentsResponse | null; error: string | null }> {
    return apiCall<ProcessDocumentsResponse>('process-documents', {
        method: 'POST',
        body: { client_id: clientId, file_ids: fileIds },
    });
}

// ============================================
// RAG: Chat API
// ============================================

export interface ChatRagRequest {
    client_id: string;
    message: string;
    session_id?: string;
}

export interface ChatRagResponse {
    success: boolean;
    session_id: string;
    message: string;
    sources: Array<{ file_name: string; file_id: string; chunk_id: string; relevance_score: number }>;
    model: string;
    tokens_used: number;
    chunks_found: number;
}

export async function chatRag(params: ChatRagRequest): Promise<{ data: ChatRagResponse | null; error: string | null }> {
    return apiCall<ChatRagResponse>('chat-rag', {
        method: 'POST',
        body: params,
    });
}

// ============================================
// Predefined API Key Templates
// ============================================

export const API_KEY_TEMPLATES = [
    {
        key: 'ANTHROPIC_API_KEY',
        label: 'Anthropic API Key',
        description: 'Chiave API per Claude e altri servizi Anthropic',
        placeholder: 'sk-ant-...',
    },
    {
        key: 'SERPAPI_API_KEY',
        label: 'SerpAPI API Key',
        description: 'Chiave API per SerpAPI (Google Search API)',
        placeholder: '',
    },
    {
        key: 'DATAFORSEO_LOGIN',
        label: 'DataForSEO Login',
        description: 'Login/Username per DataForSEO',
        placeholder: '',
    },
    {
        key: 'DATAFORSEO_PASSWORD',
        label: 'DataForSEO Password',
        description: 'Password per DataForSEO',
        placeholder: '',
    },
    {
        key: 'APIFY_API_KEY',
        label: 'Apify API Key',
        description: 'Chiave API per Apify web scraping platform',
        placeholder: 'apify_api_...',
    },
    {
        key: 'GEMINI_API_KEY',
        label: 'Gemini API Key',
        description: 'Chiave API per Google Gemini',
        placeholder: '',
    },
    {
        key: 'OPENAI_API_KEY',
        label: 'OpenAI API Key',
        description: 'Chiave API per i servizi OpenAI (GPT, DALL-E, Whisper)',
        placeholder: 'sk-...',
    },
];
