import type { ProviderDescriptor, ProviderHealth } from '../types';
import { createProvider, listDescriptors, listSyncableProviders } from '../providers';
import { SyncRepository } from '../db/repositories';
import { cache, cacheKey } from '../db/cache';
import { CACHE_TTL_SECONDS } from '../config/constants';
import { NotFoundError } from '../utils/errors';

export interface ProviderSummary extends ProviderDescriptor {
  configured: boolean;
  syncable: boolean;
  lastSyncAt: string | null;
  consecutiveFailures: number;
}

/** Read model over the provider registry — powers the admin dashboard. */
export class ProviderService {
  constructor(private readonly syncRepo = new SyncRepository()) {}

  async list(): Promise<ProviderSummary[]> {
    const syncable = new Set(listSyncableProviders().map((p) => p.descriptor.key));

    return Promise.all(
      listDescriptors().map(async (descriptor) => {
        const provider = createProvider(descriptor.key);
        const [lastSyncAt, state] = await Promise.all([
          this.syncRepo.lastSuccessfulSync(descriptor.key).catch(() => null),
          this.syncRepo.getProviderState(descriptor.key).catch(() => null),
        ]);
        return {
          ...descriptor,
          configured: provider?.isConfigured() ?? false,
          syncable: syncable.has(descriptor.key),
          lastSyncAt,
          consecutiveFailures: state?.consecutiveFailures ?? 0,
        };
      }),
    );
  }

  async get(key: string): Promise<ProviderSummary> {
    const found = (await this.list()).find((p) => p.key === key);
    if (!found) throw new NotFoundError('Provider', key);
    return found;
  }

  async health(key: string): Promise<ProviderHealth> {
    const provider = createProvider(key);
    if (!provider) throw new NotFoundError('Provider', key);
    return cache.remember(
      cacheKey('provider-health', { key }),
      CACHE_TTL_SECONDS.providerHealth,
      () => provider.healthCheck(),
    );
  }
}
