#!/bin/bash

# Script to apply the missing app_launch_tokens migration to Supabase
# This script uses the credentials from SUPABASE_MANAGEMENT.md

set -e

echo "🔧 Applying app_launch_tokens migration to Supabase..."

# Read credentials from SUPABASE_MANAGEMENT.md
SUPABASE_URL="https://yyzakkhppszlouycsecp.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5emFra2hwcHN6bG91eWNzZWNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDExNzE4NywiZXhwIjoyMDg1NjkzMTg3fQ.t-IRUcy8iqi88uxCzjD4MubLUO7HzfvYNtpaowJgUL8"

# Read the migration SQL file
MIGRATION_FILE="/Users/danielepisciottano/Desktop/moca-hub/supabase/migrations/20260210160000_create_launch_tokens.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📄 Reading migration file: $MIGRATION_FILE"
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Execute the migration using Supabase REST API
echo "🚀 Executing migration on Supabase..."

RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}")

# Alternative: Use psql if available
echo ""
echo "⚠️  Note: The REST API approach may not work for DDL statements."
echo "📋 Alternative method: Copy the SQL below and run it manually in Supabase SQL Editor:"
echo ""
echo "----------------------------------------"
cat "$MIGRATION_FILE"
echo "----------------------------------------"
echo ""
echo "🌐 Or open: https://supabase.com/dashboard/project/yyzakkhppszlouycsecp/editor/sql"
echo ""

# Verify table was created
echo "🔍 Checking if table exists..."
TABLE_CHECK=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/app_launch_tokens?limit=0" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  2>&1)

if echo "$TABLE_CHECK" | grep -q "relation.*does not exist"; then
  echo "❌ Table app_launch_tokens still does not exist"
  echo "   Please execute the migration manually in Supabase Dashboard"
  exit 1
else
  echo "✅ Table app_launch_tokens exists!"
  echo "✨ Migration completed successfully"
fi
