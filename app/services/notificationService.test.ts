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

import {
  createNotification,
  getNotificationById,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./notificationService";

describe("notificationService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  function makeNotification(overrides: Partial<Parameters<typeof createNotification>[0]> = {}) {
    return createNotification({
      recipientUserId: base.instructor.id,
      type: schema.NotificationType.Enrollment,
      title: "New Enrollment",
      message: "Test User enrolled in Test Course",
      linkUrl: `/instructor/${base.course.id}/students`,
      ...overrides,
    });
  }

  describe("createNotification", () => {
    it("creates a notification with all fields", () => {
      const n = makeNotification();

      expect(n).toBeDefined();
      expect(n.recipientUserId).toBe(base.instructor.id);
      expect(n.type).toBe(schema.NotificationType.Enrollment);
      expect(n.title).toBe("New Enrollment");
      expect(n.message).toBe("Test User enrolled in Test Course");
      expect(n.linkUrl).toBe(`/instructor/${base.course.id}/students`);
      expect(n.isRead).toBe(false);
      expect(n.createdAt).toBeDefined();
    });

    it("defaults isRead to false", () => {
      const n = makeNotification();
      expect(n.isRead).toBe(false);
    });
  });

  describe("getNotificationById", () => {
    it("returns a notification by id", () => {
      const n = makeNotification();
      const found = getNotificationById(n.id);
      expect(found?.id).toBe(n.id);
    });

    it("returns undefined for a non-existent id", () => {
      expect(getNotificationById(9999)).toBeUndefined();
    });
  });

  describe("getNotifications", () => {
    it("returns notifications for a user ordered newest first", () => {
      makeNotification({ message: "First" });
      makeNotification({ message: "Second" });
      makeNotification({ message: "Third" });

      const results = getNotifications(base.instructor.id, 10, 0);
      expect(results).toHaveLength(3);
      expect(results[0].message).toBe("Third");
      expect(results[1].message).toBe("Second");
      expect(results[2].message).toBe("First");
    });

    it("respects the limit parameter", () => {
      makeNotification();
      makeNotification();
      makeNotification();

      const results = getNotifications(base.instructor.id, 2, 0);
      expect(results).toHaveLength(2);
    });

    it("respects the offset parameter", () => {
      makeNotification({ message: "First" });
      makeNotification({ message: "Second" });
      makeNotification({ message: "Third" });

      const results = getNotifications(base.instructor.id, 10, 1);
      expect(results).toHaveLength(2);
      expect(results[0].message).toBe("Second");
    });

    it("returns empty array when user has no notifications", () => {
      expect(getNotifications(base.user.id, 10, 0)).toHaveLength(0);
    });

    it("does not return notifications belonging to another user", () => {
      makeNotification({ recipientUserId: base.instructor.id });
      expect(getNotifications(base.user.id, 10, 0)).toHaveLength(0);
    });
  });

  describe("getUnreadCount", () => {
    it("returns the count of unread notifications", () => {
      makeNotification();
      makeNotification();
      const read = makeNotification();
      markAsRead(read.id);

      expect(getUnreadCount(base.instructor.id)).toBe(2);
    });

    it("returns 0 when all notifications are read", () => {
      const n = makeNotification();
      markAsRead(n.id);
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("returns 0 when user has no notifications", () => {
      expect(getUnreadCount(base.user.id)).toBe(0);
    });

    it("does not count notifications belonging to another user", () => {
      makeNotification({ recipientUserId: base.instructor.id });
      expect(getUnreadCount(base.user.id)).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read", () => {
      const n = makeNotification();
      const updated = markAsRead(n.id);
      expect(updated?.isRead).toBe(true);
    });

    it("does not affect other notifications", () => {
      const n1 = makeNotification();
      const n2 = makeNotification();
      markAsRead(n1.id);

      const stillUnread = getNotificationById(n2.id);
      expect(stillUnread?.isRead).toBe(false);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications for a user as read", () => {
      makeNotification();
      makeNotification();

      markAllAsRead(base.instructor.id);
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("does not affect notifications for other users", () => {
      makeNotification({ recipientUserId: base.instructor.id });
      const otherNotif = makeNotification({ recipientUserId: base.user.id });

      markAllAsRead(base.instructor.id);

      const stillUnread = getNotificationById(otherNotif.id);
      expect(stillUnread?.isRead).toBe(false);
    });
  });
});
