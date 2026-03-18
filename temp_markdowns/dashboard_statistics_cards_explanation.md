# Dashboard Statistic Cards Explained

## Why this document exists

This document explains the statistic cards and analytics sections shown in the trainer and admin dashboards in plain English.

It is meant to answer four practical questions:

1. What is each card trying to tell us?
2. What data is used to produce it?
3. Why does it matter to the system and to the people using the system?
4. What does a high, low, or zero value usually mean?

This is intentionally written in simple language first, with technical details added where they help.

## The big picture

The dashboards are not just there to show numbers. They are there to help people decide what to do next.

For trainers, the dashboard should help answer questions like:

- Which learners need follow-up?
- Which courses are doing well?
- Which modules are confusing or too difficult?
- Are course recommendations actually helping learners move forward?

For admins, the dashboard should help answer questions like:

- Is the platform healthy overall?
- Are enrollments turning into completions and certificates?
- Are learners staying active?
- Which courses or learners are becoming risky before things get worse?
- Are recommendations working across the platform?

For learners, these cards matter indirectly even when learners do not see every admin or trainer dashboard card themselves. When staff can read the analytics correctly, learners benefit from:

- faster intervention when they are stuck,
- better course design,
- more relevant recommendations,
- fairer monitoring,
- quicker review of issues,
- more stable completion and certification flows.

## Main data used by these cards

The dashboard cards pull from several different kinds of records. Each metric is built from one or more of these sources.

### 1. Users

This is the list of people in the system.

Used for:

- total users,
- learner identity lookup in watchlists and recent session activity.

Why it matters:

- It gives scale. A completion rate of 80% means something very different if it comes from 5 people versus 5,000 people.

### 2. Courses

This is the catalog of training content.

Used for:

- total courses,
- course titles shown in charts and top-course summaries,
- trainer course portfolio analytics.

Why it matters:

- Courses are the containers around the learning experience. Most operational decisions happen at the course level first.

### 3. Enrollments

This is the record that a learner is taking a course.

Used for:

- total enrollments,
- completion rate,
- average progress,
- joined this month,
- completed this month,
- cohort distribution,
- top course activity,
- risk and intervention indicators.

Important detail:

- Many cards treat an enrollment as completed if its status is `completed` or if its progress is 100.

Why it matters:

- Enrollment data is the backbone of most learning analytics. It tells the system who started, who is progressing, who finished, and who may be falling behind.

### 4. Assessment attempts

These are quiz or assessment submissions with recorded scores.

Used for:

- average assessment score,
- monthly score trends,
- course comparison charts,
- module quality insights,
- failure rate indicators.

Important detail:

- Only scored attempts are included in the score averages. Null or missing scores are excluded.

Why it matters:

- Assessment scores are the clearest direct signal of whether learners understand the material.

### 5. Module sessions

These are learning session records showing when a learner opened a module and how long they stayed.

Used for:

- active learners in the last 7 or 30 days,
- learning time totals,
- average learning time per course,
- at-risk short-session patterns,
- recent session activity,
- disengagement analysis.

Why it matters:

- Session data shows behavior, not just outcomes. It can reveal friction before failure appears in completion or assessment numbers.

### 6. Module completions

These are records showing module completion and stored time spent.

Used for:

- total learning time captured,
- module-level completion coverage,
- monthly completion-related time aggregation.

Important detail:

- In some admin calculations, session time and completion time are compared month by month and the larger value is used to avoid undercounting or double counting.

Why it matters:

- Module completions show where progress is actually being converted into finished learning steps.

### 7. Certificates

These are issued credentials after successful course completion.

Used for:

- certificates issued,
- monthly certificate trends,
- top course certification context.

Why it matters:

- Certificates are one of the clearest outcome metrics because they represent completed, recognized training.

### 8. Learner recommendations

These are persisted recommendation rows used to track recommendation delivery and response.

Used for:

- impressions,
- click-through behavior,
- accept rate,
- predicted acceptance probability,
- recommendation-originated enrollments,
- recommendation-originated completions,
- recommendation winners.

Important detail:

- The dashboards aggregate recommendation rows rather than guessing from page visits alone.
- Shared recommendation analytics for admin and trainer are built through the same aggregation helper so they are supposed to be comparable when they are looking at the same underlying recommendation rows.

Why it matters:

- Recommendations only matter if they cause useful action. These analytics measure whether suggested learning paths are actually being seen, clicked, accepted, and completed.

### 9. Course risk scores

These are stored predictive snapshots for course-level risk.

Used for:

- high-risk courses,
- average course risk score,
- highest course risk lists,
- predictive risk charts.

Why it matters:

- These scores are early-warning signals. They are useful precisely because they can look bad before the completion numbers collapse.

### 10. Learner disengagement scores

These are stored predictive snapshots for learner-level disengagement.

Used for:

- high-risk learners,
- average disengagement score,
- learner watchlists.

Why it matters:

- A disengagement score helps staff spot learners who may silently disappear unless someone intervenes.

## A very important scope rule

Before reading any metric, always ask: "What is the scope of this number?"

There are two main scopes in these dashboards:

### Admin scope

Admin cards are intended to be organization-wide or platform-wide.

That means they usually answer:

- What is happening across the whole system?
- How healthy is the platform overall?

### Trainer scope

Trainer cards are intended to be limited to the trainer's visible or managed courses.

That means they usually answer:

- What is happening in the courses this trainer is responsible for?
- Which learners or modules need action inside this trainer's portfolio?

Why this matters:

- A trainer number should not automatically be expected to match an admin number unless both are deliberately looking at the same population and the same source records.
- If the platform wants trainer and admin recommendation stats to match for a shared dataset, both dashboards must aggregate the same recommendation rows with the same scope rules.

## Trainer dashboard cards and what they mean

## 1. Unique learners

Plain English meaning:

- How many different learners are enrolled across the trainer's visible courses.

What data is involved:

- Enrollment records.
- Learner IDs are deduplicated, so one learner enrolled in multiple courses still counts once.

Purpose:

- To show the real size of the trainer's learner population.

Why it matters to the system:

- It helps estimate teaching load, support demand, and how widely the trainer's courses are being used.

Why it matters to users:

- Trainers can tell whether they are supporting a small focused cohort or a large spread of learners.
- Learners benefit because staffing and intervention decisions depend on this scale.

How to interpret it:

- High value: broad learner reach, but possibly more support pressure.
- Low value: smaller audience, which may be fine for specialized courses.

## 2. Average assessment score

Plain English meaning:

- The average score across scored assessment attempts tied to the trainer's course set.

What data is involved:

- Assessment attempts with numeric scores.
- Null or missing scores are excluded.

Purpose:

- To show overall learner performance quality.

Why it matters to the system:

- It is one of the best signals for content effectiveness and assessment fairness.

Why it matters to users:

- Trainers can quickly see if learners are generally understanding the material.
- Learners benefit because low averages can lead to clearer teaching, better remediation, or better assessments.

How to interpret it:

- High value: good understanding, easy assessment, or both.
- Low value: weak understanding, unclear content, or possibly poor assessment design.

## 3. Avg learning time per course

Plain English meaning:

- The average amount of tracked session time spent across the trainer's course portfolio.

What data is involved:

- Module session duration values.
- The trainer calculation divides total session hours by the number of visible courses.

Purpose:

- To show how much learner time the trainer's courses are consuming on average.

Why it matters to the system:

- This helps identify whether courses are being actively used and whether some portfolios are unusually heavy or unusually light.

Why it matters to users:

- Trainers can compare whether their courses are engaging, ignored, or possibly too long.
- Learners benefit because unusually long time can signal confusing material, while very low time can signal disengagement or shallow use.

How to interpret it:

- Very low value: learners may not be engaging deeply, or the course may be short.
- Very high value: can mean strong engagement, but can also mean friction or confusion.

## 4. Certificates issued

Plain English meaning:

- How many certificates have been released for courses in the trainer's scope.

What data is involved:

- Certificate issue records tied to the trainer's courses.

Purpose:

- To show completed learning outcomes, not just participation.

Why it matters to the system:

- It is a strong outcome metric that reflects end-to-end success.

Why it matters to users:

- Trainers can see whether their courses are actually producing recognized completions.
- Learners benefit because certificate throughput can reveal whether something in the course path is blocking completion.

How to interpret it:

- High value: strong completion pipeline.
- Low value: may indicate low enrollment, low completion, or blocked certification conditions.

## 5. Training performance trends

Plain English meaning:

- A month-by-month view of new enrollments, completed enrollments, and average assessment score.

What data is involved:

- Enrollment dates.
- Completion dates.
- Assessment submission dates and scores.

Purpose:

- To show direction, not just a single snapshot.

Why it matters to the system:

- Trends are better than one-off totals because they show momentum.

Why it matters to users:

- Trainers can see whether performance is improving, flattening, or slipping.
- Learners benefit because rising risk can be handled earlier when trends are visible.

How to interpret it:

- Rising enrollments with flat completions can mean growing backlog.
- Rising completions with stable scores is usually healthy.
- Rising enrollments with falling scores can mean scaling problems.

## 6. Joined this month

Plain English meaning:

- The number of enrollments created during the current month.

What data is involved:

- Enrollment `enrolled_at` dates.

Purpose:

- To show fresh demand entering the trainer's course portfolio.

Why it matters to the system:

- It helps measure intake and planning needs.

Why it matters to users:

- Trainers can quickly see how much new learner traffic is arriving now, not just historically.
- Learners benefit because spikes in new joins can explain slower feedback or higher support wait time.

## 7. Completed this month

Plain English meaning:

- The number of enrollments that completed during the current month.

What data is involved:

- Enrollment `completed_at` dates.

Purpose:

- To show recent completion throughput.

Why it matters:

- This is one of the clearest short-term delivery metrics. It shows whether learners are actually reaching the finish line now.

## 8. Avg completion per course

Plain English meaning:

- The average of each course's completion rate across the trainer's visible courses.

What data is involved:

- Per-course completed enrollments divided by per-course enrollments.
- Then averaged across the courses in scope.

Purpose:

- To give a portfolio-level sense of course health.

Why it matters:

- It prevents one very large course from completely hiding the performance of smaller courses.

User value:

- Trainers can see whether problems are broad or isolated.
- Learners benefit because weak courses are easier to detect when averages are examined per course instead of only in aggregate.

## 9. At-risk enrollments

Plain English meaning:

- The number of enrollments currently showing warning signs that need follow-up.

What data is involved:

- Enrollment progress and status.
- Session behavior.
- Activity recency.

The trainer at-risk logic currently flags incomplete enrollments when one or more of these is true:

- stalled progress: enrolled for at least 14 days and still below 30% progress,
- repeated short sessions: at least 2 short sessions,
- inactive incomplete: progress started but the learner has been inactive for at least 10 days,
- problematic session status: repeated timed-out or abandoned sessions.

Purpose:

- To turn raw behavior into an intervention list.

Why it matters to the system:

- This helps prevent silent drop-off.

Why it matters to users:

- Trainers know who to check first.
- Learners benefit because they are more likely to get timely help before they give up.

## 10. Cohort overview

Plain English meaning:

- A distribution of enrollments across states like not started, in progress, completed, and at risk.

What data is involved:

- Enrollment progress and status.
- At-risk classification logic.

Purpose:

- To show the shape of the trainer's learner population.

Why it matters:

- A cohort with many not-started learners needs a different response than one with many in-progress but stuck learners.

## 11. Cohort-level insights

Plain English meaning:

- A compact summary of total enrollments, in-progress learners, not-started learners, and learners needing intervention.

Purpose:

- To turn the cohort chart into operational counts.

Why it matters:

- Charts are useful for pattern recognition, but counts are what help staff plan actual work.

## 12. At-risk signal mix

Plain English meaning:

- A breakdown of why enrollments are being flagged.

The cards currently track:

- stalled progress,
- repeated short sessions,
- inactive incomplete,
- problematic exits or session-status problems.

Purpose:

- To explain not just how many learners are at risk, but what kind of risk is happening.

Why it matters:

- Different risk types need different responses.
- A stalled learner may need motivation or reminders.
- A repeated short-session learner may be confused, interrupted, or experiencing usability problems.
- A problematic exit pattern may point to technical instability.

## 13. Course performance comparison

Plain English meaning:

- A side-by-side comparison of completion rate and average assessment score for the trainer's most active courses.

What data is involved:

- Course-level completed enrollment counts.
- Course-level average scored attempts.

Purpose:

- To show which courses are healthy and which need review.

Why it matters:

- It makes it much easier to spot courses where learners finish but do not score well, or score well but still fail to finish.

## 14. Top course insights

Plain English meaning:

- A ranked snapshot of course performance, including learners, completion, score, progress, and learning time.

What data is involved:

- Enrollment counts.
- Distinct learner counts.
- Course completion rate.
- Average progress.
- Average assessment score.
- Average session time per learner.

Purpose:

- To give a rich course-by-course summary without opening each course one by one.

Why it matters:

- Trainers can quickly identify which courses are strong, weak, popular, or in need of attention.
- Learners benefit because the worst-performing courses can be improved faster.

## 15. Content improvement insights

Plain English meaning:

- A module-level warning list showing which lessons may be causing friction.

What data is involved:

- Module learner counts.
- Completed learner counts.
- Average learning minutes.
- Average assessment score.
- Failure rate.

How the attention level is determined:

- `critical` when multiple issues are present,
- `watch` when one issue is present,
- `healthy` when no warning conditions are present.

The warning conditions include:

- low average score,
- high failure rate,
- long average learning time,
- low completion coverage.

Purpose:

- To highlight likely content design problems.

Why it matters:

- This is one of the most valuable trainer-facing views because it points directly to what should be improved in the learning experience.
- Learners benefit immediately when confusing modules are rewritten, re-sequenced, or simplified.

## 16. Recommendation impressions

Plain English meaning:

- The number of times tracked recommendation cards were shown to learners in the trainer's course portfolio.

What data is involved:

- Persisted learner recommendation rows and logged impression events.

Purpose:

- To show whether recommendations are actually being surfaced, not just generated in theory.

Why it matters:

- A recommendation system cannot prove value if no one sees the recommendations.

## 17. Acceptance rate

Plain English meaning:

- The share of recommendation clicks that turned into accepts.

Current formula:

- accept rate = total accepts divided by total clicks.

Purpose:

- To show how convincing or useful the recommendation feels after the learner engages with it.

Why it matters:

- High impressions with low accept rate may mean the cards are visible but not compelling.
- Learners benefit when the system learns which suggestions are genuinely relevant.

Important caution:

- A 0% value does not always mean failure. It can also mean recommendation interactions have not been logged yet, or learners have seen suggestions but not clicked them.

## 18. Avg acceptance probability

Plain English meaning:

- The average predicted likelihood that learners will accept the surfaced recommendations.

What data is involved:

- Stored `acceptance_probability` values on learner recommendation rows.

Purpose:

- To compare model confidence with real behavior.

Why it matters:

- If predicted acceptance is high but real acceptance is low, the recommendation model may be overconfident or the user experience may be weak.
- If both are high, the recommendations are probably aligned with learner needs.

## 19. Recommended completion rate

Plain English meaning:

- Of the enrollments that came from recommendations, how many ended up completing.

Current formula:

- recommended completion rate = recommendation-originated completions divided by recommendation-originated enrollments.

Purpose:

- To measure downstream recommendation quality, not just surface-level clicks.

Why it matters:

- A good recommendation should not only get accepted. It should lead to useful and completable learning.

## 20. Recommendation performance chart

Plain English meaning:

- A course-by-course comparison of actual accept rate versus predicted acceptance.

Purpose:

- To show where the model and reality agree or disagree.

Why it matters:

- This helps separate recommendation-model issues from content or UX issues.

## 21. Recommendation winners

Plain English meaning:

- The recommended courses generating the strongest positive learner response.

What data is involved:

- Accepts.
- Recommendation-originated enrollments.
- Recommendation-originated completions.
- Predicted acceptance.
- Enrollment conversion rate.

Purpose:

- To identify recommendation patterns worth repeating.

Why it matters:

- If some recommended courses consistently convert and complete well, that is useful evidence for curriculum planning and recommendation tuning.

## Admin dashboard cards and what they mean

## 1. Total users

Plain English meaning:

- The total number of registered users across the platform.

What data is involved:

- User records.

Purpose:

- To show platform size.

Why it matters:

- Admins need a quick sense of overall scale when reading all other platform metrics.

## 2. Available courses

Plain English meaning:

- The number of courses currently included in platform analytics.

What data is involved:

- Course records.

Purpose:

- To show content breadth.

Why it matters:

- More courses create more variation in outcomes, which affects how admins interpret completion, risk, and usage numbers.

## 3. Total enrollments

Plain English meaning:

- The total number of enrollment records across the organization.

Purpose:

- To show total participation volume.

Why it matters:

- This is one of the most important denominator metrics in the system.

## 4. Completion rate

Plain English meaning:

- The percentage of tracked enrollments that are completed.

Current formula:

- completed enrollments divided by total enrollments.

Purpose:

- To give a high-level platform outcome score.

Why it matters:

- It is one of the clearest answers to the question: "Are learners finishing what they start?"

User importance:

- Admins use it to evaluate platform health.
- Learners benefit because weak completion usually triggers product, content, or support improvements.

## 5. Certificates issued

Plain English meaning:

- The total number of issued certificates across tracked courses.

Purpose:

- To show recognized learning outcomes across the platform.

Why it matters:

- A platform can have many enrollments but still fail if very few learners reach meaningful completion.

## 6. Active learners (30d)

Plain English meaning:

- The number of learners with recent activity during the last 30 days.

What data is involved:

- Enrollment activity dates.
- Module session dates.

Important detail:

- Admin activity counts are built from recent enrollment activity and recent session activity, not only from assessment or completion data.

Purpose:

- To show whether the platform is alive and being used now.

Why it matters:

- A healthy platform is not just one with old completions. It is one with current learner movement.

## 7. Completion trends

Plain English meaning:

- Month-by-month enrollment intake and completion volume across the platform.

What data is involved:

- Enrollment creation dates.
- Enrollment completion dates.

Purpose:

- To show operational momentum.

Why it matters:

- Admins can see whether platform growth is being matched by actual completion.

## 8. Certificate issuance trend

Plain English meaning:

- A month-by-month view of certificates released.

Purpose:

- To show output volume from completed training.

Why it matters:

- Certificate release is a strong end-state signal, especially for executive or stakeholder reporting.

## 9. Trainee performance trends

Plain English meaning:

- A month-by-month comparison of average progress and average assessment score.

Purpose:

- To show whether learner progress and learner mastery are moving together.

Why it matters:

- High progress with weak score can mean learners are advancing without understanding enough.
- High score with weak progress can mean only a smaller subset is getting through.

## 10. System-wide engagement

Plain English meaning:

- A trend view of active learners and learning hours over time.

What data is involved:

- Active learner IDs from enrollment and session activity.
- Learning hours derived from session time or completion time.

Purpose:

- To show whether learners are actively using the system and spending meaningful time inside it.

Why it matters:

- It distinguishes a platform that is technically populated from one that is genuinely active.

## 11. Engagement snapshot

This section contains five very practical cards.

### Active learners, last 7 days

Meaning:

- Learners who were recently active within one week.

Why it matters:

- This is the sharpest short-term pulse check.

### Active learners, last 30 days

Meaning:

- Learners active within the last month.

Why it matters:

- This is a broader measure of current engagement.

### Average progress

Meaning:

- The average enrollment progress percentage across the platform.

Why it matters:

- It shows how far learners are getting, even before they complete.

### Average assessment score

Meaning:

- The average of scored assessment attempts across the platform.

Why it matters:

- It reflects quality of learning outcomes.

### Total learning time captured

Meaning:

- Total tracked learning time across the platform.

Important technical note:

- The admin calculation compares session-based minutes and completion-based minutes by month and uses the larger month value. This is a practical compromise to avoid obvious undercounting while also avoiding simple double counting.

Why it matters:

- Time is not a perfect quality measure, but it is very useful for understanding platform usage and possible friction.

## 12. Top course insights

Plain English meaning:

- A ranked list of high-volume courses showing enrollments, certificates, and average progress.

How courses are ranked:

- First by enrollments.
- Then by completion rate.

Purpose:

- To help admins see where the biggest instructional impact is happening.

Why it matters:

- Fixing a problem in a high-volume course often helps the largest number of learners.

## 13. Recent session activity

Plain English meaning:

- A recent learner activity feed showing who opened what, how many sessions they had, how long they spent, and whether the pattern looks concerning.

What data is involved:

- Module session records.
- User lookup for learner names and emails.

Additional flag:

- `Needs review` appears when repeated short-session patterns are detected and the latest session is not completed.

Purpose:

- To give admins a concrete behavioral view rather than only summary charts.

Why it matters:

- This is often where staff first notice usability issues, confusion, or disengagement patterns.

## 14. Predictive oversight

Plain English meaning:

- A set of early-warning metrics built from stored course risk and learner disengagement snapshots.

The main cards are:

- high-risk courses,
- high-risk learners,
- average course risk score,
- average disengagement score.

Purpose:

- To move the dashboard from descriptive analytics to preventive analytics.

Why it matters to the system:

- It gives the platform a way to surface risk before failure becomes obvious in lagging metrics.

Why it matters to users:

- Admins can intervene sooner.
- Learners benefit because help can arrive before they fully disengage.

Very important interpretation note:

- A course can have a high risk score even if recommendation accept rate is 0. Predictive risk uses broader signals like completion decline, inactivity, and disengagement, not just recommendation response.

## 15. Highest course risk

Plain English meaning:

- The courses currently ranked as most urgent based on stored risk snapshots.

What data is shown:

- active enrollments,
- completion rate,
- recommendation acceptance rate,
- risk score,
- risk level.

Purpose:

- To tell admins where to look first.

Why it matters:

- Without ranking, a risk list becomes noise.

## 16. Learner disengagement watchlist

Plain English meaning:

- A list of learners whose stored disengagement scores suggest meaningful drop-off risk.

What data is shown:

- disengagement score,
- inactive days,
- incomplete enrollments,
- repeated short sessions.

Purpose:

- To give admins a human-centered action list rather than only course-level summaries.

Why it matters:

- Learner-level intervention is often where retention is won or lost.

## 17. Recommendation performance

Plain English meaning:

- A platform-wide summary of how recommendations are being seen, accepted, and converted into real learning outcomes.

The four main admin recommendation cards are:

- impressions,
- accept rate,
- average acceptance probability,
- recommended completion rate.

What each one means:

- impressions: how many times tracked recommendation cards were shown,
- accept rate: accepts divided by clicks,
- average acceptance probability: the model's average predicted likelihood of acceptance,
- recommended completion rate: completions divided by recommendation-originated enrollments.

Purpose:

- To evaluate whether the recommendation system is generating useful learning pathways rather than just producing suggestions.

Why it matters:

- Strong recommendation metrics can improve course discovery, learner momentum, and completion outcomes.
- Weak recommendation metrics can reveal a model issue, UX issue, tracking gap, or poor course fit.

## How recommendation analytics are aggregated

The dashboard groups recommendation rows by course and then rolls up these values:

- recommendations delivered,
- impressions,
- clicks,
- accepts,
- enrollments,
- completions,
- acceptance probability.

From those values it derives:

- click-through rate = clicks / impressions,
- accept rate = accepts / clicks,
- enrollment conversion rate = enrollments / clicks,
- completion rate = completions / enrollments.

Why this is important:

- It separates different stages of recommendation quality.
- A recommendation can be visible but ignored.
- It can be clicked but not accepted.
- It can be accepted but not lead to enrollment.
- It can create enrollments that still do not complete.

Each of those is a different problem and needs a different fix.

## Why some numbers can be zero even when the feature is working

A zero is not always a bug. Sometimes it is just early or incomplete data.

Examples:

- Recommendation impressions may be zero if persisted recommendation cards have not been shown on tracked learner surfaces yet.
- Accept rate may stay at zero if learners saw recommendations but did not click them.
- Recommended completion rate may stay at zero if recommendation-driven enrollments are still in progress.
- Predictive charts may be sparse if rollup tables or stored snapshots have not populated yet.

This matters because staff can misread a data-collection gap as a product failure.

## Why these cards are important for users, not just for the system

It is easy to think of dashboard cards as management tools only. That is too narrow.

These metrics affect users in real ways:

### For learners

- Faster follow-up when they are stuck.
- Better recommendations instead of generic suggestions.
- Better module design when low-score or high-friction content is revised.
- More reliable completion paths when risk patterns are caught earlier.

### For trainers

- Less guesswork about which learners need help.
- Faster identification of weak modules or poor assessments.
- Better prioritization when time is limited.

### For admins

- Better oversight of platform health.
- Stronger evidence for product decisions and policy decisions.
- Easier explanation of outcomes to stakeholders.

## Practical reading guide

If someone wants to read the dashboards well, this is a good order:

1. Start with scale metrics like users, courses, learners, and enrollments.
2. Check outcome metrics like completion rate, scores, and certificates.
3. Check activity metrics like active learners and learning time.
4. Check risk metrics to find where action is needed.
5. Check recommendation metrics to judge whether discovery and next-step guidance are helping.
6. Drill into course, module, or learner-level lists only after the top-line numbers suggest where to look.

## Final takeaway

The statistic cards are valuable because each one turns a large amount of raw platform behavior into a decision signal.

Used together, they answer a full chain of questions:

- Are people entering the learning system?
- Are they active?
- Are they learning effectively?
- Are they finishing?
- Are they earning certificates?
- Are some learners or courses becoming risky?
- Are recommendations helping them move forward?

That is why these cards matter not only for reporting, but for the actual day-to-day experience of learners, trainers, and admins.