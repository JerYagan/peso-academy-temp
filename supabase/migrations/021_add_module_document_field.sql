-- Add module_document field to modules table
-- Run this in Supabase SQL Editor if migrations are not applied automatically
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS module_document TEXT;
COMMENT ON COLUMN public.modules.module_document IS 'URL to the module document (PDF/PPTX) uploaded as the main module content';
