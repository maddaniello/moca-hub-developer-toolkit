import { useState, useEffect, useCallback } from 'react';
import {
    Loader2, CheckCircle2, XCircle, AlertTriangle,
    FileText, RefreshCw, HardDrive, Clock, FolderSync
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { syncDriveFolder, processDocuments } from '../lib/api';
import type { ClientDriveFile } from '../lib/types';
import type { SyncDriveFolder } from '../lib/api';

interface DriveSyncSectionProps {
    clientId: string;
    hasDriveUrl: boolean;
    canManage: boolean;
}

type SyncPhase = 'idle' | 'syncing' | 'processing' | 'done' | 'error';

const STATUS_ICONS: Record<string, JSX.Element> = {
    pending: <Clock size={14} className="text-amber-500" />,
    processing: <Loader2 size={14} className="text-blue-500 animate-spin" />,
    completed: <CheckCircle2 size={14} className="text-green-500" />,
    failed: <XCircle size={14} className="text-red-500" />,
    skipped: <AlertTriangle size={14} className="text-gray-400" />,
};

const MIME_LABELS: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'text/plain': 'TXT', 'text/csv': 'CSV', 'text/html': 'HTML',
};

export function DriveSyncSection({ clientId, hasDriveUrl, canManage }: DriveSyncSectionProps) {
    const [files, setFiles] = useState<ClientDriveFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState<SyncPhase>('idle');
    const [syncMessage, setSyncMessage] = useState('');
    const [processProgress, setProcessProgress] = useState({ processed: 0, total: 0 });

    const fetchFiles = useCallback(async () => {
        const { data } = await supabase
            .from('client_drive_files')
            .select('*')
            .eq('client_id', clientId)
            .order('file_path').order('file_name');
        setFiles(data || []);
        setLoading(false);
    }, [clientId]);

    useEffect(() => { fetchFiles(); }, [fetchFiles]);

    /**
     * Sync from Drive — iterative, one folder per call.
     * Processes root folder first, then each subfolder found.
     */
    const handleSync = async () => {
        setPhase('syncing');
        let totalNew = 0, totalUpdated = 0, totalFiles = 0;

        // BFS queue of folders to process
        const folderQueue: Array<{ id?: string; path?: string }> = [{}]; // start with root (no folder_id = root)
        let foldersProcessed = 0;

        while (folderQueue.length > 0) {
            const folder = folderQueue.shift()!;
            const folderLabel = folder.path || '(root)';
            foldersProcessed++;
            setSyncMessage(`Scansione cartella: ${folderLabel} (${foldersProcessed} cartelle, ${totalFiles} file trovati)`);

            const { data, error } = await syncDriveFolder(clientId, folder.id, folder.path);

            if (error) {
                setPhase('error');
                setSyncMessage(error);
                return;
            }

            if (data) {
                totalNew += data.new_files;
                totalUpdated += data.updated_files;
                totalFiles += data.files_found;

                // Add discovered subfolders to the queue
                for (const sub of data.pending_folders) {
                    folderQueue.push({ id: sub.id, path: sub.path });
                }
            }
        }

        setSyncMessage(`Sync completato: ${foldersProcessed} cartelle, ${totalFiles} file trovati (${totalNew} nuovi, ${totalUpdated} aggiornati)`);
        await fetchFiles();

        // Check if there are pending files to process
        const { count } = await supabase
            .from('client_drive_files')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .eq('processing_status', 'pending');

        if (count && count > 0) {
            await handleProcess(count);
        } else {
            setPhase('done');
        }
    };

    /**
     * Process pending documents — calls in batches until done.
     */
    const handleProcess = async (initialTotal?: number) => {
        setPhase('processing');
        let totalProcessed = 0;
        const totalToProcess = initialTotal || files.filter(f => f.processing_status === 'pending' || f.processing_status === 'failed').length || 1;
        setProcessProgress({ processed: 0, total: totalToProcess });

        let remaining = 1;
        let stalledRounds = 0; // safety brake: bail out if we make no progress
        while (remaining > 0) {
            setSyncMessage(`Processamento documenti: ${totalProcessed}/${totalToProcess}...`);

            const { data, error } = await processDocuments(clientId);

            if (error) {
                setPhase('error');
                setSyncMessage(`Errore processamento: ${error}`);
                return;
            }

            if (!data) break;

            // Empty queue → done
            if (data.processed === 0 && data.remaining === 0) break;

            // Backend reported nothing processable (e.g. only `failed` files
            // left, which the auto-loop intentionally skips). Stop after one
            // empty round instead of looping forever.
            if (data.processed === 0) {
                stalledRounds++;
                if (stalledRounds >= 1) break;
            } else {
                stalledRounds = 0;
            }

            totalProcessed += data.processed;
            remaining = data.remaining;
            setProcessProgress({ processed: totalProcessed, total: totalToProcess });
            await fetchFiles();
        }

        setSyncMessage(`Completato: ${totalProcessed} documenti processati e indicizzati`);
        setPhase('done');
        await fetchFiles();
    };

    // Stats
    const stats = {
        total: files.length,
        completed: files.filter(f => f.processing_status === 'completed').length,
        pending: files.filter(f => f.processing_status === 'pending').length,
        failed: files.filter(f => f.processing_status === 'failed').length,
        skipped: files.filter(f => f.processing_status === 'skipped').length,
        totalChunks: files.reduce((sum, f) => sum + (f.chunk_count || 0), 0),
    };

    if (!hasDriveUrl) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center mb-2">
                    <HardDrive size={20} className="text-gray-400 mr-2" />
                    <h2 className="text-lg font-bold text-moca-black">Documenti Drive</h2>
                </div>
                <p className="text-sm text-moca-gray">
                    Configura il campo "Cartella Drive" nei dati anagrafici per abilitare la sincronizzazione documenti.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border-2 border-emerald-200 shadow-sm">
            {/* Header */}
            <div className="p-4 border-b border-emerald-100 bg-emerald-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <HardDrive size={20} className="text-emerald-600 mr-2" />
                        <h2 className="text-lg font-bold text-moca-black">Documenti Drive</h2>
                        {stats.total > 0 && (
                            <span className="ml-3 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                {stats.completed}/{stats.total} processati &middot; {stats.totalChunks} chunk
                            </span>
                        )}
                    </div>
                    {canManage && (
                        <button
                            onClick={handleSync}
                            disabled={phase === 'syncing' || phase === 'processing'}
                            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                            {phase === 'syncing' || phase === 'processing' ? (
                                <><Loader2 size={16} className="mr-2 animate-spin" />{phase === 'syncing' ? 'Sincronizzazione...' : 'Processamento...'}</>
                            ) : (
                                <><FolderSync size={16} className="mr-2" />Sincronizza da Drive</>
                            )}
                        </button>
                    )}
                </div>
                <p className="text-sm text-moca-gray mt-1">
                    Sincronizza e indicizza i documenti dalla cartella Google Drive del cliente per la ricerca AI
                </p>
            </div>

            {/* Status message */}
            {syncMessage && (
                <div className={`px-4 py-3 text-sm flex items-center gap-2 ${
                    phase === 'error' ? 'bg-red-50 text-red-700' :
                    phase === 'done' ? 'bg-emerald-50 text-emerald-700' :
                    'bg-blue-50 text-blue-700'
                }`}>
                    {phase === 'error' && <XCircle size={16} />}
                    {phase === 'done' && <CheckCircle2 size={16} />}
                    {(phase === 'syncing' || phase === 'processing') && <Loader2 size={16} className="animate-spin" />}
                    <span className="flex-1">{syncMessage}</span>

                    {phase === 'processing' && processProgress.total > 0 && (
                        <div className="w-32 ml-2">
                            <div className="w-full bg-blue-200 rounded-full h-1.5">
                                <div
                                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.round((processProgress.processed / processProgress.total) * 100))}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* File list */}
            <div className="p-4">
                {loading ? (
                    <div className="text-center py-6 text-moca-gray">
                        <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                        <p className="text-sm">Caricamento file...</p>
                    </div>
                ) : files.length === 0 ? (
                    <p className="text-center text-moca-gray text-sm py-6">
                        Nessun file sincronizzato. Clicca "Sincronizza da Drive" per iniziare.
                    </p>
                ) : (
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                        {files.map(file => (
                            <div key={file.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 text-sm">
                                {STATUS_ICONS[file.processing_status] || <FileText size={14} className="text-gray-400" />}
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-moca-black font-medium">{file.file_name}</p>
                                    {file.file_path && (
                                        <p className="text-xs text-moca-gray truncate">{file.file_path}</p>
                                    )}
                                </div>
                                <span className="text-xs text-moca-gray whitespace-nowrap">
                                    {MIME_LABELS[file.mime_type || ''] || file.mime_type?.split('/').pop() || ''}
                                </span>
                                {file.processing_status === 'completed' && file.chunk_count > 0 && (
                                    <span className="text-xs text-emerald-600 whitespace-nowrap">{file.chunk_count} chunk</span>
                                )}
                                {file.processing_status === 'failed' && (
                                    <span className="text-xs text-red-500 max-w-[200px] truncate" title={file.processing_error || ''}>
                                        {file.processing_error?.substring(0, 40)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {canManage && stats.failed > 0 && phase === 'idle' && (
                    <button onClick={() => handleProcess()} className="mt-3 flex items-center text-sm text-amber-700 hover:text-amber-800">
                        <RefreshCw size={14} className="mr-1" />
                        Riprova {stats.failed} file falliti
                    </button>
                )}
            </div>
        </div>
    );
}
