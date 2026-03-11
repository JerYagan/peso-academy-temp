# PESO Academy PDF Phase-by-Phase Checklist

Based on the requirements extracted from `PESO ACADEMY USER DASHBOARDS-1.pdf`, this checklist organizes the missing or partially implemented functionality into phased delivery blocks.

## Scope Used For Comparison

- PDF dashboard requirements for Trainee, Trainer, and Admin users
- Current app routes, dashboards, profile, course browse flow, role management, and reporting pages
- Current predictive analytics planning notes in `temp_markdowns/admin_predictive_analytics_plan.md`

## Phase 0: Baseline Audit and Scope Alignment

- [x] Decide whether to normalize the role model to the three fixed PDF roles: Trainee, Trainer, Administrator. (It's only going to be that 3 roles)
  - Implemented by collapsing runtime role normalization to `trainee`, `trainer`, and `admin`, while hard-mapping legacy roles such as `training_officer`, `spd`, `validator`, `employer`, and `jobseeker` into those three supported roles.

- [x] Align role management presentation with the fixed-role document model (ignore all the role outside those 3)
  - Admin role management, admin user role assignment, dashboard navigation, and public role-marketing copy now present only `trainee`, `trainer`, and `admin` as first-class roles.

- [x] Audit recommendation engine labels and align docs/UI with the current persisted hybrid pipeline
  - Completed by auditing dashboard, profile, trainer analytics, admin analytics, and markdown docs, then removing stale `blended heuristic` wording and browse-page-primary recommendation references outside of historical implementation notes.

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
  - Implemented through `analyticsService`, persisted dashboard recommendation tracking, recommendation-attributed enrollments, module completion events, and assessment submission events. Historical browse-surface tracking existed before the browse recommendation rail was removed in the later trainee UX cleanup.

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
  - The trainee dashboard recommendation surface now hydrates from persisted recommendation rows after syncing the current hybrid scorer output.

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
  - The hybrid recommendation engine now factors in average assessment score, module completion rate, completed modules, and tracked learning time when ranking follow-on courses.

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
  - Historical implementation note: this was originally delivered through a trainee `Recommended for You` section on the browse page, where ranked recommendation cards rendered ahead of standard browse results.
  - That browse-page rail was later removed by product decision so the trainee dashboard remains the primary recommendation surface.

- [x] Add recommendation reasons such as matching strengths, skill gaps, or similar learner behavior
  - Implemented through explanation reasons that now cover strengths, weak topics, onboarding preferences, session behavior, starter-fit logic, and similar-learner enrollment behavior.

- [x] Add recommendation refresh logic after completions and assessments
  - Implemented through recommendation syncing on trainee surfaces plus tracked `recommendation_refresh` analytics events.
  - Assessment and completion-driven learner signals now feed persisted hybrid recommendation recalculation.

- [x] Implement personalized course recommendations on the trainee dashboard
  - PDF requires recommended courses to appear in `My Dashboard` after module or assessment completion.
  - Trainee dashboard now surfaces personalized recommendation cards that reuse the shared course-ranking logic and adapt recommendation messaging to recent module and assessment activity.

- [x] Add recommendation cards tied to learner activity and assessment outcomes

- [x] Implement `Recommended for You` section on Browse Courses for trainee
  - PDF requires a recommendation section powered by a hybrid recommendation algorithm.
  - Historical implementation note: the browse page temporarily exposed the recommendation rail during the hybrid rollout, but that surface was later removed so the trainee dashboard remains the primary recommendation entry point.

## Phase 4: Trainee Experience Completion

- [x] Refresh trainee recommendations after assessment completion, module completion, and profile changes
  - Assessment completion and module/session activity already feed refreshed recommendation state on the trainee surfaces.
  - Learner profile updates now trigger an explicit hybrid recommendation resync for the persisted dashboard recommendation surface, so changes to interests, preferred categories, skill level, and skills refresh recommendation output immediately after save.

- [x] Complete learner profile analytics so profile data can feed both recommendations and predictive features
  - The learner profile now exposes recommendation-driving inputs such as industry interests, preferred categories, skill level, and skills directly in the profile UI.
  - The profile page now surfaces learner profile analytics like recommendation signal coverage and predictive readiness so admins and trainees can see whether enough profile data exists to support personalization and downstream predictive features.

- [x] Connect persisted recommendation outputs to dashboard and browse page rendering
  - The trainee dashboard recommendation cards now sync ranked recommendation rows into storage, hydrate UI cards from persisted records, and log impression and click events for the active learner-facing surface.

## Phase 5: Training Officer Analytics
- [x] Implement recommendation system performance analytics for Training Officers
  - Trainer analytics now aggregate recommendation impressions, click-through rate, accept rate, enrollments from recommendations, completion rate of recommendation-driven enrollments, most frequently recommended courses, and most accepted recommendation outcomes.
  - This is built on the existing recommendation outcome tracking already stored in `learner_recommendations` and recommendation-attributed enrollments.

- [x] Add recommendation performance monitoring widgets
  - The trainer dashboard now includes recommendation KPI cards, course-level recommendation performance charts, and recommendation winner summaries.
  - Dashboard drill-down links now route trainers from course and module insights into focused course and learner review flows.

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


## Phase 6: Admin Analytics and Predictive Oversight
- [x] Implement organization-wide training analytics in the Admin dashboard
  - The admin dashboard now combines overall enrollments, completion rates, certification issuance, trainee performance trends, system-wide engagement, course-risk monitoring, learner disengagement watchlists, and recommendation-performance reporting in the dashboard itself.
  - It now consumes stored predictive signals instead of stopping at descriptive analytics only.

- [x] Add dashboard visualizations for learner, trainer, and admin analytics views where current coverage is still partial
  - The remaining partial admin coverage is now closed with predictive oversight charts, recommendation-performance visualizations, stored course-risk views, learner disengagement watchlists, and the existing learner-level hybrid recommendation evidence inspector.

- [x] Add predictive score storage and consumption for course risk, disengagement, and recommendation acceptance probability
  - Added persisted learner disengagement scoring, threaded recommendation acceptance probability into stored recommendation rows, and consumed stored course-risk, disengagement, and acceptance-probability signals in the admin dashboard.
  - Added a new Supabase migration to extend predictive storage and refresh routines for these scores.

- [x] Expand the admin dashboard from quick links/basic counts into an analytics dashboard aligned with the PDF

- [x] Surface completion trends directly on the dashboard instead of only in reports

- [x] Surface certification issuance trends directly on the dashboard

- [x] Surface trainee performance trends directly on the dashboard

- [x] Surface system-wide engagement indicators directly on the dashboard


## Phase 7: Trainee UX Cleanup and Enrollment Reliability

- [x] Remove the trainee recommendation block from the main course browse page
  - The duplicated trainee recommendation block has been removed from the main browse page so the dashboard remains the primary recommendation surface.
  - Standard browse, preview, and enrollment actions remain intact on the course catalog.
  - Dashboard recommendation cards now include course thumbnails or visual fallbacks so they are visually aligned with the browse cards.

- [x] Fix the `Failed to enroll in this course` trainee flow
  - The enrollment action path now performs explicit course availability and duplicate-enrollment checks before insert, and it classifies access-restricted, unavailable, duplicate, and unknown failures into user-facing recovery guidance.
  - Trainee enrollment now surfaces the real failure reason instead of only a generic toast, while preserving recommendation attribution metadata for dashboard recommendation enrollments.

- [x] Add trainee-facing retry and recovery states for failed enrollment
  - Added actionable retry and recovery alerts in the trainee browse page, trainee dashboard recommendation section, and course-detail enrollment view.
  - Recovery states now guide the trainee toward retry, browsing other courses, or updating profile details instead of leaving them with a silent generic failure.

## Phase 8: Trainee Dashboard and Learning Experience Reorganization

- [x] Reorganize the trainee UI to reduce visual cramping
  - Review the dashboard information density and spacing, especially above-the-fold sections.
  - Clarify the content hierarchy between learner stats, last accessed module, performance summary, and course actions.
  - Reduce duplicate or competing cards that make the trainee home screen feel overloaded.
  - Implemented: reworked the trainee dashboard around a primary next-step hero, compact learner signal summary, and supporting shortcut cards so active learning, progress review, and profile refinement no longer compete in the same visual tier.

- [x] Improve loading and empty states across the trainee dashboard
  - Replace long blank loading regions with clearer skeleton or empty-state messaging.
  - Make the no-enrollment and no-history states easier to understand for first-time trainees.
  - Implemented: replaced blocking spinner-heavy states with skeleton placeholders on the dashboard, browse page, progress page, and learner profile training snapshot; expanded empty states now point trainees toward browsing, resuming, or updating their profile.

- [x] Standardize trainee navigation and next-step prompts
  - Ensure the dashboard, browse page, profile, and progress pages guide learners toward the next meaningful action.
  - Keep resume learning, start learning, and complete profile actions distinct and easy to scan.
  - Implemented: added aligned next-step prompt panels across the dashboard, browse page, profile, and progress pages so resume learning, browse courses, review progress, and complete profile actions use consistent language and clearer routing intent.

## Phase 9: Registration and Cold-Start Onboarding Flow Redesign

- [x] Replace the current one-screen registration plus initial assessment layout with a progress flow
  - Split account creation, learner profile details, onboarding interests, and initial assessment inputs into separate steps.
  - Preserve submitted state between steps so the trainee does not lose progress while onboarding.
  - Implemented: rewrote signup into a four-step flow covering account setup, learner profile details, recommendation profiling, and a separate readiness-check step for cold-start onboarding.

- [x] Add a multi-step progress indicator for registration and initial assessment
  - Show the trainee where they are in the onboarding flow.
  - Make it clear which fields are required for account creation and which fields improve cold-start recommendations.
  - Implemented: added a step-by-step progress bar, per-step cards, and explicit required versus optional/cold-start labels so trainees can see what is mandatory and what improves recommendations.

- [x] Separate account setup from recommendation profiling inputs
  - Keep the minimum registration step lightweight.
  - Move skill level, interests, preferred categories, and initial assessment questions into dedicated onboarding steps.
  - Implemented: kept the first step to name, email, and password only, then moved learner profile fields, interest/category signals, and the initial readiness questions into later onboarding steps.

- [x] Persist onboarding progress safely across steps
  - Support back and next navigation without losing entered data.
  - Validate each step independently so the learner can recover from partial input errors.
  - Implemented: added draft persistence in local storage, back/next step navigation, and step-level validation for account setup and date validation so partial onboarding can be resumed safely.

## Phase 10: Cold-Start Recommendation Integration After Onboarding

- [x] Use the completed registration and initial assessment flow as the authoritative cold-start recommendation input
  - Feed onboarding choices and initial assessment responses into the existing cold-start recommendation layer.
  - Ensure the first recommendation refresh happens after onboarding completion instead of forcing everything into the signup page.
  - Implemented: onboarding completion now persists the readiness answers in auth metadata, triggers the first cold-start recommendation refresh with an explicit `onboarding_completion` context, and uses those readiness signals in the hybrid cold-start scorer alongside interests, preferred categories, starting level, and existing skills.

- [x] Verify that the redesigned onboarding flow improves first-session trainee usability
  - Confirm trainees can finish registration, complete the initial assessment, and land in a meaningful dashboard state without confusion.
  - Confirm the onboarding flow supports future maintenance better than the current combined page.
  - Implemented: after onboarding finishes, new trainees land in the dashboard with a first-session onboarding summary and starter-recommendation handoff instead of an uncontextualized dashboard load; the flow remains split by responsibility and was smoke-tested through a successful production build.
  
- [x] Add trainee messaging that explains why initial recommendations were generated
  - Show whether recommendations came from interests, preferred categories, starting level, or initial assessment answers.
  - Keep recommendation explanations concise and trainee-friendly.
  - Implemented already through recommendation headlines, descriptions, badges, and per-course reason chips on the trainee dashboard and browse page.


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
  - Implemented through personalized course recommendations on the trainee dashboard as the primary learner recommendation surface.
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
  - Current inputs include onboarding skill level, onboarding readiness answers, preferred categories, industry interests, existing skills, average assessment score, strongest and weakest topics, learning time, module completion, session behavior, and similar-learner collaborative signals.

- [ ] How can you recommend a trainee based only on the assessment results?
  - Partially supported, not standalone.
  - Assessment results already influence recommendations through average score, strongest topic, and needs-improvement topic, but the system does not expose an assessment-only recommendation mode.

- [x] The system must have a verification process for the public.
  - Implemented through the public certificate verification flow.
  - Users can verify certificate authenticity by verification code and download the validated certificate from the public verification page.

## Implementation Steps For Remaining Unchecked Items

This section translates the still-open checklist items into buildable implementation steps. The unchecked lines under `Recommended Execution Order` remain sequencing markers, not separate feature work.

### 1. Phase 0: Role Model Normalization

- [x] Goal: reduce the live role model to the three PDF roles only: `trainee`, `trainer`, and `admin`.
- [x] Step 1: inventory every extra runtime role and alias across route guards, auth hydration, role normalization, database role pages, and permission helpers.
- [x] Step 2: decide whether non-PDF roles will be migrated, hidden, or hard-mapped into one of the three supported roles.
- [x] Step 3: update role normalization and dashboard routing so unsupported roles no longer appear as first-class destinations.
- [x] Step 4: simplify admin role-management UI to show only the three supported roles and remove extra-role editing paths.
- [x] Step 5: run a migration and cleanup pass for existing user rows whose roles still fall outside the final three-role model.
- [x] Verification: no user-facing route, role picker, or permissions summary should present roles outside `trainee`, `trainer`, and `admin`.

### 2. Phase 0: Recommendation Engine Label Audit

- [x] Goal: reconcile historical checklist wording that still references a pre-hybrid or browse-page recommendation state.
- [x] Step 1: audit user-facing labels in dashboard, profile, trainer analytics, admin analytics, and markdown docs for stale references to `blended heuristic` or browse-page trainee recommendations.
- [x] Step 2: keep only historically accurate wording in backlog sections that describe pre-Phase-3 state; update everything else to describe the current persisted hybrid pipeline.
- [x] Step 3: align checklist text with the current product decision that the trainee dashboard is the primary recommendation surface.
- [x] Verification: docs and UI copy should describe the recommender consistently and should not contradict the current implementation.

### 3. Phase 0: Topic and Skill Taxonomy Finalization

- [x] Goal: stabilize the tagging model so topic-level performance, module analytics, and recommendation explanations stay consistent.
- [x] Step 1: define the canonical taxonomy for course categories, skill tags, topic tags, and assessment-topic associations.
- [x] Step 2: document allowed values and ownership rules for trainers/admins who create or edit content.
- [x] Step 3: add validation to course, module, and assessment editing flows so tags come from the approved taxonomy instead of free-form drift.
- [x] Step 4: backfill or normalize existing content rows so historical courses and assessments conform to the final taxonomy.
- [x] Step 5: refresh reporting logic and recommendation explanations where they currently depend on loosely matched strings.
- [x] Verification: topic and skill analytics should no longer depend on inconsistent free-text matches.
  - Implemented through the shared taxonomy source in `src/lib/taxonomy.ts`, reusable taxonomy selectors in content authoring flows, the taxonomy guide in `TOPIC_SKILL_TAXONOMY_GUIDE.md`, canonicalized reporting and recommendation matching in `reportingService`, and the backfill plus DB constraints in `046_finalize_topic_and_skill_taxonomy.sql`.

### 4. Learner Ranking Per Course or Program

- [x] Goal: add a leaderboard or ranking feature for top learners by course or program.
- [x] Step 1: define the ranking formula, including how completion, assessment score, learning time, certificate completion, and recency contribute.
- [x] Step 2: decide scope boundaries for fairness, such as whether rankings are per course, per program, or both, and whether incomplete learners are included.
- [x] Step 3: add a reporting-service aggregate that computes ranked learner standings from enrollments, assessment summaries, module progress, and completion outcomes.
- [x] Step 4: expose the ranking in trainer and/or admin views first, then decide whether a trainee-facing leaderboard is appropriate.
- [x] Step 5: add tie-breaking and privacy rules so rankings do not leak sensitive learner data.
- [x] Verification: a trainer or admin should be able to open a course/program and see a stable ranked learner list with explained scoring factors.
  - Implemented with both `reportingService.getLearnerCourseLeaderboard(...)` and `reportingService.getLearnerProgramLeaderboard(...)`, weighted by completion (35%), assessment score (30%), tracked learning time (15%), certificate completion (10%), and recency (10%).
  - Scope decision: both course-level and true program-level rankings are live now through a first-class `programs` model linked to `courses.program_id`.
  - Fairness and privacy rules: incomplete learners remain visible for staff monitoring, dropped enrollments are excluded, ranking ties break by completion score then assessment score then recency then enrollment date, and trainer/admin views mask learner email addresses.
  - Staff-facing leaderboard surfaces were added to the trainer course manager, trainer program manager, and admin reports so ranking stays non-public until a separate trainee-facing privacy review happens.

### 5. Production Content Completeness For All Modules

- [x] Goal: close the platform-versus-content gap for the requirement that all modules be implemented in the actual system.
- [x] Step 1: produce a content-completeness audit by course showing missing modules, missing materials, missing assessments, and draft versus published states.
- [x] Step 2: define the minimum publish-ready checklist for each module: content body, media, assessment or activity, tags, and trainer ownership.
- [x] Step 3: add admin or trainer reporting that highlights incomplete production content directly from the database.
- [x] Step 4: block or warn on publishing courses that do not meet the minimum module completeness threshold.
- [x] Verification: every production course can be measured against a consistent completeness report rather than inferred from code support alone.
  - Implemented through `reportingService.getCourseContentCompletenessReports(...)`, which audits every course for trainer ownership, module count, finalized status, content body, media assets, assessment-or-activity coverage, and taxonomy tags.
  - The minimum publish-ready checklist is now explicit in the trainer publish-block dialog and admin content report: every module must be finalized, include content body, include a media asset, include an assessment with questions or a learning activity resource, and include both skill and topic tags, while the course itself must have trainer ownership.
  - Trainer course cards now show content readiness percentages and publish gaps, and publishing is blocked until the completeness threshold is satisfied.
  - Admin Reports now include a `Content` tab with exportable completeness reporting so incomplete production content is visible directly from live database records.

### 6. Assigned Trainer Indicator In The Trainee Experience

- [x] Goal: show learners who is responsible for a specific training in a consistent trainee-facing way.
- [x] Step 1: decide the canonical source of trainer display data, including whether to use `instructor`, `instructorId`, or a hydrated user profile lookup.
- [x] Step 2: add a trainer-summary view model to the course detail and trainee dashboard course cards so instructor identity is consistently available.
- [x] Step 3: surface the assigned trainer or training officer in course detail, active course cards, and any relevant enrollment views.
- [x] Step 4: provide a graceful fallback when ownership exists technically but a public trainer display name is missing.
- [x] Verification: a trainee opening a course should clearly see the assigned trainer/training officer without relying on internal ownership assumptions.
  - Implemented by treating `courses.instructor_id` as the canonical owner key, hydrating it through `public.users`, and exposing a shared `assignedTrainer` summary on every `Course` record returned by `courseService`.
  - The previous plain `instructor` string is now only a fallback display source when a linked trainer profile is missing or lacks a usable public name.
  - Trainee-facing rendering now shows the assigned trainer on course detail, dashboard recommendation cards, active course cards, and completed-course cards.
  - Fallback behavior uses a stable non-empty label (`PESO Training Team`) so ownership remains visible even when legacy profile data is incomplete.

### 7. Staff Performance Assessment Scorecard

- [x] Goal: assess staff or trainer performance using managed-course outcomes rather than only learner analytics.
- [x] Step 1: define the scorecard dimensions, such as learner completion rate, average assessment performance, learner engagement, at-risk rate, recommendation conversions, and content-quality signals.
- [x] Step 2: decide whether the scorecard is trainer-only, training-officer-only, or shared across all staff types in the PDF scope.
- [x] Step 3: build reporting-service aggregates that roll learner and course outcomes up to the responsible staff member.
- [x] Step 4: add an admin-facing staff performance dashboard or a dedicated section in the existing admin analytics dashboard.
- [x] Step 5: separate informational metrics from evaluative metrics so the scorecard is explainable and not just a raw KPI dump.
- [x] Verification: admins should be able to compare staff members by a documented scorecard backed by managed-course outcome data.
  - Implemented through `reportingService.getStaffPerformanceScorecards(...)`, which now rolls trainer-managed course outcomes up from enrollments, assessment attempts, module activity, certificates, recommendation-attributed enrollments, predictive course-risk snapshots, and the shared content-completeness audit.
  - Scope decision: the scorecard is trainer-only because the live role model is now limited to `trainee`, `trainer`, and `admin`, and trainer ownership is the only canonical staff-to-course relationship stored in `courses.instructor_id`.
  - Evaluative factors are weighted and documented as completion rate (25%), assessment quality (20%), learner engagement (15%), risk management (15%), recommendation conversion (10%), and content quality (15%), producing a composite score and performance band.
  - Informational metrics stay separate from the weighted score and now expose managed courses, active learners, total enrollments, certificates issued, average learning hours per learner, and publish-ready course counts.
  - Admin Reports now include a dedicated `Staff` tab with exportable scorecards so admins can compare trainers, inspect factor explanations, and see when a metric is informationally incomplete because source data is missing.

### 8. Assessment-Only Recommendation Mode

- [x] Goal: support a recommendation path driven only by assessment results when that is the desired use case.
- [x] Step 1: define what counts as `assessment-only` input and explicitly exclude onboarding, collaborative, and session-behavior signals for that mode.
- [x] Step 2: add a separate recommendation builder or scoring branch in the reporting service that uses only assessment-derived signals such as score bands, strongest topic, weakest topic, and failed competencies.
- [x] Step 3: decide where this mode is exposed: as a dedicated learner view, a trainer-triggered recommendation helper, or an admin advisory tool.
- [x] Step 4: persist and label these outputs distinctly so the UI can explain that the recommendation came only from assessment evidence.
- [x] Step 5: add messaging and analytics events to compare assessment-only recommendations against the main hybrid flow.
- [x] Verification: the system should be able to generate a recommendation list whose explanation references only assessment evidence.
  - Implemented through `deriveAssessmentOnlyRecommendationEvidence(...)` and `buildAssessmentOnlyCourseRecommendations(...)`, which treat only scored assessment outputs as valid evidence: score band, strongest topic, weakest topic, assessed topics, and failed competencies.
  - Exclusions are explicit in both code and UI messaging: onboarding/profile inputs, collaborative learner similarity, popularity weighting, and session-behavior signals are all excluded from this mode.
  - Exposure decision: the mode now appears as a dedicated trainee dashboard advisory section so learners can compare the main hybrid recommendations with an assessment-only recommendation path side by side.
  - Persistence and labeling use a distinct recommendation surface (`dashboard_assessment_recommendations`) and model version (`phase8-assessment-only-v1`), while cards are labeled `Assessment only` in the dashboard.
  - Analytics comparison is supported through separate refresh, impression, click, and accept events on the new surface plus a dedicated `recommendation_mode_compare_view` event when both hybrid and assessment-only modes are visible together.

## Practical Delivery Sequence For The Remaining Work

- Start with Phase 0 role normalization and taxonomy finalization, because both affect permissions, analytics interpretation, and any future leaderboard or staff-scorecard logic.
- Then implement the assigned-trainer indicator and production-content completeness reporting, because both are relatively contained and improve current trainee and admin clarity.
- After that, build leaderboard and staff scorecard analytics, because both depend on stable roles and stable taxonomy.
- Leave assessment-only recommendation mode for last, because it is additive and should be built after the main hybrid pipeline and explanatory taxonomy are stable.

## Summary Of The New Bottom-Line Status

- Fully implemented now: module time tracking, personalized recommendations, future-opportunity recommendations, and public certificate verification.
- Partially implemented: trainer indication, assessment-only recommendation logic, and the platform-side module system.
- Still missing: learner ranking or leaderboard features, plus broader predictive scoring beyond the recommendation engine itself.

# Issues:
- [ ] how about this, there's a separation between the courses of a trainer made by themselves and made by the other trainers.