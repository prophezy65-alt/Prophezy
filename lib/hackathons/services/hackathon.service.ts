/**
 * hackathon.service.ts
 * Core CRUD/listing for normalized `Hackathon` records. DB-agnostic via a
 * `HackathonRepository` interface — implement against Supabase and inject.
 * Fetched-from-source hackathons are upserted here by provider.service.ts
 * after normalization + validation.
 */

import { Hackathon, HackathonId, HackathonFilters, CursorPage, ServiceResult, success, failure } from "../models/hackathon.model";
import { hackathonSchema, validate } from "../validation/hackathon.validation";
import { paginate } from "../utils/pagination";
import { calculateUrgency } from "../utils/timeline-calculator";

export interface HackathonRepository {
  upsert(hackathon: Hackathon): Promise<Hackathon>;
  upsertMany(hackathons: Hackathon[]): Promise<Hackathon[]>;
  getById(id: HackathonId): Promise<Hackathon | null>;
  listAll(): Promise<Hackathon[]>;
  deleteById(id: HackathonId): Promise<void>;
}

export function createInMemoryHackathonRepository(): HackathonRepository {
  const store = new Map<HackathonId, Hackathon>();
  return {
    async upsert(hackathon) {
      store.set(hackathon.id, hackathon);
      return hackathon;
    },
    async upsertMany(hackathons) {
      hackathons.forEach((h) => store.set(h.id, h));
      return hackathons;
    },
    async getById(id) {
      return store.get(id) ?? null;
    },
    async listAll() {
      return [...store.values()];
    },
    async deleteById(id) {
      store.delete(id);
    },
  };
}

function applyFilters(hackathons: Hackathon[], filters?: HackathonFilters): Hackathon[] {
  if (!filters) return hackathons;

  return hackathons.filter((h) => {
    if (filters.country && h.country?.toLowerCase() !== filters.country.toLowerCase()) return false;
    if (filters.mode && !filters.mode.includes(h.mode)) return false;
    if (filters.experienceTier && !filters.experienceTier.some((t) => h.experienceTier.includes(t))) return false;
    if (filters.eligibility && !filters.eligibility.some((e) => h.eligibility.includes(e))) return false;
    if (filters.minPrizePoolUsd && (h.prizes.totalPoolUsd ?? 0) < filters.minPrizePoolUsd) return false;
    if (filters.technologies && !filters.technologies.some((t) => h.technologies.some((ht) => ht.toLowerCase() === t.toLowerCase())))
      return false;
    if (filters.themes && !filters.themes.some((t) => h.themes.some((ht) => ht.toLowerCase() === t.toLowerCase())))
      return false;
    if (
      filters.registrationDeadlineBefore &&
      h.timeline.registrationClosesAt &&
      new Date(h.timeline.registrationClosesAt) > new Date(filters.registrationDeadlineBefore)
    )
      return false;
    if (
      filters.submissionDeadlineBefore &&
      new Date(h.timeline.submissionDeadline) > new Date(filters.submissionDeadlineBefore)
    )
      return false;
    return true;
  });
}

export type HackathonSort = "deadline_asc" | "deadline_desc" | "prize_desc" | "newest";

function sortHackathons(hackathons: Hackathon[], sort: HackathonSort): Hackathon[] {
  const sorted = [...hackathons];
  switch (sort) {
    case "deadline_desc":
      return sorted.sort((a, b) => new Date(b.timeline.submissionDeadline).getTime() - new Date(a.timeline.submissionDeadline).getTime());
    case "prize_desc":
      return sorted.sort((a, b) => (b.prizes.totalPoolUsd ?? 0) - (a.prizes.totalPoolUsd ?? 0));
    case "newest":
      return sorted.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
    case "deadline_asc":
    default:
      return sorted.sort((a, b) => new Date(a.timeline.submissionDeadline).getTime() - new Date(b.timeline.submissionDeadline).getTime());
  }
}

export class HackathonService {
  constructor(private readonly repo: HackathonRepository) {}

  async upsertValidated(hackathon: Hackathon): Promise<ServiceResult<Hackathon>> {
    const validation = validate(hackathonSchema, hackathon);
    if (!validation.success) {
      return failure("VALIDATION_FAILED", "Hackathon failed schema validation.", validation.errors);
    }
    const saved = await this.repo.upsert(validation.data);
    return success(saved);
  }

  async upsertManyValidated(hackathons: Hackathon[]): Promise<ServiceResult<Hackathon[]>> {
    const valid: Hackathon[] = [];
    const errors: unknown[] = [];

    for (const h of hackathons) {
      const validation = validate(hackathonSchema, h);
      if (validation.success) valid.push(validation.data);
      else errors.push({ id: h.id, errors: validation.errors });
    }

    const saved = await this.repo.upsertMany(valid);
    return success(saved);
  }

  async getById(id: HackathonId): Promise<ServiceResult<Hackathon>> {
    const hackathon = await this.repo.getById(id);
    if (!hackathon) return failure("NOT_FOUND", `Hackathon "${id}" not found.`);
    return success(hackathon);
  }

  /**
   * Lists hackathons with filters + cursor pagination, excluding hackathons
   * whose submission deadline has already passed unless explicitly
   * requested via filters.
   */
  async list(
    filters: HackathonFilters | undefined,
    cursor: string | undefined,
    limit = 20,
    includePast = false,
    sort: HackathonSort = "deadline_asc"
  ): Promise<ServiceResult<CursorPage<Hackathon>>> {
    const all = await this.repo.listAll();
    let filtered = applyFilters(all, filters);

    if (!includePast) {
      filtered = filtered.filter((h) => calculateUrgency(h.timeline.submissionDeadline) !== "past");
    }

    filtered = sortHackathons(filtered, sort);

    return success(paginate(filtered, cursor, limit));
  }

  async deleteById(id: HackathonId): Promise<ServiceResult<null>> {
    await this.repo.deleteById(id);
    return success(null);
  }
}
