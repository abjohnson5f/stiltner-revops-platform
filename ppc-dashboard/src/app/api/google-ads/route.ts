import { NextRequest, NextResponse } from 'next/server';
import { getAccountMetrics, getDailyStats, isGoogleAdsConfigured } from '@/lib/google-ads';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource') || 'account';
    const dateRange = searchParams.get('dateRange') || 'LAST_7_DAYS';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    switch (resource) {
      case 'account':
      case 'campaigns': {
        const metrics = await getAccountMetrics(dateRange);
        return NextResponse.json({
          success: true,
          data: resource === 'campaigns' ? metrics.campaigns : metrics,
          meta: {
            source: isGoogleAdsConfigured() ? 'api' : 'mock',
            dateRange,
          },
        });
      }
      
      case 'daily': {
        if (!startDate || !endDate) {
          return NextResponse.json(
            { success: false, error: 'startDate and endDate required for daily stats' },
            { status: 400 }
          );
        }
        const stats = await getDailyStats(startDate, endDate);
        return NextResponse.json({
          success: true,
          data: stats,
          meta: {
            source: isGoogleAdsConfigured() ? 'api' : 'mock',
            startDate,
            endDate,
          },
        });
      }
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown resource: ${resource}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Google Ads API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch Google Ads data' 
      },
      { status: 500 }
    );
  }
}
