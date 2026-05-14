import { supabase } from './supabase';
import { LogLevel } from './types';

/**
 * Creates a log entry in the database
 */
export async function createLog(
    level: LogLevel,
    message: string,
    data?: any,
    userId?: string
) {
    try {
        // Also log to console for development
        const consoleMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
        consoleMethod(`[${level.toUpperCase()}] ${message}`, data || '');

        // Get current user if not provided
        let verifiedUserId = userId;
        if (!verifiedUserId) {
            const { data: { user } } = await supabase.auth.getUser();
            verifiedUserId = user?.id;
        }

        const { error } = await supabase.from('logs').insert({
            level,
            message,
            data: data ? data : null, // Ensure JSON validity
            user_id: verifiedUserId,
            timestamp: new Date().toISOString()
        });

        if (error) {
            console.error('Failed to write log to database:', error);
        }
    } catch (err) {
        console.error('Error in logger:', err);
    }
}

/**
 * Helper for INFO logs
 */
export async function logInfo(message: string, data?: any, userId?: string) {
    return createLog('info', message, data, userId);
}

/**
 * Helper for WARNING logs
 */
export async function logWarning(message: string, data?: any, userId?: string) {
    return createLog('warning', message, data, userId);
}

/**
 * Helper for ERROR logs
 */
export async function logError(message: string, data?: any, userId?: string) {
    return createLog('error', message, data, userId);
}
