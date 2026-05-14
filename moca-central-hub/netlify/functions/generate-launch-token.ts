import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabaseAdmin } from './utils/supabase-admin';
import { corsHeaders, log } from './utils/helpers';

interface GenerateTokenRequest {
    client_id: string;
    application_id: string;
}

/**
 * Generate Launch Token
 * 
 * Creates a single-use, short-lived token that allows an external app
 * to retrieve client-specific API keys from Moca Hub.
 * 
 * Flow: Dashboard → generate token → redirect to app with ?moca_token=xxx
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: corsHeaders,
            body: '',
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        // Verify authentication
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

        // Get the user's info
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, client_id, role, name, email')
            .eq('id', authUser.id)
            .single();

        if (userError || !userData) {
            log('warning', 'User not found in database', { userId: authUser.id });
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Utente non trovato' }),
            };
        }

        // Parse the request
        if (!event.body) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Request body richiesto' }),
            };
        }

        const body: GenerateTokenRequest = JSON.parse(event.body);

        if (!body.client_id || !body.application_id) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'client_id e application_id sono obbligatori' }),
            };
        }

        // Verify user has access to this client
        // Admin can access any client, others must be assigned
        if (userData.role !== 'super_admin') {
            // Check user_clients table for multi-client support
            const { data: userClients, error: ucError } = await supabaseAdmin
                .from('user_clients')
                .select('client_id')
                .eq('user_id', userData.id);

            const assignedClientIds = userClients?.map(uc => uc.client_id) || [];
            // Also include legacy client_id
            if (userData.client_id) {
                assignedClientIds.push(userData.client_id);
            }

            if (!assignedClientIds.includes(body.client_id)) {
                log('warning', 'User attempted to launch app for unauthorized client', {
                    userId: userData.id,
                    clientId: body.client_id,
                });
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Non hai accesso a questo cliente' }),
                };
            }
        }

        // Verify the application exists and is active
        const { data: appData, error: appError } = await supabaseAdmin
            .from('applications')
            .select('id, name, url, status')
            .eq('id', body.application_id)
            .single();

        if (appError || !appData) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Applicazione non trovata' }),
            };
        }

        if (appData.status !== 'active') {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Applicazione non attiva' }),
            };
        }

        // Verify user has access to this application
        if (userData.role !== 'super_admin') {
            const { data: accessData, error: accessError } = await supabaseAdmin
                .from('application_access')
                .select('id')
                .or(`user_id.eq.${userData.id},client_id.eq.${body.client_id},role_access.eq.${userData.role},role_access.eq.all`)
                .eq('application_id', body.application_id);

            const hasAccess = accessData && accessData.length > 0;

            if (!hasAccess) {
                log('warning', 'User has no access to application', {
                    userId: userData.id,
                    applicationId: body.application_id,
                });
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Non hai accesso a questa applicazione' }),
                };
            }
        }

        // Generate a secure random token (64 hex characters = 32 bytes)
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        const launchToken = Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        // Cleanup old expired tokens (fire and forget)
        supabaseAdmin.rpc('cleanup_expired_launch_tokens').then(() => { }).catch(() => { });

        // Insert the launch token with 5 minute expiration
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const { error: insertError } = await supabaseAdmin
            .from('app_launch_tokens')
            .insert({
                token: launchToken,
                user_id: userData.id,
                client_id: body.client_id,
                application_id: body.application_id,
                expires_at: expiresAt,
            });

        if (insertError) {
            log('error', 'Failed to create launch token', { error: insertError.message });
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Errore nella generazione del token' }),
            };
        }

        // Build the redirect URL
        const appUrl = new URL(appData.url);
        appUrl.searchParams.set('moca_token', launchToken);

        log('info', 'Launch token generated', {
            userId: userData.id,
            clientId: body.client_id,
            applicationId: body.application_id,
            expiresAt,
        });

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                token: launchToken,
                redirect_url: appUrl.toString(),
                expires_at: expiresAt,
            }),
        };

    } catch (error: any) {
        log('error', 'Unexpected error in generate-launch-token', {
            error: error.message,
            stack: error.stack,
        });

        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Errore interno del server' }),
        };
    }
};

export { handler };
