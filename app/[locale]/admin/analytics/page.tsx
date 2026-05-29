import { requireAdmin } from '@/lib/auth';
import type { Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/analytics-dashboard';

export const metadata: Metadata = { title: 'Analytics — molamaker admin' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  await requireAdmin();
  return <AnalyticsDashboard />;
}
