import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/admin.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getPlatformAnalytics,
  type TimePeriod,
} from "~/services/analyticsService";
import { formatPrice } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  AlertTriangle,
  BarChart3,
  DollarSign,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { data, isRouteErrorResponse } from "react-router";

const VALID_PERIODS = new Set<TimePeriod>(["7d", "30d", "12m", "all"]);

function isValidPeriod(value: string | null): value is TimePeriod {
  return value !== null && VALID_PERIODS.has(value as TimePeriod);
}

export function meta() {
  return [
    { title: "Platform Analytics — Cadence" },
    { name: "description", content: "Platform-wide revenue and enrollment analytics" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", { status: 403 });
  }

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period: TimePeriod = isValidPeriod(periodParam) ? periodParam : "30d";

  const analytics = getPlatformAnalytics({ period });

  return { analytics, period };
}

const PERIOD_LABELS: { value: TimePeriod; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "12m", label: "12 Months" },
  { value: "all", label: "All Time" },
];

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const { analytics, period } = loaderData;
  const { totalRevenue, totalEnrollments, topCourse } = analytics;
  const [, setSearchParams] = useSearchParams();

  const hasData = totalRevenue > 0 || totalEnrollments > 0;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Platform Analytics</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Revenue and enrollment metrics across all courses
        </p>
      </div>

      <Tabs
        value={period}
        onValueChange={(value) => setSearchParams({ period: value })}
        className="mb-6"
      >
        <TabsList>
          {PERIOD_LABELS.map((p) => (
            <TabsTrigger key={p.value} value={p.value}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No revenue or enrollment data for this time period.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue
              </CardTitle>
              <DollarSign className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPrice(totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                across all courses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Enrollments
              </CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEnrollments}</div>
              <p className="text-xs text-muted-foreground">
                {totalEnrollments === 1 ? "student enrolled" : "students enrolled"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Top Earning Course
              </CardTitle>
              <Trophy className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {topCourse ? (
                <>
                  <div className="text-2xl font-bold">
                    {formatPrice(topCourse.revenue)}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {topCourse.title}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No sales yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
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
          : "Only admins can access this page.";
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
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
