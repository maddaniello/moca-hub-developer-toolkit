export type UserRole = 'super_admin' | 'manager' | 'specialist' | 'external';
export type EntityStatus = 'active' | 'inactive' | 'suspended';
export type AppStatus = 'active' | 'maintenance' | 'inactive';
export type ConfigType = 'api_key' | 'variable' | 'setting';
export type AccessLevel = 'full' | 'read_only' | 'restricted';
export type LogLevel = 'info' | 'warning' | 'error';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  logo_url: string | null;
  drive_url: string | null;
  project_url: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface ClientContract {
  id: string;
  client_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  analysis: string | null;
  analyzed_at: string | null;
  created_at: string;
}

export interface User {
  id: string;
  client_id: string; // Deprecated - use client_ids
  email: string;
  name: string;
  role: UserRole;
  level: number;
  status: EntityStatus;
  job_title?: string; // Ruolo aziendale (es. SEO, ADV, Team Leader)
  must_change_password?: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  client?: Client; // Deprecated - use clients
  client_ids?: string[]; // Array of assigned client IDs
  clients?: Client[]; // Array of assigned clients
}

export interface UserClient {
  id: string;
  user_id: string;
  client_id: string;
  created_at: string;
}


export interface Configuration {
  id: string;
  client_id: string;
  config_key: string;
  config_value: string;
  config_type: ConfigType;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Application {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon_url: string | null;
  category_id: string | null;
  required_api_keys?: string[] | null;
  status: AppStatus;
  created_at: string;
  updated_at: string;
  category?: ApplicationCategory;
}

export interface ApplicationAccess {
  id: string;
  application_id: string;
  user_id: string | null;
  client_id: string | null;
  role_access: UserRole | 'all' | null;
  min_level: number | null; // Deprecated - non piu' usato
  access_level: AccessLevel;
  created_at: string;
  application?: Application;
}

export interface Log {
  id: string;
  level: LogLevel;
  message: string;
  data: any;
  user_id: string | null;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  timestamp: string;
  user?: User;
}

export interface ClientKnowledge {
  id: string;
  client_id: string;
  field_key: string;
  field_value: string;
  field_type: 'text' | 'generated' | 'custom';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ClientFile {
  id: string;
  client_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  analyzed: boolean;
  created_at: string;
}

export interface SystemPrompt {
  id: string;
  prompt_key: string;
  prompt_name: string;
  prompt_value: string;
  description: string | null;
  updated_at: string;
}

export interface RoleDefinition {
  id: string;
  role_key: UserRole;
  display_name: string;
  description: string;
  permissions: string[];
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionLevel {
  id: string;
  level: number;
  display_name: string;
  description: string;
  capabilities: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- RAG Client Intelligence System ---

export type DriveFileProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface ClientDriveFile {
  id: string;
  client_id: string;
  drive_file_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  drive_modified_at: string | null;
  processed: boolean;
  processing_status: DriveFileProcessingStatus;
  processing_error: string | null;
  chunk_count: number;
  synced_at: string;
  processed_at: string | null;
  created_at: string;
}

export interface ClientDocumentChunk {
  id: string;
  client_id: string;
  file_id: string;
  chunk_index: number;
  chunk_text: string;
  chunk_level: 0 | 1 | 2;          // 0=summary, 1=section, 2=detail
  parent_chunk_id: string | null;    // L2 → parent L1
  metadata: {
    year?: string | null;
    doc_type?: string;
    file_name?: string;
    file_path?: string;
    key_topics?: string[];
    section_title?: string | null;
    chunk_of?: number;
  };
  token_count: number | null;
  created_at: string;
}

export type DocumentType = 'contratto' | 'proposta' | 'report' | 'fattura' | 'preventivo' | 'brief' | 'presentazione' | 'email' | 'verbale' | 'strategia' | 'analisi' | 'altro';

export interface ClientDocumentSummary {
  id: string;
  client_id: string;
  file_id: string;
  summary: string;
  doc_type: DocumentType | string;
  key_topics: string[];
  date_range: string | null;
  created_at: string;
}

export type EntityType = 'servizio' | 'persona' | 'importo' | 'data' | 'azienda' | 'prodotto' | 'kpi' | 'altro';

export interface ClientEntity {
  id: string;
  client_id: string;
  entity_type: EntityType;
  entity_value: string;
  entity_normalized: string;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
}

export interface ClientEntityMention {
  id: string;
  entity_id: string;
  file_id: string;
  chunk_id: string | null;
  context_snippet: string | null;
  created_at: string;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatSource {
  file_name: string;
  file_id: string;
  chunk_id: string;
  relevance_score: number;
}

export interface ClientChatMessage {
  id: string;
  client_id: string;
  user_id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  sources: ChatSource[];
  model: string | null;
  tokens_used: number | null;
  created_at: string;
}

