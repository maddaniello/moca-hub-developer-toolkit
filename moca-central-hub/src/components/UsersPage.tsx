import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Client, UserRole, EntityStatus } from '../lib/types';
import { Plus, Edit2, Trash2, Search, CheckCircle, AlertCircle, X, Upload, Download, FileText, Loader, Mail, Key, Copy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { createUser as createUserApi, deleteUser as deleteUserApi } from '../lib/api';
import { logInfo, logError } from '../lib/logger';

interface UserWithClients extends User {
  user_clients?: { client_id: string; client: Client }[];
}

export function UsersPage() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<UserWithClients[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithClients | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sendInvite, setSendInvite] = useState(true);
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ email: string; password: string } | null>(null);
  const [formData, setFormData] = useState({
    client_ids: [] as string[],
    email: '',
    name: '',
    job_title: '',
    role: 'specialist' as UserRole,
    status: 'active' as EntityStatus,
  });

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; errors: string[] } | null>(null);

  const isSuperAdmin = userData?.role === 'super_admin';
  const isManager = userData?.role === 'manager';
  const canManageUsers = isSuperAdmin || isManager;

  /* New state for dynamic roles */
  const [roleDefinitions, setRoleDefinitions] = useState<any[]>([]);

  // Fallback Data Constants
  const DEFAULT_ROLES = [
    { role_key: 'super_admin', display_name: 'Super Admin', description: 'Accesso completo alla piattaforma.', is_system: true },
    { role_key: 'manager', display_name: 'Manager', description: 'Gestione utenti, clienti e configurazioni.', is_system: true },
    { role_key: 'specialist', display_name: 'Specialist', description: 'Configurazioni, clienti e app.', is_system: true },
    { role_key: 'external', display_name: 'Esterno', description: 'Accesso limitato ai propri clienti.', is_system: true }
  ];

  const DEFAULT_CLIENTS = [
    { id: 'default-client', name: 'Default Client', slug: 'default-client', status: 'active' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch users with their client relationships
      const [usersResult, clientsResult, rolesResult] = await Promise.all([
        supabase
          .from('users')
          .select(`
            *,
            client:clients(*),
            user_clients(client_id, client:clients(*))
          `)
          .order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('name'),
        supabase.from('role_definitions').select('*').order('role_key'),
      ]);

      // Handle Users
      if (usersResult.data) setUsers(usersResult.data);

      // Handle Clients with fallback
      let clientsData = clientsResult.data || [];
      if (clientsData.length === 0) {
        console.warn("No clients found. Using default client fallback.");
        clientsData = DEFAULT_CLIENTS;
      }
      setClients(clientsData as Client[]);

      // Handle Roles with fallback
      let rolesData = rolesResult.data || [];
      if (rolesData.length === 0) rolesData = DEFAULT_ROLES;
      setRoleDefinitions(rolesData);

      // Attempt auto-seed if seemingly empty (in background, don't block UI)
      if (rolesResult.data?.length === 0 || clientsResult.data?.length === 0) {
        logInfo('Attempting to seed default data in background...');
        fetch('/.netlify/functions/seed-data', { method: 'POST' }).catch(e => console.error("Background seed failed", e));
      }

    } catch (error: any) {
      console.error('Error fetching data:', error);
      setErrorMessage(`Fatal Error fetching users: ${error.message || JSON.stringify(error)}`);
      // logging to server
      await logError('UsersPage Fetch Error', { error: error.message });

      // Ensure UI still works even on error (fallback)
      setClients(prev => prev.length === 0 ? DEFAULT_CLIENTS as any : prev);
      setRoleDefinitions(prev => prev.length === 0 ? DEFAULT_ROLES : prev);
    } finally {
      setLoading(false);
    }
  };

  const getRoleDescription = (roleKey: string) => {
    const roleObj = roleDefinitions.find(r => r.role_key === roleKey) || DEFAULT_ROLES.find(r => r.role_key === roleKey);
    return roleObj ? roleObj.description : '';
  };

  const downloadTemplate = () => {
    const headers = ['email', 'name', 'client_names', 'role', 'level', 'job_title'];
    const example = ['user@example.com', 'Mario Rossi', 'Moca Interactive; Altro Cliente', 'user', '1', 'SEO Specialist'];
    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(',') + "\n"
      + example.join(',');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_utenti.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    return lines.slice(1).filter(line => line.trim()).map(line => {
      // Simple CSV parser checking for quotes
      const values: string[] = [];
      let inQuotes = false;
      let currentValue = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      return headers.reduce((obj, header, index) => {
        obj[header] = values[index]?.replace(/^"|"$/g, '') || ''; // Remove surrounding quotes
        return obj;
      }, {} as any);
    });
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    setImportProgress({ current: 0, total: 0, errors: [] });
    const errors: string[] = [];

    try {
      const text = await importFile.text();
      const rows = parseCSV(text);
      setImportProgress({ current: 0, total: rows.length, errors: [] });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // Map client names to IDs
          const clientNames = row.client_names?.split(';').map((n: string) => n.trim()) || [];
          const clientIds = clientNames.map((name: string) => {
            const client = clients.find(c => c.name.toLowerCase() === name.toLowerCase());
            if (!client) throw new Error(`Cliente non trovato: ${name}`);
            return client.id;
          });

          if (clientIds.length === 0) throw new Error('Nessun cliente specificato');

          // Call API
          const { error } = await createUserApi({
            email: row.email,
            name: row.name,
            client_ids: clientIds,
            role: (row.role || 'user') as UserRole,
            level: 1,
            job_title: row.job_title,
            send_invite: true
          });

          if (error) throw new Error(error);

        } catch (err: any) {
          errors.push(`Riga ${i + 2} (${row.email}): ${err.message}`);
        }

        setImportProgress(prev => prev ? { ...prev, current: i + 1, errors: [...errors] } : null);
      }

      if (errors.length === 0) {
        setSuccessMessage(`Importati ${rows.length} utenti con successo`);
        setShowImportModal(false);
        setImportFile(null);
        fetchData();
      } else {
        // Keep modal open to show errors
        setImportProgress(prev => prev ? { ...prev, errors } : null);
      }

    } catch (error: any) {
      setErrorMessage('Errore lettura file: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (editingUser) {
        // Editing existing user - update user record
        const { error: updateError } = await supabase
          .from('users')
          .update({
            name: formData.name,
            job_title: formData.job_title || null,
            role: formData.role,
            status: formData.status,
          })
          .eq('id', editingUser.id);

        if (updateError) throw updateError;

        // Update user_clients relationships
        // First delete existing relationships
        await supabase
          .from('user_clients')
          .delete()
          .eq('user_id', editingUser.id);

        // Then insert new ones
        if (formData.client_ids.length > 0) {
          const userClientsData = formData.client_ids.map(clientId => ({
            user_id: editingUser.id,
            client_id: clientId,
          }));

          await supabase
            .from('user_clients')
            .insert(userClientsData);
        }

        setSuccessMessage('Utente aggiornato con successo');
        await logInfo(`User updated: ${editingUser.email}`, {
          updated_user_id: editingUser.id,
          changes: formData
        });
      } else {
        // Creating new user - use Netlify function to create in Auth + DB
        const { data, error } = await createUserApi({
          email: formData.email,
          name: formData.name,
          client_ids: formData.client_ids,
          role: formData.role,
          level: 1,
          job_title: formData.job_title || undefined,
          status: formData.status,
          send_invite: sendInvite,
        });

        if (error) {
          setErrorMessage(error);
          setSubmitting(false);
          await logError(`Failed to create user: ${formData.email}`, { error });
          return;
        }

        // If created with default password, show it to the admin
        if (data?.temp_password) {
          setTempPasswordInfo({ email: formData.email, password: data.temp_password });
        }

        setSuccessMessage(data?.message || 'Utente creato con successo');
        await logInfo(`User created: ${formData.email}`, {
          new_user_email: formData.email,
          role: formData.role,
          client_ids: formData.client_ids
        });

        // If temp password was generated, keep modal open so admin can copy it
        // Otherwise close after a short delay
        if (data?.temp_password) {
          setSubmitting(false);
          return;
        }
      }

      // Close modal for edit or for invite-based creation
      setTimeout(() => {
        setShowModal(false);
        setEditingUser(null);
        setSendInvite(true);
        setTempPasswordInfo(null);
        setFormData({
          client_ids: [],
          email: '',
          name: '',
          job_title: '',
          role: 'specialist',
          status: 'active',
        });
        setSuccessMessage(null);
        fetchData();
      }, 1500);
    } catch (error: any) {
      setErrorMessage(error.message || 'Errore durante l\'operazione');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo utente? Questa azione è irreversibile.')) return;

    setDeleting(id);
    try {
      // Use the delete-user API to sync with Supabase Auth
      const { error } = await deleteUserApi(id);

      if (error) {
        throw new Error(error);
      }

      fetchData();
    } catch (error: any) {
      alert(error.message || 'Errore durante l\'eliminazione');
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (user: UserWithClients) => {
    setEditingUser(user);

    // Get client IDs from user_clients relationship
    const clientIds = user.user_clients?.map(uc => uc.client_id) ||
      (user.client_id ? [user.client_id] : []);

    setFormData({
      client_ids: clientIds,
      email: user.email,
      name: user.name,
      job_title: user.job_title || '',
      role: user.role,
      status: user.status,
    });
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingUser(null);
    setFormData({
      client_ids: isManager && userData?.client_id ? [userData.client_id] : [],
      email: '',
      name: '',
      job_title: '',
      role: 'user',
      level: 1,
      status: 'active',
    });
    setShowModal(true);
  };

  const toggleClientSelection = (clientId: string) => {
    setFormData(prev => ({
      ...prev,
      client_ids: prev.client_ids.includes(clientId)
        ? prev.client_ids.filter(id => id !== clientId)
        : [...prev.client_ids, clientId]
    }));
  };

  // Get client names for a user
  const getUserClientNames = (user: UserWithClients): string => {
    if (user.user_clients && user.user_clients.length > 0) {
      return user.user_clients.map(uc => uc.client?.name).filter(Boolean).join(', ');
    }
    return user.client?.name || '-';
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.job_title && user.job_title.toLowerCase().includes(searchTerm.toLowerCase()));

    // Check if user is associated with the filtered client
    const userClientIds = user.user_clients?.map(uc => uc.client_id) || [user.client_id];
    const matchesClient = !filterClient || userClientIds.includes(filterClient);

    const matchesRole = !filterRole || user.role === filterRole;
    return matchesSearch && matchesClient && matchesRole;
  });

  if (loading) {
    return <div className="text-center py-8">Caricamento utenti...</div>;
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {errorMessage}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <span className="sr-only">Dismiss</span>
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-moca-black">Utenti</h1>
          <p className="text-moca-gray mt-1">Gestisci account utente e permessi</p>
        </div>
        {canManageUsers && (
          <div className="flex space-x-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-2 bg-moca-black text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
            >
              <Upload size={20} />
              <span>Importa CSV</span>
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center space-x-2 bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
            >
              <Plus size={20} />
              <span>Aggiungi utente</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-lg border border-moca-red-light space-y-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-moca-gray"
            size={20}
          />
          <input
            type="text"
            placeholder="Cerca utenti..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-moca-gray mb-1">
              Filtra per cliente
            </label>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full px-3 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red text-sm"
            >
              <option value="">Tutti i clienti</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-semibold text-moca-gray mb-1">
              Filtra per ruolo
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red text-sm"
            >
              <option value="">Tutti i ruoli</option>
              <option value="super_admin">Super Admin</option>
              <option value="manager">Manager</option>
              <option value="specialist">Specialist</option>
              <option value="external">Esterno</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-moca-red-light shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-moca-red-light">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-moca-black uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-moca-black uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-moca-black uppercase tracking-wider">
                  Clienti
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-moca-black uppercase tracking-wider">
                  Ruolo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-moca-black uppercase tracking-wider">
                  Stato
                </th>
                {canManageUsers && (
                  <th className="px-6 py-3 text-left text-xs font-semibold text-moca-black uppercase tracking-wider">
                    Azioni
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageUsers ? 6 : 5}
                    className="px-6 py-8 text-center text-moca-gray"
                  >
                    Nessun utente trovato
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-moca-black">{user.name}</div>
                        {user.job_title && (
                          <div className="text-xs text-moca-gray">{user.job_title}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-moca-gray">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-moca-gray">
                      <div className="max-w-xs truncate" title={getUserClientNames(user)}>
                        {getUserClientNames(user)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                          user.role === 'specialist' ? 'bg-green-100 text-green-800' :
                            'bg-orange-100 text-orange-800'
                        }`}>
                        {user.role === 'super_admin' ? 'Super Admin' :
                          user.role === 'manager' ? 'Manager' :
                            user.role === 'specialist' ? 'Specialist' :
                              'Esterno'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : user.status === 'inactive'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-red-100 text-red-800'
                          }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    {canManageUsers && (
                      <td className="px-6 py-4 text-sm">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-moca-red hover:text-moca-black transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="text-moca-black hover:text-moca-red transition-colors disabled:opacity-50"
                              disabled={deleting === user.id}
                            >
                              {deleting === user.id ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-moca-black mb-4">
              {editingUser ? 'Modifica utente' : 'Aggiungi utente'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Multi-client selection */}
              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  Clienti assegnati *
                </label>
                <div className="border border-moca-gray rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {clients.length === 0 ? (
                    <p className="text-sm text-moca-gray italic p-2">Nessun cliente disponibile</p>
                  ) : (
                    clients.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                      /* onClick removed to avoid conflict with label/input */
                      >
                        <input
                          type="checkbox"
                          id={`client-${client.id}`}
                          checked={formData.client_ids.includes(client.id)}
                          /* onChange handled below */
                          className="h-4 w-4 text-moca-red focus:ring-moca-red border-gray-300 rounded cursor-pointer"
                          disabled={isManager && !userData?.client_id}
                          onChange={() => {
                            if (!isManager || userData?.client_id) {
                              toggleClientSelection(client.id);
                            }
                          }}
                        />
                        <label
                          htmlFor={`client-${client.id}`}
                          className="ml-2 text-sm text-moca-black cursor-pointer flex-1"
                        >
                          {client.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {formData.client_ids.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Seleziona almeno un cliente</p>
                )}
                {formData.client_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.client_ids.map(id => {
                      const client = clients.find(c => c.id === id);
                      return client ? (
                        <span key={id} className="inline-flex items-center px-2 py-1 bg-moca-red-light text-moca-red text-xs rounded-full">
                          {client.name}
                          <button
                            type="button"
                            onClick={() => toggleClientSelection(id)}
                            className="ml-1 hover:text-moca-black"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-semibold text-moca-black mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-moca-black mb-2">
                  Nome *
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
                  Ruolo in azienda
                </label>
                <input
                  type="text"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                  placeholder="es. SEO Specialist, ADV Manager, Team Leader..."
                />
              </div>

              <div>
                <div>
                  <label className="block text-sm font-semibold text-moca-black mb-2">
                    Ruolo *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value as UserRole })
                    }
                    className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                    disabled={!isSuperAdmin}
                  >
                    {roleDefinitions.length > 0 ? (
                      roleDefinitions.map(role => (
                        <option key={role.role_key} value={role.role_key}>
                          {role.display_name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="super_admin">Super Admin</option>
                        <option value="manager">Manager</option>
                        <option value="specialist">Specialist</option>
                        <option value="external">Esterno</option>
                      </>
                    )}
                  </select>

                  {/* Dynamic Role Description */}
                  <div className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-100 text-moca-gray">
                    {getRoleDescription(formData.role)}
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
                    setFormData({ ...formData, status: e.target.value as EntityStatus })
                  }
                  className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                >
                  <option value="active">Attivo</option>
                  <option value="inactive">Inattivo</option>
                  <option value="suspended">Sospeso</option>
                </select>
              </div>

              {/* Account creation mode - only for new users */}
              {!editingUser && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-moca-black mb-2">
                    Modalità di creazione account
                  </label>
                  <div
                    onClick={() => setSendInvite(true)}
                    className={`flex items-start p-3 rounded-md border-2 cursor-pointer transition-colors ${
                      sendInvite ? 'border-moca-red bg-moca-red-light' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="creation_mode"
                      checked={sendInvite}
                      onChange={() => setSendInvite(true)}
                      className="mt-0.5 mr-3 h-4 w-4 text-moca-red focus:ring-moca-red border-gray-300"
                    />
                    <div>
                      <div className="flex items-center">
                        <Mail size={16} className="mr-2 text-moca-red" />
                        <span className="text-sm font-semibold text-moca-black">Invia email di invito</span>
                      </div>
                      <p className="text-xs text-moca-gray mt-1">
                        L'utente riceverà un'email con un link per configurare autonomamente la propria password
                      </p>
                    </div>
                  </div>
                  <div
                    onClick={() => setSendInvite(false)}
                    className={`flex items-start p-3 rounded-md border-2 cursor-pointer transition-colors ${
                      !sendInvite ? 'border-moca-red bg-moca-red-light' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="creation_mode"
                      checked={!sendInvite}
                      onChange={() => setSendInvite(false)}
                      className="mt-0.5 mr-3 h-4 w-4 text-moca-red focus:ring-moca-red border-gray-300"
                    />
                    <div>
                      <div className="flex items-center">
                        <Key size={16} className="mr-2 text-moca-red" />
                        <span className="text-sm font-semibold text-moca-black">Crea con password temporanea</span>
                      </div>
                      <p className="text-xs text-moca-gray mt-1">
                        Verrà generata una password temporanea da comunicare all'utente. Al primo accesso dovrà cambiarla obbligatoriamente.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Temp password display */}
              {tempPasswordInfo && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-md">
                  <div className="flex items-center mb-2">
                    <Key size={18} className="mr-2 text-amber-600" />
                    <span className="text-sm font-bold text-amber-800">Password temporanea generata</span>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">
                    Comunica queste credenziali all'utente. La password non sarà più visibile dopo la chiusura.
                  </p>
                  <div className="bg-white rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-moca-gray">Email:</span>
                      <span className="text-sm font-mono font-semibold text-moca-black">{tempPasswordInfo.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-moca-gray">Password:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono font-semibold text-moca-black">{tempPasswordInfo.password}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(tempPasswordInfo.password);
                          }}
                          className="text-moca-gray hover:text-moca-red transition-colors"
                          title="Copia password"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 mt-2 font-medium">
                    L'utente dovrà cambiare la password al primo accesso.
                  </p>
                </div>
              )}

              {/* Success/Error messages */}
              {successMessage && !tempPasswordInfo && (
                <div className="flex items-center p-3 bg-green-100 text-green-800 rounded-md">
                  <CheckCircle size={18} className="mr-2 flex-shrink-0" />
                  <span className="text-sm">{successMessage}</span>
                </div>
              )}
              {errorMessage && (
                <div className="flex items-center p-3 bg-red-100 text-red-800 rounded-md">
                  <AlertCircle size={18} className="mr-2 flex-shrink-0" />
                  <span className="text-sm">{errorMessage}</span>
                </div>
              )}

              <div className="flex space-x-3 mt-6">
                {tempPasswordInfo ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingUser(null);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setSendInvite(true);
                      setTempPasswordInfo(null);
                      setFormData({
                        client_ids: [],
                        email: '',
                        name: '',
                        job_title: '',
                        role: 'user',
                        level: 1,
                        status: 'active',
                      });
                      fetchData();
                    }}
                    className="flex-1 bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity font-semibold"
                  >
                    Ho copiato, chiudi
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setEditingUser(null);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                        setTempPasswordInfo(null);
                      }}
                      className="flex-1 bg-moca-red-light text-moca-red px-4 py-2 rounded-md hover:bg-moca-red hover:text-white transition-colors"
                      disabled={submitting}
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-moca-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      disabled={submitting || formData.client_ids.length === 0}
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {editingUser ? 'Aggiornando...' : 'Creando...'}
                        </>
                      ) : (
                        editingUser ? 'Aggiorna' : 'Crea utente'
                      )}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold text-moca-black mb-4">
              Importa utenti da CSV
            </h2>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                <h3 className="text-sm font-bold text-moca-black mb-2 flex items-center">
                  <FileText size={16} className="mr-2" />
                  Formato CSV Richiesto
                </h3>
                <p className="text-xs text-moca-gray mb-3">
                  Il file deve contenere le seguenti colonne: email, name, client_names (separati da ;), role, level, job_title.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center text-xs text-moca-red hover:underline"
                >
                  <Download size={12} className="mr-1" />
                  Scarica modello di esempio
                </button>
              </div>

              {!importing ? (
                <form onSubmit={handleImport} className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-moca-red transition-colors">
                    <input
                      type="file"
                      id="csvFile"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="csvFile" className="cursor-pointer flex flex-col items-center">
                      <Upload size={32} className="text-moca-gray mb-2" />
                      <span className="text-sm font-medium text-moca-black">
                        {importFile ? importFile.name : 'Clicca per caricare il file CSV'}
                      </span>
                    </label>
                  </div>

                  {errorMessage && (
                    <div className="p-3 bg-red-100 text-red-800 rounded-md text-sm flex items-center">
                      <AlertCircle size={16} className="mr-2" />
                      {errorMessage}
                    </div>
                  )}

                  <div className="flex space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowImportModal(false);
                        setImportFile(null);
                        setErrorMessage(null);
                      }}
                      className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      disabled={!importFile}
                      className="flex-1 bg-moca-black text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Importa
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 text-center py-4">
                  <Loader size={32} className="animate-spin text-moca-red mx-auto" />
                  <div>
                    <p className="font-semibold text-moca-black">Importazione in corso...</p>
                    {importProgress && (
                      <p className="text-sm text-moca-gray mt-1">
                        Elaborazione {importProgress.current} di {importProgress.total}
                      </p>
                    )}
                  </div>

                  {importProgress?.errors && importProgress.errors.length > 0 && (
                    <div className="mt-4 text-left bg-red-50 p-3 rounded-md max-h-40 overflow-y-auto">
                      <p className="text-xs font-bold text-red-800 mb-2">Errori rilevati:</p>
                      <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                        {importProgress.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => setImporting(false)}
                        className="mt-2 text-xs text-moca-black underline"
                      >
                        Indietro
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
