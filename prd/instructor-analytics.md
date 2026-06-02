# Instructor Analytics Dashboard

## Problem Statement

Instructors on the platform have no visibility into how their courses are actually performing. They can see a list of enrolled students and individual progress, but have no way to answer high-level questions like: how much am I earning, what percentage of students finish my course, where do students give up, and how are students performing on quizzes? Without this data, instructors cannot make informed decisions about where to improve their course content.

## Solution

Add a dedicated Analytics tab to each course's instructor dashboard that surfaces key performance metrics: enrollment counts, earnings, completion rates, quiz score distributions, and a lesson-by-lesson drop-off funnel. Additionally, surface aggregate earnings across all courses on the main instructor dashboard so instructors can see their total revenue at a glance.

## User Stories

1. As an instructor, I want to see how many students are enrolled in a specific course, so that I know the size of my audience.
2. As an instructor, I want to see the total earnings for a specific course, so that I can understand how much revenue that course has generated.
3. As an instructor, I want to see my total earnings across all my courses on my main dashboard, so that I can track my overall income without navigating into each course.
4. As an instructor, I want to see the completion rate for a course as a percentage, so that I can understand how many students actually finish the content.
5. As an instructor, I want to see a drop-off funnel for each lesson in my course, so that I can identify which lessons students fail to start after progressing through earlier content.
6. As an instructor, I want the drop-off funnel to be grouped by module, so that I can quickly identify which module contains the biggest engagement cliff.
7. As an instructor, I want to see a visual bar representation for lesson engagement, so that I can compare drop-off across lessons at a glance without reading raw numbers.
8. As an instructor, I want to see quiz score distributions for every quiz in my course, so that I can understand how students are performing on assessments.
9. As an instructor, I want quiz score distributions shown as a histogram with score buckets, so that I can see whether students are clustered just below the passing threshold.
10. As an instructor, I want the quiz histogram to reflect each student's best attempt, so that I see what students ultimately achieved rather than a distorted view from retakes.
11. As an instructor, I want a visual bar representation for each quiz score bucket, so that I can compare bucket sizes quickly without reading numbers.
12. As an instructor, I want the analytics tab to be accessible from the same tabbed interface as Content, Settings, and Students, so that I don't have to navigate to a separate area of the app.
13. As an instructor, I want all analytics to reflect all-time data, so that I have a complete picture of course performance since launch.
14. As an instructor, I want earnings displayed in a human-readable currency format, so that I don't have to mentally convert cents to dollars.
15. As an instructor, I want to see the completion rate as a clear percentage, so that I can benchmark performance across my courses.
16. As an instructor, I want the lesson funnel to show absolute student counts alongside the bar, so that I know both the proportion and the real number of students who started each lesson.
17. As an instructor, I want quiz score buckets to cover the full 0–100% range in equal intervals, so that no score range is hidden.
18. As an instructor, I want to see all quizzes in the course on the analytics tab, even those with no attempts yet, so that I have a complete view of which assessments exist.
19. As an instructor, I want the analytics tab to load quickly without requiring a page refresh or separate navigation, so that I can switch between content and analytics fluidly.

## Implementation Decisions

- **New Analytics tab**: Added to the existing per-course tabbed interface alongside Content, Settings, Sales Copy, and Students. The tab navigates to a new route nested under the course editor.
- **New route**: A new instructor course analytics route is created to handle the analytics tab. It follows the same nested route pattern as the existing Students route.
- **New service module**: All analytics queries are implemented in a dedicated analytics service with a corresponding test file. This service is separate from existing CRUD-focused services (enrollment, purchase, progress) to keep complex aggregation queries isolated.
- **Service methods**:
  - `getCourseAnalytics({ courseId })` — returns enrollment count, completion rate, course earnings, lesson drop-off funnel (grouped by module), and quiz score histograms for all quizzes in the course.
  - `getInstructorTotalEarnings({ instructorId })` — returns sum of earnings across all courses owned by the instructor, used by the main dashboard.
- **Completion rate**: Defined as the percentage of enrolled students whose enrollment record has a `completedAt` timestamp set.
- **Lesson drop-off funnel**: For each lesson (ordered by module position, then lesson position), count the number of enrolled students who have a lesson progress record with status `in_progress` or `completed`. Lessons are grouped under their parent module in the UI.
- **Quiz score histogram**: For each quiz in the course, aggregate best quiz attempt scores per student into 5 equal buckets: 0–20%, 20–40%, 40–60%, 60–80%, 80–100%. Each bucket shows a count and a CSS-based bar scaled to the largest bucket.
- **Earnings**: Summed from the `pricePaid` column of the purchases table. Formatted using the existing `formatPrice()` utility. Free enrollments (no corresponding purchase record) are naturally excluded from earnings but counted in enrollment totals.
- **Visualization**: All charts are rendered using CSS-based horizontal bars (div with percentage width, Tailwind classes). No external chart library is added.
- **Main dashboard aggregate earnings**: The main instructor course listing page is updated to include a summary card showing total all-time earnings across all instructor courses.
- **No date filtering**: All metrics are all-time aggregates. Date range filtering is out of scope for this version.
- **Service tests**: The analytics service test file uses `createTestDb()` and `seedBaseData()` per project conventions, and mocks the db module before importing the service.

## Out of Scope

- Date range filtering or time-series views (e.g. "enrollments this month").
- Per-student drill-down from the analytics tab (the existing Students tab covers this).
- Video watch event analytics (e.g. average watch time, drop-off within a video) — the `videoWatchEvents` table exists but is not used here.
- Per-question quiz breakdown (which specific questions students most often get wrong).
- Revenue forecasting or trend charts.
- Export to CSV or any data export functionality.
- Push notifications or alerts when metrics cross thresholds.
- Comparison across courses (e.g. course A vs course B side by side).
- Payment processor integration — earnings reflect data already stored in the purchases table, not a live payment feed.

## Further Notes

- Earnings figures reflect the `pricePaid` column, which stores the actual amount paid after any coupon discounts. A fully comped enrollment (coupon code for 100% off) will appear as $0 in earnings but still counts as an enrollment.
- The lesson funnel measures engagement (who started each lesson), not sequential completion. Students may complete lessons out of order, so the funnel may not be perfectly monotonically decreasing.
- Quizzes are per-lesson. If a lesson has no quiz, it appears in the funnel only (not in the quiz section). If a lesson has a quiz but no attempts yet, it appears in the quiz section with an empty state.
