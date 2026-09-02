/**
 * lib/hackathons/providers/notification.repository.supabase.ts
 *
 * Real Supabase-backed implementation of NotificationRepository
 * (tracking/notification.repository.ts), backed by
 * public.hackathon_notifications (0037_hackathon_engine.sql).
 */

import type { NotificationRepository } from "../tracking/notification.repository";
import type { HackathonNotification, UserId } from "../models/hackathon.model";

export interface MinimalSupabaseClient {
  from(table: string): any;
}

interface NotificationRow {
  id: string;
  user_id: string;
  hackathon_id: string;
  type: HackathonNotification["type"];
  message: string;
  trigger_at: string;
  sent: boolean;
}

function rowToNotification(row: NotificationRow): HackathonNotification {
  return {
    id: row.id,
    userId: row.user_id,
    hackathonId: row.hackathon_id,
    type: row.type,
    message: row.message,
    triggerAt: row.trigger_at,
    sent: row.sent,
  };
}

export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly client: MinimalSupabaseClient) {}

  async create(notification: HackathonNotification): Promise<HackathonNotification> {
    const { data, error } = await this.client
      .from("hackathon_notifications")
      .insert({
        user_id: notification.userId,
        hackathon_id: notification.hackathonId,
        type: notification.type,
        message: notification.message,
        trigger_at: notification.triggerAt,
        sent: notification.sent,
      })
      .select("*")
      .single();
    if (error) throw new Error(`SupabaseNotificationRepository.create failed: ${error.message}`);
    return rowToNotification(data as NotificationRow);
  }

  async listPending(userId: UserId): Promise<HackathonNotification[]> {
    const { data, error } = await this.client
      .from("hackathon_notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("sent", false)
      .order("trigger_at", { ascending: true });
    if (error) throw new Error(`SupabaseNotificationRepository.listPending failed: ${error.message}`);
    return (data as NotificationRow[]).map(rowToNotification);
  }

  async markSent(notificationId: string): Promise<void> {
    const { error } = await this.client.from("hackathon_notifications").update({ sent: true }).eq("id", notificationId);
    if (error) throw new Error(`SupabaseNotificationRepository.markSent failed: ${error.message}`);
  }
}
