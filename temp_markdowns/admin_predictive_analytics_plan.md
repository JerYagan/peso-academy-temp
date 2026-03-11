# Predictive Analytics and Hybrid Recommendation Implementation Plan

## Goal

Deliver a real phase-by-phase predictive analytics and hybrid recommendation capability for PESO Academy that supports:

1. Trainees through performance summaries and personalized course recommendations.
2. Training Officers through cohort analytics, module quality insights, and recommendation effectiveness analytics.
3. Admins through organization-wide analytics, trend monitoring, and predictive oversight.

## Current Implementation Status

The current application now has learner performance summaries, persisted recommendation outputs, recommendation event tracking, and a true hybrid recommendation pipeline.

What exists now:

- content-based scoring from learner skills, completed categories, strongest topic, weak topic signals, onboarding inputs, and recent learning activity
- collaborative filtering signals from similar-learner enrollment, completion, and progress behavior
- persisted recommendation outputs with reasons, source mix, ranking, and downstream analytics attribution
- recommendation event tracking for impression, click, accept, and conversion flows
- dashboard-first recommendation delivery for trainees, with the browse-page recommendation rail intentionally removed later by product decision

What does not exist yet:

- finalized topic and skill taxonomy governance across all authoring flows
- dedicated assessment-only recommendation mode
- leaderboard and staff-scorecard features that depend on the analytics foundation
- broader predictive model operations beyond the current persisted risk and recommendation outputs

## Schema Support Assessment

### Does the current schema support predictive analytics via a hybrid algorithm?

Yes for the current recommendation scope.

The current schema is strong enough to support:

- a persisted hybrid recommendation engine
- learner performance summaries
- training analytics based on enrollments, module completions, assessment attempts, certificates, and notifications
- recommendation event attribution and predictive score storage already used by trainer and admin analytics

The current schema still has room to mature for broader predictive analytics, but it no longer blocks the shipped hybrid recommendation pipeline.

### Existing schema strengths

The current schema already provides strong source data through:

- `users`: learner profile attributes and skills
- `courses`: category, level, duration, skills, publication state, and enrollment counts
- `modules`: content structure, learning materials, prerequisites, and status
- `enrollments`: course participation, progress, lifecycle status, completion date, and updated activity timestamp
- `module_completions`: completion state and time spent
- `assessment_attempts` and related assessment records: score history, pass/fail, attempt timing, and assessment activity
- `submissions`, `validations`, and `feedback`: additional training-quality signals
- `certificates`: completion outcomes
- `notifications`: downstream communication and engagement signals

### Remaining gaps for broader predictive maturity

The following additions would improve long-term analytics maturity beyond the already shipped hybrid recommendation pipeline:

1. taxonomy governance tables or configuration for approved course, module, and assessment tags
2. richer offline-training feature views for future predictive model experimentation
3. dedicated leaderboard or staff-scorecard aggregates for downstream reporting features
4. stronger lifecycle controls for stale recommendation and prediction refresh cadence

Conclusion:

- the current schema supports the shipped hybrid recommendation implementation
- future schema work should focus on taxonomy governance and broader predictive maturity rather than on basic recommendation persistence

## Target Hybrid Recommendation Design

The target implementation should become a true hybrid algorithm by combining three layers.

### 1. Content-Based Layer

Use learner and course attributes such as:

- learner skills from the user profile
- course skills and categories
- course level progression
- completed courses and completed categories
- strongest topic and weakest topic from learner performance summaries
- module topics or skill tags once normalized

### 2. Collaborative Layer

Use observed behavioral patterns such as:

- learners who completed the same course also enrolled in
- learners with similar score, engagement, and completion patterns
- course pairs frequently co-completed
- recommendation candidates with strong downstream conversion among similar learners

### 3. Rule and Ranking Layer

Apply business rules before final ranking:

- exclude completed courses
- deprioritize currently enrolled courses
- respect prerequisites where applicable
- boost remedial options for weak topics
- boost progression options for strong topics
- include explainable reasons in the stored output

## Phase-by-Phase Implementation Plan

## Phase 0: Baseline Audit and Data Readiness

Status:

Recommendation label audit implemented.

Objective:

Confirm the exact data already available, keep recommendation labeling historically accurate, and identify what is still missing for broader predictive maturity.

Deliverables:

1. audit recommendation labels and docs so the shipped engine is described as persisted hybrid where appropriate, with historical notes preserved only where needed
2. inventory current schema inputs already available for analytics and recommendations
3. define missing analytics and recommendation tables
4. define the canonical topic and skill taxonomy for courses, modules, and assessments

Exit criteria:

- approved data dictionary for recommendation and analytics fields
- approved schema additions for event capture and persisted outputs

## Phase 1: Instrumentation and Analytics Event Capture

Status:

Implemented.

Objective:

Add the raw event layer required for recommendation tracking and predictive modeling.

New tables recommended:

1. `analytics_events`
2. optional helper views for event normalization

Events to capture:

- `course_view`
- `course_preview_open`
- `course_enroll`
- `module_open`
- `module_complete`
- `material_open`
- `material_download`
- `video_progress`
- `assessment_start`
- `assessment_submit`
- `assessment_complete`
- `recommendation_impression`
- `recommendation_click`
- `recommendation_accept`
- `notification_click`

Application work:

1. add event writes at major learner interaction points
2. standardize course, module, user, and recommendation identifiers in events
3. add source metadata such as dashboard, browse page, preview, or notification-driven action

Implementation notes:

- Implemented migration `036_add_phase1_analytics_schema.sql` to add analytics events, learner recommendations, tagging columns, rollup tables, derived analytics tables, event RPCs, and recommendation attribution on enrollments.
- Added `src/services/analyticsService.ts` to sync learner recommendations, log recommendation impressions and clicks, and trigger rollup refreshes.
- Wired learner event tracking into the persisted dashboard recommendation surface, enrollments, module completions, and assessment submissions. Historical browse-surface instrumentation existed before the browse recommendation rail was removed.

Exit criteria:

- recommendation delivery and learner activity are traceable in raw events
- the active learner-facing dashboard recommendation surface reads persisted recommendation rows instead of relying only on inline recommendation objects

## Phase 2: Feature Rollups and Derived Analytics Tables

Objective:

Transform raw events and transactional learning data into features usable by dashboards and models.

New tables recommended:

1. `analytics_user_daily`
2. `analytics_course_daily`
3. `analytics_module_daily`
4. `analytics_recommendation_daily`
5. `analytics_admin_daily`

Derived metrics:

- learner recency, activity streaks, and inactivity days
- progress velocity and completion ratios
- average assessment score and pass rate
- time spent by learner, course, and module
- course completion trends and certificate issuance trends
- recommendation impressions, clicks, accepts, enrollments, and completions

Exit criteria:

- dashboards can read aggregated analytics without scanning raw events directly
- feature tables exist for collaborative scoring and prediction

## Phase 3: Real Hybrid Recommendation Engine

Status:

Implemented.

Objective:

Replace the earlier heuristic-only scorer with a true hybrid recommendation engine.

New tables recommended:

1. `learner_skill_profile`
2. `learner_recommendations`

Implementation steps:

1. keep the current content-based signals as the content layer baseline
2. add collaborative signals from co-enrollment, co-completion, and similar-learner behavior
3. combine both layers into a blended ranking score
4. store recommendation reasons, source mix, generated timestamp, and model version
5. refresh recommendations on a schedule and after major learner milestones

Minimum stored output fields:

- `user_id`
- `course_id`
- `rank`
- `score`
- `reason_primary`
- `reason_secondary`
- `source_mix`
- `generated_at`
- `model_version`

Exit criteria:

- the recommendation engine is accurately described as hybrid
- recommendations are persisted and explainable

## Phase 4: Trainee Experience Delivery

Status:

Implemented with dashboard-first delivery.

Objective:

Deliver the trainee-facing analytics and hybrid recommendation experiences required by the PDF.

UI outputs:

1. dashboard learning performance summary
2. dashboard personalized recommendation rail
4. profile learning statistics including:
   - average assessment score
   - total learning time
   - completed modules

Rules for trainee delivery:

- show recommendation reasons from persisted recommendation output
- refresh recommendations after assessment completion, module completion, or meaningful profile updates

Implementation notes:

- Trainee dashboard now includes explicit overall learning progress indicators for course completion rate, module progress, assessment pass rate, and recent activity.
- Learner profile now surfaces average assessment score, total learning time, completed modules, strongest topic, and needs-improvement topic inside the training snapshot.
- The persisted hybrid recommendation engine now uses those learner analytics signals to better distinguish between progression-friendly and foundational next-course suggestions.

Exit criteria:

- trainee surfaces consume persisted hybrid recommendations, not only inline heuristic scoring

## Phase 5: Training Officer Analytics and Recommendation Effectiveness

Objective:

Provide trainers with cohort analytics, module quality insights, and recommendation effectiveness reporting.

New tables recommended:

1. `module_quality_signals`
2. `recommendation_performance_snapshots`

Trainer outputs:

1. average assessment score
2. average completion rate
3. average learning time per course
4. module health diagnostics:
   - low score modules
   - high failure modules
   - high time-spent modules
   - highest drop-off modules
5. recommendation effectiveness metrics:
   - impressions
   - accepts
   - enrollment conversion
   - completion conversion
   - top-performing recommended courses

Exit criteria:

- trainer dashboards can explain both learner performance and recommendation effectiveness

## Phase 6: Admin-Wide Analytics and Predictive Scoring

Objective:

Extend the analytics layer into organization-wide oversight and predictive scoring.

New tables recommended:

1. `course_risk_scores`

Admin outputs:

1. organization-wide KPI cards
2. enrollment, completion, certificate, performance, and engagement trends
3. course risk leaderboard
4. declining-course and improving-course monitoring

Predictive targets:

1. learner disengagement probability in the next 7 days
2. course completion probability
3. module difficulty or abandonment risk
4. recommendation acceptance probability

Recommended model path:

1. build SQL feature views from rollup tables
2. export snapshots for offline training
3. train baseline logistic regression or gradient boosting models
4. store scores back into prediction tables
5. refresh predictions daily or on a scheduled batch cadence

Exit criteria:

- admin dashboards show stored predictive scores and trends
- predictive outputs are versioned and explainable

## Governance and Validation

1. keep all recommendation and predictive outputs explainable
2. store model version, generated timestamp, and source mix
3. avoid using sensitive fields unless there is a clear product need and policy approval
4. validate recommendation quality and predictive accuracy on a recurring schedule
5. track stale recommendations and stale predictions so old outputs are not served to users

## Success Metrics

1. higher enrollment conversion from recommended courses
2. higher completion rate for recommended courses
3. lower learner inactivity after targeted interventions
4. faster trainer response to low-performing modules
5. better admin visibility into organization-wide training performance

## Recommended Order of Delivery

1. Phase 0 and Phase 1 first so tracking becomes reliable
2. Phase 2 next so dashboards and models share the same rollup layer
3. Phase 3 before claiming hybrid recommendation support in product copy
4. Phase 4 after persisted hybrid outputs exist
5. Phase 5 and Phase 6 after recommendation tracking data is mature enough to support effectiveness and prediction