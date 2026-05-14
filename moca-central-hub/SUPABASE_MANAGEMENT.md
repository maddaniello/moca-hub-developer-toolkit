# Supabase Management Guidelines

This file contains instructions and credentials for the AI assistant to manage the Supabase database directly.
Ideally, keep this file local and do not commit real credentials to public repositories.

## 1. Credentials

Replace the placeholders below with your actual Supabase project credentials.
These keys allow the AI to perform administrative tasks (migrations, direct SQL execution, etc.).

**Project URL:**
`SUPABASE_URL="https://vhzmstskkeksgruisxkq.supabase.co"`

**Service Role Key (Secret):**
`SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoem1zdHNra2Vrc2dydWlzeGtxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzNjc4NiwiZXhwIjoyMDg2OTEyNzg2fQ.7xQ3OfGyPh_RjgkRki3dwYMjSsXG9lu3DBQFM0tGB68"`

> **Warning:** The `SERVICE_ROLE_KEY` has full administrative access to your database. Keep it secure.

**Database Password:**
`DB_PASSWORD="T@_ZwJZ7gW3$Y.G"`


## 2. General Workflow

When you (the user) request changes to the application that require database updates (new tables, column changes, policies, etc.), the AI will:

1.  **Analyze**: Determine the necessary SQL changes.
2.  **Plan**: Propose a migration file in `supabase/migrations/` with a timestamped name (e.g., `20240101120000_description.sql`).
3.  **Execute**:
    - If you provide the credentials above, the AI can execute the SQL directly against the database using the Supabase API to keep the remote instance in sync immediately.
    - Alternatively, the AI will generate the migration file, and you can push it using the Supabase CLI (`supabase db push`).

## 3. Direct Database Access

If you want the AI to run queries to check data, debug permissions, or fix inconsistencies:
1.  Ensure the credentials above are populated.
2.  Ask the AI to "Run check X" or "Fix permission Y".
3.  The AI will use the provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to execute SQL via the Supabase SQL API (if available) or by constructing a client in a temporary script.

## 4. Security & Permissions

- **RLS (Row Level Security)**: The AI will prioritize RLS policies to ensure data safety.
- **Policies**: When creating tables, RLS will be enabled by default.

---
*Note: If you commit this file to a repository, ensure you remove the actual keys or encrypt them.*
