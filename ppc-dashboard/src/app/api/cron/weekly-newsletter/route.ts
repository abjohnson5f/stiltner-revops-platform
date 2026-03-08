import { NextRequest, NextResponse } from 'next/server';
import { generateNewsletter } from '@/lib/ppc-agent';

/**
 * Weekly Newsletter Cron Job
 * 
 * This endpoint is designed to be called by a cron job service (e.g., Vercel Cron, cron-job.org)
 * It automatically generates and optionally schedules a weekly newsletter.
 * 
 * Security: Requires CRON_SECRET in Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Determine seasonal theme based on current month
    const month = new Date().getMonth();
    const seasonalTheme = 
      month >= 2 && month <= 4 ? 'spring' :
      month >= 5 && month <= 7 ? 'summer' :
      month >= 8 && month <= 10 ? 'fall' : 'winter';

    // Generate newsletter
    const newsletter = await generateNewsletter({
      topics: ['Seasonal Tips', 'Service Spotlight'],
      seasonalTheme: seasonalTheme as 'spring' | 'summer' | 'fall' | 'winter',
    });

    // TODO: Integrate with Beehiiv API to schedule newsletter
    // This would typically:
    // 1. Create a draft in Beehiiv
    // 2. Schedule it for the next Wednesday
    // 3. Notify team via Google Chat webhook

    // For now, just return the generated newsletter
    return NextResponse.json({
      success: true,
      data: {
        newsletter,
        scheduledFor: getNextWednesday(),
        action: 'generated', // Will be 'scheduled' once Beehiiv is integrated
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Weekly newsletter cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cron job failed',
      },
      { status: 500 }
    );
  }
}

// Helper to get the next Wednesday date
function getNextWednesday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7; // Wednesday = 3
  const nextWednesday = new Date(now);
  nextWednesday.setDate(now.getDate() + daysUntilWednesday);
  nextWednesday.setHours(9, 0, 0, 0); // 9 AM
  return nextWednesday.toISOString();
}
