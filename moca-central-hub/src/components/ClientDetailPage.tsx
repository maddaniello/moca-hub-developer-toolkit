import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Client, ClientContract, User, Configuration } from '../lib/types';
import {
  ArrowLeft, Building2, ExternalLink, Upload, FileText, Sparkles, Trash2,
  Users, Loader2, Check, Mail, FolderOpen, Link2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { analyzeContract } from '../lib/api';
import { DriveSyncSection } from './DriveSyncSection';
import { ClientChat } from './ClientChat';

interface ClientDetailPageProps {
  clientId: string;
  onBack: () => void;
}

export function ClientDetailPage({ clientId, onBack }: ClientDetailPageProps) {
  const { userData } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');
  const [isDragging, setIsDragging] = useState(false);

  const isSuperAdmin = userData?.role === 'super_admin';
  const isManager = userData?.role === 'manager';
  const canManage = isSuperAdmin || isManager;

  useEffect(() => {
    fetchAll();
  }, [clientId]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchClient(), fetchContracts(), fetchTeam(), fetchConfigs()]);
    setLoading(false);
  };

  const fetchClient = async () => {
    const { data } = await supabase.from('clients').select('*').eq('id', clientId).single();
    if (data) setClient(data);
  };

  const fetchContracts = async () => {
    const { data } = await supabase
      .from('client_contracts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setContracts(data || []);
  };

  const fetchTeam = async () => {
    const { data } = await supabase
      .from('user_clients')
      .select('user_id, user:users(id, name, email, role, job_title, status)')
      .eq('client_id', clientId);

    if (data) {
      const users = data
        .map(uc => uc.user)
        .filter(u => u && typeof u === 'object' && 'id' in u) as unknown as User[];
      setTeamMembers(users);
    }
  };

  const fetchConfigs = async () => {
    const { data } = await supabase
      .from('configurations')
      .select('*')
      .eq('client_id', clientId);
    setConfigurations(data || []);
  };

  // AI providers - always show all (backend falls back to global Hub keys)
  const allProviders: { value: 'gemini' | 'openai' | 'anthropic'; label: string }[] = [
    { value: 'gemini', label: 'Gemini' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
  ];

  // Core upload logic
  const uploadContractFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('Il file supera il limite di 10MB');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf') {
      alert('Solo file PDF sono accettati per i contratti');
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${clientId}/contracts/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('client_contracts').insert({
        client_id: clientId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      });

      if (insertError) throw insertError;
      fetchContracts();
    } catch (error: any) {
      alert('Errore: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // File input handler
  const handleUploadContract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadContractFile(file);
    e.target.value = '';
  };

  // Drag & drop
  const handleContractDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleContractDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleContractDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadContractFile(file);
  };

  // Analyze contract
  const handleAnalyze = async (contract: ClientContract) => {
    if (false) {
      alert('Configura almeno una API key AI per analizzare i contratti');
      return;
    }

    setAnalyzing(contract.id);
    try {
      const { data, error } = await analyzeContract({
        client_id: clientId,
        contract_id: contract.id,
        ai_provider: aiProvider,
      });

      if (error) {
        alert('Errore: ' + error);
        return;
      }

      if (data?.success) {
        fetchContracts();
      }
    } catch (error: any) {
      alert('Errore: ' + error.message);
    } finally {
      setAnalyzing(null);
    }
  };

  // Delete contract
  const handleDeleteContract = async (contract: ClientContract) => {
    if (!confirm('Eliminare questo contratto?')) return;
    try {
      await supabase.storage.from('client-files').remove([contract.file_path]);
      await supabase.from('client_contracts').delete().eq('id', contract.id);
      fetchContracts();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Save analysis edit
  const handleSaveAnalysis = async (contractId: string, analysis: string) => {
    try {
      await supabase.from('client_contracts').update({ analysis }).eq('id', contractId);
    } catch (error: any) {
      alert('Errore salvataggio: ' + error.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento dettaglio cliente...</div>;
  }

  if (!client) {
    return <div className="text-center py-8 text-moca-gray">Cliente non trovato</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
          <ArrowLeft size={24} className="text-moca-black" />
        </button>
        <div className="flex items-center space-x-4 flex-1">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="w-16 h-16 object-contain rounded-lg border border-gray-200" />
          ) : (
            <div className="w-16 h-16 bg-moca-red-light rounded-lg flex items-center justify-center">
              <Building2 size={32} className="text-moca-red" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-moca-black">{client.name}</h1>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              client.status === 'active' ? 'bg-green-100 text-green-800'
                : client.status === 'inactive' ? 'bg-gray-100 text-gray-800'
                  : 'bg-red-100 text-red-800'
            }`}>{client.status}</span>
          </div>
        </div>
      </div>

      {/* Sezione 1: Dati anagrafici */}
      <div className="bg-white rounded-lg border border-moca-red-light shadow-sm p-6">
        <h2 className="text-lg font-bold text-moca-black mb-4">Dati anagrafici</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {client.email && (
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
              <Mail size={18} className="text-moca-gray" />
              <div>
                <p className="text-xs text-moca-gray">Email</p>
                <p className="text-sm font-medium text-moca-black">{client.email}</p>
              </div>
            </div>
          )}
          {client.drive_url && (
            <a href={client.drive_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md hover:bg-blue-50 transition-colors">
              <FolderOpen size={18} className="text-blue-600" />
              <div className="flex-1">
                <p className="text-xs text-moca-gray">Cartella Drive</p>
                <p className="text-sm font-medium text-blue-600">Apri cartella</p>
              </div>
              <ExternalLink size={14} className="text-blue-400" />
            </a>
          )}
          {client.project_url && (
            <a href={client.project_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md hover:bg-purple-50 transition-colors">
              <Link2 size={18} className="text-purple-600" />
              <div className="flex-1">
                <p className="text-xs text-moca-gray">Project</p>
                <p className="text-sm font-medium text-purple-600">Apri Project</p>
              </div>
              <ExternalLink size={14} className="text-purple-400" />
            </a>
          )}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
            <Building2 size={18} className="text-moca-gray" />
            <div>
              <p className="text-xs text-moca-gray">Creato il</p>
              <p className="text-sm font-medium text-moca-black">{new Date(client.created_at).toLocaleDateString('it-IT')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sezione 2: Contratto */}
      <div className="bg-white rounded-lg border-2 border-blue-200 shadow-sm">
        <div className="p-4 border-b border-blue-100 bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText size={20} className="text-blue-600 mr-2" />
              <h2 className="text-lg font-bold text-moca-black">Contratti</h2>
            </div>
          </div>
          <p className="text-sm text-moca-gray mt-1">Carica e analizza i contratti del cliente con AI</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Upload with drag & drop */}
          {canManage && (
            <div
              onDragOver={handleContractDragOver}
              onDragLeave={handleContractDragLeave}
              onDrop={handleContractDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
              }`}
            >
              <Upload size={28} className={`mx-auto mb-2 ${isDragging ? 'text-blue-500' : 'text-moca-gray'}`} />
              <p className="text-sm text-moca-gray mb-3">
                {isDragging ? 'Rilascia il PDF qui...' : 'Trascina un PDF qui o clicca per caricare'}
              </p>
              <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer text-sm font-medium">
                <Upload size={16} className="mr-2" />
                {uploading ? 'Caricamento...' : 'Carica contratto (PDF)'}
                <input type="file" accept=".pdf" onChange={handleUploadContract} className="hidden" disabled={uploading} />
              </label>
            </div>
          )}

          {/* Contract list */}
          {contracts.map((contract) => (
            <div key={contract.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <FileText size={20} className={contract.analysis ? 'text-green-600' : 'text-blue-500'} />
                  <div>
                    <p className="font-medium text-moca-black">{contract.file_name}</p>
                    <p className="text-xs text-moca-gray">
                      {contract.file_size ? `${(contract.file_size / 1024).toFixed(0)} KB` : ''}
                      {' - '}{new Date(contract.created_at).toLocaleDateString('it-IT')}
                      {contract.analyzed_at && ` - Analizzato il ${new Date(contract.analyzed_at).toLocaleDateString('it-IT')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {contract.analysis ? (
                    <span className="flex items-center text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                      <Check size={12} className="mr-1" />Analizzato
                    </span>
                  ) : null}
                  {canManage && (
                    <button onClick={() => handleDeleteContract(contract)} className="p-1 text-moca-gray hover:text-moca-red">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Analyze button */}
              {canManage && !contract.analysis && (
                <div className="flex items-center gap-2 mb-3">
                  <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm" disabled={false}>
                    {allProviders.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <button onClick={() => handleAnalyze(contract)} disabled={analyzing === contract.id || false}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                    {analyzing === contract.id
                      ? <><Loader2 size={16} className="mr-2 animate-spin" />Analisi in corso...</>
                      : <><Sparkles size={16} className="mr-2" />Analizza contratto</>
                    }
                  </button>
                </div>
              )}

              {/* Analysis result */}
              {contract.analysis && (
                <textarea
                  value={contract.analysis}
                  onChange={(e) => {
                    setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, analysis: e.target.value } : c));
                  }}
                  onBlur={() => handleSaveAnalysis(contract.id, contract.analysis || '')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={15}
                  disabled={!canManage}
                />
              )}

              {/* Re-analyze button for already analyzed contracts */}
              {canManage && contract.analysis && (
                <div className="flex items-center gap-2 mt-2">
                  <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value as any)}
                    className="px-2 py-1 border border-gray-300 rounded-md text-xs" disabled={false}>
                    {allProviders.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <button onClick={() => handleAnalyze(contract)} disabled={analyzing === contract.id}
                    className="flex items-center px-3 py-1 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 text-xs">
                    {analyzing === contract.id
                      ? <Loader2 size={12} className="mr-1 animate-spin" />
                      : <Sparkles size={12} className="mr-1" />
                    }
                    Ri-analizza
                  </button>
                </div>
              )}
            </div>
          ))}

          {contracts.length === 0 && (
            <p className="text-center text-moca-gray text-sm py-4">Nessun contratto caricato</p>
          )}
        </div>
      </div>

      {/* Sezione 3: Team di lavoro */}
      <div className="bg-white rounded-lg border border-moca-red-light shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-moca-red-light">
          <div className="flex items-center">
            <Users size={20} className="text-moca-red mr-2" />
            <h2 className="text-lg font-bold text-moca-black">Team di lavoro</h2>
          </div>
          <p className="text-sm text-moca-gray mt-1">Utenti assegnati a questo cliente</p>
        </div>

        <div className="p-4">
          {teamMembers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <div className="w-10 h-10 bg-moca-red-light rounded-full flex items-center justify-center text-moca-red font-bold text-sm">
                    {member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-moca-black text-sm truncate">{member.name}</p>
                    <p className="text-xs text-moca-gray truncate">{member.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs bg-moca-red-light text-moca-red px-2 py-0.5 rounded-full">{member.role}</span>
                      {member.job_title && (
                        <span className="text-xs text-moca-gray">{member.job_title}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-moca-gray text-sm py-4">
              Nessun utente assegnato a questo cliente
            </p>
          )}
        </div>
      </div>

      {/* Sezione 4: Documenti Drive + Indicizzazione RAG */}
      <DriveSyncSection
        clientId={clientId}
        hasDriveUrl={!!client.drive_url}
        canManage={canManage}
      />

      {/* Sezione 5: Chat AI — Interroga i documenti del cliente */}
      <ClientChat
        clientId={clientId}
        clientName={client.name}
      />
    </div>
  );
}
