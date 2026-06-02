# Plan: Instructor Analytics Dashboard

> Source PRD: prd/instructor-analytics.md

## Architectural decisions

- **Routes**: New route at `instructor/:courseId/analytics`, registered in `app/routes.ts` alongside the existing `instructor/:courseId/students` entry. Follows the same nested pattern.
- **Service**: All analytics queries live in a new `app/services/analyticsService.ts`. Two exported functions: `getCourseAnalytics({ courseId })` and `getInstructorTotalEarnings({ instructorId })`. Object parameters because both accept a single typed id.
- **Tests**: `app/services/analyticsService.test.ts` using `createTestDb()` + `seedBaseData()`, with `vi.mock("~/db")` before the service import — same pattern as all other service tests.
- **Schema**: No new tables. Queries against existing `enrollments`, `purchases`, `lessonProgress`, `lessons`, `modules`, `quizzes`, `quizAttempts`.
- **Visualization**: CSS-based horizontal bars using Tailwind `w-[{pct}%]` — no external chart library.
- **Earnings**: Summed from `purchases.pricePaid` (cents); formatted with existing `formatPrice()`. Free enrollments are excluded from earnings but counted in enrollment totals.
- **Completion rate**: `(count of enrollments where completedAt IS NOT NULL) / (total enrollments)`, expressed as a percentage.
- **Lesson funnel**: Count of enrolled students who have a `lessonProgress` record with status `in_progress` or `completed` for each lesson, ordered by module position then lesson position.
- **Quiz histograms**: Best attempt score per student per quiz, bucketed into five equal intervals (0–20, 20–40, 40–60, 60–80, 80–100%). Each bucket exposes a count and a bar width scaled to the largest bucket.

---

## Phase 1: Analytics route + headline metrics

**User stories**: 1, 2, 3, 4, 12, 13, 14, 15, 19

### What to build

Stand up the end-to-end analytics slice with the three simplest metrics: enrollment count, course earnings, and completion rate.

On the service side, `getCourseAnalytics({ courseId })` returns `{ enrollmentCount, courseEarnings, completionRate }`. A separate `getInstructorTotalEarnings({ instructorId })` sums earnings across all courses the instructor owns.

On the route side, a new `instructor/:courseId/analytics` route loads these values and renders a summary card section. The Analytics tab is added to the existing per-course tabbed interface in the course editor, navigating to this route just like the Students tab navigates to its own route.

The main instructor dashboard (`/instructor`) gets a total earnings summary card powered by `getInstructorTotalEarnings`.

### Acceptance criteria

- [ ] `GET /instructor/:courseId/analytics` renders without error for an authenticated instructor who owns the course
- [ ] Enrollment count matches the number of rows in the `enrollments` table for the course
- [ ] Course earnings equals the sum of `pricePaid` across all purchases for the course, displayed via `formatPrice()`
- [ ] Completion rate is displayed as a percentage (e.g. "42%"), calculated from `completedAt IS NOT NULL` enrollments
- [ ] The Analytics tab appears in the course editor tab bar alongside Content, Settings, Sales Copy, and Students
- [ ] The main instructor dashboard shows a total earnings card that sums all-time earnings across all instructor courses
- [ ] `analyticsService.test.ts` covers: enrollment count, earnings sum, completion rate (0%, partial, 100%), and total earnings across multiple courses

---

## Phase 2: Lesson drop-off funnel

**User stories**: 5, 6, 7, 16

### What to build

Extend `getCourseAnalytics` to include a `lessonFunnel` field: an ordered list of modules, each containing its lessons with the count of enrolled students who have started or completed that lesson.

The analytics route renders a funnel section below the headline metrics. Lessons are grouped under their parent module heading. Each lesson row shows a CSS horizontal bar (width proportional to the highest-engagement lesson in the course) and the absolute student count.

### Acceptance criteria

- [ ] `lessonFunnel` groups lessons by module, ordered by module position then lesson position
- [ ] Each lesson entry includes: lesson title, module title, and student count (enrolled users with `in_progress` or `completed` lesson progress)
- [ ] Lessons with zero engagement show a bar at 0% width and a count of 0
- [ ] The bar for the highest-engagement lesson is at 100% width; all others scale relative to it
- [ ] Student count is shown alongside the bar as a readable number
- [ ] Service tests cover: course with no progress, single lesson, multi-module funnel, and lessons with partial engagement

---

## Phase 3: Quiz score histograms

**User stories**: 8, 9, 10, 11, 17, 18

### What to build

Extend `getCourseAnalytics` to include a `quizHistograms` field: one histogram per quiz in the course (all quizzes, even those with no attempts). Each histogram contains five buckets (0–20%, 20–40%, 40–60%, 60–80%, 80–100%) with a count and a bar width. The histogram uses each student's best attempt score for that quiz.

The analytics route renders a quiz section below the funnel. Each quiz is shown with its title, a histogram of score buckets, and an empty state when no attempts exist yet.

### Acceptance criteria

- [ ] Every quiz belonging to a lesson in the course appears in the histogram section, regardless of attempt count
- [ ] Scores are bucketed into five equal intervals covering 0–100%
- [ ] Each student's best (highest) attempt score is used — retakes do not distort the distribution
- [ ] Bucket bars scale relative to the largest bucket within each quiz (largest bucket = 100% width)
- [ ] A quiz with no attempts renders an explicit empty state ("No attempts yet") rather than five empty bars
- [ ] Service tests cover: no attempts, single student single attempt, multiple students, retakes (best-attempt selection), and score boundary edge cases (e.g. a score of exactly 20% falls in the 0–20 bucket)
