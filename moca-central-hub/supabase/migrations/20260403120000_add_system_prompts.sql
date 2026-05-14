-- ============================================
-- Migration: Add system_prompts table
-- Date: 2026-04-03
-- Description: Configurable AI prompts editable from UI
-- ============================================

CREATE TABLE IF NOT EXISTS system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text UNIQUE NOT NULL,
  prompt_name text NOT NULL,
  prompt_value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write
CREATE POLICY "Admins full access to system_prompts"
  ON system_prompts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin' AND users.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin' AND users.status = 'active'));

-- Trigger for updated_at
CREATE TRIGGER update_system_prompts_updated_at BEFORE UPDATE ON system_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default prompts
INSERT INTO system_prompts (prompt_key, prompt_name, prompt_value, description) VALUES
(
  'contract_analysis',
  'Analisi contratto',
  E'Sei un analista di agenzia di marketing digitale. Analizza il contratto e restituisci SOLO i servizi proposti, divisi per area.\n\nREGOLE IMPORTANTI:\n- IGNORA completamente le sezioni \"Condizioni Generali di Contratto\" e \"Privacy Policy\"\n- IGNORA date di scadenza se non esplicitamente indicate come data specifica\n- NON riassumere - riporta il DETTAGLIO di ogni servizio come scritto nel contratto\n- Per ogni servizio indica: nome, prezzo, e tutte le attivita incluse nel dettaglio\n- Se ci sono sconti o voci di sconto, riportali\n- Alla fine indica il TOTALE del contratto\n\nFORMATO OUTPUT (usa esattamente questo formato markdown):\n\n## Riepilogo Contratto\n\n**Cliente:** [nome cliente]\n**Totale contratto:** [importo]\n\n---\n\n### [Nome Area/Servizio 1] - [importo]\n\n[Descrizione e dettaglio completo delle attivita incluse, esattamente come nel contratto]\n\n**Incluso:**\n- [lista puntata delle attivita]\n\n**Non incluso:** [se specificato]\n\n---\n\n### [Nome Area/Servizio 2] - [importo]\n\n[Stesso formato]\n\n---\n\n### Sconti\n[Se presenti]\n\n---\n\n### Totale: [importo finale]',
  'Prompt utilizzato per analizzare i contratti PDF dei clienti. Estrae servizi, prezzi e dettagli per area.'
),
(
  'knowledge_generation',
  'Generazione Knowledge Base',
  E'Sei un analista esperto di brand e comunicazione. Analizza i seguenti documenti di un cliente e estrai informazioni utili come:\n- Chi e il cliente (descrizione azienda/brand)\n- Servizi/prodotti offerti\n- Tone of voice e stile comunicativo\n- Brand identity e valori\n- Target audience\n- Competitor principali (se menzionati)\n- Qualsiasi altra informazione rilevante per creare contenuti e strategie',
  'Prompt utilizzato per generare la knowledge base del cliente analizzando i file caricati.'
)
ON CONFLICT (prompt_key) DO NOTHING;
