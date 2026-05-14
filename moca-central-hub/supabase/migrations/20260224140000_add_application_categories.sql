/*
  # Aggiunta categorie applicazioni

  Crea la tabella `application_categories` e aggiunge il campo `category_id`
  alla tabella `applications` per raggruppare le app per categoria.

  ## Nuova tabella: application_categories
  - `id` (uuid, PK)
  - `name` (text, NOT NULL, UNIQUE)
  - `sort_order` (integer, DEFAULT 0)
  - `created_at` (timestamptz)

  ## Modifica tabella: applications
  - Aggiunge colonna `category_id` (uuid FK nullable)

  ## Dati iniziali
  - "Scraping e analisi"
  - "Creazione contenuti"
  - "Processi interni"
*/

-- Tabella categorie
CREATE TABLE IF NOT EXISTS application_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Indice per ordinamento
CREATE INDEX IF NOT EXISTS idx_app_categories_sort ON application_categories(sort_order, name);

-- RLS
ALTER TABLE application_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view categories"
  ON application_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON application_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admins can update categories"
  ON application_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admins can delete categories"
  ON application_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

-- Aggiunge colonna category_id alla tabella applications
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES application_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_category ON applications(category_id);

-- Inserisci categorie iniziali
INSERT INTO application_categories (name, sort_order) VALUES
  ('Scraping e analisi', 1),
  ('Creazione contenuti', 2),
  ('Processi interni', 3)
ON CONFLICT (name) DO NOTHING;
