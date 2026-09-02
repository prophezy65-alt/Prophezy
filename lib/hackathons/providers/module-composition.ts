/**
 * lib/hackathons/providers/module-composition.ts
 *
 * Single place that wires every hackathon service against its real
 * Supabase-backed repository, per the README's "Wiring into the app"
 * section. API routes call buildHackathonModule() once per request
 * instead of repeating this construction.
 *
 * Vector search is intentionally NOT wired (SearchService's
 * vectorSearchRepo/embed params stay undefined) — keyword search is the
 * active, working path; see search.service.ts's own design (vector search
 * is an optional enhancement, not required for search to function).
 * AnalysisService/IdeaService (which need Project Generator/Resume Studio
 * module-provider adapters) are also not wired here — out of scope for
 * "make the Hackathons module functional" per the listing/search/save/
 * register/recommend/reminders feature set actually requested.
 */

import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import { HackathonService } from "../services/hackathon.service";
import { SearchService } from "../services/search.service";
import { RankingService } from "../services/ranking.service";
import { RecommendationService } from "../services/recommendation.service";
import { TrackingService } from "../services/tracking.service";
import { NotificationService } from "../services/notification.service";
import { ProviderService } from "../services/provider.service";
import { createDefaultSourceRegistry } from "./sources/source-registry";
import { SupabaseHackathonRepository } from "./hackathon.repository.supabase";
import { SupabaseTrackingRepository } from "./tracking.repository.supabase";
import { SupabaseNotificationRepository } from "./notification.repository.supabase";
import { createRealAiCoreClient } from "./ai-core.adapter";

export interface HackathonModule {
  hackathonService: HackathonService;
  searchService: SearchService;
  rankingService: RankingService;
  recommendationService: RecommendationService;
  trackingService: TrackingService;
  notificationService: NotificationService;
  providerService: ProviderService;
}

export async function buildHackathonModule(): Promise<HackathonModule> {
  const supabase = await getSupabaseServerClient();

  const hackathonRepo = new SupabaseHackathonRepository(supabase);
  const trackingRepo = new SupabaseTrackingRepository(supabase);
  const notificationRepo = new SupabaseNotificationRepository(supabase);

  const hackathonService = new HackathonService(hackathonRepo);
  const searchService = new SearchService(hackathonService);
  const rankingService = new RankingService(hackathonService);
  const recommendationService = new RecommendationService(rankingService, createRealAiCoreClient());
  const trackingService = new TrackingService(trackingRepo);
  const notificationService = new NotificationService(notificationRepo);
  const providerService = new ProviderService(createDefaultSourceRegistry(), hackathonService);

  return {
    hackathonService,
    searchService,
    rankingService,
    recommendationService,
    trackingService,
    notificationService,
    providerService,
  };
}
