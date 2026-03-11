alter table if exists public.assessments
  add column if not exists allow_retry_after_passing boolean not null default false;

update public.assessments
set allow_retry_after_passing = false
where allow_retry_after_passing is null;