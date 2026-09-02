/**
 * notification.repository.ts
 * DB-agnostic persistence interface for hackathon notifications.
 * Implemented against Supabase and injected into notification.service.ts.
 */

import { HackathonNotification, UserId } from "../models/hackathon.model";

export interface NotificationRepository {
  create(notification: HackathonNotification): Promise<HackathonNotification>;
  listPending(userId: UserId): Promise<HackathonNotification[]>;
  markSent(notificationId: string): Promise<void>;
}

export function createInMemoryNotificationRepository(): NotificationRepository {
  const store = new Map<string, HackathonNotification>();
  return {
    async create(notification) {
      store.set(notification.id, notification);
      return notification;
    },
    async listPending(userId) {
      return [...store.values()].filter((n) => n.userId === userId && !n.sent);
    },
    async markSent(notificationId) {
      const existing = store.get(notificationId);
      if (existing) store.set(notificationId, { ...existing, sent: true });
    },
  };
}
