import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabaseAdmin } from './utils/supabase-admin';
import { corsHeaders, log } from './utils/helpers';

interface GetConfigRequest {
    client_id?: string;
    config_key?: string;
    config_type?: 'api_key' | 'variable' | 'setting';
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: corsHeaders,
            body: '',
        };
    }

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        log('info', 'Get client config request received');

        // Verify authentication
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            log('warn', 'Missing or invalid authorization header');
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
            log('warn', 'Invalid token', { error: authError?.message });
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Token non valido' }),
            };
        }

        // Get the user's info and client
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, client_id, role, level')
            .eq('id', authUser.id)
            .single();

        if (userError || !userData) {
            log('warn', 'User not found in database', { userId: authUser.id });
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Utente non trovato' }),
            };
        }

        // Parse the request
        let body: GetConfigRequest = {};

        if (event.httpMethod === 'POST' && event.body) {
            body = JSON.parse(event.body);
        } else if (event.httpMethod === 'GET') {
            body = {
                client_id: event.queryStringParameters?.client_id,
                config_key: event.queryStringParameters?.config_key,
                config_type: event.queryStringParameters?.config_type as GetConfigRequest['config_type'],
            };
        }

        // Determine which client to fetch configs for
        let targetClientId = body.client_id || userData.client_id;

        // External users can only access their own client's configs
        if (userData.role === 'external' && targetClientId !== userData.client_id) {
            log('warn', 'User attempted to access another client\'s config', {
                userId: userData.id,
                requestedClientId: targetClientId,
                userClientId: userData.client_id,
            });
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Non hai accesso alle configurazioni di questo cliente' }),
            };
        }

        // Build query
        let query = supabaseAdmin
            .from('configurations')
            .select('id, config_key, config_value, config_type, is_encrypted, created_at, updated_at')
            .eq('client_id', targetClientId);

        // Filter by specific key if provided
        if (body.config_key) {
            query = query.eq('config_key', body.config_key);
        }

        // Filter by type if provided
        if (body.config_type) {
            query = query.eq('config_type', body.config_type);
        }

        const { data: configs, error: configError } = await query.order('config_key');

        if (configError) {
            log('error', 'Failed to fetch configurations', { error: configError.message });
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Errore nel recupero delle configurazioni' }),
            };
        }

        log('info', 'Configurations fetched successfully', {
            clientId: targetClientId,
            count: configs?.length || 0,
            requestedKey: body.config_key,
        });

        // If a specific key was requested and found, return just the value
        if (body.config_key && configs && configs.length === 1) {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    config_key: configs[0].config_key,
                    config_value: configs[0].config_value,
                    config_type: configs[0].config_type,
                }),
            };
        }

        // Return all matching configurations
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                client_id: targetClientId,
                configurations: configs || [],
            }),
        };

    } catch (error: any) {
        log('error', 'Unexpected error in get-client-config', { error: error.message, stack: error.stack });

        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Errore interno del server' }),
        };
    }
};

export { handler };
