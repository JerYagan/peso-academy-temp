# Course Population Seed Dataset

This dataset is intended for browser-based or scripted population of trainer courses and modules in PESO Academy.

Coverage goals:
- 7 courses
- 5 modules per course
- Every supported content block type represented throughout the dataset
- Content block types used: text, code, video, image, quiz, document, learning_material
- Assessment formats covered: multiple choice, true/false, short answer, essay

Shared asset pool:
- Document URL: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
- Material URL 1: https://developer.mozilla.org/en-US/docs/Learn
- Material URL 2: https://edu.gcfglobal.org/en/
- Material URL 3: https://support.google.com/docs
- Material URL 4: https://www.atlassian.com/work-management/productivity
- Material URL 5: https://www.microsoft.com/en-us/microsoft-365/business-insights-ideas/resources
- YouTube URL 1: https://www.youtube.com/watch?v=ysz5S6PUM-U
- YouTube URL 2: https://www.youtube.com/watch?v=aqz-KE-bpKQ
- YouTube URL 3: https://www.youtube.com/watch?v=ScMzIvxBSi4
- YouTube URL 4: https://www.youtube.com/watch?v=jNQXAC9IVRw
- YouTube URL 5: https://www.youtube.com/watch?v=HluANRwPyNo

Image guidance:
- Use generic placeholder images via picsum or equivalent.
- Example format: https://picsum.photos/seed/<unique-seed>/1200/675

## Course 1: Office Productivity Foundations

This course is the fully detailed reference specimen for actual population.

- Category: Digital Skills
- Level: Beginner
- Duration: 12 hours
- Skill tags: Computer Basics, Digital Literacy, Email Etiquette
- Topic tags: Digital Literacy, Data Management, Career Readiness
- Industry tags: Business Services, Public Service
- Career paths: Administrative Assistant, Office Staff
- Thumbnail: https://picsum.photos/seed/office-productivity-course/1200/675
- Course document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
- Course summary: A practical beginner course that simulates common office tasks such as email coordination, document preparation, spreadsheet updates, short presentation prep, and shared-file management.
- Intended learner outcome: Trainees should be able to complete simple digital office tasks with clearer communication, fewer formatting errors, and better file discipline.

### Module 1: Email and Calendar Basics
- Description: Introduces inbox organization, scheduling, and message clarity for workplace communication.
- Duration: 2 hours
- Thumbnail: https://picsum.photos/seed/office-productivity-m1/1200/675
- Module document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
- Skill tags: Email Etiquette, Digital Literacy
- Topic tags: Digital Literacy, Career Readiness
- Learning objectives:
  - Organize email messages using a simple priority routine.
  - Write clearer subject lines and concise meeting replies.
  - Create calendar invites with the essential logistical details.
- Content blocks:
  - text:
    - title: Inbox triage routine
    - body: Start each workday by scanning for urgent senders, time-bound requests, and messages waiting for reply. Use one consistent naming and filing habit so unresolved requests do not disappear under newer messages.
  - video:
    - title: Email workflow walkthrough
    - url: https://www.youtube.com/watch?v=ysz5S6PUM-U
    - body: Use this short video as an intro prompt for discussing message flow, prioritization, and scheduling.
  - image:
    - title: Calendar invite reference
    - url: https://picsum.photos/seed/office-productivity-m1-image/1200/675
    - alt_text: Example calendar and inbox workspace
    - caption: Sample visual for discussing meeting details and inbox priorities
  - document:
    - title: Email and calendar checklist
    - url: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
    - body: Handout for subject line writing, meeting invites, and follow-up reminders
  - learning_material:
    - title: Supplemental guide
    - url: https://support.google.com/docs
    - body: Optional reading on organizing digital communication tools
- Assessment:
  - multiple_choice:
    - question: Which subject line is clearest for a meeting reschedule?
    - options:
      - Reschedule
      - Meeting
      - Request to move Friday 2 PM client briefing to 3 PM
      - Update
    - correct_answer: Request to move Friday 2 PM client briefing to 3 PM
    - points: 1
    - explanation: A useful subject line tells the reader what changed and what event is affected.
  - true_false:
    - question: Calendar invites should always include date, time, and purpose.
    - correct_answer: True
    - points: 1
    - explanation: These details reduce confusion and back-and-forth clarifications.
  - short_answer:
    - question: Give one way to make a work email easier to scan.
    - expected_focus: Short paragraphs, bullets, direct action item, or clear deadline.
    - points: 2
  - essay:
    - question: Explain how you would manage overlapping meetings and urgent email requests during the same morning.
    - expected_focus: Prioritization, acknowledgement messages, calendar updates, and stakeholder communication.
    - points: 5

### Module 2: Document Formatting Essentials
- Description: Covers headings, spacing, lists, and consistency in common office documents.
- Duration: 2 hours
- Thumbnail: https://picsum.photos/seed/office-productivity-m2/1200/675
- Module document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
- Skill tags: Computer Basics, Digital Literacy
- Topic tags: Digital Literacy, Data Management
- Learning objectives:
  - Apply consistent heading and paragraph styles.
  - Improve readability using spacing and lists.
  - Reduce formatting noise before submission.
- Content blocks:
  - text:
    - title: Readability rules
    - body: Use short headings, predictable spacing, and list formatting to help a supervisor scan a document quickly. Avoid mixing too many font sizes and use emphasis only where it changes meaning.
  - image:
    - title: Before and after formatting comparison
    - url: https://picsum.photos/seed/office-productivity-m2-image/1200/675
    - alt_text: Two example document layouts showing poor and improved formatting
    - caption: Discussion visual for comparing readable and cluttered layouts
  - document:
    - title: Formatting practice handout
    - url: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
    - body: Practice guide for heading styles, bullets, and whitespace
  - learning_material:
    - title: Additional reading
    - url: https://developer.mozilla.org/en-US/docs/Learn
    - body: Optional general reading on structured content and clarity
  - quiz:
    - title: Formatting check
    - body: Quick graded check on headings, lists, and spacing consistency
- Assessment:
  - multiple_choice:
    - question: Which formatting change most improves scanability in a one-page status update?
    - options:
      - Use five font sizes
      - Convert actions into bullets with short headings
      - Center all body paragraphs
      - Remove line spacing
    - correct_answer: Convert actions into bullets with short headings
    - points: 1
  - true_false:
    - question: Using one consistent heading pattern makes documents easier to review.
    - correct_answer: True
    - points: 1
  - short_answer:
    - question: Name one formatting issue that can slow down a manager reading a document.
    - expected_focus: Dense paragraphs, inconsistent headings, poor spacing, excessive styling.
    - points: 2
  - essay:
    - question: Describe how you would rework a cluttered incident report so it is easier for a supervisor to review in under two minutes.
    - expected_focus: Structure, headings, list use, emphasis, and removing clutter.
    - points: 5

### Module 3: Spreadsheet Tracking and Totals
- Description: Introduces simple tables, totals, and tracking sheets for office reporting.
- Duration: 2.5 hours
- Thumbnail: https://picsum.photos/seed/office-productivity-m3/1200/675
- Skill tags: Computer Basics, Data Entry
- Topic tags: Data Management, Digital Literacy
- Learning objectives:
  - Structure a simple tracking sheet with useful column names.
  - Use a basic total formula.
  - Explain why headers and data validation improve sheet quality.
- Content blocks:
  - text:
    - title: Tracking sheet structure
    - body: A practical tracking sheet should make status, owner, deadline, and total values easy to inspect. Keep headers fixed and use consistent labels so updates remain understandable after handoff.
  - code:
    - title: Formula sample
    - body: =SUM(B2:B10)
  - video:
    - title: Spreadsheet basics walkthrough
    - url: https://www.youtube.com/watch?v=aqz-KE-bpKQ
    - body: Introductory walkthrough on organizing rows, columns, and totals
  - image:
    - title: Tracker sample
    - url: https://picsum.photos/seed/office-productivity-m3-image/1200/675
    - alt_text: Sample spreadsheet tracker with totals
    - caption: Reference image for discussing tracker readability
  - learning_material:
    - title: Extra practice
    - url: https://edu.gcfglobal.org/en/
    - body: Supplemental office spreadsheet learning material
- Assessment:
  - multiple_choice:
    - question: Which function totals a range of numeric cells?
    - options:
      - COUNT
      - SUM
      - SORT
      - FIND
    - correct_answer: SUM
    - points: 1
  - true_false:
    - question: Freezing the header row can make a long tracking sheet easier to use.
    - correct_answer: True
    - points: 1
  - short_answer:
    - question: Describe one reason to freeze headers in a tracking sheet.
    - expected_focus: Keeping labels visible, reducing errors, easier scanning.
    - points: 2
  - essay:
    - question: Explain how you would design a simple spreadsheet to track task owner, due date, and completion status for a small office team.
    - expected_focus: Useful columns, readability, totals or filters, and update discipline.
    - points: 5

### Module 4: Presentation Storyboarding
- Description: Focuses on slide flow, concise text, and visual support for short briefings.
- Duration: 2.5 hours
- Thumbnail: https://picsum.photos/seed/office-productivity-m4/1200/675
- Module document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
- Skill tags: Communication, Digital Literacy
- Topic tags: Career Readiness, Digital Literacy
- Learning objectives:
  - Break a short briefing into a clear sequence.
  - Reduce slide text to key talking points.
  - Support spoken delivery with simple visuals.
- Content blocks:
  - text:
    - title: Storyboard outline
    - body: Start with purpose, then supporting facts, then the recommended action. Each slide should answer one question clearly rather than mixing updates, evidence, and next steps together.
  - video:
    - title: Brief presentation example
    - url: https://www.youtube.com/watch?v=ScMzIvxBSi4
    - body: Use this as a prompt for discussing attention span and sequence
  - image:
    - title: Slide planning sketch
    - url: https://picsum.photos/seed/office-productivity-m4-image/1200/675
    - alt_text: Example slide outline and planning notes
    - caption: Storyboard visual for a short workplace briefing
  - document:
    - title: Storyboard worksheet
    - url: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
    - body: Printable planning sheet for slide sequence and speaker notes
  - quiz:
    - title: Storyboard reflection
    - body: Learners explain how they would convert notes into a short slide deck
- Assessment:
  - multiple_choice:
    - question: What should usually come first in a short workplace presentation?
    - options:
      - Visual effects
      - Main purpose or objective
      - Detailed appendix
      - Full transcript
    - correct_answer: Main purpose or objective
    - points: 1
  - true_false:
    - question: A slide deck is usually stronger when each slide focuses on one key message.
    - correct_answer: True
    - points: 1
  - short_answer:
    - question: What is one sign that a slide contains too much text?
    - expected_focus: Hard to scan quickly, full paragraphs, audience reads instead of listens.
    - points: 2
  - essay:
    - question: Explain how you would turn rough meeting notes into a 3-slide update for a supervisor.
    - expected_focus: Prioritization, sequence, slide purpose, and concise supporting points.
    - points: 5

### Module 5: File Management and Sharing
- Description: Reviews folder naming, version control, and safe file sharing practices.
- Duration: 3 hours
- Thumbnail: https://picsum.photos/seed/office-productivity-m5/1200/675
- Module document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
- Skill tags: Digital Literacy, Computer Basics
- Topic tags: Data Management, Career Readiness
- Learning objectives:
  - Use clearer folder and file naming conventions.
  - Avoid confusion from duplicate or outdated versions.
  - Share files with the correct audience and purpose.
- Content blocks:
  - text:
    - title: Shared drive discipline
    - body: File names should help another staff member understand what a document is, which version is current, and whether it is ready for sharing. Keep naming predictable and avoid saving final copies under vague labels.
  - image:
    - title: Folder structure reference
    - url: https://picsum.photos/seed/office-productivity-m5-image/1200/675
    - alt_text: Example shared folder structure and version naming pattern
    - caption: Visual reference for discussing version naming and shared folders
  - learning_material:
    - title: Productivity reading
    - url: https://www.atlassian.com/work-management/productivity
    - body: Additional material on team coordination and digital work habits
  - document:
    - title: Version control checklist
    - url: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
    - body: Printable checklist for managing revisions and shared files
  - quiz:
    - title: File handling check
    - body: Questions on naming, sharing, and version confusion
- Assessment:
  - multiple_choice:
    - question: Which file name is most useful in a shared folder?
    - options:
      - Final.docx
      - ReportNew.docx
      - 2026-03_Client_Status_Report_v03.docx
      - UseThisOne.docx
    - correct_answer: 2026-03_Client_Status_Report_v03.docx
    - points: 1
  - true_false:
    - question: Saving multiple unrelated drafts under the name Final can confuse a team.
    - correct_answer: True
    - points: 1
  - short_answer:
    - question: Give one rule you would use for naming files in a shared drive.
    - expected_focus: Date, project name, version, owner, or status indicator.
    - points: 2
  - essay:
    - question: Explain how you would organize and share a folder for a small team project so everyone can find the current version of key files.
    - expected_focus: Folder structure, naming, permissions, and current-version handling.
    - points: 5

## Course 2: Customer Service Communication Skills

- Category: Employability Skills
- Level: Beginner
- Duration: 10 hours
- Skill tags: Communication, Customer Service, Email Etiquette
- Topic tags: Customer Relations, Career Readiness
- Industry tags: Retail, Public Service
- Career paths: Front Desk Associate, Customer Service Representative
- Thumbnail: https://picsum.photos/seed/customer-service-course/1200/675

### Module 1: First Contact and Professional Tone
- Content blocks:
  - text: Tone, greetings, and active listening basics.
  - video: https://www.youtube.com/watch?v=jNQXAC9IVRw
  - image: https://picsum.photos/seed/customer-service-m1-image/1200/675
  - learning_material: https://www.microsoft.com/en-us/microsoft-365/business-insights-ideas/resources
  - quiz: Multiple choice and essay on greeting different customer types.

### Module 2: Clarifying Requests
- Content blocks:
  - text: How to restate and confirm a customer concern.
  - image: https://picsum.photos/seed/customer-service-m2-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - learning_material: https://developer.mozilla.org/en-US/docs/Learn
  - quiz: True/false and short answer on clarification steps.

### Module 3: Handling Complaints Calmly
- Content blocks:
  - text: De-escalation sequence for tense interactions.
  - video: https://www.youtube.com/watch?v=HluANRwPyNo
  - image: https://picsum.photos/seed/customer-service-m3-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: Essay response to an upset client scenario.

### Module 4: Writing Follow-Up Messages
- Content blocks:
  - text: Follow-up message structure and response deadlines.
  - code: Thank you for your patience. Here is the next action we will take.
  - image: https://picsum.photos/seed/customer-service-m4-image/1200/675
  - learning_material: https://support.google.com/docs
  - quiz: Multiple choice on message structure.

### Module 5: Service Recovery and Documentation
- Content blocks:
  - text: Logging issues and confirming resolution steps.
  - video: https://www.youtube.com/watch?v=ysz5S6PUM-U
  - image: https://picsum.photos/seed/customer-service-m5-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - learning_material: https://edu.gcfglobal.org/en/

## Course 3: Basic Data Entry and Records Management

- Category: Technical Skills
- Level: Beginner
- Duration: 11 hours
- Skill tags: Data Entry, Computer Basics, Digital Literacy
- Topic tags: Data Management, Digital Literacy
- Industry tags: Administration, Logistics
- Career paths: Data Encoder, Records Assistant
- Thumbnail: https://picsum.photos/seed/data-entry-course/1200/675

### Module 1: Clean Data Entry Habits
- Content blocks:
  - text: Accuracy habits, checklists, and double-entry review.
  - image: https://picsum.photos/seed/data-entry-m1-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - learning_material: https://edu.gcfglobal.org/en/
  - quiz: Multiple choice and true/false on data quality.

### Module 2: Working With Tables and Fields
- Content blocks:
  - text: Rows, columns, identifiers, and required fields.
  - code: Record ID, Full Name, Contact Number, Date Submitted
  - video: https://www.youtube.com/watch?v=aqz-KE-bpKQ
  - image: https://picsum.photos/seed/data-entry-m2-image/1200/675
  - quiz: Short answer on choosing useful field names.

### Module 3: Common Validation Checks
- Content blocks:
  - text: Date format checks, duplicate spotting, and missing value review.
  - image: https://picsum.photos/seed/data-entry-m3-image/1200/675
  - learning_material: https://developer.mozilla.org/en-US/docs/Learn
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: True/false and multiple choice on validation rules.

### Module 4: Organizing Digital Records
- Content blocks:
  - text: Folder structure, naming, and retention basics.
  - video: https://www.youtube.com/watch?v=ScMzIvxBSi4
  - image: https://picsum.photos/seed/data-entry-m4-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: Essay on setting up a records repository.

### Module 5: Reporting Errors and Corrections
- Content blocks:
  - text: Issue logs and correction workflow.
  - code: Error type | Record ID | Reported by | Correction status
  - image: https://picsum.photos/seed/data-entry-m5-image/1200/675
  - learning_material: https://www.atlassian.com/work-management/productivity
  - quiz: Short answer and essay on error handling.

## Course 4: Entrepreneurship Planning Basics

- Category: Entrepreneurship
- Level: Beginner
- Duration: 14 hours
- Skill tags: Business Planning, Communication, Financial Literacy
- Topic tags: Entrepreneurship Fundamentals, Financial Literacy, Marketing Strategy
- Industry tags: Microenterprise, Retail
- Career paths: Small Business Owner, Business Assistant
- Thumbnail: https://picsum.photos/seed/entrepreneurship-course/1200/675

### Module 1: Identifying a Business Problem
- Content blocks:
  - text: Problem-solution framing for local business ideas.
  - video: https://www.youtube.com/watch?v=HluANRwPyNo
  - image: https://picsum.photos/seed/entrepreneurship-m1-image/1200/675
  - learning_material: https://www.microsoft.com/en-us/microsoft-365/business-insights-ideas/resources
  - quiz: Multiple choice and essay on a sample community problem.

### Module 2: Knowing Your Customers
- Content blocks:
  - text: Basic customer profile and needs mapping.
  - image: https://picsum.photos/seed/entrepreneurship-m2-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - learning_material: https://edu.gcfglobal.org/en/
  - quiz: True/false and short answer on customer segmentation.

### Module 3: Writing a Simple Value Proposition
- Content blocks:
  - text: A simple formula for writing value statements.
  - code: We help <customer> achieve <benefit> through <solution>.
  - image: https://picsum.photos/seed/entrepreneurship-m3-image/1200/675
  - quiz: Short answer on value proposition drafting.

### Module 4: Basic Costs and Pricing
- Content blocks:
  - text: Fixed cost, variable cost, and markup basics.
  - video: https://www.youtube.com/watch?v=ysz5S6PUM-U
  - image: https://picsum.photos/seed/entrepreneurship-m4-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: Multiple choice and true/false on pricing logic.

### Module 5: Pitching the Idea Clearly
- Content blocks:
  - text: Short pitch structure and speaking points.
  - video: https://www.youtube.com/watch?v=jNQXAC9IVRw
  - image: https://picsum.photos/seed/entrepreneurship-m5-image/1200/675
  - learning_material: https://support.google.com/docs
  - quiz: Essay pitch prompt with manual review.

## Course 5: Hospitality Service Readiness

- Category: Hospitality & Tourism
- Level: Beginner
- Duration: 13 hours
- Skill tags: Customer Service, Communication, Computer Basics
- Topic tags: Hospitality Service, Customer Relations, Career Readiness
- Industry tags: Hospitality, Tourism
- Career paths: Service Crew, Front Desk Staff
- Thumbnail: https://picsum.photos/seed/hospitality-course/1200/675

### Module 1: Welcoming Guests Professionally
- Content blocks:
  - text: Greeting standards and appearance expectations.
  - video: https://www.youtube.com/watch?v=aqz-KE-bpKQ
  - image: https://picsum.photos/seed/hospitality-m1-image/1200/675
  - learning_material: https://www.atlassian.com/work-management/productivity
  - quiz: Multiple choice and true/false on guest reception.

### Module 2: Taking Requests Accurately
- Content blocks:
  - text: Confirming requests and avoiding miscommunication.
  - image: https://picsum.photos/seed/hospitality-m2-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: Short answer and essay on handling special requests.

### Module 3: Service Recovery in Busy Hours
- Content blocks:
  - text: Prioritizing safety, speed, and courtesy under pressure.
  - video: https://www.youtube.com/watch?v=ScMzIvxBSi4
  - image: https://picsum.photos/seed/hospitality-m3-image/1200/675
  - learning_material: https://edu.gcfglobal.org/en/
  - quiz: Essay scenario on delayed service.

### Module 4: Recording Guest Information
- Content blocks:
  - text: Basic logs for reservations and service notes.
  - code: Guest name | Request | Time | Follow-up needed
  - image: https://picsum.photos/seed/hospitality-m4-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: Multiple choice on complete log entries.

### Module 5: Team Coordination and Handover
- Content blocks:
  - text: Shift updates, incomplete tasks, and handover clarity.
  - video: https://www.youtube.com/watch?v=HluANRwPyNo
  - image: https://picsum.photos/seed/hospitality-m5-image/1200/675
  - learning_material: https://developer.mozilla.org/en-US/docs/Learn
  - quiz: True/false and short answer on handover practice.

## Course 6: Construction Site Safety Awareness

- Category: Construction & Trades
- Level: Beginner
- Duration: 15 hours
- Skill tags: Construction Safety, Communication
- Topic tags: Construction Safety, Career Readiness
- Industry tags: Construction, Skilled Trades
- Career paths: Site Helper, Safety Aide
- Thumbnail: https://picsum.photos/seed/construction-safety-course/1200/675

### Module 1: Hazard Identification Basics
- Content blocks:
  - text: Common site hazards and unsafe conditions.
  - video: https://www.youtube.com/watch?v=ysz5S6PUM-U
  - image: https://picsum.photos/seed/construction-m1-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: Multiple choice and true/false on hazard spotting.

### Module 2: Personal Protective Equipment
- Content blocks:
  - text: PPE selection and correct usage reminders.
  - image: https://picsum.photos/seed/construction-m2-image/1200/675
  - learning_material: https://edu.gcfglobal.org/en/
  - quiz: Short answer on choosing PPE for a task.

### Module 3: Safe Movement and Housekeeping
- Content blocks:
  - text: Clear walkways, material storage, and tool handling.
  - video: https://www.youtube.com/watch?v=aqz-KE-bpKQ
  - image: https://picsum.photos/seed/construction-m3-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: True/false and essay on preventing slips and trips.

### Module 4: Reporting Incidents Promptly
- Content blocks:
  - text: Reporting chain and essential incident details.
  - code: Incident date | Location | Hazard | Immediate action taken
  - image: https://picsum.photos/seed/construction-m4-image/1200/675
  - learning_material: https://www.atlassian.com/work-management/productivity
  - quiz: Multiple choice on incident report completeness.

### Module 5: Safety Briefings and Team Responsibility
- Content blocks:
  - text: Toolbox talks and shared responsibility on site.
  - video: https://www.youtube.com/watch?v=jNQXAC9IVRw
  - image: https://picsum.photos/seed/construction-m5-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: Essay on how a team should respond to repeated unsafe behavior.

## Course 7: Creative Design Content Basics

- Category: Creative & Design
- Level: Beginner
- Duration: 12 hours
- Skill tags: CSS, Communication, Digital Literacy
- Topic tags: Creative Design, Marketing Strategy, Digital Literacy
- Industry tags: Marketing, Media
- Career paths: Design Assistant, Social Media Staff
- Thumbnail: https://picsum.photos/seed/creative-design-course/1200/675

### Module 1: Visual Hierarchy and Layout
- Content blocks:
  - text: Contrast, spacing, and alignment basics.
  - image: https://picsum.photos/seed/creative-design-m1-image/1200/675
  - learning_material: https://developer.mozilla.org/en-US/docs/Learn
  - quiz: Multiple choice and short answer on layout decisions.

### Module 2: Working With Brand Colors and Type
- Content blocks:
  - text: Basic color consistency and font pairing.
  - code: color: #1f4b99; font-size: 18px; font-weight: 700;
  - image: https://picsum.photos/seed/creative-design-m2-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: True/false on readable combinations.

### Module 3: Preparing Images for Simple Campaigns
- Content blocks:
  - text: Crop, aspect ratio, and readability considerations.
  - video: https://www.youtube.com/watch?v=ScMzIvxBSi4
  - image: https://picsum.photos/seed/creative-design-m3-image/1200/675
  - learning_material: https://support.google.com/docs
  - quiz: Multiple choice and essay on image selection.

### Module 4: Writing Caption and Call-to-Action Copy
- Content blocks:
  - text: Matching short copy with visual intent.
  - image: https://picsum.photos/seed/creative-design-m4-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - learning_material: https://www.microsoft.com/en-us/microsoft-365/business-insights-ideas/resources
  - quiz: Short answer on stronger calls to action.

### Module 5: Presenting a Small Creative Concept
- Content blocks:
  - text: Packaging a small concept into a review-ready presentation.
  - video: https://www.youtube.com/watch?v=HluANRwPyNo
  - image: https://picsum.photos/seed/creative-design-m5-image/1200/675
  - document: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  - quiz: Essay prompt describing a small campaign concept and rationale.

## Content Block Coverage Summary

- text: Present in every module
- code: Used in Courses 1, 2, 3, 4, 5, 6, and 7
- video: Used across all 7 courses
- image: Present in every module
- quiz: Present in every module
- document: Used across all 7 courses
- learning_material: Used across all 7 courses

## Assessment Coverage Summary

- multiple_choice: Used across all 7 courses
- true_false: Used across all 7 courses
- short_answer: Used across all 7 courses
- essay: Used across all 7 courses

## Suggested Population Notes

- Keep all courses published after creation so they are visible to trainees.
- Set each module status to finalized after content blocks are added.
- For modules using only quiz content blocks, make sure each gradable quiz block has points and a correct answer where required.
- For short-answer and essay questions, expect manual review workflows where applicable.