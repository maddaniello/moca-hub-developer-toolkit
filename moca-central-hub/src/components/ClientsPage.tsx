import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Client, EntityStatus } from '../lib/types';
import { Plus, Edit2, Trash2, Search, Building2, Upload, Download, Loader2, ExternalLink, Eye } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface ClientsPageProps {
  onViewClient?: (clientId: string) => void;
}

export function ClientsPage({ onViewClient }: ClientsPageProps) {
  const { userData } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const emptyForm = {
    name: '',
    email: '',
    logo_url: '',
    drive_url: '',
    project_url: '',
    status: 'active' as EntityStatus,
  };
  const [formData, setFormData] = useState(emptyForm);

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; errors: string[] } | null>(null);

  const isSuperAdmin = userData?.role === 'super_admin';
  const canManageClients = isSuperAdmin || userData?.role === 'manager' || userData?.role === 'specialist';

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        email: formData.email.trim() || null,
        logo_url: formData.logo_url.trim() || null,
        drive_url: formData.drive_url.trim() || null,
        project_url: formData.project_url.trim() || null,
      };

      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert([payload]);
        if (error) throw error;
      }

      setShowModal(false);
      setEditingClient(null);
      setFormData(emptyForm);
      fetchClients();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo cliente?')) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      fetchClients();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      logo_url: client.logo_url || '',
      drive_url: client.drive_url || '',
      project_url: client.project_url || '',
      status: client.status,
    });
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingClient(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  // === CSV Import ===
  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || '').replace(/^"|"$/g, '');
      });
      rows.push(row);
    }
    return rows;
  };

  const downloadTemplate = () => {
    const headers = ['name', 'email', 'logo_url', 'drive_url', 'project_url', 'status'];
    const example = ['Cliente Esempio', 'info@example.com', 'https://example.com/logo.png', 'https://drive.google.com/...', 'https://project.example.com', 'active'];
    const csvContent = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' + example.join(',');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'template_clienti.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    setImportProgress({ current: 0, total: 0, errors: [] });

    try {
      const text = await importFile.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        alert('Nessun dato trovato nel CSV');
        setImporting(false);
        return;
      }

      setImportProgress({ current: 0, total: rows.length, errors: [] });
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          if (!row.name?.trim()) {
            errors.push(`Riga ${i + 2}: Nome cliente obbligatorio`);
            continue;
          }

          const validStatuses = ['active', 'inactive', 'suspended'];
          const status = validStatuses.includes(row.status) ? row.status : 'active';

          const payload = {
            name: row.name.trim(),
            email: row.email?.trim() || null,
            logo_url: row.logo_url?.trim() || null,
            drive_url: row.drive_url?.trim() || null,
            project_url: row.project_url?.trim() || null,
            status,
          };

          const { error } = await supabase.from('clients').insert([payload]);
          if (error) {
            errors.push(`Riga ${i + 2}: ${error.message}`);
          }
        } catch (err: any) {
          errors.push(`Riga ${i + 2}: ${err.message}`);
        }

        setImportProgress({ current: i + 1, total: rows.length, errors });
      }

      if (errors.length === 0) {
        alert(`${rows.length} clienti importati con successo!`);
        setShowImportModal(false);
        setImportFile(null);
        setImportProgress(null);
        fetchClients();
      }
    } catch (error: any) {
      alert('Errore durante l\'importazione: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8">Caricamento clienti...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-moca-black">Clienti</h1>
          <p className="text-moca-gray mt-1">Gestisci le organizzazioni clienti</p>
        </div>
        {canManageClients && (
          <div className="flex space-x-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-2 bg-white text-moca-black border border-moca-gray px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Upload size={20} />
              <span>Importa CSV</span>
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center space-x-2 bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
            >
              <Plus size={20} />
              <span>Aggiungi cliente</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-lg border border-moca-red-light">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-moca-gray" size={20} />
          <input
            type="text"
            placeholder="Cerca clienti..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="bg-white p-6 rounded-lg border border-moca-red-light shadow-sm hover:border-moca-red transition-colors cursor-pointer"
            onClick={() => onViewClient?.(client.id)}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                {client.logo_url ? (
                  <img
                    src={client.logo_url}
                    alt={`${client.name} logo`}
                    className="w-12 h-12 object-contain rounded-lg border border-gray-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-12 h-12 bg-moca-red-light rounded-lg flex items-center justify-center">
                    <Building2 size={24} className="text-moca-red" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-moca-black">{client.name}</h3>
                  {client.email && (
                    <p className="text-sm text-moca-gray mt-1">{client.email}</p>
                  )}
                </div>
              </div>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  client.status === 'active' ? 'bg-green-100 text-green-800'
                    : client.status === 'inactive' ? 'bg-gray-100 text-gray-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {client.status}
              </span>
            </div>

            <div className="text-xs text-moca-gray mb-4">
              Creato: {new Date(client.created_at).toLocaleDateString('it-IT')}
            </div>

            {canManageClients && (
              <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onViewClient?.(client.id)}
                  className="flex-1 flex items-center justify-center space-x-1 bg-gray-100 text-moca-black px-3 py-2 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <Eye size={16} />
                  <span>Dettaglio</span>
                </button>
                <button
                  onClick={() => handleEdit(client)}
                  className="flex-1 flex items-center justify-center space-x-1 bg-moca-red-light text-moca-red px-3 py-2 rounded-md hover:bg-moca-red hover:text-white transition-colors"
                >
                  <Edit2 size={16} />
                  <span>Modifica</span>
                </button>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="flex items-center justify-center bg-moca-black text-white px-3 py-2 rounded-md hover:opacity-90 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-moca-black mb-4">
              {editingClient ? 'Modifica cliente' : 'Aggiungi cliente'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">Nome cliente *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red" required />
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">Logo URL</label>
                <input type="url" value={formData.logo_url} onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                  placeholder="https://example.com/logo.png" />
                {formData.logo_url && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-md">
                    <p className="text-xs text-moca-gray mb-2">Anteprima:</p>
                    <img src={formData.logo_url} alt="Logo preview" className="max-h-16 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">URL Cartella Drive</label>
                <input type="url" value={formData.drive_url} onChange={(e) => setFormData({ ...formData, drive_url: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                  placeholder="https://drive.google.com/..." />
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">URL Project</label>
                <input type="url" value={formData.project_url} onChange={(e) => setFormData({ ...formData, project_url: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                  placeholder="https://project.example.com" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">Stato</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as EntityStatus })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red">
                  <option value="active">Attivo</option>
                  <option value="inactive">Inattivo</option>
                  <option value="suspended">Sospeso</option>
                </select>
              </div>

              <div className="flex space-x-3 mt-6">
                <button type="button" onClick={() => { setShowModal(false); setEditingClient(null); }}
                  className="flex-1 bg-moca-red-light text-moca-red px-4 py-2 rounded-md hover:bg-moca-red hover:text-white transition-colors">
                  Annulla
                </button>
                <button type="submit" className="flex-1 bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity">
                  {editingClient ? 'Aggiorna' : 'Crea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold text-moca-black mb-4">Importa clienti da CSV</h2>

            {!importProgress ? (
              <div className="space-y-4">
                <button onClick={downloadTemplate}
                  className="flex items-center space-x-2 text-moca-red hover:underline text-sm">
                  <Download size={16} />
                  <span>Scarica template CSV di esempio</span>
                </button>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload size={32} className="mx-auto text-moca-gray mb-2" />
                  <p className="text-sm text-moca-gray mb-3">Seleziona un file CSV da importare</p>
                  <label className="inline-flex items-center px-4 py-2 bg-moca-red text-white rounded-md hover:opacity-90 cursor-pointer text-sm font-medium">
                    <Upload size={16} className="mr-2" />
                    Scegli file
                    <input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                  {importFile && (
                    <p className="text-sm text-green-700 mt-2">{importFile.name}</p>
                  )}
                </div>

                <div className="flex space-x-3">
                  <button onClick={() => { setShowImportModal(false); setImportFile(null); }}
                    className="flex-1 bg-gray-100 text-moca-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors">
                    Annulla
                  </button>
                  <button onClick={handleImport} disabled={!importFile || importing}
                    className="flex-1 bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50">
                    {importing ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Importa'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-moca-gray mb-1">
                    <span>Progresso</span>
                    <span>{importProgress.current}/{importProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-moca-red h-2 rounded-full transition-all"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }} />
                  </div>
                </div>

                {importProgress.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 max-h-40 overflow-y-auto">
                    <p className="text-sm font-semibold text-red-800 mb-2">Errori ({importProgress.errors.length}):</p>
                    {importProgress.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600">{err}</p>
                    ))}
                  </div>
                )}

                {!importing && (
                  <div className="flex space-x-3">
                    <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportProgress(null); }}
                      className="flex-1 bg-gray-100 text-moca-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors">
                      Chiudi
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
