import { BookmarksRepository } from "../db/bookmarks.repository";
import type { Bookmark, StudyEntityType } from "../types";

export class BookmarksService {
  private readonly repo = new BookmarksRepository();

  list(userId: string, entityType?: StudyEntityType): Promise<Bookmark[]> {
    return this.repo.list(userId, entityType);
  }

  add(userId: string, entityType: StudyEntityType, entityId: string): Promise<Bookmark> {
    return this.repo.add(userId, entityType, entityId);
  }

  remove(userId: string, entityType: StudyEntityType, entityId: string): Promise<void> {
    return this.repo.remove(userId, entityType, entityId);
  }
}
