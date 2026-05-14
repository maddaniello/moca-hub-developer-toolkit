import { useEffect, useState, useRef } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { Client } from '../lib/types';

interface ClientSelectorProps {
  clients: Client[];
  selectedClient: string;
  onSelect: (id: string) => void;
}

export function ClientSelector({ clients, selectedClient, onSelect }: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedClientObj = clients.find(c => c.id === selectedClient) || null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (clients.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-semibold text-moca-gray mb-2 uppercase tracking-wider">
        Cliente attivo
      </label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-white border-2 border-moca-red rounded-lg px-5 py-4 flex items-center justify-between hover:shadow-md transition-shadow"
      >
        <div className="flex items-center space-x-4">
          {selectedClientObj?.logo_url ? (
            <img
              src={selectedClientObj.logo_url}
              alt={selectedClientObj.name}
              className="w-12 h-12 object-contain rounded-lg border border-gray-200"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const next = (e.target as HTMLImageElement).nextElementSibling;
                if (next) (next as HTMLElement).classList.remove('hidden');
              }}
            />
          ) : null}
          {!selectedClientObj?.logo_url && (
            <div className="w-12 h-12 bg-moca-red-light rounded-lg flex items-center justify-center">
              <Building2 size={24} className="text-moca-red" />
            </div>
          )}
          <div className="text-left">
            <p className="text-lg font-bold text-moca-black">
              {selectedClientObj?.name || 'Seleziona un cliente'}
            </p>
            {selectedClientObj?.email && (
              <p className="text-sm text-moca-gray">{selectedClientObj.email}</p>
            )}
          </div>
        </div>
        <ChevronDown size={24} className={`text-moca-gray transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => {
                onSelect(client.id);
                setOpen(false);
              }}
              className={`w-full flex items-center space-x-4 px-5 py-3 hover:bg-moca-red-light transition-colors text-left ${
                client.id === selectedClient ? 'bg-moca-red-light border-l-4 border-moca-red' : ''
              }`}
            >
              {client.logo_url ? (
                <img
                  src={client.logo_url}
                  alt={client.name}
                  className="w-10 h-10 object-contain rounded-lg border border-gray-200 flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-moca-gray" />
                </div>
              )}
              <div>
                <p className="font-semibold text-moca-black">{client.name}</p>
                {client.email && (
                  <p className="text-xs text-moca-gray">{client.email}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
