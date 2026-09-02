export { AggregatorService, type AggregationOutcome } from './aggregator.service';
export { AnalyticsService, type AnalyticsOverview } from './analytics.service';
export { DeduplicationService, type DedupeResult } from './deduplication.service';
export { MatcherService } from './matcher.service';
export { NormalizerService } from './normalizer.service';
export {
  NotificationService,
  setNotificationTransport,
  clearNotificationTransports,
  type DispatchSummary,
  type NotificationTransport,
} from './notification.service';
export { ProviderService, type ProviderSummary } from './provider.service';
export { RankingService, type RankingSignals } from './ranking.service';
export { RecommendationService, type RecommendationBundle } from './recommendation.service';
export { SearchService } from './search.service';
export { SyncService, type SyncSummary } from './sync.service';
export { TrackingService, type TrackedApplication } from './tracking.service';
