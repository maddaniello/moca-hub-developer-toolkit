// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://moca-central-hub.netlify.app',
    'https://dev--moca-central-hub.netlify.app', // Staging
    'http://localhost:5173', // Dev locale
    'http://localhost:4173', // Preview locale
];

// Dynamic CORS headers - restricts to known origins
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
    const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
        ? requestOrigin
        : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };
}

// Legacy export for backwards compatibility - uses restrictive default
export const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://moca-central-hub.netlify.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Generate a secure random password
export function generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
        password += charset[randomValues[i] % charset.length];
    }

    // Ensure at least one of each required character type
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);

    if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
        // Recursively generate until we get a valid password
        return generateSecurePassword(length);
    }

    return password;
}

// Response helpers
export function jsonResponse(data: any, status: number = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
        },
    });
}

export function errorResponse(message: string, status: number = 400) {
    return jsonResponse({ error: message }, status);
}

// Log helper for Netlify Functions - Logs to database AND console
export async function log(
    level: 'info' | 'warning' | 'error',
    message: string,
    data?: any,
    userId?: string | null
) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...(data && { data }),
    };

    // Console log for immediate debugging
    if (level === 'error') {
        console.error(JSON.stringify(logEntry));
    } else if (level === 'warning') {
        console.warn(JSON.stringify(logEntry));
    } else {
        console.log(JSON.stringify(logEntry));
    }

    // Insert into database (fire and forget - don't block on errors)
    try {
        const { supabaseAdmin } = await import('./supabase-admin');
        await supabaseAdmin.from('logs').insert({
            level,
            message,
            data: data || null,
            user_id: userId || null,
        });
    } catch (error) {
        // If logging to DB fails, just log to console - don't throw
        console.error('Failed to insert log into database:', error);
    }
}

