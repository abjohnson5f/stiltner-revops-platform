import { NextRequest, NextResponse } from 'next/server';

// GA4 API types
interface GA4Row {
  date?: string;
  source?: string;
  medium?: string;
  sessions: number;
  users: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversions: number;
}

interface GA4Totals {
  sessions: number;
  users: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversions: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metrics = searchParams.get('metrics') || 'sessions,users,bounceRate';
    const dimensions = searchParams.get('dimensions') || 'date';
    const startDate = searchParams.get('startDate') || '7daysAgo';
    const endDate = searchParams.get('endDate') || 'today';
    
    // Check for required environment variables
    const propertyId = process.env.GA4_PROPERTY_ID;
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    
    if (!propertyId || !serviceAccountJson) {
      // Return mock data if credentials not configured
      return NextResponse.json({
        success: true,
        data: getMockGA4Data(dimensions),
        meta: {
          source: 'mock',
          message: 'GA4 credentials not configured. Returning mock data.',
        },
      });
    }
    
    // In production, this would use the GA4 Data API
    // @google-analytics/data package is installed for this purpose
    
    try {
      const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
      
      const credentials = JSON.parse(serviceAccountJson);
      const analyticsDataClient = new BetaAnalyticsDataClient({ credentials });
      
      // Parse metrics and dimensions
      const metricList = metrics.split(',').map(m => ({ name: m.trim() }));
      const dimensionList = dimensions.split(',').map(d => ({ name: d.trim() }));
      
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        metrics: metricList,
        dimensions: dimensionList,
      });
      
      // Format response
      const rows: GA4Row[] = (response.rows || []).map((row: any) => {
        const result: any = {};
        
        // Map dimensions
        dimensionList.forEach((dim, i) => {
          result[dim.name] = row.dimensionValues?.[i]?.value;
        });
        
        // Map metrics
        metricList.forEach((metric, i) => {
          const value = row.metricValues?.[i]?.value;
          result[metric.name] = metric.name.includes('Rate') || metric.name.includes('Duration')
            ? parseFloat(value || '0')
            : parseInt(value || '0');
        });
        
        return result as GA4Row;
      });
      
      // Calculate totals
      const totals: GA4Totals = {
        sessions: rows.reduce((sum, r) => sum + (r.sessions || 0), 0),
        users: rows.reduce((sum, r) => sum + (r.users || 0), 0),
        bounceRate: rows.length > 0 
          ? rows.reduce((sum, r) => sum + (r.bounceRate || 0), 0) / rows.length 
          : 0,
        avgSessionDuration: rows.length > 0
          ? rows.reduce((sum, r) => sum + (r.avgSessionDuration || 0), 0) / rows.length
          : 0,
        conversions: rows.reduce((sum, r) => sum + (r.conversions || 0), 0),
      };
      
      return NextResponse.json({
        success: true,
        data: { rows, totals },
        meta: { source: 'api', startDate, endDate },
      });
      
    } catch (apiError) {
      console.error('GA4 API call failed:', apiError);
      // Return mock data as fallback
      return NextResponse.json({
        success: true,
        data: getMockGA4Data(dimensions),
        meta: {
          source: 'mock',
          error: apiError instanceof Error ? apiError.message : 'API call failed',
        },
      });
    }
    
  } catch (error) {
    console.error('GA4 API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch GA4 data' 
      },
      { status: 500 }
    );
  }
}

// Generate mock GA4 data for development/demo
function getMockGA4Data(dimensions: string): { rows: GA4Row[]; totals: GA4Totals } {
  const hasDates = dimensions.includes('date');
  const hasSources = dimensions.includes('source');
  
  let rows: GA4Row[] = [];
  
  if (hasDates && !hasSources) {
    // Last 7 days of data
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      rows.push({
        date: date.toISOString().split('T')[0].replace(/-/g, ''),
        sessions: Math.floor(Math.random() * 100) + 50,
        users: Math.floor(Math.random() * 80) + 40,
        bounceRate: Math.random() * 0.3 + 0.4,
        avgSessionDuration: Math.random() * 120 + 60,
        conversions: Math.floor(Math.random() * 5),
      });
    }
  } else if (hasSources) {
    // By source
    const sources = ['google', 'direct', 'facebook', 'bing', 'organic'];
    rows = sources.map(source => ({
      source,
      sessions: Math.floor(Math.random() * 200) + 20,
      users: Math.floor(Math.random() * 150) + 15,
      bounceRate: Math.random() * 0.3 + 0.4,
      avgSessionDuration: Math.random() * 120 + 60,
      conversions: Math.floor(Math.random() * 8),
    }));
  } else {
    // Default aggregated
    rows = [{
      sessions: 487,
      users: 412,
      bounceRate: 0.52,
      avgSessionDuration: 94,
      conversions: 18,
    }];
  }
  
  const totals: GA4Totals = {
    sessions: rows.reduce((sum, r) => sum + r.sessions, 0),
    users: rows.reduce((sum, r) => sum + r.users, 0),
    bounceRate: rows.length > 0 
      ? rows.reduce((sum, r) => sum + r.bounceRate, 0) / rows.length 
      : 0,
    avgSessionDuration: rows.length > 0
      ? rows.reduce((sum, r) => sum + r.avgSessionDuration, 0) / rows.length
      : 0,
    conversions: rows.reduce((sum, r) => sum + r.conversions, 0),
  };
  
  return { rows, totals };
}
