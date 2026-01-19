import { supabase, handleSupabaseError } from "@/lib/supabase";
import { notificationHelpers } from "@/services/notificationService";

export interface Assessment {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  timeLimit?: number; // in minutes
  passingScore: number;
  maxAttempts: number;
  isActive: boolean;
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
}

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

    return {
      id: data.id,
      moduleId: data.module_id,
      title: data.title,
      description: data.description || undefined,
      timeLimit: data.time_limit || undefined,
      passingScore: data.passing_score,
      maxAttempts: data.max_attempts,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
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
      .order("order", { ascending: true });

    if (error) {
      handleSupabaseError(error);
      return [];
    }

    return (
      data?.map((q) => ({
        id: q.id,
        assessmentId: q.assessment_id,
        question: q.question,
        questionType: q.question_type,
        options: q.options ? (Array.isArray(q.options) ? q.options : JSON.parse(q.options)) : undefined,
        correctAnswer: q.correct_answer || undefined,
        points: q.points,
        order: q.order,
        explanation: q.explanation || undefined,
      })) || []
    );
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
        score: a.score || undefined,
        passed: a.passed || undefined,
        answers: a.answers || {},
        timeSpent: a.time_spent || undefined,
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
      score: data.score || undefined,
      passed: data.passed || undefined,
      answers: data.answers || {},
      timeSpent: data.time_spent || undefined,
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

      if (question.questionType === "multiple_choice" || question.questionType === "true_false") {
        if (userAnswer === question.correctAnswer) {
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
      const isCorrect =
        question.questionType === "multiple_choice" || question.questionType === "true_false"
          ? userAnswer === question.correctAnswer
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

    return { score, passed };
  },
};

