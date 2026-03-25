# Schema Data Dictionary

## Source

This data dictionary is based on [schema.dbml](c:/Users/caran/Desktop/peso-system/peso-academy/schema.dbml) and reflects the PostgreSQL schema documented there.

## Naming Note

Application terminology maps these schema roles as follows:

- `admin` = `Administrator`
- `trainer` = `Training Officer`
- `trainee` = `Learner`

## Length Conventions

| Value | Meaning |
| --- | --- |
| `Variable` | No fixed maximum is declared in the schema. |
| `System-defined` | Native PostgreSQL storage type without a declared length in DBML. |
| `36 chars (canonical)` | Standard UUID text representation. |
| `Precision, Scale` | Numeric precision and scale exactly as declared in the schema. |
| `Enum-defined` | Allowed values come from an enum, not a length declaration. |

## Enum Reference

| Enum | Allowed Values |
| --- | --- |
| `user_role` | `admin`, `trainer`, `trainee` |
| `course_level` | `Beginner`, `Intermediate`, `Advanced` |
| `enrollment_status` | `enrolled`, `in-progress`, `completed`, `dropped` |
| `submission_status` | `pending`, `approved`, `rejected`, `revision_requested` |
| `certificate_type` | `completion`, `participation` |
| `question_type` | `multiple_choice`, `true_false`, `short_answer`, `essay` |

## auth.users

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | External Supabase authentication user identifier referenced by the public schema. |

## public.role_aliases

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `role_code` | `text` | `Variable` | `PK` | Canonical role code used for alias mapping. |
| `display_name` | `text` | `Variable` | `Not null` | Human-readable role label. |
| `description` | `text` | `Variable` | `Nullable` | Explanation of the role alias. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the alias record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the alias record was last updated. |

## public.permissions

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `text` | `Variable` | `PK` | Stable permission identifier. |
| `name` | `text` | `Variable` | `Not null` | Permission display name. |
| `description` | `text` | `Variable` | `Not null` | Permission purpose and usage. |
| `category` | `text` | `Variable` | `Not null` | Permission grouping category. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the permission was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the permission was last updated. |

## public.roles

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `text` | `Variable` | `PK` | Stable role identifier. |
| `name` | `text` | `Variable` | `Not null` | Role display name. |
| `description` | `text` | `Variable` | `Not null` | Role purpose and scope. |
| `category` | `text` | `Variable` | `Not null`, `Check-constrained` | Role grouping such as internal or end-user. |
| `icon` | `text` | `Variable` | `Nullable` | UI icon token for the role. |
| `color` | `text` | `Variable` | `Nullable` | UI color token for the role. |
| `dashboard_route` | `text` | `Variable` | `Not null` | Default route opened for the role. |
| `can_signup` | `boolean` | `System-defined` | `Not null` | Indicates whether self-signup is allowed for the role. |
| `metadata` | `jsonb` | `Variable` | `Nullable` | Additional structured configuration for the role. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the role was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the role was last updated. |

## public.role_permissions

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Unique record identifier for a role-permission link. |
| `role_id` | `text` | `Variable` | `FK -> public.roles.id`, `Not null`, `Composite unique with permission_id` | Role receiving the permission. |
| `permission_id` | `text` | `Variable` | `FK -> public.permissions.id`, `Not null`, `Composite unique with role_id` | Permission assigned to the role. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the mapping was created. |

## public.users

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK`, `FK -> auth.users.id` | Primary profile identifier linked to the auth user. |
| `email` | `text` | `Variable` | `Not null`, `Unique` | User email address. |
| `name` | `text` | `Variable` | `Not null` | Full display name. |
| `role` | `user_role` | `Enum-defined` | `Not null`, `Enum` | Platform role value. |
| `trainee_type` | `text` | `Variable` | `Nullable`, `Check-constrained` | Learner audience or registration type. |
| `verification_status` | `text` | `Variable` | `Not null`, `Check-constrained` | Status of identity or eligibility verification. |
| `employee_id` | `text` | `Variable` | `Nullable` | Employee identifier when applicable. |
| `physical_id` | `text` | `Variable` | `Nullable` | Physical identification reference or path. |
| `verification_submitted_at` | `timestamptz` | `System-defined` | `Nullable` | Timestamp when verification was submitted. |
| `verified_at` | `timestamptz` | `System-defined` | `Nullable` | Timestamp when verification was approved. |
| `verified_by` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Nullable` | User who reviewed or approved verification. |
| `verification_notes` | `text` | `Variable` | `Nullable` | Reviewer notes for the verification workflow. |
| `onboarding_modal_seen_at` | `timestamptz` | `System-defined` | `Nullable` | Timestamp when the onboarding modal was first seen. |
| `avatar` | `text` | `Variable` | `Nullable` | Avatar URL or storage path. |
| `phone` | `text` | `Variable` | `Nullable`, `Check-constrained` | User phone number. |
| `address` | `text` | `Variable` | `Nullable` | User street address. |
| `date_of_birth` | `date` | `System-defined` | `Nullable` | Date of birth. |
| `gender` | `text` | `Variable` | `Nullable`, `Check-constrained` | Gender value recorded in the profile. |
| `civil_status` | `text` | `Variable` | `Nullable`, `Check-constrained` | Civil status recorded in the profile. |
| `employment_status` | `text` | `Variable` | `Nullable`, `Check-constrained` | Employment status recorded in the profile. |
| `occupation` | `text` | `Variable` | `Nullable` | Current occupation. |
| `education_level` | `text` | `Variable` | `Nullable` | Highest education level. |
| `barangay` | `text` | `Variable` | `Nullable` | Barangay location detail. |
| `city_municipality` | `text` | `Variable` | `Nullable` | City or municipality detail. |
| `province` | `text` | `Variable` | `Nullable` | Province detail. |
| `postal_code` | `text` | `Variable` | `Nullable` | Postal code. |
| `industry_interests` | `text[]` | `Variable` | `Nullable` | Array of industry interest tags. |
| `preferred_categories` | `text[]` | `Variable` | `Nullable` | Array of preferred course categories. |
| `onboarding_skill_level` | `text` | `Variable` | `Nullable`, `Check-constrained` | Self-declared skill level during onboarding. |
| `onboarding_confidence_level` | `text` | `Variable` | `Nullable`, `Check-constrained` | Self-declared confidence level during onboarding. |
| `onboarding_weekly_commitment` | `text` | `Variable` | `Nullable`, `Check-constrained` | Expected weekly time commitment from onboarding. |
| `onboarding_digital_comfort` | `text` | `Variable` | `Nullable`, `Check-constrained` | User comfort with digital tools from onboarding. |
| `onboarding_completed_at` | `timestamptz` | `System-defined` | `Nullable` | Timestamp when onboarding was completed. |
| `language_preference` | `text` | `Variable` | `Not null`, `Check-constrained` | Preferred UI language. |
| `theme_preference` | `text` | `Variable` | `Not null`, `Check-constrained` | Preferred UI theme. |
| `skills` | `text[]` | `Variable` | `Nullable` | Array of user skill tags. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the profile was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the profile was last updated. |

## public.user_permissions

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Unique record identifier for a user-permission grant. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null`, `Composite unique with permission_id` | User receiving the permission. |
| `permission_id` | `text` | `Variable` | `FK -> public.permissions.id`, `Not null`, `Composite unique with user_id` | Permission granted directly to the user. |
| `granted_by` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Nullable` | User who granted the permission. |
| `granted_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the permission was granted. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the record was created. |

## public.audit_logs

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Audit log record identifier. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> auth.users.id`, `Nullable` | Auth user associated with the event. |
| `event_type` | `varchar(50)` | `50` | `Not null` | Specific audit event type. |
| `event_category` | `varchar(50)` | `50` | `Not null` | High-level category of the audited event. |
| `description` | `text` | `Variable` | `Nullable` | Human-readable event description. |
| `ip_address` | `inet` | `System-defined` | `Nullable` | Request IP address. |
| `user_agent` | `text` | `Variable` | `Nullable` | Browser or client user agent string. |
| `metadata` | `jsonb` | `Variable` | `Nullable` | Structured event metadata. |
| `success` | `boolean` | `System-defined` | `Nullable` | Whether the audited action succeeded. |
| `error_message` | `text` | `Variable` | `Nullable` | Error message when the action failed. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the audit event was logged. |

## public.programs

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Program identifier. |
| `title` | `text` | `Variable` | `Not null`, `Unique` | Program title. |
| `description` | `text` | `Variable` | `Not null` | Program description. |
| `category` | `text` | `Variable` | `Nullable` | Program category or classification. |
| `created_by` | `uuid` | `36 chars (canonical)` | `FK -> auth.users.id`, `Nullable` | Auth user who created the program. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the program was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the program was last updated. |

## public.courses

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Course identifier. |
| `title` | `text` | `Variable` | `Not null` | Course title. |
| `description` | `text` | `Variable` | `Not null` | Course description. |
| `category` | `text` | `Variable` | `Not null`, `Taxonomy-constrained` | Course category. |
| `level` | `course_level` | `Enum-defined` | `Not null`, `Enum` | Difficulty level of the course. |
| `duration` | `integer` | `System-defined` | `Not null` | Planned course duration. |
| `instructor_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null` | Training Officer assigned to the course. |
| `program_id` | `uuid` | `36 chars (canonical)` | `FK -> public.programs.id`, `Nullable` | Program that groups the course. |
| `thumbnail` | `text` | `Variable` | `Nullable` | Course thumbnail URL or path. |
| `is_tesda_accredited` | `boolean` | `System-defined` | `Not null` | Indicates TESDA accreditation status. |
| `skills` | `text[]` | `Variable` | `Not null` | Course skill outcomes. |
| `skill_tags` | `text[]` | `Variable` | `Not null`, `Taxonomy-constrained` | Skill taxonomy tags attached to the course. |
| `topic_tags` | `text[]` | `Variable` | `Not null`, `Taxonomy-constrained` | Topic taxonomy tags attached to the course. |
| `industry_tags` | `text[]` | `Variable` | `Not null` | Industry tags for recommendations and filtering. |
| `career_paths` | `text[]` | `Variable` | `Not null` | Career path tags linked to the course. |
| `enrolled_count` | `integer` | `System-defined` | `Not null` | Cached number of enrollments. |
| `rating` | `numeric(3,2)` | `Precision 3, Scale 2` | `Not null` | Aggregate course rating. |
| `certificate_type` | `certificate_type` | `Enum-defined` | `Not null`, `Enum` | Certificate issued for the course. |
| `published` | `boolean` | `System-defined` | `Not null` | Indicates whether the course is publicly available. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the course was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the course was last updated. |

## public.modules

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Module identifier. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null` | Course that owns the module. |
| `title` | `text` | `Variable` | `Not null` | Module title. |
| `description` | `text` | `Variable` | `Not null` | Module description. |
| `order` | `integer` | `System-defined` | `Not null` | Display or progression order within the course. |
| `content` | `text` | `Variable` | `Nullable` | Module body content or serialized lesson text. |
| `module_document` | `text` | `Variable` | `Nullable` | Module document path or URL. |
| `materials` | `text[]` | `Variable` | `Nullable` | Additional material references. |
| `prerequisites` | `text[]` | `Variable` | `Nullable` | Prerequisite references or notes. |
| `module_thumbnail` | `text` | `Variable` | `Nullable` | Thumbnail image for the module. |
| `status` | `text` | `Variable` | `Not null`, `Check-constrained` | Module lifecycle status such as draft or finalized. |
| `skill_tags` | `text[]` | `Variable` | `Not null` | Skill tags associated with the module. |
| `topic_tags` | `text[]` | `Variable` | `Not null` | Topic tags associated with the module. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the module was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the module was last updated. |

## public.assessments

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Assessment identifier. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null` | Course that owns the assessment. |
| `module_id` | `uuid` | `36 chars (canonical)` | `FK -> public.modules.id`, `Nullable`, `Unique` | Module linked to the assessment when module-scoped. |
| `title` | `text` | `Variable` | `Not null` | Assessment title. |
| `description` | `text` | `Variable` | `Nullable` | Assessment description or instructions. |
| `assessment_thumbnail` | `text` | `Variable` | `Nullable` | Assessment thumbnail image reference. |
| `time_limit` | `integer` | `System-defined` | `Nullable` | Allowed duration for completing the assessment. |
| `passing_score` | `integer` | `System-defined` | `Nullable` | Minimum score required to pass. |
| `max_attempts` | `integer` | `System-defined` | `Nullable` | Maximum permitted attempts. |
| `allow_retry_after_passing` | `boolean` | `System-defined` | `Not null` | Indicates whether passed assessments can be retried. |
| `is_active` | `boolean` | `System-defined` | `Not null` | Indicates whether the assessment is active. |
| `prerequisite_module_ids` | `uuid[]` | `Variable` | `Not null` | Modules that must be completed before the assessment unlocks. |
| `derived_from_module_quiz` | `boolean` | `System-defined` | `Not null` | Indicates whether the assessment was derived from module quiz content. |
| `skill_tags` | `text[]` | `Variable` | `Not null` | Skill tags associated with the assessment. |
| `topic_tags` | `text[]` | `Variable` | `Not null` | Topic tags associated with the assessment. |
| `display_order` | `integer` | `System-defined` | `Not null` | Order for rendering assessments in the UI. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the assessment was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the assessment was last updated. |

## public.assessment_questions

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Assessment question identifier. |
| `assessment_id` | `uuid` | `36 chars (canonical)` | `FK -> public.assessments.id`, `Not null` | Assessment that owns the question. |
| `question` | `text` | `Variable` | `Not null` | Question prompt shown to the learner. |
| `question_type` | `question_type` | `Enum-defined` | `Not null`, `Enum` | Question type used for rendering and grading. |
| `options` | `jsonb` | `Variable` | `Nullable` | Structured answer options for objective items. |
| `correct_answer` | `text` | `Variable` | `Nullable` | Stored correct answer for auto-graded items. |
| `points` | `integer` | `System-defined` | `Not null` | Points assigned to the question. |
| `order` | `integer` | `System-defined` | `Not null` | Display order inside the assessment. |
| `explanation` | `text` | `Variable` | `Nullable` | Explanation or rationale for the answer. |
| `source_question_key` | `text` | `Variable` | `Nullable`, `Part of partial unique index` | Source mapping key used for derived question tracking. |
| `derived_from_module_quiz` | `boolean` | `System-defined` | `Not null` | Indicates whether the question came from module quiz content. |
| `is_active` | `boolean` | `System-defined` | `Not null` | Indicates whether the question is active. |
| `skill_tags` | `text[]` | `Variable` | `Not null` | Skill tags associated with the question. |
| `topic_tags` | `text[]` | `Variable` | `Not null` | Topic tags associated with the question. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the question was created. |

## public.assessment_attempts

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Assessment attempt identifier. |
| `assessment_id` | `uuid` | `36 chars (canonical)` | `FK -> public.assessments.id`, `Not null` | Assessment attempted by the learner. |
| `enrollment_id` | `uuid` | `36 chars (canonical)` | `FK -> public.enrollments.id`, `Not null` | Enrollment context for the attempt. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null` | Learner who made the attempt. |
| `started_at` | `timestamptz` | `System-defined` | `Not null` | Attempt start timestamp. |
| `submitted_at` | `timestamptz` | `System-defined` | `Nullable` | Attempt submission timestamp. |
| `score` | `integer` | `System-defined` | `Nullable` | Calculated or reviewed score. |
| `passed` | `boolean` | `System-defined` | `Nullable` | Indicates whether the learner passed the attempt. |
| `answers` | `jsonb` | `Variable` | `Not null` | Raw answer payload captured for the attempt. |
| `time_spent` | `integer` | `System-defined` | `Nullable` | Total time spent on the attempt. |
| `review_status` | `text` | `Variable` | `Nullable`, `Check-constrained` | Manual review state for essay or reviewed attempts. |
| `requires_manual_review` | `boolean` | `System-defined` | `Not null` | Indicates whether the attempt requires human review. |
| `reviewed_at` | `timestamptz` | `System-defined` | `Nullable` | Timestamp when the attempt was reviewed. |
| `reviewed_by` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Nullable` | Reviewer who evaluated the attempt. |
| `review_feedback` | `text` | `Variable` | `Nullable` | Reviewer feedback returned to the learner. |

## public.assessment_answers

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Assessment answer identifier. |
| `attempt_id` | `uuid` | `36 chars (canonical)` | `FK -> public.assessment_attempts.id`, `Not null` | Attempt that owns the answer. |
| `question_id` | `uuid` | `36 chars (canonical)` | `FK -> public.assessment_questions.id`, `Not null` | Question answered by the learner. |
| `answer` | `text` | `Variable` | `Not null` | Learner response. |
| `is_correct` | `boolean` | `System-defined` | `Nullable` | Auto-graded correctness flag. |
| `points_earned` | `integer` | `System-defined` | `Nullable` | Points awarded for the answer. |
| `feedback` | `text` | `Variable` | `Nullable` | Per-answer feedback. |
| `review_status` | `text` | `Variable` | `Nullable`, `Check-constrained` | Manual review status for the answer. |
| `reviewed_at` | `timestamptz` | `System-defined` | `Nullable` | Timestamp when the answer was reviewed. |
| `reviewed_by` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Nullable` | Reviewer who evaluated the answer. |

## public.learner_recommendations

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Recommendation record identifier. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null`, `Composite unique with course_id and source_surface` | Learner receiving the recommendation. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null`, `Composite unique with user_id and source_surface` | Recommended course. |
| `source_surface` | `text` | `Variable` | `Not null`, `Composite unique with user_id and course_id` | UI surface where the recommendation appears. |
| `rank` | `integer` | `System-defined` | `Not null` | Ranking position of the recommendation. |
| `score` | `numeric(10,4)` | `Precision 10, Scale 4` | `Not null` | Final recommendation score. |
| `acceptance_probability` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Predicted likelihood of acceptance. |
| `acceptance_band` | `text` | `Variable` | `Not null` | Qualitative acceptance bucket. |
| `reasons` | `jsonb` | `Variable` | `Not null` | Structured explanation of recommendation factors. |
| `source_mix` | `jsonb` | `Variable` | `Not null` | Structured source contribution breakdown. |
| `recommendation_context` | `jsonb` | `Variable` | `Not null` | Context snapshot used during recommendation generation. |
| `model_version` | `text` | `Variable` | `Not null` | Recommendation model version. |
| `generated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the recommendation was generated. |
| `last_impression_at` | `timestamptz` | `System-defined` | `Nullable` | Last time the recommendation was shown. |
| `last_click_at` | `timestamptz` | `System-defined` | `Nullable` | Last time the recommendation was clicked. |
| `last_accept_at` | `timestamptz` | `System-defined` | `Nullable` | Last time the recommendation was accepted. |
| `impression_count` | `integer` | `System-defined` | `Not null` | Number of recorded impressions. |
| `click_count` | `integer` | `System-defined` | `Not null` | Number of recorded clicks. |
| `accept_count` | `integer` | `System-defined` | `Not null` | Number of recorded accepts. |
| `enrollment_count` | `integer` | `System-defined` | `Not null` | Number of enrollments attributed to the recommendation. |
| `completion_count` | `integer` | `System-defined` | `Not null` | Number of completions attributed to the recommendation. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the recommendation record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the recommendation record was last updated. |

## public.enrollments

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Enrollment identifier. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null`, `Composite unique with course_id` | Learner enrolled in the course. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null`, `Composite unique with user_id` | Course being taken. |
| `progress` | `integer` | `System-defined` | `Not null` | Enrollment progress value. |
| `status` | `enrollment_status` | `Enum-defined` | `Not null`, `Enum` | Enrollment lifecycle status. |
| `enrolled_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the learner enrolled. |
| `completed_at` | `timestamptz` | `System-defined` | `Nullable` | Timestamp when the course was completed. |
| `certificate_id` | `uuid` | `36 chars (canonical)` | `Nullable` | Related certificate identifier stored without a live foreign key. |
| `originating_recommendation_id` | `uuid` | `36 chars (canonical)` | `FK -> public.learner_recommendations.id`, `Nullable` | Recommendation that originated the enrollment. |
| `completion_approval_status` | `text` | `Variable` | `Not null`, `Check-constrained` | Completion workflow state such as not ready, pending, approved, or needs revision. |
| `completion_requested_at` | `timestamptz` | `System-defined` | `Nullable` | Timestamp when completion approval was requested. |
| `completion_reviewed_at` | `timestamptz` | `System-defined` | `Nullable` | Timestamp when completion was reviewed. |
| `completion_reviewed_by` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Nullable` | Reviewer who handled completion approval. |
| `completion_feedback` | `text` | `Variable` | `Nullable` | Feedback returned during completion review. |
| `credited_duration_hours` | `integer` | `System-defined` | `Nullable` | Hours credited for the enrollment. |
| `actual_learning_minutes` | `integer` | `System-defined` | `Nullable` | Total learning time recorded for the enrollment. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the enrollment was last updated. |

## public.enrollment_history

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Enrollment history record identifier. |
| `enrollment_id` | `uuid` | `36 chars (canonical)` | `FK -> public.enrollments.id`, `Nullable` | Enrollment associated with the history event. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> auth.users.id`, `Nullable` | Auth user associated with the event. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Nullable` | Course associated with the event. |
| `action` | `varchar(50)` | `50` | `Not null` | History action type. |
| `old_status` | `varchar(50)` | `50` | `Nullable` | Previous enrollment status. |
| `new_status` | `varchar(50)` | `50` | `Nullable` | New enrollment status. |
| `old_progress` | `integer` | `System-defined` | `Nullable` | Previous progress value. |
| `new_progress` | `integer` | `System-defined` | `Nullable` | New progress value. |
| `performed_by` | `uuid` | `36 chars (canonical)` | `FK -> auth.users.id`, `Nullable` | Auth user who performed the action. |
| `notes` | `text` | `Variable` | `Nullable` | Additional event notes. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the history event was logged. |

## public.module_completions

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Module completion identifier. |
| `enrollment_id` | `uuid` | `36 chars (canonical)` | `FK -> public.enrollments.id`, `Not null`, `Composite unique with module_id` | Enrollment context for the completed module. |
| `module_id` | `uuid` | `36 chars (canonical)` | `FK -> public.modules.id`, `Not null`, `Composite unique with enrollment_id` | Completed module. |
| `completed_at` | `timestamptz` | `System-defined` | `Nullable` | Timestamp when the module was completed. |
| `time_spent` | `integer` | `System-defined` | `Nullable` | Time spent in the module. |

## public.module_sessions

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Module session identifier. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null` | Learner in the session. |
| `enrollment_id` | `uuid` | `36 chars (canonical)` | `FK -> public.enrollments.id`, `Not null` | Enrollment context for the session. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null` | Course being accessed in the session. |
| `module_id` | `uuid` | `36 chars (canonical)` | `FK -> public.modules.id`, `Not null` | Module being accessed in the session. |
| `session_date` | `date` | `System-defined` | `Not null` | Calendar date of the session. |
| `started_at` | `timestamptz` | `System-defined` | `Not null` | Session start timestamp. |
| `last_seen_at` | `timestamptz` | `System-defined` | `Not null` | Last activity timestamp in the session. |
| `ended_at` | `timestamptz` | `System-defined` | `Nullable` | Session end timestamp. |
| `duration_seconds` | `integer` | `System-defined` | `Not null` | Total recorded session duration in seconds. |
| `session_status` | `text` | `Variable` | `Not null`, `Check-constrained` | Session lifecycle status such as active or completed. |
| `entry_source` | `text` | `Variable` | `Nullable` | Source that opened the module session. |
| `resume_position_seconds` | `integer` | `System-defined` | `Nullable` | Resume point inside the learning material. |
| `metadata` | `jsonb` | `Variable` | `Not null` | Structured session metadata. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the session record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the session record was last updated. |

## public.submissions

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Submission identifier. |
| `enrollment_id` | `uuid` | `36 chars (canonical)` | `FK -> public.enrollments.id`, `Not null` | Enrollment related to the submission. |
| `module_id` | `uuid` | `36 chars (canonical)` | `FK -> public.modules.id`, `Not null` | Module related to the submission. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null` | User who submitted the work. |
| `submission_type` | `varchar(50)` | `50` | `Not null` | Submission type classification. |
| `title` | `varchar(255)` | `255` | `Not null` | Submission title. |
| `description` | `text` | `Variable` | `Nullable` | Submission description. |
| `content` | `jsonb` | `Variable` | `Nullable` | Structured submission content payload. |
| `file_path` | `text` | `Variable` | `Nullable` | Primary file path associated with the submission. |
| `attachments` | `jsonb` | `Variable` | `Nullable` | Structured attachment metadata. |
| `submitted_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the submission was made. |
| `status` | `submission_status` | `Enum-defined` | `Not null`, `Enum` | Submission review status. |
| `priority` | `varchar(20)` | `20` | `Nullable` | Priority classification. |
| `feedback` | `text` | `Variable` | `Nullable` | Feedback stored directly on the submission. |
| `validator_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Nullable` | Assigned validator for the submission. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the submission record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the submission record was last updated. |

## public.validations

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Validation record identifier. |
| `submission_id` | `uuid` | `36 chars (canonical)` | `FK -> public.submissions.id`, `Nullable` | Submission being validated. |
| `validator_id` | `uuid` | `36 chars (canonical)` | `FK -> auth.users.id`, `Nullable` | Auth user performing validation. |
| `validation_type` | `varchar(50)` | `50` | `Not null` | Validation type. |
| `status` | `varchar(50)` | `50` | `Not null` | Validation lifecycle status. |
| `decision` | `varchar(50)` | `50` | `Nullable` | Final validation decision. |
| `feedback` | `text` | `Variable` | `Nullable` | Feedback from validation. |
| `rating` | `integer` | `System-defined` | `Nullable` | Numeric rating assigned during validation. |
| `metadata` | `jsonb` | `Variable` | `Nullable` | Structured validation metadata. |
| `started_at` | `timestamptz` | `System-defined` | `Nullable` | Validation start timestamp. |
| `completed_at` | `timestamptz` | `System-defined` | `Nullable` | Validation completion timestamp. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the validation record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the validation record was last updated. |

## public.feedback

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Feedback record identifier. |
| `validation_id` | `uuid` | `36 chars (canonical)` | `FK -> public.validations.id`, `Nullable` | Validation that produced the feedback. |
| `submission_id` | `uuid` | `36 chars (canonical)` | `FK -> public.submissions.id`, `Nullable` | Submission associated with the feedback. |
| `validator_id` | `uuid` | `36 chars (canonical)` | `FK -> auth.users.id`, `Nullable` | Auth user who authored the feedback. |
| `feedback_type` | `varchar(50)` | `50` | `Not null` | Feedback type classification. |
| `title` | `varchar(255)` | `255` | `Nullable` | Feedback title. |
| `content` | `text` | `Variable` | `Not null` | Feedback body content. |
| `template_id` | `uuid` | `36 chars (canonical)` | `Nullable` | Referenced template identifier without an enforced foreign key. |
| `rating` | `integer` | `System-defined` | `Nullable` | Numeric feedback rating. |
| `is_public` | `boolean` | `System-defined` | `Nullable` | Indicates whether the feedback is publicly visible. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the feedback record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the feedback record was last updated. |

## public.feedback_templates

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Feedback template identifier. |
| `name` | `varchar(255)` | `255` | `Not null` | Template name. |
| `category` | `varchar(100)` | `100` | `Nullable` | Template category. |
| `content` | `text` | `Variable` | `Not null` | Template body content. |
| `is_active` | `boolean` | `System-defined` | `Nullable` | Indicates whether the template is active. |
| `created_by` | `uuid` | `36 chars (canonical)` | `FK -> auth.users.id`, `Nullable` | Auth user who created the template. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the template was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the template was last updated. |

## public.certificates

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Certificate identifier. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null` | User receiving the certificate. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null` | Course for which the certificate was issued. |
| `certificate_number` | `text` | `Variable` | `Not null`, `Unique` | Unique certificate number. |
| `certificate_type` | `certificate_type` | `Enum-defined` | `Not null`, `Enum` | Type of certificate issued. |
| `issued_at` | `timestamptz` | `System-defined` | `Not null` | Certificate issuance timestamp. |
| `verification_code` | `text` | `Variable` | `Not null`, `Unique` | Unique code used to verify the certificate. |
| `issued_by` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Nullable` | User who issued the certificate. |

## public.notifications

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Notification identifier. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null` | Recipient user. |
| `type` | `text` | `Variable` | `Not null` | Notification type. |
| `message` | `text` | `Variable` | `Not null` | Notification message content. |
| `read` | `boolean` | `System-defined` | `Not null` | Indicates whether the notification has been read. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the notification was created. |

## public.analytics_events

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Analytics event identifier. |
| `event_name` | `text` | `Variable` | `Not null` | Name of the analytics event. |
| `event_date` | `date` | `System-defined` | `Not null` | Calendar date associated with the event. |
| `occurred_at` | `timestamptz` | `System-defined` | `Not null` | Exact event occurrence timestamp. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Nullable` | User tied to the event. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Nullable` | Course tied to the event. |
| `module_id` | `uuid` | `36 chars (canonical)` | `FK -> public.modules.id`, `Nullable` | Module tied to the event. |
| `assessment_id` | `uuid` | `36 chars (canonical)` | `FK -> public.assessments.id`, `Nullable` | Assessment tied to the event. |
| `enrollment_id` | `uuid` | `36 chars (canonical)` | `FK -> public.enrollments.id`, `Nullable` | Enrollment tied to the event. |
| `recommendation_id` | `uuid` | `36 chars (canonical)` | `FK -> public.learner_recommendations.id`, `Nullable` | Recommendation tied to the event. |
| `surface` | `text` | `Variable` | `Nullable` | UI surface where the event occurred. |
| `session_id` | `text` | `Variable` | `Nullable` | Session identifier for event grouping. |
| `metadata` | `jsonb` | `Variable` | `Not null` | Structured event metadata. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the analytics event row was created. |

## public.analytics_user_daily

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Daily learner analytics record identifier. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null`, `Composite unique with metric_date` | Learner summarized by the daily metrics. |
| `metric_date` | `date` | `System-defined` | `Not null`, `Composite unique with user_id` | Date of the aggregated metrics. |
| `enrollments_started` | `integer` | `System-defined` | `Not null` | Number of enrollments started that day. |
| `modules_completed` | `integer` | `System-defined` | `Not null` | Number of modules completed that day. |
| `assessments_submitted` | `integer` | `System-defined` | `Not null` | Number of assessments submitted that day. |
| `recommendation_impressions` | `integer` | `System-defined` | `Not null` | Recommendation impressions counted that day. |
| `recommendation_clicks` | `integer` | `System-defined` | `Not null` | Recommendation clicks counted that day. |
| `recommendation_accepts` | `integer` | `System-defined` | `Not null` | Recommendation accepts counted that day. |
| `total_learning_minutes` | `integer` | `System-defined` | `Not null` | Total learning minutes for the day. |
| `average_progress` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Average progress across enrollments. |
| `progress_velocity` | `numeric(8,2)` | `Precision 8, Scale 2` | `Not null` | Progress velocity measure. |
| `average_assessment_score` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Average assessment score for the day. |
| `last_activity_at` | `timestamptz` | `System-defined` | `Nullable` | Most recent activity timestamp captured for the day. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the daily record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the daily record was last updated. |

## public.analytics_course_daily

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Daily course analytics record identifier. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null`, `Composite unique with metric_date` | Course summarized by the daily metrics. |
| `metric_date` | `date` | `System-defined` | `Not null`, `Composite unique with course_id` | Date of the aggregated metrics. |
| `enrollments_started` | `integer` | `System-defined` | `Not null` | Enrollments started for the course that day. |
| `enrollments_completed` | `integer` | `System-defined` | `Not null` | Enrollments completed for the course that day. |
| `certificates_issued` | `integer` | `System-defined` | `Not null` | Certificates issued for the course that day. |
| `active_learners` | `integer` | `System-defined` | `Not null` | Active learners recorded for the course that day. |
| `course_views` | `integer` | `System-defined` | `Not null` | Course views recorded that day. |
| `recommendation_enrollments` | `integer` | `System-defined` | `Not null` | Enrollments attributed to recommendations. |
| `total_learning_minutes` | `integer` | `System-defined` | `Not null` | Total learning minutes for the course that day. |
| `average_progress` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Average learner progress in the course. |
| `average_assessment_score` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Average assessment score for the course. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the daily record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the daily record was last updated. |

## public.analytics_module_daily

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Daily module analytics record identifier. |
| `module_id` | `uuid` | `36 chars (canonical)` | `FK -> public.modules.id`, `Not null`, `Composite unique with metric_date` | Module summarized by the daily metrics. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null` | Course containing the module. |
| `metric_date` | `date` | `System-defined` | `Not null`, `Composite unique with module_id` | Date of the aggregated metrics. |
| `module_opens` | `integer` | `System-defined` | `Not null` | Number of module opens that day. |
| `completions` | `integer` | `System-defined` | `Not null` | Number of module completions that day. |
| `assessment_attempts` | `integer` | `System-defined` | `Not null` | Number of assessment attempts tied to the module. |
| `passed_attempts` | `integer` | `System-defined` | `Not null` | Number of passed attempts. |
| `failed_attempts` | `integer` | `System-defined` | `Not null` | Number of failed attempts. |
| `active_learners` | `integer` | `System-defined` | `Not null` | Active learners recorded for the module. |
| `average_score` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Average score for the module's assessment activity. |
| `pass_rate` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Pass rate percentage. |
| `failure_rate` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Failure rate percentage. |
| `average_time_spent_minutes` | `numeric(8,2)` | `Precision 8, Scale 2` | `Not null` | Average learning time in minutes. |
| `abandonment_rate` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Module abandonment rate percentage. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the daily record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the daily record was last updated. |

## public.analytics_recommendation_daily

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Daily recommendation analytics record identifier. |
| `recommendation_id` | `uuid` | `36 chars (canonical)` | `FK -> public.learner_recommendations.id`, `Not null`, `Composite unique with metric_date and surface` | Recommendation summarized by the daily metrics. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null` | Learner receiving the recommendation. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null` | Course tied to the recommendation. |
| `metric_date` | `date` | `System-defined` | `Not null`, `Composite unique with recommendation_id and surface` | Date of the aggregated metrics. |
| `surface` | `text` | `Variable` | `Not null`, `Composite unique with recommendation_id and metric_date` | UI surface where recommendation activity occurred. |
| `impressions` | `integer` | `System-defined` | `Not null` | Number of impressions recorded. |
| `clicks` | `integer` | `System-defined` | `Not null` | Number of clicks recorded. |
| `accepts` | `integer` | `System-defined` | `Not null` | Number of accepts recorded. |
| `enrollments` | `integer` | `System-defined` | `Not null` | Number of enrollments attributed to the recommendation. |
| `completions` | `integer` | `System-defined` | `Not null` | Number of completions attributed to the recommendation. |
| `ctr` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Click-through rate percentage. |
| `accept_rate` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Acceptance rate percentage. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the daily record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the daily record was last updated. |

## public.analytics_admin_daily

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Daily administrator analytics record identifier. |
| `metric_date` | `date` | `System-defined` | `Not null`, `Unique` | Date of the system-wide aggregated metrics. |
| `total_enrollments` | `integer` | `System-defined` | `Not null` | Total enrollments counted for the day. |
| `total_completions` | `integer` | `System-defined` | `Not null` | Total completions counted for the day. |
| `active_learners` | `integer` | `System-defined` | `Not null` | Total active learners counted for the day. |
| `certificates_issued` | `integer` | `System-defined` | `Not null` | Total certificates issued for the day. |
| `recommendation_impressions` | `integer` | `System-defined` | `Not null` | Total recommendation impressions for the day. |
| `recommendation_clicks` | `integer` | `System-defined` | `Not null` | Total recommendation clicks for the day. |
| `recommendation_accepts` | `integer` | `System-defined` | `Not null` | Total recommendation accepts for the day. |
| `total_learning_minutes` | `integer` | `System-defined` | `Not null` | Total learning minutes counted for the day. |
| `average_assessment_score` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | System-wide average assessment score. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the daily record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the daily record was last updated. |

## public.learner_skill_profiles

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Learner skill profile identifier. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null`, `Unique` | Learner whose skill profile is summarized. |
| `strongest_skill_tags` | `text[]` | `Variable` | `Not null` | Skill tags where the learner performs strongest. |
| `improvement_skill_tags` | `text[]` | `Variable` | `Not null` | Skill tags needing improvement. |
| `topic_summary` | `jsonb` | `Variable` | `Not null` | Structured topic-level skill summary. |
| `average_assessment_score` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Average assessment score used for the profile. |
| `total_learning_minutes` | `integer` | `System-defined` | `Not null` | Total learning minutes used for the profile. |
| `modules_completed` | `integer` | `System-defined` | `Not null` | Number of modules completed by the learner. |
| `generated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the profile was generated. |
| `model_version` | `text` | `Variable` | `Not null` | Version of the profile generation model. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the profile record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the profile record was last updated. |

## public.module_quality_signals

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Module quality signal identifier. |
| `module_id` | `uuid` | `36 chars (canonical)` | `FK -> public.modules.id`, `Not null`, `Composite unique with snapshot_date` | Module being scored. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null` | Course containing the module. |
| `snapshot_date` | `date` | `System-defined` | `Not null`, `Composite unique with module_id` | Date of the quality snapshot. |
| `attempt_count` | `integer` | `System-defined` | `Not null` | Number of attempts included in the signal set. |
| `completion_count` | `integer` | `System-defined` | `Not null` | Number of completions included in the signal set. |
| `average_score` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Average score used in quality analysis. |
| `pass_rate` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Pass rate percentage. |
| `average_time_spent_minutes` | `numeric(8,2)` | `Precision 8, Scale 2` | `Not null` | Average time spent in minutes. |
| `abandonment_rate` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Abandonment rate percentage. |
| `quality_score` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Overall module quality score. |
| `risk_level` | `text` | `Variable` | `Not null` | Risk classification for the module. |
| `signal_summary` | `jsonb` | `Variable` | `Not null` | Structured explanation of the quality signals. |
| `generated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the signal snapshot was generated. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the signal record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the signal record was last updated. |

## public.course_risk_scores

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Course risk score identifier. |
| `course_id` | `uuid` | `36 chars (canonical)` | `FK -> public.courses.id`, `Not null`, `Composite unique with snapshot_date` | Course being scored for risk. |
| `snapshot_date` | `date` | `System-defined` | `Not null`, `Composite unique with course_id` | Date of the risk snapshot. |
| `active_enrollments` | `integer` | `System-defined` | `Not null` | Number of active enrollments considered. |
| `completed_enrollments` | `integer` | `System-defined` | `Not null` | Number of completed enrollments considered. |
| `completion_rate` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Completion rate percentage. |
| `average_progress` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Average progress across active enrollments. |
| `average_time_spent_minutes` | `numeric(8,2)` | `Precision 8, Scale 2` | `Not null` | Average learning time in minutes. |
| `recommendation_acceptance_rate` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Recommendation acceptance rate percentage. |
| `risk_score` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Overall course risk score. |
| `risk_level` | `text` | `Variable` | `Not null` | Risk classification for the course. |
| `score_summary` | `jsonb` | `Variable` | `Not null` | Structured explanation of the course risk calculation. |
| `generated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the risk snapshot was generated. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the score record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the score record was last updated. |

## public.learner_disengagement_scores

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Learner disengagement score identifier. |
| `user_id` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Not null`, `Composite unique with snapshot_date` | Learner being scored for disengagement risk. |
| `snapshot_date` | `date` | `System-defined` | `Not null`, `Composite unique with user_id` | Date of the disengagement snapshot. |
| `active_enrollments` | `integer` | `System-defined` | `Not null` | Number of active enrollments considered. |
| `incomplete_enrollments` | `integer` | `System-defined` | `Not null` | Number of incomplete enrollments considered. |
| `recent_session_count` | `integer` | `System-defined` | `Not null` | Count of recent sessions considered. |
| `repeated_short_session_count` | `integer` | `System-defined` | `Not null` | Count of repeated short sessions considered. |
| `inactive_days` | `integer` | `System-defined` | `Not null` | Number of inactive days used in scoring. |
| `disengagement_score` | `numeric(6,2)` | `Precision 6, Scale 2` | `Not null` | Overall disengagement risk score. |
| `risk_level` | `text` | `Variable` | `Not null` | Risk classification for the learner. |
| `signal_summary` | `jsonb` | `Variable` | `Not null` | Structured explanation of the disengagement signals. |
| `generated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the disengagement snapshot was generated. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the score record was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the score record was last updated. |

## public.taxonomy_terms

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | `36 chars (canonical)` | `PK` | Taxonomy term identifier. |
| `term_type` | `text` | `Variable` | `Not null`, `Composite unique with name` | Taxonomy domain or term classification. |
| `name` | `text` | `Variable` | `Not null`, `Composite unique with term_type` | Taxonomy term value. |
| `is_active` | `boolean` | `System-defined` | `Not null` | Indicates whether the term is active. |
| `created_by` | `uuid` | `36 chars (canonical)` | `FK -> public.users.id`, `Nullable` | User who created the taxonomy term. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the term was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the term was last updated. |

## public.system_settings

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `key` | `text` | `Variable` | `PK` | Unique system setting key. |
| `value_json` | `jsonb` | `Variable` | `Not null` | Structured setting value. |
| `description` | `text` | `Variable` | `Nullable` | Explanation of the setting. |
| `is_public` | `boolean` | `System-defined` | `Not null` | Indicates whether the setting can be exposed publicly. |
| `created_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the setting was created. |
| `updated_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the setting was last updated. |

## public.user_phone_normalization_audit

| Field Name | Data Type | Field Length | Constraint | Description |
| --- | --- | --- | --- | --- |
| `user_id` | `uuid` | `36 chars (canonical)` | `PK` | User whose phone normalization change was logged. |
| `original_phone` | `text` | `Variable` | `Nullable` | Original phone value before normalization. |
| `normalized_phone` | `text` | `Variable` | `Nullable` | Normalized phone value after processing. |
| `migration_tag` | `text` | `Variable` | `Not null` | Migration or process tag that produced the normalization. |
| `logged_at` | `timestamptz` | `System-defined` | `Not null` | Timestamp when the normalization audit entry was logged. |