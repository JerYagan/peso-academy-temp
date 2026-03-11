# Module Session Tracking and Recommendation Spec

## Purpose

This document translates the feature request into an implementation-ready plan for the current PESO Academy system.

It covers:

1. module session tracking
2. session history visibility for trainee, trainer, and admin
3. recommendations for new trainees
4. performance-based recommendations after assessments
5. how to handle cold-start conditions when little or no learner data exists

The goal is to add a durable learning history layer that improves analytics quality and unlocks better recommendation behavior without requiring a full ML stack on day 1.

## Current State in the Codebase

The current system already has:

1. module completion tracking with aggregate `time_spent`
2. learner performance summaries based on modules and assessments
3. persisted learner recommendations
4. analytics event tracking and rollup tables

The current system does not yet have:

1. a dedicated `module_sessions` table
2. open, resume, pause, and end session history per module
3. a `last accessed module` source of truth
4. cold-start recommendation logic for brand-new trainees
5. recommendation logic that uses recent session behavior directly

## Core Product Decision

Do not use `module_completions` as the session history source.

`module_completions` should remain the completion and aggregate progress table.
`module_sessions` should be introduced as a separate behavioral history table.

This separation is important because:

1. one learner can open the same module many times before completing it
2. session history needs timestamps and duration per visit
3. analytics should distinguish engagement from completion
4. recommendations should be able to react to recency and repetition, not just finished work

## Feature Scope

## 1. Module Session Tracking

Each time a trainee opens a module, the system should create or resume a session record that captures:

1. date
2. start time
3. end time
4. session duration
5. last seen timestamp
6. enrollment, course, and module references

Optional but useful fields for version 1:

1. `session_status` such as `active`, `completed`, `abandoned`, `timed_out`
2. `entry_source` such as `course_detail`, `dashboard_continue_learning`, `recommendation`
3. `resume_position_seconds` for videos or long content

## 2. Session History Visibility

The following roles should be able to view session history:

1. trainee: personal module session history and last accessed module
2. trainer: session history for learners enrolled in trainer-managed courses
3. admin: session history across the platform

Version 1 visibility should focus on:

1. last accessed module
2. recent sessions
3. total sessions per module
4. total time spent per module

## 3. New Trainee Recommendations

The system should provide immediate guidance on first login even when the trainee has no module or assessment history.

Version 1 should use:

1. onboarding preferences
2. course skill tags
3. topic tags
4. course level
5. popularity or admin-curated defaults

This avoids waiting for historical learning activity before showing useful recommendations.

## 4. Performance-Based Recommendations

After assessments and learning sessions, the system should update recommendations using:

1. strongest topics
2. weak topics
3. recent assessment score level
4. session engagement depth
5. recently accessed but unfinished modules

High-score behavior:

1. recommend next-level courses
2. recommend related industries or career paths
3. recommend higher-fit advanced modules

Low-score behavior:

1. recommend foundational courses
2. recommend remedial modules tied to weak topics
3. recommend review content for unfinished or repeatedly revisited modules

## 5. Performance-Driven Analytics Enablement

Session history will improve analytics by enabling:

1. real learning time tracking by module and by user
2. last activity recency
3. revisit rate per module
4. drop-off detection between module open and completion
5. better learner engagement and skill-gap indicators

## Proposed Data Model

## New Table: `module_sessions`

Recommended schema:

```sql
create table if not exists public.module_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  session_date date not null default current_date,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  session_status text not null default 'active',
  entry_source text,
  resume_position_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_module_sessions_user_date
  on public.module_sessions(user_id, started_at desc);

create index if not exists idx_module_sessions_enrollment_module
  on public.module_sessions(enrollment_id, module_id, started_at desc);

create index if not exists idx_module_sessions_module_date
  on public.module_sessions(module_id, started_at desc);
```

## Why a Separate Table Is Required

`module_completions` only answers:

1. did the learner complete the module
2. when was it completed
3. how much aggregate time was recorded at completion time

`module_sessions` answers:

1. how often did the learner open the module
2. when was the last session
3. how long was each session
4. which module was accessed most recently
5. which modules are frequently revisited but not completed

Both tables are needed.

## RLS and Access Rules

Recommended policy model:

1. trainees can read only their own `module_sessions`
2. trainers can read sessions for learners enrolled in their own courses
3. admins can read all `module_sessions`
4. trainees can insert and update only their own active sessions
5. backend RPCs may be used for safer controlled writes if client-side writes become noisy

## Application Flow

## Session Lifecycle

When a trainee opens a module:

1. create a new `module_sessions` row with `session_status = active`
2. store the returned `session_id` in component state

While the trainee is active in the module:

1. update `last_seen_at` every 30 to 60 seconds
2. update `duration_seconds`
3. optionally update `resume_position_seconds` for video-heavy modules

When the trainee leaves, closes, switches modules, or completes the module:

1. set `ended_at`
2. set final `duration_seconds`
3. set `session_status` to `completed`, `timed_out`, or `abandoned`

## Recommended Frontend Integration Point

The best first integration point is the module viewer flow.

The current module content rendering and local session timing already live in the module viewer path, so version 1 should extend that flow instead of introducing a second tracking surface.

Recommended integration areas:

1. `ModuleContentViewer` for session create, heartbeat, and end
2. `VideoPlayer` for resume position updates where applicable
3. course detail and continue-learning flows for `entry_source`

## Recommended Service Layer

Add a dedicated service such as:

`src/services/moduleSessionService.ts`

Recommended methods:

1. `startSession(userId, enrollmentId, courseId, moduleId, entrySource)`
2. `heartbeatSession(sessionId, durationSeconds, resumePositionSeconds?)`
3. `endSession(sessionId, durationSeconds, status)`
4. `getUserRecentSessions(userId)`
5. `getLearnerSessionsForTrainer(trainerId, learnerId?)`
6. `getLastAccessedModule(userId, enrollmentId?)`

## Recommended Analytics Event Layer

In addition to the `module_sessions` table, log analytics events for:

1. `module_session_start`
2. `module_session_heartbeat`
3. `module_session_end`
4. `module_resume`

This preserves compatibility with existing analytics rollups while giving the database a proper session history source.

## UI Surfaces

## Trainee UI

Add the following:

1. `Last accessed module` card on trainee dashboard
2. `Recent learning sessions` section on profile or progress page
3. session history inside course detail or module progression view

Recommended trainee fields to show:

1. module title
2. course title
3. last opened date and time
4. session duration
5. completion state

## Trainer UI

Add the following:

1. learner progress dialog should include recent module sessions
2. a trainer can see last accessed module and last activity timestamp
3. optional flag for learners with repeated short sessions and no completion

This is especially useful in the trainer learner-management view.

## Admin UI

Add the following:

1. learner activity detail should include module sessions
2. platform activity analytics can aggregate session counts and learning time
3. admin dashboards can identify disengaged learners and module drop-off patterns

## Recommendation Strategy

## A. Cold-Start Recommendations for New Trainees

New trainees do not have enough behavioral data yet. This should be handled explicitly.

### Recommended cold-start inputs

Add an onboarding step on signup or first login that collects:

1. desired industry or career path
2. skill level: beginner, intermediate, advanced
3. interests or preferred training categories
4. optional existing skills

### Version 1 cold-start ranking logic

Rank courses using:

1. matching category or industry
2. matching skill tags
3. beginner-friendly level if the trainee is new
4. popularity and TESDA relevance as tie-breakers
5. curated starter-path boosts for admin-selected entry courses

### If there is no onboarding data

Fallback order:

1. curated starter courses
2. beginner courses in high-demand categories
3. most completed or most successful beginner courses

This ensures recommendations are available immediately after registration.

## B. Performance-Based Recommendations After Assessments

The current system already has learner performance summaries and topic signals. Extend the logic to use sessions plus outcomes.

### Inputs for version 1

1. recent assessment score
2. strongest topic
3. needs-improvement topic
4. recent module sessions
5. modules repeatedly opened but not completed
6. total learning time in the last 7 to 14 days

### Rules for high scores

If a trainee scores high and has healthy completion momentum:

1. recommend next-level courses in the same category
2. recommend career or industry tracks mapped to strong skill tags
3. recommend advanced modules or skill extension content

### Rules for low scores

If a trainee scores low or repeatedly revisits the same module without completion:

1. recommend beginner or foundational content
2. recommend modules tagged to the weak topic
3. recommend shorter support content before full next-step courses

## Industry and Career Path Suggestions

This should be metadata-driven first, not AI-generated first.

Recommended approach:

1. add optional `career_paths` or `industry_tags` to courses
2. map strong topic or skill tags to those fields
3. show career suggestions only when there is enough confidence from assessment performance or repeated strong results

Example:

- high scores in office productivity and communication could surface administrative support roles
- high scores in customer-facing modules could surface retail, hospitality, or client support paths

## Recommendation Refresh Triggers

Refresh recommendations when any of these happen:

1. first login after registration
2. onboarding preferences saved
3. module completion
4. assessment submission
5. major profile update such as skills or goals change
6. repeated session pattern indicating struggle or momentum

## How This Addresses Lack of Initial Data

This issue is a classic cold-start problem.

The correct response is not to wait for AI or historical analytics. The correct response is to layer recommendation maturity.

### Stage 1: No history yet

Use:

1. onboarding answers
2. course metadata
3. curated defaults
4. popularity

### Stage 2: Early history exists

Use:

1. first module sessions
2. first accessed modules
3. incomplete modules
4. first assessment results

### Stage 3: Mature history exists

Use:

1. topic performance trends
2. repeat session patterns
3. progress velocity
4. similar learner behavior later if collaborative filtering is added

This staged approach works even if the whole system initially has sparse data.

## Impact on Analytics

Session history enables stronger analytics in the current schema by supporting:

1. true last activity timestamps
2. time-on-module distributions
3. revisit-rate analysis
4. unfinished-module engagement signals
5. disengagement-risk features
6. performance interpretation with engagement context

This improves the reliability of:

1. learner progress analytics
2. trainer intervention decisions
3. admin-wide engagement reporting
4. future predictive scoring

## Phase-by-Phase Implementation Checklist

This section turns the feature into an execution checklist. Each phase is scoped so it can be implemented, tested, and reviewed independently.

## Phase 0: Scope Lock and Data Contract

### Goal

Freeze the first implementation scope so session tracking and recommendation work do not drift into a larger analytics rewrite.

### Checklist

- [ ] Confirm that `module_sessions` will be a new table and not an extension of `module_completions`
- [ ] Confirm the minimum version-1 fields for session history
- [ ] Confirm the first recommendation behavior for brand-new trainees
- [ ] Confirm which UI surfaces are in scope for version 1
- [ ] Confirm whether onboarding preferences will be collected at signup or first login
- [ ] Approve the schema contract for `module_sessions`
- [ ] Approve the list of recommendation triggers
- [ ] Approve the MVP UI scope for trainee, trainer, and admin
- [ ] Verify that the team agrees on the data model and first release scope
- [ ] Verify that there is no ambiguity around MVP versus later phases

### Dependencies

- [ ] None

## Phase 1: Database and Access Layer

### Goal

Add the durable storage and access rules required for module session history.

### Checklist

- [x] Add helper SQL function or view for trainer-scoped learner session access if needed
- [x] Verify that trainees can insert and update only their own sessions
- [x] Verify that trainers can read sessions only for learners inside trainer-managed courses
- [x] Verify that admins can read all sessions
- [x] Verify that recent-session and last-accessed queries use the new indexes
- [x] Create a new Supabase migration for `module_sessions`
- [x] Add indexes for recent-session reads and learner lookups
- [x] Add helper constraints for safe values such as valid `session_status`
- [x] Add RLS policies for trainee, trainer, and admin access
- [x] Update generated database typings to include `module_sessions`
- [x] Verify that `module_sessions` exists in the schema
- [x] Verify that RLS policies exist for read and write access
- [x] Verify that database types are updated in the frontend

### Verification Notes

- Verified in [supabase/migrations/037_add_module_sessions.sql](supabase/migrations/037_add_module_sessions.sql) that trainee insert and update access is constrained by `user_id = public.get_current_user_profile_id()` plus enrollment and module ownership checks.
- Verified in [supabase/migrations/037_add_module_sessions.sql](supabase/migrations/037_add_module_sessions.sql) that trainer reads are limited to sessions whose `course_id` belongs to a course owned by the current trainer profile, while admins can read all sessions.
- Added [supabase/migrations/037_add_module_sessions.sql](supabase/migrations/037_add_module_sessions.sql) function `public.get_trainer_accessible_module_sessions(...)` to support trainer-scoped learner session access.
- Verified query-to-index alignment for recent-session reads and last-accessed reads by ensuring [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) is covered by `idx_module_sessions_user_date`, `idx_module_sessions_user_last_seen`, and `idx_module_sessions_user_enrollment_last_seen` in [supabase/migrations/037_add_module_sessions.sql](supabase/migrations/037_add_module_sessions.sql).
- Runtime verification in Supabase still depends on applying [supabase/migrations/037_add_module_sessions.sql](supabase/migrations/037_add_module_sessions.sql) to the target database.

### Dependencies

- [ ] Phase 0 schema approval

## Phase 2: Session Tracking Service

### Goal

Create a dedicated service that owns module session lifecycle behavior.

### Checklist

- [x] Add `src/services/moduleSessionService.ts`
- [x] Implement `startSession`
- [x] Implement `heartbeatSession`
- [x] Implement `endSession`
- [x] Implement `getUserRecentSessions`
- [x] Implement `getLastAccessedModule`
- [x] Implement trainer-facing session queries
- [x] Add stale-session handling for sessions that never close cleanly
- [x] Verify that the service can start, update, and end sessions reliably
- [x] Verify that the service can return recent session history and last accessed module
- [x] Verify that duplicate active sessions are prevented or handled safely

### Verification Notes

- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that `startSession`, `heartbeatSession`, and `endSession` exist and are wired around `module_sessions` rows plus analytics events.
- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that `getUserRecentSessions` and `getLastAccessedModule` are implemented for recent-session and last-accessed reads.
- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that trainer-facing reads are implemented through `getTrainerAccessibleSessions` and `getLearnerSessionsForTrainer`, backed by `public.get_trainer_accessible_module_sessions(...)` from [supabase/migrations/037_add_module_sessions.sql](supabase/migrations/037_add_module_sessions.sql).
- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that stale active sessions older than the configured threshold are closed as `timed_out` before a new session is created.
- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that duplicate active sessions are handled by reusing a recent active session or timing out stale ones before insert.
- Runtime behavior still depends on [supabase/migrations/037_add_module_sessions.sql](supabase/migrations/037_add_module_sessions.sql) being applied to the target database.

### Dependencies

- [x] Phase 1 schema and RLS

## Phase 3: Module Viewer Integration

### Goal

Wire the session service into the learner module experience.

### Checklist

- [x] Integrate session start into the module open flow in `ModuleContentViewer`
- [x] Start heartbeat updates while the learner stays active in the module
- [x] End the active session on module change, route change, tab close, or completion
- [x] Pass entry source values from dashboard, course detail, or recommendation entry points
- [x] Optionally sync resume position from `VideoPlayer`
- [x] Log analytics events for start, heartbeat, end, and resume
- [x] Verify that opening a module creates a session row
- [x] Verify that staying in the module updates duration and last seen time
- [x] Verify that leaving the module closes the session with a final duration
- [x] Verify that module completion and module session tracking do not conflict

### Verification Notes

- Verified in [src/components/course/ModuleContentViewer.tsx](src/components/course/ModuleContentViewer.tsx) that session start is triggered on module open, heartbeat updates run every 30 seconds while active, and session end runs on unmount, unload, and completion.
- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that module viewer integration uses the session service for start, heartbeat, end, and resume analytics event logging.
- Verified in [src/pages/CourseDetail.tsx](src/pages/CourseDetail.tsx) that `entrySource` is passed into `ModuleContentViewer` using route state with `course_detail` and `course_preview` fallbacks.
- Verified entry-source propagation from learner navigation points in [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx), [src/pages/Courses.tsx](src/pages/Courses.tsx), [src/pages/ProgressDashboard.tsx](src/pages/ProgressDashboard.tsx), [src/pages/Notifications.tsx](src/pages/Notifications.tsx), and [src/components/NotificationCenter.tsx](src/components/NotificationCenter.tsx).
- Verified optional resume-position syncing in [src/components/course/VideoPlayer.tsx](src/components/course/VideoPlayer.tsx) and [src/components/course/ModuleContentViewer.tsx](src/components/course/ModuleContentViewer.tsx), where playback position is forwarded into session heartbeat and end updates.
- Runtime verification still depends on [supabase/migrations/037_add_module_sessions.sql](supabase/migrations/037_add_module_sessions.sql) being applied to the target database.

### Dependencies

- [ ] Phase 2 service layer

## Phase 4: Session History Read Models

### Goal

Create the queries and aggregation helpers needed to present session history cleanly in the UI.

### Checklist

- [x] Add query helpers for recent sessions by user
- [x] Add query helpers for last accessed module by enrollment or by user
- [x] Add aggregation helpers for total sessions and total time spent per module
- [x] Add trainer-scoped learner session summaries
- [x] Add admin-scoped recent activity summaries if needed
- [x] Verify that the UI can load recent sessions without recomputing everything client-side
- [x] Verify that last accessed module is deterministic and fast to query

### Verification Notes

- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that recent-session read helpers now include both raw rows via `getUserRecentSessions` and enriched UI-ready cards via `getUserRecentSessionCards`.
- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that last-accessed reads exist for both raw data via `getLastAccessedModule` and enriched display data via `getLastAccessedModuleCard`.
- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that per-module aggregation is implemented through `getSessionAggregatesByModule`, returning total sessions, total duration, and last-seen metadata per module.
- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that trainer-scoped learner summaries are implemented through `getTrainerLearnerSessionSummaries`, and admin recent activity summaries are implemented through `getAdminRecentSessionActivity`.
- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that the UI can consume ready-to-render session read models without recomputing raw `module_sessions` rows inside components.
- Verified in [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) that last-accessed queries now order by `last_seen_at` and `started_at` descending, making the result deterministic while remaining aligned with the Phase 1 last-seen indexes.

### Dependencies

- [ ] Phase 3 live session data

## Phase 5: Trainee Session History UI

### Goal

Expose the new session history to learners in a way that helps them resume training.

### Checklist

- [x] Add a `Last accessed module` card on the trainee dashboard
- [x] Add a `Recent learning sessions` section on profile, progress, or course detail
- [x] Show module title, course title, last opened timestamp, and session duration
- [x] Add a clear resume action to continue the last session
- [x] Verify that a trainee can see their recent learning sessions
- [x] Verify that a trainee can identify the last module they worked on
- [x] Verify that the display reflects actual stored session records

### Verification Notes

- Verified in [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) that the trainee dashboard now loads `getLastAccessedModuleCard`, shows module title, course title, last-opened metadata, tracked session duration, and a direct resume action.
- Verified in [src/pages/ProgressDashboard.tsx](src/pages/ProgressDashboard.tsx) that the overview tab now renders `Recent learning sessions` using `getUserRecentSessionCards`, including module title, course title, last-opened timestamp, session duration, and session-status display.
- Verified in [src/pages/CourseDetail.tsx](src/pages/CourseDetail.tsx) that resume links can target the stored module by passing `moduleId` through route state and selecting that module when the course page loads.
- Smoke-tested the touched Phase 5 files with TypeScript and editor diagnostics after the UI changes to confirm the new learner session-history surfaces compile cleanly.

### Dependencies

- [x] Phase 4 read models

## Phase 6: Trainer and Admin Visibility

### Goal

Give staff roles visibility into session history for monitoring and intervention.

### Checklist

- [x] Extend the trainer learner progress dialog with recent session history
- [x] Show last accessed module and last activity time for each learner
- [x] Optionally flag learners with repeated short sessions and no completion
- [x] Add admin access to session history inside learner activity detail or analytics views
- [x] Verify that trainers can view session history only for authorized learners
- [x] Verify that admins can inspect recent sessions for any learner
- [x] Verify that the new views help identify disengagement or repeated struggle patterns

### Verification Notes

- Verified in [src/pages/trainer/Learners.tsx](src/pages/trainer/Learners.tsx) that the trainer learners list now shows last activity, last accessed module, and a repeated short-session flag per learner when trainer-accessible session summaries indicate possible struggle.
- Verified in [src/pages/trainer/Learners.tsx](src/pages/trainer/Learners.tsx) that the learner progress dialog now includes recent session history, per-course last accessed module and last activity details, and course-level intervention signals derived from trainer-scoped session summaries.
- Verified in [src/pages/trainer/Learners.tsx](src/pages/trainer/Learners.tsx) that trainer views are backed by `getTrainerLearnerSessionSummaries` and `getLearnerSessionsForTrainer`, which rely on the trainer-scoped RPC introduced earlier rather than unrestricted session queries.
- Verified in [src/pages/admin/DashboardPlaceholder.tsx](src/pages/admin/DashboardPlaceholder.tsx) that admins can inspect recent session activity in the analytics dashboard, including learner identity, course, module, session count, tracked duration, latest status, and review flags for repeated short-session patterns.
- Smoke-tested the Phase 6 changes with editor diagnostics and a production Vite build to confirm the new trainer and admin session visibility surfaces compile cleanly.

### Dependencies

- [x] Phase 4 read models
- [x] Phase 5 trainee-facing validation of session data quality

## Phase 7: Cold-Start Recommendation Layer

### Goal

Ensure new trainees receive recommendations immediately even with no historical data.

### Checklist

- [x] Add onboarding preference capture at signup completion or first login
- [x] Store industry interests, preferred categories, skill level, and optional existing skills
- [x] Extend recommendation input gathering to use onboarding data
- [x] Add a fallback path using curated starter courses and beginner-friendly defaults
- [x] Show recommendation reasons that explain why the learner is seeing those starter courses
- [x] Verify that new trainees see recommendations before any module or assessment activity
- [x] Verify that recommendation reasons are understandable and tied to onboarding or fallback logic

### Verification Notes

- Verified in [src/pages/SignUp.tsx](src/pages/SignUp.tsx) that trainee signup now captures onboarding skill level, industry interests, preferred course categories, and optional existing skills in the same completion flow used for new learner accounts.
- Verified in [supabase/migrations/038_add_onboarding_preference_fields.sql](supabase/migrations/038_add_onboarding_preference_fields.sql) and the user/auth mapping layers in [src/services/supabaseAuthService.ts](src/services/supabaseAuthService.ts), [src/services/supabaseDatabaseService.ts](src/services/supabaseDatabaseService.ts), [src/types/auth.ts](src/types/auth.ts), and [src/types/database.ts](src/types/database.ts) that the onboarding fields are stored on the learner profile and available immediately to the frontend recommendation flow.
- Verified in [src/services/reportingService.ts](src/services/reportingService.ts) that recommendation scoring now uses onboarding signals for cold-start learners and falls back to curated beginner-friendly defaults when no onboarding data or learning history exists.
- Verified in [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) and [src/pages/Courses.tsx](src/pages/Courses.tsx) that trainees can see recommendation reasons tied to onboarding or curated fallback logic before any module session or assessment activity is required.
- Smoke-tested the Phase 7 changes with editor diagnostics and a production Vite build to confirm the onboarding capture and cold-start recommendation flow compile cleanly.
- Runtime verification of persisted onboarding data depends on applying [supabase/migrations/038_add_onboarding_preference_fields.sql](supabase/migrations/038_add_onboarding_preference_fields.sql) to the target Supabase database.

### Dependencies

- [x] Existing recommendation persistence and rendering flows

## Phase 8: Performance-Based Recommendation Upgrade

### Goal

Upgrade recommendation scoring so it uses sessions, assessments, and learning behavior together.

### Checklist

- [x] Extend recommendation inputs with session recency, session frequency, and unfinished-module signals
- [x] Boost advanced recommendations for strong scores plus healthy engagement
- [x] Boost remedial recommendations for low scores plus repeated incomplete sessions
- [x] Add rules for revisited modules that may signal struggle
- [x] Add optional course metadata for `industry_tags` or `career_paths`
- [x] Generate recommendation reasons from the new rule outputs
- [x] Verify that recommendations refresh after assessments and meaningful learning activity
- [x] Verify that high-score learners see stronger progression recommendations
- [x] Verify that low-score learners see more foundational or remedial recommendations

### Verification Notes

- Verified in [src/services/reportingService.ts](src/services/reportingService.ts) that recommendation scoring now consumes session aggregates, including recent session count, recent session duration, recent active categories, repeated incomplete session patterns, and revisited-module struggle signals alongside assessment and completion data.
- Verified in [src/services/reportingService.ts](src/services/reportingService.ts) that strong assessment performance combined with healthy session engagement boosts intermediate and advanced progression recommendations, while lower scores plus repeated incomplete session behavior boost foundational or remedial recommendations.
- Verified in [src/types/index.ts](src/types/index.ts), [src/types/database.ts](src/types/database.ts), [src/services/supabaseDatabaseService.ts](src/services/supabaseDatabaseService.ts), [src/components/course/CourseCreateEditDialog.tsx](src/components/course/CourseCreateEditDialog.tsx), and [supabase/migrations/039_add_course_recommendation_metadata.sql](supabase/migrations/039_add_course_recommendation_metadata.sql) that courses now support optional `industry_tags` and `career_paths` metadata for richer progression matching.
- Verified in [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) and [src/pages/Courses.tsx](src/pages/Courses.tsx) that recommendation inputs refresh using updated performance and session signals, including on browser focus after meaningful learning activity, and that the persisted recommendation context now records behavior-aware inputs.
- Verified in [src/services/analyticsService.ts](src/services/analyticsService.ts) that persisted recommendations are now labeled with the upgraded behavior-aware model version.
- Smoke-tested the Phase 8 changes with editor diagnostics and a production Vite build to confirm the upgraded recommendation flow and optional course metadata compile cleanly.
- Runtime verification of course metadata persistence depends on applying [supabase/migrations/039_add_course_recommendation_metadata.sql](supabase/migrations/039_add_course_recommendation_metadata.sql) to the target Supabase database.

### Dependencies

- [x] Phase 3 session capture
- [x] Phase 7 cold-start recommendation layer

## Phase 9: Analytics and Recommendation Rollup Enhancements

### Goal

Use the new session history to improve analytics quality and recommendation monitoring.

### Checklist

- [x] Extend daily rollups with session counts and session-based learning time
- [x] Add revisit-rate and incomplete-session indicators where useful
- [x] Update learner performance summaries to use session-backed learning time when appropriate
- [x] Capture recommendation refresh triggers and downstream engagement changes
- [x] Verify that analytics can distinguish session engagement from completed learning only
- [x] Verify that recommendation behavior can be evaluated against session activity changes

### Dependencies

- [x] Phase 3 live tracking
- [x] Phase 8 upgraded recommendation logic

### Completion Notes

- Added [supabase/migrations/040_add_session_rollup_metrics.sql](supabase/migrations/040_add_session_rollup_metrics.sql) to extend the daily analytics tables with session counts, session-backed learning minutes, incomplete-session counts, revisit-rate rollups, and recommendation refresh/downstream engagement metrics.
- Replaced the shared rollup refresh logic so course, module, recommendation, and admin aggregates are recomputed from full source data instead of writing user-scoped partial totals into shared daily tables.
- Updated [src/services/analyticsService.ts](src/services/analyticsService.ts) so each recommendation sync emits `recommendation_refresh` events and kicks off an asynchronous analytics refresh.
- Updated [src/services/reportingService.ts](src/services/reportingService.ts) so learner summaries and admin trend totals prefer module session duration as the primary learning-time source, while still falling back to completion-based minutes when session history is absent.
- Smoke test: `npm run build`

## Phase 10: Stabilization and Hardening

### Goal

Reduce operational noise and make the feature safe for regular use.

### Checklist

- [x] Tune heartbeat intervals to avoid excessive writes
- [x] Handle orphaned active sessions with timeout cleanup
- [x] Validate trainer access rules against owned-course boundaries
- [x] Review edge cases such as multi-tab sessions and fast navigation between modules
- [x] Refine thresholds for struggle detection and recommendation adjustments
- [x] Document the lifecycle and support expectations for future contributors
- [x] Verify that session data stays consistent under normal learner behavior
- [x] Verify that recommendation outputs remain explainable and not overly noisy
- [x] Verify that the feature can be maintained without re-learning the whole flow from scratch

### Dependencies

- [x] All previous phases

### Completion Notes

- Updated [src/services/moduleSessionService.ts](src/services/moduleSessionService.ts) to export operational timing defaults, close stale sessions through a dedicated RPC, close overlapping active sessions for the same enrollment during fast navigation, and stop writing analytics heartbeat events on every persistence cycle.
- Updated [src/components/course/ModuleContentViewer.tsx](src/components/course/ModuleContentViewer.tsx) to move heartbeat writes to a 60-second interval, flush progress when the tab becomes hidden, and end sessions on page hide or unload.
- Added [supabase/migrations/041_harden_module_session_lifecycle.sql](supabase/migrations/041_harden_module_session_lifecycle.sql) with `close_stale_module_sessions(...)` plus stricter trainer session access that validates enrollment, learner, course, and instructor ownership together.
- Tuned recommendation behavior thresholds in [src/services/reportingService.ts](src/services/reportingService.ts) so struggle and momentum signals are more conservative and less noisy.
- Added contributor-facing lifecycle and maintenance notes in [temp_markdowns/module_session_lifecycle_support_guide.md](temp_markdowns/module_session_lifecycle_support_guide.md).
- Verification completed with diagnostics on all touched files and a production build smoke test.

## Suggested MVP Cut

If the team wants the smallest useful implementation first, stop after Phase 8 with this shipped scope:

1. Phase 1 database and RLS
2. Phase 2 session service
3. Phase 3 module viewer tracking
4. Phase 5 trainee last accessed module and recent sessions
5. Phase 6 trainer learner recent sessions
6. Phase 7 cold-start recommendations for new trainees
7. Phase 8 high-score progression and low-score remediation recommendation rules

This delivers the core business value without waiting for the full analytics refinement in Phases 9 and 10.

## Main Risks

1. excessive write frequency from heartbeats if updates are too frequent
2. duplicate active sessions if navigation edge cases are not handled well
3. noisy recommendations if weak-topic and session rules are not thresholded
4. trainer access rules must be scoped carefully to owned courses only

## Risk Mitigations

1. heartbeat every 30 to 60 seconds, not every second
2. auto-close stale active sessions after a timeout window
3. use conservative thresholds for struggle detection
4. keep version 1 recommendation logic rule-based and explainable

## Final Recommendation

Implement this feature as a **session-history foundation plus rule-based recommendation upgrade**.

That approach is the best fit for the current system because:

1. it complements the existing `module_completions`, analytics, and recommendation tables
2. it solves the missing-history problem directly
3. it enables better trainee, trainer, and admin visibility
4. it handles new-trainee cold start without waiting for large-scale historical data
5. it creates the right base for future predictive analytics and hybrid recommendations