import { ReactNode, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  AppWindow,
  FileText,
  Menu,
  X,
  LogOut,
  Terminal,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { userData, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isSuperAdmin = userData?.role === 'super_admin';
  const isManager = userData?.role === 'manager';
  const isExternal = userData?.role === 'external';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(!isExternal ? [
      { id: 'clients', label: 'Clienti', icon: Building2 },
    ] : []),
    ...(isSuperAdmin || isManager ? [
      { id: 'users', label: 'Utenti', icon: Users },
    ] : []),
    ...(!isExternal ? [
      { id: 'configurations', label: 'Configurazioni', icon: Settings },
    ] : []),
    ...(isSuperAdmin || isManager ? [
      { id: 'applications', label: 'Applicazioni', icon: AppWindow },
    ] : []),
    ...(isSuperAdmin ? [
      { id: 'roles-permissions', label: 'Ruoli e permessi', icon: Settings },
      { id: 'logs', label: 'Log e debug', icon: Terminal },
      { id: 'api-docs', label: 'Documentazione API', icon: FileText },
    ] : []),
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-moca-black text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md hover:bg-moca-red transition-colors"
              >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

              <img
                src="https://mocainteractive.com/assets/svg/logo-light.svg"
                alt="Moca Logo"
                className="h-8"
              />

              <span className="text-xl font-bold hidden sm:block">Hub</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{userData?.name}</p>
                <p className="text-xs text-gray-300">{
                  userData?.role === 'super_admin' ? 'Super Admin' :
                  userData?.role === 'manager' ? 'Manager' :
                  userData?.role === 'specialist' ? 'Specialist' :
                  userData?.role === 'external' ? 'Esterno' :
                  userData?.role
                }</p>
              </div>

              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-moca-red transition-colors"
              >
                <LogOut size={20} />
                <span className="hidden sm:inline">Esci</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside
          className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out mt-16 lg:mt-0`}
        >
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md transition-colors ${currentPage === item.id
                    ? 'bg-moca-red-light text-moca-red border border-moca-red'
                    : 'text-moca-black hover:bg-gray-100'
                    }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
