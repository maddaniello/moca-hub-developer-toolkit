import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Building2, AppWindow, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { User, Client, Application, ApplicationCategory } from '../lib/types';
import { generateLaunchToken } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { ClientSelector } from './ClientSelector';

interface DashboardProps {
  selectedClientId: string;
  onClientChange: (id: string) => void;
}

interface Stats {
  totalClients: number;
  totalUsers: number;
  totalApplications: number;
}

interface RecentLogin extends Omit<User, 'client'> {
  client: { name: string };
}

export function Dashboard({ selectedClientId, onClientChange }: DashboardProps) {
  const { userData } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalUsers: 0,
    totalApplications: 0,
  });
  const [recentLogins, setRecentLogins] = useState<RecentLogin[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientConfigs, setClientConfigs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    fetchClients();
  }, []);

  // Fetch client configs whenever selectedClientId changes
  useEffect(() => {
    if (selectedClientId) {
      supabase
        .from('configurations')
        .select('config_key')
        .eq('client_id', selectedClientId)
        .then(({ data, error }) => {
          if (!error) {
            setClientConfigs((data || []).map(c => c.config_key));
          }
        });
    } else {
      setClientConfigs([]);
    }
  }, [selectedClientId]);

  const fetchDashboardData = async () => {
    try {
      const [clientsResult, usersResult, appsResult, recentLoginsResult] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('applications').select('id', { count: 'exact', head: true }),
        supabase
          .from('users')
          .select('*, client:clients(name)')
          .order('last_login', { ascending: false })
          .limit(5),
      ]);

      setStats({
        totalClients: clientsResult.count || 0,
        totalUsers: usersResult.count || 0,
        totalApplications: appsResult.count || 0,
      });

      setRecentLogins(recentLoginsResult.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      if (userData?.role === 'super_admin') {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('status', 'active')
          .order('name');

        if (error) throw error;
        setClients(data || []);
        if (data && data.length > 0 && !selectedClientId) {
          onClientChange(data[0].id);
        }
      } else if (userData) {
        const { data: userClients, error: ucError } = await supabase
          .from('user_clients')
          .select('client_id, client:clients(*)')
          .eq('user_id', userData.id);

        if (ucError) throw ucError;

        const clientList: Client[] = [];

        if (userClients) {
          for (const uc of userClients) {
            if (uc.client && typeof uc.client === 'object' && 'id' in uc.client) {
              clientList.push(uc.client as unknown as Client);
            }
          }
        }

        if (userData.client_id && !clientList.find(c => c.id === userData.client_id)) {
          const { data: legacyClient } = await supabase
            .from('clients')
            .select('*')
            .eq('id', userData.client_id)
            .single();

          if (legacyClient) {
            clientList.push(legacyClient);
          }
        }

        setClients(clientList);
        if (clientList.length > 0 && !selectedClientId) {
          onClientChange(clientList[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching clients', error);
    }
  };

  const statCards = [
    { label: 'Clienti totali', value: stats.totalClients, icon: Building2, color: 'text-blue-600' },
    { label: 'Utenti totali', value: stats.totalUsers, icon: Users, color: 'text-green-600' },
    { label: 'Applicazioni', value: stats.totalApplications, icon: AppWindow, color: 'text-purple-600' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-moca-gray">Caricamento dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-moca-black">Dashboard</h1>
        <p className="text-moca-gray mt-1">Benvenuto nel sistema di gestione Moca Hub</p>
      </div>

      {/* Client Selector - Prominent */}
      <ClientSelector
        clients={clients}
        selectedClient={selectedClientId}
        onSelect={onClientChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white p-6 rounded-lg border border-moca-red-light shadow-sm hover:border-moca-red transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-moca-gray font-medium">{card.label}</p>
                  <p className="text-3xl font-bold text-moca-black mt-2">{card.value}</p>
                </div>
                <div className={`${card.color}`}>
                  <Icon size={40} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <MyApplications selectedClient={selectedClientId} configuredKeys={clientConfigs} />

      <div className="bg-white rounded-lg border border-moca-red-light shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-moca-black">Accessi recenti</h2>
        </div>
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
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-moca-black uppercase tracking-wider">
                  Ruolo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-moca-black uppercase tracking-wider">
                  Ultimo accesso
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentLogins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-moca-gray">
                    Nessun accesso recente
                  </td>
                </tr>
              ) : (
                recentLogins.map((user, index) => (
                  <tr
                    key={user.id}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-moca-black">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-moca-gray">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-moca-gray">{user.client?.name}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-moca-red-light text-moca-red">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-moca-gray">
                      {user.last_login
                        ? new Date(user.last_login).toLocaleString()
                        : 'Mai'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const LLM_KEYS = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY'];

function checkAppRequirements(requiredKeys: string[] | null | undefined, configuredKeys: string[] | null | undefined): { satisfied: boolean; missing: string[] } {
  if (!requiredKeys || requiredKeys.length === 0) return { satisfied: true, missing: [] };
  const keys = configuredKeys || [];

  const missing: string[] = [];
  for (const key of requiredKeys) {
    if (key === 'ANY_LLM') {
      if (!LLM_KEYS.some(k => keys.includes(k))) {
        missing.push('Almeno un LLM (OpenAI, Gemini o Anthropic)');
      }
    } else {
      if (!keys.includes(key)) {
        missing.push(key);
      }
    }
  }
  return { satisfied: missing.length === 0, missing };
}

function MyApplications({ selectedClient, configuredKeys }: { selectedClient: string; configuredKeys: string[] }) {
  const { userData } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [categories, setCategories] = useState<ApplicationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    fetchApps();
    fetchCategories();
  }, [selectedClient, userData]);

  const fetchApps = async () => {
    try {
      // Super admins see all active apps
      if (userData?.role === 'super_admin') {
        const { data, error } = await supabase
          .from('applications')
          .select('*, category:application_categories(*)')
          .eq('status', 'active')
          .order('name');

        if (error) throw error;
        setApps(data || []);
      } else {
        // Other roles: fetch apps they have access to via application_access
        const { data: accessRecords, error: accessError } = await supabase
          .from('application_access')
          .select('application_id');

        if (accessError) throw accessError;

        const accessibleAppIds = [...new Set((accessRecords || []).map(r => r.application_id))];

        if (accessibleAppIds.length === 0) {
          setApps([]);
        } else {
          const { data, error } = await supabase
            .from('applications')
            .select('*, category:application_categories(*)')
            .eq('status', 'active')
            .in('id', accessibleAppIds)
            .order('name');

          if (error) throw error;
          setApps(data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching apps', error);
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
      console.error('Error fetching categories', error);
    }
  };

  const handleLaunchApp = async (app: Application) => {
    if (!selectedClient) {
      alert('Seleziona un cliente prima di aprire l\'applicazione');
      return;
    }

    setLaunching(app.id);

    try {
      const { data, error } = await generateLaunchToken({
        client_id: selectedClient,
        application_id: app.id,
      });

      if (error || !data) {
        throw new Error(error || 'Failed to generate launch token');
      }

      window.open(data.redirect_url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      console.error('Launch error:', error);
      alert('Errore nell\'apertura dell\'applicazione: ' + error.message);
    } finally {
      setLaunching(null);
    }
  };

  if (loading) return null;
  if (apps.length === 0) return null;

  const groupedApps: { category: ApplicationCategory | null; apps: Application[] }[] = [];

  for (const cat of categories) {
    const catApps = apps.filter(a => a.category_id === cat.id);
    if (catApps.length > 0) {
      groupedApps.push({ category: cat, apps: catApps });
    }
  }

  const uncategorized = apps.filter(a => !a.category_id);
  if (uncategorized.length > 0) {
    groupedApps.push({ category: null, apps: uncategorized });
  }

  const showAsFlat = categories.length === 0;

  return (
    <div className="bg-white rounded-lg border border-moca-red-light shadow-sm p-6">
      <h2 className="text-xl font-bold text-moca-black mb-4">Le mie applicazioni</h2>

      {!selectedClient && (
        <div className="text-sm text-moca-gray bg-moca-red-light p-3 rounded-md mb-4">
          Seleziona un cliente per accedere alle applicazioni
        </div>
      )}

      {showAsFlat ? (
        <AppGrid apps={apps} selectedClient={selectedClient} launching={launching} onLaunch={handleLaunchApp} configuredKeys={configuredKeys} />
      ) : (
        <div className="space-y-6">
          {groupedApps.map((group, idx) => (
            <div key={group.category?.id || 'uncategorized'}>
              <h3 className="text-sm font-semibold text-moca-gray uppercase tracking-wider mb-3">
                {group.category?.name || 'Altre applicazioni'}
              </h3>
              <AppGrid apps={group.apps} selectedClient={selectedClient} launching={launching} onLaunch={handleLaunchApp} configuredKeys={configuredKeys} />
              {idx < groupedApps.length - 1 && <hr className="mt-6 border-gray-100" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppGrid({
  apps, selectedClient, launching, onLaunch, configuredKeys,
}: {
  apps: Application[]; selectedClient: string; launching: string | null; onLaunch: (app: Application) => void; configuredKeys: string[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {apps.map((app) => {
        const isLaunching = launching === app.id;
        const { satisfied, missing } = checkAppRequirements(app.required_api_keys, configuredKeys);
        const isDisabled = !selectedClient || isLaunching || !satisfied;

        return (
          <div key={app.id} className="relative group">
            <button
              onClick={() => satisfied && onLaunch(app)}
              disabled={isDisabled}
              className={`w-full flex flex-col p-4 rounded-lg border transition-all text-left ${
                satisfied
                  ? 'border-gray-200 hover:border-moca-red hover:shadow-md'
                  : 'border-orange-200 bg-orange-50 opacity-60 cursor-not-allowed'
              } disabled:cursor-not-allowed`}
            >
              <div className="flex items-center space-x-3 mb-2">
                {app.icon_url ? (
                  <img src={app.icon_url} alt={app.name} className={`w-10 h-10 object-contain flex-shrink-0 ${!satisfied ? 'grayscale' : ''}`} />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    satisfied ? 'bg-moca-red-light text-moca-red' : 'bg-orange-100 text-orange-400'
                  }`}>
                    <AppWindow size={20} />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <h3 className={`font-bold transition-colors truncate ${
                    satisfied ? 'text-moca-black group-hover:text-moca-red' : 'text-gray-400'
                  }`}>{app.name}</h3>
                  {!satisfied ? (
                    <AlertCircle size={18} className="text-orange-400 flex-shrink-0 ml-2" />
                  ) : isLaunching ? (
                    <Loader2 size={18} className="text-moca-red animate-spin flex-shrink-0 ml-2" />
                  ) : (
                    <ExternalLink size={18} className="text-moca-gray group-hover:text-moca-red transition-colors flex-shrink-0 ml-2" />
                  )}
                </div>
              </div>
              {app.description && <p className="text-sm text-moca-gray mt-1">{app.description}</p>}
              {!satisfied && missing.length > 0 && (
                <p className="text-xs text-orange-600 mt-2">
                  Mancano: {missing.join(', ')}
                </p>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
