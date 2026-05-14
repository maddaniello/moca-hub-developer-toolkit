-- Create permission_levels table
CREATE TABLE IF NOT EXISTS permission_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INTEGER NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    capabilities TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE permission_levels ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to authenticated users" ON permission_levels
    FOR SELECT TO authenticated USING (true);

-- Allow full access to admins/managers (or just use service role via edge functions)
-- For now, let's allow admins to manage it if they connect directly, but our edge functions use service role.
-- We can add a policy for admins just in case.
CREATE POLICY "Allow full access to admins" ON permission_levels
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Seed initial data (idempotent)
INSERT INTO permission_levels (level, display_name, description, capabilities)
VALUES
    (1, 'Base', 'Accesso limitato alle funzioni essenziali. Sola lettura su dati non sensibili.', ARRAY[]::TEXT[]),
    (2, 'Intermedio', 'Accesso operativo standard. Può visualizzare report e clienti assegnati.', ARRAY[]::TEXT[]),
    (3, 'Avanzato', 'Autonomia operativa. Può creare e modificare entità standard.', ARRAY[]::TEXT[]),
    (4, 'Esperto', 'Accesso quasi completo. Gestione avanzata di campagne e report.', ARRAY[]::TEXT[]),
    (5, 'Totale', 'Pieni poteri operativi (ma non amministrativi di sistema).', ARRAY[]::TEXT[])
ON CONFLICT (level) DO NOTHING;
