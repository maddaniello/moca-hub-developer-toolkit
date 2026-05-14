import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Application, ApplicationAccess, ApplicationCategory, Client, User, AppStatus, AccessLevel } from '../lib/types';
import { Plus, Edit2, Trash2, ExternalLink, Shield, AppWindow, Tag, Key, Upload, Image } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { API_KEY_TEMPLATES } from '../lib/api';

export function ApplicationsPage() {
  const { userData } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [categories, setCategories] = useState<ApplicationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [accessList, setAccessList] = useState<ApplicationAccess[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    icon_url: '',
    category_id: '' as string,
    status: 'active' as AppStatus,
    required_api_keys: [] as string[],
  });
  const [accessType, setAccessType] = useState<'user' | 'client' | 'role_level'>('user');
  const [accessFormData, setAccessFormData] = useState({
    user_id: '',
    client_id: '',
    role_access: '' as string,
    min_level: '' as string,
    access_level: 'full' as AccessLevel,
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [iconUploading, setIconUploading] = useState(false);
  const [iconDragging, setIconDragging] = useState(false);
  const [iconMode, setIconMode] = useState<'url' | 'upload'>('url');

  const isSuperAdmin = userData?.role === 'super_admin';
  const canManageApps = isSuperAdmin || userData?.role === 'manager';

  useEffect(() => {
    fetchApplications();
    fetchClients();
    fetchUsers();
    fetchCategories();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*, category:application_categories(*)')
        .order('name');

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('application_categories')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, client:clients(name)')
        .order('name');
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchAccessList = async (appId: string) => {
    try {
      const { data, error } = await supabase
        .from('application_access')
        .select('*, application:applications(*)')
        .eq('application_id', appId);

      if (error) throw error;
      setAccessList(data || []);
    } catch (error) {
      console.error('Error fetching access list:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        url: formData.url,
        icon_url: formData.icon_url,
        category_id: formData.category_id || null,
        status: formData.status,
        required_api_keys: formData.required_api_keys,
      };

      if (editingApp) {
        const { error } = await supabase
          .from('applications')
          .update(payload)
          .eq('id', editingApp.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('applications').insert([payload]);
        if (error) throw error;
      }

      setShowModal(false);
      setEditingApp(null);
      setFormData({ name: '', description: '', url: '', icon_url: '', category_id: '', status: 'active', required_api_keys: [] });
      fetchApplications();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedApp) return;

    if (accessType === 'user' && !accessFormData.user_id) {
      alert('Seleziona un utente');
      return;
    }
    if (accessType === 'client' && !accessFormData.client_id) {
      alert('Seleziona un cliente');
      return;
    }
    if (accessType === 'role_level' && !accessFormData.role_access && !accessFormData.min_level) {
      alert('Seleziona un ruolo o un livello minimo');
      return;
    }

    try {
      const payload: any = {
        application_id: selectedApp.id,
        access_level: accessFormData.access_level,
        user_id: null,
        client_id: null,
        role_access: null,
        min_level: null,
      };

      if (accessType === 'user') payload.user_id = accessFormData.user_id;
      if (accessType === 'client') payload.client_id = accessFormData.client_id;
      if (accessType === 'role_level') {
        payload.role_access = accessFormData.role_access || null;
        payload.min_level = accessFormData.min_level ? parseInt(accessFormData.min_level) : null;
      }

      const { error } = await supabase.from('application_access').insert([payload]);
      if (error) throw error;

      setAccessFormData({
        user_id: '',
        client_id: '',
        role_access: '',
        min_level: '',
        access_level: 'full'
      });
      fetchAccessList(selectedApp.id);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa applicazione?')) return;

    try {
      const { error } = await supabase.from('applications').delete().eq('id', id);
      if (error) throw error;
      fetchApplications();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeleteAccess = async (id: string) => {
    if (!confirm('Sei sicuro di voler rimuovere questo accesso?')) return;

    try {
      const { error } = await supabase.from('application_access').delete().eq('id', id);
      if (error) throw error;
      if (selectedApp) {
        fetchAccessList(selectedApp.id);
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEdit = (app: Application) => {
    setEditingApp(app);
    setFormData({
      name: app.name,
      description: app.description || '',
      url: app.url,
      icon_url: app.icon_url || '',
      category_id: app.category_id || '',
      status: app.status,
      required_api_keys: app.required_api_keys || [],
    });
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingApp(null);
    setFormData({ name: '', description: '', url: '', icon_url: '', category_id: '', status: 'active', required_api_keys: [] });
    setShowModal(true);
  };

  const toggleRequiredKey = (key: string) => {
    setFormData(prev => ({
      ...prev,
      required_api_keys: prev.required_api_keys.includes(key)
        ? prev.required_api_keys.filter(k => k !== key)
        : [...prev.required_api_keys, key],
    }));
  };

  const uploadIcon = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('Immagine troppo grande (max 2MB)');
      return;
    }
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('Tipo non supportato. Usa PNG, JPG, SVG, WebP o GIF.');
      return;
    }

    setIconUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeName = `app-icons/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('client-files').upload(safeName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('client-files').getPublicUrl(safeName);
      if (urlData?.publicUrl) {
        setFormData(prev => ({ ...prev, icon_url: urlData.publicUrl }));
      }
    } catch (error: any) {
      alert('Errore upload: ' + error.message);
    } finally {
      setIconUploading(false);
    }
  };

  const handleManageAccess = (app: Application) => {
    setSelectedApp(app);
    fetchAccessList(app.id);
    setShowAccessModal(true);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) : 0;
      const { error } = await supabase.from('application_categories').insert([{
        name: newCategoryName.trim(),
        sort_order: maxOrder + 1,
      }]);
      if (error) throw error;
      setNewCategoryName('');
      fetchCategories();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa categoria? Le applicazioni associate perderanno la categoria.')) return;

    try {
      const { error } = await supabase.from('application_categories').delete().eq('id', id);
      if (error) throw error;
      fetchCategories();
      fetchApplications();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento applicazioni...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-moca-black">Applicazioni</h1>
          <p className="text-moca-gray mt-1">Gestisci il registro delle applicazioni e controllo accessi</p>
        </div>
        {canManageApps && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center space-x-2 bg-moca-red-light text-moca-red px-4 py-2 rounded-md hover:bg-moca-red hover:text-white transition-colors"
            >
              <Tag size={20} />
              <span>Categorie</span>
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center space-x-2 bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
            >
              <Plus size={20} />
              <span>Aggiungi applicazione</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {applications.map((app) => (
          <div
            key={app.id}
            className="bg-white p-6 rounded-lg border border-moca-red-light shadow-sm hover:border-moca-red transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start space-x-3 flex-1">
                {app.icon_url ? (
                  <img src={app.icon_url} alt={app.name} className="w-10 h-10 object-contain flex-shrink-0 mt-0.5" />
                ) : (
                  <div className="w-10 h-10 bg-moca-red-light rounded-full flex items-center justify-center text-moca-red flex-shrink-0 mt-0.5">
                    <AppWindow size={20} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-moca-black">{app.name}</h3>
                  {app.description && (
                    <p className="text-sm text-moca-gray mt-1 line-clamp-2">{app.description}</p>
                  )}
                  {app.category && (
                    <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                      {app.category.name}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ml-2 flex-shrink-0 ${app.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : app.status === 'maintenance'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                  }`}
              >
                {app.status}
              </span>
            </div>

            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-sm text-moca-red hover:text-moca-black transition-colors mb-4"
            >
              <ExternalLink size={16} />
              <span className="truncate">{app.url}</span>
            </a>

            <div className="flex space-x-2">
              {canManageApps && (
                <>
                  <button
                    onClick={() => handleManageAccess(app)}
                    className="flex-1 flex items-center justify-center space-x-1 bg-moca-red-light text-moca-red px-3 py-2 rounded-md hover:bg-moca-red hover:text-white transition-colors text-sm"
                  >
                    <Shield size={16} />
                    <span>Accesso</span>
                  </button>
                  <button
                    onClick={() => handleEdit(app)}
                    className="flex items-center justify-center bg-moca-red-light text-moca-red px-3 py-2 rounded-md hover:bg-moca-red hover:text-white transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(app.id)}
                    className="flex items-center justify-center bg-moca-black text-white px-3 py-2 rounded-md hover:opacity-90 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal creazione/modifica applicazione */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-moca-black mb-4">
              {editingApp ? 'Modifica applicazione' : 'Aggiungi applicazione'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  Nome applicazione *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  Descrizione
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  URL applicazione *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  Icona applicazione
                </label>

                {/* Toggle URL / Upload */}
                <div className="flex space-x-1 mb-2 bg-gray-100 rounded-md p-1">
                  <button type="button" onClick={() => setIconMode('url')}
                    className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${iconMode === 'url' ? 'bg-white text-moca-black shadow-sm' : 'text-moca-gray'}`}>
                    URL
                  </button>
                  <button type="button" onClick={() => setIconMode('upload')}
                    className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${iconMode === 'upload' ? 'bg-white text-moca-black shadow-sm' : 'text-moca-gray'}`}>
                    Carica immagine
                  </button>
                </div>

                {iconMode === 'url' ? (
                  <input
                    type="url"
                    value={formData.icon_url}
                    onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                    className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                    placeholder="https://example.com/icon.png"
                  />
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIconDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIconDragging(false); }}
                    onDrop={async (e) => {
                      e.preventDefault(); e.stopPropagation(); setIconDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file) await uploadIcon(file);
                    }}
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                      iconDragging ? 'border-moca-red bg-moca-red-light' : 'border-gray-300 hover:border-moca-red'
                    }`}
                  >
                    <Image size={24} className={`mx-auto mb-1 ${iconDragging ? 'text-moca-red' : 'text-moca-gray'}`} />
                    <p className="text-xs text-moca-gray mb-2">
                      {iconDragging ? 'Rilascia qui...' : 'Trascina un\'immagine o clicca'}
                    </p>
                    <label className="inline-flex items-center px-3 py-1.5 bg-moca-red text-white rounded-md hover:opacity-90 cursor-pointer text-xs font-medium">
                      <Upload size={14} className="mr-1" />
                      {iconUploading ? 'Caricamento...' : 'Scegli file'}
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                        onChange={async (e) => { const f = e.target.files?.[0]; if (f) await uploadIcon(f); e.target.value = ''; }}
                        className="hidden" disabled={iconUploading} />
                    </label>
                  </div>
                )}

                {/* Preview */}
                {formData.icon_url && (
                  <div className="mt-2 flex items-center space-x-3 p-2 bg-gray-50 rounded-md">
                    <img src={formData.icon_url} alt="Anteprima" className="w-10 h-10 object-contain rounded"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="text-xs text-moca-gray truncate flex-1">{formData.icon_url}</span>
                    <button type="button" onClick={() => setFormData({ ...formData, icon_url: '' })}
                      className="text-xs text-moca-red hover:underline">Rimuovi</button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  Categoria
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                >
                  <option value="">Nessuna categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  <Key size={16} className="inline mr-1" />
                  API richieste per l'utilizzo
                </label>
                <p className="text-xs text-moca-gray mb-2">
                  Seleziona le API necessarie per usare questa applicazione
                </p>
                <div className="space-y-2 bg-gray-50 p-3 rounded-md border border-gray-200">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.required_api_keys.includes('ANY_LLM')}
                      onChange={() => toggleRequiredKey('ANY_LLM')}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-purple-700">Almeno un LLM (OpenAI / Gemini / Anthropic)</span>
                  </label>
                  <hr className="border-gray-200" />
                  {API_KEY_TEMPLATES.filter(t => !['OPENAI_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY'].includes(t.key)).map((template) => (
                    <label key={template.key} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.required_api_keys.includes(template.key)}
                        onChange={() => toggleRequiredKey(template.key)}
                        className="rounded"
                      />
                      <span className="text-sm text-moca-black">{template.label}</span>
                    </label>
                  ))}
                  {/* Show custom keys already in the list that aren't in templates */}
                  {formData.required_api_keys
                    .filter(k => k !== 'ANY_LLM' && !API_KEY_TEMPLATES.find(t => t.key === k))
                    .map((key) => (
                      <label key={key} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => toggleRequiredKey(key)}
                          className="rounded"
                        />
                        <span className="text-sm text-moca-black">{key}</span>
                      </label>
                    ))
                  }
                  <hr className="border-gray-200" />
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Chiave custom (es. REDDIT_CLIENT_ID)"
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-moca-red"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                          if (val && !formData.required_api_keys.includes(val)) {
                            toggleRequiredKey(val);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <span className="text-xs text-moca-gray">Invio per aggiungere</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  Stato *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as AppStatus })
                  }
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                >
                  <option value="active">Attivo</option>
                  <option value="maintenance">Manutenzione</option>
                  <option value="inactive">Inattivo</option>
                </select>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingApp(null);
                  }}
                  className="flex-1 bg-moca-red-light text-moca-red px-4 py-2 rounded-md hover:bg-moca-red hover:text-white transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
                >
                  {editingApp ? 'Aggiorna' : 'Crea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal gestione categorie */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-moca-black mb-4">Gestione categorie</h2>

            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nome nuova categoria..."
                className="flex-1 px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <button
                onClick={handleAddCategory}
                className="bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity text-sm"
              >
                Aggiungi
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-center text-moca-gray py-4">Nessuna categoria creata</p>
              ) : (
                categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center space-x-2">
                      <Tag size={16} className="text-purple-600" />
                      <span className="font-medium text-moca-black">{cat.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-moca-red hover:text-moca-black transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowCategoryModal(false)}
              className="mt-6 w-full bg-moca-red-light text-moca-red px-4 py-2 rounded-md hover:bg-moca-red hover:text-white transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Modal gestione accesso */}
      {showAccessModal && selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
            <h2 className="text-2xl font-bold text-moca-black mb-4">
              Gestione accesso: {selectedApp.name}
            </h2>

            <form onSubmit={handleAccessSubmit} className="mb-6 p-4 bg-gray-50 rounded-md">
              <h3 className="font-semibold text-moca-black mb-3">Concedi accesso</h3>

              {/* Tabs for Access Type */}
              <div className="flex space-x-1 bg-gray-200 p-1 rounded-md mb-4 text-sm">
                <button
                  type="button"
                  onClick={() => setAccessType('user')}
                  className={`flex-1 py-1 rounded-md transition-colors ${accessType === 'user' ? 'bg-white shadow text-moca-black' : 'text-moca-gray hover:bg-gray-300'
                    }`}
                >
                  Utente singolo
                </button>
                <button
                  type="button"
                  onClick={() => setAccessType('client')}
                  className={`flex-1 py-1 rounded-md transition-colors ${accessType === 'client' ? 'bg-white shadow text-moca-black' : 'text-moca-gray hover:bg-gray-300'
                    }`}
                >
                  Intero cliente
                </button>
                <button
                  type="button"
                  onClick={() => setAccessType('role_level')}
                  className={`flex-1 py-1 rounded-md transition-colors ${accessType === 'role_level' ? 'bg-white shadow text-moca-black' : 'text-moca-gray hover:bg-gray-300'
                    }`}
                >
                  Ruolo / Livello
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {accessType === 'user' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-moca-gray mb-1">
                      Seleziona utente
                    </label>
                    <select
                      value={accessFormData.user_id}
                      onChange={(e) => setAccessFormData({ ...accessFormData, user_id: e.target.value })}
                      className="w-full px-3 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red text-sm"
                    >
                      <option value="">Seleziona utente...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.client?.name})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {accessType === 'client' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-moca-gray mb-1">
                      Seleziona cliente
                    </label>
                    <select
                      value={accessFormData.client_id}
                      onChange={(e) => setAccessFormData({ ...accessFormData, client_id: e.target.value })}
                      className="w-full px-3 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red text-sm"
                    >
                      <option value="">Seleziona cliente...</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {accessType === 'role_level' && (
                  <div>
                    <label className="block text-xs font-semibold text-moca-gray mb-1">
                      Ruolo
                    </label>
                    <select
                      value={accessFormData.role_access}
                      onChange={(e) => setAccessFormData({ ...accessFormData, role_access: e.target.value })}
                      className="w-full px-3 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red text-sm"
                    >
                      <option value="">Seleziona ruolo...</option>
                      <option value="all">Tutti i ruoli</option>
                      <option value="manager">Manager</option>
                      <option value="specialist">Specialist</option>
                      <option value="external">Esterno</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-moca-gray mb-1">
                  Permessi app
                </label>
                <select
                  value={accessFormData.access_level}
                  onChange={(e) =>
                    setAccessFormData({
                      ...accessFormData,
                      access_level: e.target.value as AccessLevel,
                    })
                  }
                  className="w-full px-3 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red text-sm"
                >
                  <option value="full">Completo</option>
                  <option value="read_only">Sola lettura</option>
                  <option value="restricted">Limitato</option>
                </select>
              </div>
              <button
                type="submit"
                className="mt-3 w-full bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity text-sm"
              >
                Concedi accesso
              </button>
            </form>

            <div className="max-h-96 overflow-y-auto">
              <h3 className="font-semibold text-moca-black mb-3">Accessi correnti</h3>
              {accessList.length === 0 ? (
                <p className="text-center text-moca-gray py-4">Nessun accesso concesso</p>
              ) : (
                <div className="space-y-2">
                  {accessList.map((access) => {
                    const user = users.find((u) => u.id === access.user_id);
                    const client = clients.find((c) => c.id === access.client_id);

                    return (
                      <div
                        key={access.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                      >
                        <div>
                          <p className="font-medium text-moca-black">
                            {user && `User: ${user.name}`}
                            {client && `Client: ${client.name}`}
                            {access.role_access && `Ruolo: ${access.role_access === 'all' ? 'Tutti' : access.role_access}`}
                            {!user && !client && !access.role_access && 'Regola sconosciuta'}
                          </p>
                          <p className="text-xs text-moca-gray">Accesso: {access.access_level}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteAccess(access.id)}
                          className="text-moca-red hover:text-moca-black transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowAccessModal(false);
                setSelectedApp(null);
                setAccessList([]);
              }}
              className="mt-6 w-full bg-moca-red-light text-moca-red px-4 py-2 rounded-md hover:bg-moca-red hover:text-white transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
