-- Create assessments and questions tables for module assessments
-- This migration adds support for assessments/quizzes in modules

-- Assessment table - links assessments to modules
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    time_limit INTEGER, -- in minutes, NULL means no time limit
    passing_score INTEGER DEFAULT 70, -- percentage required to pass
    max_attempts INTEGER DEFAULT 3, -- maximum number of attempts allowed
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(module_id) -- One assessment per module
);

-- Questions table - stores questions for assessments
CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false', 'short_answer', 'essay');

CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_type question_type NOT NULL DEFAULT 'multiple_choice',
    options JSONB, -- For multiple choice: ["option1", "option2", ...]
    correct_answer TEXT, -- For multiple choice/true_false: the correct option. For short_answer: expected answer (optional)
    points INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    explanation TEXT, -- Explanation shown after answering
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assessment attempts table - tracks user attempts at assessments
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    score INTEGER, -- percentage score
    passed BOOLEAN,
    answers JSONB NOT NULL DEFAULT '{}', -- User's answers: {questionId: answer}
    time_spent INTEGER -- in seconds
);

-- Assessment answers table - stores individual question answers for attempts
CREATE TABLE IF NOT EXISTS public.assessment_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    is_correct BOOLEAN, -- NULL for essay/short_answer that need manual grading
    points_earned INTEGER DEFAULT 0,
    feedback TEXT -- Feedback from validator (for manually graded questions)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assessments_module_id ON public.assessments(module_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON public.assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment_id ON public.assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_enrollment_id ON public.assessment_attempts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user_id ON public.assessment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_answers_attempt_id ON public.assessment_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_assessment_answers_question_id ON public.assessment_answers(question_id);

-- Enable RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assessments
-- Users can view assessments for modules they're enrolled in
CREATE POLICY "Users can view assessments for enrolled modules" ON public.assessments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.enrollments
            WHERE enrollments.course_id IN (
                SELECT course_id FROM public.modules WHERE modules.id = assessments.module_id
            )
            AND enrollments.user_id = auth.uid()
        )
    );

-- Trainers/admins can manage assessments
CREATE POLICY "Trainers can manage assessments" ON public.assessments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('trainer', 'admin', 'spd')
        )
    );

-- RLS Policies for assessment_questions
CREATE POLICY "Users can view questions for accessible assessments" ON public.assessment_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessments
            WHERE assessments.id = assessment_questions.assessment_id
            AND EXISTS (
                SELECT 1 FROM public.enrollments
                WHERE enrollments.course_id IN (
                    SELECT course_id FROM public.modules WHERE modules.id = assessments.module_id
                )
                AND enrollments.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Trainers can manage questions" ON public.assessment_questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('trainer', 'admin', 'spd')
        )
    );

-- RLS Policies for assessment_attempts
CREATE POLICY "Users can view their own attempts" ON public.assessment_attempts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own attempts" ON public.assessment_attempts
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own attempts" ON public.assessment_attempts
    FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for assessment_answers
CREATE POLICY "Users can view answers for their attempts" ON public.assessment_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts
            WHERE assessment_attempts.id = assessment_answers.attempt_id
            AND assessment_attempts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create answers for their attempts" ON public.assessment_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts
            WHERE assessment_attempts.id = assessment_answers.attempt_id
            AND assessment_attempts.user_id = auth.uid()
        )
    );

-- Trigger to update updated_at for assessments
CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON public.assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

