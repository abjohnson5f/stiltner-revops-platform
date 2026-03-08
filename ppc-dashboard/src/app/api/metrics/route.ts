import { NextRequest, NextResponse } from 'next/server';
import { sql, isDatabaseConfigured, getDateRangeSQL, mapSourceToChannel, type Lead, type MetricsSummary, type ChannelMetrics, type TrendDataPoint, type LeadSummary } from '@/lib/db';
import { getAccountMetrics } from '@/lib/google-ads';

// Generate mock data for demo purposes (only used if everything fails)
// Data from Google Ads export: Jan 2 - Jan 22, 2026
function getMockData(range: string) {
  const now = new Date();
  
  // Use REAL data from Google Ads export as fallback
  // Data from Jan 5-22, 2026:
  // All-time: $2,111.82 spend, 299 clicks, 19,795 impressions, 11 conversions
  // Last 7 days: $796.63 spend, 137 clicks, 9,428 impressions, 2 conversions
  let totalSpend = 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalConversions = 0;
  
  // Select data based on range
  switch (range) {
    case 'today':
    case '24h':
      totalSpend = 84.96;
      totalClicks = 6;
      totalImpressions = 197;
      totalConversions = 1;
      break;
    case '7d':
      totalSpend = 796.63;
      totalClicks = 137;
      totalImpressions = 9428;
      totalConversions = 2;
      break;
    case '30d':
    case 'quarter':
    case 'all':
    default:
      totalSpend = 2111.82;
      totalClicks = 299;
      totalImpressions = 19795;
      totalConversions = 11;
  }
  
  // Daily breakdown from Google Ads export
  // Using conversions as leads (Google Ads conversions = form submissions)
  const allTrends: TrendDataPoint[] = [
    { date: '2026-01-05', leads: 0, spend: 3.85, conversions: 0 },
    { date: '2026-01-06', leads: 0, spend: 47.49, conversions: 0 },
    { date: '2026-01-07', leads: 1, spend: 101.13, conversions: 1 },
    { date: '2026-01-08', leads: 0, spend: 49.41, conversions: 0 },
    { date: '2026-01-09', leads: 0, spend: 99.64, conversions: 0 },
    { date: '2026-01-10', leads: 0, spend: 119.25, conversions: 0 },
    { date: '2026-01-11', leads: 0, spend: 115.65, conversions: 0 },
    { date: '2026-01-12', leads: 2, spend: 205.33, conversions: 2 },
    { date: '2026-01-13', leads: 2, spend: 199.30, conversions: 2 },
    { date: '2026-01-14', leads: 3, spend: 167.16, conversions: 3 },
    { date: '2026-01-15', leads: 1, spend: 206.98, conversions: 1 },
    { date: '2026-01-16', leads: 0, spend: 180.80, conversions: 0 },
    { date: '2026-01-17', leads: 1, spend: 85.56, conversions: 1 },
    { date: '2026-01-18', leads: 0, spend: 140.26, conversions: 0 },
    { date: '2026-01-19', leads: 0, spend: 93.27, conversions: 0 },
    { date: '2026-01-20', leads: 0, spend: 96.02, conversions: 0 },
    { date: '2026-01-21', leads: 0, spend: 115.76, conversions: 0 },
    { date: '2026-01-22', leads: 1, spend: 84.96, conversions: 1 },
  ];
  
  // Return appropriate slice based on range
  let trends: TrendDataPoint[];
  switch (range) {
    case 'today':
    case '24h':
      trends = allTrends.slice(-1);
      break;
    case '7d':
      trends = allTrends.slice(-7);
      break;
    case '30d':
      trends = allTrends; // We only have 18 days of data
      break;
    case 'quarter':
    case 'all':
    default:
      trends = allTrends;
  }
  
  // Use conversions as leads (Google Ads conversions = form submissions)
  const totalLeads = totalConversions;
  
  // CPL = Cost Per Lead (conversion)
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  
  const channels: ChannelMetrics[] = [
    { name: 'google_ads', leads: totalLeads, spend: totalSpend, cpl, percentage: 100 },
  ];
  
  const recentLeads: LeadSummary[] = [];
  
  const summary: MetricsSummary = {
    leadsToday: range === 'today' || range === '24h' ? totalConversions : 0,
    leadsThisWeek: totalLeads,
    spendToday: range === 'today' || range === '24h' ? totalSpend : 84.96,
    spendThisWeek: totalSpend,
    cplThisWeek: cpl,
    roasThisWeek: 0,
    conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
  };
  
  return { summary, trends, channels, recentLeads, source: 'fallback' };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7d';
    const view = searchParams.get('view') || 'tech';
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    
    // Convert range to GAQL date range
    let gaqlRange = 'LAST_7_DAYS';
    switch (range) {
      case 'today':
        gaqlRange = 'TODAY';
        break;
      case '24h':
        gaqlRange = 'YESTERDAY'; // Closest match
        break;
      case '7d':
        gaqlRange = 'LAST_7_DAYS';
        break;
      case '30d':
        gaqlRange = 'LAST_30_DAYS';
        break;
      case 'quarter':
        gaqlRange = 'LAST_90_DAYS';
        break;
      case 'all':
        // For all time, use custom range from Jan 1, 2026
        gaqlRange = 'CUSTOM:2026-01-01:' + new Date().toISOString().split('T')[0];
        break;
      default:
        if (range.startsWith('custom:') && fromDate && toDate) {
          gaqlRange = `CUSTOM:${fromDate}:${toDate}`;
        }
    }
    
    // ALWAYS try to get Google Ads metrics from ppc-agent first
    let googleAdsMetrics = null;
    try {
      googleAdsMetrics = await getAccountMetrics(gaqlRange);
      console.log('[Metrics API] Got Google Ads data:', {
        spend: googleAdsMetrics.totalSpend,
        clicks: googleAdsMetrics.totalClicks,
        source: 'ppc-agent'
      });
    } catch (e) {
      console.log('[Metrics API] Could not fetch from ppc-agent:', e);
    }
    
    // Return mock data if database isn't configured
    if (!isDatabaseConfigured) {
      const mockData = getMockData(range);
      
      // Override with real Google Ads data if available
      if (googleAdsMetrics && googleAdsMetrics.totalSpend > 0) {
        const gadsConversions = googleAdsMetrics.totalConversions || 0;
        const gadsCpl = gadsConversions > 0 ? googleAdsMetrics.totalSpend / gadsConversions : 0;
        
        mockData.summary.spendThisWeek = googleAdsMetrics.totalSpend;
        mockData.summary.spendToday = googleAdsMetrics.totalSpend / 7; // Approximate
        mockData.summary.leadsThisWeek = gadsConversions;
        mockData.summary.cplThisWeek = gadsCpl;
        mockData.channels = [{
          name: 'google_ads',
          leads: gadsConversions,
          spend: googleAdsMetrics.totalSpend,
          cpl: gadsCpl,
          percentage: 100,
        }];
      }
      
      return NextResponse.json({
        success: true,
        data: mockData,
        meta: {
          range,
          view,
          startDate: new Date().toISOString().split('T')[0],
          generatedAt: new Date().toISOString(),
          isDemo: !googleAdsMetrics,
          googleAdsSource: googleAdsMetrics ? 'ppc-agent' : 'none',
        },
      });
    }
    
    const { startDate, daysBack } = getDateRangeSQL(range);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Query leads for the date range
    const leads = await sql`
      SELECT 
        id, first_name, last_name, email, phone,
        service_interest, utm_source, status, created_at
      FROM leads
      WHERE created_at >= ${startDate}::timestamptz
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    ` as Lead[];
    
    // Query daily stats for the date range (if we're syncing from Google Ads)
    const stats = await sql`
      SELECT 
        stat_date,
        source_type,
        COALESCE(SUM(spend), 0) as spend,
        COALESCE(SUM(revenue), 0) as revenue,
        COALESCE(SUM(conversions), 0) as conversions,
        COALESCE(SUM(clicks), 0) as clicks,
        COALESCE(SUM(impressions), 0) as impressions
      FROM daily_stats
      WHERE stat_date >= ${startDate}::date
      GROUP BY stat_date, source_type
      ORDER BY stat_date DESC
    `;
    
    // Calculate today's metrics
    const leadsToday = leads.filter(l => 
      new Date(l.created_at).toISOString().split('T')[0] === todayStr
    ).length;
    
    const todayStats = stats.filter((s: any) => s.stat_date === todayStr);
    let spendToday = todayStats.reduce((sum: number, s: any) => sum + parseFloat(s.spend || 0), 0);
    
    // Calculate week metrics
    const totalLeads = leads.length;
    let totalSpend = stats.reduce((sum: number, s: any) => sum + parseFloat(s.spend || 0), 0);
    let totalRevenue = stats.reduce((sum: number, s: any) => sum + parseFloat(s.revenue || 0), 0);
    
    // Calculate qualified leads for conversion rate
    const qualifiedLeads = leads.filter(l => 
      ['qualified', 'quoted', 'won'].includes(l.status)
    ).length;
    
    // Calculate metrics by channel
    const channelStats: Record<string, { leads: number; spend: number }> = {};
    
    // Initialize channels from stats
    for (const stat of stats) {
      const channel = stat.source_type as string;
      if (!channelStats[channel]) {
        channelStats[channel] = { leads: 0, spend: 0 };
      }
      channelStats[channel].spend += parseFloat(stat.spend as string || '0');
    }
    
    // Count leads by channel
    for (const lead of leads) {
      const channel = mapSourceToChannel(lead.utm_source);
      if (!channelStats[channel]) {
        channelStats[channel] = { leads: 0, spend: 0 };
      }
      channelStats[channel].leads++;
    }
    
    // ALWAYS override spend data with Google Ads API data if available
    // This ensures we show real Google Ads spend even if daily_stats isn't populated
    if (googleAdsMetrics && googleAdsMetrics.totalSpend > 0) {
      totalSpend = googleAdsMetrics.totalSpend;
      spendToday = googleAdsMetrics.totalSpend / 7; // Approximate daily
      
      // Update or create google_ads channel with conversions as leads
      if (!channelStats['google_ads']) {
        channelStats['google_ads'] = { leads: 0, spend: 0 };
      }
      channelStats['google_ads'].spend = googleAdsMetrics.totalSpend;
      channelStats['google_ads'].leads = googleAdsMetrics.totalConversions || 0;
    }
    
    // Calculate total leads including Google Ads conversions
    const totalChannelLeads = Object.values(channelStats).reduce((sum, ch) => sum + ch.leads, 0);
    
    // Format channel data
    const channels: ChannelMetrics[] = Object.entries(channelStats).map(([name, data]) => ({
      name,
      leads: data.leads,
      spend: data.spend,
      cpl: data.leads > 0 ? data.spend / data.leads : 0,
      percentage: totalChannelLeads > 0 ? (data.leads / totalChannelLeads) * 100 : 0,
    })).sort((a, b) => b.leads - a.leads); // Sort by leads
    
    // Build trends data (group by date)
    const trendMap: Record<string, TrendDataPoint> = {};
    for (const stat of stats) {
      const date = stat.stat_date as string;
      if (!trendMap[date]) {
        trendMap[date] = { date, leads: 0, spend: 0, conversions: 0 };
      }
      trendMap[date].spend += parseFloat(stat.spend as string || '0');
      trendMap[date].conversions += parseInt(stat.conversions as string || '0');
    }
    
    // Add lead counts to trends
    for (const lead of leads) {
      const date = new Date(lead.created_at).toISOString().split('T')[0];
      if (trendMap[date]) {
        trendMap[date].leads++;
      } else {
        trendMap[date] = { date, leads: 1, spend: 0, conversions: 0 };
      }
    }
    
    const trends = Object.values(trendMap).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Format recent leads
    const recentLeads: LeadSummary[] = leads.slice(0, 5).map(l => ({
      id: l.id,
      name: `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unknown',
      email: l.email,
      phone: l.phone || '',
      service: l.service_interest || 'General Inquiry',
      source: l.utm_source || 'direct',
      createdAt: l.created_at,
      status: l.status,
    }));
    
    // Get conversion count from Google Ads if available, otherwise use database leads
    const googleConversions = googleAdsMetrics?.totalConversions || 0;
    const googleClicks = googleAdsMetrics?.totalClicks || 0;
    const effectiveLeadCount = googleConversions > 0 ? googleConversions : totalLeads;
    
    // Calculate conversion rate:
    // - If Google Ads data available: clicks -> conversions rate
    // - Otherwise: lead qualification rate from database
    let conversionRate = 0;
    if (googleClicks > 0 && googleConversions > 0) {
      // Google Ads click-to-conversion rate
      conversionRate = (googleConversions / googleClicks) * 100;
    } else if (totalLeads > 0) {
      // Database lead qualification rate
      conversionRate = (qualifiedLeads / totalLeads) * 100;
    }
    
    // Build summary with real Google Ads spend
    const summary: MetricsSummary = {
      leadsToday,
      leadsThisWeek: effectiveLeadCount > 0 ? effectiveLeadCount : totalLeads,
      spendToday,
      spendThisWeek: totalSpend,
      cplThisWeek: effectiveLeadCount > 0 ? totalSpend / effectiveLeadCount : 0,
      roasThisWeek: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      conversionRate,
    };
    
    // For owner view, use simpler language (handled on frontend)
    return NextResponse.json({
      success: true,
      data: {
        summary,
        trends,
        channels,
        recentLeads,
      },
      meta: {
        range,
        view,
        startDate,
        generatedAt: new Date().toISOString(),
        googleAdsSource: googleAdsMetrics ? 'ppc-agent' : 'database',
      },
    });
    
  } catch (error) {
    console.error('Metrics API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch metrics' 
      },
      { status: 500 }
    );
  }
}
