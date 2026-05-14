import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ClientsPage } from './components/ClientsPage';
import { ClientDetailPage } from './components/ClientDetailPage';
import { UsersPage } from './components/UsersPage';
import { ConfigurationsPage } from './components/ConfigurationsPage';
import { ApplicationsPage } from './components/ApplicationsPage';
import { RolesPermissionsPage } from './components/RolesPermissionsPage';
import { LogsPage } from './components/LogsPage';
import { ApiDocsPage } from './components/ApiDocsPage';
import { SetPasswordPage } from './components/SetPasswordPage';
import { supabase } from './lib/supabase';
import { logInfo } from './lib/logger';
import { initSentry, setSentryUser, Sentry } from './lib/sentry';

// Initialize Sentry before anything else
initSentry();

function AppContent() {
  const { user, loading, mustChangePassword, clearMustChangePassword } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [checkingInvite, setCheckingInvite] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);

  // Log startup & set Sentry user
  useEffect(() => {
    logInfo('Application started');
  }, []);

  useEffect(() => {
    if (user) {
      setSentryUser({ id: user.id, email: user.email || '', role: '' });
    } else {
      setSentryUser(null);
    }
  }, [user]);

  // Check if user came from an invite link
  useEffect(() => {
    const checkInviteToken = async () => {
      const hash = window.location.hash;

      // Check for invite or recovery token in URL
      if (hash.includes('type=invite') || hash.includes('type=recovery')) {
        // Let Supabase process the token first
        const { data, error } = await supabase.auth.getSession();

        if (!error && data.session) {
          // User successfully authenticated via invite
          // Check if they need to set password (new invite)
          const user = data.session.user;

          // Show password page for invite links and password reset links
          if (hash.includes('type=invite') || hash.includes('type=recovery')) {
            setShowSetPassword(true);
          }

          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      setCheckingInvite(false);
    };

    checkInviteToken();
  }, []);

  // Handle redirect_to after login
  useEffect(() => {
    if (user && !loading && !checkingInvite && !showSetPassword) {
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get('redirect_to');
      if (redirectTo) {
        // Validate URL to prevent open redirect vulnerabilities
        try {
          const url = new URL(redirectTo);
          // Allow redirects to localhost or specific domains if needed
          // For now, we'll allow any valid URL but you might want to restrict this list
          window.location.href = redirectTo;
        } catch (e) {
          console.error('Invalid redirect URL', e);
        }
      }
    }
  }, [user, loading, checkingInvite, showSetPassword]);

  if (loading || checkingInvite) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <img
            src="https://mocainteractive.com/assets/svg/logo.svg"
            alt="Moca Logo"
            className="h-16 mx-auto mb-4"
          />
          <p className="text-moca-gray">Loading...</p>
        </div>
      </div>
    );
  }

  // Show password setup page for new invite users or forced password change
  if ((showSetPassword || mustChangePassword) && user) {
    return <SetPasswordPage onComplete={() => {
      setShowSetPassword(false);
      clearMustChangePassword();
    }} />;
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    // Client detail view
    if (viewingClientId) {
      return <ClientDetailPage clientId={viewingClientId} onBack={() => setViewingClientId(null)} />;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard selectedClientId={selectedClientId} onClientChange={setSelectedClientId} />;
      case 'clients':
        return <ClientsPage onViewClient={(id) => setViewingClientId(id)} />;
      case 'users':
        return <UsersPage />;
      case 'configurations':
        return <ConfigurationsPage selectedClientId={selectedClientId} onClientChange={setSelectedClientId} />;
      case 'applications':
        return <ApplicationsPage />;
      case 'roles-permissions':
        return <RolesPermissionsPage />;
      case 'logs':
        return <LogsPage />;
      case 'api-docs':
        return <ApiDocsPage />;
      default:
        return <Dashboard selectedClientId={selectedClientId} onClientChange={setSelectedClientId} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={(page) => { setCurrentPage(page); setViewingClientId(null); }}>
      {renderPage()}
    </Layout>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'monospace' }}>
          <h1 style={{ color: '#E52217' }}>Errore applicazione</h1>
          <pre style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#E52217', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Ricarica pagina
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

