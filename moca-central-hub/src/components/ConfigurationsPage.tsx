import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Configuration, Client, ConfigType, ClientKnowledge, ClientFile } from '../lib/types';
import { Plus, Edit2, Trash2, Eye, EyeOff, Key, Upload, FileText, Sparkles, X, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { API_KEY_TEMPLATES, generateKnowledge } from '../lib/api';
import { ClientSelector } from './ClientSelector';

interface ConfigurationsPageProps {
  selectedClientId: string;
  onClientChange: (id: string) => void;
}

export function ConfigurationsPage({ selectedClientId, onClientChange }: ConfigurationsPageProps) {
  const { userData } = useAuth();
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const selectedClient = selectedClientId;
  const setSelectedClient = onClientChange;
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Configuration | null>(null);
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    config_key: '',
    config_value: '',
    config_type: 'setting' as ConfigType,
    is_encrypted: false,
  });

  // Knowledge Base state
  const [knowledgeFields, setKnowledgeFields] = useState<ClientKnowledge[]>([]);
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');

  const isSuperAdmin = userData?.role === 'super_admin';
  const isManager = userData?.role === 'manager';
  const isExternal = userData?.role === 'external';
  const canManageConfigs = isSuperAdmin || isManager || userData?.role === 'specialist';

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchConfigurations();
      fetchKnowledgeBase();
      fetchClientFiles();
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);

      if (data && data.length > 0 && !selectedClient) {
        if (isExternal && userData?.client_id) {
          setSelectedClient(userData.client_id);
        } else {
          setSelectedClient(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigurations = async () => {
    if (!selectedClient) return;

    try {
      const { data, error } = await supabase
        .from('configurations')
        .select('*')
        .eq('client_id', selectedClient)
        .order('config_key');

      if (error) throw error;
      setConfigurations(data || []);
    } catch (error) {
      console.error('Error fetching configurations:', error);
    }
  };

  const fetchKnowledgeBase = async () => {
    if (!selectedClient) return;

    try {
      const { data, error } = await supabase
        .from('client_knowledge')
        .select('*')
        .eq('client_id', selectedClient)
        .order('sort_order');

      if (error) throw error;
      setKnowledgeFields(data || []);
    } catch (error) {
      console.error('Error fetching knowledge:', error);
    }
  };

  const fetchClientFiles = async () => {
    if (!selectedClient) return;

    try {
      const { data, error } = await supabase
        .from('client_files')
        .select('*')
        .eq('client_id', selectedClient)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        client_id: selectedClient,
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('configurations')
          .update(payload)
          .eq('id', editingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('configurations').insert([payload]);
        if (error) throw error;
      }

      setShowModal(false);
      setEditingConfig(null);
      setFormData({
        config_key: '',
        config_value: '',
        config_type: 'setting',
        is_encrypted: false,
      });
      fetchConfigurations();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa configurazione?')) return;

    try {
      const { error } = await supabase.from('configurations').delete().eq('id', id);
      if (error) throw error;
      fetchConfigurations();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEdit = (config: Configuration) => {
    setEditingConfig(config);
    setFormData({
      config_key: config.config_key,
      config_value: config.config_value,
      config_type: config.config_type,
      is_encrypted: config.is_encrypted,
    });
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingConfig(null);
    setFormData({
      config_key: '',
      config_value: '',
      config_type: 'setting',
      is_encrypted: false,
    });
    setShowModal(true);
  };

  // Quick add from API key template
  const handleQuickAdd = (template: typeof API_KEY_TEMPLATES[0]) => {
    setEditingConfig(null);
    setFormData({
      config_key: template.key,
      config_value: '',
      config_type: 'api_key',
      is_encrypted: true,
    });
    setShowModal(true);
  };

  // Get already configured keys for this client
  const configuredKeys = configurations.map(c => c.config_key);
  const availableTemplates = API_KEY_TEMPLATES.filter(t => !configuredKeys.includes(t.key));

  // Available AI providers based on configured keys
  const availableProviders: { value: 'gemini' | 'openai' | 'anthropic'; label: string }[] = [];
  if (configuredKeys.includes('GEMINI_API_KEY')) availableProviders.push({ value: 'gemini', label: 'Gemini' });
  if (configuredKeys.includes('OPENAI_API_KEY')) availableProviders.push({ value: 'openai', label: 'OpenAI' });
  if (configuredKeys.includes('ANTHROPIC_API_KEY')) availableProviders.push({ value: 'anthropic', label: 'Anthropic' });

  // Auto-select first available provider if current selection is not available
  const effectiveProvider = availableProviders.find(p => p.value === aiProvider)
    ? aiProvider
    : availableProviders[0]?.value || 'gemini';

  const toggleValueVisibility = (id: string) => {
    setVisibleValues((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const maskValue = (value: string, isEncrypted: boolean, id: string) => {
    if (isEncrypted && !visibleValues.has(id)) {
      return '••••••••' + value.slice(-4);
    }
    return value;
  };

  const configsByType = {
    api_key: configurations.filter((c) => c.config_type === 'api_key'),
    variable: configurations.filter((c) => c.config_type === 'variable'),
    setting: configurations.filter((c) => c.config_type === 'setting'),
  };

  // File upload validation
  const ALLOWED_EXTENSIONS = ['.pdf', '.html', '.htm', '.json', '.txt', '.csv', '.md', '.doc', '.docx', '.xml'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  // Core upload logic shared by input and drag&drop
  const uploadFiles = async (files: File[]) => {
    if (files.length === 0 || !selectedClient) return;

    setUploading(true);
    try {
      for (const file of files) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          alert(`Il file "${file.name}" supera il limite di 10MB`);
          continue;
        }

        // Validate file extension
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          alert(`Tipo di file non consentito: ${ext}. Tipi ammessi: ${ALLOWED_EXTENSIONS.join(', ')}`);
          continue;
        }

        // Sanitize filename to prevent path traversal
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${selectedClient}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('client-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          alert(`Errore upload ${file.name}: ${uploadError.message}`);
          continue;
        }

        const { error: insertError } = await supabase.from('client_files').insert({
          client_id: selectedClient,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          analyzed: false,
        });

        if (insertError) {
          console.error('DB insert error:', insertError);
        }
      }

      fetchClientFiles();
    } catch (error: any) {
      alert('Errore durante il caricamento: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // File input handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await uploadFiles(Array.from(files));
    e.target.value = '';
  };

  // Drag & drop handlers
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  // Delete file
  const handleDeleteFile = async (file: ClientFile) => {
    if (!confirm(`Eliminare il file "${file.file_name}"?`)) return;

    try {
      await supabase.storage.from('client-files').remove([file.file_path]);
      await supabase.from('client_files').delete().eq('id', file.id);
      fetchClientFiles();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Generate knowledge
  const handleGenerateKnowledge = async () => {
    const unanalyzedFiles = clientFiles.filter(f => !f.analyzed);
    if (unanalyzedFiles.length === 0) {
      alert('Non ci sono nuovi file da analizzare');
      return;
    }

    if (availableProviders.length === 0) {
      alert('Configura almeno una API key AI (Gemini, OpenAI o Anthropic) per generare la knowledge base');
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await generateKnowledge({
        client_id: selectedClient,
        ai_provider: effectiveProvider,
      });

      if (error) {
        alert('Errore: ' + error);
        return;
      }

      if (data?.success) {
        alert(`Knowledge base aggiornata! ${data.files_analyzed} file analizzati.`);
        fetchKnowledgeBase();
        fetchClientFiles();
      }
    } catch (error: any) {
      alert('Errore: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  // Save knowledge field
  const handleSaveKnowledgeField = async (field: ClientKnowledge) => {
    try {
      const { error } = await supabase
        .from('client_knowledge')
        .update({ field_value: field.field_value })
        .eq('id', field.id);

      if (error) throw error;
    } catch (error: any) {
      alert('Errore salvataggio: ' + error.message);
    }
  };

  // Add custom knowledge field
  const handleAddCustomField = async () => {
    if (!newFieldName.trim()) return;

    try {
      const fieldKey = newFieldName.trim().toLowerCase().replace(/\s+/g, '_');
      const { error } = await supabase.from('client_knowledge').insert({
        client_id: selectedClient,
        field_key: fieldKey,
        field_value: '',
        field_type: 'custom',
        sort_order: knowledgeFields.length + 1,
      });

      if (error) throw error;
      setNewFieldName('');
      setShowAddFieldModal(false);
      fetchKnowledgeBase();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Delete custom knowledge field
  const handleDeleteKnowledgeField = async (id: string) => {
    if (!confirm('Eliminare questo campo?')) return;

    try {
      const { error } = await supabase.from('client_knowledge').delete().eq('id', id);
      if (error) throw error;
      fetchKnowledgeBase();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento configurazioni...</div>;
  }

  const unanalyzedCount = clientFiles.filter(f => !f.analyzed).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-moca-black">Configurazioni</h1>
          <p className="text-moca-gray mt-1">Gestisci le configurazioni specifiche per cliente</p>
        </div>
        {canManageConfigs && selectedClient && (
          <button
            onClick={handleAdd}
            className="flex items-center space-x-2 bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={20} />
            <span>Aggiungi configurazione</span>
          </button>
        )}
      </div>

      <ClientSelector
        clients={clients}
        selectedClient={selectedClient}
        onSelect={setSelectedClient}
      />

      {/* Quick Add API Keys Section */}
      {selectedClient && canManageConfigs && availableTemplates.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-moca-red-light">
          <div className="flex items-center mb-3">
            <Key size={20} className="text-moca-red mr-2" />
            <h3 className="text-lg font-bold text-moca-black">Aggiungi API key rapida</h3>
          </div>
          <p className="text-sm text-moca-gray mb-4">
            Clicca su un servizio per aggiungere rapidamente la sua API key per questo cliente
          </p>
          <div className="flex flex-wrap gap-2">
            {availableTemplates.map((template) => (
              <button
                key={template.key}
                onClick={() => handleQuickAdd(template)}
                className="flex items-center px-3 py-2 bg-moca-red-light text-moca-red rounded-md hover:bg-moca-red hover:text-white transition-colors text-sm font-medium"
              >
                <Plus size={16} className="mr-1" />
                {template.label.replace(' API Key', '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedClient && (
        <div className="space-y-6">
          {/* API Keys / Variables / Settings sections */}
          {(['api_key', 'variable', 'setting'] as ConfigType[]).map((type) => {
            const typeConfigs = configsByType[type];
            if (typeConfigs.length === 0) return null;

            return (
              <div key={type} className="bg-white rounded-lg border border-moca-red-light shadow-sm">
                <div className="p-4 border-b border-gray-200 bg-moca-red-light">
                  <h2 className="text-lg font-bold text-moca-black capitalize">
                    {type.replace('_', ' ')}s
                  </h2>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {typeConfigs.map((config) => (
                      <div
                        key={config.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-moca-black">{config.config_key}</div>
                          <div className="text-sm text-moca-gray mt-1 font-mono">
                            {maskValue(config.config_value, config.is_encrypted, config.id)}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {config.is_encrypted && (
                            <button
                              onClick={() => toggleValueVisibility(config.id)}
                              className="p-2 text-moca-gray hover:text-moca-red transition-colors"
                            >
                              {visibleValues.has(config.id) ? (
                                <EyeOff size={18} />
                              ) : (
                                <Eye size={18} />
                              )}
                            </button>
                          )}
                          {canManageConfigs && (
                            <>
                              <button
                                onClick={() => handleEdit(config)}
                                className="p-2 text-moca-red hover:text-moca-black transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(config.id)}
                                className="p-2 text-moca-black hover:text-moca-red transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {configurations.length === 0 && (
            <div className="bg-white p-8 rounded-lg border border-moca-red-light text-center text-moca-gray">
              Nessuna configurazione trovata per questo cliente
            </div>
          )}

          {/* ============================== */}
          {/* KNOWLEDGE BASE SECTION */}
          {/* ============================== */}
          <div className="bg-white rounded-lg border-2 border-purple-200 shadow-sm">
            <div className="p-4 border-b border-purple-100 bg-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Sparkles size={20} className="text-purple-600 mr-2" />
                  <h2 className="text-lg font-bold text-moca-black">Knowledge Base</h2>
                </div>
                {canManageConfigs && (
                  <button
                    onClick={() => setShowAddFieldModal(true)}
                    className="flex items-center px-3 py-1.5 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors text-sm font-medium"
                  >
                    <Plus size={16} className="mr-1" />
                    Aggiungi campo
                  </button>
                )}
              </div>
              <p className="text-sm text-moca-gray mt-1">
                Carica file e genera informazioni sul cliente con AI
              </p>
            </div>

            <div className="p-4 space-y-6">
              {/* File Upload Area */}
              {canManageConfigs && (
                <div>
                  <h3 className="text-sm font-semibold text-moca-black mb-3 uppercase tracking-wider">
                    File caricati
                  </h3>

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragging
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    <Upload size={32} className={`mx-auto mb-2 ${isDragging ? 'text-purple-500' : 'text-moca-gray'}`} />
                    <p className="text-sm text-moca-gray mb-3">
                      {isDragging ? 'Rilascia i file qui...' : 'Trascina file qui o clicca per caricare (PDF, HTML, JSON, TXT, ecc.)'}
                    </p>
                    <label className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors cursor-pointer text-sm font-medium">
                      <Upload size={16} className="mr-2" />
                      {uploading ? 'Caricamento...' : 'Carica file'}
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.html,.htm,.json,.txt,.csv,.md,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>

                  {/* File list */}
                  {clientFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {clientFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
                        >
                          <div className="flex items-center space-x-3">
                            <FileText size={18} className={file.analyzed ? 'text-green-600' : 'text-orange-500'} />
                            <div>
                              <p className="text-sm font-medium text-moca-black">{file.file_name}</p>
                              <p className="text-xs text-moca-gray">
                                {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : ''}
                                {' '}&middot;{' '}
                                {new Date(file.created_at).toLocaleDateString('it-IT')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {file.analyzed ? (
                              <span className="flex items-center text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                <Check size={12} className="mr-1" />
                                Analizzato
                              </span>
                            ) : (
                              <span className="text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                                Nuovo
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteFile(file)}
                              className="p-1 text-moca-gray hover:text-moca-red transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generate Knowledge Button */}
                  {clientFiles.length > 0 && (
                    <div className="mt-4 flex items-center gap-3">
                      <select
                        value={effectiveProvider}
                        onChange={(e) => setAiProvider(e.target.value as any)}
                        className="px-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        disabled={availableProviders.length === 0}
                      >
                        {availableProviders.length > 0 ? (
                          availableProviders.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))
                        ) : (
                          <option value="">Nessuna API key AI configurata</option>
                        )}
                      </select>
                      <button
                        onClick={handleGenerateKnowledge}
                        disabled={generating || unanalyzedCount === 0 || availableProviders.length === 0}
                        className="flex items-center px-4 py-2.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generating ? (
                          <Loader2 size={16} className="mr-2 animate-spin" />
                        ) : (
                          <Sparkles size={16} className="mr-2" />
                        )}
                        {generating ? 'Analisi in corso...' : `Analizza file e genera conoscenza${unanalyzedCount > 0 ? ` (${unanalyzedCount} nuovi)` : ''}`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Generated Knowledge Field */}
              {knowledgeFields.filter(f => f.field_type === 'generated').map((field) => (
                <div key={field.id}>
                  <h3 className="text-sm font-semibold text-moca-black mb-2 uppercase tracking-wider">
                    Conoscenza generata
                  </h3>
                  <textarea
                    value={field.field_value}
                    onChange={(e) => {
                      setKnowledgeFields(prev =>
                        prev.map(f => f.id === field.id ? { ...f, field_value: e.target.value } : f)
                      );
                    }}
                    onBlur={() => handleSaveKnowledgeField(field)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                    rows={12}
                    placeholder="La conoscenza generata dall'AI apparira' qui..."
                    disabled={!canManageConfigs}
                  />
                  <p className="text-xs text-moca-gray mt-1">
                    Questo campo e' modificabile. Le nuove analisi aggiungeranno informazioni senza sovrascrivere.
                  </p>
                </div>
              ))}

              {/* Custom Knowledge Fields */}
              {knowledgeFields.filter(f => f.field_type === 'custom').length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-moca-black mb-3 uppercase tracking-wider">
                    Campi personalizzati
                  </h3>
                  <div className="space-y-4">
                    {knowledgeFields.filter(f => f.field_type === 'custom').map((field) => (
                      <div key={field.id} className="bg-gray-50 rounded-md border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold text-moca-black">
                            {field.field_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </label>
                          {canManageConfigs && (
                            <button
                              onClick={() => handleDeleteKnowledgeField(field.id)}
                              className="p-1 text-moca-gray hover:text-moca-red transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <textarea
                          value={field.field_value}
                          onChange={(e) => {
                            setKnowledgeFields(prev =>
                              prev.map(f => f.id === field.id ? { ...f, field_value: e.target.value } : f)
                            );
                          }}
                          onBlur={() => handleSaveKnowledgeField(field)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                          rows={4}
                          placeholder="Inserisci informazioni..."
                          disabled={!canManageConfigs}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Configuration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-moca-black mb-4">
              {editingConfig ? 'Modifica configurazione' : 'Aggiungi configurazione'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  Chiave configurazione *
                </label>
                <input
                  type="text"
                  value={formData.config_key}
                  onChange={(e) => setFormData({ ...formData, config_key: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                  placeholder="e.g., OPENAI_API_KEY"
                  required
                  disabled={!!editingConfig}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  Valore configurazione *
                </label>
                <textarea
                  value={formData.config_value}
                  onChange={(e) => setFormData({ ...formData, config_value: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  Tipo configurazione *
                </label>
                <select
                  value={formData.config_type}
                  onChange={(e) =>
                    setFormData({ ...formData, config_type: e.target.value as ConfigType })
                  }
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                >
                  <option value="api_key">Chiave API</option>
                  <option value="variable">Variabile</option>
                  <option value="setting">Impostazione</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_encrypted"
                  checked={formData.is_encrypted}
                  onChange={(e) =>
                    setFormData({ ...formData, is_encrypted: e.target.checked })
                  }
                  className="mr-2"
                />
                <label htmlFor="is_encrypted" className="text-sm font-semibold text-moca-black">
                  Segna come sensibile (maschera valore)
                </label>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingConfig(null);
                  }}
                  className="flex-1 bg-moca-red-light text-moca-red px-4 py-2 rounded-md hover:bg-moca-red hover:text-white transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
                >
                  {editingConfig ? 'Aggiorna' : 'Crea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Field Modal */}
      {showAddFieldModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-moca-black">Nuovo campo</h2>
              <button onClick={() => setShowAddFieldModal(false)} className="text-moca-gray hover:text-moca-black">
                <X size={20} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-moca-black mb-2">
                Nome del campo
              </label>
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="es. Competitor principali, Target audience..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomField()}
              />
            </div>
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => setShowAddFieldModal(false)}
                className="flex-1 bg-gray-100 text-moca-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleAddCustomField}
                disabled={!newFieldName.trim()}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                Crea campo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
