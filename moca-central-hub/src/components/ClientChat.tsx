import { useState, useRef, useEffect, useCallback } from 'react';
import {
    MessageSquare, Send, Loader2, FileText, Trash2,
    Bot, User, ChevronDown, RotateCcw, Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { chatRag } from '../lib/api';
import type { ClientChatMessage } from '../lib/types';

interface ClientChatProps {
    clientId: string;
    clientName: string;
}

interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Array<{ file_name: string; relevance_score: number }>;
    tokens_used?: number | null;
    created_at: string;
}

export function ClientChat({ clientId, clientName }: ClientChatProps) {
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [sessionId, setSessionId] = useState<string>(crypto.randomUUID());
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [sessions, setSessions] = useState<Array<{ session_id: string; first_message: string; created_at: string }>>([]);
    const [showSessions, setShowSessions] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => { scrollToBottom(); }, [messages]);

    // Load previous sessions
    const loadSessions = useCallback(async () => {
        const { data } = await supabase
            .from('client_chat_history')
            .select('session_id, content, created_at')
            .eq('client_id', clientId)
            .eq('role', 'user')
            .order('created_at', { ascending: false });

        if (data) {
            // Deduplicate by session_id, take first message of each
            const sessionMap = new Map<string, { session_id: string; first_message: string; created_at: string }>();
            for (const msg of data) {
                if (!sessionMap.has(msg.session_id)) {
                    sessionMap.set(msg.session_id, {
                        session_id: msg.session_id,
                        first_message: msg.content.substring(0, 80),
                        created_at: msg.created_at,
                    });
                }
            }
            setSessions(Array.from(sessionMap.values()).slice(0, 20));
        }
        setLoadingHistory(false);
    }, [clientId]);

    useEffect(() => { loadSessions(); }, [loadSessions]);

    // Load messages for a session
    const loadSession = async (sid: string) => {
        setSessionId(sid);
        setShowSessions(false);

        const { data } = await supabase
            .from('client_chat_history')
            .select('id, role, content, sources, tokens_used, created_at')
            .eq('session_id', sid)
            .eq('client_id', clientId)
            .in('role', ['user', 'assistant'])
            .order('created_at', { ascending: true });

        if (data) {
            setMessages(data.map(m => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                sources: m.sources || [],
                tokens_used: m.tokens_used,
                created_at: m.created_at,
            })));
        }
    };

    // New conversation
    const handleNewChat = () => {
        setSessionId(crypto.randomUUID());
        setMessages([]);
        setShowSessions(false);
        inputRef.current?.focus();
    };

    // Send message
    const handleSend = async () => {
        const text = input.trim();
        if (!text || sending) return;

        setInput('');
        setSending(true);

        // Add user message optimistically
        const userMsg: DisplayMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: text,
            created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMsg]);

        const { data, error } = await chatRag({
            client_id: clientId,
            message: text,
            session_id: sessionId,
        });

        if (error) {
            const errorMsg: DisplayMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: `Errore: ${error}`,
                created_at: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } else if (data) {
            // Update session_id if server provided one
            if (data.session_id) setSessionId(data.session_id);

            const assistantMsg: DisplayMessage = {
                id: `resp-${Date.now()}`,
                role: 'assistant',
                content: data.message,
                sources: data.sources,
                tokens_used: data.tokens_used,
                created_at: new Date().toISOString(),
            };
            setMessages(prev => [...prev, assistantMsg]);
        }

        setSending(false);
        loadSessions(); // refresh session list
    };

    // Handle Enter key
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Suggested prompts
    const suggestions = [
        'Quali servizi sono attivi attualmente?',
        'Riassumi il contratto in vigore',
        'Quali KPI sono stati concordati?',
        'Storico dei servizi negli anni',
    ];

    return (
        <div className="bg-white rounded-lg border-2 border-purple-200 shadow-sm flex flex-col" style={{ height: '600px' }}>
            {/* Header */}
            <div className="p-4 border-b border-purple-100 bg-purple-50 flex items-center justify-between shrink-0">
                <div className="flex items-center">
                    <MessageSquare size={20} className="text-purple-600 mr-2" />
                    <h2 className="text-lg font-bold text-moca-black">Chat AI</h2>
                    <span className="ml-3 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                        {clientName}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSessions(!showSessions)}
                        className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                        <ChevronDown size={14} className={showSessions ? 'rotate-180' : ''} />
                        Conversazioni
                    </button>
                    <button
                        onClick={handleNewChat}
                        className="flex items-center px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-xs font-medium transition-colors"
                    >
                        <Sparkles size={12} className="mr-1" />
                        Nuova
                    </button>
                </div>
            </div>

            {/* Session picker dropdown */}
            {showSessions && sessions.length > 0 && (
                <div className="border-b border-purple-100 bg-purple-50/50 max-h-[200px] overflow-y-auto shrink-0">
                    {sessions.map(s => (
                        <button
                            key={s.session_id}
                            onClick={() => loadSession(s.session_id)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-purple-100 transition-colors flex items-center gap-2 ${
                                s.session_id === sessionId ? 'bg-purple-100 font-medium' : ''
                            }`}
                        >
                            <MessageSquare size={12} className="text-purple-400 shrink-0" />
                            <span className="truncate flex-1">{s.first_message}</span>
                            <span className="text-xs text-moca-gray shrink-0">
                                {new Date(s.created_at).toLocaleDateString('it-IT')}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && !sending && (
                    <div className="flex flex-col items-center justify-center h-full text-moca-gray">
                        <Bot size={48} className="text-purple-300 mb-4" />
                        <p className="text-sm font-medium mb-1">Chiedi qualsiasi cosa su {clientName}</p>
                        <p className="text-xs mb-6">L'AI cercherà nei documenti sincronizzati dal Drive</p>

                        {/* Suggestions */}
                        <div className="grid grid-cols-2 gap-2 max-w-md">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                                    className="text-xs text-left p-2 rounded-md border border-purple-200 hover:bg-purple-50 text-purple-700 transition-colors"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                                <Bot size={16} className="text-purple-600" />
                            </div>
                        )}

                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                            <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                                msg.role === 'user'
                                    ? 'bg-purple-600 text-white rounded-br-sm'
                                    : 'bg-gray-100 text-moca-black rounded-bl-sm'
                            }`}>
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>

                            {/* Sources */}
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {msg.sources.map((src, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200"
                                            title={`Rilevanza: ${Math.round(src.relevance_score * 100)}%`}
                                        >
                                            <FileText size={10} />
                                            {src.file_name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Tokens */}
                            {msg.tokens_used && (
                                <p className="text-xs text-moca-gray mt-1">{msg.tokens_used} token</p>
                            )}
                        </div>

                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-moca-red-light flex items-center justify-center shrink-0">
                                <User size={16} className="text-moca-red" />
                            </div>
                        )}
                    </div>
                ))}

                {/* Typing indicator */}
                {sending && (
                    <div className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <Bot size={16} className="text-purple-600" />
                        </div>
                        <div className="bg-gray-100 rounded-xl px-4 py-3 rounded-bl-sm">
                            <div className="flex items-center gap-2 text-sm text-moca-gray">
                                <Loader2 size={14} className="animate-spin" />
                                Cerco nei documenti e genero la risposta...
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Chiedi qualcosa su ${clientName}...`}
                        className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400
                                   max-h-[120px] min-h-[40px]"
                        rows={1}
                        disabled={sending}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                        className="p-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700
                                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <p className="text-xs text-moca-gray mt-1.5">
                    Invio per mandare, Shift+Invio per nuova riga. Le risposte si basano sui documenti sincronizzati dal Drive.
                </p>
            </div>
        </div>
    );
}
