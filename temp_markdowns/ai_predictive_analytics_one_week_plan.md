# AI Predictive Analytics: One-Week Feasible Plan for PESO Academy

## Purpose

This document explains how PESO Academy can realistically leverage AI for predictive analytics, identifies the most feasible AI use case for the current system, and proposes a one-week implementation plan for a single developer.

The recommendation here is intentionally pragmatic. The system already has analytics events, learner rollups, enrollments, module completions, and assessment records. That means the fastest path is not a large ML platform or an LLM-heavy feature. The fastest path is a lightweight predictive model that uses the data the system already collects.

## What AI Can Realistically Do in This System

AI for predictive analytics in PESO Academy should focus on prediction and prioritization, not content generation.

Practical AI applications for the current system:

1. Predict which learners are at risk of disengaging soon.
2. Predict which enrolled learners are unlikely to complete a course.
3. Predict which courses are likely to underperform or have rising dropout risk.
4. Improve recommendations by ranking courses based on likely acceptance or completion.

All four are valid long-term directions, but they do not have the same implementation cost.

## Most Feasible AI Use Case

## Recommended Use Case: Learner Disengagement Risk Prediction

The easiest and most feasible AI use case to implement in one week is:

**Predict which learners are likely to become inactive or disengaged in the next 7 days.**

This is the best first AI feature because it matches the current schema and product state.

Why this is the strongest choice:

1. The required signals already exist or are close to existing.
   - `analytics_events`
   - `analytics_user_daily`
   - `enrollments`
   - `module_completions`
   - `assessment_attempts`
   - `notifications`

2. It is easier than a true hybrid recommendation engine.
   - Hybrid recommendations need collaborative filtering, candidate generation, ranking, attribution, and persistence tuning.
   - Disengagement risk can start with a simple supervised model or scoring formula.

3. The output is easy to operationalize.
   - Show a risk badge in admin or trainer dashboards.
   - Trigger notifications or follow-up nudges.
   - Prioritize learners who need intervention.

4. It is explainable.
   - The system can display reasons such as low recent activity, incomplete modules, falling assessment score, or long inactivity streak.

5. It can be built incrementally.
   - Version 1 can use a lightweight model such as logistic regression.
   - Later versions can add better features, retraining, and threshold tuning.

## Why This Is Better Than Other AI Options for Week 1

### 1. Versus Hybrid Course Recommendation

Recommendation is valuable, but it is heavier.

It requires:

- collaborative signals
- persisted ranking outputs
- explanation logic
- conversion tracking maturity
- evaluation of recommendation quality

The system is already partway there, but making it truly hybrid is still more work than a one-week single-developer predictive feature.

### 2. Versus Course Completion Probability

This is also feasible, but learner disengagement is simpler to define and react to.

- Completion probability depends on course length, pacing, and timeline normalization.
- Disengagement can be detected from recent inactivity and behavior changes much faster.

### 3. Versus LLM-Based Insights

LLMs can summarize analytics, but they are not the best first predictive feature.

- they add cost and integration complexity
- they do not replace a proper risk score
- they are less reliable for repeatable prediction unless backed by structured models

For this system, structured prediction is the better first AI step.

## Recommended AI Approach

Use a **lightweight, structured ML approach** instead of a generative AI approach.

Recommended model for week 1:

- logistic regression or a simple tree-based model trained on exported analytics snapshots

Recommended target definition:

- label a learner as `at_risk = true` if they show no meaningful learning activity for the next 7 days after a scoring date

Meaningful activity can include:

- course view
- module open
- module completion
- assessment start or submit
- course progress update

This keeps the prediction target clear and measurable.

## How It Fits the Current System

The current system already has most of the required ingredients.

### Existing strengths

The system already stores or derives:

- learner activity events
- enrollments and progress state
- assessment attempts and scores
- module completion data
- learning time indicators
- recommendation and analytics rollup support

### Minimal additions needed

To support the first AI predictive feature, add only a few focused pieces:

1. A new table for learner risk scores, for example `learner_risk_scores`
2. A feature-building query or script that extracts training and scoring features from the existing schema
3. A small training script or offline notebook/script to fit the model
4. A scoring job that writes the latest risk scores back into Supabase
5. A simple admin or trainer UI surface to display high-risk learners and reasons

## Proposed Data Inputs

The first version should avoid complex feature engineering. Use simple, high-signal features that already exist.

Recommended features:

1. `days_since_last_activity`
2. `events_last_7_days`
3. `modules_completed_last_7_days`
4. `assessments_taken_last_14_days`
5. `average_assessment_score`
6. `course_completion_rate`
7. `module_completion_rate`
8. `active_enrollments_count`
9. `learning_time_last_7_days`
10. `notification_clicks_last_14_days`

Optional but still feasible:

1. recent score trend
2. recent progress velocity trend
3. enrolled course difficulty mix

## Predicted Output

The first version does not need a complicated output structure.

Recommended output fields:

- `user_id`
- `score_date`
- `risk_score` from 0 to 1
- `risk_level` such as low, medium, high
- `top_reason_1`
- `top_reason_2`
- `model_version`
- `generated_at`

Example explanations:

- No activity in the last 6 days
- Module completion rate dropped this week
- Assessment activity is lower than similar recent learners

## Suggested Schema Addition

Example table to add:

```sql
create table if not exists learner_risk_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  score_date date not null,
  risk_score numeric(5,4) not null,
  risk_level text not null,
  top_reason_1 text,
  top_reason_2 text,
  model_version text not null,
  generated_at timestamptz not null default now(),
  unique (user_id, score_date, model_version)
);
```

This is enough for version 1.

## Implementation in the Current System

## Architecture

Keep the architecture simple:

1. Extract features from Supabase using SQL.
2. Train a small model locally or in a script.
3. Generate daily scores.
4. Write scores back to Supabase.
5. Read scores in admin and trainer dashboards.

### Suggested implementation shape

- SQL view or query for features
- one script under `scripts/` for model training and scoring
- one service under `src/services/` for reading scores in the app
- one dashboard widget under admin and possibly trainer pages

### Best week-1 execution model

Do not build automated online training yet.

Instead:

1. train once on historical data snapshots
2. save model coefficients or prediction logic in a script
3. run daily scoring manually or through a lightweight scheduled job

That is enough to prove value without overbuilding infrastructure.

## One-Week Plan for a Single Developer

## Day 1: Define Target and Data Contract

Deliverables:

1. Define `disengaged in next 7 days`
2. Finalize the initial feature list
3. Add the `learner_risk_scores` table migration
4. Write the SQL query or view for extracting features

Success by end of day:

- the label is clearly defined
- the score output schema exists
- the feature extraction query runs reliably

## Day 2: Build Dataset and Baseline Model

Deliverables:

1. Export historical learner feature rows
2. Create labels from subsequent 7-day inactivity windows
3. Train a baseline logistic regression model
4. Evaluate simple metrics such as precision, recall, and ROC AUC

Success by end of day:

- a working baseline model exists
- the model performs better than a naive rule such as inactivity-only thresholding

## Day 3: Add Scoring Pipeline

Deliverables:

1. Create a scoring script that computes risk for current learners
2. Write predictions into `learner_risk_scores`
3. Generate explanation reasons from top feature contributions or rule overlays

Success by end of day:

- the database contains current learner risk scores
- scores are readable by the application

## Day 4: Add Dashboard UI

Deliverables:

1. Add an admin dashboard widget for high-risk learners
2. Add filters for low, medium, and high risk
3. Show explanation reasons and last activity date
4. Optionally add trainer-scoped learner risk view for their own learners

Success by end of day:

- admins can see who is likely to disengage
- the UI explains why each learner is flagged

## Day 5: Add Intervention Flow

Deliverables:

1. Add notification or reminder trigger suggestions for high-risk learners
2. Log intervention events
3. Add a simple outcome check such as whether the learner returned within 7 days

Success by end of day:

- the system can do something useful with the predictions
- intervention outcomes can start being measured

## Day 6: Validate and Tune

Deliverables:

1. Review false positives and false negatives
2. Tune threshold levels for low, medium, and high risk
3. Refine explanation rules so the output stays understandable

Success by end of day:

- the score thresholds are reasonable
- the dashboard is actionable rather than noisy

## Day 7: Document and Prepare for Handoff

Deliverables:

1. Write implementation notes
2. Document feature definitions and risk thresholds
3. Add a roadmap for phase 2 improvements

Success by end of day:

- the feature is usable
- future enhancement work is clear

## What to Build in Code

Minimal code changes for version 1:

1. Add one Supabase migration for `learner_risk_scores`
2. Add one feature extraction SQL view or query
3. Add one script such as `scripts/train-disengagement-model.ts` or a Python equivalent
4. Add one script such as `scripts/score-learners.ts`
5. Add one application service such as `src/services/riskScoringService.ts`
6. Add one dashboard component for high-risk learner monitoring

This is realistic for one developer if the implementation stays narrow.

## Potential Impact on the System

### System impact

Positive impact:

1. Adds a real predictive analytics capability instead of only descriptive analytics.
2. Makes existing analytics tables more useful by turning signals into decisions.
3. Creates a reusable pattern for later predictive features such as completion risk or recommendation acceptance probability.
4. Strengthens the admin and trainer dashboards with prioritized actions instead of passive reporting.

Operational impact:

1. Requires one new scoring table and a small scoring job.
2. Adds some ongoing model review work, but the version-1 maintenance cost is low.
3. Does not require major frontend architecture changes.

## Potential Impact on Users

### For learners

1. They can receive timely reminders before fully dropping off.
2. They are more likely to get support when their progress slows down.
3. They benefit from a system that reacts to behavior early rather than after failure.

### For trainers

1. They can prioritize outreach to learners who need help most.
2. They can spot disengagement patterns earlier.
3. They can use reasons behind the score to decide whether to send reminders, suggest easier modules, or review course difficulty.

### For admins

1. They gain an early-warning view of learner retention risk.
2. They can measure whether interventions reduce drop-off.
3. They get a concrete AI feature that is explainable and operationally useful.

## Risks and Guardrails

The first version should stay conservative.

Guardrails:

1. Keep the model explainable.
2. Show reasons beside the score.
3. Do not automate punitive actions based only on the model.
4. Use the score to prioritize support, not to block learners.
5. Track intervention outcomes so the model can be improved with real evidence.

Main risk:

- If the historical activity data is sparse or inconsistent, model quality may be limited.

Mitigation:

- start with simple features
- use threshold tuning
- keep the score advisory, not authoritative

## Phase 2 After the First Week

Once the first version is live, the next logical upgrades are:

1. retrain on a larger historical window
2. add trainer-level intervention workflows
3. predict course completion probability
4. predict recommendation acceptance probability
5. combine disengagement risk with personalized recommendations

## Final Recommendation

If the goal is to deliver one AI-powered predictive analytics feature within one week, the best choice is:

**Learner disengagement risk prediction with a lightweight, explainable model and dashboard visibility for admins and trainers.**

It is the fastest path to a real AI feature because:

1. the required data mostly already exists
2. the model can be simple
3. the output is actionable immediately
4. the system impact is low
5. the user impact is high

This should be treated as the foundation feature for broader AI analytics in PESO Academy.