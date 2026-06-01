import { useState } from "react";
import { useFetcher } from "react-router";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

type DisplayProps = {
  mode: "display";
  average: number | null;
  count: number;
};

type InteractiveProps = {
  mode: "interactive";
  courseId: number;
  currentRating: number | null;
  average: number | null;
  count: number;
};

type StarRatingProps = DisplayProps | InteractiveProps;

function StarDisplay({
  average,
  count,
  size = "sm",
}: {
  average: number | null;
  count: number;
  size?: "sm" | "md";
}) {
  if (count === 0 || average === null) return null;

  const starSize = size === "md" ? "size-5" : "size-4";

  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            starSize,
            i < Math.round(average)
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted text-muted-foreground"
          )}
        />
      ))}
      <span className="text-xs text-muted-foreground">
        {average.toFixed(1)} ({count})
      </span>
    </span>
  );
}

function InteractiveStars({
  courseId,
  currentRating,
  average,
  count,
}: Omit<InteractiveProps, "mode">) {
  const fetcher = useFetcher();
  const [hovered, setHovered] = useState<number | null>(null);

  const submittingRating = fetcher.formData
    ? Number(fetcher.formData.get("rating"))
    : null;
  const displayRating = submittingRating ?? currentRating;
  const activeRating = hovered ?? displayRating;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        {currentRating ? "Your rating" : "Rate this course"}
      </div>
      <fetcher.Form
        method="post"
        action={`/api/courses/${courseId}/rating`}
        className="flex gap-0.5"
      >
        {Array.from({ length: 5 }, (_, i) => {
          const value = i + 1;
          return (
            <button
              key={value}
              type="submit"
              name="rating"
              value={value}
              onMouseEnter={() => setHovered(value)}
              onMouseLeave={() => setHovered(null)}
              className="p-0.5 transition-transform hover:scale-110 focus-visible:outline-none"
              aria-label={`Rate ${value} star${value !== 1 ? "s" : ""}`}
            >
              <Star
                className={cn(
                  "size-6",
                  activeRating !== null && value <= activeRating
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-muted text-muted-foreground"
                )}
              />
            </button>
          );
        })}
      </fetcher.Form>
      {count > 0 && average !== null && (
        <div className="text-xs text-muted-foreground">
          Average: {average.toFixed(1)} ({count}{" "}
          {count === 1 ? "rating" : "ratings"})
        </div>
      )}
    </div>
  );
}

export function StarRating(props: StarRatingProps) {
  if (props.mode === "display") {
    return (
      <StarDisplay average={props.average} count={props.count} size="sm" />
    );
  }

  return (
    <InteractiveStars
      courseId={props.courseId}
      currentRating={props.currentRating}
      average={props.average}
      count={props.count}
    />
  );
}
