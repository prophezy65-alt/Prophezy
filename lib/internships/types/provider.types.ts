import type { NormalizedInternship } from './internship.types';

export type ProviderRegion = 'india' | 'international' | 'global';

export type ProviderKind =
  | 'ats'
  | 'aggregator'
  | 'board'
  | 'portal'
  | 'partner';

export type ProviderStatus =
  | 'active'
  | 'degraded'
  | 'disabled'
  | 'unsupported'
  | 'unconfigured';

export interface ProviderCapabilities {
  incrementalSync: boolean;
  keywordQuery: boolean;
  locationQuery: boolean;
  remoteFilter: boolean;
  pagination: boolean;
  providesSalary: boolean;
  providesDeadline: boolean;
}

export interface ProviderRateLimit {
  requestsPerMinute: number;
  concurrency: number;
  minDelayMs: number;
}

export interface ProviderDescriptor {
  key: string;
  label: string;
  kind: ProviderKind;
  region: ProviderRegion;
  homepage: string;
  status: ProviderStatus;
  capabilities: ProviderCapabilities;
  rateLimit: ProviderRateLimit;
  requiredEnv: string[];
  integrationNote: string;
}

export interface FetchOptions {
  since?: string;
  query?: string;
  location?: string;
  remoteOnly?: boolean;
  page?: number;
  perPage?: number;
  maxItems?: number;
  signal?: AbortSignal;
}

export interface FetchResult {
  provider: string;
  items: NormalizedInternship[];
  rawCount: number;
  nextCursor: string | null;
  durationMs: number;
  warnings: string[];
}

export interface ProviderHealth {
  provider: string;
  status: ProviderStatus;
  reachable: boolean;
  latencyMs: number | null;
  message: string;
  checkedAt: string;
}

export interface InternshipProvider {
  readonly descriptor: ProviderDescriptor;
  isConfigured(): boolean;
  fetch(options: FetchOptions): Promise<FetchResult>;
  healthCheck(): Promise<ProviderHealth>;
}
