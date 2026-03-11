# Topic And Skill Taxonomy Guide

## Canonical Scope

- Course categories must use the approved set from `src/lib/taxonomy.ts`.
- Skill tags and topic tags must use the approved sets from `src/lib/taxonomy.ts`.
- Assessment authoring must attach approved topic tags so topic-level analytics and recommendation reasons rely on explicit tags instead of free-text inference.

## Allowed Editors

- `admin`
- `trainer`

Only admin and trainer users should create or edit course, module, and assessment taxonomy values. Trainee onboarding may choose preferred course categories only from the approved category list.

## Approved Course Categories

- Digital Skills
- Technical Skills
- Employability Skills
- Business & Management
- Entrepreneurship
- Personal Development
- Hospitality & Tourism
- Construction & Trades
- Creative & Design

## Implementation Rules

- Course category values must be canonicalized before save.
- Course skill tags must come from the approved skill-tag list.
- Course, module, and assessment topic tags must come from the approved topic-tag list.
- Existing legacy labels such as `Soft Skills`, `Digital Literacy`, `Vocational Training`, and `Career Development` must be normalized into the approved category set.
- Reporting and recommendation logic should match canonical tags, not loose substring comparisons.

## Ownership Rules

- Trainers and admins can assign taxonomy values while creating or editing content.
- Learners cannot edit taxonomy on courses, modules, or assessments.
- Learner onboarding can only select preferred categories from the approved category list.