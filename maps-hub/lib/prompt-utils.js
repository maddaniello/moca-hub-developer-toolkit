// Risolve {{NOME_VARIABILE}} all'interno di un prompt usando configs/client/knowledge/extra.
// Skippa variabili sensibili (API_KEY, SECRET, TOKEN, PASSWORD) per evitare leak.
(function () {
    const SENSITIVE_PATTERNS = /API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIALS/i;

    window.resolvePromptVariables = function (
        promptText,
        configs,
        client,
        knowledge,
        extra
    ) {
        configs = configs || {};
        client = client || {};
        knowledge = knowledge || {};
        extra = extra || {};

        return promptText.replace(/\{\{([^}]+)\}\}/g, function (match, varName) {
            const trimmed = varName.trim();

            // Extra fields specifici del contesto (place_name, reviews, ecc.)
            if (Object.prototype.hasOwnProperty.call(extra, trimmed)) {
                return extra[trimmed];
            }

            // Client fields
            if (trimmed === 'client.id') return client.id || match;
            if (trimmed === 'client.name') return client.name || match;
            if (trimmed === 'client.email') return client.email || match;
            if (trimmed === 'client.logo_url') return client.logo_url || match;

            // Knowledge base
            if (trimmed === 'knowledge') {
                return knowledge['generated_knowledge'] || match;
            }
            if (trimmed.indexOf('knowledge.') === 0) {
                const fieldKey = trimmed.slice('knowledge.'.length);
                return knowledge[fieldKey] || match;
            }

            // Skippa config sensibili
            if (SENSITIVE_PATTERNS.test(trimmed)) return match;

            // Config values (non sensibili)
            if (configs[trimmed] !== undefined) return configs[trimmed];

            return match;
        });
    };
})();
