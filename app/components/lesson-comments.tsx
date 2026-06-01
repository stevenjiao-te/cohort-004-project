import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { UserRole } from "~/db/schema";

type Comment = {
  id: number;
  bodyHtml: string;
  createdAt: string;
  userId: number;
  userName: string;
  userRole: string;
  userAvatarUrl: string | null;
};

type Props = {
  lessonId: number;
  comments: Comment[];
  currentUserId: number | null;
  currentUserRole: string | null;
  canComment: boolean;
};

export function LessonComments({
  lessonId,
  comments,
  currentUserId,
  currentUserRole,
  canComment,
}: Props) {
  const createFetcher = useFetcher({ key: `create-comment-${lessonId}` });
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSubmitting = createFetcher.state !== "idle";

  useEffect(() => {
    if (createFetcher.data?.success) {
      setBody("");
    }
  }, [createFetcher.data]);

  const isPrivileged =
    currentUserRole === UserRole.Instructor ||
    currentUserRole === UserRole.Admin;

  return (
    <div className="mt-12 border-t pt-8">
      <h2 className="mb-6 text-xl font-semibold">
        Discussion ({comments.length})
      </h2>

      {comments.length === 0 && (
        <p className="mb-8 text-sm text-muted-foreground">
          No comments yet. Be the first to start the discussion!
        </p>
      )}

      <div className="mb-8 space-y-6">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            lessonId={lessonId}
            canDelete={
              currentUserId === comment.userId || isPrivileged
            }
          />
        ))}
      </div>

      {canComment ? (
        <createFetcher.Form
          method="post"
          action={`/api/lessons/${lessonId}/comments`}
        >
          <input type="hidden" name="intent" value="create" />
          <div className="space-y-3">
            <textarea
              ref={textareaRef}
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment... (Markdown supported)"
              rows={4}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              required
            />
            <Button type="submit" disabled={!body.trim() || isSubmitting}>
              {isSubmitting ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </createFetcher.Form>
      ) : currentUserId === null ? (
        <p className="text-sm text-muted-foreground">
          Sign in to join the discussion.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enroll in this course to join the discussion.
        </p>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  lessonId,
  canDelete,
}: {
  comment: Comment;
  lessonId: number;
  canDelete: boolean;
}) {
  const deleteFetcher = useFetcher({ key: `delete-comment-${comment.id}` });

  if (deleteFetcher.data?.success) return null;

  const initials = comment.userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isInstructor =
    comment.userRole === UserRole.Instructor ||
    comment.userRole === UserRole.Admin;

  const formattedDate = new Date(comment.createdAt).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );

  return (
    <div className="flex gap-3">
      <div className="shrink-0">
        {comment.userAvatarUrl ? (
          <img
            src={comment.userAvatarUrl}
            alt={comment.userName}
            className="size-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {initials}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-medium">{comment.userName}</span>
          {isInstructor && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              Instructor
            </span>
          )}
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
          {canDelete && (
            <deleteFetcher.Form
              method="post"
              action={`/api/lessons/${lessonId}/comments`}
              className="ml-auto"
            >
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="commentId" value={comment.id} />
              <button
                type="submit"
                className="text-muted-foreground transition-colors hover:text-destructive"
                title="Delete comment"
              >
                <Trash2 className="size-3.5" />
              </button>
            </deleteFetcher.Form>
          )}
        </div>

        <div
          className="prose prose-neutral prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
        />
      </div>
    </div>
  );
}
