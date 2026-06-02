import { Link } from "react-router";
import type { Route } from "./+types/instructor.$courseId.analytics";
import { getCourseById } from "~/services/courseService";
import { getCourseAnalytics } from "~/services/analyticsService";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import { formatPrice } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AlertTriangle, ArrowLeft, DollarSign, Users, TrendingUp, BookOpen, BarChart2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { data, isRouteErrorResponse } from "react-router";
import { z } from "zod";
import { parseParams } from "~/lib/validation";

const analyticsParamsSchema = z.object({
  courseId: z.coerce.number().int(),
});

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Course Analytics";
  return [
    { title: `Analytics: ${title} — Cadence` },
    { name: "description", content: `Analytics for ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)) {
    throw data("Only instructors and admins can access this page.", {
      status: 403,
    });
  }

  const { courseId } = parseParams(params, analyticsParamsSchema);

  const course = getCourseById(courseId);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId && user.role !== UserRole.Admin) {
    throw data("You can only view analytics for your own courses.", {
      status: 403,
    });
  }

  const analytics = getCourseAnalytics({ courseId });

  return { course, analytics };
}

export default function InstructorCourseAnalytics({
  loaderData,
}: Route.ComponentProps) {
  const { course, analytics } = loaderData;
  const {
    enrollmentCount,
    courseEarnings,
    completionRate,
    lessonFunnel,
    quizHistograms,
  } = analytics;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/instructor/${course.id}`}
          className="hover:text-foreground"
        >
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <Link
        to={`/instructor/${course.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to Course Editor
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">{course.title}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Enrollments
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrollmentCount}</div>
            <p className="text-xs text-muted-foreground">
              {enrollmentCount === 1 ? "student enrolled" : "students enrolled"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Earnings
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(courseEarnings)}
            </div>
            <p className="text-xs text-muted-foreground">all-time revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completion Rate
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              of enrolled students finished
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lesson Drop-off Funnel */}
      <div className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="size-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Lesson Drop-off Funnel</h2>
        </div>

        {lessonFunnel.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No lessons found for this course.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {lessonFunnel.map((mod) => (
              <Card key={mod.moduleId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{mod.moduleTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mod.lessons.map((lesson) => (
                    <div key={lesson.lessonId}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="truncate pr-4">{lesson.lessonTitle}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {lesson.studentCount}{" "}
                          {lesson.studentCount === 1 ? "student" : "students"}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${lesson.barWidth}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* Quiz Score Histograms */}
      <div className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <BarChart2 className="size-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Quiz Score Distributions</h2>
        </div>

        {quizHistograms.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No quizzes found for this course.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {quizHistograms.map((quiz) => (
              <Card key={quiz.quizId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{quiz.quizTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!quiz.hasAttempts ? (
                    <p className="text-sm text-muted-foreground">
                      No attempts yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {quiz.buckets.map((bucket) => (
                        <div key={bucket.label}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {bucket.label}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {bucket.count}{" "}
                              {bucket.count === 1 ? "student" : "students"}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${bucket.barWidth}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Course not found";
      message =
        "The course you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to view this page.";
    } else {
      title = `Error ${error.status}`;
      message =
        typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
