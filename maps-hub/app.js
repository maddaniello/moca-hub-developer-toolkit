// ========================================
// Global State & Constants
// ========================================
// MOCA_HUB_URL, APP_ID, APP_NAME definiti in lib/constants.js (window.*)

const state = {
  moca: null,
  currentMode: 'brand',
  searchResults: [],
  selectedPlaces: [],
  scrapeResults: null,
  activeTab: 'overview',
  searchRunId: null,
  scrapeRunId: null,
  placesMetadata: [], // Store metadata for check-scrape context
  customPrompts: {}, // Prompts personalizzati caricati da Supabase (app_prompts)
  knowledge: {}      // Knowledge base del client (client_knowledge)
};

// ========================================
// Application Initialization
// ========================================
(async function init() {
  console.log('[GMRS] Initializing application...');

  // Initialize Moca SDK
  state.moca = new MocaSDK(window.MOCA_HUB_URL);

  // Check for local development environment
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (isLocal) {
    console.warn('[GMRS] Running in LOCAL DEV MODE - Bypassing Authentication');

    // Mock session data for local testing
    state.moca.session = {
      client: { id: 'demo-client-id', name: 'Local Test Client', email: 'demo@moca.it', logo_url: '' },
      user: { id: 'demo-user-id', name: 'Local Developer', role: 'Admin' },
      configurations: {
        'OPENAI_API_KEY': '', // <--- INSERISCI QUI LA TUA CHIAVE OPENAI PER TEST LOCALI
        'APIFY_API_KEY': ''   // <--- INSERISCI QUI LA TUA CHIAVE APIFY PER TEST LOCALI
      }
    };

    // Skip real init
    // authenticated = true effectively
  } else {
    // Normal Production Flow
    const authenticated = await state.moca.init();

    if (!authenticated) {
      state.moca.showAccessDenied();
      return;
    }
  }

  console.log('[GMRS] Authentication successful (or bypassed locally)');

  // Show app
  document.getElementById('app').style.display = 'block';

  // Populate client branding
  const client = state.moca.getClient() || { name: 'Moca Client', logo_url: '' };
  const user = state.moca.getUser() || { name: 'User', role: 'Guest' };

  // Client logo in header center
  const clientLogo = document.getElementById('client-logo');
  if (client.logo_url) {
    clientLogo.src = client.logo_url;
    clientLogo.style.display = 'block';
  } else {
    clientLogo.style.display = 'none';
  }

  // Setup event listeners
  setupEventListeners();

  // Dark mode toggle
  document.getElementById('btn-dark-mode').addEventListener('click', toggleDarkMode);

  // Carica prompt personalizzati e knowledge dal client corrente (Supabase)
  loadCustomPromptsAndKnowledge();

  // Initial icon render
  lucide.createIcons();

  console.log('[GMRS] Application ready');
})();

// ========================================
// Carica Prompt Personalizzati e Knowledge da Supabase
// ========================================
async function loadCustomPromptsAndKnowledge() {
  const client = state.moca.getClient();
  if (!client?.id || !window.supabaseClient) return;

  try {
    // Carica prompt custom
    const { data: promptsData, error: promptsError } = await window.supabaseClient
      .from('app_prompts')
      .select('prompt_key, prompt_value')
      .eq('client_id', String(client.id))
      .eq('app_id', window.APP_ID);

    if (promptsError) {
      console.error('[Maps Hub] Errore caricamento prompts:', promptsError.message);
    } else if (promptsData) {
      const map = {};
      promptsData.forEach(row => { map[row.prompt_key] = row.prompt_value; });
      state.customPrompts = map;
      console.log('[Maps Hub] Prompts custom caricati:', Object.keys(map).length);
    }

    // Carica knowledge base
    const { data: knowledgeData, error: knowledgeError } = await window.supabaseClient
      .from('client_knowledge')
      .select('field_key, field_value')
      .eq('client_id', String(client.id));

    if (knowledgeError) {
      console.error('[Maps Hub] Errore caricamento knowledge:', knowledgeError.message);
    } else if (knowledgeData) {
      const map = {};
      knowledgeData.forEach(row => { map[row.field_key] = row.field_value || ''; });
      state.knowledge = map;
      console.log('[Maps Hub] Campi knowledge caricati:', Object.keys(map).length);
    }
  } catch (e) {
    console.error('[Maps Hub] Errore loadCustomPromptsAndKnowledge:', e);
  }
}

// Restituisce il prompt effettivo (custom se esiste, default altrimenti).
function getEffectivePrompt(key) {
  if (state.customPrompts[key]) return state.customPrompts[key];
  const def = (window.PROMPT_DEFINITIONS || []).find(d => d.key === key);
  return def ? def.defaultValue : '';
}

// ========================================
// Event Listeners Setup
// ========================================
function setupEventListeners() {
  // Mode toggle
  document.getElementById('mode-brand').addEventListener('click', () => switchMode('brand'));
  document.getElementById('mode-url').addEventListener('click', () => switchMode('url'));

  // Location selector
  document.getElementById('location').addEventListener('change', (e) => {
    const customGroup = document.getElementById('custom-location-group');
    customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
  });

  // AI toggle
  document.getElementById('enable-ai').addEventListener('change', (e) => {
    document.getElementById('ai-config').style.display = e.target.checked ? 'block' : 'none';
  });

  // Main actions
  document.getElementById('btn-search').addEventListener('click', handleSearch);
  document.getElementById('btn-select-all').addEventListener('click', () => toggleAllPlaces(true));
  document.getElementById('btn-deselect-all').addEventListener('click', () => toggleAllPlaces(false));
  document.getElementById('btn-start-scrape').addEventListener('click', handleStartScrape);

  // Export actions
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);

  // History modal
  document.getElementById('btn-history').addEventListener('click', openHistoryModal);
  document.getElementById('modal-close').addEventListener('click', closeHistoryModal);
  document.getElementById('btn-clear-history').addEventListener('click', clearAllHistory);

  // Close modal on outside click
  document.getElementById('history-modal').addEventListener('click', (e) => {
    if (e.target.id === 'history-modal') closeHistoryModal();
  });

  // Settings modal (Prompt AI)
  document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
  document.getElementById('settings-modal-close').addEventListener('click', closeSettingsModal);
  document.getElementById('settings-modal').addEventListener('click', (e) => {
    if (e.target.id === 'settings-modal') closeSettingsModal();
  });
}

// ========================================
// Mode Switching
// ========================================
function switchMode(mode) {
  state.currentMode = mode;

  // Update buttons
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`mode-${mode}`).classList.add('active');

  // Update content
  document.getElementById('brand-mode').style.display = mode === 'brand' ? 'block' : 'none';
  document.getElementById('url-mode').style.display = mode === 'url' ? 'block' : 'none';
}

// ========================================
// Search Places
// ========================================
async function handleSearch() {
  const btn = document.getElementById('btn-search');
  btn.disabled = true;
  // Use Lucide loader icon
  btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Ricerca in corso...';
  lucide.createIcons();

  try {
    // Get API keys from Moca SDK
    const apifyKey = state.moca.getConfig('APIFY_API_KEY');

    if (!apifyKey) {
      alert('⚠️ Apify API Key non configurata. Vai su Moca Hub → Configurations');
      return;
    }

    // Show progress
    showStep(3);
    updateProgress(10, 'Avvio ricerca...');

    let response;

    if (state.currentMode === 'brand') {
      // Brand search mode
      const brandName = document.getElementById('brand-name').value.trim();
      if (!brandName) {
        alert('Inserisci un nome brand');
        return;
      }

      const location = document.getElementById('location').value;
      const customLocation = document.getElementById('custom-location').value.trim();
      const maxPlaces = parseInt(document.getElementById('max-places').value);
      const searchMode = document.getElementById('search-mode').value;
      const skipClosed = document.getElementById('skip-closed').checked;

      let locationValue = location === 'custom' ? customLocation : location;

      response = await fetch('/.netlify/functions/search-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apifyApiKey: apifyKey,
          brandName,
          location: locationValue,
          maxPlaces,
          searchMode,
          skipClosed
        })
      });
    } else {
      // URL mode
      const urls = document.getElementById('manual-urls').value
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      if (urls.length === 0) {
        alert('Inserisci almeno un URL');
        return;
      }

      response = await fetch('/.netlify/functions/parse-manual-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      });
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Search failed');
    }

    if (state.currentMode === 'brand') {
      // Start polling for brand search
      state.searchRunId = data.runId;
      await pollSearchStatus();
    } else {
      // URL mode returns places directly
      state.searchResults = data.places;
      displayPlaces();
    }

  } catch (error) {
    console.error('Search error:', error);
    alert(`Errore durante la ricerca: ${error.message}`);
    showStep(1);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="search"></i> Cerca Schede';
    lucide.createIcons();
  }
}

// ========================================
// Poll Search Status
// ========================================
async function pollSearchStatus() {
  const apifyKey = state.moca.getConfig('APIFY_API_KEY');
  const maxAttempts = 150; // ~5 minutes max (2s interval)
  let attempts = 0;

  const poll = async () => {
    attempts++;
    const elapsed = Math.round(attempts * 2);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    updateProgress(Math.min(45, 10 + (attempts / maxAttempts) * 40), `Ricerca in corso... ${timeStr}`);

    const response = await fetch('/.netlify/functions/check-search-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apifyApiKey: apifyKey,
        runId: state.searchRunId
      })
    });

    const data = await response.json();

    if (data.status === 'SUCCEEDED') {
      updateProgress(50, 'Ricerca completata!');
      state.searchResults = data.places;
      displayPlaces();
      return;
    }

    if (data.status === 'FAILED') {
      throw new Error(data.error || 'Search failed');
    }

    if (attempts >= maxAttempts) {
      throw new Error('Search timeout');
    }

    setTimeout(poll, 2000);
  };

  await poll();
}

// ========================================
// Display Places for Selection
// ========================================
function displayPlaces() {
  const list = document.getElementById('places-list');
  list.innerHTML = '';

  if (state.searchResults.length === 0) {
    list.innerHTML = '<p class="empty-state">Nessuna scheda trovata</p>';
    showStep(1);
    return;
  }

  state.searchResults.forEach((place, index) => {
    const item = document.createElement('div');
    item.className = 'place-item';
    item.innerHTML = `
      <input type="checkbox" id="place-${index}" checked>
      <div class="place-info">
        <div class="place-title">${place.title}</div>
        <div class="place-details">
          ${place.address ? place.address + ' • ' : ''}
          ${place.rating ? `<span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="star" style="width:14px;height:14px;fill:#facc15;color:#facc15;"></i> ${place.rating}</span>` : ''} 
          ${place.reviewsCount ? ` • <span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="message-circle" style="width:14px;height:14px;"></i> ${place.reviewsCount}</span>` : ''}
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  // Initialize icons for the new content
  lucide.createIcons();

  showStep(2);
}

// ========================================
// Toggle All Places
// ========================================
function toggleAllPlaces(checked) {
  document.querySelectorAll('.place-item input[type="checkbox"]').forEach(cb => {
    cb.checked = checked;
  });
}

// ========================================
// Start Scraping
// ========================================
async function handleStartScrape() {
  // Get selected places
  const selectedIndices = [];
  document.querySelectorAll('.place-item input[type="checkbox"]').forEach((cb, idx) => {
    if (cb.checked) selectedIndices.push(idx);
  });

  if (selectedIndices.length === 0) {
    alert('Seleziona almeno una scheda');
    return;
  }

  state.selectedPlaces = selectedIndices.map(i => state.searchResults[i]);

  showStep(3);
  updateProgress(0, 'Avvio scraping...');

  try {
    const apifyKey = state.moca.getConfig('APIFY_API_KEY');
    const maxReviews = state.currentMode === 'brand'
      ? parseInt(document.getElementById('max-reviews').value)
      : parseInt(document.getElementById('max-reviews-url').value);

    // Start scrape - pass places with their original URLs
    const response = await fetch('/.netlify/functions/start-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apifyApiKey: apifyKey,
        places: state.selectedPlaces,
        maxReviews
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to start scrape');
    }

    state.scrapeRunId = data.runId;
    state.placesMetadata = data.placesMetadata || state.selectedPlaces;
    await pollScrapeStatus();

  } catch (error) {
    console.error('Scrape error:', error);
    alert(`Errore durante lo scraping: ${error.message}`);
    showStep(2);
  }
}

// ========================================
// Poll Scrape Status
// ========================================
async function pollScrapeStatus() {
  const apifyKey = state.moca.getConfig('APIFY_API_KEY');
  const aiEnabled = document.getElementById('enable-ai').checked;
  const openaiKey = aiEnabled ? state.moca.getConfig('OPENAI_API_KEY') : null;
  const openaiModel = document.getElementById('openai-model').value;

  if (aiEnabled && !openaiKey) {
    alert('⚠️ OpenAI API Key non configurata. Vai su Moca Hub → Configurations');
    return;
  }

  const maxAttempts = 200; // ~10 minutes max (3s interval)
  let attempts = 0;

  const poll = async () => {
    attempts++;
    const elapsed = Math.round(attempts * 3);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    updateProgress(
      Math.min(90, 10 + (attempts / maxAttempts) * 80),
      `Scraping in corso... ${timeStr} trascorsi`
    );

    const response = await fetch('/.netlify/functions/check-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apifyApiKey: apifyKey,
        runId: state.scrapeRunId,
        // AI params removed from here - handled client side now
      })
    });

    const data = await response.json();

    if (data.status === 'SUCCEEDED') {
      state.scrapeResults = data.results;

      // Start AI analysis if enabled
      if (aiEnabled) {
        updateProgress(100, 'Scraping Completato! Avvio Analisi AI...');
        // Create initial UI structure but keep loading/progress overlay
        // We do NOT call displayResults() here to avoid "jumping"
        await performAIAnalysis(openaiKey, openaiModel);
      } else {
        updateProgress(100, 'Scraping Completato!');
        displayResults();
        saveToHistory();
      }
      return;
    }

    if (data.status === 'FAILED') {
      throw new Error(data.error || 'Scrape failed');
    }

    if (attempts >= maxAttempts) {
      throw new Error('Scrape timeout - troppo tempo trascorso (10 min)');
    }

    setTimeout(poll, 3000);
  };

  await poll();
}

// ========================================
// Client-Side AI Analysis Orchestration
// ========================================
async function performAIAnalysis(openaiKey, openaiModel) {
  const { places } = state.scrapeResults;
  const total = places.length;
  // Get sampling state (default to true if element missing for safety)
  const samplingElement = document.getElementById('ai-sampling');
  const samplingEnabled = samplingElement ? samplingElement.checked : true;

  // Show analysis progress bar
  const progressContainer = document.querySelector('.progress-container');
  if (progressContainer) progressContainer.style.display = 'block';

  updateProgress(0, `Avvio analisi AI su ${total} schede (${samplingEnabled ? 'Campionamento' : 'Full'})...`);

  // Analyze each place sequentially (or small batch) to avoid browser network limit
  // Parallelizing 3 at a time is usually safe
  const batchSize = 3;

  for (let i = 0; i < total; i += batchSize) {
    const batch = places.slice(i, i + batchSize);

    // Update progress text regarding current batch
    updateProgress(
      Math.round((i / total) * 90),
      `Analisi in corso: ${batch.map(p => p.title).join(', ')}...`
    );

    const promises = batch.map(async (place) => {
      // Skip if no reviews or already analyzed
      if (!place.reviews || place.reviews.length === 0 || place.analysis) return;

      try {
        const response = await fetch('/.netlify/functions/analyze-place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            openaiApiKey: openaiKey,
            openaiModel: openaiModel,
            placeName: place.title,
            reviews: place.reviews,
            samplingEnabled: samplingEnabled,
            // Custom prompts (vuoti -> la function usa i default)
            customPrompt: getEffectivePrompt('place_analysis_prompt'),
            customSystemPrompt: getEffectivePrompt('place_analysis_system')
          })
        });

        const data = await response.json();

        if (data.success && data.analysis) {
          place.analysis = data.analysis;
        }
      } catch (e) {
        console.error(`AI analysis failed for ${place.title}`, e);
      }
    });

    await Promise.all(promises);
  }

  // Update progress before aggregate analysis
  const percentComplete = 90;
  updateProgress(percentComplete, 'Generazione report strategico Brand...');

  // After all individual places, do aggregated analysis
  updateProgress(90, 'Analisi aggregata Brand...');

  try {
    // Prepare ALL reviews flat list
    const allReviews = places.flatMap(p => p.reviews);
    const brandName = places[0]?.title?.split('-')[0]?.trim() || 'Brand'; // Heuristic

    const response = await fetch('/.netlify/functions/analyze-aggregated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openaiApiKey: openaiKey,
        openaiModel: openaiModel,
        reviews: allReviews,
        brandName: brandName,
        totalPlaces: total,
        samplingEnabled: samplingEnabled, // Pass sampling preference
        // Custom prompts (vuoti -> la function usa i default)
        customPrompt: getEffectivePrompt('aggregated_analysis_prompt'),
        customSystemPrompt: getEffectivePrompt('aggregated_analysis_system')
      })
    });

    const data = await response.json();
    if (data.success && data.analysis) {
      // Attach to aggregateStats or root
      if (!state.scrapeResults.aggregateStats.aiStats) {
        state.scrapeResults.aggregateStats.aiStats = {};
      }
      state.scrapeResults.aggregateStats.aiStats.analysis = data.analysis;
    }

  } catch (e) {
    console.error('Aggregated analysis failed', e);
  }

  updateProgress(100, 'Analisi AI Completata!');

  // Final display of ALL results and persist to history
  displayResults();
  saveToHistory();

  // Hide progress after a delay
  setTimeout(() => {
    if (progressContainer) progressContainer.style.display = 'none';
  }, 2000);
}

// ========================================
// Display Results
// ========================================
function displayResults() {
  const { places, aggregateStats } = state.scrapeResults;

  // Create tabs
  const tabsNav = document.getElementById('tabs-nav');
  const tabsContent = document.getElementById('tabs-content');

  tabsNav.innerHTML = '';
  tabsContent.innerHTML = '';

  // Overview tab
  const overviewTab = createTabButton('overview', 'Panoramica', true);
  tabsNav.appendChild(overviewTab);

  const overviewContent = createOverviewTab(aggregateStats, places);
  tabsContent.appendChild(overviewContent);

  // Individual place tabs
  places.forEach((place, idx) => {
    const placeTab = createTabButton(`place-${idx}`, `📍 ${place.title}`);
    tabsNav.appendChild(placeTab);

    const placeContent = createPlaceTab(place, idx);
    tabsContent.appendChild(placeContent);
  });

  lucide.createIcons();
  showStep(4);
}

// ========================================
// Create Tab Button
// ========================================
function createTabButton(id, label, active = false) {
  const btn = document.createElement('button');
  btn.className = `tab-btn ${active ? 'active' : ''}`;
  // Handle icons in labels if passed as text/html
  btn.innerHTML = label;
  btn.onclick = (e) => switchTab(id, e);
  return btn;
}

// ========================================
// Switch Tab
// ========================================
function switchTab(tabId, event) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }

  // Update content
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  const targetContent = document.getElementById(`tab-${tabId}`);
  if (targetContent) {
    targetContent.classList.add('active');
  } else {
    console.warn(`Tab content not found for id: tab-${tabId}`);
  }
}

// ========================================
// Create Overview Tab
// ========================================
function createOverviewTab(stats, places) {
  const div = document.createElement('div');
  div.id = 'tab-overview';
  div.className = 'tab-content active';

  // Statistics grid
  div.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.totalPlaces}</div>
        <div class="stat-label">Schede Analizzate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalReviews}</div>
        <div class="stat-label">Totale Recensioni</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgRating}</div>
        <div class="stat-label">Rating Medio</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.reviewsWithText}</div>
        <div class="stat-label">Con Testo</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.reviewsWithResponse}</div>
        <div class="stat-label">Con Risposta</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.sentiment.positivePercent}%</div>
        <div class="stat-label">Positive</div>
      </div>
    </div>
    
    <div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">Distribuzione Stelle</div>
        <div class="chart-bars">
          ${[5, 4, 3, 2, 1].map(stars => {
    const count = stats.distribution[stars] || 0;
    const percent = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
    return `
              <div class="chart-bar-row">
                <div class="chart-bar-label" style="display:flex;align-items:center;gap:4px;">${stars} <i data-lucide="star" style="width:12px;height:12px;"></i></div>
                <div class="chart-bar-container">
                  <div class="chart-bar-fill" style="width: ${percent}%">
                    <span class="chart-bar-value">${count}</span>
                  </div>
                </div>
              </div>
            `;
  }).join('')}
        </div>
      </div>
      
      <div class="chart-container">
        <div class="chart-title">Sentiment</div>
        <div class="chart-bars">
          <div class="chart-bar-row">
            <div class="chart-bar-label">Positive</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${stats.sentiment.positivePercent}%; background: #22c55e;">
                <span class="chart-bar-value">${stats.sentiment.positive}</span>
              </div>
            </div>
          </div>
          <div class="chart-bar-row">
            <div class="chart-bar-label">Neutre</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${stats.sentiment.neutralPercent}%; background: #f59e0b;">
                <span class="chart-bar-value">${stats.sentiment.neutral}</span>
              </div>
            </div>
          </div>
          <div class="chart-bar-row">
            <div class="chart-bar-label">Negative</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${stats.sentiment.negativePercent}%; background: #ef4444;">
                <span class="chart-bar-value">${stats.sentiment.negative}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add AI section if available (Updated for new Client-Side AI)
  if (stats.aiStats && stats.aiStats.analysis) {
    const aiSection = createAISection(stats.topKeywords, stats.aiStats.analysis, true);
    div.appendChild(aiSection);
  } else if (places.some(p => p.analysis)) {
    // Fallback if partial analysis exists but not aggregated yet
    const aiSection = createAISection(stats.topKeywords, null, true);
    div.appendChild(aiSection);
  }

  return div;
}

// ========================================
// Create Place Tab
// ========================================
function createPlaceTab(place, index) {
  const div = document.createElement('div');
  div.id = `tab-place-${index}`;
  div.className = 'tab-content';

  // Calculate place-specific stats
  const reviews = place.reviews || [];
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const sentiment = { positive: 0, neutral: 0, negative: 0 };

  reviews.forEach(r => {
    const stars = r.stars || 0;
    if (stars >= 1 && stars <= 5) {
      distribution[stars]++;
      if (stars >= 4) sentiment.positive++;
      else if (stars === 3) sentiment.neutral++;
      else sentiment.negative++;
    }
  });

  const reviewsWithText = reviews.filter(r => r.text && r.text.trim().length > 0).length;
  const reviewsWithResponse = reviews.filter(r => r.responseFromOwner && r.responseFromOwner.trim().length > 0).length;

  const totalReviews = reviews.length;
  const positivePercent = totalReviews > 0 ? Math.round((sentiment.positive / totalReviews) * 100) : 0;
  const neutralPercent = totalReviews > 0 ? Math.round((sentiment.neutral / totalReviews) * 100) : 0;
  const negativePercent = totalReviews > 0 ? Math.round((sentiment.negative / totalReviews) * 100) : 0;

  // Helper for Maps Link
  const mapsLink = place.url ? `<a href="${place.url}" target="_blank" style="color: var(--moca-red); text-decoration: none; font-weight: bold; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="map-pin" style="width:14px;height:14px;"></i> Apri su Google Maps</a>` : '';
  const address = place.address || place.subTitle || 'Indirizzo non disponibile';

  div.innerHTML = `
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--white); border-radius: 8px; border: 1px solid var(--moca-gray-light);">
        <h3 style="margin-bottom: 0.5rem; color: var(--moca-black);">${place.title}</h3>
        <p style="color: var(--moca-gray); margin-bottom: 0.5rem;">${address}</p>
        ${mapsLink}
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${place.rating || 'N/A'}</div>
        <div class="stat-label">Rating</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalReviews}</div>
        <div class="stat-label">Recensioni</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${reviewsWithText}</div>
        <div class="stat-label">Con Testo</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${reviewsWithResponse}</div>
        <div class="stat-label">Con Risposta</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${positivePercent}%</div>
        <div class="stat-label">Positive</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${negativePercent}%</div>
        <div class="stat-label">Negative</div>
      </div>
    </div>
    
    <div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">Distribuzione Stelle</div>
        <div class="chart-bars">
          ${[5, 4, 3, 2, 1].map(stars => {
    const count = distribution[stars] || 0;
    const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
    return `
              <div class="chart-bar-row">
                <div class="chart-bar-label" style="display:flex;align-items:center;gap:4px;">${stars} <i data-lucide="star" style="width:12px;height:12px;"></i></div>
                <div class="chart-bar-container">
                  <div class="chart-bar-fill" style="width: ${percent}%">
                    <span class="chart-bar-value">${count}</span>
                  </div>
                </div>
              </div>
            `;
  }).join('')}
        </div>
      </div>
      
      <div class="chart-container">
        <div class="chart-title">Sentiment</div>
        <div class="chart-bars">
          <div class="chart-bar-row">
            <div class="chart-bar-label">Positive</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${positivePercent}%; background: #22c55e;">
                <span class="chart-bar-value">${sentiment.positive}</span>
              </div>
            </div>
          </div>
          <div class="chart-bar-row">
            <div class="chart-bar-label">Neutre</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${neutralPercent}%; background: #f59e0b;">
                <span class="chart-bar-value">${sentiment.neutral}</span>
              </div>
            </div>
          </div>
          <div class="chart-bar-row">
            <div class="chart-bar-label">Negative</div>
            <div class="chart-bar-container">
              <div class="chart-bar-fill" style="width: ${negativePercent}%; background: #ef4444;">
                <span class="chart-bar-value">${sentiment.negative}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add AI section if available
  if (place.analysis) {
    const keywords = extractKeywordsFromReviews(reviews.filter(r => r.text));
    const aiSection = createAISection(keywords, place.analysis, false);
    div.appendChild(aiSection);
  }

  return div;
}

// ========================================
// Create AI Section
// ========================================
function createAISection(keywords, analysis, isOverview) {
  const section = document.createElement('div');
  section.className = 'ai-section-results';

  let html = '<h3><i data-lucide="bot" style="display:inline-block;width:24px;height:24px;"></i> Analisi AI</h3>';

  // Wordcloud Block
  html += `
    <div class="ai-card">
        <div class="ai-card-title">
            <i data-lucide="cloud"></i> Parole Chiave
        </div>
        <div class="wordcloud">
            ${keywords.slice(0, 30).map(item => {
    const size = Math.max(0.8, Math.min(2, item.count / 10));
    // Different styling for wordcloud items is handled in CSS
    return `<span class="wordcloud-item" style="font-size: ${size}rem">${item.word} (${item.count})</span>`;
  }).join('')}
        </div>
    </div>
  `;

  // Analysis (if available for individual place)
  if (analysis) {
    // Temi Principali Block
    if (analysis.temi_principali && analysis.temi_principali.length > 0) {
      html += `
        <div class="ai-card">
            <div class="ai-card-title">
                <i data-lucide="hash"></i> Temi principali
            </div>
            <div class="themes-grid">
                ${analysis.temi_principali.map((tema, i) => `
                    <div class="theme-tag">
                        <span class="theme-number">${i + 1}</span>
                        ${tema}
                    </div>
                `).join('')}
            </div>
        </div>
        `;
    }

    // Priorities Block
    if (analysis.priorities && analysis.priorities.length > 0) {
      html += `
        <div class="ai-card">
            <div class="ai-card-title">
                <i data-lucide="target"></i> Top 3 Priorità
            </div>
            <ol class="ai-list" style="list-style-position: inside;">
            ${analysis.priorities.map(p => `<li>${p}</li>`).join('')}
            </ol>
        </div>
        `;
    }

    // SWOT / Qualitative Analysis Block
    html += `
      <div class="ai-card">
        <div class="ai-card-title">
            <i data-lucide="bar-chart-2"></i> Analisi Qualitativa
        </div>
        <div class="analysis-grid">
            <div class="analysis-sub-section">
                <h5 class="text-success" style="display:flex;align-items:center;gap:6px;font-size:1rem;margin-bottom:12px;">
                    <i data-lucide="check-circle-2" style="width:18px;height:18px;"></i> Punti di Forza
                </h5>
                <ul class="ai-list">
                    ${(analysis.strengths || []).map(s => `<li>${s}</li>`).join('')}
                </ul>
            </div>
            <div class="analysis-sub-section">
                <h5 class="text-warning" style="display:flex;align-items:center;gap:6px;font-size:1rem;margin-bottom:12px;">
                    <i data-lucide="alert-triangle" style="width:18px;height:18px;"></i> Aree di Miglioramento
                </h5>
                <ul class="ai-list">
                    ${(analysis.weaknesses || []).map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>
        </div>
      </div>
    `;

    // Strategic Recommendations Block
    html += `
      <div class="ai-card">
        <div class="ai-card-title" style="color:var(--moca-red);">
            <i data-lucide="lightbulb"></i> Raccomandazioni Strategiche
        </div>
        <ul class="ai-list">
          ${(analysis.recommendations || []).map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    `;

    // Actionable Suggestions Block
    html += `
      <div class="ai-card">
        <div class="ai-card-title">
            <i data-lucide="rocket"></i> Suggerimenti Azionabili
        </div>
        <ul class="ai-list">
          ${(analysis.suggestions || []).map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
    `;

    // Positive Examples
    if (analysis.esempi_positivi && analysis.esempi_positivi.length > 0) {
      html += `
        <div class="ai-card" style="border-left: 4px solid var(--success);">
            <div class="ai-card-title" style="color: var(--success);">
                <i data-lucide="thumbs-up"></i> Esempi Positivi
            </div>
            <ul style="list-style: none; padding: 0;">
                ${analysis.esempi_positivi.map(e => `
                    <li style="margin-bottom: 1rem; background: rgba(34, 197, 94, 0.05); padding: 12px; border-radius: 6px;">
                        <div style="font-weight: bold; font-size: 0.85rem; margin-bottom: 4px; display:flex;align-items:center;gap:4px;color:var(--success);">
                            ${e.stars || 5} <i data-lucide="star" style="width:12px;height:12px;fill:currentColor;"></i>
                        </div>
                        <div style="font-style:italic;color:#374151;">"${e.text}"</div>
                    </li>
                `).join('')}
            </ul>
        </div>
        `;
    }

    // Negative Examples
    if (analysis.esempi_negativi && analysis.esempi_negativi.length > 0) {
      html += `
        <div class="ai-card" style="border-left: 4px solid var(--danger);">
            <div class="ai-card-title" style="color: var(--danger);">
                <i data-lucide="thumbs-down"></i> Esempi Negativi
            </div>
            <ul style="list-style: none; padding: 0;">
                ${analysis.esempi_negativi.map(e => `
                    <li style="margin-bottom: 1rem; background: rgba(239, 68, 68, 0.05); padding: 12px; border-radius: 6px;">
                        <div style="font-weight: bold; font-size: 0.85rem; margin-bottom: 4px; display:flex;align-items:center;gap:4px;color:var(--danger);">
                            ${e.stars || 1} <i data-lucide="star" style="width:12px;height:12px;fill:currentColor;"></i>
                        </div>
                        <div style="font-style:italic;color:#374151;">"${e.text}"</div>
                    </li>
                `).join('')}
            </ul>
        </div>
        `;
    }
  }

  section.innerHTML = html;
  return section;
}

// ========================================
// Extract Keywords from Reviews
// ========================================
function extractKeywordsFromReviews(reviews) {
  const stopwords = new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'a', 'da', 'in', 'con', 'su', 'per',
    'tra', 'fra', 'e', 'ed', 'anche', 'se', 'ma', 'però', 'che', 'chi', 'cui', 'quale', 'quando',
    'dove', 'come', 'perché', 'perchè', 'questo', 'quello', 'questi', 'quelli', 'questa', 'quella',
    'molto', 'poco', 'più', 'meno', 'tanto', 'troppo', 'tutto', 'ogni', 'ciascuno', 'alcuni',
    'essere', 'avere', 'fare', 'stare', 'andare', 'venire', 'dovere', 'potere', 'volere', 'sapere',
    'sono', 'è', 'ho', 'ha', 'hanno', 'era', 'erano', 'stato', 'stati', 'stata', 'state', 'fatto',
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are',
    'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'it', 'its', 'my',
    'your', 'his', 'her', 'their', 'our', 'me', 'you', 'him', 'she', 'them', 'us', 'non', 'mi'
  ]);

  const wordCounts = new Map();

  reviews.forEach(review => {
    if (!review.text) return;

    const words = review.text.toLowerCase()
      .replace(/[^\w\sàèéìòù]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 4 && !stopwords.has(word) && !/^\d+$/.test(word));

    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });

  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }));
}

// ========================================
// Export Functions
// ========================================
function exportJSON() {
  const data = JSON.stringify(state.scrapeResults, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gmrs-results-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const { places } = state.scrapeResults;

  const headers = [
    'Place Name', 'Address', 'Total Rating', 'Reviews Count', 'URL',
    'Review ID', 'Author Name', 'Author URL', 'Review Text',
    'Stars', 'Published Date', 'Response Text', 'Likes Count'
  ];

  let csv = headers.join(',') + '\n';

  places.forEach(place => {
    place.reviews.forEach(review => {
      const row = [
        escapeCSV(place.title),
        escapeCSV(place.address),
        place.rating || '',
        place.totalReviews || '',
        escapeCSV(place.url),
        escapeCSV(review.id),
        escapeCSV(review.authorName),
        escapeCSV(review.authorUrl),
        escapeCSV(review.text),
        review.stars || '',
        review.publishedAtDate || '',
        escapeCSV(review.responseFromOwner),
        review.likesCount || ''
      ];
      csv += row.join(',') + '\n';
    });
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gmrs-results-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(str) {
  if (!str) return '';
  str = str.toString().replace(/"/g, '""');
  return `"${str}"`;
}

async function exportPDF() {
  const btn = document.getElementById('btn-export-pdf');
  const originalText = btn.innerHTML; // Note: using innerHTML to save icon state
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Generazione...';
  lucide.createIcons();

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;
    const lineHeight = 7;

    function checkPageBreak(add = 0) {
      if (y + add > 280) {
        doc.addPage();
        y = 20;
      }
    }

    function stripEmojis(str) {
      if (!str) return '';
      return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F0F5}\u{1F200}-\u{1F270}\u{2600}-\u{26FF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25FE}\u{25FD}\u{25FC}\u{25FB}\u{25FA}\u{2500}-\u{257F}]/gu, '')
        .trim();
    }

    function addHeader(text, size = 16) {
      checkPageBreak(15);
      doc.setFontSize(size);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(229, 34, 23); // Moca Red
      doc.text(stripEmojis(text), margin, y);
      y += 10;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    }

    function addSection(title, items) {
      if (!items || items.length === 0) return;
      checkPageBreak(items.length * 6 + 15);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(stripEmojis(title), margin, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      items.forEach(item => {
        const cleanItem = stripEmojis(item);
        const lines = doc.splitTextToSize(`• ${cleanItem}`, pageWidth - (margin * 2));
        checkPageBreak(lines.length * 5);
        doc.text(lines, margin, y);
        y += lines.length * 5;
      });
      y += 5;
    }

    // --- COVER & OVERVIEW ---
    doc.setFontSize(22);
    doc.setTextColor(229, 34, 23);
    doc.text('Google Maps Reviews Analysis', margin, y);
    y += 10;

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Cliente: ${stripEmojis(state.moca.getClient().name)}`, margin, y);
    y += 6;
    doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, margin, y);
    y += 15;

    // Aggregate Stats
    const stats = state.scrapeResults.aggregateStats;
    addHeader('Panoramica Globale', 16);
    doc.text(`Schede Analizzate: ${stats.totalPlaces}`, margin, y); y += 6;
    doc.text(`Totale Recensioni: ${stats.totalReviews}`, margin, y); y += 6;
    doc.text(`Rating Medio: ${stats.avgRating} / 5.0`, margin, y); y += 6;
    doc.text(`Sentiment: ${stats.sentiment.positivePercent}% Pos, ${stats.sentiment.negativePercent}% Neg`, margin, y); y += 12;

    // Aggregate AI
    if (stats.aiStats && stats.aiStats.analysis) {
      const az = stats.aiStats.analysis;
      addHeader('Analisi Strategica Brand', 14);
      addSection('Priorità', az.priorities);
      addSection('Punti di Forza', az.strengths);
      addSection('Aree di Miglioramento', az.weaknesses);
      addSection('Raccomandazioni', az.recommendations);
    }

    // --- PLACES ---
    const places = state.scrapeResults.places;
    places.forEach((place, index) => {
      doc.addPage();
      y = 20;

      addHeader(`${index + 1}. ${stripEmojis(place.title)}`, 16);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(stripEmojis(place.address || place.subTitle || ''), margin, y);
      y += 10;
      doc.setTextColor(0, 0, 0);

      doc.text(`Rating: ${place.rating} (${place.reviewsCount || 0} reviews)`, margin, y); y += 6;

      if (place.analysis) {
        y += 5;
        addSection('Priorità Locali', place.analysis.priorities);
        addSection('Punti di Forza', place.analysis.strengths);
        addSection('Aree di Miglioramento', place.analysis.weaknesses);
      } else {
        y += 10;
        doc.setFont('helvetica', 'italic');
        doc.text('(Analisi AI non disponibile per questa scheda)', margin, y);
      }
    });

    doc.save(`gmrs-report-${state.moca.getClient().name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}.pdf`);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    alert('Errore durante la generazione del PDF. Controlla la console.');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
    lucide.createIcons();
  }
}

// ========================================
// History Management (Supabase, filtrato per client_id)
// Tabella: maps_searches
// ========================================
async function saveToHistory() {
  const client = state.moca.getClient();
  const user = state.moca.getUser();
  if (!client?.id || !window.supabaseClient) {
    console.warn('[Maps Hub] Salvataggio storico saltato (client/supabase mancante)');
    return;
  }

  // Prevent duplicates (same brand/mode within 1 minute)
  const brandName = state.currentMode === 'brand'
    ? document.getElementById('brand-name').value.trim()
    : null;
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

  try {
    const { data: dupCheck } = await window.supabaseClient
      .from('maps_searches')
      .select('id')
      .eq('client_id', String(client.id))
      .eq('mode', state.currentMode)
      .gte('created_at', oneMinuteAgo)
      .limit(1);

    if (dupCheck && dupCheck.length > 0) {
      console.log('[Maps Hub] Duplicate search, not saving to history');
      return;
    }

    const { error } = await window.supabaseClient
      .from('maps_searches')
      .insert({
        user_id: user?.id ? String(user.id) : 'unknown',
        client_id: String(client.id),
        mode: state.currentMode,
        brand_name: brandName,
        places_count: state.scrapeResults.places.length,
        reviews_count: state.scrapeResults.aggregateStats.totalReviews,
        ai_enabled: document.getElementById('enable-ai').checked,
        results_data: state.scrapeResults
      });

    if (error) {
      console.error('[Maps Hub] Errore salvataggio storico:', error.message);
    } else {
      console.log('[Maps Hub] Saved to history successfully');
    }
  } catch (e) {
    console.error('[Maps Hub] Errore saveToHistory:', e);
  }
}

async function getHistory() {
  const client = state.moca.getClient();
  if (!client?.id || !window.supabaseClient) return [];

  try {
    const { data, error } = await window.supabaseClient
      .from('maps_searches')
      .select('*')
      .eq('client_id', String(client.id))
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Maps Hub] Errore fetch storico:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('[Maps Hub] Errore getHistory:', e);
    return [];
  }
}

async function openHistoryModal() {
  const list = document.getElementById('history-list');
  list.innerHTML = '<div class="empty-state"><p>Caricamento storico...</p></div>';
  document.getElementById('history-modal').classList.add('active');

  const history = await getHistory();

  if (history.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Nessuna ricerca salvata</p></div>';
    return;
  }

  list.innerHTML = history.map(entry => `
    <div class="history-item">
      <div class="history-icon">${entry.mode === 'brand' ? '<i data-lucide="search"></i>' : '<i data-lucide="link"></i>'}</div>
      <div class="history-info">
        <div class="history-title">${escapeHtml(entry.brand_name || 'URL Manuali')}</div>
        <div class="history-meta">
          ${new Date(entry.created_at).toLocaleString('it-IT')} •
          ${entry.places_count} schede • ${entry.reviews_count} recensioni
          ${entry.ai_enabled ? ' • <i data-lucide="bot" style="width:12px;height:12px;display:inline-block;"></i> AI' : ''}
        </div>
      </div>
      <div class="history-actions">
        <button class="btn-load" onclick="loadFromHistory('${entry.id}')">Carica</button>
        <button class="btn-delete" onclick="deleteFromHistory('${entry.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

function closeHistoryModal() {
  document.getElementById('history-modal').classList.remove('active');
}

async function loadFromHistory(id) {
  const client = state.moca.getClient();
  if (!client?.id || !window.supabaseClient) return;

  try {
    const { data, error } = await window.supabaseClient
      .from('maps_searches')
      .select('results_data')
      .eq('id', id)
      .eq('client_id', String(client.id))
      .single();

    if (error || !data) {
      alert('Errore caricamento storico: ' + (error?.message || 'non trovato'));
      return;
    }

    state.scrapeResults = data.results_data;
    displayResults();
    closeHistoryModal();
  } catch (e) {
    console.error('[Maps Hub] Errore loadFromHistory:', e);
  }
}

async function deleteFromHistory(id) {
  const client = state.moca.getClient();
  if (!client?.id || !window.supabaseClient) return;

  try {
    await window.supabaseClient
      .from('maps_searches')
      .delete()
      .eq('id', id)
      .eq('client_id', String(client.id));
    openHistoryModal(); // Refresh
  } catch (e) {
    console.error('[Maps Hub] Errore deleteFromHistory:', e);
  }
}

async function clearAllHistory() {
  if (!confirm('Sei sicuro di voler cancellare tutto lo storico?')) return;
  const client = state.moca.getClient();
  if (!client?.id || !window.supabaseClient) return;

  try {
    await window.supabaseClient
      .from('maps_searches')
      .delete()
      .eq('client_id', String(client.id));
    openHistoryModal(); // Refresh
  } catch (e) {
    console.error('[Maps Hub] Errore clearAllHistory:', e);
  }
}

// Helper sicurezza HTML
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Make functions global for onclick handlers
window.loadFromHistory = loadFromHistory;
window.deleteFromHistory = deleteFromHistory;

// ========================================
// Settings Modal: Prompt AI Editabili
// ========================================
async function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  modal.classList.add('active');
  await renderSettingsBody();
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('active');
}

async function renderSettingsBody() {
  const client = state.moca.getClient();
  const intro = document.getElementById('settings-intro');
  if (intro) {
    intro.innerHTML = `Personalizza i prompt AI per <strong>${escapeHtml(client?.name || 'questo cliente')}</strong>. Le modifiche sono condivise tra tutti gli utenti del team.`;
  }

  // Re-fetch to ensure latest values
  await loadCustomPromptsAndKnowledge();

  const list = document.getElementById('settings-prompts-list');
  list.innerHTML = '';

  // Build available variables
  const configs = state.moca.getAllConfigs ? state.moca.getAllConfigs() : (state.moca.session?.configurations || {});
  const clientFields = [
    { name: 'client.name', category: 'client' },
    { name: 'client.email', category: 'client' },
    { name: 'client.logo_url', category: 'client' }
  ];
  const knowledgeKeys = Object.keys(state.knowledge);
  const knowledgeVars = [];
  if ('generated_knowledge' in state.knowledge) {
    knowledgeVars.push({ name: 'knowledge', category: 'knowledge' });
  }
  knowledgeKeys.filter(k => k !== 'generated_knowledge').forEach(k => {
    knowledgeVars.push({ name: 'knowledge.' + k, category: 'knowledge' });
  });
  const configVars = Object.keys(configs).map(k => ({ name: k, category: 'config' }));

  // Variabili specifiche di questa app (non draggabili come config, ma documentate)
  const contextVars = [
    { name: 'place_name', category: 'context' },
    { name: 'brand_name', category: 'context' },
    { name: 'total_places', category: 'context' },
    { name: 'total_reviews', category: 'context' },
    { name: 'positive_count', category: 'context' },
    { name: 'negative_count', category: 'context' },
    { name: 'positive_reviews', category: 'context' },
    { name: 'negative_reviews', category: 'context' },
    { name: 'analysis_type', category: 'context' }
  ];

  const availableVariables = [...clientFields, ...knowledgeVars, ...contextVars, ...configVars];

  (window.PROMPT_DEFINITIONS || []).forEach(def => {
    list.appendChild(buildPromptEditor(def, availableVariables));
  });

  lucide.createIcons();
}

function buildPromptEditor(definition, availableVariables) {
  const isCustom = !!state.customPrompts[definition.key];
  const currentValue = getEffectivePrompt(definition.key);

  const card = document.createElement('div');
  card.className = 'prompt-editor';
  card.innerHTML = `
    <div class="prompt-editor-header">
      <h3>
        ${escapeHtml(definition.label)}
        <span class="prompt-badge ${isCustom ? 'custom' : 'default'}">${isCustom ? 'Personalizzato' : 'Default'}</span>
      </h3>
      <p class="prompt-description">${escapeHtml(definition.description)}</p>
    </div>
    <div class="prompt-vars">
      <p class="prompt-vars-label">Variabili disponibili (trascina nel prompt)</p>
      <div class="prompt-vars-chips" data-chips></div>
    </div>
    <textarea class="prompt-textarea" rows="14" data-textarea>${escapeHtml(currentValue)}</textarea>
    <div class="prompt-editor-actions">
      <span class="prompt-status" data-status></span>
      <div class="prompt-buttons">
        ${isCustom ? '<button class="btn-secondary prompt-reset" data-reset><i data-lucide="rotate-ccw"></i> Reset al Default</button>' : ''}
        <button class="btn-primary prompt-save" data-save><i data-lucide="save"></i> Salva</button>
      </div>
    </div>
  `;

  // Variable chips (3 categorie + context)
  const chipsContainer = card.querySelector('[data-chips]');
  const order = ['client', 'knowledge', 'context', 'config'];
  order.forEach(cat => {
    availableVariables.filter(v => v.category === cat).forEach(v => {
      const chip = document.createElement('span');
      chip.className = `var-chip var-chip-${cat}`;
      chip.draggable = true;
      chip.title = `Trascina per inserire {{${v.name}}}`;
      chip.innerHTML = `<i data-lucide="grip-vertical"></i>{{${escapeHtml(v.name)}}}`;
      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', `{{${v.name}}}`);
        e.dataTransfer.effectAllowed = 'copy';
      });
      chipsContainer.appendChild(chip);
    });
  });

  // Drag-drop into textarea
  const textarea = card.querySelector('[data-textarea]');
  textarea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  textarea.addEventListener('drop', (e) => {
    e.preventDefault();
    const variable = e.dataTransfer.getData('text/plain');
    if (!variable) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = textarea.value.slice(0, start) + variable + textarea.value.slice(end);
    textarea.value = newValue;
    setTimeout(() => {
      textarea.focus();
      const newPos = start + variable.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  });

  // Save button
  const saveBtn = card.querySelector('[data-save]');
  const statusEl = card.querySelector('[data-status]');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    statusEl.textContent = 'Salvataggio...';
    statusEl.className = 'prompt-status';
    try {
      await savePromptToSupabase(definition.key, textarea.value);
      statusEl.textContent = '✓ Salvato';
      statusEl.className = 'prompt-status success';
      setTimeout(() => renderSettingsBody(), 600);
    } catch (e) {
      statusEl.textContent = 'Errore salvataggio';
      statusEl.className = 'prompt-status error';
      console.error(e);
    } finally {
      saveBtn.disabled = false;
    }
  });

  // Reset button
  const resetBtn = card.querySelector('[data-reset]');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Ripristinare il prompt di default?')) return;
      resetBtn.disabled = true;
      try {
        await resetPromptInSupabase(definition.key);
        await renderSettingsBody();
      } catch (e) {
        console.error(e);
      }
    });
  }

  return card;
}

async function savePromptToSupabase(promptKey, promptValue) {
  const client = state.moca.getClient();
  const user = state.moca.getUser();
  if (!client?.id || !window.supabaseClient) throw new Error('Client/Supabase mancante');

  const { error } = await window.supabaseClient
    .from('app_prompts')
    .upsert({
      client_id: String(client.id),
      app_id: window.APP_ID,
      prompt_key: promptKey,
      prompt_value: promptValue,
      updated_by: user?.id ? String(user.id) : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'client_id,app_id,prompt_key' });

  if (error) throw error;
  state.customPrompts[promptKey] = promptValue;
}

async function resetPromptInSupabase(promptKey) {
  const client = state.moca.getClient();
  if (!client?.id || !window.supabaseClient) return;

  const { error } = await window.supabaseClient
    .from('app_prompts')
    .delete()
    .eq('client_id', String(client.id))
    .eq('app_id', window.APP_ID)
    .eq('prompt_key', promptKey);

  if (error) throw error;
  delete state.customPrompts[promptKey];
}

window.loadFromHistory = loadFromHistory;
window.deleteFromHistory = deleteFromHistory;

// ========================================
// UI Utilities
// ========================================
function showStep(step) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`step-${i}`);
    if (el) el.style.display = i === step ? 'block' : 'none';
  }
}

function updateProgress(percent, text) {
  document.getElementById('progress-fill').style.width = `${percent}%`;
  document.getElementById('progress-text').textContent = text;
}

// ========================================
// Dark Mode Toggle
// ========================================
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const btn = document.getElementById('btn-dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  btn.innerHTML = isDark
    ? '<i data-lucide="sun"></i>'
    : '<i data-lucide="moon"></i>';
  lucide.createIcons();
}
