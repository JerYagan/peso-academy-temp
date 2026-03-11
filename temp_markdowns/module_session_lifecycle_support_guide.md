# Module Session Lifecycle Support Guide

## Purpose

This guide documents how module session tracking is expected to behave after Phase 10 hardening, and what future contributors should preserve when changing the flow.

## Lifecycle Summary

1. A learner opens a module in the course viewer.
2. The client closes stale sessions for that learner before starting a new session.
3. Any other active session for the same enrollment but a different module is closed as `abandoned` to avoid overlap during fast navigation.
4. If the same module already has a fresh active session, that session is reused instead of creating a duplicate row.
5. The viewer sends a heartbeat every 60 seconds and also flushes progress when the tab becomes hidden.
6. The session ends as `completed`, `abandoned`, or `timed_out` when the learner finishes, leaves, or closes the tab.
7. A database cleanup function can close orphaned active sessions older than 15 minutes.

## Operational Defaults

- Heartbeat interval: 60 seconds
- Stale-session timeout: 15 minutes
- Overlap rule: one active module session per enrollment at a time
- Resume behavior: reuse the active session when the learner returns to the same module before the stale timeout

## Why These Defaults Exist

- A 60-second heartbeat reduces write volume compared with the earlier 30-second cadence while still preserving resume position and recent activity.
- A 15-minute stale timeout is long enough to tolerate brief connection loss or background tab pauses without fragmenting a learner's session history.
- Closing overlapping active sessions prevents inflated activity counts during rapid module switching or accidental multi-tab duplication.

## Trainer Visibility Contract

- Admins can view all module sessions.
- Trainers, SPD staff, and training officers can only view sessions tied to enrollments in courses they own.
- Session access should always validate all of the following together:
  - `module_sessions.enrollment_id`
  - `module_sessions.user_id`
  - `module_sessions.course_id`
  - `courses.instructor_id`

Do not loosen trainer visibility to raw course ownership checks alone when session rows are involved.

## Recommendation Signal Guardrails

- Recent activity uses a 14-day window.
- Struggle signals require at least 4 recent incomplete sessions for a module cluster, with average time per session at or below 12 minutes.
- Healthy engagement requires at least 3 recent module aggregates and at least 60 minutes of recent session time.
- Beginner remediation boosts should not trigger off a single incomplete session.

These thresholds are intentionally conservative to keep recommendations explainable.

## Maintenance Checklist

- If heartbeat timing changes, review write volume and stale-timeout assumptions together.
- If session statuses change, update the rollup migration and recommendation behavior rules in the same change.
- If trainer ownership rules change, revalidate `get_trainer_accessible_module_sessions(...)` and the `module_sessions` select policy together.
- If client navigation behavior changes, retest fast module switching, hidden tabs, and closing the browser while a session is active.

## Smoke-Test Expectations

- Open a module and confirm a single active session is created.
- Leave the module open for more than one minute and confirm the session updates without creating duplicates.
- Switch quickly to another module in the same course and confirm the previous active session is closed.
- Reopen the same module before the stale timeout and confirm the existing active session is reused.
- Run stale cleanup and confirm abandoned browser sessions move to `timed_out`.
- Confirm trainer accounts cannot read sessions for learners outside their owned courses.