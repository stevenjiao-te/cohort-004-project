import { data } from "react-router";
import type { Route } from "./+types/api.lessons.$lessonId.comments";
import { z } from "zod";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { getLessonById } from "~/services/lessonService";
import { getModuleById } from "~/services/moduleService";
import { isUserEnrolled } from "~/services/enrollmentService";
import { createComment, deleteComment } from "~/services/commentService";
import { UserRole } from "~/db/schema";
import { parseParams, parseFormData } from "~/lib/validation";

const paramsSchema = z.object({
  lessonId: z.coerce.number().int(),
});

const createSchema = z.object({
  intent: z.literal("create"),
  body: z.string().min(1).max(10000),
});

const deleteSchema = z.object({
  intent: z.literal("delete"),
  commentId: z.coerce.number().int(),
});

export async function action({ params, request }: Route.ActionArgs) {
  const { lessonId } = parseParams(params, paramsSchema);

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    return data({ error: "Not authenticated" }, { status: 401 });
  }

  const user = getUserById(currentUserId);
  if (!user) {
    return data({ error: "User not found" }, { status: 401 });
  }

  const lesson = getLessonById(lessonId);
  if (!lesson) {
    return data({ error: "Lesson not found" }, { status: 404 });
  }

  const isPrivileged =
    user.role === UserRole.Instructor || user.role === UserRole.Admin;

  if (!isPrivileged) {
    const mod = getModuleById(lesson.moduleId);
    if (!mod || !isUserEnrolled(currentUserId, mod.courseId)) {
      return data({ error: "Not enrolled in this course" }, { status: 403 });
    }
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const parsed = parseFormData(formData, createSchema);
    if (!parsed.success) {
      return data({ error: "Invalid comment" }, { status: 400 });
    }
    createComment(currentUserId, lessonId, parsed.data.body);
    return data({ success: true });
  }

  if (intent === "delete") {
    const parsed = parseFormData(formData, deleteSchema);
    if (!parsed.success) {
      return data({ error: "Invalid request" }, { status: 400 });
    }
    const result = deleteComment(parsed.data.commentId, currentUserId, user.role);
    if (!result) {
      return data({ error: "Not authorized to delete this comment" }, { status: 403 });
    }
    return data({ success: true });
  }

  return data({ error: "Invalid intent" }, { status: 400 });
}
