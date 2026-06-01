import { eq, asc } from "drizzle-orm";
import { db } from "~/db";
import { lessonComments, users, UserRole } from "~/db/schema";

export function listComments(lessonId: number) {
  return db
    .select({
      id: lessonComments.id,
      body: lessonComments.body,
      createdAt: lessonComments.createdAt,
      userId: lessonComments.userId,
      userName: users.name,
      userRole: users.role,
      userAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(eq(lessonComments.lessonId, lessonId))
    .orderBy(asc(lessonComments.createdAt))
    .all();
}

export function createComment(userId: number, lessonId: number, body: string) {
  return db
    .insert(lessonComments)
    .values({ userId, lessonId, body })
    .returning()
    .get();
}

export function getCommentById(commentId: number) {
  return db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, commentId))
    .get();
}

export function deleteComment(
  commentId: number,
  userId: number,
  userRole: UserRole
) {
  const comment = getCommentById(commentId);
  if (!comment) return null;

  const canDelete =
    comment.userId === userId ||
    userRole === UserRole.Instructor ||
    userRole === UserRole.Admin;

  if (!canDelete) return null;

  return db
    .delete(lessonComments)
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}
