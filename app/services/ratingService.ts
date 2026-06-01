import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

export function getRatingForUser(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();
}

export function upsertRating(userId: number, courseId: number, rating: number) {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error("Rating must be an integer between 1 and 5");
  }

  const existing = getRatingForUser(userId, courseId);
  const now = new Date().toISOString();

  if (existing) {
    return db
      .update(courseRatings)
      .set({ rating, updatedAt: now })
      .where(eq(courseRatings.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

export function getCourseAverageRating(courseId: number) {
  const result = db
    .select({
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return {
    average: result?.average ?? null,
    count: result?.count ?? 0,
  };
}

export function getCourseAverageRatingsBatch(
  courseIds: number[]
): Map<number, { average: number | null; count: number }> {
  const map = new Map<number, { average: number | null; count: number }>();
  if (courseIds.length === 0) return map;

  const rows = db
    .select({
      courseId: courseRatings.courseId,
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId)
    .all();

  for (const row of rows) {
    map.set(row.courseId, { average: row.average, count: row.count });
  }

  return map;
}
