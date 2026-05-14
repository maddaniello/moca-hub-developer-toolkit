
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in seed-data function');
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

export const handler: Handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Auth check: require admin Bearer token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!userData || userData.role !== 'super_admin') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Admin only' }) };
    }

    try {
        console.log('Seeding data...');
        const results: any = {};

        // 1. Seed Roles
        const { data: roles } = await supabase.from('role_definitions').select('id');
        if (!roles || roles.length === 0) {
            const { error: roleError } = await supabase.from('role_definitions').insert([
                { role_key: 'super_admin', display_name: 'Super Admin', description: 'Accesso completo alla piattaforma.', permissions: ['all'], is_system: true },
                { role_key: 'manager', display_name: 'Manager', description: 'Gestione utenti, clienti e configurazioni.', permissions: ['manage_users', 'manage_clients', 'manage_configurations'], is_system: true },
                { role_key: 'specialist', display_name: 'Specialist', description: 'Operativo: configurazioni, clienti e app.', permissions: ['manage_configurations', 'manage_clients', 'use_apps'], is_system: true },
                { role_key: 'external', display_name: 'Esterno', description: 'Accesso limitato ai propri clienti e app autorizzate.', permissions: ['view_own', 'use_authorized_apps'], is_system: true }
            ]);
            results.roles = roleError ? `Error: ${roleError.message}` : 'Seeded';
        } else {
            results.roles = 'Already exists';
        }

        // 2. Seed Permissions
        const { data: levels } = await supabase.from('permission_levels').select('id');
        if (!levels || levels.length === 0) {
            const { error: levelError } = await supabase.from('permission_levels').insert([
                { level: 1, display_name: 'Base', description: 'Accesso limitato alle funzioni essenziali.', capabilities: ['view_dashboard'], is_active: true },
                { level: 2, display_name: 'Standard', description: 'Accesso alle funzioni comuni.', capabilities: ['view_dashboard', 'export_data'], is_active: true },
                { level: 3, display_name: 'Avanzato', description: 'Accesso avanzato, creazione contenuti.', capabilities: ['view_dashboard', 'export_data', 'create_items'], is_active: true },
                { level: 4, display_name: 'Completo', description: 'Gestione quasi completa.', capabilities: ['view_dashboard', 'export_data', 'create_items', 'manage_settings'], is_active: true },
                { level: 5, display_name: 'Totale', description: 'Accesso senza restrizioni.', capabilities: ['all'], is_active: true }
            ]);
            results.levels = levelError ? `Error: ${levelError.message}` : 'Seeded';
        } else {
            results.levels = 'Already exists';
        }

        // 3. Seed Default Client if none
        const { data: clients } = await supabase.from('clients').select('id');
        if (!clients || clients.length === 0) {
            const { error: clientError } = await supabase.from('clients').insert([
                { name: 'Default Client', slug: 'default-client', status: 'active', tier: 'enterprise' }
            ]);
            results.clients = clientError ? `Error: ${clientError.message}` : 'Seeded';
        } else {
            results.clients = 'Already exists';
        }

        return {
            statusCode: 200,
            body: JSON.stringify(results),
        };
    } catch (error: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
