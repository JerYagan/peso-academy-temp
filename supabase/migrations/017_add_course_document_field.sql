-- Migration: Add course_document field to courses table
-- This allows courses to have an uploaded PDF/PPTX document as the course content

-- Add course_document column to store the URL of the uploaded document
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS course_document TEXT;

-- Add comment to document the field
COMMENT ON COLUMN public.courses.course_document IS 'URL to the course document (PDF/PPTX) uploaded as the main course content';
