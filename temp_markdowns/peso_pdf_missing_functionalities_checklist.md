# PESO Academy PDF Phase-by-Phase Checklist

Based on the requirements extracted from `PESO ACADEMY USER DASHBOARDS-1.pdf`, this checklist organizes the missing or partially implemented functionality into phased delivery blocks.

## Scope Used For Comparison

- PDF dashboard requirements for Trainee, Training Officer, and Admin users
- Current app routes, dashboards, profile, course browse flow, role management, and reporting pages
- Current predictive analytics planning notes in `temp_markdowns/admin_predictive_analytics_plan.md`

## Phase 0: Baseline Audit and Scope Alignment

- [ ] Decide whether to normalize the role model to the three fixed PDF roles: Trainee, Training Officer(trainer), Administrator. (It's only going to be that 3 roles)
  - The PDF describes fixed roles and fixed permissions.
  - The current app still carries additional runtime roles such as validator, employer, SPD, and jobseeker aliases.

- [ ] Align role management presentation with the fixed-role document model (ignore all the role outside those 3)
  - The admin role page already limits display to core roles, but the broader application routing and permissions still include extra roles not described in the PDF.

- [ ] Audit the current recommendation engine and formally mark it as blended heuristic until Phase 3 is complete (But implement the hybrid algorithm in the backend and persist outputs so we can claim it as hybrid in Phase 3)
  - The current recommendation UI exists, but the engine is not yet a true hybrid implementation.

- [ ] Confirm the final topic and skill taxonomy for courses, modules, and assessments 
  - Topic-level performance and content recommendations will stay inconsistent until the taxonomy is standardized.

## Phase 1: Event Capture and Schema Support

- [x] Add analytics and recommendation schema support tables such as `analytics_events`, `analytics_user_daily`, `analytics_recommendation_daily`, `learner_recommendations`, `module_quality_signals`, and `course_risk_scores`
  - Add raw analytics event storage for learner activity, recommendation delivery, and downstream conversion.
  - Add daily rollup tables for user, course, module, recommendation, and admin analytics.
  - Add persisted recommendation output tables so dashboard and browse pages can read saved recommendations.
  - Add persistent predictive output tables for course risk, module quality, and recommendation effectiveness.
  - Implemented in `036_add_phase1_analytics_schema.sql`, including learner recommendation persistence, analytics events, daily rollups, learner skill profiles, module quality signals, and course risk scores.

- [x] Add event logging for recommendation impressions, clicks, accepts, and downstream enrollments
  - Log recommendation impressions when cards are shown on dashboard and browse pages.
  - Log clicks when the learner opens a recommended course.
  - Log accepts when a learner enrolls from a recommendation flow.
  - Attribute downstream enrollments and completions back to the originating recommendation record.
  - Implemented through `analyticsService`, dashboard and browse recommendation tracking, recommendation-attributed enrollments, module completion events, and assessment submission events.

- [x] Add topic-level or skill-level tagging for courses, modules, and assessments
  - Standardize skill tags at the course level.
  - Add topic or skill tags to modules so module completion and assessment performance can be mapped consistently.
  - Ensure assessment questions or assessments can be associated with topic-level performance buckets.
  - Added schema support for `skill_tags` and `topic_tags` across courses, modules, assessments, and assessment questions.

- [x] Add analytics rollups for learner, module, course, and recommendation performance
  - Build learner-level rollups for recency, progress velocity, score trends, and learning time.
  - Build module-level rollups for pass rate, failure rate, time spent, and abandonment indicators.
  - Build course-level rollups for enrollments, completions, certificate issuance, and engagement.
  - Build recommendation rollups for impression, click, accept, enroll, and complete conversion.
  - Added daily rollup tables and a refresh RPC so learner, course, module, recommendation, and admin aggregates can be recomputed after tracked actions.

- [x] Add persisted prediction and recommendation outputs for dashboard reads
  - Persist ranked learner recommendations with score, reasons, source mix, generated timestamp, and model version.
  - Persist learner skill-profile outputs used by trainee summaries and recommendation logic.
  - Persist predictive outputs used by trainer and admin dashboards such as course risk and module quality signals.
  - Dashboard and browse recommendation sections now hydrate from persisted recommendation rows after syncing the current blended scorer output.

## Phase 2: Learner Analytics Foundation

- [x] Add strong-skill and needs-improvement insights
  - Trainee dashboard topic analytics and learner profile snapshot now surface strongest-topic and needs-improvement signals in dedicated insight cards.

- [x] Add overall learning progress analytics indicators beyond the existing progress bars
  - Trainee dashboard now includes overall learning progress indicators for course completion rate, module progress, assessment pass rate, and recent activity.

- [x] Add `Average Assessment Score` to learner(trainee) profile statistics
  - Learner profile training snapshot now includes average assessment score.

- [x] Add `Total Learning Time` to learner(trainee) profile statistics
  - Learner profile training snapshot now includes total tracked learning time.

- [x] Add `Completed Modules` to learner(trainee) profile statistics
  - Learner profile training snapshot now includes completed modules and module completion rate.

- [x] Use these learner(trainee) stats as inputs for analytics and recommendation features
  - The blended recommendation scorer now factors in average assessment score, module completion rate, completed modules, and tracked learning time when ranking follow-on courses.

- [x] Implement learner performance summary on the trainee dashboard
  - PDF requires assessment scores, module completion records, time spent, and topic-level performance results.
  - Trainee dashboard now includes a dedicated learning performance summary with assessment score history, module completion records, tracked learning time, and topic-level insights derived from enrolled course skills.

- [x] Add a dedicated `Learning Performance Summary` block

## Phase 3: Real Hybrid Recommendation Engine

- [x] Upgrade recommendation engine from heuristic blended scoring to a true hybrid algorithm
  - PDF explicitly defines a hybrid approach using content-based filtering and collaborative filtering.
  - Implemented by combining the existing content, onboarding, performance, popularity, and session-behavior scorer with collaborative learner-to-learner enrollment similarity.
  - The current hybrid engine uses user-based collaborative filtering built from shared course history, completion strength, and progress similarity, then blends those collaborative signals into the persisted recommendation score.
  - Recommendation outputs continue to persist, track outcomes, and refresh analytics through the existing learner recommendation and analytics pipeline.

- [x] Add recommendation ranking output on top of standard browse results
  - Implemented through the trainee `Recommended for You` section on the browse page, where ranked recommendation cards are rendered ahead of standard browse results.
  - Note: a later trainee UX phase may still remove this section by product choice, but it is currently implemented.

- [x] Add recommendation reasons such as matching strengths, skill gaps, or similar learner behavior
  - Implemented through explanation reasons that now cover strengths, weak topics, onboarding preferences, session behavior, starter-fit logic, and similar-learner enrollment behavior.

- [x] Add recommendation refresh logic after completions and assessments
  - Implemented through recommendation syncing on trainee surfaces plus tracked `recommendation_refresh` analytics events.
  - Assessment and completion-driven learner signals now feed recommendation recalculation, even though the engine is still not a true collaborative hybrid.

- [x] Implement personalized course recommendations on the trainee dashboard
  - PDF requires recommended courses to appear in `My Dashboard` after module or assessment completion.
  - Trainee dashboard now surfaces personalized recommendation cards that reuse the shared course-ranking logic and adapt recommendation messaging to recent module and assessment activity.

- [x] Add recommendation cards tied to learner activity and assessment outcomes

- [x] Implement `Recommended for You` section on Browse Courses for trainee
  - PDF requires a recommendation section powered by a hybrid recommendation algorithm.
  - The browse page now shows recommendation UI, but the underlying algorithm is still an early blended heuristic and not yet a full hybrid engine.

## Phase 4: Trainee Experience Completion

- [x] Refresh trainee recommendations after assessment completion, module completion, and profile changes
  - Assessment completion and module/session activity already feed refreshed recommendation state on the trainee surfaces.
  - Learner profile updates now trigger an explicit hybrid recommendation resync for persisted dashboard and browse recommendation surfaces, so changes to interests, preferred categories, skill level, and skills refresh recommendation output immediately after save.

- [x] Complete learner profile analytics so profile data can feed both recommendations and predictive features
  - The learner profile now exposes recommendation-driving inputs such as industry interests, preferred categories, skill level, and skills directly in the profile UI.
  - The profile page now surfaces learner profile analytics like recommendation signal coverage and predictive readiness so admins and trainees can see whether enough profile data exists to support personalization and downstream predictive features.

- [x] Connect persisted recommendation outputs to dashboard and browse page rendering
  - Dashboard and browse recommendation cards now sync ranked recommendation rows into storage, hydrate UI cards from persisted records, and log impression and click events per surface.

## Phase 5: Training Officer Analytics

- [x] Implement training performance analytics for Training Officers
  - Trainer dashboard now surfaces average assessment scores, average completion rate, average learning time per course, monthly training trends, and module-level performance diagnostics using live owned-course data.

- [x] Replace the `/trainer/dashboard` placeholder with the actual dashboard experience
  - The trainer route now loads a real analytics dashboard backed by trainer ownership resolution and reporting-service aggregates instead of a basic placeholder summary.

- [x] Add cohort-level analytics cards and visual summaries
  - Added cohort cards and a cohort distribution visualization for not-started, in-progress, completed, and at-risk enrollments.

- [x] Add module trend analysis across created courses
  - Added cross-course module diagnostics covering completion coverage, average learning time, average assessment score, and failure rate for trainer-owned modules.

- [x] Implement content improvement insights for modules
  - Trainer dashboard now surfaces ranked module improvement insights and attention levels for low-score, high-failure, low-completion, and excessive-time patterns.

- [x] Add module problem detection for low score, high failure, and long completion time patterns
  - Module analytics now flag watch and critical modules based on score, failure, completion, and learning-time thresholds.

- [ ] Implement recommendation system performance analytics for Training Officers
  - PDF requires metrics such as enrollments from recommendations, completion rate of recommended courses, most frequently recommended courses, and most accepted recommendations.
  - No recommendation outcome tracking is implemented.

- [ ] Add recommendation performance monitoring widgets

## Phase 6: Admin Analytics and Predictive Oversight

- [x] Expand the admin dashboard from quick links/basic counts into an analytics dashboard aligned with the PDF

- [x] Surface completion trends directly on the dashboard instead of only in reports

- [x] Surface certification issuance trends directly on the dashboard

- [x] Surface trainee performance trends directly on the dashboard

- [x] Surface system-wide engagement indicators directly on the dashboard

- [ ] Implement organization-wide training analytics in the Admin dashboard
  - PDF requires overall enrollments, completion rates, certification issuance, trainee performance trends, and system-wide engagement in the dashboard itself.
  - Current admin dashboard route is stronger than before, but predictive storage, risk scoring, and recommendation-performance reporting are still incomplete.

- [ ] Add dashboard visualizations for learner, trainer, and admin analytics views where current coverage is still partial
  - Admin dashboard now includes a learner-level hybrid recommendation evidence inspector that exposes collaborative candidates, similar learners, and shared-course support for debugging the recommender.

- [ ] Add predictive score storage and consumption for course risk, disengagement, and recommendation acceptance probability

## Phase 7: Trainee UX Cleanup and Enrollment Reliability

- [ ] Remove the trainee recommendation block from the main course browse page
  - The trainee dashboard can remain the primary recommendation surface.
  - Remove duplicated recommendation cards from the course page to reduce clutter and conflicting calls to action.
  - Keep standard browse, preview, and enrollment actions intact after recommendation removal.

- [ ] Fix the `Failed to enroll in this course` trainee flow
  - Audit the enrollment action path for recommendation-attributed and normal enrollments.
  - Surface the real failure reason in the UI instead of a generic failure state.
  - Verify the enrollment flow against active RLS policies, duplicate enrollment handling, and originating recommendation metadata.
  - Current status: enrollment already has a loading state and a generic trainee error toast, but it does not expose the actual failure reason or a structured recovery path.

- [ ] Add trainee-facing retry and recovery states for failed enrollment
  - Show actionable feedback when the course is already enrolled, unavailable, or blocked by access issues.
  - Prevent silent failures that leave the trainee stuck on the same page.

## Phase 8: Trainee Dashboard and Learning Experience Reorganization

- [ ] Reorganize the trainee UI to reduce visual cramping
  - Review the dashboard information density and spacing, especially above-the-fold sections.
  - Clarify the content hierarchy between learner stats, last accessed module, performance summary, and course actions.
  - Reduce duplicate or competing cards that make the trainee home screen feel overloaded.
  - Current status: partially improved already through `Last Accessed Module`, `Recent Learning Sessions`, and session-backed performance summary sections, but the trainee home screen still feels crowded and visually uneven.

- [~] Improve loading and empty states across the trainee dashboard
  - Replace long blank loading regions with clearer skeleton or empty-state messaging.
  - Make the no-enrollment and no-history states easier to understand for first-time trainees.
  - Current status: partial. The dashboard and progress pages already show loading spinners and empty states for courses and session history, but the loading experience still leaves large blank regions and can feel unfinished.

- [~] Standardize trainee navigation and next-step prompts
  - Ensure the dashboard, browse page, profile, and progress pages guide learners toward the next meaningful action.
  - Keep resume learning, start learning, and complete profile actions distinct and easy to scan.
  - Current status: partial. Resume and continue-learning actions already exist through session tracking and enrollment-aware navigation, but the overall next-step hierarchy is not yet unified.

## Phase 9: Registration and Cold-Start Onboarding Flow Redesign

- [ ] Replace the current one-screen registration plus initial assessment layout with a progress flow
  - Split account creation, learner profile details, onboarding interests, and initial assessment inputs into separate steps.
  - Preserve submitted state between steps so the trainee does not lose progress while onboarding.
  - Current status: not implemented. Signup is still a single long page.

- [ ] Add a multi-step progress indicator for registration and initial assessment
  - Show the trainee where they are in the onboarding flow.
  - Make it clear which fields are required for account creation and which fields improve cold-start recommendations.

- [ ] Separate account setup from recommendation profiling inputs
  - Keep the minimum registration step lightweight.
  - Move skill level, interests, preferred categories, and initial assessment questions into dedicated onboarding steps.
  - Current status: not implemented. Onboarding profile inputs are still embedded directly in signup.

- [ ] Persist onboarding progress safely across steps
  - Support back and next navigation without losing entered data.
  - Validate each step independently so the learner can recover from partial input errors.

## Phase 10: Cold-Start Recommendation Integration After Onboarding

- [~] Use the completed registration and initial assessment flow as the authoritative cold-start recommendation input
  - Feed onboarding choices and initial assessment responses into the existing cold-start recommendation layer.
  - Ensure the first recommendation refresh happens after onboarding completion instead of forcing everything into the signup page.
  - Current status: partial. Cold-start recommendations already use onboarding choices captured at signup, but there is no separate initial assessment flow yet.

- [x] Add trainee messaging that explains why initial recommendations were generated
  - Show whether recommendations came from interests, preferred categories, starting level, or initial assessment answers.
  - Keep recommendation explanations concise and trainee-friendly.
  - Implemented already through recommendation headlines, descriptions, badges, and per-course reason chips on the trainee dashboard and browse page.

- [ ] Verify that the redesigned onboarding flow improves first-session trainee usability
  - Confirm trainees can finish registration, complete the initial assessment, and land in a meaningful dashboard state without confusion.
  - Confirm the onboarding flow supports future maintenance better than the current combined page.
  - Blocked until the redesigned onboarding flow exists.

## Focused Build Order For The Remaining Trainee Work

This is the tighter implementation sequence for the still-open trainee items only.

### Step 1: Remove browse-page recommendations safely

- Primary files:
  - `src/pages/Courses.tsx`
  - `src/services/analyticsService.ts`
- Scope:
  - Remove `renderRecommendedSection()` from the trainee browse page.
  - Remove browse-page recommendation syncing, impression logging, and click logging that only exist for that surface.
  - Keep dashboard recommendations intact as the main trainee recommendation surface.
- Verification target:
  - Browse page still loads, filters, previews, and enrolls normally without recommendation-specific UI.

### Step 2: Fix trainee enrollment failure handling

- Primary files:
  - `src/pages/Courses.tsx`
  - `src/services/supabaseDatabaseService.ts`
  - `src/services/analyticsService.ts`
- Scope:
  - Inspect the course enrollment path used by `handleEnrollClick(...)`.
  - Distinguish duplicate enrollment, permission, unpublished-course, and recommendation-attribution failures.
  - Replace the generic trainee error toast with clearer recovery messages.
  - Preserve recommendation attribution only where enrollment actually succeeds.
- Verification target:
  - A failed enroll attempt shows the actual reason and does not leave the page in an ambiguous state.

### Step 3: Reorganize trainee dashboard structure

- Primary files:
  - `src/pages/Dashboard.tsx`
  - `src/pages/ProgressDashboard.tsx`
  - `src/components/DashboardLayout.tsx`
- Scope:
  - Rebalance the order and spacing of learner stats, `Last Accessed Module`, recommendation cards, performance summary, and `My Courses`.
  - Reduce the amount of large blank loading space visible on first load.
  - Clarify the first action for a brand-new trainee versus an active learner.
- Verification target:
  - The trainee dashboard has a cleaner top section and clearer next-step actions without losing session-history functionality.

### Step 4: Improve trainee loading and empty states

- Primary files:
  - `src/pages/Dashboard.tsx`
  - `src/pages/ProgressDashboard.tsx`
  - `src/pages/Courses.tsx`
  - reusable UI components under `src/components/ui/`
- Scope:
  - Replace spinner-only loading blocks with skeleton or contextual placeholders.
  - Improve no-enrollment, no-session-history, and no-performance-history empty states.
  - Make first-use trainee states less visually empty.
- Verification target:
  - Initial loads and empty states feel intentional rather than unfinished.

### Step 5: Split signup into a multi-step onboarding flow

- Primary files:
  - `src/pages/SignUp.tsx`
  - `src/components/auth/AuthPageShell.tsx`
  - `src/lib/onboarding.ts`
  - `src/types/auth.ts`
  - `src/services/supabaseAuthService.ts`
- Scope:
  - Keep account creation in the first step.
  - Move trainee profile details to a second step.
  - Move onboarding interests, preferred categories, and skill level to a later step.
  - Introduce a progress indicator and step-by-step validation.
- Verification target:
  - A trainee can move across steps without losing data and can clearly tell which step they are on.

### Step 6: Add initial assessment as a separate cold-start step

- Primary files:
  - `src/pages/SignUp.tsx` or a new onboarding route/page
  - `src/lib/onboarding.ts`
  - `src/services/reportingService.ts`
  - `src/services/analyticsService.ts`
- Scope:
  - Add a dedicated initial assessment or profiling step after account creation.
  - Keep it distinct from the required signup fields.
  - Store the responses in a form that can influence cold-start recommendations.
- Verification target:
  - The trainee finishes signup first, then completes a separate recommendation-profiling step.

### Step 7: Wire the new onboarding flow into recommendation generation

- Primary files:
  - `src/pages/Dashboard.tsx`
  - `src/pages/Courses.tsx`
  - `src/services/reportingService.ts`
  - `src/services/analyticsService.ts`
- Scope:
  - Refresh recommendations after the new onboarding flow completes.
  - Update trainee messaging so the dashboard explains whether recommendations came from onboarding, initial assessment, or later learning activity.
  - Ensure the first post-signup dashboard state feels useful even before a learner opens modules.
- Verification target:
  - Cold-start recommendations still work after the signup redesign and remain explainable.

### Step 8: Final QA pass for the trainee journey

- Primary files:
  - `src/pages/SignUp.tsx`
  - `src/pages/Dashboard.tsx`
  - `src/pages/Courses.tsx`
  - `src/pages/ProgressDashboard.tsx`
  - related enrollment and auth services
- Scope:
  - Verify registration, onboarding, recommendation generation, browse, enrollment, resume learning, and empty states together.
  - Verify module-session-backed resume flows still work after the trainee UI cleanup.
- Verification target:
  - A new trainee and an existing trainee both have a clear, low-friction path through the system.

## Items That Appear Already Covered By The Current System

These do not belong in the missing checklist, but they help bound the gap analysis:

- Notifications UI exists with notification center and full notifications page
- Course browse, preview, enrollment, and continue learning flows exist
- Course completion certificates and downloads exist
- Admin reports for completion, user activity, compliance, certificate, and enrollment reporting exist
- Trainer learner list and course management flows exist, but they stop short of the PDF's analytics and recommendation requirements

## Recommended Execution Order

- [ ] Complete Phase 0 first so scope, roles, and taxonomy are stable
- [x] Complete Phase 1 before claiming full hybrid recommendation support
- [x] Complete Phase 2 so learner analytics are reliable inputs into recommendations
- [x] Complete Phase 3 before describing the recommender as truly hybrid in UI and docs
- [ ] Complete Phase 5 after recommendation tracking data is mature enough to support trainer reporting
- [ ] Complete Phase 6 after predictive outputs can be persisted and refreshed consistently

## Additional Requirement Status

- [x] Does the system fully implement predictive analytics via a hybrid algorithm?
  - Yes for the current recommendation scope. The engine now blends content, onboarding, performance, popularity, session-behavior, and collaborative filtering signals in one persisted hybrid pipeline.
  - Admin users can inspect the collaborative evidence directly from the dashboard through similar-learner and candidate-course debug views.

- [x] The system should implement time spent tracking for each module (for example: start time, end time, date, and duration) to describe the learning speed. Add a notation for trainees.
  - Implemented through `module_sessions` with `started_at`, `last_seen_at`, `ended_at`, `session_date`, `duration_seconds`, `session_status`, and resume position tracking.
  - Trainee-facing notation already exists through `Total Learning Time`, `Last Accessed Module`, `Recent Learning Sessions`, and `Time Spent by Module` views.

- [x] Add a recommendatory feature in the system that indicates future opportunities for learners.
  - Implemented through personalized course recommendations on the trainee dashboard and browse page.
  - Recommendations already use onboarding preferences, tracked learning behavior, module history, and assessment outcomes to suggest next courses.

- [ ] Include a ranking system for the best learners in each program or course.
  - Not implemented.
  - The system has learner analytics and top-course insights, but it does not currently compute or display a learner leaderboard per course or program.

- [ ] All modules should be implemented in the actual system.
  - Partially supported at the platform level. Module creation, editing, viewing, video/doc rendering, quizzes, assignments, and assessments are supported.
  - This checklist item cannot be marked complete from code alone because it depends on whether every real training course in the deployed database has complete production content.

- [ ] Indicate who will be attending a specific training (trainer).
  - Partially supported. Courses store `instructor` and `instructorId`, and trainer ownership is enforced in trainer/admin flows.
  - This is not yet consistently surfaced as a dedicated trainee-facing “assigned trainer / training officer” indicator across the training experience.

- [ ] How do you assess the performance of staff based on their performance?
  - Not fully implemented.
  - Trainer and admin analytics now show learner, module, course, and recommendation outcomes, but there is no dedicated staff performance scorecard that rates trainers or staff members against managed-course outcomes.

- [x] How do you recommend personalized training?
  - Implemented through a hybrid personalized recommendation flow.
  - Current inputs include onboarding skill level, preferred categories, industry interests, existing skills, average assessment score, strongest and weakest topics, learning time, module completion, session behavior, and similar-learner collaborative signals.

- [ ] How can you recommend a trainee based only on the assessment results?
  - Partially supported, not standalone.
  - Assessment results already influence recommendations through average score, strongest topic, and needs-improvement topic, but the system does not expose an assessment-only recommendation mode.

- [x] The system must have a verification process for the public.
  - Implemented through the public certificate verification flow.
  - Users can verify certificate authenticity by verification code and download the validated certificate from the public verification page.

## Summary Of The New Bottom-Line Status

- Fully implemented now: module time tracking, personalized recommendations, future-opportunity recommendations, and public certificate verification.
- Partially implemented: trainer indication, assessment-only recommendation logic, and the platform-side module system.
- Still missing: learner ranking or leaderboard features, plus broader predictive scoring beyond the recommendation engine itself.
