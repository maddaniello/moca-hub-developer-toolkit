import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogLevel } from '../lib/types';
import { logInfo, logWarning, logError } from '../lib/logger';
import { AlertCircle, Info, AlertTriangle, Search, RefreshCw, Trash2, User as UserIcon } from 'lucide-react';

export function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]); // Use any to allow joined user data
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<LogLevel | ''>('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchLogs();

    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchLogs = async () => {
    try {
      // Attempt to join with users table to get names
      // If FK missing, this might fail, fallback to simple select
      const { data, error } = await supabase
        .from('logs')
        .select(`
            *,
            user:users ( name, email )
        `)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) {
        // Fallback if relation doesn't exist
        console.warn("Could not join users, falling back", error);
        const simple = await supabase
          .from('logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(100);
        if (simple.error) throw simple.error;
        setLogs(simple.data || []);
      } else {
        setLogs(data || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTestLog = async (level: LogLevel) => {
    try {
      if (level === 'info') await logInfo(`Test info message`, { test: true });
      if (level === 'warning') await logWarning(`Test warning message`, { test: true });
      if (level === 'error') await logError(`Test error message`, { test: true });
      setTimeout(fetchLogs, 500);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Sei sicuro di voler cancellare TUTTI i log? Questa azione non può essere annullata.'))
      return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/.netlify/functions/manage-logs', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ all: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore cancellazione log');
      }

      // Add a log entry that logs were cleared (frontend side or rely on backend doing it)
      // Backend does it.

      // Refresh
      setTimeout(() => {
        fetchLogs();
        alert('Log cancellati con successo.');
      }, 500);

    } catch (error: any) {
      alert(`Errore: ${error.message}`);
    }
  };

  const clearSingleLog = async (id: string) => {
    if (!confirm('Cancellare questo log?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/.netlify/functions/manage-logs', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore');
      }
      fetchLogs();
    } catch (error: any) {
      alert(`Errore: ${error.message}`);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.data || {}).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = !filterLevel || log.level === filterLevel;
    return matchesSearch && matchesLevel;
  });

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'info': return <Info size={18} className="text-blue-600" />;
      case 'warning': return <AlertTriangle size={18} className="text-yellow-600" />;
      case 'error': return <AlertCircle size={18} className="text-red-600" />;
      default: return <Info size={18} className="text-gray-600" />;
    }
  };

  const getLevelBadge = (level: LogLevel) => {
    const styles = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-sm ${styles[level] || 'bg-gray-100 text-gray-800'}`}>
        {level}
      </span>
    );
  };

  // Helper to format data "parlante"
  const formatData = (data: any) => {
    if (!data) return null;
    // If it's empty object
    if (typeof data === 'object' && Object.keys(data).length === 0) return null;

    return (
      <div className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-100 font-mono overflow-x-auto">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="text-gray-500 font-semibold">{key}:</span>
            <span className="text-gray-800 whitespace-pre-wrap">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento log...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-moca-black">Log & Debug</h1>
          <p className="text-moca-gray mt-1">Stato del sistema e diagnosi errori</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${autoRefresh
              ? 'bg-moca-red text-white'
              : 'bg-moca-red-light text-moca-red hover:bg-moca-red hover:text-white'
              }`}
          >
            <RefreshCw size={18} className={autoRefresh ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{autoRefresh ? 'Auto ON' : 'Auto OFF'}</span>
          </button>
          <button
            onClick={clearLogs}
            className="flex items-center space-x-2 bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-black transition-colors"
          >
            <Trash2 size={18} />
            <span className="hidden sm:inline">Svuota tutto</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-moca-red-light space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-moca-gray" size={20} />
            <input
              type="text"
              placeholder="Cerca messaggi, dati, utenti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red"
            />
          </div>

          <div className="flex gap-2">
            {['', 'info', 'warning', 'error'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl as LogLevel | '')}
                className={`px-3 py-1 text-sm rounded-full capitalize transition-colors ${filterLevel === lvl
                  ? (lvl === '' ? 'bg-gray-800 text-white' : lvl === 'info' ? 'bg-blue-600 text-white' : lvl === 'warning' ? 'bg-yellow-600 text-white' : 'bg-red-600 text-white')
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {lvl || 'Tutti'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Test Buttons Area - Collapsed or Small */}
      <div className="flex gap-2 text-xs text-gray-500 items-center justify-end">
        <span>Test:</span>
        <button onClick={() => addTestLog('info')} className="hover:text-blue-600 underline">Info</button>
        <button onClick={() => addTestLog('warning')} className="hover:text-yellow-600 underline">Warn</button>
        <button onClick={() => addTestLog('error')} className="hover:text-red-600 underline">Error</button>
      </div>

      <div className="bg-white rounded-lg border border-moca-red-light shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-200">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-moca-gray">Nessun log trovato.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className={`p-4 hover:bg-gray-50 transition-all border-l-4 ${log.level === 'error' ? 'border-l-red-500 bg-red-50/30' :
                log.level === 'warning' ? 'border-l-yellow-500' : 'border-l-transparent'
                }`}>
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getLevelIcon(log.level)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {getLevelBadge(log.level)}
                      <span className="text-xs text-gray-500 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      {log.user && (
                        <div className="flex items-center gap-1 text-xs text-moca-black bg-gray-100 px-2 py-0.5 rounded-full">
                          <UserIcon size={10} />
                          {log.user.name || log.user.email}
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-gray-900 font-medium">{log.message}</p>

                    {/* Render Data if present in a readable way */}
                    {formatData(log.data)}
                  </div>

                  <button
                    onClick={() => clearSingleLog(log.id)}
                    className="text-gray-300 hover:text-red-500 p-1"
                    title="Elimina riga"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
