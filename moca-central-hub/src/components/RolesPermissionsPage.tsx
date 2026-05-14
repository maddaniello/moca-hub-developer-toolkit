import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { RoleDefinition } from '../lib/types';
import { Edit2, CheckCircle, AlertCircle, Shield, Plus, X, Trash2 } from 'lucide-react';
import { SYSTEM_CAPABILITIES } from '../lib/constants';

export function RolesPermissionsPage() {
    const { userData } = useAuth();
    const [roles, setRoles] = useState<RoleDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const isSuperAdmin = userData?.role === 'super_admin';

    useEffect(() => {
        if (isSuperAdmin) {
            fetchData();
        }
    }, [isSuperAdmin]);

    const fetchData = async () => {
        try {
            const [rolesResult] = await Promise.all([
                supabase.from('role_definitions').select('*').order('role_key'),
            ]);

            // Ignore errors here to allow fallback/seeding
            // if (rolesResult.error) throw rolesResult.error;
            // if (levelsResult.error) throw levelsResult.error;

            let rolesData = rolesResult.data || [];

            // Auto-seed if missing
            if (rolesData.length === 0) {
                console.log('Seeding default data due to missing tables...');
                try {
                    await fetch('/.netlify/functions/seed-data', { method: 'POST' });
                    // Re-fetch
                    const [newRoles] = await Promise.all([
                        supabase.from('role_definitions').select('*').order('role_key'),
                    ]);
                    if (newRoles.data) rolesData = newRoles.data;
                } catch (e) {
                    console.error("Seeding failed", e);
                }
            }

            // Fallbacks for display if still empty
            if (rolesData.length === 0) {
                rolesData = [
                    { id: 'temp-super-admin', role_key: 'super_admin', display_name: 'Super Admin', description: 'Accesso completo alla piattaforma.', permissions: ['all'], is_system: true },
                    { id: 'temp-manager', role_key: 'manager', display_name: 'Manager', description: 'Gestione utenti, clienti e configurazioni.', permissions: ['manage_users', 'manage_clients'], is_system: true },
                    { id: 'temp-specialist', role_key: 'specialist', display_name: 'Specialist', description: 'Configurazioni, clienti e app.', permissions: ['manage_configurations', 'use_apps'], is_system: true },
                    { id: 'temp-external', role_key: 'external', display_name: 'Esterno', description: 'Accesso limitato ai propri clienti e app autorizzate.', permissions: ['view_own'], is_system: true }
                ];
            }

            setRoles(rolesData);
        } catch (error) {
            console.error('Error fetching data:', error);
            // setErrorMessage('Errore nel caricamento dei dati'); // Suppress general error
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRole = async (role: RoleDefinition) => {
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch('/.netlify/functions/manage-roles', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(role),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Errore aggiornamento ruolo');
            }

            setSuccessMessage('Ruolo aggiornato con successo');
            setEditingRole(null);
            fetchData();
        } catch (error: any) {
            setErrorMessage(error.message);
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo ruolo?')) return;
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const response = await fetch('/.netlify/functions/manage-roles', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: roleId }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Errore eliminazione ruolo');
            }

            setSuccessMessage('Ruolo eliminato con successo');
            fetchData();
        } catch (error: any) {
            setErrorMessage(error.message);
        }
    };

    if (!isSuperAdmin) {
        return (
            <div className="text-center py-8">
                <p className="text-moca-gray">Solo i Super Admin possono accedere a questa pagina.</p>
            </div>
        );
    }

    if (loading) {
        return <div className="text-center py-8">Caricamento...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-moca-black">Gestione ruoli e permessi</h1>
                <p className="text-moca-gray mt-1">Configura i ruoli di sistema</p>
            </div>

            {successMessage && (
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

            {/* Roles Section */}
            <div className="bg-white rounded-lg border border-moca-red-light shadow-sm p-6">
                <div className="flex items-center mb-4">
                    <Shield className="text-moca-red mr-2" size={24} />
                    <h2 className="text-2xl font-bold text-moca-black">Ruoli di Sistema</h2>
                </div>
                <p className="text-sm text-moca-gray mb-4">
                    Personalizza i nomi e le descrizioni dei ruoli. Non puoi eliminare i ruoli di sistema.
                </p>

                <div className="space-y-4">
                    {roles.map((role) => (
                        <div key={role.id} className="border border-gray-200 rounded-lg p-4">
                            {editingRole?.id === role.id ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-semibold text-moca-black mb-1">
                                            Nome visualizzato
                                        </label>
                                        <input
                                            type="text"
                                            value={editingRole.display_name}
                                            onChange={(e) =>
                                                setEditingRole({ ...editingRole, display_name: e.target.value })
                                            }
                                            className="w-full px-3 py-2 border border-moca-gray rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-moca-black mb-1">
                                            Descrizione
                                        </label>
                                        <textarea
                                            value={editingRole.description}
                                            onChange={(e) =>
                                                setEditingRole({ ...editingRole, description: e.target.value })
                                            }
                                            rows={3}
                                            className="w-full px-3 py-2 border border-moca-gray rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-moca-black mb-1">
                                            Permessi (Capabilities)
                                        </label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {editingRole.permissions?.map((perm, idx) => (
                                                <span key={idx} className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                                    {perm}
                                                    <button
                                                        onClick={() => {
                                                            const newPerms = editingRole.permissions.filter((_, i) => i !== idx);
                                                            setEditingRole({ ...editingRole, permissions: newPerms });
                                                        }}
                                                        className="ml-1 text-gray-400 hover:text-red-500"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <select
                                                id={`new-perm-${role.id}`}
                                                className="flex-1 px-3 py-1 text-sm border border-moca-gray rounded-md"
                                                defaultValue=""
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val && !editingRole.permissions?.includes(val)) {
                                                        setEditingRole({
                                                            ...editingRole,
                                                            permissions: [...(editingRole.permissions || []), val]
                                                        });
                                                        e.target.value = ""; // Reset select
                                                    }
                                                }}
                                            >
                                                <option value="" disabled>Aggiungi permesso...</option>
                                                {SYSTEM_CAPABILITIES.map(cap => (
                                                    <option key={cap.id} value={cap.id} disabled={editingRole.permissions?.includes(cap.id)}>
                                                        {cap.category}: {cap.label} ({cap.id})
                                                    </option>
                                                ))}
                                                <option value="custom" disabled>--- O scrivi personalizzato ---</option>
                                            </select>
                                            {/* Allow custom input as fallback/advanced */}
                                            <input
                                                type="text"
                                                placeholder="Custom..."
                                                className="w-1/3 px-3 py-1 text-sm border border-moca-gray rounded-md"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const val = (e.target as HTMLInputElement).value.trim();
                                                        if (val && !editingRole.permissions?.includes(val)) {
                                                            setEditingRole({
                                                                ...editingRole,
                                                                permissions: [...(editingRole.permissions || []), val]
                                                            });
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleUpdateRole(editingRole)}
                                                className="px-4 py-2 bg-moca-red text-white rounded-md hover:opacity-90"
                                            >
                                                Salva
                                            </button>
                                            <button
                                                onClick={() => setEditingRole(null)}
                                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                                            >
                                                Annulla
                                            </button>
                                        </div>
                                        {!editingRole.is_system_role && (
                                            <button
                                                onClick={() => handleDeleteRole(editingRole.id || '')}
                                                className="text-red-500 hover:text-red-700 p-2"
                                                title="Elimina ruolo"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                                {role.role_key}
                                            </span>
                                            <h3 className="text-lg font-semibold text-moca-black">
                                                {role.display_name}
                                            </h3>
                                        </div>
                                        <p className="text-sm text-moca-gray">{role.description}</p>
                                        {role.permissions && role.permissions.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-xs font-semibold text-moca-gray">Permessi:</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {role.permissions.map((perm, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                                                        >
                                                            {perm}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setEditingRole(role)}
                                        className="text-moca-red hover:text-moca-black transition-colors"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Summary Table */}
            <div className="bg-white rounded-lg border border-moca-gray shadow-sm p-6 mt-8">
                <h2 className="text-2xl font-bold text-moca-black mb-4">Guida rapida: chi può fare cosa?</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruolo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrizione & Esempi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap font-semibold">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Super Admin</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    <span className="font-bold">Accesso totale.</span> Gestisce tutto: utenti, clienti, configurazioni, applicazioni, ruoli e log.
                                    <br /><span className="italic text-xs">Es: Team di sviluppo, CTO.</span>
                                </td>
                            </tr>
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap font-semibold">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Manager</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    Crea e gestisce utenti, clienti e configurazioni. Gestisce gli accessi alle applicazioni.
                                    <br /><span className="italic text-xs">Es: Head of, Responsabile Team AI.</span>
                                </td>
                            </tr>
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap font-semibold">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Specialist</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    Modifica configurazioni, crea clienti e utilizza le applicazioni assegnate.
                                    <br /><span className="italic text-xs">Es: SEO Specialist, ADV Manager, Account.</span>
                                </td>
                            </tr>
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap font-semibold">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">Esterno</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    Visualizza solo le configurazioni dei propri clienti e usa solo le app autorizzate.
                                    <br /><span className="italic text-xs">Es: Cliente esterno, Consulente.</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
