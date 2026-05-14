// Initializes the Supabase client (UMD build provides global `supabase`)
// and exposes it via `window.supabaseClient`.
(function () {
    const cfg = window.MAPS_HUB_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
        console.warn('[Maps Hub] Supabase config mancante. Verifica lib/config.js');
        return;
    }
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        console.error('[Maps Hub] Supabase UMD library non caricata');
        return;
    }
    window.supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    console.info('[Maps Hub] Supabase client pronto');
})();
