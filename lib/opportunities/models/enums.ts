/**
 * lib/opportunities/models/enums.ts
 *
 * Canonical enums shared across the entire Opportunity Aggregation Engine.
 */

/**
 * Supported opportunity types. `OTHER` is the deliberate extension point
 * for "future opportunity types" called out in the spec — new concrete
 * types should still be added here over time (for typed filtering/search),
 * but `OTHER` guarantees the pipeline never rejects an opportunity solely
 * because its type hasn't been enumerated yet.
 */
export enum OpportunityType {
  INTERNSHIP = "internship",
  HACKATHON = "hackathon",
  JOB = "job",
  COMPETITION = "competition",
  OPEN_SOURCE_PROGRAM = "open_source_program",
  WORKSHOP = "workshop",
  BOOTCAMP = "bootcamp",
  CONFERENCE = "conference",
  WEBINAR = "webinar",
  OTHER = "other",
}

export enum OpportunityStatus {
  DRAFT = "draft", // ingested but not yet passed validation/dedup
  ACTIVE = "active",
  EXPIRED = "expired",
  ARCHIVED = "archived",
  REJECTED = "rejected", // failed validation
}

export enum WorkMode {
  REMOTE = "remote",
  HYBRID = "hybrid",
  ONSITE = "onsite",
  UNSPECIFIED = "unspecified",
}

export enum CompensationType {
  PAID = "paid",
  UNPAID = "unpaid",
  STIPEND = "stipend",
  EQUITY = "equity",
  UNSPECIFIED = "unspecified",
}

export enum ExperienceLevel {
  STUDENT = "student",
  ENTRY_LEVEL = "entry_level",
  MID_LEVEL = "mid_level",
  SENIOR = "senior",
  ANY = "any",
}

export enum ProviderKind {
  REST_API = "rest_api",
  RSS_FEED = "rss_feed",
  WEB_SCRAPER = "web_scraper",
  CSV_FEED = "csv_feed",
  GRAPHQL_API = "graphql_api",
  MANUAL_UPLOAD = "manual_upload",
}

export enum ProviderAuthType {
  NONE = "none",
  API_KEY = "api_key",
  OAUTH2 = "oauth2",
  BASIC_AUTH = "basic_auth",
  BEARER_TOKEN = "bearer_token",
}

export enum SyncTrigger {
  SCHEDULED = "scheduled",
  MANUAL = "manual",
  WEBHOOK = "webhook",
  BACKFILL = "backfill",
}

export enum SyncStatus {
  QUEUED = "queued",
  RUNNING = "running",
  SUCCEEDED = "succeeded",
  PARTIALLY_SUCCEEDED = "partially_succeeded",
  FAILED = "failed",
}

export enum ProviderHealthState {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  DOWN = "down",
  UNKNOWN = "unknown",
}

export enum DedupDecision {
  UNIQUE = "unique",
  DUPLICATE_MERGED = "duplicate_merged",
  DUPLICATE_DISCARDED = "duplicate_discarded",
  NEEDS_REVIEW = "needs_review",
}

export enum ValidationSeverity {
  ERROR = "error",
  WARNING = "warning",
}

export enum SearchSortField {
  RELEVANCE = "relevance",
  DEADLINE = "deadline",
  POSTED_DATE = "posted_date",
  TITLE = "title",
  ORGANIZATION = "organization",
}

export enum SortDirection {
  ASC = "asc",
  DESC = "desc",
}

export enum CacheNamespace {
  SEARCH_RESULTS = "search_results",
  OPPORTUNITY_DETAIL = "opportunity_detail",
  PROVIDER_HEALTH = "provider_health",
  FACETS = "facets",
  ANALYTICS_SNAPSHOT = "analytics_snapshot",
}
