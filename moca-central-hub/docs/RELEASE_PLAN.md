# Piano di Release Moca Hub - 6 Settimane

**Obiettivo:** Rilascio progressivo a 80 utenti dell'agenzia entro metà maggio 2026.
**Data inizio:** 7 aprile 2026
**Data release finale:** 19 maggio 2026

---

## Settimana 1 (7-11 aprile): Fondamenta e Testing

### Infrastruttura
- [ ] Creare ambiente di **staging** su Netlify (branch `staging`, subdomain `staging-moca-hub.netlify.app`)
- [ ] Creare **progetto Supabase separato** per staging (DB isolato da produzione)
- [ ] Configurare **GitHub Actions** CI/CD:
  - Push su `main` → deploy automatico su staging
  - Tag release `v*` → deploy su produzione
  - Run automatico di typecheck + lint + test su ogni PR
- [ ] Integrare **Sentry** per error tracking (piano free: 5K eventi/mese, sufficiente)

### Testing
- [ ] Setup **Vitest** per unit test
- [ ] Scrivere test per le funzioni critiche:
  - `generate-launch-token` / `validate-launch-token`
  - `create-user` / `delete-user`
  - `generate-knowledge`
  - Logica `checkAppRequirements`
- [ ] Test manuali su tutti i flussi principali (checklist sotto)

### Deliverable settimana 1
- CI/CD funzionante
- Staging environment attivo
- Sentry integrato
- Test base scritti

---

## Settimana 2 (14-18 aprile): Stabilizzazione e UX

### Bug fixing
- [ ] Testare TUTTI i flussi come utente admin, manager, user, viewer
- [ ] Verificare che i permessi funzionino correttamente per ogni ruolo
- [ ] Testare la Knowledge Base end-to-end (upload, generazione, modifica)
- [ ] Testare il client selector condiviso tra Dashboard e Configurazioni
- [ ] Verificare che le app si evidenzino correttamente in base alle API configurate

### UX/UI Polish
- [ ] Aggiungere **feedback visivo** per azioni (toast/notifiche invece di alert)
- [ ] Aggiungere **loading states** coerenti su tutte le pagine
- [ ] Verificare responsive su mobile e tablet
- [ ] Testare con dati reali di almeno 3 clienti

### Documentazione
- [ ] Scrivere **guida utente** (come usare il Hub, come lanciare app, ecc.)
- [ ] Scrivere **guida admin** (come creare clienti, utenti, configurare API)
- [ ] Aggiornare README con istruzioni di deploy

### Deliverable settimana 2
- Zero bug critici noti
- UX rifinita
- Documentazione utente/admin pronta

---

## Settimana 3 (21-25 aprile): Soft Launch (Team Pilota)

### Rilascio a gruppo pilota (5-10 persone)
- [ ] Selezionare 5-10 utenti interni (mix di ruoli: 2 admin, 3 manager, 5 user)
- [ ] Creare i loro account su produzione
- [ ] Configurare i clienti reali con API keys
- [ ] Sessione di **onboarding** (15-30 min)
- [ ] Canale Slack/Teams dedicato per feedback e bug report

### Monitoraggio
- [ ] Controllare Sentry quotidianamente per errori
- [ ] Verificare i log in Supabase
- [ ] Monitorare le performance (tempo di caricamento, latenza API)

### Fix rapidi
- [ ] Risolvere bug segnalati dal team pilota entro 24h
- [ ] Implementare miglioramenti UX suggeriti se fattibili

### Deliverable settimana 3
- 5-10 utenti attivi senza errori critici
- Feedback raccolto e triaggiato
- Bug critici risolti

---

## Settimana 4 (28 aprile - 2 maggio): Espansione e Applicazioni

### Rilascio esteso (20-30 persone)
- [ ] Invitare altri 15-20 utenti (tutti i team leader + utenti chiave)
- [ ] Verificare che tutte le applicazioni esterne funzionino con il launch token
- [ ] Testare con carico reale (20+ utenti concorrenti)

### Applicazioni
- [ ] Verificare che TUTTE le 10 app siano configurate e funzionanti
- [ ] Per ogni app, verificare il flusso completo: Dashboard → Launch → App riceve token → App funziona
- [ ] Configurare `required_api_keys` correttamente per ogni app

### Performance
- [ ] Verificare tempi di risposta delle Netlify Functions (<2s)
- [ ] Ottimizzare query Supabase se necessario (indici, cache)
- [ ] Verificare limiti del piano Supabase (storage, bandwidth, DB size)

### Deliverable settimana 4
- 20-30 utenti attivi
- Tutte le app funzionanti
- Performance accettabili

---

## Settimana 5 (5-9 maggio): Pre-release e Formazione

### Rilascio a tutto il team (80 persone)
- [ ] Creare account per tutti gli 80 utenti (batch con script o inviti)
- [ ] Assegnare ruoli e clienti corretti per ogni utente
- [ ] Configurare API keys per tutti i clienti

### Formazione
- [ ] Sessione di formazione generale (30 min, registrata)
- [ ] Video tutorial breve per le operazioni comuni
- [ ] FAQ basata sui feedback delle settimane precedenti
- [ ] Documentazione accessibile (link nel Hub stesso?)

### Preparazione go-live
- [ ] Piano di rollback in caso di problemi
- [ ] Backup completo del database
- [ ] Verificare che Supabase regga il carico (upgrade piano se necessario)
- [ ] Configurare alerting su Sentry per errori critici

### Deliverable settimana 5
- Tutti gli 80 utenti hanno accesso
- Formazione completata
- Piano di rollback pronto

---

## Settimana 6 (12-16 maggio): Go-Live e Stabilizzazione

### Go-Live ufficiale
- [ ] Annuncio ufficiale al team
- [ ] Monitoraggio intensivo primi 3 giorni (check ogni 2h)
- [ ] Supporto dedicato via canale Slack/Teams
- [ ] Fix immediato di qualsiasi bug critico

### Post-launch
- [ ] Raccogliere metriche: utenti attivi, app lanciate, errori
- [ ] Survey di soddisfazione dopo 1 settimana
- [ ] Pianificare roadmap Q3 basata sul feedback

### Deliverable settimana 6
- Hub stabile in produzione con 80 utenti
- Zero errori critici
- Feedback raccolto per iterazioni future

---

## Checklist Test Manuali (da completare settimana 1-2)

### Autenticazione
- [ ] Login con credenziali corrette
- [ ] Login con credenziali errate (messaggio di errore chiaro)
- [ ] Invito utente via email
- [ ] Set password da invito
- [ ] Logout

### Clienti (Admin)
- [ ] Creare cliente con tutti i campi
- [ ] Creare cliente senza email
- [ ] Modificare cliente
- [ ] Eliminare cliente
- [ ] Logo preview funzionante

### Utenti (Admin/Manager)
- [ ] Creare utente con multi-client
- [ ] Modificare ruolo utente
- [ ] Eliminare utente
- [ ] Verificare che manager non possa creare admin

### Configurazioni
- [ ] Aggiungere API key con quick add
- [ ] Aggiungere configurazione manuale
- [ ] Modificare configurazione
- [ ] Eliminare configurazione
- [ ] Mascheramento valori sensibili funzionante
- [ ] Client selector sincronizzato con Dashboard

### Knowledge Base
- [ ] Upload file (click)
- [ ] Upload file (drag & drop)
- [ ] File troppo grande → errore chiaro
- [ ] File tipo non consentito → errore chiaro
- [ ] Generazione knowledge con Gemini
- [ ] Generazione knowledge con OpenAI
- [ ] Generazione knowledge con Anthropic
- [ ] Knowledge editabile manualmente
- [ ] Aggiunta campi personalizzati
- [ ] Generazione incrementale (non sovrascrive)

### Dashboard
- [ ] Client selector con logo
- [ ] Cambio cliente aggiorna app disponibili
- [ ] App evidenziate correttamente (verde/arancione)
- [ ] Launch app funzionante
- [ ] Stats corrette

### Permessi
- [ ] Admin vede tutte le tab
- [ ] Manager vede Dashboard, Clienti, Utenti, Configurazioni, Applicazioni
- [ ] User vede Dashboard, Clienti, Utenti, Configurazioni
- [ ] Viewer vede Dashboard, Clienti, Utenti, Configurazioni (read-only)

---

## Stack Tecnico Raccomandato per Produzione

| Componente | Attuale | Raccomandato |
|-----------|---------|-------------|
| Hosting | Netlify Free | Netlify Pro ($19/mese) - build più veloci, analytics |
| Database | Supabase Free | **Supabase Pro ($25/mese)** - backup, 8GB DB, 100GB storage |
| Error tracking | Nessuno | **Sentry Free** (5K eventi/mese) |
| CI/CD | Nessuno | **GitHub Actions** (free per repo pubblici) |
| Monitoring | Nessuno | Netlify Analytics + Sentry |

**Costo mensile stimato: ~$44/mese** per un'infrastruttura production-ready per 80 utenti.

---

## Rischi e Mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|------------|---------|-------------|
| Limiti Supabase Free raggiunti | Alta | Medio | Upgrade a Pro prima del go-live |
| Bug critici post-launch | Media | Alto | Testing estensivo + Sentry + rollback plan |
| Resistenza all'adozione | Media | Medio | Formazione + UX intuitiva + supporto dedicato |
| API keys esaurite/invalide | Bassa | Alto | Alerting su errori API + documentazione |
| Downtime Netlify/Supabase | Bassa | Alto | Nessun SLA su free tier - upgrade se critico |
