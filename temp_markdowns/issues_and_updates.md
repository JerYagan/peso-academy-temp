<!--
User credentials:
- Admin: admin@peso.academy
- Trainer: trainer@peso.academy
- Jobseeker: jobseeker@peso.academy
- Validator: validator@peso.academy
 -->

### System
- [ ] Landing page: there are still some icons with white/transparent bg

### Admin & Trainer & Trainee

### Admin

### Course/Module Creation
- [ ] Add others in course category dropdown and add a note to choose the closest approved skill and topic tags for reporting and recommendations to work properly.

### Registration
- [ ] Registered account goes to Auth but not in the users table. This causes issues for admin when trying to manage users and for trainers when trying to assign courses to users.

### Trainer & Admin & Course Creation

## Revision:
- [ ] Create a markdown plan (in temp_markdowns) to implement these changes in the system
- [ ] Now there are 2 types of trainee, PESO Client and PESO Employee. Before registration, the user should be asked if they are a PESO Client or PESO Employee. This will help to categorize the users better and also help the trainers to assign the relevant courses to the users based on their category.
- [ ] There registration flow for PESO Employee should be different from PESO Client. For PESO Employee, they should be asked to enter their employee ID and Physical ID and the Admin and Trainers should be able to verify it before allowing them to register. This will ensure that only valid employees can register and access the courses.
- [ ] PESO Employee should still be able to register their credentials and onboarding process but their email should be different (PESO domain email) than PESO Client (@gmail, @yahoo, etc.) to easily differentiate between the two types of users in the system.
- [ ] Both PESO Client and PESO Employee should have the same access to courses and modules, but they cannot take courses if their account is not verified by the admin or trainer. This will ensure that only valid users can access the courses and also help to maintain the integrity of the system.
- [ ] Also, make the onboarding process for trainees (PESO Client and PESO Employee) after the registration process, once they're in the dashboard a modal should pop up to guide them through the onboarding process and also to encourage them to complete their profile and start taking courses. This will help to improve the user experience and also increase the engagement of the users with the platform.


## Regarding the quiz and assessment
- [ ] Assessment section in module creation tab should not exists because the quiz blocks in the content tab should be the source of truth for the assessment questions and answers. The current setup creates confusion and extra work for the trainers because they have to enter the same information in two different places. Removing the separate assessment section will streamline the authoring process and reduce the chances of discrepancies between quiz content and recorded assessments.

### Admin & Trainer
- [ ] In admin, can you make a category and tag management which the admin and trainer can manage (Add, Edit, Delete) the categories and tags for the courses and modules. This will help to organize the courses and modules better and also help the trainers to find the relevant courses and modules easily.
- [ ] In the creation and editing of courses and modules, instead of using dropdown for categories and tags, can you make it a searchable dropdown which can show the existing categories and tags and also allow the admin and trainer to add new categories and tags on the fly. This will improve the user experience and also help to maintain the consistency of categories and tags across the platform.

### Trainer
- [ ] Viewing progress modal should be vertically scrollable

### Trainee
- [ ] Loading time for courses and modules should be optimized, especially for users with slower internet connections
- [ ] Prevent the certificate from being generated twice (in case the user click mark as complete twice)

### Courses Module
- [ ] Learners Enrolled shows 0 even though there are learners enrolled in the course

## Create a markdown plan to implement the following changes in the system, make it a phase by phase implementation plan:
- [x] Plan created in `temp_markdowns/assessment_workflow_and_platform_updates_plan.md`
- [ ] Add a new quiz type which is Essay, where the trainee can write a long answer and the trainer can review and give feedback on it. This will allow for more in-depth assessment of the trainee's understanding of the course material and also provide an opportunity for personalized feedback from the trainer.
- [ ] No automated certificate due to the trainer needing to validate the essay in every course needed
- [ ] Duration (hours) - recommended to be removed to lessen the pressure for trainees
- [ ] Admin should also be able to see the progress of each user (similar to trainer side) in the enrollment management page, this is to help the admin to monitor the progress of the trainees and also to identify if there are any issues with the courses or modules that need to be addressed. 
- [ ] Add a functionality where if trainee finished a course, even under the stated hours or duration of the course, it should still record the hours stated in the course, this is to help the trainees to not feel pressured to complete the course within a certain time frame and also to help the trainers to assess the average time completed for each course.
- [ ] New Features recommendation: Enlistment of Courses due to face-to-face learning
- [ ] New features recommendation: Pre-Filtering/Approval of certain courses to specific type of people
- [ ] The system should be able to switch between English and Tagalog language, this is to cater to the different types of users and also to improve the accessibility of the platform for users who are more comfortable with Tagalog.
- [ ] The modules needs to be grayed/pre-requisite in order to proceed
- [ ] The quiz should be shuffled every attempt, and should not be copy and pasted
- [ ] Remove mark as complete in trainee side, it should be handled by trainers, this is to ensure that the trainees have completed the course and also to provide an opportunity for the trainers to give feedback and guidance to the trainees before marking the course as complete.
- [ ] Change the on boarding assessment from registration to after registration, once they're in the dashboard a modal should pop up to guide them through the onboarding process and also to encourage them to complete their profile and start taking courses. This will help to improve the user experience and also increase the engagement of the users with the platform. The only thing that is in the registration process is the basic information needed for the account creation and the categorization of the users (PESO Client or PESO Employee) and the verification of the PESO Employees. This will help to streamline the registration process and also to ensure that only valid users can access the platform.
- [ ] Verify if all the texts in the system uses varchar and the phone should limit to 11 digits, standardize using 09 for the phone number format


---

## UI Changes
- [ ] Landing, Login, Register page: hero logo of PESO Academy should use logo_dark.png when in dark mode, and logo.png in light mode
- [ ] Landing, Login, Register page: there are some texts with low contrast when in dark mode, please adjust the contrast to make it more readable
### Admin & Trainee
- [ ] In the review modal, only the essay should be graded. Other quiz types (multiple choice, true or false) should be automatically graded and the results should be shown in the progress page. This will help to streamline the grading process for the trainers and also provide immediate feedback to the trainees for the automatically graded quiz types.

- [x] Address the critical gap where both the admin and trainer cannot review and verify learner's module progress and quiz result, they should be able to mark the trainee's module as complete and also review the quiz results to ensure that the trainee has completed the course and also to provide an opportunity for the trainers to give feedback and guidance to the trainees before marking the course as complete.

### Admin
- [x] Make the View Progress modal of admin better organized and visually appealing, also make it vertically scrollable to accommodate for more courses and modules. It's way too cramped for such a small modal

### Courses/Modules population
- [ ] Via browser interaction, populate courses and modules with a variety of content and assessment types to ensure the system can handle different scenarios and to provide a rich dataset for testing and demonstration purposes. This will also help to identify any issues or bugs in the course and module creation process and also to ensure that the courses and modules are properly displayed and accessible to the trainees. Use generic youtube videos, image links, and reference materials for the content blocks, and create a variety of quiz questions (multiple choice, true or false, short answer, essay) to test the different assessment functionalities of the platform.
- [ ] Make at least 10 courses with at least 5 modules each, and populate them with content and assessments to create a comprehensive dataset for testing and demonstration purposes.

### Trainee
- [x] Revert back the decision to move the recommendation section to the browse courses page, it should be in the dashboard because it's more personalized and relevant to the trainees based on their progress and profile. Also fix the layout of the Browse Courses page. View Certificates at the bottom doesn't have texts. Verification Pending message should be above the Search Section
- [x] Learner Top Navigation: Remove the dropdown, move the Progress and Certifications to the top navigation.
- [x] Onboarding modal: the whole modal should be scrollable except the buttons at the bottom
- [x] Onboarding modal: bring back the header but don't make it too large, also add a progress bar to indicate the progress of the onboarding process. This will help to improve the user experience and also make the onboarding process more engaging for the trainees.
- [x] Move course recommendations from dashboard to browse courses page and make it more prominent, this will help the trainees to easily find the relevant courses and also to encourage them to take more courses. Also, verify if the recommendation algorithm is working properly and providing relevant course recommendations to the trainees based on their profile and progress.
- [x] Trainees should be able to see the list of recommended course after onboarding process
- [x] Dashboard & Browse Course: Remove the "Primary next-step section"
- [x] Browse Course: Remove the duplicate filters and move the search bar above the course cards
- [x] Home page: Change the "Account" link to "Register" label
- [x] Footer: Remove the Contact and the details below it
- [x] Onboarding modal: Completely remove the header section, remove the recommendation signal coverage, recommendation unlock section, Make the tabs more prominent (make them full width)
- [x] You brought back the large onboarding header, can we adjust it to be smaller and more concise? There's only a little room for the content and it looks off when the header takes up too much space to the point that I cannot see the submit button. Also make sure that the buttons at the bottom are always visible and not cut off by the header. This will help to improve the user experience and also make the onboarding process more engaging for the trainees.
- [x] Remove the languages option in the top navigation
- [x] Dashboard: Declutter the dashboard or at least make it more organized. Move the statistics section below or in another tab and prioritize the "Continue Learning" section and other necessary actions for the trainees.
- [x] Dashboard: Remove the Next-step shortcuts and add a tab that organizes and categorizes the different sections in the dashboard

- [x] Onboarding modal: Declutter onboarding modal remoce the unecessary helper or at least make it more concise and organized. Improve the selection UI in the Readiness section. In skill section, make the skills searchable based on the existing tags (taxonomy) in the system and also allow the trainees to add new skills if they cannot find the relevant skills in the existing tags.
- [ ] QA pass later: run a focused trainee UI/regression pass after this implementation batch for onboarding, dashboard, profile, browse courses, progress, certificates, module navigation, and theme/language switching.
- [x] Onboarding modal: Adjust the very large header section to be smaller and more concise. There's only a little room for the content and it looks off when the header takes up too much space to the point that I cannot see the submit button. This will help to improve the user experience and also make the onboarding process more engaging for the trainees.
- [x] Onboarding modal: Fix the tab section, the layout gets messed up when selecting a different tab. Also, fix the dark mode issue (See photo). Also increase the contrast of the texts.
- [x] Onboarding module: Onboarding is a necessary process for the trainees to understand how to use the platform and also to encourage them to complete their profile and start taking courses. Trainees should not be able to skip the onboarding process because it contains important information and guidance for the trainees to navigate the platform and also to understand the benefits of completing their profile and taking courses.
- [x] Profile page: Improve the layout of the profile page to make it more organized and visually appealing. Remove the profile routing section. Decrease the size of the "Next Profile Action" section (and completely remove it once the trainee has completed all the profile actions).
- [x] Browse courses page: Add a search and filter functionality to help the trainees to find the relevant courses easily. Also, improve the layout of the courses page to make it more organized and visually appealing.
- [x] Browse courses page: Remove Course Catalog, Recommendation Readiness, When to use this page sections. But keep the "View Progress" button and make it more prominent.
- [x] Dashboard: Declutter the dashboard or at least make it more organized. Move the statistics section below or in another tab and prioritize the "Continue Learning" section and other necessary actions for the trainees.
- [x] Certifications page: Remove Excellent badge
- [x] Module page: Make the modules list on the left side sticky so that the trainees can easily navigate between modules without having to scroll back up to the top of the page.
- [x] Top navigation: Add Progress page in the top navigation for easy access to the progress page where the trainees can see their.
- [x] Progress page: View Details button doesn't lead to the Detailed Views tab, also Detailed View should be a modal rather than a separate section so remove the Detailed Views tab and make it a modal that pops up when the trainee clicks the "View Details" button. This will help to improve the user experience and also make it easier for the trainees to access their progress details without having to navigate to a different page.
- [x] Progress page: Verify if the total time accounts for the actual time spent or just the stated hours in the course, it should be the stated hours in the course to help the trainees to not feel pressured to complete the course within a certain time frame and also to help the trainers to assess the average time completed for each course.
- [x] There's a delay in switching language/theme, use a loader or make it instant to improve the user experience.

<!-- 

Trainer's Section:

- Essays - Still Needs Validation 
- No automated certificate due to they need to validate the essay in every course needed
- Duration (hours) - recommended to be removed to lessen the pressure for trainees
- New Features recommendation: Enlistment of Courses due to face-to-face learning
- New features recommendation: Pre-Filtering/Approval of certain courses to specific type of people
- New features recommendation: PESO Employees different sign up page due to PESO Employees has different modules/courses, needs employee id
- New features recommendation: Preview progress of trainee in Enrollment Management of Admin account 
- When the course is complete, it should show the duration of hours overall to assess the average time completed


Assessment of Google Form:

- Needs to send Memo through email through employees to answer the Peso Academy forms
- Their target users is internal employees
- Long Module
- Some module needs face to face
- Google forms needs visual like video and pictures
- The system needs the saved progress even if refreshed or lost connection
- The duration of hours makes them pressured and needs to be removed 
- they made Peso Academy based on Internal approach 
- It is based on conducted trainings and looking for an intervention

General Section:

- Change language: English and Tagalog

Trainee's Section

Modules Page:

- The modules needs to be grayed/pre-requisite in order to proceed
- The quiz should be shuffled every attempt, and should not be copy and pasted
- The "mark as completed" should be handled by trainers

Registration Page:

- The name should be validated as text only, not text and numbers
- The details must be filled before proceeding to the next page

 -->