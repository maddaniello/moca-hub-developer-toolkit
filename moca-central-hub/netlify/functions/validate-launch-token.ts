import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabaseAdmin } from './utils/supabase-admin';
import { log } from './utils/helpers';

// This endpoint needs open CORS because external apps call it from different domains
const openCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Validate Launch Token
 * 
 * Called by external apps to validate a launch token and receive
 * client-specific API keys and configurations.
 * 
 * No Bearer token required - the launch token IS the proof of authentication.
 * The token is single-use and expires after 5 minutes.
 * 
 * Flow: App receives ?moca_token=xxx → calls this endpoint → gets API keys
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: openCorsHeaders,
            body: '',
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: openCorsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: openCorsHeaders,
                body: JSON.stringify({ error: 'Request body richiesto' }),
            };
        }

        const { token } = JSON.parse(event.body);

        if (!token) {
            return {
                statusCode: 400,
                headers: openCorsHeaders,
                body: JSON.stringify({ error: 'Token richiesto' }),
            };
        }

        // Look up the token
        const { data: tokenData, error: tokenError } = await supabaseAdmin
            .from('app_launch_tokens')
            .select(`
                id,
                token,
                user_id,
                client_id,
                application_id,
                expires_at,
                consumed_at,
                created_at
            `)
            .eq('token', token)
            .single();

        if (tokenError || !tokenData) {
            log('warning', 'Invalid launch token attempted', { token: token.substring(0, 8) + '...' });
            return {
                statusCode: 401,
                headers: openCorsHeaders,
                body: JSON.stringify({
                    error: 'Token non valido',
                    code: 'INVALID_TOKEN',
                }),
            };
        }

        // Check if token is already consumed
        if (tokenData.consumed_at) {
            log('warning', 'Attempted to reuse consumed launch token', {
                tokenId: tokenData.id,
                consumedAt: tokenData.consumed_at,
            });
            return {
                statusCode: 403,
                headers: openCorsHeaders,
                body: JSON.stringify({
                    error: 'Token già utilizzato',
                    code: 'TOKEN_CONSUMED',
                }),
            };
        }

        // Check if token is expired
        if (new Date(tokenData.expires_at) < new Date()) {
            log('warning', 'Attempted to use expired launch token', {
                tokenId: tokenData.id,
                expiredAt: tokenData.expires_at,
            });
            return {
                statusCode: 403,
                headers: openCorsHeaders,
                body: JSON.stringify({
                    error: 'Token scaduto',
                    code: 'TOKEN_EXPIRED',
                }),
            };
        }

        // Mark token as consumed IMMEDIATELY (before any further processing)
        const { error: consumeError } = await supabaseAdmin
            .from('app_launch_tokens')
            .update({ consumed_at: new Date().toISOString() })
            .eq('id', tokenData.id)
            .is('consumed_at', null); // Extra safety: only consume if still unconsumed

        if (consumeError) {
            log('error', 'Failed to consume token', { error: consumeError.message });
            return {
                statusCode: 500,
                headers: openCorsHeaders,
                body: JSON.stringify({ error: 'Errore interno' }),
            };
        }

        // Fetch all related data in parallel
        const [clientResult, userResult, appResult, configResult] = await Promise.all([
            // Client info
            supabaseAdmin
                .from('clients')
                .select('id, name, email, logo_url, status')
                .eq('id', tokenData.client_id)
                .single(),
            // User info
            supabaseAdmin
                .from('users')
                .select('id, name, email, role, level, job_title')
                .eq('id', tokenData.user_id)
                .single(),
            // Application info
            supabaseAdmin
                .from('applications')
                .select('id, name, description, url')
                .eq('id', tokenData.application_id)
                .single(),
            // Client configurations (API keys, variables, settings)
            supabaseAdmin
                .from('configurations')
                .select('config_key, config_value, config_type')
                .eq('client_id', tokenData.client_id)
                .order('config_key'),
        ]);

        if (clientResult.error || !clientResult.data) {
            log('error', 'Client not found for launch token', { clientId: tokenData.client_id });
            return {
                statusCode: 500,
                headers: openCorsHeaders,
                body: JSON.stringify({ error: 'Cliente non trovato' }),
            };
        }

        if (userResult.error || !userResult.data) {
            log('error', 'User not found for launch token', { userId: tokenData.user_id });
            return {
                statusCode: 500,
                headers: openCorsHeaders,
                body: JSON.stringify({ error: 'Utente non trovato' }),
            };
        }

        // Build configurations map { key: value }
        const configurations: Record<string, string> = {};
        if (configResult.data) {
            for (const config of configResult.data) {
                configurations[config.config_key] = config.config_value;
            }
        }

        log('info', 'Launch token validated successfully', {
            tokenId: tokenData.id,
            userId: tokenData.user_id,
            clientId: tokenData.client_id,
            applicationId: tokenData.application_id,
            configCount: Object.keys(configurations).length,
        });

        // Return all data the app needs
        return {
            statusCode: 200,
            headers: openCorsHeaders,
            body: JSON.stringify({
                success: true,
                client: {
                    id: clientResult.data.id,
                    name: clientResult.data.name,
                    email: clientResult.data.email,
                    logo_url: clientResult.data.logo_url,
                },
                user: {
                    id: userResult.data.id,
                    name: userResult.data.name,
                    email: userResult.data.email,
                    role: userResult.data.role,
                    level: userResult.data.level,
                    job_title: userResult.data.job_title,
                },
                application: appResult.data ? {
                    id: appResult.data.id,
                    name: appResult.data.name,
                    description: appResult.data.description,
                } : null,
                configurations,
            }),
        };

    } catch (error: any) {
        log('error', 'Unexpected error in validate-launch-token', {
            error: error.message,
            stack: error.stack,
        });

        return {
            statusCode: 500,
            headers: openCorsHeaders,
            body: JSON.stringify({ error: 'Errore interno del server' }),
        };
    }
};

export { handler };
