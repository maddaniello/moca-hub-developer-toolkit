import type { Handler, HandlerEvent } from '@netlify/functions';
import { supabaseAdmin } from './utils/supabase-admin';
import { corsHeaders, log } from './utils/helpers';

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
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Autenticazione richiesta' }),
            };
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !authUser) {
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Token non valido' }),
            };
        }

        // Check if admin
        const { data: requestingUser } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single();

        if (!requestingUser || requestingUser.role !== 'super_admin') {
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Accesso negato: Solo gli amministratori possono gestire i log.' }),
            };
        }

        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body || '{}');
            const { id, all } = body;

            let query = supabaseAdmin.from('logs').delete();

            if (all) {
                // Delete all logs except maybe a system init log if we wanted to keep it, but user said "Clear logs"
                // To be safe we might want to filter, but "delete all" usually means all.
                // We must have a WHERE clause for delete in Supabase usually, or use a filter that matches all.
                // neq '0' is ahack to match all valid UUIDs? No, just don't add filter?
                // Supabase-js delete requires a filter unless using rpc.
                // We'll use a filter that is always true? Or just id.neq.
                query = query.neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything effectively
            } else if (id) {
                query = query.eq('id', id);
            } else {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Specificare un ID o "all": true' }),
                };
            }

            const { error, count } = await query;

            if (error) throw error;

            await log('info', `Logs cleared by admin`, { deletedCount: count }, authUser.id);

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ success: true, message: 'Log eliminati con successo' }),
            };
        }

        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Metodo non consentito' }),
        };

    } catch (error: any) {
        console.error('Error in manage-logs:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

export { handler };
