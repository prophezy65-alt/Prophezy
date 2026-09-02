import { NotificationService, type DispatchSummary } from '../services';
import { createLogger } from '../utils/logger';

const log = createLogger('internships.job.notifications');

export type NotificationJob = 'daily' | 'weekly' | 'alerts' | 'deadlines';

export async function runNotificationJob(job: NotificationJob): Promise<DispatchSummary> {
  const service = new NotificationService();

  const summary = await (async (): Promise<DispatchSummary> => {
    switch (job) {
      case 'daily': return service.sendDigest('daily_digest');
      case 'weekly': return service.sendDigest('weekly_digest');
      case 'alerts': return service.sendNewInternshipAlerts(24);
      case 'deadlines': return service.sendDeadlineReminders();
    }
  })();

  log.info('notification job finished', { job, ...summary });
  return summary;
}
