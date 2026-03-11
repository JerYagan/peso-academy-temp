import { supabase, handleSupabaseError } from "@/lib/supabase";
import { getGradableQuizBlocks, type ContentBlock } from "@/lib/contentBlocks";
import { analyticsService } from "@/services/analyticsService";
import { notificationHelpers } from "@/services/notificationService";
import { deriveSkillTags, deriveTopicTags } from "@/lib/taxonomy";

export interface Assessment {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  timeLimit?: number; // in minutes
  passingScore: number;
  maxAttempts: number;
  isActive: boolean;
  skillTags?: string[];
  topicTags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentQuestion {
  id: string;
  assessmentId: string;
  question: string;
  questionType: "multiple_choice" | "true_false" | "short_answer" | "essay";
  options?: string[];
  correctAnswer?: string;
  points: number;
  order: number;
  explanation?: string;
  sourceQuestionKey?: string;
  isActive?: boolean;
  derivedFromModuleQuiz?: boolean;
}

interface AssessmentSyncSettings {
  title?: string;
  description?: string;
  timeLimit?: number;
  passingScore?: number;
  maxAttempts?: number;
  isActive?: boolean;
  skillTags?: string[];
  topicTags?: string[];
}

const mapAssessmentRow = (data: any): Assessment => ({
  id: data.id,
  moduleId: data.module_id,
  title: data.title,
  description: data.description || undefined,
  timeLimit: data.time_limit || undefined,
  passingScore: data.passing_score,
  maxAttempts: data.max_attempts,
  isActive: data.is_active,
  skillTags: data.skill_tags || [],
  topicTags: data.topic_tags || [],
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

const mapAssessmentQuestionRow = (row: any): AssessmentQuestion => ({
  id: row.id,
  assessmentId: row.assessment_id,
  question: row.question,
  questionType: row.question_type,
  options: row.options ? (Array.isArray(row.options) ? row.options : JSON.parse(row.options)) : undefined,
  correctAnswer: row.correct_answer || undefined,
  points: row.points,
  order: row.order,
  explanation: row.explanation || undefined,
  sourceQuestionKey: row.source_question_key || undefined,
  isActive: row.is_active ?? true,
  derivedFromModuleQuiz: row.derived_from_module_quiz ?? false,
});

const buildDerivedAssessmentDefaults = (moduleTitle: string, settings?: AssessmentSyncSettings): Required<AssessmentSyncSettings> => ({
  title: settings?.title?.trim() || `${moduleTitle.trim() || "Module"} Assessment`,
  description: settings?.description || "",
  timeLimit: settings?.timeLimit,
  passingScore: settings?.passingScore ?? 70,
  maxAttempts: settings?.maxAttempts ?? 3,
  isActive: settings?.isActive ?? true,
  skillTags: settings?.skillTags || [],
  topicTags: settings?.topicTags || [],
});

const normalizeStoredCorrectAnswer = (
  correctAnswer: string | null | undefined,
  options?: string[],
): string | null => {
  if (!correctAnswer) {
    return null;
  }

  const trimmed = correctAnswer.trim();
  if (!trimmed) {
    return null;
  }

  const numericValue = Number.parseInt(trimmed, 10);
  if (String(numericValue) === trimmed && Number.isInteger(numericValue) && options?.[numericValue]) {
    return options[numericValue];
  }

  return trimmed;
};

const toDerivedQuestionPayload = (block: ContentBlock, index: number) => ({
  sourceQuestionKey: block.sourceQuestionKey || block.id,
  question: block.content.trim(),
  questionType: block.questionType === "true_false" ? "true_false" : "multiple_choice",
  options: block.options || [],
  correctAnswer:
    block.correctAnswer !== undefined && (block.options || [])[block.correctAnswer] !== undefined
      ? (block.options || [])[block.correctAnswer]
      : null,
  points: block.points || 1,
  order: index + 1,
  explanation: block.explanation || null,
});

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  enrollmentId: string;
  userId: string;
  startedAt: string;
  submittedAt?: string;
  score?: number;
  passed?: boolean;
  answers: Record<string, string>;
  timeSpent?: number;
}

export const assessmentService = {
  /**
   * Get assessment for a module
   */
  getAssessmentByModule: async (moduleId: string): Promise<Assessment | null> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return null;
    }

    const { data, error } = await supabase
      .from("assessments")
      .select("*")
      .eq("module_id", moduleId)
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No assessment found
        return null;
      }
      handleSupabaseError(error);
      return null;
    }

    return mapAssessmentRow(data);
  },

  /**
   * Get questions for an assessment
   */
  getAssessmentQuestions: async (assessmentId: string): Promise<AssessmentQuestion[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const { data, error } = await supabase
      .from("assessment_questions")
      .select("*")
      .eq("assessment_id", assessmentId)
      .eq("is_active", true)
      .order("order", { ascending: true });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return data?.map(mapAssessmentQuestionRow) || [];
  },

  /**
   * Get user's attempts for an assessment
   */
  getAssessmentAttempts: async (
    assessmentId: string,
    userId: string
  ): Promise<AssessmentAttempt[]> => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      return [];
    }

    const { data, error } = await supabase
      .from("assessment_attempts")
      .select("*")
      .eq("assessment_id", assessmentId)
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (
      data?.map((a) => ({
        id: a.id,
        assessmentId: a.assessment_id,
        enrollmentId: a.enrollment_id,
        userId: a.user_id,
        startedAt: a.started_at,
        submittedAt: a.submitted_at || undefined,
        score: a.score === null || a.score === undefined ? undefined : a.score,
        passed: a.passed === null || a.passed === undefined ? undefined : a.passed,
        answers: a.answers || {},
        timeSpent: a.time_spent === null || a.time_spent === undefined ? undefined : a.time_spent,
      })) || []
    );
  },

  /**
   * Start a new assessment attempt
   */
  startAttempt: async (
    assessmentId: string,
    enrollmentId: string,
    userId: string
  ): Promise<AssessmentAttempt> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { data, error } = await supabase
      .from("assessment_attempts")
      .insert({
        assessment_id: assessmentId,
        enrollment_id: enrollmentId,
        user_id: userId,
        started_at: new Date().toISOString(),
        answers: {},
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return {
      id: data.id,
      assessmentId: data.assessment_id,
      enrollmentId: data.enrollment_id,
      userId: data.user_id,
      startedAt: data.started_at,
      submittedAt: data.submitted_at || undefined,
      score: data.score === null || data.score === undefined ? undefined : data.score,
      passed: data.passed === null || data.passed === undefined ? undefined : data.passed,
      answers: data.answers || {},
      timeSpent: data.time_spent === null || data.time_spent === undefined ? undefined : data.time_spent,
    };
  },

  /**
   * Submit assessment attempt
   */
  submitAttempt: async (
    attemptId: string,
    answers: Record<string, string>,
    timeSpent: number,
    questions: AssessmentQuestion[]
  ): Promise<{ score: number; passed: boolean }> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;

    questions.forEach((question) => {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      const normalizedCorrectAnswer = normalizeStoredCorrectAnswer(question.correctAnswer, question.options);

      if (question.questionType === "multiple_choice" || question.questionType === "true_false") {
        if (userAnswer === normalizedCorrectAnswer) {
          earnedPoints += question.points;
        }
      }
      // Short answer and essay need manual grading, so we don't count them here
    });

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    // Get assessment and enrollment details to check passing score and get course info
    const { data: attemptData } = await supabase
      .from("assessment_attempts")
      .select(`
        assessment_id,
        user_id,
        enrollment_id,
        enrollments:enrollment_id (
          course_id,
          courses:course_id (title)
        )
      `)
      .eq("id", attemptId)
      .single();

    if (!attemptData) {
      throw new Error("Attempt not found");
    }

    const { data: assessmentData } = await supabase
      .from("assessments")
      .select("passing_score")
      .eq("id", attemptData.assessment_id)
      .single();

    const passingScore = assessmentData?.passing_score || 70;
    const passed = score >= passingScore;

    // Update attempt
    const { error: updateError } = await supabase
      .from("assessment_attempts")
      .update({
        submitted_at: new Date().toISOString(),
        answers,
        score,
        passed,
        time_spent: timeSpent,
      })
      .eq("id", attemptId);

    if (updateError) {
      handleSupabaseError(updateError);
      throw updateError;
    }

    // Save individual answers
    const answerInserts = questions.map((question) => {
      const userAnswer = answers[question.id];
      const normalizedCorrectAnswer = normalizeStoredCorrectAnswer(question.correctAnswer, question.options);
      const isCorrect =
        question.questionType === "multiple_choice" || question.questionType === "true_false"
          ? userAnswer === normalizedCorrectAnswer
          : null;
      const pointsEarned =
        isCorrect === true ? question.points : isCorrect === false ? 0 : null;

      return {
        attempt_id: attemptId,
        question_id: question.id,
        answer: userAnswer || "",
        is_correct: isCorrect,
        points_earned: pointsEarned,
      };
    });

    if (answerInserts.length > 0) {
      const { error: insertError } = await supabase
        .from("assessment_answers")
        .insert(answerInserts);

      if (insertError) {
        console.error("Error saving answers:", insertError);
        // Don't throw, as the attempt is already saved
      }
    }

    // Notify user about assessment grading
    try {
      const courseTitle = (attemptData as any).enrollments?.courses?.title || "the course";
      const userId = (attemptData as any).user_id;
      
      if (userId && courseTitle) {
        await notificationHelpers.notifyAssessmentGraded(
          userId,
          courseTitle,
          score,
          passed
        );
      }
    } catch (notifError) {
      console.error("Error sending assessment notification:", notifError);
      // Don't throw - notification failure shouldn't block assessment submission
    }

    try {
      const courseId = (attemptData as any).enrollments?.course_id;
      const userId = (attemptData as any).user_id;
      const enrollmentId = (attemptData as any).enrollment_id;

      await analyticsService.trackEvent({
        eventName: "assessment_submit",
        userId,
        courseId,
        assessmentId: attemptData.assessment_id,
        enrollmentId,
        surface: "assessment_interface",
        metadata: {
          attemptId,
          score,
          passed,
        },
      });

      await analyticsService.refreshPhase1Analytics(userId);
    } catch (analyticsError) {
      console.error("Error tracking assessment analytics:", analyticsError);
    }

    return { score, passed };
  },

  /**
   * Create a new assessment
   */
  createAssessment: async (
    moduleId: string,
    assessment: {
      title: string;
      description?: string;
      timeLimit?: number;
      passingScore: number;
      maxAttempts: number;
      skillTags?: string[];
      topicTags?: string[];
    }
  ): Promise<Assessment> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const canonicalSkillTags = deriveSkillTags(undefined, assessment.skillTags);
    const canonicalTopicTags = deriveTopicTags(undefined, canonicalSkillTags, assessment.topicTags);

    const { data, error } = await supabase
      .from("assessments")
      .insert({
        module_id: moduleId,
        title: assessment.title,
        description: assessment.description || null,
        time_limit: assessment.timeLimit || null,
        passing_score: assessment.passingScore,
        max_attempts: assessment.maxAttempts,
        is_active: true,
        skill_tags: canonicalSkillTags,
        topic_tags: canonicalTopicTags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return mapAssessmentRow(data);
  },

  /**
   * Update an assessment
   */
  updateAssessment: async (
    assessmentId: string,
    updates: {
      title?: string;
      description?: string;
      timeLimit?: number;
      passingScore?: number;
      maxAttempts?: number;
      isActive?: boolean;
      skillTags?: string[];
      topicTags?: string[];
    }
  ): Promise<Assessment> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description || null;
    if (updates.timeLimit !== undefined) updateData.time_limit = updates.timeLimit || null;
    if (updates.passingScore !== undefined) updateData.passing_score = updates.passingScore;
    if (updates.maxAttempts !== undefined) updateData.max_attempts = updates.maxAttempts;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.skillTags !== undefined) updateData.skill_tags = deriveSkillTags(undefined, updates.skillTags);
    if (updates.topicTags !== undefined) updateData.topic_tags = deriveTopicTags(undefined, updates.skillTags, updates.topicTags);

    const { data, error } = await supabase
      .from("assessments")
      .update(updateData)
      .eq("id", assessmentId)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return mapAssessmentRow(data);
  },

  /**
   * Delete an assessment
   */
  deleteAssessment: async (assessmentId: string): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { error } = await supabase.from("assessments").delete().eq("id", assessmentId);

    if (error) {
      handleSupabaseError(error);
      throw error;
    }
  },

  /**
   * Create an assessment question
   */
  createQuestion: async (
    assessmentId: string,
    question: {
      question: string;
      questionType: "multiple_choice" | "true_false" | "short_answer" | "essay";
      options?: string[];
      correctAnswer?: string;
      points: number;
      order: number;
      explanation?: string;
    }
  ): Promise<AssessmentQuestion> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { data, error } = await supabase
      .from("assessment_questions")
      .insert({
        assessment_id: assessmentId,
        question: question.question,
        question_type: question.questionType,
        options: question.options ? JSON.stringify(question.options) : null,
        correct_answer: question.correctAnswer || null,
        points: question.points,
        order: question.order,
        explanation: question.explanation || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return mapAssessmentQuestionRow(data);
  },

  /**
   * Update an assessment question
   */
  updateQuestion: async (
    questionId: string,
    updates: {
      question?: string;
      questionType?: "multiple_choice" | "true_false" | "short_answer" | "essay";
      options?: string[];
      correctAnswer?: string;
      points?: number;
      order?: number;
      explanation?: string;
    }
  ): Promise<AssessmentQuestion> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const updateData: any = {};
    if (updates.question !== undefined) updateData.question = updates.question;
    if (updates.questionType !== undefined) updateData.question_type = updates.questionType;
    if (updates.options !== undefined) updateData.options = updates.options ? JSON.stringify(updates.options) : null;
    if (updates.correctAnswer !== undefined) updateData.correct_answer = updates.correctAnswer || null;
    if (updates.points !== undefined) updateData.points = updates.points;
    if (updates.order !== undefined) updateData.order = updates.order;
    if (updates.explanation !== undefined) updateData.explanation = updates.explanation || null;

    const { data, error } = await supabase
      .from("assessment_questions")
      .update(updateData)
      .eq("id", questionId)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
      throw error;
    }

    return mapAssessmentQuestionRow(data);
  },

  /**
   * Delete an assessment question
   */
  deleteQuestion: async (questionId: string): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { error } = await supabase.from("assessment_questions").delete().eq("id", questionId);

    if (error) {
      handleSupabaseError(error);
      throw error;
    }
  },

  /**
   * Reorder questions
   */
  reorderQuestions: async (questionOrders: { id: string; order: number }[]): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    for (const { id, order } of questionOrders) {
      const { error } = await supabase.from("assessment_questions").update({ order }).eq("id", id);

      if (error) {
        handleSupabaseError(error);
        throw error;
      }
    }
  },

  syncDerivedAssessmentFromQuizBlocks: async (
    moduleId: string,
    moduleTitle: string,
    blocks: ContentBlock[],
    settings?: AssessmentSyncSettings,
  ): Promise<Assessment | null> => {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const gradableQuizBlocks = getGradableQuizBlocks(blocks);
    if (gradableQuizBlocks.length === 0) {
      return null;
    }

    const defaults = buildDerivedAssessmentDefaults(moduleTitle, settings);
    const canonicalSkillTags = deriveSkillTags(undefined, defaults.skillTags);
    const canonicalTopicTags = deriveTopicTags(undefined, canonicalSkillTags, defaults.topicTags);

    const { data: existingAssessmentRow, error: assessmentLookupError } = await supabase
      .from("assessments")
      .select("*")
      .eq("module_id", moduleId)
      .single();

    if (assessmentLookupError && assessmentLookupError.code !== "PGRST116") {
      handleSupabaseError(assessmentLookupError);
      throw assessmentLookupError;
    }

    let assessmentRow = existingAssessmentRow;

    if (!assessmentRow) {
      const { data: insertedAssessment, error: insertAssessmentError } = await supabase
        .from("assessments")
        .insert({
          module_id: moduleId,
          title: defaults.title,
          description: defaults.description || null,
          time_limit: defaults.timeLimit || null,
          passing_score: defaults.passingScore,
          max_attempts: defaults.maxAttempts,
          is_active: defaults.isActive,
          derived_from_module_quiz: true,
          skill_tags: canonicalSkillTags,
          topic_tags: canonicalTopicTags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (insertAssessmentError) {
        handleSupabaseError(insertAssessmentError);
        throw insertAssessmentError;
      }

      assessmentRow = insertedAssessment;
    } else {
      const { data: updatedAssessment, error: updateAssessmentError } = await supabase
        .from("assessments")
        .update({
          title: defaults.title,
          description: defaults.description || null,
          time_limit: defaults.timeLimit || null,
          passing_score: defaults.passingScore,
          max_attempts: defaults.maxAttempts,
          is_active: defaults.isActive,
          derived_from_module_quiz: true,
          skill_tags: canonicalSkillTags,
          topic_tags: canonicalTopicTags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAssessmentRow.id)
        .select("*")
        .single();

      if (updateAssessmentError) {
        handleSupabaseError(updateAssessmentError);
        throw updateAssessmentError;
      }

      assessmentRow = updatedAssessment;
    }

    const { data: existingQuestionRows, error: questionLookupError } = await supabase
      .from("assessment_questions")
      .select("*")
      .eq("assessment_id", assessmentRow.id)
      .order("order", { ascending: true });

    if (questionLookupError) {
      handleSupabaseError(questionLookupError);
      throw questionLookupError;
    }

    const existingRows = existingQuestionRows || [];
    const matchedQuestionIds = new Set<string>();
    const fallbackRows = [...existingRows.filter((row) => !row.source_question_key && row.is_active !== false)];

    for (const [index, block] of gradableQuizBlocks.entries()) {
      const payload = toDerivedQuestionPayload(block, index);
      let matchedRow = existingRows.find((row) => row.source_question_key === payload.sourceQuestionKey);

      if (!matchedRow) {
        matchedRow = fallbackRows.find((row) => row.order === payload.order) || fallbackRows.shift();
      }

      if (matchedRow) {
        matchedQuestionIds.add(matchedRow.id);
        const { error: updateQuestionError } = await supabase
          .from("assessment_questions")
          .update({
            question: payload.question,
            question_type: payload.questionType,
            options: JSON.stringify(payload.options),
            correct_answer: payload.correctAnswer,
            points: payload.points,
            order: payload.order,
            explanation: payload.explanation,
            source_question_key: payload.sourceQuestionKey,
            derived_from_module_quiz: true,
            is_active: true,
          })
          .eq("id", matchedRow.id);

        if (updateQuestionError) {
          handleSupabaseError(updateQuestionError);
          throw updateQuestionError;
        }
      } else {
        const { error: insertQuestionError } = await supabase
          .from("assessment_questions")
          .insert({
            assessment_id: assessmentRow.id,
            question: payload.question,
            question_type: payload.questionType,
            options: JSON.stringify(payload.options),
            correct_answer: payload.correctAnswer,
            points: payload.points,
            order: payload.order,
            explanation: payload.explanation,
            source_question_key: payload.sourceQuestionKey,
            derived_from_module_quiz: true,
            is_active: true,
            created_at: new Date().toISOString(),
          });

        if (insertQuestionError) {
          handleSupabaseError(insertQuestionError);
          throw insertQuestionError;
        }
      }
    }

    const staleQuestionIds = existingRows
      .filter((row) => !matchedQuestionIds.has(row.id) && row.is_active !== false)
      .map((row) => row.id);

    if (staleQuestionIds.length > 0) {
      const { error: deactivateQuestionsError } = await supabase
        .from("assessment_questions")
        .update({ is_active: false })
        .in("id", staleQuestionIds);

      if (deactivateQuestionsError) {
        handleSupabaseError(deactivateQuestionsError);
        throw deactivateQuestionsError;
      }
    }

    return mapAssessmentRow(assessmentRow);
  },
};

