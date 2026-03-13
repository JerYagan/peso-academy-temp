# PESO Academy Recommendation System Documentation

## Purpose of this document

This document explains how the learner recommendation system currently works in PESO Academy.

It is written for non-technical readers who need to understand:

- what information the system uses
- how that information is turned into course suggestions
- where the logic lives in the codebase
- which database records support it
- how the new assessment and completion rules affect recommendations
- what learners actually experience in practice

The short version is this:

PESO Academy uses a hybrid recommendation approach. That means it does not rely on only one signal. Instead, it combines learner profile data, course metadata, learning activity, assessment performance, and patterns from similar learners to rank courses that are most likely to help the learner next.

This is not a black-box AI model. It is a rules-based scoring system with analytics support. In plain English, the system looks at what the learner said about themselves, what they have already studied, how they performed, where they seem to be struggling, and what similar learners chose, then gives each possible course a score.

## Main outcome for learners

The main learner-facing outcome today is personalized course recommendations on the dashboard.

The system is designed to answer a simple question:

What course should this learner take next, based on what we currently know about them?

It tries to balance three things:

1. Relevance
2. Readiness
3. Practical next-step value

That means the system does not simply push the most popular course. It tries to recommend a course that fits the learner's current interests, current level, recent activity, and actual performance.

## Where the recommendation logic lives in the codebase

### Main services

- `src/services/reportingService.ts`
	- This is the core recommendation engine.
	- It builds learner performance summaries.
	- It computes collaborative signals from similar learners.
	- It calculates hybrid recommendation scores.
	- It also calculates a separate assessment-only advisory mode.

- `src/services/recommendationSyncService.ts`
	- This refreshes and persists recommendation rows after profile-driven events such as onboarding completion and learner profile updates.

- `src/services/analyticsService.ts`
	- This stores recommendation rows in the database.
	- It logs recommendation analytics events such as refresh, impression, click, and accept.
	- It supports recommendation attribution when a learner enrolls from a recommendation.

- `src/services/moduleSessionService.ts`
	- This provides session-level learning activity used by the recommendation logic.
	- It summarizes time spent and repeat visits at module level.

- `src/services/supabaseDatabaseService.ts`
	- This connects recommendation attribution to enrollment records.
	- It also calculates actual learning time and credited course hours for completion reporting.

### Learner-facing components and pages

- `src/pages/Dashboard.tsx`
	- This is the main learner page that computes and shows personalized recommendations.
	- It loads learner performance, collaborative signals, and session history, then calls the hybrid recommendation builder.

- `src/components/trainee/TraineeOnboardingModal.tsx`
	- This is where post-login onboarding answers are collected.
	- When onboarding is completed, it refreshes profile-driven recommendations.

- `src/pages/Profile.tsx`
	- When the learner updates recommendation-related profile fields, this page refreshes persisted recommendations.

### Supporting type definitions

- `src/types/auth.ts`
	- Learner profile fields used by the recommendation system.

- `src/types/index.ts`
	- Shared app-level types such as `Course`, `Enrollment`, and recommendation-linked enrollment fields.

- `src/types/database.ts`
	- Database-side fields such as `credited_duration_hours` and `actual_learning_minutes`.

## High-level recommendation flow

The recommendation flow works like this:

1. The system gathers the learner's profile data.
2. The system gathers the learner's course history, module progress, assessment history, and session activity.
3. The system gathers metadata for all available courses.
4. The system checks whether there are other learners with similar enrollment history and progress.
5. The system scores each available course using several groups of signals.
6. The system sorts the courses by score.
7. The top-ranked courses are shown to the learner.
8. In some profile-driven workflows, the top recommendations are also saved to the database for analytics and attribution.

## Important implementation detail

There are two closely related behaviors in the current system:

### 1. Live recommendation calculation

When the learner opens the dashboard, the dashboard loads fresh learner data and computes recommendations in memory using `buildLearnerCourseRecommendations()`.

This is the active, visible recommendation experience for learners today.

### 2. Persisted recommendation snapshots

When the learner completes onboarding or updates their profile, `recommendationSyncService.refreshProfileDrivenRecommendations()` recalculates recommendations and saves them into the `learner_recommendations` table through `analyticsService.syncLearnerRecommendations()`.

These saved rows are useful for:

- analytics
- acceptance tracking
- recommendation attribution on enrollment
- reporting for admin and trainer dashboards

So the system both calculates recommendations live and also stores recommendation snapshots at important profile-change moments.

## The data the recommendation system uses

The recommendation engine uses five major groups of data.

## 1. Learner profile data

This is the information the learner gives about themselves.

Main fields include:

- `users.industry_interests`
- `users.preferred_categories`
- `users.skills`
- `users.onboarding_skill_level`
- `users.onboarding_confidence_level`
- `users.onboarding_weekly_commitment`
- `users.onboarding_digital_comfort`
- `users.onboarding_completed_at`

In simple terms, this tells the system:

- what the learner wants to learn
- what type of training they prefer
- how confident they are
- how much time they can commit
- how comfortable they are with digital tools
- what skills they already believe they have

This profile data is especially important for new learners who do not yet have much course history.

## 2. Course metadata

This is the information attached to each course.

Main fields include:

- `courses.title`
- `courses.description`
- `courses.category`
- `courses.level`
- `courses.duration`
- `courses.skills`
- `courses.skill_tags`
- `courses.topic_tags`
- `courses.industry_tags`
- `courses.career_paths`
- `courses.is_tesda_accredited`
- `courses.enrolled_count`
- `courses.published`

In simple terms, this tells the system what a course is about, who it is suitable for, how advanced it is, and how popular it is.

## 3. Learning history and progress data

This is the record of what the learner has already done inside the platform.

Main fields and sources include:

- `enrollments.course_id`
- `enrollments.status`
- `enrollments.progress`
- `enrollments.completion_approval_status`
- `module_completions.time_spent`
- `module_completions.completed_at`
- `module_sessions.duration_seconds`
- `module_sessions.last_seen_at`
- `module_sessions.session_status`

This tells the system:

- which courses the learner already joined
- which ones they finished
- which categories they keep returning to
- whether they are building momentum
- whether they are revisiting content without finishing it

## 4. Assessment performance data

This is the learner's measured performance in assessments.

Main fields include:

- `assessment_attempts.score`
- `assessment_attempts.passed`
- `assessment_attempts.submitted_at`
- `assessment_attempts.time_spent`
- assessment-level `skill_tags`
- assessment-level `topic_tags`
- module-level `skill_tags`
- module-level `topic_tags`

This tells the system:

- the learner's average score
- their best score
- the topics where they are strongest
- the topics where they need support
- whether they are ready for more advanced material or need more foundational support

One important detail is that the assessment-only advisory mode needs scored assessment evidence. If an assessment has been submitted but is still waiting for manual review, the activity and time are still visible, but the score-based recommendation signal is weaker or unavailable until a score exists.

## 5. Similar learner behavior

This is the collaborative part of the hybrid system.

The system compares one learner's enrollment and progress pattern with other learners and looks for learners with similar histories.

It uses:

- overlapping enrolled courses
- how close the learners' progress is in those shared courses
- whether those similar learners completed related courses
- which extra courses those similar learners chose

This helps answer a question like:

Learners who are following a path similar to this learner, what did they take next?

## How the system prepares learner performance data

Before the system ranks courses, it builds a learner performance summary in `reportingService.getLearnerPerformanceSummary()`.

That summary combines:

- enrolled courses
- modules in those courses
- module completions
- module sessions
- assessment attempts
- topic and skill tags from courses, modules, and assessments

It then produces a structured summary with values such as:

- assessments taken
- scored assessments
- passed assessments
- average assessment score
- best assessment score
- modules completed
- total modules
- overall module completion rate
- total learning minutes
- topic-level performance
- strongest topic
- needs-improvement topic
- recent assessments
- recent modules

This summary becomes a major input to both the hybrid recommender and the assessment-only advisory mode.

## How the hybrid recommendation score is built

The main recommendation engine is `buildLearnerCourseRecommendations()` in `src/services/reportingService.ts`.

It looks at every available course that the learner is not already enrolled in and gives that course a score.

The score is built from several groups of signals.

## Signal group 1. Match to declared learner interests and skills

The system rewards courses that match the learner's:

- profile skills
- preferred categories
- industry interests

Examples:

- If the learner listed spreadsheet work and office administration as skills or interests, courses in those areas receive a boost.
- If the learner selected a preferred category such as business, a business course receives a stronger score.

This is the most direct "you told us you want this" part of the system.

## Signal group 2. Progression from completed training

The system looks at courses the learner has already completed and asks:

- Is this new course in a category the learner already completed?
- Is it a natural next step from a lower level to a higher level?

Examples:

- If the learner completed a beginner digital skills course, an intermediate digital course gets a boost.
- If the learner completed training in a category, more courses in that category are treated as stronger candidates.

Important rule:

For this part of the algorithm, "completed" means the enrollment status is actually `completed`, not just 100% progress. Because course completion is now trainer-approved, a learner who reached 100% but is still waiting for approval does not yet receive the full completed-course progression boost.

## Signal group 3. Assessment strengths and support needs

The system looks at assessed strengths and weak points.

Examples:

- If the learner performs strongly in one topic, a course that extends that strength gets a boost.
- If the learner is weaker in a topic, a course that helps improve that topic also gets a boost.

This lets recommendations do two things at once:

- build on strengths
- support weaker areas

That is why recommendation reasons can include both "extends your strong results" and "helps improve" messages.

## Signal group 4. Session behavior and learning momentum

The system studies recent learning sessions using module session aggregates.

It looks for patterns such as:

- recent activity in a category
- repeated short sessions without completion
- revisited modules
- healthy ongoing engagement
- learning momentum over the last 14 days

Examples:

- If the learner has many recent sessions in a category, related courses receive a boost.
- If the learner repeatedly revisits short beginner-level content without completing it, the system may recommend a more supportive beginner option in that same area.
- If the learner has steady engagement and good recent results, the system is more willing to suggest a stronger next step.

This helps the engine react not only to what the learner said, but to what they are actually doing.

## Signal group 5. Similar learner patterns

The collaborative recommendation computation works like this:

1. Find the learner's existing course enrollments.
2. Find other learners who share some of those courses.
3. Compare how close their progress is in the shared courses.
4. Rank those other learners by similarity.
5. Look at what extra courses those similar learners enrolled in or completed.
6. Turn those extra courses into recommendation signals.

This signal can produce reasons such as:

- "2 similar learners completed this course"
- "learners with similar histories also chose this course"

This is helpful when profile data alone is not enough, because it uses observed platform behavior from similar learners.

## Signal group 6. Popularity weighting

The system also gives a smaller boost to courses with higher enrollment counts.

This does not dominate the ranking, but it helps stable, widely used courses surface when other signals are close.

In plain English, popularity is a tie-breaker and confidence booster, not the main decision-maker.

## Signal group 7. Cold-start support for new learners

New learners often have little or no learning history. The system handles this with onboarding-driven logic.

If the learner has not completed much yet, the algorithm relies more heavily on:

- onboarding skill level
- onboarding confidence level
- weekly commitment
- digital comfort
- starter-friendly course defaults
- beginner-level recommendations

Examples:

- A learner who says they need guidance and can only study a small amount each week is more likely to receive shorter beginner-friendly courses.
- A learner who says they are ready for projects and comfortable with digital tools is more likely to receive intermediate next steps.

This is how the system avoids giving empty or random suggestions to a brand-new learner.

## Acceptance probability

For each recommended course, the system also estimates an acceptance probability.

This is not a guarantee. It is a best-effort estimate of how likely the learner is to respond positively to the recommendation.

The estimate is based on things such as:

- the overall recommendation score
- category match
- skill overlap
- collaborative support
- recent activity in the same category
- whether the learner is still in a cold-start beginner phase

This value is stored when recommendation rows are persisted. It supports analytics and reporting, especially for understanding whether the system is suggesting courses that learners are likely to act on.

## Assessment-only advisory mode

The codebase also includes a separate recommendation builder called `buildAssessmentOnlyCourseRecommendations()`.

This mode is narrower than the full hybrid engine.

It only uses assessment evidence, such as:

- strongest topic
- weakest topic
- failed competency clusters
- assessed topics
- overall score band

The score band is grouped into:

- support
- developing
- proficient
- advanced

The purpose of this mode is to answer a simpler question:

If we only looked at measured assessment performance, what course would make sense next?

This is useful as an advisory layer, but the main learner recommendation experience remains the hybrid model because it is more complete and more context-aware.

## How recommendations are saved and tracked

When recommendation snapshots are persisted, they are stored in `learner_recommendations`.

Saved fields include:

- learner id
- course id
- source surface
- rank
- score
- reasons
- source mix
- recommendation context
- model version
- acceptance probability
- generated time
- impression, click, accept, enrollment, and completion counts

Related analytics events are stored in `analytics_events`.

Examples of tracked recommendation events include:

- `recommendation_refresh`
- `recommendation_impression`
- `recommendation_click`
- `recommendation_accept`
- `course_enroll`

These events are processed into rollup tables such as:

- `analytics_user_daily`
- `analytics_course_daily`
- `analytics_recommendation_daily`
- `analytics_admin_daily`

This allows the organization to measure whether recommendations are being seen, clicked, accepted, and turned into enrollments or completions.

## Relevant database tables and fields

Below is the most important database footprint for the recommendation system.

### Learner profile and preferences

- `public.users`
	- `industry_interests`
	- `preferred_categories`
	- `skills`
	- `onboarding_skill_level`
	- `onboarding_confidence_level`
	- `onboarding_weekly_commitment`
	- `onboarding_digital_comfort`
	- `onboarding_completed_at`

### Course, module, and assessment metadata

- `public.courses`
	- `category`
	- `level`
	- `duration`
	- `skills`
	- `skill_tags`
	- `topic_tags`
	- `industry_tags`
	- `career_paths`
	- `is_tesda_accredited`
	- `enrolled_count`
	- `published`

- `public.modules`
	- `course_id`
	- `skill_tags`
	- `topic_tags`

- `public.assessments`
	- `module_id`
	- `skill_tags`
	- `topic_tags`

- `public.assessment_questions`
	- `skill_tags`
	- `topic_tags`

### Learning progress and activity

- `public.enrollments`
	- `progress`
	- `status`
	- `completion_approval_status`
	- `credited_duration_hours`
	- `actual_learning_minutes`
	- `originating_recommendation_id`

- `public.module_completions`
	- `enrollment_id`
	- `module_id`
	- `time_spent`
	- `completed_at`

- `public.module_sessions`
	- `user_id`
	- `enrollment_id`
	- `course_id`
	- `module_id`
	- `started_at`
	- `last_seen_at`
	- `ended_at`
	- `duration_seconds`
	- `session_status`
	- `resume_position_seconds`

### Assessment performance

- `public.assessment_attempts`
	- `user_id`
	- `enrollment_id`
	- `assessment_id`
	- `score`
	- `passed`
	- `submitted_at`
	- `time_spent`

### Recommendation storage and analytics

- `public.learner_recommendations`
	- `user_id`
	- `course_id`
	- `source_surface`
	- `rank`
	- `score`
	- `reasons`
	- `source_mix`
	- `recommendation_context`
	- `model_version`
	- `acceptance_probability`
	- `acceptance_band`
	- `impression_count`
	- `click_count`
	- `accept_count`
	- `enrollment_count`
	- `completion_count`

- `public.analytics_events`
	- `event_name`
	- `user_id`
	- `course_id`
	- `module_id`
	- `assessment_id`
	- `enrollment_id`
	- `recommendation_id`
	- `surface`
	- `session_id`
	- `metadata`

- `public.analytics_user_daily`
- `public.analytics_course_daily`
- `public.analytics_module_daily`
- `public.analytics_recommendation_daily`
- `public.analytics_admin_daily`
- `public.learner_skill_profiles`
- `public.course_risk_scores`
- `public.learner_disengagement_scores`

## How the new assessment and completion rules affect recommendations

The recent platform changes have a real impact on recommendation behavior.

## 1. Trainer-approved completion changes progression signals

Course completion is no longer treated as fully automatic. A learner can reach 100% progress and still remain in a pending approval state.

That matters because the hybrid engine's completed-course affinity uses enrollments whose status is truly `completed`.

Practical effect:

- If a learner finished all required work but is still waiting for trainer approval, the system does not yet fully treat that course as a completed foundation for next-step progression boosts.

This is a deliberate safety behavior. It prevents the system from recommending advanced follow-up training as if the learner's course was already fully cleared when the trainer review process is still open.

## 2. Manual-review assessments delay some score-based signals

Essay and other manual-review workflows mean some attempts may be submitted without a final score yet.

Practical effect:

- The learner's activity and time still exist.
- But topic strength and weakness signals are more reliable only after scored results are available.
- Assessment-only advisory recommendations especially depend on scored evidence.

So the new review rules do not stop recommendations, but they can delay the strongest score-based recommendation boosts until trainer review is complete.

## 3. Actual learning time and credited hours are now kept separate

The system now stores two different time values for a completed course:

- `actual_learning_minutes`
- `credited_duration_hours`

These values serve different purposes.

### Actual learning minutes

This is the learner's observed effort.

It is calculated from the larger of:

- total module session time, or
- total module-completion time plus assessment-attempt time

This value is useful for analytics, reporting, and behavior signals.

### Credited duration hours

This is the official course credit value.

It comes from the course's defined duration and is only populated when completion is approved.

This means recommendation logic can continue using actual study behavior honestly, while the platform can still award official credit hours separately for reporting and certificates.

## 4. Recommendation logic still exists after the workflow changes

The new assessment and completion rules did not remove recommendations.

Instead, they made the recommendation inputs more careful and more accurate by separating:

- activity from final approval
- submitted work from scored work
- observed time from awarded credit

## What the system does not currently do

To keep expectations clear, the current active implementation does not appear to be a separate job-matching or opportunity-matching engine for learners.

It does recommend next courses and learning paths.

It also stores career-path metadata on courses and can use that metadata to explain that a course extends a learner's direction.

But the active implementation is still course-focused, not job-vacancy matching.

## Practical examples

## Example 1. Brand-new learner after onboarding

Learner profile:

- selected beginner level
- said they need guidance
- chose business-related categories
- can only study a few hours each week
- has no completed modules or assessments yet

What the system does:

- gives more weight to onboarding answers because there is little learning history
- favors beginner courses
- favors shorter or lighter-commitment courses
- favors business-related categories
- may prefer TESDA-recognized or starter-friendly courses if other signals are limited

Likely recommendation result:

- a beginner business or office-related course
- a course with reasons like "fits your starting level" and "matches your preferred category"

## Example 2. Learner with strong results and healthy momentum

Learner profile:

- already completed a beginner digital course
- has high recent assessment scores
- has steady recent session activity
- shows strong performance in a digital topic

What the system does:

- recognizes completed-course progression
- recognizes strong assessment performance
- recognizes healthy engagement and momentum
- may add collaborative support if similar learners also moved into an intermediate course

Likely recommendation result:

- an intermediate digital course
- reasons like "natural next step," "extends your strong results," and "matches learning paths taken by similar trainees"

## Example 3. Learner who keeps revisiting content without finishing

Learner profile:

- several short recent sessions
- repeated incomplete module attempts
- weaker assessment performance in one topic
- no approved course completion yet

What the system does:

- detects struggle behavior from repeated short or incomplete sessions
- identifies a weaker topic from assessment evidence
- avoids over-promoting more advanced next steps
- favors beginner or support-oriented material in the same area

Likely recommendation result:

- a lower-risk beginner support course
- reasons like "supports areas where recent modules were revisited without completion" and "helps improve your weakest topic"

## Example 4. Learner at 100% progress but still waiting for trainer approval

Learner profile:

- all modules finished
- progress shows 100%
- completion approval status is pending
- essay review or trainer signoff not fully complete yet

What the system does:

- may still see strong activity and momentum
- may still see collaborative or category-based signals
- does not fully count that course as completed for completion-based progression boosts until the enrollment status is truly completed

Likely recommendation result:

- the learner can still receive recommendations
- but some "builds on your completed training" signals will not appear yet

## Why this system benefits learners

The recommendation system benefits learners because it tries to meet them where they are.

Instead of offering the same list to everyone, it can:

- give new learners a gentler starting point
- help struggling learners find support-oriented next steps
- help stronger learners move forward faster
- use real activity, not only static profile data
- reduce irrelevant suggestions by combining many signals together

In practical terms, this makes the platform feel more guided and less overwhelming.

## Summary

PESO Academy's current recommendation system is a hybrid, rules-based recommendation engine.

It combines:

- learner profile signals
- onboarding answers
- course metadata
- completed-course history
- module session behavior
- assessment performance
- similar learner patterns
- limited popularity weighting

It then ranks available courses and explains the top suggestions in learner-friendly reasons.

The new assessment and completion workflow does not remove this capability. Instead, it makes the logic more careful by separating:

- pending review from approved completion
- submitted assessment work from scored assessment evidence
- actual learning time from officially credited course hours

That allows PESO Academy to keep recommendations relevant while also respecting trainer-reviewed learning workflows.
