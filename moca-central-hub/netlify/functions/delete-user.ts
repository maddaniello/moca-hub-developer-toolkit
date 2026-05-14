import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabaseAdmin } from './utils/supabase-admin';
import { corsHeaders, errorResponse, jsonResponse, log } from './utils/helpers';

interface DeleteUserRequest {
    user_id: string;
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

    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        // Get the authorization token
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader) {
            await log('warning', 'No authorization header provided');
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Autorizzazione richiesta' }),
            };
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify the user making the request
        const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !requestingUser) {
            await log('warning', 'Invalid token', { error: authError?.message });
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Token non valido' }),
            };
        }

        // Get the requesting user's role
        const { data: adminData, error: adminError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', requestingUser.id)
            .single();

        if (adminError || !adminData) {
            await log('warning', 'Could not find requesting user in database', { userId: requestingUser.id }, requestingUser.id);
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Utente non trovato nel database' }),
            };
        }

        if (adminData.role !== 'super_admin') {
            await log('warning', 'Unauthorized user attempted to delete user', {
                userId: requestingUser.id,
                role: adminData.role
            }, requestingUser.id);
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Solo i super admin possono eliminare utenti' }),
            };
        }

        // Parse request body
        const body: DeleteUserRequest = JSON.parse(event.body || '{}');

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!body.user_id || !uuidRegex.test(body.user_id)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'ID utente non valido' }),
            };
        }

        // Prevent self-deletion
        if (body.user_id === requestingUser.id) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Non puoi eliminare te stesso' }),
            };
        }

        await log('info', 'Attempting to delete user', {
            targetUserId: body.user_id,
            requestedBy: requestingUser.id
        }, requestingUser.id);

        // Get user info before deletion for logging
        const { data: targetUser } = await supabaseAdmin
            .from('users')
            .select('email, name')
            .eq('id', body.user_id)
            .single();

        // Delete from Supabase Auth first
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(body.user_id);

        if (authDeleteError) {
            await log('error', 'Failed to delete user from Auth', {
                error: authDeleteError.message,
                userId: body.user_id
            }, requestingUser.id);
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Errore durante l\'eliminazione da Auth: ' + authDeleteError.message
                }),
            };
        }

        // Delete from users table (this will cascade to user_clients)
        const { error: dbDeleteError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', body.user_id);

        if (dbDeleteError) {
            await log('error', 'Failed to delete user from database', {
                error: dbDeleteError.message,
                userId: body.user_id
            }, requestingUser.id);
            // User is already deleted from Auth, so we log but don't fail
            await log('warning', 'User deleted from Auth but failed to delete from DB', { userId: body.user_id }, requestingUser.id);
        }

        // Log the action
        await supabaseAdmin.from('audit_logs').insert({
            action: 'delete_user',
            entity_type: 'user',
            entity_id: body.user_id,
            user_id: requestingUser.id,
            details: {
                deleted_user_email: targetUser?.email,
                deleted_user_name: targetUser?.name,
            },
        });

        await log('info', 'User deleted successfully', {
            userId: body.user_id,
            email: targetUser?.email
        }, requestingUser.id);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                message: 'Utente eliminato con successo'
            }),
        };

    } catch (error: any) {
        await log('error', 'Unexpected error in delete-user', { error: error.message });
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Errore interno del server' }),
        };
    }
};

export { handler };
