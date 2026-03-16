# Practice Quiz Scoring And Text Blocks Checklist

## Scope
- Add a separate scoring model for practice quizzes inside module content.
- Ensure bullet lists and numbered lists work properly in module content text blocks.
- Confirm whether trainer/admin review for essay-type practice quiz blocks is currently implemented.

## Practice Quiz Scoring
- [x] Define the learner-facing scoring behavior for inline practice quizzes.
- [x] Add an optional points field to each practice quiz block in module authoring.
- [x] Keep practice quiz scores separate from graded assessment scores, attempts, and completion criteria.
- [x] Show a clear per-question result and an overall practice score summary after submission or retry.
- [x] Decide whether the score should be shown as raw points, percentage, or both.
- [x] Decide whether essay-type practice quiz items should be excluded from the practice score or counted as pending/manual items.
- [x] Use quiz block points to calculate total earned points out of total possible points for the learner's practice quiz summary.
- [x] Keep the points field formative-only so it never affects course completion, graded assessment scores, or official reporting.
- [x] Keep unlimited retry behavior for practice quizzes without affecting graded assessments.
- [x] Confirm that practice quiz scoring remains formative-only and does not alter course completion readiness.
- [x] Add trainer/admin visibility only if needed for analytics, without mixing practice scores into formal assessment reporting.

### Practice Quiz Score Summary Notes
- The practice quiz summary should be separate from the graded assessment experience.
- The summary can show total points earned, total points possible, percentage score, and per-question feedback.
- Essay questions currently appear as formative reflection counts and are excluded from the automatic score.
- Trainer/admin visibility now reads the latest formative practice summary from module session metadata.
- Practice quiz snapshots are informational only and do not write into assessment attempts, reporting scores, or completion status.

## Text Block Lists And Spacing
- [x] There's a problem in text editor where the bullet list and numbered list is not applying to texts.
- [x] Ensure bullet points created in text blocks render correctly in learner view.
- [x] Ensure numbered lists created in text blocks render correctly in learner view.
- [x] Ensure bullet points and numbered lists render correctly in module preview.
- [x] Verify nested list indentation and spacing in text blocks.
- [x] Preserve blank paragraphs so double spacing remains visible in learner view.
- [x] Preserve blank paragraphs so double spacing remains visible in module preview.
- [x] Test legacy plain-text text blocks to confirm they do not break list formatting expectations.

### Text Block Notes
- The text editor now applies explicit bullet-list and numbered-list styling in the authoring surface.
- Learner view and module preview now use consistent list indentation, nested list markers, list spacing, and blank-paragraph spacing.
- Legacy plain-text text blocks that contain bullet or numbered lines are normalized into HTML lists during parsing.

## Essay Review Status Check
- [x] Product decision made: essay responses inside practice quiz blocks should enter a trainer/admin review workflow.
- [x] Current implementation check completed.

## Practice Quiz Essay Review Feature
- [x] Add a separate trainer/admin review feature for practice quiz essay answers.
- [x] Keep this review flow separate from the existing graded assessment essay review workflow.
- [x] Ensure trainer/admin feedback on practice quiz essays is formative-only and does not affect official assessment records.
- [x] Ensure trainer/admin feedback on practice quiz essays does not affect course completion status.
- [x] Decide whether the review surface should live in the admin/trainer learners page or in a dedicated practice quiz review dashboard.
- [x] Show only practice quiz essay responses in this review flow, not graded assessment essays.
- [x] Allow trainers/admins to leave feedback comments without pass/fail or approval/rejection decisions.
- [x] Decide how reviewed practice quiz essay feedback is shown back to the learner.
- [x] Keep practice quiz essay scoring, if any, separate from graded assessment scoring and certificate/completion logic.

### Current Status
- Inline practice quiz essays now save into a separate formative review workflow.
- Learners receive staff comments back inside the same module essay block.
- Trainer/admin essay review for graded assessments still exists separately and is unchanged.
- Trainer/admin can now see the latest formative practice quiz snapshot in learner and enrollment progress views.

## Suggested Acceptance Criteria
- [ ] Learners can answer practice quizzes and see a separate practice score without affecting graded assessment records.
- [ ] Graded assessments remain the only quiz/essay scores that contribute to formal completion and review workflows.
- [x] Practice quiz essay responses can be reviewed by trainers/admins in a separate formative workflow if that feature is approved.
- [x] Practice quiz essay feedback never changes official assessment status, course completion, or certificate eligibility.
- [ ] Bullet lists and numbered lists display correctly in both learner view and preview.
- [ ] Double spacing in text blocks remains visible after save, reload, preview, and learner rendering.
- [x] If practice quiz essay review is approved as a feature, the workflow is implemented explicitly rather than implied by existing graded assessment behavior.

- Multiple choices and true or false answers should be saved as well in case the learner's network got interrupted.
- It should auto calculate the score for multiple choice and true or false questions, but not for essay questions since they require manual review.
- Address the learner's page loading issue

- In learners page, trainer and admin can set the score for each learner's essays based on the points defined for that essay question in the module creation/content. The essay score will be added to the practice quiz score for that learner, but it will not affect the graded assessment score or course completion status. The practice quiz score will be shown in the learner's progress page and can be used for formative feedback and self-assessment purposes.
- In learners page, every essay doesn't need a feedback comment.
- Module reviews should have a dedicated page just like assessment reviews. But both reviews should be accessible from the learner progress page. The module review page should only show the essay questions from practice quizzes and their corresponding feedback comments, while the assessment review page should only show the essay questions from graded assessments and their corresponding feedback comments. This way, trainers and admins can easily distinguish between formative practice quiz feedback and summative graded assessment feedback when reviewing learner progress.
- Right now learners page in trainer/admin is very confusing to navigate, improve its UI/UX to make it easier for trainers and admins to find the information they need and perform their tasks efficiently. Consider adding filters, search functionality, clear labels, and a more intuitive layout to enhance the user experience.

- Clicking Complete Module should save the practice quiz score, the answers (multiple choices & true or false), and the essay responses, and then update the learner's progress accordingly. The practice quiz score should be calculated based on the points defined for each question in the module content, and it should be stored separately from the graded assessment score. The learner's progress should reflect the completion of the module and the practice quiz, but it should not affect their overall course completion status or certificate eligibility.

- In a different markdown, write a plan to make the course page load faster, more stable (less laggy as we're going through the course), and it should render the content blocks without derendering them after a while. The course page should also be able to handle a large amount of content blocks without crashing or freezing. Consider implementing lazy loading or virtual scrolling for the content blocks to improve performance and user experience.