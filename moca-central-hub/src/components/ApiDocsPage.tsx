import { Code, Copy, CheckCircle, Sparkles, Save, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SystemPrompt } from '../lib/types';

function SystemPromptsSection() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .order('prompt_key');
      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error('Error fetching prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (prompt: SystemPrompt) => {
    setSaving(prompt.id);
    try {
      const { error } = await supabase
        .from('system_prompts')
        .update({ prompt_value: prompt.prompt_value })
        .eq('id', prompt.id);
      if (error) throw error;
      setSaved(prompt.id);
      setTimeout(() => setSaved(null), 2000);
    } catch (error: any) {
      alert('Errore salvataggio: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const updatePromptValue = (id: string, value: string) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, prompt_value: value } : p));
  };

  if (loading) return null;
  if (prompts.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border-2 border-purple-200 shadow-sm">
      <div className="p-4 border-b border-purple-100 bg-purple-50">
        <div className="flex items-center">
          <Sparkles size={20} className="text-purple-600 mr-2" />
          <h2 className="text-xl font-bold text-moca-black">Prompt di sistema</h2>
        </div>
        <p className="text-sm text-moca-gray mt-1">
          Modifica i prompt utilizzati dalle funzioni AI interne del Hub. Le modifiche hanno effetto immediato.
        </p>
      </div>

      <div className="p-4 space-y-6">
        {prompts.map((prompt) => (
          <div key={prompt.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-moca-black">{prompt.prompt_name}</h3>
                {prompt.description && (
                  <p className="text-xs text-moca-gray mt-0.5">{prompt.description}</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-moca-gray">
                  Aggiornato: {new Date(prompt.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => handleSave(prompt)}
                  disabled={saving === prompt.id}
                  className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    saved === prompt.id
                      ? 'bg-green-100 text-green-700'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  } disabled:opacity-50`}
                >
                  {saving === prompt.id ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : saved === prompt.id ? (
                    <CheckCircle size={14} className="mr-1" />
                  ) : (
                    <Save size={14} className="mr-1" />
                  )}
                  {saved === prompt.id ? 'Salvato' : 'Salva'}
                </button>
              </div>
            </div>
            <textarea
              value={prompt.prompt_value}
              onChange={(e) => updatePromptValue(prompt.id, e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              rows={15}
            />
            <p className="text-xs text-moca-gray mt-1">
              Chiave: <code className="bg-gray-100 px-1 rounded">{prompt.prompt_key}</code>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EndpointProps {
  method: string;
  path: string;
  description: string;
  headers?: { name: string; value: string; required: boolean }[];
  bodyParams?: { name: string; type: string; required: boolean; description: string }[];
  response: string;
  example: string;
  errors?: { code: number; description: string }[];
}

function Endpoint({ method, path, description, headers, bodyParams, response, example, errors }: EndpointProps) {
  const [copiedExample, setCopiedExample] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const methodColors: Record<string, string> = {
    GET: 'bg-green-100 text-green-800',
    POST: 'bg-blue-100 text-blue-800',
    PUT: 'bg-yellow-100 text-yellow-800',
    DELETE: 'bg-red-100 text-red-800',
  };

  const copyToClipboard = async (text: string, type: 'example' | 'response') => {
    await navigator.clipboard.writeText(text);
    if (type === 'example') {
      setCopiedExample(true);
      setTimeout(() => setCopiedExample(false), 2000);
    } else {
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-moca-red-light shadow-sm">
      <div className="flex items-center space-x-3 mb-4">
        <span className={`px-3 py-1 text-xs font-bold rounded-md ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-sm font-mono text-moca-black">{path}</code>
      </div>

      <p className="text-moca-gray mb-4">{description}</p>

      {headers && headers.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-moca-black mb-2">Intestazioni:</h4>
          <div className="bg-gray-50 p-3 rounded-md">
            {headers.map((header, index) => (
              <div key={index} className="text-sm font-mono">
                <span className="text-moca-red">{header.name}</span>:{' '}
                <span className="text-moca-gray">{header.value}</span>
                {header.required && <span className="text-red-600 ml-1">*</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {bodyParams && bodyParams.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-moca-black mb-2">Parametri Body:</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Nome</th>
                  <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold">Obbligatorio</th>
                  <th className="px-3 py-2 text-left font-semibold">Descrizione</th>
                </tr>
              </thead>
              <tbody>
                {bodyParams.map((param, index) => (
                  <tr key={index} className="border-t border-gray-200">
                    <td className="px-3 py-2 font-mono text-moca-red">{param.name}</td>
                    <td className="px-3 py-2 font-mono text-moca-gray">{param.type}</td>
                    <td className="px-3 py-2">{param.required ? '✓' : '-'}</td>
                    <td className="px-3 py-2 text-moca-gray">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {errors && errors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-moca-black mb-2">Codici di Errore:</h4>
          <div className="bg-gray-50 p-3 rounded-md space-y-1">
            {errors.map((error, index) => (
              <div key={index} className="text-sm">
                <span className="font-mono text-red-600">{error.code}</span> -{' '}
                <span className="text-moca-gray">{error.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-moca-black">Richiesta di Esempio:</h4>
          <button
            onClick={() => copyToClipboard(example, 'example')}
            className="flex items-center space-x-1 text-xs text-moca-red hover:text-moca-black transition-colors"
          >
            {copiedExample ? <CheckCircle size={14} /> : <Copy size={14} />}
            <span>{copiedExample ? 'Copiato!' : 'Copia'}</span>
          </button>
        </div>
        <pre className="bg-moca-black text-green-400 p-4 rounded-md overflow-x-auto text-xs font-mono">
          {example}
        </pre>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-moca-black">Risposta di Esempio:</h4>
          <button
            onClick={() => copyToClipboard(response, 'response')}
            className="flex items-center space-x-1 text-xs text-moca-red hover:text-moca-black transition-colors"
          >
            {copiedResponse ? <CheckCircle size={14} /> : <Copy size={14} />}
            <span>{copiedResponse ? 'Copiato!' : 'Copia'}</span>
          </button>
        </div>
        <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-xs font-mono">
          {response}
        </pre>
      </div>
    </div>
  );
}

export function ApiDocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-moca-black">Documentazione API</h1>
        <p className="text-moca-gray mt-1">
          Riferimento API completo per le integrazioni Moca Hub
        </p>
      </div>

      {/* System Prompts Section */}
      <SystemPromptsSection />

      <div className="bg-white p-6 rounded-lg border border-moca-red-light">
        <h2 className="text-xl font-bold text-moca-black mb-3">Base URL</h2>
        <code className="bg-gray-100 px-3 py-2 rounded-md text-sm">
          https://your-domain.com/api
        </code>
        <p className="text-sm text-moca-gray mt-3">
          Tutte le richieste API devono essere effettuate a questo URL base con i percorsi degli endpoint appropriati.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-moca-black mb-4 flex items-center">
            <Code className="mr-2" />
            Endpoint di Autenticazione
          </h2>

          <div className="space-y-4">
            <Endpoint
              method="POST"
              path="/api/auth/login"
              description="Autentica un utente e restituisce token JWT"
              headers={[
                { name: 'Content-Type', value: 'application/json', required: true },
              ]}
              bodyParams={[
                { name: 'email', type: 'string', required: true, description: 'Indirizzo email utente' },
                { name: 'password', type: 'string', required: true, description: 'Password utente' },
              ]}
              response={`{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "super_admin",
    "level": 1
  },
  "client": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Acme Corp"
  }
}`}
              example={`curl -X POST https://your-domain.com/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'`}
              errors={[
                { code: 401, description: 'Credenziali non valide' },
                { code: 400, description: 'Campi obbligatori mancanti' },
                { code: 500, description: 'Errore del server' },
              ]}
            />

            <Endpoint
              method="POST"
              path="/api/auth/logout"
              description="Esegui logout dell'utente corrente e invalida la sessione"
              headers={[
                { name: 'Authorization', value: 'Bearer <token>', required: true },
              ]}
              response={`{
  "success": true,
  "message": "Logged out successfully"
}`}
              example={`curl -X POST https://your-domain.com/api/auth/logout \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}
              errors={[
                { code: 401, description: 'Token non valido o scaduto' },
              ]}
            />

            <Endpoint
              method="GET"
              path="/api/auth/verify"
              description="Verifica un token JWT e restituisce informazioni utente"
              headers={[
                { name: 'Authorization', value: 'Bearer <token>', required: true },
              ]}
              response={`{
  "valid": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "super_admin"
  },
  "client": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Acme Corp"
  }
}`}
              example={`curl -X GET https://your-domain.com/api/auth/verify \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}
              errors={[
                { code: 401, description: 'Token non valido o scaduto' },
              ]}
            />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-moca-black mb-4 flex items-center">
            <Code className="mr-2" />
            Endpoint gestione utenti
          </h2>

          <div className="space-y-4">
            <Endpoint
              method="GET"
              path="/api/users"
              description="Recupera una lista di utenti con filtri opzionali"
              headers={[
                { name: 'Authorization', value: 'Bearer <token>', required: true },
              ]}
              response={`{
  "users": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "client_id": "123e4567-e89b-12d3-a456-426614174001",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "super_admin",
      "level": 1,
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}`}
              example={`curl -X GET "https://your-domain.com/api/users?client_id=123&role=admin" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}
            />

            <Endpoint
              method="POST"
              path="/api/users"
              description="Crea un nuovo utente"
              headers={[
                { name: 'Authorization', value: 'Bearer <token>', required: true },
                { name: 'Content-Type', value: 'application/json', required: true },
              ]}
              bodyParams={[
                { name: 'client_id', type: 'uuid', required: true, description: 'ID Cliente' },
                { name: 'email', type: 'string', required: true, description: 'Email utente' },
                { name: 'name', type: 'string', required: true, description: 'Nome completo utente' },
                { name: 'role', type: 'string', required: true, description: 'Ruolo utente (admin, manager, user, viewer)' },
                { name: 'level', type: 'number', required: false, description: 'Livello permessi (1-5, default: 1)' },
              ]}
              response={`{
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "client_id": "123e4567-e89b-12d3-a456-426614174001",
    "email": "newuser@example.com",
    "name": "Jane Smith",
    "role": "user",
    "level": 3,
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
}`}
              example={`curl -X POST https://your-domain.com/api/users \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id": "123e4567-e89b-12d3-a456-426614174001",
    "email": "newuser@example.com",
    "name": "Jane Smith",
    "role": "user",
    "level": 3
  }'`}
              errors={[
                { code: 400, description: 'Parametri non validi o mancanti' },
                { code: 401, description: 'Non autorizzato' },
                { code: 403, description: 'Permessi insufficienti' },
              ]}
            />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-moca-black mb-4 flex items-center">
            <Code className="mr-2" />
            Endpoint gestione clienti
          </h2>

          <div className="space-y-4">
            <Endpoint
              method="GET"
              path="/api/clients"
              description="Recupera tutti i clienti"
              headers={[
                { name: 'Authorization', value: 'Bearer <token>', required: true },
              ]}
              response={`{
  "clients": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "name": "Acme Corp",
      "email": "contact@acme.com",
      "logo_url": "https://example.com/logo.png",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}`}
              example={`curl -X GET https://your-domain.com/api/clients \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}
            />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-moca-black mb-4 flex items-center">
            <Code className="mr-2" />
            Endpoint configurazioni
          </h2>

          <div className="space-y-4">
            <Endpoint
              method="GET"
              path="/api/config/:clientId"
              description="Recupera le configurazioni per un cliente specifico"
              headers={[
                { name: 'Authorization', value: 'Bearer <token>', required: true },
              ]}
              response={`{
  "configurations": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "client_id": "123e4567-e89b-12d3-a456-426614174001",
      "config_key": "OPENAI_API_KEY",
      "config_value": "sk-...",
      "config_type": "api_key",
      "is_encrypted": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}`}
              example={`curl -X GET https://your-domain.com/api/config/123e4567-e89b-12d3-a456-426614174001 \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}
            />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-moca-black mb-4 flex items-center">
            <Code className="mr-2" />
            Endpoint registro applicazioni
          </h2>

          <div className="space-y-4">
            <Endpoint
              method="GET"
              path="/api/apps"
              description="Recupera tutte le applicazioni"
              headers={[
                { name: 'Authorization', value: 'Bearer <token>', required: true },
              ]}
              response={`{
  "applications": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Analytics Dashboard",
      "description": "Real-time analytics and reporting",
      "url": "https://analytics.example.com",
      "icon_url": "https://example.com/icon.png",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}`}
              example={`curl -X GET https://your-domain.com/api/apps \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}
            />

            <Endpoint
              method="GET"
              path="/api/apps/user/:userId"
              description="Recupera le applicazioni accessibili da un utente specifico"
              headers={[
                { name: 'Authorization', value: 'Bearer <token>', required: true },
              ]}
              response={`{
  "applications": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Analytics Dashboard",
      "description": "Real-time analytics and reporting",
      "url": "https://analytics.example.com",
      "access_level": "full"
    }
  ]
}`}
              example={`curl -X GET https://your-domain.com/api/apps/user/123e4567-e89b-12d3-a456-426614174000 \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}
            />
          </div>
        </div>
      </div>

      <div className="bg-moca-red-light p-6 rounded-lg border border-moca-red">
        <h3 className="text-lg font-bold text-moca-black mb-2">Autenticazione</h3>
        <p className="text-sm text-moca-gray">
          Tutti gli endpoint autenticati richiedono un token JWT valido nell'intestazione Authorization.
          Ottieni un token chiamando l'endpoint <code className="bg-white px-2 py-1 rounded">/api/auth/login</code>.
        </p>
      </div>
    </div>
  );
}
