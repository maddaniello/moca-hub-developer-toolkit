/**
 * Lightweight Google Drive API client using direct REST calls.
 * Avoids the heavy `googleapis` package (~70MB) that causes cold-start timeouts on Netlify.
 * Uses Service Account JWT authentication via Web Crypto API.
 */

// --- JWT Token Generation ---

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
        return cachedToken.token;
    }

    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');

    const sa = JSON.parse(serviceAccountJson);
    const now = Math.floor(Date.now() / 1000);

    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    };

    const b64url = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsignedToken = `${b64url(header)}.${b64url(payload)}`;

    const privateKeyDer = pemToDer(sa.private_key);
    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8', privateKeyDer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5', cryptoKey,
        new TextEncoder().encode(unsignedToken)
    );

    const jwt = `${unsignedToken}.${Buffer.from(signature).toString('base64url')}`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
        throw new Error(`Google OAuth error: ${await tokenResponse.text()}`);
    }

    const tokenData = await tokenResponse.json();
    cachedToken = { token: tokenData.access_token, expiresAt: Date.now() + 3500000 };
    return tokenData.access_token;
}

function pemToDer(pem: string): ArrayBuffer {
    const b64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s/g, '');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

// --- Drive API Types ---

export interface DriveFile {
    id: string;
    name: string;
    path: string;
    mimeType: string;
    size: number;
    modifiedTime: string;
}

export interface DriveFolder {
    id: string;
    name: string;
    path: string;
}

export interface ListFolderResult {
    files: DriveFile[];
    subfolders: DriveFolder[];
}

// --- Drive API Calls ---

/**
 * List DIRECT children of a single folder (non-recursive).
 * Returns files and subfolders separately.
 * Each call is fast (~1-3 seconds) and stays within Netlify timeout.
 */
export async function listFolderContents(
    folderId: string,
    currentPath: string = ''
): Promise<ListFolderResult> {
    const accessToken = await getAccessToken();
    const files: DriveFile[] = [];
    const subfolders: DriveFolder[] = [];
    let pageToken: string | null = null;

    do {
        const params = new URLSearchParams({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
            pageSize: '200',
        });
        if (pageToken) params.set('pageToken', pageToken);

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?${params}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
            throw new Error(`Drive API error (${response.status}): ${await response.text()}`);
        }

        const data = await response.json();

        for (const file of data.files || []) {
            if (file.mimeType === 'application/vnd.google-apps.folder') {
                subfolders.push({
                    id: file.id,
                    name: file.name,
                    path: currentPath ? `${currentPath}/${file.name}` : file.name,
                });
            } else {
                files.push({
                    id: file.id,
                    name: file.name,
                    path: currentPath,
                    mimeType: file.mimeType,
                    size: parseInt(file.size || '0', 10),
                    modifiedTime: file.modifiedTime || new Date().toISOString(),
                });
            }
        }

        pageToken = data.nextPageToken || null;
    } while (pageToken);

    return { files, subfolders };
}

/**
 * Verify that a folder is accessible.
 */
export async function verifyFolderAccess(folderId: string): Promise<{ ok: boolean; name?: string; error?: string }> {
    try {
        const accessToken = await getAccessToken();
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
            return { ok: false, error: response.status === 404
                ? 'Cartella non trovata o non condivisa con il Service Account'
                : `Errore Drive API: ${response.status}` };
        }

        const data = await response.json();
        return { ok: true, name: data.name };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}

/**
 * Download file content from Google Drive.
 */
export async function downloadFile(
    driveFileId: string,
    mimeType: string
): Promise<{ buffer: Buffer; effectiveMimeType: string }> {
    const accessToken = await getAccessToken();

    const EXPORT_MIME_MAP: Record<string, string> = {
        'application/vnd.google-apps.document': 'application/pdf',
        'application/vnd.google-apps.spreadsheet': 'text/csv',
        'application/vnd.google-apps.presentation': 'application/pdf',
    };

    const exportMime = EXPORT_MIME_MAP[mimeType];
    const url = exportMime
        ? `https://www.googleapis.com/drive/v3/files/${driveFileId}/export?mimeType=${encodeURIComponent(exportMime)}`
        : `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error(`Download error (${response.status}): ${await response.text()}`);
    }

    return {
        buffer: Buffer.from(await response.arrayBuffer()),
        effectiveMimeType: exportMime || mimeType,
    };
}

/**
 * Extract folder ID from a Google Drive URL.
 */
export function extractFolderId(driveUrl: string): string | null {
    if (!driveUrl) return null;
    if (/^[a-zA-Z0-9_-]{10,}$/.test(driveUrl.trim())) return driveUrl.trim();
    const folderMatch = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];
    const idMatch = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return idMatch[1];
    return null;
}
