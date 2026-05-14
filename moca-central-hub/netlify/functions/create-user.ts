import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabaseAdmin } from './utils/supabase-admin';
import { corsHeaders, generateSecurePassword, log } from './utils/helpers';

interface CreateUserRequest {
    email: string;
    name: string;
    client_ids: string[]; // Array of client IDs for multi-client support
    role: 'super_admin' | 'manager' | 'specialist' | 'external';
    level: number;
    job_title?: string; // Ruolo aziendale (es. SEO, ADV, Team Leader)
    status?: 'active' | 'inactive' | 'suspended';
    send_invite?: boolean;
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

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        await log('info', 'Create user request received');

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

        if (userError || !requestingUser || !['super_admin', 'manager'].includes(requestingUser.role)) {
            await log('warning', 'Unauthorized user attempted to create user', { userId: authUser.id }, authUser.id);
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Solo super admin e manager possono creare utenti' }),
            };
        }

        // Parse the request body
        const body: CreateUserRequest = JSON.parse(event.body || '{}');

        // Validate required fields
        if (!body.email || !body.name || !body.client_ids || body.client_ids.length === 0 || !body.role) {
            await log('warning', 'Missing required fields', { body }, authUser.id);
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Email, nome, almeno un cliente e ruolo sono obbligatori' }),
            };
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Formato email non valido' }),
            };
        }

        // Validate role
        const validRoles = ['super_admin', 'manager', 'specialist', 'external'];
        if (!validRoles.includes(body.role)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Ruolo non valido' }),
            };
        }

        // Validate level
        if (body.level < 1 || body.level > 5) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Il livello deve essere tra 1 e 5' }),
            };
        }

        // Check if all clients exist
        const { data: clients, error: clientsError } = await supabaseAdmin
            .from('clients')
            .select('id, name')
            .in('id', body.client_ids);

        if (clientsError || !clients || clients.length !== body.client_ids.length) {
            await log('warning', 'Some clients not found', { clientIds: body.client_ids, found: clients?.length }, authUser.id);
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Uno o più clienti non trovati' }),
            };
        }

        // Generate a temporary password
        const tempPassword = generateSecurePassword(16);

        await log('info', 'Creating user in Supabase Auth', { email: body.email }, authUser.id);

        // Create the user in Supabase Auth with invite email
        let authResult;

        if (body.send_invite !== false) {
            // Send invite email - user will set their own password
            authResult = await supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
                data: {
                    name: body.name,
                    client_ids: body.client_ids,
                    role: body.role,
                    job_title: body.job_title,
                },
                redirectTo: `${process.env.URL || 'https://moca-central-hub.netlify.app'}`,
            });
        } else {
            // Create user with password directly (no invite)
            authResult = await supabaseAdmin.auth.admin.createUser({
                email: body.email,
                password: tempPassword,
                email_confirm: true,
                user_metadata: {
                    name: body.name,
                    client_ids: body.client_ids,
                    role: body.role,
                    job_title: body.job_title,
                },
            });
        }

        if (authResult.error) {
            const errorMessage = authResult.error.message.toLowerCase();
            await log('error', 'Auth creation failed', { originalError: authResult.error.message }, authUser.id);

            // Handle specific errors
            if (errorMessage.includes('already registered') || errorMessage.includes('user already exists') || errorMessage.includes('email address has already been taken')) {
                await log('info', 'User likely already in Auth, checking DB consistency', { email: body.email }, authUser.id);

                // Try to find the user in Auth to get the ID
                const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
                const existingAuthUser = existingAuthUsers.users.find(u => u.email === body.email);

                if (existingAuthUser) {
                    // Check if user exists in public.users
                    const { data: existingDbUser } = await supabaseAdmin
                        .from('users')
                        .select('id')
                        .eq('id', existingAuthUser.id)
                        .single();

                    if (!existingDbUser) {
                        // User exists in Auth but NOT in DB - Recoverable state
                        // Use existing ID and proceed to create DB record
                        authResult = { data: { user: existingAuthUser }, error: null };
                        await log('info', 'Recovering: Found orphan Auth user, creating DB record', { userId: existingAuthUser.id }, authUser.id);

                        // Optional: Update Auth metadata to match new request
                        await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
                            user_metadata: {
                                name: body.name,
                                client_ids: body.client_ids,
                                role: body.role,
                                job_title: body.job_title,
                            }
                        });
                    } else {
                        // User exists in BOTH - Real duplicate
                        return {
                            statusCode: 400,
                            headers: corsHeaders,
                            body: JSON.stringify({ error: 'Un utente con questa email esiste già e ed è attivo.' }),
                        };
                    }
                } else {
                    // Should not happen if "already registered" is true, but fallback
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Un utente con questa email esiste già (Auth conflict).' }),
                    };
                }
            } else {
                await log('error', 'Failed to create auth user', { error: authResult.error.message }, authUser.id);
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: `Errore creazione utente: ${authResult.error.message}` }),
                };
            }
        }

        const newAuthUser = authResult.data.user;
        await log('info', 'Auth user created', { userId: newAuthUser?.id }, authUser.id);

        // Create the user record in our users table
        // Use the first client_id for backward compatibility
        const { data: newUser, error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
                id: newAuthUser?.id,
                email: body.email,
                name: body.name,
                client_id: body.client_ids[0], // Primary client for backward compatibility
                role: body.role,
                level: body.level || 1,
                status: body.status || 'active',
                job_title: body.job_title || null,
                must_change_password: body.send_invite === false,
            })
            .select('*')
            .single();

        if (insertError) {
            await log('error', 'Failed to create user record', { error: insertError.message }, authUser.id);

            // Try to clean up the auth user if the database insert failed
            if (newAuthUser?.id) {
                await supabaseAdmin.auth.admin.deleteUser(newAuthUser.id);
            }

            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Errore durante il salvataggio dell\'utente nel database' }),
            };
        }

        // Create user_clients relationships for multi-client support
        const userClientsData = body.client_ids.map(clientId => ({
            user_id: newAuthUser?.id,
            client_id: clientId,
        }));

        const { error: userClientsError } = await supabaseAdmin
            .from('user_clients')
            .insert(userClientsData);

        if (userClientsError) {
            await log('warning', 'Failed to create user_clients relationships', { error: userClientsError.message }, authUser.id);
            // Don't fail the whole operation, just log the warning
        }

        await log('info', 'User created successfully', {
            userId: newUser.id,
            email: newUser.email,
            clientCount: body.client_ids.length,
            inviteSent: body.send_invite !== false
        }, authUser.id);

        // Log the action in audit_logs
        await supabaseAdmin.from('audit_logs').insert({
            user_id: authUser.id,
            action: 'CREATE',
            entity_type: 'user',
            entity_id: newUser.id,
            new_values: {
                email: newUser.email,
                name: newUser.name,
                role: newUser.role,
                client_ids: body.client_ids,
                job_title: body.job_title,
            },
        });

        // Fetch clients for response
        const userWithClients = {
            ...newUser,
            client_ids: body.client_ids,
            clients: clients,
        };

        return {
            statusCode: 201,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                message: body.send_invite !== false
                    ? 'Utente creato con successo. È stata inviata un\'email di invito.'
                    : 'Utente creato con successo. L\'utente dovrà cambiare la password al primo accesso.',
                user: userWithClients,
                invite_sent: body.send_invite !== false,
                ...(body.send_invite === false && { temp_password: tempPassword }),
            }),
        };

    } catch (error: any) {
        await log('error', 'Unexpected error in create-user', { error: error.message, stack: error.stack });

        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Errore interno del server' }),
        };
    }
};

export { handler };
