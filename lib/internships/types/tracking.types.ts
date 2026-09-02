export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'interview_scheduled'
  | 'rejected'
  | 'offer'
  | 'accepted'
  | 'withdrawn';

export interface ApplicationDocumentRef {
  label: string;
  url: string;
  kind: 'resume' | 'cover_letter' | 'portfolio' | 'transcript' | 'other';
  uploadedAt: string;
}

export interface ApplicationRecord {
  id: string;
  userId: string;
  internshipId: string;
  status: ApplicationStatus;
  appliedAt: string | null;
  interviewAt: string | null;
  decisionAt: string | null;
  deadlineAt: string | null;
  notes: string | null;
  documents: ApplicationDocumentRef[];
  createdAt: string;
  updatedAt: string;
}

export interface StatusTransition {
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  at: string;
}

export type NotificationKind =
  | 'daily_digest'
  | 'weekly_digest'
  | 'new_internship'
  | 'deadline_reminder'
  | 'matching_internship'
  | 'company_alert'
  | 'role_alert';

export type NotificationChannel = 'in_app' | 'email' | 'push';

export interface NotificationPayload {
  title: string;
  body: string;
  url: string | null;
  internshipIds: string[];
  meta: Record<string, unknown>;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  kind: NotificationKind;
  channel: NotificationChannel;
  payload: NotificationPayload;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}
