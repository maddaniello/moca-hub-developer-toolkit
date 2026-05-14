import type { Context } from "@netlify/functions";
import { corsHeaders, jsonResponse, errorResponse, log } from './utils/helpers';
import { supabaseAdmin } from './utils/supabase-admin';
import { listFolderContents, verifyFolderAccess, extractFolderId } from './utils/google-drive';

/**
 * Sync Drive — Iterative (one folder per call).
 *
 * The frontend calls this in a loop:
 *   1. First call: { client_id } → syncs root folder, returns subfolders
 *   2. Next calls: { client_id, folder_id, folder_path } → syncs one subfolder
 *   3. Repeat until no more subfolders (pending_folders: [])
 *
 * Each call processes a single folder (~1-5 seconds), well within Netlify timeout.
 */

// Only document types — skip images, videos, audio, archives
const SUPPORTED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'text/plain', 'text/csv', 'text/html', 'application/rtf',
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
]);

export default async (req: Request, context: Context) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    try {
        // Auth
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return errorResponse('Missing authorization', 401);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return errorResponse('Invalid token', 401);

        const { data: userData } = await supabaseAdmin.from('users').select('role, status').eq('id', user.id).single();
        if (!userData || userData.status !== 'active') return errorResponse('User not active', 403);
        if (!['super_admin', 'manager'].includes(userData.role)) return errorResponse('Insufficient permissions', 403);

        const body = await req.json();
        const { client_id, folder_id, folder_path } = body;
        if (!client_id) return errorResponse('client_id is required');

        // Determine which folder to scan
        let targetFolderId: string;
        let targetPath: string;

        if (folder_id) {
            // Subsequent call — scan a specific subfolder
            targetFolderId = folder_id;
            targetPath = folder_path || '';
        } else {
            // First call — scan root folder from client's drive_url
            const { data: client } = await supabaseAdmin.from('clients').select('id, name, drive_url').eq('id', client_id).single();
            if (!client) return errorResponse('Client not found', 404);
            if (!client.drive_url) return errorResponse('Nessun URL Google Drive configurato.', 400);

            const rootId = extractFolderId(client.drive_url);
            if (!rootId) return errorResponse(`URL Drive non valido: ${client.drive_url}`, 400);

            // Verify access on first call only
            const access = await verifyFolderAccess(rootId);
            if (!access.ok) {
                const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'il Service Account';
                return errorResponse(`${access.error}. Condividi la cartella con: ${saEmail}`, 404);
            }

            targetFolderId = rootId;
            targetPath = '';

            await log('info', `[sync-drive] Avvio sync per client ${client_id} (root: ${rootId})`, null, user.id);
        }

        // List direct children of this folder (fast, single API call)
        const { files, subfolders } = await listFolderContents(targetFolderId, targetPath);

        // Get existing synced files for diff
        const driveFileIds = files.map(f => f.id);
        const { data: existingFiles } = await supabaseAdmin
            .from('client_drive_files')
            .select('drive_file_id, drive_modified_at')
            .eq('client_id', client_id)
            .in('drive_file_id', driveFileIds.length > 0 ? driveFileIds : ['__none__']);

        const existingMap = new Map((existingFiles || []).map(f => [f.drive_file_id, f.drive_modified_at]));

        // Upsert files
        let newCount = 0, updatedCount = 0, skippedCount = 0;

        for (const file of files) {
            const isSupported = SUPPORTED_MIME_TYPES.has(file.mimeType);
            const existing = existingMap.get(file.id);

            if (existing && existing === file.modifiedTime) { skippedCount++; continue; }

            const { error: upsertError } = await supabaseAdmin
                .from('client_drive_files')
                .upsert({
                    client_id,
                    drive_file_id: file.id,
                    file_name: file.name,
                    file_path: file.path,
                    mime_type: file.mimeType,
                    file_size: file.size,
                    drive_modified_at: file.modifiedTime,
                    processing_status: isSupported ? 'pending' : 'skipped',
                    processing_error: !isSupported ? `Tipo non supportato: ${file.mimeType}` : null,
                    processed: false,
                    chunk_count: 0,
                    synced_at: new Date().toISOString(),
                }, { onConflict: 'client_id,drive_file_id' });

            if (upsertError) { console.error(`Upsert error: ${upsertError.message}`); continue; }
            existing ? updatedCount++ : newCount++;
        }

        return jsonResponse({
            success: true,
            folder_scanned: targetPath || '(root)',
            files_found: files.length,
            new_files: newCount,
            updated_files: updatedCount,
            unchanged_files: skippedCount,
            // Frontend uses this to call again for each subfolder
            pending_folders: subfolders,
        });

    } catch (error: any) {
        console.error('[sync-drive] Error:', error);
        await log('error', `[sync-drive] Error: ${error.message}`, { stack: error.stack });
        return errorResponse(`Errore: ${error.message}`, 500);
    }
};
