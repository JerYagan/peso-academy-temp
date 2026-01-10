# PESO Academy – Key System Knowledge Questions

## Most Prominent Feature / Technology / Framework

The most prominent and distinctive feature that makes PESO Academy stand out is:

### Certificate of Completion and Participation Management with Integrated Validation Workflow

This is the core differentiating feature that sets PESO Academy apart from general-purpose Learning Management Systems. The system combines:

- **Certificate of Completion and Participation Generation**: Automatic generation of digital certificates (Certificate of Completion and Certificate of Participation) upon course completion, with unique certificate numbers and verification codes
- **Integrated Validation and Approval System**: Built-in workflow where validators (PESO Academy representatives) review, validate, and approve training completions before certificate issuance
- **Government Compliance Reporting**: Automated generation of compliance reports specifically formatted for DOLE (Department of Labor and Employment) and LGU (Local Government Unit) requirements
- **Role-Based Validation Workflow**: Structured process where submissions go through validators for quality assurance before certification

**Why this stands out**: Unlike general LMS platforms (Moodle, Google Classroom, Canvas), PESO Academy is specifically designed for government operations with built-in compliance features and validation workflows that ensure training quality meets government standards. The system issues Certificates of Completion for fully completed courses and Certificates of Participation for partial completion, making it uniquely suited for PESO's mission of providing training to Filipino workers.

## Features NOT Supported by the System

The following features are NOT included or supported in PESO Academy:

### External System Integrations (Not Supported)
- PhilJobNet integration
- HR system integration
- Payroll system integration
- Government database integration
- External email service integration (basic email notifications are included, but no full email system integration)
- Payment gateways (all training is free, no payment processing)

### Advanced Learning Features (Not Supported)
- Video conferencing or live training sessions
- Real-time chat or messaging system
- Discussion forums or community features
- Gamification elements (badges, leaderboards, points system)
- AI-powered learning recommendations
- Automated assessment grading (manual validation required)

### Public Access Features (Not Supported in Initial Version)
- Public job seeker registration (restricted to PESO employees initially)
- Public course catalog access
- Public job matching services

### Mobile Applications (Not Supported)
- Native iOS mobile application
- Native Android mobile application
- Offline mode capability

> **Note**: The system has responsive web design for mobile browsers, but no native apps

### Advanced Analytics (Not Supported)
- Predictive analytics
- Machine learning-based insights
- Advanced data visualization beyond basic charts

### Technical Limitations
- Initial storage capacity: 100GB (expandable)
- File size limits per upload: 100MB (configurable)
- Concurrent user limit: 500 simultaneous users (scalable)
- No real-time synchronization with external systems
- Manual data export/import for external systems

## Summary of Recent Changes and Updates

The following sections have been updated based on the Future System Vision documentation:

### Updated User Classification (Section 1)

**CHANGED FROM**: Four primary user types (Job Seeker, Admin, Trainer, Employer)

**CHANGED TO**: Categorized into Internal Users and End Users:

**Internal Users:**
- Validators (from PESO Academy) - responsible for checking training completion and validation
- Administrator (from Technical Division) - manages system operations, users, and data

**End Users:**
- Special Projects Division (SPD) - manages modules, training programs, and content delivery (Note: SPD serves as training officers, replacing the Trainer role)
- PESO Clients - includes all 11 client types: Jobseekers, Employers, Students, Out-of-School Youth, Migratory workers, Planners, Researchers, Labor Market Information Users, Persons with Disabilities (PWD's), Returning Overseas Filipino Workers (OFW's), Displaced Workers (Note: PESO Clients include Jobseekers, replacing the Job Seeker role)

### Added User Actions for New User Types
- **Validators**: Check training completion, validate outputs, review assignments, approve/reject completions, verify certificate eligibility
- **SPD**: Manage training modules, create training programs, manage content delivery, upload learning materials, monitor program effectiveness
- **PESO Clients (all 11 types)**: Access learning materials, complete training courses, complete assessments, view progress, download certificates

### Added User Flows (Section 5)
- Validator Flow - step-by-step process for validation workflow
- Special Projects Division (SPD) Flow - module and program management workflow
- PESO Clients Flow - learning and assessment completion workflow for all 11 client types

### Added Interfaces (Section 6)
- Validator Interfaces - validation dashboard, submission review interface, validation queue
- SPD Interfaces - module management, training program management, content delivery interface
- PESO Clients Interfaces - learning materials interface, training interface, assessment interface

### Added Dashboards (Section 6)
- Validator Dashboard - pending validations, validation queue, completion statistics
- SPD Dashboard - training programs overview, module statistics, program effectiveness metrics
- PESO Clients Dashboard - enrolled courses, completed courses, certificates, progress overview

---

## 1. Users

### Who are the users of the PESO Academy system?

The PESO Academy system serves users categorized into Internal Users and End Users:

#### 1.1 Internal Users
1. **Validators** - Representatives from PESO Academy responsible for checking training completion and validation
2. **Administrator** - From the Technical Division, manages system operations, users, and data

#### 1.2 End Users
1. **Special Projects Division (SPD)** - Manages modules, training programs, and content delivery
2. **PESO Clients** - Access learning materials and complete training and assessments. Includes the following 11 client types:
   - a. Jobseekers
   - b. Employers
   - c. Students
   - d. Out-of-School Youth
   - e. Migratory workers
   - f. Planners
   - g. Researchers
   - h. Labor Market Information Users
   - i. Persons with Disabilities (PWD's)
   - j. Returning Overseas Filipino Workers (OFW's)
   - k. Displaced Workers

### What actions can each user type perform in the system?

#### Validators (Internal User)
- Check training completion status
- Validate submitted outputs and assessments
- Review assignments and provide feedback
- Approve or reject training completions
- Verify certificate eligibility
- Access validation dashboard for pending reviews

#### Special Projects Division (SPD) (End User)
- Manage training modules
- Create and organize training programs
- Manage content delivery
- Upload and organize learning materials
- Monitor training program effectiveness
- Coordinate with validators
- Create and upload training content, manage course modules and materials
- Track learner progress and engagement
- Issue certificates upon course completion
- Create assessments, review submissions, provide feedback
- Generate training effectiveness reports

#### PESO Clients (End Users - 11 Types)
All PESO client types (Jobseekers, Employers, Students, Out-of-School Youth, Migratory workers, Planners, Researchers, Labor Market Information Users, PWD's, Returning OFW's, Displaced Workers) can:
- Access learning materials
- Complete training courses
- Complete assessments
- View progress and completion status
- Download certificates upon completion
- Access job matching services (where applicable)

#### Administrator (Internal User - Technical Division)
- Manage system operations
- Manage users and user accounts
- Manage system data
- Configure system settings
- Monitor system performance
- Handle technical support and maintenance
- Manage backups and data integrity

#### Admin / PESO Staff Administrator (Role: "admin")
- Create, update, delete, and manage user accounts and permissions
- Oversee course catalog, approve courses, manage course categories
- Monitor overall training progress and completion rates across all users
- Generate compliance reports for DOLE and LGU, export reports in PDF/Excel
- View key metrics including total users, courses, enrollments, and job postings
- Manage job postings, approve employer postings
- Configure system settings, manage divisions and departments
- Import/export data, manage backups, audit logs

#### Employer (Role: "employer") - Future Phase
- Post job opportunities with requirements and descriptions
- Access skill-verified candidate pool
- Review candidate profiles and certifications
- Suggest training needs for potential employees
- Review and manage job applications

---

## 2. Technologies

### What technologies are used to develop PESO Academy?

#### Frontend Technologies:
- **React 18.3.1** - UI library for building interactive user interfaces
- **TypeScript 5.8.3** - Type-safe JavaScript for better code quality
- **Vite 5.4.19** - Build tool and development server
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **shadcn/ui** - UI component library built on Radix UI primitives
- **React Router DOM 6.30.1** - Client-side routing
- **TanStack Query 5.83.0** - Data fetching and state management
- **React Context API** - State management for authentication

#### UI Component Libraries:
- **Radix UI** - Headless UI primitives for accessible components
- **Lucide React** - Icon library
- **Recharts** - Charting library for data visualization
- **Sonner** - Toast notification system

#### Development Tools:
- **ESLint** - Code linting and quality assurance
- **TypeScript** - Static type checking
- **Git** - Version control
- **npm** - Package management

#### Backend Technologies:
- **Supabase** - Backend-as-a-Service platform providing:
  - PostgreSQL database (hosted and managed)
  - Authentication and authorization (built-in JWT)
  - Real-time subscriptions
  - Row Level Security (RLS) policies
  - Storage for files and media
  - Edge Functions for serverless functions
- **Supabase Client** - JavaScript/TypeScript client library for frontend integration
- **Supabase Storage** - File storage for large files, videos, and documents

### How is each technology applied in the system?

- **React & TypeScript**: Used to build all user interface components, pages, and interactive features. TypeScript ensures type safety across the application.
- **Vite**: Provides fast development server with Hot Module Replacement and optimized production builds.
- **Tailwind CSS & shadcn/ui**: Tailwind CSS provides utility classes for rapid styling, while shadcn/ui components provide accessible, customizable UI components.
- **React Router DOM**: Manages client-side routing, enabling navigation between pages without full page reloads. Handles protected routes based on user roles.
- **TanStack Query**: Manages server state, caching, and data synchronization. Handles API calls, loading states, and error handling.
- **React Context API**: Manages global authentication state, allowing components throughout the app to access user information and authentication status.
- **Supabase**: Provides the complete backend infrastructure including PostgreSQL database, authentication, real-time capabilities, and file storage. Supabase handles all database operations, user authentication, and file uploads/downloads.

---

## 3. System Modules

### What are the modules of the system (Main and sub modules)?

#### Module 1: Authentication and Authorization Module
**Sub-modules**: User Login, User Registration/Sign Up, Password Reset, Session Management, Role-Based Access Control (RBAC), Protected Route Management

#### Module 2: User Management Module
**Sub-modules**: User Profile Management, User Account Creation, User Account Update, User Account Deletion, User Role Assignment, User Search and Filtering

#### Module 3: Course Management Module
**Sub-modules**: Course Catalog, Course Creation, Course Editing, Course Deletion, Course Search and Filtering, Course Categorization (Digital Skills, Technical Skills, Employability Skills, Entrepreneurship), Course Details Management, Module Management (within courses), Learning Materials Management (documents, videos, presentations)

#### Module 4: Enrollment Management Module
**Sub-modules**: Course Enrollment, Course Unenrollment, Enrollment Status Tracking, Enrollment History, Bulk Enrollment

#### Module 5: Learning Management Module
**Sub-modules**: Module-Based Course Structure, Learning Materials Access, Video Player, Document Viewer, Assignment Submission, Assessment Taking, Module Navigation, Prerequisites Management

#### Module 6: Progress Tracking Module
**Sub-modules**: Individual Progress Dashboard, Completion Percentage Calculation, Module Completion Tracking, Course Completion Tracking, Time Spent Tracking, Last Activity Tracking, Progress Visualization (Progress Bars, Charts), Learning Statistics

#### Module 7: Validation and Approval Module
**Sub-modules**: Validator Dashboard, Submission Review Interface, Feedback Mechanism, Approval/Rejection Workflow, Rating System, Revision Requests, Validation Queue Management, Feedback Templates

#### Module 8: Certification Management Module
**Sub-modules**: Digital Certificate Generation (Certificate of Completion and Certificate of Participation), Certificate Tracking, Certificate Verification System, Certificate Download (PDF), Certificate Number Generation, Certificate History

#### Module 9: Reporting and Analytics Module
**Sub-modules**: User Management Reports, Course Completion Reports, Training Effectiveness Analytics, Compliance Reports (DOLE and LGU), Progress Reports, Enrollment Reports, Certificate Reports, Export Functionality (PDF, Excel), Data Visualization (Charts, Graphs)

#### Module 10: Job Matching Module (Future Phase)
**Sub-modules**: Job Posting Management, Job Search and Filtering, Candidate Matching Algorithm, Employer Portal, Application Tracking, Skill-Based Matching

#### Module 11: Notification Module
**Sub-modules**: Email Notifications, In-App Notifications, Status Update Notifications, Feedback Notifications, Certificate Issuance Notifications

#### Module 12: Dashboard Module
**Sub-modules**: Job Seeker Dashboard, Admin Dashboard, Trainer Dashboard, Employer Dashboard, Statistics Widgets, Quick Actions

### What functions does each module perform?

- **Authentication and Authorization Module**: Manages user login, registration, password reset, and session handling. Implements role-based access control using Supabase Auth.
- **User Management Module**: Handles CRUD operations for user accounts. Admins can create, update, delete users, assign roles, and manage permissions.
- **Course Management Module**: Manages the course catalog, allowing trainers to create courses with modules, materials, and metadata.
- **Enrollment Management Module**: Manages course enrollments, tracking enrollment status, dates, and history.
- **Learning Management Module**: Provides the learning interface where users access course materials, complete modules, submit assignments, and take assessments.
- **Progress Tracking Module**: Calculates and displays progress percentages, tracks module and course completion, records time spent, and maintains learning statistics.
- **Validation and Approval Module**: Enables validators to review submitted outputs, provide feedback, approve or reject submissions, and manage the validation workflow.
- **Certification Management Module**: Generates digital certificates (Certificate of Completion and Certificate of Participation) upon course completion, tracks certificates, provides certificate verification, and enables certificate downloads.
- **Reporting and Analytics Module**: Generates various reports including user reports, completion reports, compliance reports, and analytics.
- **Job Matching Module**: Manages job postings, enables employers to post jobs, matches candidates based on skills, and tracks applications (future phase).
- **Notification Module**: Sends notifications to users about important events like feedback received, certificate issued, enrollment confirmations.
- **Dashboard Module**: Provides role-specific dashboards with key metrics, statistics, quick actions, and overview information.

### How do the modules interact with each other?

1. Authentication Module provides user authentication and authorization context to all modules
2. User Management Module provides user accounts required before enrollment
3. Course Management Module provides courses that must exist before users can enroll
4. Enrollment Module enables access to course content through Learning Management Module
5. Learning Management Module updates progress data through Progress Tracking Module
6. Learning Management Module sends submissions to Validation Module for review
7. Progress Tracking Module triggers certificate generation when progress reaches 100%
8. Progress Tracking Module feeds data into Reporting Module for analytics
9. Certification Module enhances candidate profiles in Job Matching Module (future)
10. All modules trigger notifications through Notification Module
11. All modules aggregate data in Dashboard Module

---

## 4. Data and Database

### What types of data are stored in the system?

#### User Data:
- User profiles (name, email, phone, address, role)
- Authentication credentials (managed by Supabase Auth)
- User preferences and settings
- Profile pictures (optional)
- Skills and qualifications

#### Training Content Data:
- Course information (title, description, category, level, duration)
- Module content (text, documents, videos, presentations)
- Course metadata (instructor, skills, prerequisites)
- Course ratings and reviews
- Thumbnail images

#### Progress and Enrollment Data:
- Enrollment records (user ID, course ID, enrollment date)
- Progress tracking (completion percentage, last accessed)
- Module completion status
- Time spent on each module
- Enrollment status (enrolled, in-progress, completed, dropped)

#### Assessment and Submission Data:
- Submitted assignments and outputs
- Assessment scores and results
- Feedback and comments from validators
- Approval/rejection status and timestamps
- File attachments

#### Certification Data:
- Certificate records (user ID, course ID, issue date)
- Certificate numbers and verification codes
- Certificate type (Completion or Participation)
- Certificate download history

#### Job and Employment Data (Future Phase):
- Job postings (title, description, requirements, salary)
- Job applications and candidate matches
- Employer information
- Application status tracking

#### Analytics and Reporting Data:
- Training completion statistics
- User engagement metrics
- Course effectiveness data
- Compliance report data

### What are the main database tables?

**DBMS**: Supabase (PostgreSQL-based)

| Table Name | Primary Key | Key Fields |
|------------|-------------|------------|
| `users` | `id` | `id`, `email`, `name`, `role`, `password_hash`, `phone`, `address`, `avatar`, `skills`, `created_at`, `updated_at` |
| `courses` | `id` | `id`, `title`, `description`, `category`, `level`, `duration`, `instructor_id`, `thumbnail`, `certificate_type`, `skills`, `enrolled_count`, `rating`, `created_at`, `updated_at` |
| `modules` | `id` | `id`, `course_id`, `title`, `description`, `order`, `content`, `materials`, `prerequisites`, `created_at` |
| `enrollments` | `id` | `id`, `user_id`, `course_id`, `progress`, `status`, `enrolled_at`, `completed_at`, `certificate_id` |
| `module_completions` | `id` | `id`, `enrollment_id`, `module_id`, `completed_at`, `time_spent` |
| `submissions` | `id` | `id`, `enrollment_id`, `module_id`, `user_id`, `file_path`, `submitted_at`, `status`, `feedback`, `validator_id` |
| `certificates` | `id` | `id`, `user_id`, `course_id`, `certificate_number`, `certificate_type`, `issued_at`, `verification_code` |
| `jobs` | `id` | `id`, `title`, `company`, `location`, `type`, `salary`, `description`, `requirements`, `skills`, `posted_by`, `posted_at`, `status` |
| `job_applications` | `id` | `id`, `job_id`, `user_id`, `applied_at`, `status` |
| `notifications` | `id` | `id`, `user_id`, `type`, `message`, `read`, `created_at` |

### What are the primary keys and foreign keys in the database, and how do they relate tables?

#### Primary Keys (PK):
- `users.id` - Unique identifier for each user
- `courses.id` - Unique identifier for each course
- `modules.id` - Unique identifier for each module
- `enrollments.id` - Unique identifier for each enrollment
- `certificates.id` - Unique identifier for each certificate
- `jobs.id` - Unique identifier for each job posting

#### Foreign Keys (FK) and Relationships:

| Table | Foreign Key | References | Relationship Type |
|-------|-------------|------------|-------------------|
| `courses` | `instructor_id` | `users.id` | Many-to-One (Many courses to one trainer) |
| `modules` | `course_id` | `courses.id` | Many-to-One (Many modules to one course) |
| `enrollments` | `user_id` | `users.id` | Many-to-One (Many enrollments to one user) |
| `enrollments` | `course_id` | `courses.id` | Many-to-One (Many enrollments to one course) |
| `enrollments` | `certificate_id` | `certificates.id` | One-to-One (One enrollment to one certificate) |
| `module_completions` | `enrollment_id` | `enrollments.id` | Many-to-One (Many completions to one enrollment) |
| `module_completions` | `module_id` | `modules.id` | Many-to-One (Many completions to one module) |
| `submissions` | `enrollment_id` | `enrollments.id` | Many-to-One (Many submissions to one enrollment) |
| `submissions` | `module_id` | `modules.id` | Many-to-One (Many submissions to one module) |
| `submissions` | `validator_id` | `users.id` | Many-to-One (Many submissions to one validator) |
| `certificates` | `user_id` | `users.id` | Many-to-One (Many certificates to one user) |
| `certificates` | `course_id` | `courses.id` | Many-to-One (Many certificates to one course) |
| `jobs` | `posted_by` | `users.id` | Many-to-One (Many jobs to one employer) |
| `job_applications` | `job_id` | `jobs.id` | Many-to-One (Many applications to one job) |
| `job_applications` | `user_id` | `users.id` | Many-to-One (Many applications to one user) |
| `notifications` | `user_id` | `users.id` | Many-to-One (Many notifications to one user) |

---

## 5. User Interaction and Flow

### How does each user interact with the system modules?

#### Admin Flow:
1. Admin logs in through Authentication Module
2. Views admin dashboard with system-wide statistics
3. Creates, updates, deletes users through User Management Module
4. Reviews and manages courses through Course Management Module
5. Monitors enrollments and progress through Enrollment and Progress Modules
6. Generates compliance reports through Reporting Module
7. Manages job postings through Job Matching Module

#### Validator Flow (Internal User):
1. Validator logs in through Authentication Module
2. Views validation dashboard with pending submissions
3. Reviews submitted outputs through Validation Module
4. Checks training completion status
5. Provides feedback and ratings through Validation Module
6. Approves or rejects submissions
7. Verifies certificate eligibility
8. Updates validation status in Supabase database

#### Special Projects Division (SPD) Flow (End User):
1. SPD staff logs in through Authentication Module
2. Views SPD dashboard with training program overview
3. Creates and manages training modules through Course Management Module
4. Organizes training programs through Course Management Module
5. Manages content delivery through Learning Management Module
6. Uploads learning materials through Course Management Module
7. Monitors training program effectiveness through Reporting Module
8. Coordinates with validators
9. Creates assessments and reviews submissions
10. Issues certificates upon course completion

#### PESO Clients Flow (End Users - All 11 Types):
1. Client logs in or creates account through Authentication Module
2. Views personalized dashboard
3. Accesses learning materials through Learning Management Module
4. Completes training courses at their own pace
5. Completes assessments through Learning Management Module
6. Views progress and completion status through Progress Tracking Module
7. Receives feedback from validators through Validation Module
8. Downloads certificates upon completion through Certification Module
9. Accesses job matching services (where applicable) through Job Matching Module

#### Employer Flow (Future):
1. Employer logs in through Authentication Module
2. Views employer dashboard with job posting statistics
3. Creates job postings through Job Matching Module
4. Searches skill-verified candidates through Job Matching Module
5. Reviews applications through Job Matching Module

### How does data flow between users, modules, and the database?

#### User Authentication Flow:
```
User → Authentication Module → Supabase (users table) → Authentication Module → User
```
- User submits credentials
- Authentication Module validates against Supabase
- Session token created and stored
- User receives authentication status

#### Course Enrollment Flow:
```
User → Enrollment Module → Supabase (enrollments table) → Progress Tracking Module → Supabase (module_completions table)
```
- User selects course and enrolls
- Enrollment record created in Supabase
- Progress tracking initialized
- User gains access to course content

#### Learning Progress Flow:
```
User → Learning Module → Progress Tracking Module → Supabase (enrollments, module_completions) → Dashboard Module → User
```
- User completes module activities
- Progress Tracking Module calculates completion percentage
- Data updated in Supabase
- Dashboard displays updated progress

#### Submission and Validation Flow:
```
User → Learning Module → Supabase (submissions table) → Validation Module → Validator → Supabase (submissions table) → Notification Module → User
```
- User submits assignment
- Submission stored in Supabase
- Validator reviews through Validation Module
- Feedback/approval stored in Supabase
- User notified of status change

#### Certificate Generation Flow:
```
Progress Tracking Module → Certification Module → Supabase (certificates table) → Notification Module → User
```
- Progress reaches 100%
- Certification Module generates certificate
- Certificate record created in Supabase
- User notified and can download certificate

#### Reporting Flow:
```
Admin → Reporting Module → Supabase (multiple tables) → Reporting Module → Admin (PDF/Excel)
```
- Admin requests report
- Reporting Module queries relevant tables in Supabase
- Data aggregated and formatted
- Report exported as PDF/Excel

---

## 6. Interfaces and Dashboards

### What interfaces exist for each user type?

#### Admin Interfaces:
- **Admin Dashboard** - System-wide statistics and quick actions
- **User Management Interface** - Create, edit, delete users, assign roles
- **Course Management Interface** - Oversee all courses, approve courses
- **Job Management Interface** - Manage job postings, approve employer posts
- **Reporting Interface** - Generate and export various reports
- **Analytics Interface** - View detailed analytics and visualizations
- **System Settings Interface** - Configure system parameters

#### Validator Interfaces (Internal User):
- **Validator Dashboard** - Pending submissions queue, validation statistics
- **Submission Review Interface** - Review submitted outputs and assessments
- **Validation Queue Interface** - List of pending validations
- **Feedback Interface** - Provide feedback and ratings
- **Completion Verification Interface** - Verify training completion status
- **Certificate Eligibility Interface** - Check certificate eligibility

#### Special Projects Division (SPD) Interfaces (End User):
- **SPD Dashboard** - Training program overview, module statistics
- **Module Management Interface** - Create, edit, organize training modules
- **Training Program Management Interface** - Create and manage training programs
- **Content Delivery Interface** - Manage content delivery and scheduling
- **Content Upload Interface** - Upload learning materials
- **Program Effectiveness Interface** - Monitor training program effectiveness
- **Coordination Interface** - Coordinate with validators
- **Course Creation Interface** - Create and edit courses, add modules
- **Content Management Interface** - Upload materials, manage course content
- **Learner Management Interface** - View enrolled learners, track progress
- **Submission Review Interface** - Review and provide feedback on submissions
- **Certificate Issuance Interface** - Issue certificates to completed learners
- **Training Reports Interface** - Generate training effectiveness reports

#### PESO Clients Interfaces (End Users - All 11 Types):
- **Client Dashboard** - Personal learning dashboard with progress
- **Learning Materials Interface** - Access learning materials
- **Training Interface** - Complete training courses
- **Assessment Interface** - Complete assessments
- **Progress Interface** - View progress and completion status
- **Certificate Interface** - View and download certificates
- **Job Matching Interface** - Access job matching services (where applicable)

#### Employer Interfaces (Future):
- **Employer Dashboard** - Job posting statistics and candidate overview
- **Job Posting Interface** - Create and manage job postings
- **Candidate Search Interface** - Search and filter candidates by skills
- **Application Review Interface** - Review job applications

### What dashboards exist in the system, and what information do they display?

#### Admin Dashboard:
- **Total Users Stat** - Total number of registered users in the system
- **Courses Stat** - Total number of available courses
- **Enrollments Stat** - Total number of course enrollments
- **Job Postings Stat** - Total number of active job postings
- **Quick Actions** - Links to manage users, courses, jobs
- **Recent Activity** - Recent enrollments, completions, user registrations

#### Validator Dashboard (Internal User):
- **Pending Validations Stat** - Total number of pending submissions requiring review
- **Completed Validations Stat** - Total number of validations completed
- **Validation Queue** - List of pending submissions with priority indicators
- **Recent Validations** - History of recently validated submissions
- **Quick Actions** - Links to review submissions, provide feedback, verify completions

#### Special Projects Division (SPD) Dashboard (End User):
- **Training Programs Stat** - Total number of active training programs
- **Modules Stat** - Total number of modules managed
- **Content Items Stat** - Total number of learning materials
- **Program Effectiveness** - Completion rates, engagement metrics
- **Training Programs List** - List of active programs with statistics
- **Quick Actions** - Links to create modules, manage programs, upload content

#### PESO Clients Dashboard (End Users - All 11 Types):
- **Enrolled Courses Stat** - Total number of courses enrolled
- **Completed Courses Stat** - Total number of completed courses
- **Certificates Stat** - Total number of certificates earned (Certificate of Completion and Certificate of Participation)
- **Progress Overview** - Overall learning progress
- **My Courses Section** - List of enrolled courses with progress
- **Quick Actions** - Links to access materials, complete assessments, view certificates

#### Employer Dashboard (Future):
- **Job Postings Stat** - Total number of active job postings
- **Applications Stat** - Total number of job applications received
- **Candidates Stat** - Number of matched candidates
- **Job Postings List** - List of posted jobs with application counts

---

## 7. Components

### How do the major components (front-end, back-end, database) interact?

#### Current Architecture (Frontend-Only with Mock Data):
```
Frontend (React + TypeScript) → localStorage (Mock Database) → Frontend
```
- All data currently stored in browser's localStorage
- Mock data service handles CRUD operations
- React components consume data through service layer
- No backend server currently - all logic in frontend

#### Production Architecture with Supabase:
**Three-Tier Architecture:**

**Tier 1: Frontend (Client-Side)**
- React Application - User interface components
- State Management - React Context API, TanStack Query
- Supabase Client - JavaScript/TypeScript client library for API calls
- Routing - React Router for navigation

**Tier 2: Supabase Backend (Server-Side)**
- Supabase API - RESTful API endpoints automatically generated
- Authentication - Supabase Auth with JWT token management
- Row Level Security (RLS) - Database-level security policies
- Edge Functions - Serverless functions for custom business logic
- Storage API - File upload/download management
- Real-time Subscriptions - Real-time data synchronization

**Tier 3: Database & Storage**
- Supabase PostgreSQL - Data persistence (managed PostgreSQL database)
- Supabase Storage - File storage for large files, videos, and documents
- Automated Backups - Built-in backup system

#### Interaction Flow:
1. **User Action** - User interacts with React component
2. **API Request** - Frontend sends request via Supabase Client library
3. **Authentication** - Supabase validates JWT token automatically
4. **Row Level Security** - RLS policies enforce data access rules
5. **Database Query** - Supabase queries PostgreSQL database
6. **Data Response** - Database returns data to Supabase API
7. **API Response** - Supabase sends JSON response to frontend
8. **UI Update** - Frontend updates UI with received data (or via real-time subscription)

---

## 8. System Input and Output

### What are the inputs required from users in the system?

#### Authentication Inputs:
- **Login**: Email/username, password
- **Registration**: Name, email, password, role selection, phone (optional), address (optional)
- **Password Reset**: Email address

#### Course Management Inputs (Trainer/Admin):
- **Course Creation**: Title, description, category, level, duration, instructor assignment, skills, certificate type (Completion or Participation), thumbnail image
- **Module Creation**: Module title, description, content, order, prerequisites, learning materials (files, videos)
- **Content Upload**: Documents (PDF, DOCX), videos (MP4, WebM), presentations (PPTX), images

#### Learning Inputs (Job Seeker):
- **Course Enrollment**: Course selection, enrollment confirmation
- **Assignment Submission**: File uploads, text responses, assessment answers
- **Progress Updates**: Module completion markers, time spent tracking

#### Validation Inputs (Validator/Trainer):
- **Feedback**: Comments, ratings, approval/rejection status
- **Revision Requests**: Revision instructions, specific feedback points

#### User Management Inputs (Admin):
- **User Creation**: Name, email, role, password, phone, address
- **User Update**: Any user field modifications
- **Role Assignment**: User role selection

#### Job Posting Inputs (Employer - Future):
- **Job Creation**: Title, company, location, type, salary, description, requirements, required skills

#### Reporting Inputs (Admin):
- **Report Generation**: Report type selection, date range, filters (division, course, user), export format (PDF/Excel)

### How are these inputs processed by the system?

1. **Input Validation** - Client-side validation using React Hook Form and Zod schemas
2. **Data Sanitization** - Clean and format input data
3. **Authentication Check** - Verify user is authenticated and authorized via Supabase Auth
4. **Business Logic Processing** - Apply business rules and validations
5. **Database Operations** - Create, read, update, or delete records in Supabase
6. **File Processing** - Upload files to Supabase Storage, generate thumbnails
7. **Notification Triggering** - Send notifications for important events
8. **Response Generation** - Return success/error response to user

### What outputs are generated for each user type?

#### Job Seeker / PESO Employee Outputs:
- **Dashboard** - Personalized dashboard with statistics, enrolled courses, progress (Web interface)
- **Course Catalog** - List of available courses with filters and search results (Web interface)
- **Progress Reports** - Visual progress bars, completion percentages, learning statistics (Web interface, downloadable PDF)
- **Digital Certificates** - Certificate of Completion and Certificate of Participation in PDF format (Downloadable PDF, web view)
- **Feedback Notifications** - Feedback from validators on submissions (In-app notifications, email)
- **Learning Materials** - Course content, videos, documents, presentations (Web interface, downloadable files)
- **Completion Confirmation** - Course completion status, certificate issuance notification (In-app notifications, email)

#### Admin Outputs:
- **Admin Dashboard** - System-wide statistics, key metrics, quick actions (Web interface)
- **User Management Reports** - User lists, role assignments, activity logs (Web interface, PDF/Excel export)
- **Compliance Reports** - DOLE and LGU compliance reports with training data (PDF/Excel export)
- **Course Analytics** - Course performance, enrollment trends, completion rates (Web interface with charts, PDF export)
- **Training Effectiveness Reports** - Analysis of training programs, engagement metrics (PDF/Excel export)
- **System Statistics** - Total users, courses, enrollments, certificates issued (Web interface, dashboard widgets)

#### Trainer Outputs:
- **Trainer Dashboard** - Course statistics, learner overview, completion rates (Web interface)
- **Learner Progress Reports** - Individual and aggregate learner progress, engagement metrics (Web interface, PDF export)
- **Submission Queue** - List of pending submissions requiring review (Web interface)
- **Training Effectiveness Reports** - Course completion rates, learner feedback, performance analysis (PDF/Excel export)
- **Certificate Issuance Confirmation** - Confirmation of certificates issued to learners (Web interface, email notification)

#### Employer Outputs (Future):
- **Employer Dashboard** - Job posting statistics, application counts (Web interface)
- **Candidate Matches** - List of candidates matching job requirements with skills and certificates (Web interface)
- **Application Reports** - Application statistics, candidate profiles (Web interface, PDF export)

### How are outputs delivered or displayed to users?

- **Web Interface Display** - Real-time updates via Supabase real-time subscriptions, responsive design, interactive elements, visual indicators, loading states
- **File Downloads** - PDF certificates, report exports (PDF/Excel), learning materials downloadable for offline access via Supabase Storage
- **Notifications** - In-app notifications (toast notifications, notification badges), email notifications for important events, real-time dashboard updates
- **Data Visualization** - Charts and graphs using Recharts library, progress indicators (progress bars, circular progress), statistics cards

