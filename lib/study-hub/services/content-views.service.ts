import { ContentViewsRepository } from "../db/content-views.repository";
import type { ContentView, StudyEntityType } from "../types";

export class ContentViewsService {
  private readonly repo = new ContentViewsRepository();

  record(userId: string, entityType: StudyEntityType, entityId: string): Promise<void> {
    return this.repo.record(userId, entityType, entityId);
  }

  listRecent(userId: string, entityType?: StudyEntityType, limit = 20): Promise<ContentView[]> {
    return this.repo.listRecent(userId, entityType, limit);
  }
}
