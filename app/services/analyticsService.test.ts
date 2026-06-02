import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  getCourseAnalytics,
  getInstructorTotalEarnings,
} from "./analyticsService";

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getCourseAnalytics", () => {
    describe("enrollmentCount", () => {
      it("returns 0 when no students are enrolled", () => {
        const result = getCourseAnalytics({ courseId: base.course.id });
        expect(result.enrollmentCount).toBe(0);
      });

      it("returns the count of enrolled students", () => {
        const student2 = testDb
          .insert(schema.users)
          .values({
            name: "Student Two",
            email: "student2@example.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();

        testDb
          .insert(schema.enrollments)
          .values({ userId: base.user.id, courseId: base.course.id })
          .run();
        testDb
          .insert(schema.enrollments)
          .values({ userId: student2.id, courseId: base.course.id })
          .run();

        const result = getCourseAnalytics({ courseId: base.course.id });
        expect(result.enrollmentCount).toBe(2);
      });
    });

    describe("courseEarnings", () => {
      it("returns 0 when there are no purchases", () => {
        const result = getCourseAnalytics({ courseId: base.course.id });
        expect(result.courseEarnings).toBe(0);
      });

      it("returns the sum of pricePaid across all purchases", () => {
        const student2 = testDb
          .insert(schema.users)
          .values({
            name: "Student Two",
            email: "student2@example.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();

        testDb
          .insert(schema.purchases)
          .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999 })
          .run();
        testDb
          .insert(schema.purchases)
          .values({ userId: student2.id, courseId: base.course.id, pricePaid: 3999 })
          .run();

        const result = getCourseAnalytics({ courseId: base.course.id });
        expect(result.courseEarnings).toBe(8998);
      });

      it("excludes purchases from other courses", () => {
        const course2 = testDb
          .insert(schema.courses)
          .values({
            title: "Other Course",
            slug: "other-course",
            description: "Another course",
            instructorId: base.instructor.id,
            categoryId: base.category.id,
            status: schema.CourseStatus.Published,
          })
          .returning()
          .get();

        testDb
          .insert(schema.purchases)
          .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999 })
          .run();
        testDb
          .insert(schema.purchases)
          .values({ userId: base.user.id, courseId: course2.id, pricePaid: 9999 })
          .run();

        const result = getCourseAnalytics({ courseId: base.course.id });
        expect(result.courseEarnings).toBe(4999);
      });
    });

    describe("completionRate", () => {
      it("returns 0 when there are no enrollments", () => {
        const result = getCourseAnalytics({ courseId: base.course.id });
        expect(result.completionRate).toBe(0);
      });

      it("returns 0 when no students have completed the course", () => {
        testDb
          .insert(schema.enrollments)
          .values({ userId: base.user.id, courseId: base.course.id })
          .run();

        const result = getCourseAnalytics({ courseId: base.course.id });
        expect(result.completionRate).toBe(0);
      });

      it("returns 100 when all enrolled students have completed the course", () => {
        testDb
          .insert(schema.enrollments)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            completedAt: new Date().toISOString(),
          })
          .run();

        const result = getCourseAnalytics({ courseId: base.course.id });
        expect(result.completionRate).toBe(100);
      });

      it("returns the correct percentage when some students have completed", () => {
        const student2 = testDb
          .insert(schema.users)
          .values({
            name: "Student Two",
            email: "student2@example.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();

        const student3 = testDb
          .insert(schema.users)
          .values({
            name: "Student Three",
            email: "student3@example.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();

        const student4 = testDb
          .insert(schema.users)
          .values({
            name: "Student Four",
            email: "student4@example.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();

        testDb
          .insert(schema.enrollments)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            completedAt: new Date().toISOString(),
          })
          .run();
        testDb
          .insert(schema.enrollments)
          .values({ userId: student2.id, courseId: base.course.id })
          .run();
        testDb
          .insert(schema.enrollments)
          .values({ userId: student3.id, courseId: base.course.id })
          .run();
        testDb
          .insert(schema.enrollments)
          .values({ userId: student4.id, courseId: base.course.id })
          .run();

        const result = getCourseAnalytics({ courseId: base.course.id });
        expect(result.completionRate).toBe(25);
      });
    });
  });

  describe("lessonFunnel", () => {
    it("returns an empty array when the course has no modules", () => {
      const result = getCourseAnalytics({ courseId: base.course.id });
      expect(result.lessonFunnel).toEqual([]);
    });

    it("returns lessons grouped by module with 0 count when no progress exists", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .run();
      testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 2", position: 2 })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });

      expect(result.lessonFunnel).toHaveLength(1);
      expect(result.lessonFunnel[0].moduleTitle).toBe("Module 1");
      expect(result.lessonFunnel[0].lessons).toHaveLength(2);
      expect(result.lessonFunnel[0].lessons[0].studentCount).toBe(0);
      expect(result.lessonFunnel[0].lessons[0].barWidth).toBe(0);
      expect(result.lessonFunnel[0].lessons[1].studentCount).toBe(0);
    });

    it("counts only enrolled students with in_progress or completed status", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();

      testDb
        .insert(schema.lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: lesson.id,
          status: schema.LessonProgressStatus.InProgress,
        })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });
      expect(result.lessonFunnel[0].lessons[0].studentCount).toBe(1);
      expect(result.lessonFunnel[0].lessons[0].barWidth).toBe(100);
    });

    it("does not count not_started progress", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();

      testDb
        .insert(schema.lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: lesson.id,
          status: schema.LessonProgressStatus.NotStarted,
        })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });
      expect(result.lessonFunnel[0].lessons[0].studentCount).toBe(0);
    });

    it("scales bars relative to the highest-engagement lesson", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson1 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      const lesson2 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 2", position: 2 })
        .returning()
        .get();

      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student Two",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({ userId: student2.id, courseId: base.course.id })
        .run();

      // Both students started lesson 1
      testDb
        .insert(schema.lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: lesson1.id,
          status: schema.LessonProgressStatus.Completed,
        })
        .run();
      testDb
        .insert(schema.lessonProgress)
        .values({
          userId: student2.id,
          lessonId: lesson1.id,
          status: schema.LessonProgressStatus.Completed,
        })
        .run();

      // Only one student started lesson 2
      testDb
        .insert(schema.lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: lesson2.id,
          status: schema.LessonProgressStatus.InProgress,
        })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });
      const [l1, l2] = result.lessonFunnel[0].lessons;

      expect(l1.studentCount).toBe(2);
      expect(l1.barWidth).toBe(100);
      expect(l2.studentCount).toBe(1);
      expect(l2.barWidth).toBe(50);
    });

    it("groups lessons under their respective modules ordered by position", () => {
      const mod1 = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module A", position: 1 })
        .returning()
        .get();

      const mod2 = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module B", position: 2 })
        .returning()
        .get();

      testDb
        .insert(schema.lessons)
        .values({ moduleId: mod1.id, title: "A-Lesson 1", position: 1 })
        .run();
      testDb
        .insert(schema.lessons)
        .values({ moduleId: mod2.id, title: "B-Lesson 1", position: 1 })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });

      expect(result.lessonFunnel).toHaveLength(2);
      expect(result.lessonFunnel[0].moduleTitle).toBe("Module A");
      expect(result.lessonFunnel[0].lessons[0].lessonTitle).toBe("A-Lesson 1");
      expect(result.lessonFunnel[1].moduleTitle).toBe("Module B");
      expect(result.lessonFunnel[1].lessons[0].lessonTitle).toBe("B-Lesson 1");
    });

    it("does not count progress from non-enrolled users", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      // base.user is NOT enrolled, but has progress
      testDb
        .insert(schema.lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: lesson.id,
          status: schema.LessonProgressStatus.Completed,
        })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });
      expect(result.lessonFunnel[0].lessons[0].studentCount).toBe(0);
    });
  });

  describe("quizHistograms", () => {
    it("returns an empty array when the course has no quizzes", () => {
      const result = getCourseAnalytics({ courseId: base.course.id });
      expect(result.quizHistograms).toEqual([]);
    });

    it("returns quiz with hasAttempts false and all-zero buckets when no attempts exist", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      const quiz = testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
        .returning()
        .get();

      const result = getCourseAnalytics({ courseId: base.course.id });

      expect(result.quizHistograms).toHaveLength(1);
      expect(result.quizHistograms[0].quizId).toBe(quiz.id);
      expect(result.quizHistograms[0].quizTitle).toBe("Quiz 1");
      expect(result.quizHistograms[0].hasAttempts).toBe(false);
      expect(result.quizHistograms[0].buckets.every((b) => b.count === 0)).toBe(
        true
      );
      expect(
        result.quizHistograms[0].buckets.every((b) => b.barWidth === 0)
      ).toBe(true);
    });

    it("buckets a single attempt into the correct bucket", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      const quiz = testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
        .returning()
        .get();

      testDb
        .insert(schema.quizAttempts)
        .values({ userId: base.user.id, quizId: quiz.id, score: 0.85, passed: true })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });
      const histogram = result.quizHistograms[0];

      expect(histogram.hasAttempts).toBe(true);
      // 0.85 > 0.8 → bucket 4 (80–100%)
      expect(histogram.buckets[4].count).toBe(1);
      expect(histogram.buckets[4].barWidth).toBe(100);
      expect(histogram.buckets[0].count).toBe(0);
      expect(histogram.buckets[1].count).toBe(0);
      expect(histogram.buckets[2].count).toBe(0);
      expect(histogram.buckets[3].count).toBe(0);
    });

    it("buckets multiple students into the correct buckets", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      const quiz = testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
        .returning()
        .get();

      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student Two",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      const student3 = testDb
        .insert(schema.users)
        .values({
          name: "Student Three",
          email: "student3@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      // base.user: 0.55 → bucket 2 (40–60%)
      testDb
        .insert(schema.quizAttempts)
        .values({ userId: base.user.id, quizId: quiz.id, score: 0.55, passed: false })
        .run();
      // student2: 0.75 → bucket 3 (60–80%)
      testDb
        .insert(schema.quizAttempts)
        .values({ userId: student2.id, quizId: quiz.id, score: 0.75, passed: true })
        .run();
      // student3: 0.9 → bucket 4 (80–100%)
      testDb
        .insert(schema.quizAttempts)
        .values({ userId: student3.id, quizId: quiz.id, score: 0.9, passed: true })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });
      const { buckets } = result.quizHistograms[0];

      expect(buckets[0].count).toBe(0);
      expect(buckets[1].count).toBe(0);
      expect(buckets[2].count).toBe(1);
      expect(buckets[3].count).toBe(1);
      expect(buckets[4].count).toBe(1);
      // All three buckets have count 1, so each gets barWidth 100
      expect(buckets[2].barWidth).toBe(100);
      expect(buckets[3].barWidth).toBe(100);
      expect(buckets[4].barWidth).toBe(100);
    });

    it("uses best attempt score when a student has multiple attempts", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      const quiz = testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
        .returning()
        .get();

      // Two attempts: 0.3 (fails) and 0.8 (passes) — best is 0.8 → bucket 3 (60–80%)
      testDb
        .insert(schema.quizAttempts)
        .values({ userId: base.user.id, quizId: quiz.id, score: 0.3, passed: false })
        .run();
      testDb
        .insert(schema.quizAttempts)
        .values({ userId: base.user.id, quizId: quiz.id, score: 0.8, passed: true })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });
      const { buckets } = result.quizHistograms[0];

      // Only one unique student counted, bucketed by best score 0.8 → bucket 3
      expect(buckets[1].count).toBe(0); // 0.3 not counted
      expect(buckets[3].count).toBe(1); // 0.8 falls in 60–80%
      expect(buckets[3].barWidth).toBe(100);
    });

    it("places a score of exactly 0.2 in the 0–20% bucket", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      const quiz = testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
        .returning()
        .get();

      testDb
        .insert(schema.quizAttempts)
        .values({ userId: base.user.id, quizId: quiz.id, score: 0.2, passed: false })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });
      const { buckets } = result.quizHistograms[0];

      expect(buckets[0].count).toBe(1);
      expect(buckets[1].count).toBe(0);
    });

    it("includes all quizzes even those with no attempts", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson1 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      const lesson2 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 2", position: 2 })
        .returning()
        .get();

      testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson1.id, title: "Quiz A", passingScore: 0.7 })
        .run();

      const quizB = testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson2.id, title: "Quiz B", passingScore: 0.7 })
        .returning()
        .get();

      // Only Quiz B has an attempt
      testDb
        .insert(schema.quizAttempts)
        .values({ userId: base.user.id, quizId: quizB.id, score: 0.9, passed: true })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });

      expect(result.quizHistograms).toHaveLength(2);
      expect(result.quizHistograms[0].quizTitle).toBe("Quiz A");
      expect(result.quizHistograms[0].hasAttempts).toBe(false);
      expect(result.quizHistograms[1].quizTitle).toBe("Quiz B");
      expect(result.quizHistograms[1].hasAttempts).toBe(true);
    });

    it("scales bars relative to the largest bucket within each quiz", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      const quiz = testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
        .returning()
        .get();

      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student Two",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      // 2 students in bucket 4 (80–100%), 1 in bucket 2 (40–60%)
      testDb
        .insert(schema.quizAttempts)
        .values({ userId: base.user.id, quizId: quiz.id, score: 0.9, passed: true })
        .run();
      testDb
        .insert(schema.quizAttempts)
        .values({ userId: student2.id, quizId: quiz.id, score: 0.95, passed: true })
        .run();

      const student3 = testDb
        .insert(schema.users)
        .values({
          name: "Student Three",
          email: "student3@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      testDb
        .insert(schema.quizAttempts)
        .values({ userId: student3.id, quizId: quiz.id, score: 0.5, passed: false })
        .run();

      const result = getCourseAnalytics({ courseId: base.course.id });
      const { buckets } = result.quizHistograms[0];

      expect(buckets[4].count).toBe(2);
      expect(buckets[4].barWidth).toBe(100); // largest bucket
      expect(buckets[2].count).toBe(1);
      expect(buckets[2].barWidth).toBe(50); // half of max
    });
  });

  describe("getInstructorTotalEarnings", () => {
    it("returns 0 when the instructor has no purchases", () => {
      const result = getInstructorTotalEarnings({
        instructorId: base.instructor.id,
      });
      expect(result).toBe(0);
    });

    it("returns the sum of earnings across all courses", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999 })
        .run();
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: course2.id, pricePaid: 9999 })
        .run();

      const result = getInstructorTotalEarnings({
        instructorId: base.instructor.id,
      });
      expect(result).toBe(14998);
    });

    it("excludes earnings from other instructors' courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Not mine",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999 })
        .run();
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: otherCourse.id, pricePaid: 9999 })
        .run();

      const result = getInstructorTotalEarnings({
        instructorId: base.instructor.id,
      });
      expect(result).toBe(4999);
    });
  });
});
