import { AnalyticsService, ProviderService } from '@/lib/internships/services';
import { requireUser } from '@/lib/internships/http/auth';
import { fail, ok } from '@/lib/internships/http/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const analytics = new AnalyticsService();
const providers = new ProviderService();

/** GET /api/internships/analytics — platform-level metrics and provider health. */
export async function GET() {
  try {
    await requireUser();
    const [overview, providerList] = await Promise.all([
      analytics.overview(),
      providers.list(),
    ]);
    return ok({ overview, providers: providerList }, { cacheSeconds: 120 });
  } catch (error) {
    return fail(error);
  }
}
