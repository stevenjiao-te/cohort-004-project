import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  courses,
  enrollments,
  lessons,
  lessonProgress,
  LessonProgressStatus,
  modules,
  purchases,
  quizAttempts,
  quizzes,
} from "~/db/schema";

const QUIZ_BUCKET_LABELS = ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"];

function scoreToBucket(score: number): number {
  if (score <= 0.2) return 0;
  if (score <= 0.4) return 1;
  if (score <= 0.6) return 2;
  if (score <= 0.8) return 3;
  return 4;
}

export function getCourseAnalytics({ courseId }: { courseId: number }) {
  const enrollmentResult = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();
  const enrollmentCount = Number(enrollmentResult?.count ?? 0);

  const earningsResult = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(eq(purchases.courseId, courseId))
    .get();
  const courseEarnings = Number(earningsResult?.total ?? 0);

  const completedResult = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        isNotNull(enrollments.completedAt)
      )
    )
    .get();
  const completedCount = Number(completedResult?.count ?? 0);
  const completionRate =
    enrollmentCount > 0
      ? Math.round((completedCount / enrollmentCount) * 100)
      : 0;

  const funnelRows = db
    .select({
      moduleId: modules.id,
      moduleTitle: modules.title,
      modulePosition: modules.position,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      lessonPosition: lessons.position,
      studentCount: sql<number>`count(distinct ${enrollments.userId})`,
    })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        or(
          eq(lessonProgress.status, LessonProgressStatus.InProgress),
          eq(lessonProgress.status, LessonProgressStatus.Completed)
        )
      )
    )
    .leftJoin(
      enrollments,
      and(
        eq(enrollments.userId, lessonProgress.userId),
        eq(enrollments.courseId, courseId)
      )
    )
    .where(eq(modules.courseId, courseId))
    .groupBy(
      modules.id,
      modules.title,
      modules.position,
      lessons.id,
      lessons.title,
      lessons.position
    )
    .orderBy(modules.position, lessons.position)
    .all();

  const maxStudentCount = funnelRows.reduce(
    (max, row) => Math.max(max, Number(row.studentCount)),
    0
  );

  const moduleMap = new Map<
    number,
    {
      moduleId: number;
      moduleTitle: string;
      modulePosition: number;
      lessons: {
        lessonId: number;
        lessonTitle: string;
        studentCount: number;
        barWidth: number;
      }[];
    }
  >();

  for (const row of funnelRows) {
    const studentCount = Number(row.studentCount);
    const barWidth =
      maxStudentCount > 0
        ? Math.round((studentCount / maxStudentCount) * 100)
        : 0;

    if (!moduleMap.has(row.moduleId)) {
      moduleMap.set(row.moduleId, {
        moduleId: row.moduleId,
        moduleTitle: row.moduleTitle,
        modulePosition: row.modulePosition,
        lessons: [],
      });
    }

    moduleMap.get(row.moduleId)!.lessons.push({
      lessonId: row.lessonId,
      lessonTitle: row.lessonTitle,
      studentCount,
      barWidth,
    });
  }

  const lessonFunnel = [...moduleMap.values()].sort(
    (a, b) => a.modulePosition - b.modulePosition
  );

  const quizRows = db
    .select({ id: quizzes.id, title: quizzes.title })
    .from(quizzes)
    .innerJoin(lessons, eq(lessons.id, quizzes.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position, lessons.position)
    .all();

  const bestAttemptRows = db
    .select({
      quizId: quizAttempts.quizId,
      bestScore: sql<number>`max(${quizAttempts.score})`,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .innerJoin(lessons, eq(lessons.id, quizzes.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(eq(modules.courseId, courseId))
    .groupBy(quizAttempts.userId, quizAttempts.quizId)
    .all();

  const attemptsByQuiz = new Map<number, number[]>();
  for (const row of bestAttemptRows) {
    const existing = attemptsByQuiz.get(row.quizId) ?? [];
    existing.push(Number(row.bestScore));
    attemptsByQuiz.set(row.quizId, existing);
  }

  const quizHistograms = quizRows.map((quiz) => {
    const scores = attemptsByQuiz.get(quiz.id) ?? [];
    const counts = [0, 0, 0, 0, 0];

    for (const score of scores) {
      counts[scoreToBucket(score)]++;
    }

    const maxCount = Math.max(...counts);

    const buckets = QUIZ_BUCKET_LABELS.map((label, i) => ({
      label,
      count: counts[i],
      barWidth: maxCount > 0 ? Math.round((counts[i] / maxCount) * 100) : 0,
    }));

    return {
      quizId: quiz.id,
      quizTitle: quiz.title,
      hasAttempts: scores.length > 0,
      buckets,
    };
  });

  return {
    enrollmentCount,
    courseEarnings,
    completionRate,
    lessonFunnel,
    quizHistograms,
  };
}

export function getInstructorTotalEarnings({
  instructorId,
}: {
  instructorId: number;
}) {
  const result = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(eq(courses.instructorId, instructorId))
    .get();

  return Number(result?.total ?? 0);
}
