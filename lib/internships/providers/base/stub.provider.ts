import type {
  FetchOptions,
  FetchResult,
  InternshipProvider,
  ProviderDescriptor,
  ProviderHealth,
} from '../../types';
import { isoNow } from '../../utils/date';

/**
 * Registered provider with no lawful programmatic integration available.
 *
 * It participates fully in the registry, scheduler and health dashboard, but
 * always returns zero results and never issues a network request. This is a
 * deliberate design choice: the alternative — extracting content these sources
 * do not license for aggregation — would violate their terms and the engine's
 * own security rules.
 *
 * To activate one: obtain official API/partner access, implement a subclass of
 * `BaseProvider`, and register it in `providers/index.ts`. Nothing else changes.
 */
export class StubProvider implements InternshipProvider {
  constructor(readonly descriptor: ProviderDescriptor) {}

  isConfigured(): boolean {
    return false;
  }

  async fetch(_options: FetchOptions = {}): Promise<FetchResult> {
    return {
      provider: this.descriptor.key,
      items: [],
      rawCount: 0,
      nextCursor: null,
      durationMs: 0,
      warnings: [this.descriptor.integrationNote],
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: this.descriptor.key,
      status: 'unsupported',
      reachable: false,
      latencyMs: null,
      message: this.descriptor.integrationNote,
      checkedAt: isoNow(),
    };
  }
}
