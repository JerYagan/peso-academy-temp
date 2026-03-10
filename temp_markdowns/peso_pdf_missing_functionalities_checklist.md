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

- [ ] Upgrade recommendation engine from heuristic blended scoring to a true hybrid algorithm
  - PDF explicitly defines a hybrid approach using content-based filtering and collaborative filtering.
  - Current implementation uses learner profile, performance, and popularity signals, but it does not yet persist recommendations, track recommendation outcomes, or compute collaborative signals such as co-enrollment and similar-learner patterns.

- [x] Implement personalized course recommendations on the trainee dashboard
  - PDF requires recommended courses to appear in `My Dashboard` after module or assessment completion.
  - Trainee dashboard now surfaces personalized recommendation cards that reuse the shared course-ranking logic and adapt recommendation messaging to recent module and assessment activity.

- [x] Add recommendation cards tied to learner activity and assessment outcomes

- [x] Implement `Recommended for You` section on Browse Courses for trainee
  - PDF requires a recommendation section powered by a hybrid recommendation algorithm.
  - The browse page now shows recommendation UI, but the underlying algorithm is still an early blended heuristic and not yet a full hybrid engine.

- [ ] Add recommendation ranking output on top of standard browse results

- [ ] Add recommendation reasons such as matching strengths, skill gaps, or similar learner behavior

- [ ] Add recommendation refresh logic after completions and assessments

## Phase 4: Trainee Experience Completion

- [x] Connect persisted recommendation outputs to dashboard and browse page rendering
  - Dashboard and browse recommendation cards now sync ranked recommendation rows into storage, hydrate UI cards from persisted records, and log impression and click events per surface.

- [ ] Refresh trainee recommendations after assessment completion, module completion, and profile changes

- [ ] Complete learner profile analytics so profile data can feed both recommendations and predictive features

## Phase 5: Training Officer Analytics

- [ ] Implement training performance analytics for Training Officers
  - PDF requires average assessment scores, average completion rate, average learning time per course, and module-level performance trends.
  - Current Training Officer experience only exposes base KPIs and a simple monthly report.

- [ ] Replace the `/trainer/dashboard` placeholder with the actual dashboard experience

- [ ] Add cohort-level analytics cards and visual summaries

- [ ] Add module trend analysis across created courses

- [ ] Implement content improvement insights for modules
  - PDF requires surfacing modules with low scores, high failure rates, and excessive learning time.
  - Current trainer course and learner tools do not provide module quality diagnostics.

- [ ] Add module problem detection for low score, high failure, and long completion time patterns

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

- [ ] Add predictive score storage and consumption for course risk, disengagement, and recommendation acceptance probability

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
- [ ] Complete Phase 3 before describing the recommender as truly hybrid in UI and docs
- [ ] Complete Phase 5 after recommendation tracking data is mature enough to support trainer reporting
- [ ] Complete Phase 6 after predictive outputs can be persisted and refreshed consistently