-- Alter existing submissions table to add new columns for validation system
-- Note: submissions table already exists from initial schema, we're extending it

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Add submission_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'submissions' 
                 AND column_name = 'submission_type') THEN
    ALTER TABLE public.submissions 
    ADD COLUMN submission_type VARCHAR(50) NOT NULL DEFAULT 'completion';
  END IF;

  -- Add title column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'submissions' 
                 AND column_name = 'title') THEN
    ALTER TABLE public.submissions 
    ADD COLUMN title VARCHAR(255);
    -- Set default title for existing rows
    UPDATE public.submissions SET title = 'Submission ' || id::text WHERE title IS NULL;
    ALTER TABLE public.submissions ALTER COLUMN title SET NOT NULL;
  END IF;

  -- Add description column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'submissions' 
                 AND column_name = 'description') THEN
    ALTER TABLE public.submissions 
    ADD COLUMN description TEXT;
  END IF;

  -- Add content column (JSONB for flexible content)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'submissions' 
                 AND column_name = 'content') THEN
    ALTER TABLE public.submissions 
    ADD COLUMN content JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Add attachments column (JSONB array for file metadata)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'submissions' 
                 AND column_name = 'attachments') THEN
    ALTER TABLE public.submissions 
    ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
    -- Migrate existing file_path to attachments if exists
    UPDATE public.submissions 
    SET attachments = jsonb_build_array(
      jsonb_build_object('url', file_path, 'name', COALESCE(file_path, 'file'), 'type', 'file')
    )
    WHERE file_path IS NOT NULL AND (attachments IS NULL OR attachments = '[]'::jsonb);
  END IF;

  -- Update status column to support new statuses (alter enum if needed)
  -- Note: We'll use VARCHAR instead of enum to be more flexible
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'submissions' 
             AND column_name = 'status' 
             AND data_type = 'USER-DEFINED') THEN
    -- Convert enum to VARCHAR
    ALTER TABLE public.submissions 
    ALTER COLUMN status TYPE VARCHAR(50) USING status::text;
  END IF;

  -- Add priority column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'submissions' 
                 AND column_name = 'priority') THEN
    ALTER TABLE public.submissions 
    ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';
  END IF;

  -- Add created_at if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'submissions' 
                 AND column_name = 'created_at') THEN
    ALTER TABLE public.submissions 
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    -- Set created_at from submitted_at for existing rows
    UPDATE public.submissions SET created_at = submitted_at WHERE created_at IS NULL;
  END IF;

  -- Add updated_at if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'submissions' 
                 AND column_name = 'updated_at') THEN
    ALTER TABLE public.submissions 
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    -- Set updated_at from submitted_at for existing rows
    UPDATE public.submissions SET updated_at = submitted_at WHERE updated_at IS NULL;
  END IF;
END $$;

-- Create validations table for tracking validation activities
CREATE TABLE IF NOT EXISTS public.validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  validator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validation_type VARCHAR(50) NOT NULL DEFAULT 'review', -- review, approval, rejection, revision
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
  decision VARCHAR(50), -- approved, rejected, revision_requested
  feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create feedback table for detailed feedback on submissions
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id UUID REFERENCES public.validations(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  validator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feedback_type VARCHAR(50) NOT NULL DEFAULT 'general', -- general, technical, content, improvement
  title VARCHAR(255),
  content TEXT NOT NULL,
  template_id UUID, -- Reference to feedback templates (future feature)
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_public BOOLEAN DEFAULT true, -- Whether learner can see this feedback
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create feedback_templates table for reusable feedback templates
CREATE TABLE IF NOT EXISTS public.feedback_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- technical, content, improvement, general
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_submissions_enrollment_id ON public.submissions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_module_id ON public.submissions(module_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON public.submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_priority ON public.submissions(priority);
CREATE INDEX IF NOT EXISTS idx_submissions_validator_id ON public.submissions(validator_id);

CREATE INDEX IF NOT EXISTS idx_validations_submission_id ON public.validations(submission_id);
CREATE INDEX IF NOT EXISTS idx_validations_validator_id ON public.validations(validator_id);
CREATE INDEX IF NOT EXISTS idx_validations_status ON public.validations(status);
CREATE INDEX IF NOT EXISTS idx_validations_decision ON public.validations(decision);
CREATE INDEX IF NOT EXISTS idx_validations_created_at ON public.validations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_validation_id ON public.feedback(validation_id);
CREATE INDEX IF NOT EXISTS idx_feedback_submission_id ON public.feedback(submission_id);
CREATE INDEX IF NOT EXISTS idx_feedback_validator_id ON public.feedback(validator_id);

-- Enable RLS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for submissions
-- Users can view their own submissions
CREATE POLICY "Users can view own submissions"
  ON public.submissions
  FOR SELECT
  USING (user_id = auth.uid());

-- Validators and admins can view all submissions
CREATE POLICY "Validators can view all submissions"
  ON public.submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() 
      AND (users.role = 'validator' OR users.role = 'admin')
    )
  );

-- Users can create their own submissions
CREATE POLICY "Users can create own submissions"
  ON public.submissions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own pending submissions
CREATE POLICY "Users can update own pending submissions"
  ON public.submissions
  FOR UPDATE
  USING (user_id = auth.uid() AND status = 'pending');

-- Validators and admins can update all submissions
CREATE POLICY "Validators can update all submissions"
  ON public.submissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() 
      AND (users.role = 'validator' OR users.role = 'admin')
    )
  );

-- RLS Policies for validations
-- Validators can view all validations
CREATE POLICY "Validators can view all validations"
  ON public.validations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() 
      AND (users.role = 'validator' OR users.role = 'admin')
    )
  );

-- Users can view validations for their submissions
CREATE POLICY "Users can view own submission validations"
  ON public.validations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE submissions.id = validations.submission_id
      AND submissions.user_id = auth.uid()
    )
  );

-- Validators can create validations
CREATE POLICY "Validators can create validations"
  ON public.validations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() 
      AND (users.role = 'validator' OR users.role = 'admin')
    )
  );

-- Validators can update their own validations
CREATE POLICY "Validators can update own validations"
  ON public.validations
  FOR UPDATE
  USING (validator_id = auth.uid());

-- RLS Policies for feedback
-- Validators can view all feedback
CREATE POLICY "Validators can view all feedback"
  ON public.feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() 
      AND (users.role = 'validator' OR users.role = 'admin')
    )
  );

-- Users can view public feedback on their submissions
CREATE POLICY "Users can view own submission feedback"
  ON public.feedback
  FOR SELECT
  USING (
    is_public = true AND
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE submissions.id = feedback.submission_id
      AND submissions.user_id = auth.uid()
    )
  );

-- Validators can create feedback
CREATE POLICY "Validators can create feedback"
  ON public.feedback
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() 
      AND (users.role = 'validator' OR users.role = 'admin')
    )
  );

-- Validators can update their own feedback
CREATE POLICY "Validators can update own feedback"
  ON public.feedback
  FOR UPDATE
  USING (validator_id = auth.uid());

-- RLS Policies for feedback_templates
-- Validators and admins can view all templates
CREATE POLICY "Validators can view feedback templates"
  ON public.feedback_templates
  FOR SELECT
  USING (
    is_active = true OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() 
      AND (users.role = 'validator' OR users.role = 'admin')
    )
  );

-- Validators and admins can manage templates
CREATE POLICY "Validators can manage feedback templates"
  ON public.feedback_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() 
      AND (users.role = 'validator' OR users.role = 'admin')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_validations_updated_at
  BEFORE UPDATE ON public.validations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feedback_templates_updated_at
  BEFORE UPDATE ON public.feedback_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-update submission status when validation is completed
CREATE OR REPLACE FUNCTION public.update_submission_status_on_validation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.decision IS NOT NULL THEN
    UPDATE public.submissions
    SET 
      status = CASE 
        WHEN NEW.decision = 'approved' THEN 'approved'
        WHEN NEW.decision = 'rejected' THEN 'rejected'
        WHEN NEW.decision = 'revision_requested' THEN 'revision_requested'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = NEW.submission_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_submission_status_trigger
  AFTER UPDATE ON public.validations
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION public.update_submission_status_on_validation();

-- Insert some default feedback templates
INSERT INTO public.feedback_templates (name, category, content, is_active) VALUES
  ('Excellent Work', 'general', 'Excellent work! Your submission demonstrates a strong understanding of the concepts and meets all requirements. Well done!', true),
  ('Good Effort', 'general', 'Good effort overall. Your submission shows understanding, but there are a few areas that could be improved for better results.', true),
  ('Needs Improvement', 'general', 'Your submission needs improvement. Please review the requirements and consider revising your work to better address the key points.', true),
  ('Technical Issue', 'technical', 'There are some technical issues in your submission that need to be addressed. Please review the technical requirements and make necessary corrections.', true),
  ('Content Quality', 'content', 'The content quality could be enhanced. Consider adding more detail, examples, or explanations to strengthen your submission.', true),
  ('Formatting Issue', 'technical', 'Please review the formatting requirements. Your submission would benefit from better structure and organization.', true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.validations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_templates TO authenticated;

-- Comments
COMMENT ON TABLE public.submissions IS 'Stores course completion submissions and assignments';
COMMENT ON TABLE public.validations IS 'Tracks validation activities and decisions';
COMMENT ON TABLE public.feedback IS 'Stores detailed feedback on submissions';
COMMENT ON TABLE public.feedback_templates IS 'Reusable feedback templates for validators';

