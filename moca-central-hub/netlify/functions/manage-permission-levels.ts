import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabaseAdmin } from './utils/supabase-admin';
import { corsHeaders, log } from './utils/helpers';

interface PermissionLevel {
    id?: string;
    level: number;
    display_name: string;
    description: string;
    capabilities: string[];
    is_active?: boolean;
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
            await log('warning', 'Non-admin user attempted to manage permission levels', { userId: authUser.id }, authUser.id);
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Solo gli amministratori possono gestire i livelli di permesso' }),
            };
        }

        // Handle different HTTP methods
        if (event.httpMethod === 'GET') {
            // Get all permission levels
            const { data: levels, error } = await supabaseAdmin
                .from('permission_levels')
                .select('*')
                .order('level');

            if (error) {
                throw error;
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ levels }),
            };

        } else if (event.httpMethod === 'POST') {
            // Create a new permission level
            const body: PermissionLevel = JSON.parse(event.body || '{}');

            // Validate required fields
            if (!body.level || !body.display_name || !body.description) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Livello, nome e descrizione sono obbligatori' }),
                };
            }

            // Validate level range
            if (body.level < 1 || body.level > 10) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Il livello deve essere tra 1 e 10' }),
                };
            }

            await log('info', 'Creating permission level', {
                level: body.level,
                displayName: body.display_name
            }, authUser.id);

            const { data: level, error } = await supabaseAdmin
                .from('permission_levels')
                .insert({
                    level: body.level,
                    display_name: body.display_name,
                    description: body.description,
                    capabilities: body.capabilities || [],
                    is_active: body.is_active !== false,
                })
                .select()
                .single();

            if (error) {
                await log('error', 'Failed to create permission level', { error: error.message }, authUser.id);
                throw error;
            }

            await log('info', 'Permission level created successfully', { levelId: level.id }, authUser.id);

            return {
                statusCode: 201,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    message: 'Livello di permesso creato con successo',
                    level
                }),
            };

        } else if (event.httpMethod === 'PUT') {
            // Update an existing permission level
            const body: PermissionLevel = JSON.parse(event.body || '{}');

            if (!body.id) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'ID livello richiesto' }),
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

            await log('info', 'Updating permission level', {
                levelId: body.id,
                displayName: body.display_name
            }, authUser.id);

            const { data: level, error } = await supabaseAdmin
                .from('permission_levels')
                .update({
                    display_name: body.display_name,
                    description: body.description,
                    capabilities: body.capabilities || [],
                    is_active: body.is_active !== false,
                })
                .eq('id', body.id)
                .select()
                .single();

            if (error) {
                await log('error', 'Failed to update permission level', { error: error.message }, authUser.id);
                throw error;
            }

            await log('info', 'Permission level updated successfully', { levelId: body.id }, authUser.id);

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    message: 'Livello di permesso aggiornato con successo',
                    level
                }),
            };

        } else if (event.httpMethod === 'DELETE') {
            // Delete a permission level (HARD DELETE)
            const body: { id: string } = JSON.parse(event.body || '{}');

            if (!body.id) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'ID obbligatorio' }),
                };
            }

            // Perform hard delete
            const { error, count } = await supabaseAdmin
                .from('permission_levels')
                .delete()
                .eq('id', body.id);

            if (error) {
                throw error;
            }

            await log('info', 'Permission level deleted', { levelId: body.id }, authUser.id);

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ success: true, message: 'Livello eliminato', deleted: count }),
            };
        } else {
            return {
                statusCode: 405,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Metodo non consentito' }),
            };
        }

    } catch (error: any) {
        await log('error', 'Unexpected error in manage-permission-levels', { error: error.message });
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Errore interno del server' }),
        };
    }
};

export { handler };
