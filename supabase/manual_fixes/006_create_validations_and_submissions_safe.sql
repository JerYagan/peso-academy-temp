-- Safe replacement for 006_create_validations_and_submissions.sql
-- Run this file instead of the original migration when upgrading an existing database
-- where public.submissions.status is still an enum and existing RLS policies depend on it.

DO $$
BEGIN
  -- Add submission_type column
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'submissions'
      AND column_name = 'submission_type'
  ) THEN
    ALTER TABLE public.submissions
    ADD COLUMN submission_type VARCHAR(50) NOT NULL DEFAULT 'completion';
  END IF;

  -- Add title column
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'submissions'
      AND column_name = 'title'
  ) THEN
    ALTER TABLE public.submissions
    ADD COLUMN title VARCHAR(255);

    UPDATE public.submissions
    SET title = 'Submission ' || id::text
    WHERE title IS NULL;

    ALTER TABLE public.submissions
    ALTER COLUMN title SET NOT NULL;
  END IF;

  -- Add description column
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'submissions'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.submissions
    ADD COLUMN description TEXT;
  END IF;

  -- Add content column
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'submissions'
      AND column_name = 'content'
  ) THEN
    ALTER TABLE public.submissions
    ADD COLUMN content JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Add attachments column and migrate file_path into it when needed
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'submissions'
      AND column_name = 'attachments'
  ) THEN
    ALTER TABLE public.submissions
    ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
  END IF;

  UPDATE public.submissions
  SET attachments = jsonb_build_array(
    jsonb_build_object(
      'url', file_path,
      'name', COALESCE(file_path, 'file'),
      'type', 'file'
    )
  )
  WHERE file_path IS NOT NULL
    AND (attachments IS NULL OR attachments = '[]'::jsonb);

  -- Convert status from enum to VARCHAR only when needed.
  -- Existing RLS policies can depend on the column type, so drop and recreate the policy around the change.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'submissions'
      AND column_name = 'status'
      AND data_type = 'USER-DEFINED'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'submissions'
        AND policyname = 'Users can update own pending submissions'
    ) THEN
      DROP POLICY "Users can update own pending submissions" ON public.submissions;
    END IF;

    ALTER TABLE public.submissions
    ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE public.submissions
    ALTER COLUMN status TYPE VARCHAR(50) USING status::text;

    ALTER TABLE public.submissions
    ALTER COLUMN status SET DEFAULT 'pending';
  END IF;

  -- Add priority column
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'submissions'
      AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.submissions
    ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';
  END IF;

  -- Add created_at
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'submissions'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.submissions
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    UPDATE public.submissions
    SET created_at = submitted_at
    WHERE created_at IS NULL;
  END IF;

  -- Add updated_at
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'submissions'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.submissions
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    UPDATE public.submissions
    SET updated_at = submitted_at
    WHERE updated_at IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  validator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validation_type VARCHAR(50) NOT NULL DEFAULT 'review',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  decision VARCHAR(50),
  feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id UUID REFERENCES public.validations(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  validator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feedback_type VARCHAR(50) NOT NULL DEFAULT 'general',
  title VARCHAR(255),
  content TEXT NOT NULL,
  template_id UUID,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feedback_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'submissions'
      AND policyname = 'Users can view own submissions'
  ) THEN
    CREATE POLICY "Users can view own submissions"
      ON public.submissions
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'submissions'
      AND policyname = 'Validators can view all submissions'
  ) THEN
    CREATE POLICY "Validators can view all submissions"
      ON public.submissions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND (users.role = 'validator' OR users.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'submissions'
      AND policyname = 'Users can create own submissions'
  ) THEN
    CREATE POLICY "Users can create own submissions"
      ON public.submissions
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'submissions'
      AND policyname = 'Users can update own pending submissions'
  ) THEN
    CREATE POLICY "Users can update own pending submissions"
      ON public.submissions
      FOR UPDATE
      USING (user_id = auth.uid() AND status = 'pending');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'submissions'
      AND policyname = 'Validators can update all submissions'
  ) THEN
    CREATE POLICY "Validators can update all submissions"
      ON public.submissions
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND (users.role = 'validator' OR users.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validations'
      AND policyname = 'Validators can view all validations'
  ) THEN
    CREATE POLICY "Validators can view all validations"
      ON public.validations
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND (users.role = 'validator' OR users.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validations'
      AND policyname = 'Users can view own submission validations'
  ) THEN
    CREATE POLICY "Users can view own submission validations"
      ON public.validations
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.submissions
          WHERE submissions.id = validations.submission_id
            AND submissions.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validations'
      AND policyname = 'Validators can create validations'
  ) THEN
    CREATE POLICY "Validators can create validations"
      ON public.validations
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND (users.role = 'validator' OR users.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validations'
      AND policyname = 'Validators can update own validations'
  ) THEN
    CREATE POLICY "Validators can update own validations"
      ON public.validations
      FOR UPDATE
      USING (validator_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback'
      AND policyname = 'Validators can view all feedback'
  ) THEN
    CREATE POLICY "Validators can view all feedback"
      ON public.feedback
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND (users.role = 'validator' OR users.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback'
      AND policyname = 'Users can view own submission feedback'
  ) THEN
    CREATE POLICY "Users can view own submission feedback"
      ON public.feedback
      FOR SELECT
      USING (
        is_public = true
        AND EXISTS (
          SELECT 1
          FROM public.submissions
          WHERE submissions.id = feedback.submission_id
            AND submissions.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback'
      AND policyname = 'Validators can create feedback'
  ) THEN
    CREATE POLICY "Validators can create feedback"
      ON public.feedback
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND (users.role = 'validator' OR users.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback'
      AND policyname = 'Validators can update own feedback'
  ) THEN
    CREATE POLICY "Validators can update own feedback"
      ON public.feedback
      FOR UPDATE
      USING (validator_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_templates'
      AND policyname = 'Validators can view feedback templates'
  ) THEN
    CREATE POLICY "Validators can view feedback templates"
      ON public.feedback_templates
      FOR SELECT
      USING (
        is_active = true
        OR EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND (users.role = 'validator' OR users.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_templates'
      AND policyname = 'Validators can manage feedback templates'
  ) THEN
    CREATE POLICY "Validators can manage feedback templates"
      ON public.feedback_templates
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND (users.role = 'validator' OR users.role = 'admin')
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_submissions_updated_at ON public.submissions;
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_validations_updated_at ON public.validations;
CREATE TRIGGER update_validations_updated_at
  BEFORE UPDATE ON public.validations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_feedback_updated_at ON public.feedback;
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_feedback_templates_updated_at ON public.feedback_templates;
CREATE TRIGGER update_feedback_templates_updated_at
  BEFORE UPDATE ON public.feedback_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_submission_status_on_validation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.decision IS NOT NULL THEN
    UPDATE public.submissions
    SET status = CASE
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

DROP TRIGGER IF EXISTS update_submission_status_trigger ON public.validations;
CREATE TRIGGER update_submission_status_trigger
  AFTER UPDATE ON public.validations
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION public.update_submission_status_on_validation();

INSERT INTO public.feedback_templates (name, category, content, is_active)
SELECT template.name, template.category, template.content, template.is_active
FROM (
  VALUES
    ('Excellent Work', 'general', 'Excellent work! Your submission demonstrates a strong understanding of the concepts and meets all requirements. Well done!', true),
    ('Good Effort', 'general', 'Good effort overall. Your submission shows understanding, but there are a few areas that could be improved for better results.', true),
    ('Needs Improvement', 'general', 'Your submission needs improvement. Please review the requirements and consider revising your work to better address the key points.', true),
    ('Technical Issue', 'technical', 'There are some technical issues in your submission that need to be addressed. Please review the technical requirements and make necessary corrections.', true),
    ('Content Quality', 'content', 'The content quality could be enhanced. Consider adding more detail, examples, or explanations to strengthen your submission.', true),
    ('Formatting Issue', 'technical', 'Please review the formatting requirements. Your submission would benefit from better structure and organization.', true)
) AS template(name, category, content, is_active)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.feedback_templates existing
  WHERE existing.name = template.name
    AND existing.category = template.category
);

GRANT SELECT, INSERT, UPDATE ON public.submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.validations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_templates TO authenticated;

COMMENT ON TABLE public.submissions IS 'Stores course completion submissions and assignments';
COMMENT ON TABLE public.validations IS 'Tracks validation activities and decisions';
COMMENT ON TABLE public.feedback IS 'Stores detailed feedback on submissions';
COMMENT ON TABLE public.feedback_templates IS 'Reusable feedback templates for validators';