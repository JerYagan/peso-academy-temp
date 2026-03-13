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