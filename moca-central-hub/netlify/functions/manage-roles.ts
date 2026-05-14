import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabaseAdmin } from './utils/supabase-admin';
import { corsHeaders, log } from './utils/helpers';

interface RoleDefinition {
    id?: string;
    role_key: 'super_admin' | 'manager' | 'specialist' | 'external';
    display_name: string;
    description: string;
    permissions: string[];
    is_system_role?: boolean;
}

const handler: Handler = async (event: HandlerEvent) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: '',
        };
    }

    try {
        // Verify the requesting user is authenticated and is an admin
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            await log('warning', 'Missing or invalid authorization header');
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Autenticazione richiesta' }),
            };
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify the JWT and get the user
        const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !authUser) {
            await log('warning', 'Invalid token', { error: authError?.message });
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Token non valido' }),
            };
        }

        // Check if the requesting user is an admin
        const { data: requestingUser, error: userError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single();

        if (userError || !requestingUser || requestingUser.role !== 'super_admin') {
            await log('warning', 'Non-admin user attempted to manage roles', { userId: authUser.id }, authUser.id);
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Solo gli amministratori possono gestire i ruoli' }),
            };
        }

        // Handle different HTTP methods
        if (event.httpMethod === 'GET') {
            // Get all role definitions
            const { data: roles, error } = await supabaseAdmin
                .from('role_definitions')
                .select('*')
                .order('role_key');

            if (error) {
                throw error;
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ roles }),
            };

        } else if (event.httpMethod === 'POST') {
            // Create a new custom role (not implemented in current version as we're keeping the 4 base roles)
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Creazione di nuovi ruoli non ancora supportata. Puoi modificare i ruoli esistenti.'
                }),
            };

        } else if (event.httpMethod === 'PUT') {
            // Update an existing role definition
            const body: RoleDefinition = JSON.parse(event.body || '{}');

            if (!body.id) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'ID ruolo richiesto' }),
                };
            }

            // Validate required fields
            if (!body.display_name || !body.description) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Nome e descrizione sono obbligatori' }),
                };
            }

            await log('info', 'Updating role definition', {
                roleId: body.id,
                displayName: body.display_name
            }, authUser.id);

            const { data: role, error } = await supabaseAdmin
                .from('role_definitions')
                .update({
                    display_name: body.display_name,
                    description: body.description,
                    permissions: body.permissions || [],
                })
                .eq('id', body.id)
                .select()
                .single();

            if (error) {
                await log('error', 'Failed to update role definition', { error: error.message }, authUser.id);
                throw error;
            }

            await log('info', 'Role definition updated successfully', { roleId: body.id }, authUser.id);

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    message: 'Ruolo aggiornato con successo',
                    role
                }),
            };

        } else if (event.httpMethod === 'DELETE') {
            // Delete a custom role (only non-system roles can be deleted)
            const body = JSON.parse(event.body || '{}');

            if (!body.id) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'ID ruolo richiesto' }),
                };
            }

            // Check if it's a system role
            const { data: role } = await supabaseAdmin
                .from('role_definitions')
                .select('is_system_role')
                .eq('id', body.id)
                .single();

            if (role?.is_system_role) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Non puoi eliminare un ruolo di sistema' }),
                };
            }

            const { error } = await supabaseAdmin
                .from('role_definitions')
                .delete()
                .eq('id', body.id);

            if (error) {
                throw error;
            }

            await log('info', 'Role definition deleted', { roleId: body.id }, authUser.id);

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    message: 'Ruolo eliminato con successo'
                }),
            };

        } else {
            return {
                statusCode: 405,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Metodo non consentito' }),
            };
        }

    } catch (error: any) {
        await log('error', 'Unexpected error in manage-roles', { error: error.message });
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Errore interno del server' }),
        };
    }
};

export { handler };
