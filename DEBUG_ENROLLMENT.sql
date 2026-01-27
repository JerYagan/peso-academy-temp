-- Debug SQL Queries to Check Enrollment Issue
-- Run these in Supabase SQL Editor

-- Query 1: Check what user ID trainer@gmail.com has
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM public.users
WHERE email = 'trainer@gmail.com';

-- Query 2: Check the course "Test" and its instructor
SELECT 
    c.id as course_id,
    c.title,
    c.instructor_id,
    u.email as instructor_email,
    u.name as instructor_name,
    u.id as instructor_user_id
FROM public.courses c
LEFT JOIN public.users u ON c.instructor_id = u.id
WHERE c.title = 'Test' OR c.id = '6b2a020e-ecbe-437b-b7a3-1cd3fddc1b87';

-- Query 3: Check if instructor_id matches trainer's user ID
SELECT 
    CASE 
        WHEN c.instructor_id = (SELECT id FROM public.users WHERE email = 'trainer@gmail.com')
        THEN 'MATCH ✅'
        ELSE 'MISMATCH ❌'
    END as match_status,
    c.id as course_id,
    c.title,
    c.instructor_id as course_instructor_id,
    (SELECT id FROM public.users WHERE email = 'trainer@gmail.com') as trainer_user_id,
    (SELECT email FROM public.users WHERE id = c.instructor_id) as actual_instructor_email
FROM public.courses c
WHERE c.id = '6b2a020e-ecbe-437b-b7a3-1cd3fddc1b87';

-- Query 4: Check all enrollments for the "Test" course
SELECT 
    e.id as enrollment_id,
    e.user_id,
    e.course_id,
    learner.email as learner_email,
    learner.name as learner_name,
    c.title as course_title,
    c.instructor_id,
    trainer.email as trainer_email
FROM public.enrollments e
JOIN public.users learner ON e.user_id = learner.id
JOIN public.courses c ON e.course_id = c.id
LEFT JOIN public.users trainer ON c.instructor_id = trainer.id
WHERE c.id = '6b2a020e-ecbe-437b-b7a3-1cd3fddc1b87';

-- Query 5: Find all courses created by trainer@gmail.com
SELECT 
    c.id,
    c.title,
    c.instructor_id,
    u.email as instructor_email,
    COUNT(e.id) as enrollment_count
FROM public.courses c
LEFT JOIN public.users u ON c.instructor_id = u.id
LEFT JOIN public.enrollments e ON c.id = e.course_id
WHERE u.email = 'trainer@gmail.com'
GROUP BY c.id, c.title, c.instructor_id, u.email;
