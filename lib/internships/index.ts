/**
 * Prophezy — Internship Discovery & Aggregation Engine
 * Public surface. Application code should import from here, not from deep paths.
 */

export * from './types';

export {
  AggregatorService,
  AnalyticsService,
  DeduplicationService,
  MatcherService,
  NormalizerService,
  NotificationService,
  ProviderService,
  RankingService,
  RecommendationService,
  SearchService,
  SyncService,
  TrackingService,
} from './services';

export type {
  AggregationOutcome,
  AnalyticsOverview,
  DedupeResult,
  DispatchSummary,
  ProviderSummary,
  RankingSignals,
  RecommendationBundle,
  SyncSummary,
  TrackedApplication,
} from './services';

export { createProvider, listProviders, listDescriptors, listSyncableProviders } from './providers';
export { BaseProvider, StubProvider, buildPosting, looksLikeInternship } from './providers';
export type { RawPosting } from './providers';

export { setAIRunner, getAIRunner, isHostEngineBound } from './ai/engine.adapter';

export { ALL_DESCRIPTORS, IMPLEMENTED_PROVIDERS, STUB_PROVIDERS, getDescriptor } from './config/provider-registry';
export { getEnv } from './config/env';

export { cache, cacheKey } from './db/cache';
export { getServiceClient } from './db/client';
export {
  InternshipRepository,
  RecommendationRepository,
  SyncRepository,
  TrackingRepository,
  UserRepository,
} from './db/repositories';

export * from './utils/errors';
export { logger, createLogger } from './utils/logger';
