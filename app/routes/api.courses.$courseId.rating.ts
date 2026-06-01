import { data } from "react-router";
import type { Route } from "./+types/api.courses.$courseId.rating";
import { getCurrentUserId } from "~/lib/session";
import { isUserEnrolled } from "~/services/enrollmentService";
import { upsertRating } from "~/services/ratingService";

export async function action({ params, request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    return data({ error: "Not authenticated" }, { status: 401 });
  }

  const courseId = Number(params.courseId);
  if (!Number.isFinite(courseId)) {
    return data({ error: "Invalid course" }, { status: 400 });
  }

  if (!isUserEnrolled(currentUserId, courseId)) {
    return data({ error: "Not enrolled in this course" }, { status: 403 });
  }

  const formData = await request.formData();
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return data({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  upsertRating(currentUserId, courseId, rating);
  return data({ success: true });
}
