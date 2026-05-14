-- ============================================
-- Migration: Add required_api_keys to applications
-- Date: 2026-04-02
-- Description: Adds a JSONB field to define which API keys
--              are required to use each application.
--              Special value "ANY_LLM" means at least one of
--              OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY.
-- ============================================

ALTER TABLE applications ADD COLUMN IF NOT EXISTS required_api_keys jsonb DEFAULT '[]';

-- Seed existing applications
UPDATE applications SET required_api_keys = '["APIFY_API_KEY", "ANY_LLM"]' WHERE name ILIKE '%Ads Scraper%';
UPDATE applications SET required_api_keys = '["APIFY_API_KEY", "ANY_LLM"]' WHERE name ILIKE '%Appstore Review%';
UPDATE applications SET required_api_keys = '["APIFY_API_KEY", "ANY_LLM"]' WHERE name ILIKE '%Facebook Review%';
UPDATE applications SET required_api_keys = '["ANY_LLM"]' WHERE name ILIKE '%Feedaty%';
UPDATE applications SET required_api_keys = '["APIFY_API_KEY", "ANY_LLM"]' WHERE name ILIKE '%Google Maps Review%';
UPDATE applications SET required_api_keys = '["ANY_LLM"]' WHERE name ILIKE '%Reddit%';
UPDATE applications SET required_api_keys = '["APIFY_API_KEY", "ANY_LLM"]' WHERE name ILIKE '%Social Scraper%';
UPDATE applications SET required_api_keys = '["ANY_LLM"]' WHERE name ILIKE '%Trustpilot%';
UPDATE applications SET required_api_keys = '["ANY_LLM"]' WHERE name ILIKE '%Generatore Schede%';
UPDATE applications SET required_api_keys = '[]' WHERE name ILIKE '%SEO Migration%';
