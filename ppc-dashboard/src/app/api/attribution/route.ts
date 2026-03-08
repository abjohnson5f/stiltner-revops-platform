import { NextRequest, NextResponse } from 'next/server';
import { sql, isDatabaseConfigured, mapSourceToChannel } from '@/lib/db';
import { getAccountMetrics } from '@/lib/google-ads';
import { isMetaConfigured, getMetaAccountMetrics } from '@/lib/meta-ads';

interface ChannelAttribution {
  channel: string;
  spend: number;
  revenue: number;
  leads: number;
  conversions: number;
  cpl: number;
  cpa: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface TrendPoint {
  date: string;
  spend: number;
  revenue: number;
  leads: number;
  cpl: number;
  roas: number;
}

interface AttributionTotals {
  spend: number;
  revenue: number;
  leads: number;
  conversions: number;
  cpl: number;
  cpa: number;
  roas: number;
  conversionRate: number;
}

// Generate attribution data with real Google Ads metrics
// Data from Google Ads export: Jan 2 - Jan 22, 2026
function getMockAttributionData(googleAdsMetrics: any = null, dateRange: string = 'LAST_7_DAYS') {
  const now = new Date();
  const trends: TrendPoint[] = [];
  
  // Use real Google Ads data if available, otherwise use export data
  const isWeekly = dateRange === 'LAST_7_DAYS';
  const realSpend = googleAdsMetrics?.totalSpend || (isWeekly ? 796.63 : 2111.82);
  const realClicks = googleAdsMetrics?.totalClicks || (isWeekly ? 137 : 299);
  const realImpressions = googleAdsMetrics?.totalImpressions || (isWeekly ? 9428 : 19795);
  const realConversions = googleAdsMetrics?.totalConversions || (isWeekly ? 2 : 11);
  
  // Full daily breakdown from Google Ads export (Jan 5 - Jan 22, 2026)
  const allDailyData = [
    { date: '2026-01-05', spend: 3.85, clicks: 1, impressions: 97, conversions: 0 },
    { date: '2026-01-06', spend: 47.49, clicks: 8, impressions: 158, conversions: 0 },
    { date: '2026-01-07', spend: 101.13, clicks: 6, impressions: 141, conversions: 1 },
    { date: '2026-01-08', spend: 49.41, clicks: 7, impressions: 342, conversions: 0 },
    { date: '2026-01-09', spend: 99.64, clicks: 7, impressions: 243, conversions: 0 },
    { date: '2026-01-10', spend: 119.25, clicks: 12, impressions: 250, conversions: 0 },
    { date: '2026-01-11', spend: 115.65, clicks: 18, impressions: 544, conversions: 0 },
    { date: '2026-01-12', spend: 205.33, clicks: 11, impressions: 120, conversions: 2 },
    { date: '2026-01-13', spend: 199.30, clicks: 11, impressions: 566, conversions: 2 },
    { date: '2026-01-14', spend: 167.16, clicks: 48, impressions: 6231, conversions: 3 },
    { date: '2026-01-15', spend: 206.98, clicks: 33, impressions: 1675, conversions: 1 },
    { date: '2026-01-16', spend: 180.80, clicks: 27, impressions: 1144, conversions: 0 },
    { date: '2026-01-17', spend: 85.56, clicks: 11, impressions: 396, conversions: 1 },
    { date: '2026-01-18', spend: 140.26, clicks: 47, impressions: 4611, conversions: 0 },
    { date: '2026-01-19', spend: 93.27, clicks: 6, impressions: 510, conversions: 0 },
    { date: '2026-01-20', spend: 96.02, clicks: 17, impressions: 1245, conversions: 0 },
    { date: '2026-01-21', spend: 115.76, clicks: 23, impressions: 1325, conversions: 0 },
    { date: '2026-01-22', spend: 84.96, clicks: 6, impressions: 197, conversions: 1 },
  ];
  
  const dailyData = isWeekly ? allDailyData.slice(-7) : allDailyData;
  
  for (const day of dailyData) {
    trends.push({
      date: day.date,
      spend: day.spend,
      revenue: 0, // No revenue tracking yet
      leads: 0, // Leads come from database
      cpl: 0,
      roas: 0,
    });
  }
  
  const totalSpend = realSpend || dailyData.reduce((s, d) => s + d.spend, 0);
  const totalRevenue = 0; // Revenue not tracked yet
  const totalConversions = realConversions || dailyData.reduce((s, d) => s + d.conversions, 0);
  
  // Use conversions as leads for Google Ads (conversions = form submissions)
  const totalLeads = totalConversions;
  
  // CPL = Cost Per Lead (using conversions as the denominator)
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  
  const channels: ChannelAttribution[] = [
    { 
      channel: 'google_ads', 
      spend: totalSpend, 
      revenue: 0, 
      leads: totalLeads, // Conversions = leads 
      conversions: totalConversions, 
      cpl: cpl, 
      cpa: cpa, 
      roas: 0, 
      impressions: realImpressions || dailyData.reduce((s, d) => s + d.impressions, 0), 
      clicks: realClicks || dailyData.reduce((s, d) => s + d.clicks, 0), 
      ctr: 0 
    },
  ];
  
  // Calculate CTR
  channels[0].ctr = channels[0].impressions > 0 ? (channels[0].clicks / channels[0].impressions) * 100 : 0;
  
  const totals: AttributionTotals = {
    spend: totalSpend,
    revenue: totalRevenue,
    leads: totalLeads,
    conversions: totalConversions,
    cpl: cpl,
    cpa: cpa,
    roas: totalSpend > 0 && totalRevenue > 0 ? totalRevenue / totalSpend : 0,
    conversionRate: realClicks > 0 ? (totalConversions / realClicks) * 100 : 0,
  };
  
  return { channels, trends, totals };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    const until = searchParams.get('until');
    const groupBy = searchParams.get('groupBy') || 'day';
    
    // Default to last 30 days if no dates provided
    const endDate = until || new Date().toISOString().split('T')[0];
    const startDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Calculate days difference for GAQL query
    const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const gaqlRange = daysDiff <= 7 ? 'LAST_7_DAYS' : 'LAST_30_DAYS';
    
    // ALWAYS try to get Google Ads metrics from ppc-agent
    let googleAdsMetrics = null;
    try {
      googleAdsMetrics = await getAccountMetrics(gaqlRange);
      console.log('[Attribution API] Got Google Ads data:', {
        spend: googleAdsMetrics.totalSpend,
        clicks: googleAdsMetrics.totalClicks,
        conversions: googleAdsMetrics.totalConversions,
      });
    } catch (e) {
      console.log('[Attribution API] Could not fetch from ppc-agent:', e);
    }

    // Try to get Meta Ads metrics if configured
    let metaAdsMetrics = null;
    if (isMetaConfigured()) {
      try {
        const metaRange = daysDiff <= 7 ? 'last_7d' : 'last_30d';
        metaAdsMetrics = await getMetaAccountMetrics(metaRange);
        console.log('[Attribution API] Got Meta Ads data:', {
          spend: metaAdsMetrics.spend,
          clicks: metaAdsMetrics.clicks,
          conversions: metaAdsMetrics.conversions,
        });
      } catch (e) {
        console.log('[Attribution API] Could not fetch Meta metrics:', e);
      }
    }

    // Return data with real Google Ads metrics if database isn't configured
    if (!isDatabaseConfigured) {
      const mockData = getMockAttributionData(googleAdsMetrics, gaqlRange);

      // Add Meta Ads channel if we have metrics
      if (metaAdsMetrics && metaAdsMetrics.spend > 0) {
        mockData.channels.push({
          channel: 'meta_ads',
          spend: metaAdsMetrics.spend,
          revenue: 0,
          leads: metaAdsMetrics.conversions,
          conversions: metaAdsMetrics.conversions,
          cpl: metaAdsMetrics.cpl,
          cpa: metaAdsMetrics.conversions > 0 ? metaAdsMetrics.spend / metaAdsMetrics.conversions : 0,
          roas: 0,
          impressions: metaAdsMetrics.impressions,
          clicks: metaAdsMetrics.clicks,
          ctr: metaAdsMetrics.ctr,
        });
        mockData.totals.spend += metaAdsMetrics.spend;
        mockData.totals.leads += metaAdsMetrics.conversions;
        mockData.totals.conversions += metaAdsMetrics.conversions;
        mockData.totals.cpl = mockData.totals.leads > 0 ? mockData.totals.spend / mockData.totals.leads : 0;
        mockData.totals.cpa = mockData.totals.conversions > 0 ? mockData.totals.spend / mockData.totals.conversions : 0;
      }

      const insights = [
        `Google Ads spent $${(googleAdsMetrics?.totalSpend || mockData.channels[0]?.spend || 0).toFixed(2)} this period.`,
        `${mockData.totals.conversions} conversions tracked at $${mockData.totals.cpa.toFixed(2)} CPA.`,
        googleAdsMetrics
          ? 'Data sourced from Google Ads API via ppc-agent.'
          : 'Using cached data - start ppc-agent webhook server for live data.',
      ];
      if (metaAdsMetrics && metaAdsMetrics.spend > 0) {
        insights.push(`Meta Ads spent $${metaAdsMetrics.spend.toFixed(2)} with ${metaAdsMetrics.conversions} conversions.`);
      } else if (isMetaConfigured()) {
        insights.push('Meta Ads connected - no spend data yet for this period.');
      }

      return NextResponse.json({
        success: true,
        data: {
          dateRange: { start: startDate, end: endDate },
          ...mockData,
          insights,
        },
        meta: {
          startDate,
          endDate,
          groupBy,
          isDemo: !googleAdsMetrics,
          googleAdsSource: googleAdsMetrics ? 'ppc-agent' : 'fallback',
          metaAdsSource: metaAdsMetrics ? 'meta-api' : isMetaConfigured() ? 'configured-no-data' : 'not-configured',
        },
      });
    }
    
    // Query daily stats
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
        AND stat_date <= ${endDate}::date
      GROUP BY stat_date, source_type
      ORDER BY stat_date DESC
    `;
    
    // Query leads for the period
    const leads = await sql`
      SELECT 
        id, utm_source, status, created_at
      FROM leads
      WHERE created_at >= ${startDate}::timestamptz
        AND created_at <= ${endDate}::timestamptz + interval '1 day'
        AND deleted_at IS NULL
    `;
    
    // Aggregate by channel
    const channelData: Record<string, ChannelAttribution> = {};
    
    // Initialize from stats
    for (const stat of stats as any[]) {
      const channel = stat.source_type;
      if (!channelData[channel]) {
        channelData[channel] = {
          channel,
          spend: 0,
          revenue: 0,
          leads: 0,
          conversions: 0,
          cpl: 0,
          cpa: 0,
          roas: 0,
          impressions: 0,
          clicks: 0,
          ctr: 0,
        };
      }
      
      channelData[channel].spend += parseFloat(stat.spend);
      channelData[channel].revenue += parseFloat(stat.revenue);
      channelData[channel].conversions += parseInt(stat.conversions);
      channelData[channel].clicks += parseInt(stat.clicks);
      channelData[channel].impressions += parseInt(stat.impressions);
    }
    
    // Add lead counts
    for (const lead of leads as any[]) {
      const channel = mapSourceToChannel(lead.utm_source);
      if (!channelData[channel]) {
        channelData[channel] = {
          channel,
          spend: 0,
          revenue: 0,
          leads: 0,
          conversions: 0,
          cpl: 0,
          cpa: 0,
          roas: 0,
          impressions: 0,
          clicks: 0,
          ctr: 0,
        };
      }
      channelData[channel].leads++;
    }
    
    // Add Meta Ads data if available
    if (metaAdsMetrics && metaAdsMetrics.spend > 0) {
      if (!channelData['meta_ads']) {
        channelData['meta_ads'] = {
          channel: 'meta_ads', spend: 0, revenue: 0, leads: 0, conversions: 0,
          cpl: 0, cpa: 0, roas: 0, impressions: 0, clicks: 0, ctr: 0,
        };
      }
      channelData['meta_ads'].spend = metaAdsMetrics.spend;
      channelData['meta_ads'].clicks = metaAdsMetrics.clicks;
      channelData['meta_ads'].impressions = metaAdsMetrics.impressions;
      channelData['meta_ads'].conversions = metaAdsMetrics.conversions;
    }

    // OVERRIDE with real Google Ads data if available
    if (googleAdsMetrics && googleAdsMetrics.totalSpend > 0) {
      if (!channelData['google_ads']) {
        channelData['google_ads'] = {
          channel: 'google_ads',
          spend: 0,
          revenue: 0,
          leads: 0,
          conversions: 0,
          cpl: 0,
          cpa: 0,
          roas: 0,
          impressions: 0,
          clicks: 0,
          ctr: 0,
        };
      }
      
      channelData['google_ads'].spend = googleAdsMetrics.totalSpend;
      channelData['google_ads'].clicks = googleAdsMetrics.totalClicks;
      channelData['google_ads'].impressions = googleAdsMetrics.totalImpressions;
      channelData['google_ads'].conversions = googleAdsMetrics.totalConversions;
    }
    
    // Calculate derived metrics
    // Use conversions as leads for CPL if no database leads (conversions = form submissions)
    const channels: ChannelAttribution[] = Object.values(channelData).map(c => {
      const effectiveLeads = c.leads > 0 ? c.leads : c.conversions;
      return {
        ...c,
        leads: effectiveLeads, // Show conversions as leads if no DB leads
        cpl: effectiveLeads > 0 ? c.spend / effectiveLeads : 0,
        cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
        roas: c.spend > 0 ? c.revenue / c.spend : 0,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      };
    });
    
    // Calculate totals
    // Use conversions as leads if no database leads exist (conversions = form submissions from Google Ads)
    const totalLeads = channels.reduce((sum, c) => sum + c.leads, 0);
    const totalConversionsSum = channels.reduce((sum, c) => sum + c.conversions, 0);
    const effectiveLeadCount = totalLeads > 0 ? totalLeads : totalConversionsSum;
    
    const totals: AttributionTotals = {
      spend: channels.reduce((sum, c) => sum + c.spend, 0),
      revenue: channels.reduce((sum, c) => sum + c.revenue, 0),
      leads: effectiveLeadCount, // Show conversions as leads if no DB leads
      conversions: totalConversionsSum,
      cpl: 0,
      cpa: 0,
      roas: 0,
      conversionRate: 0,
    };
    
    totals.cpl = effectiveLeadCount > 0 ? totals.spend / effectiveLeadCount : 0;
    totals.cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    totals.roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    const totalClicks = channels.reduce((sum, c) => sum + c.clicks, 0);
    totals.conversionRate = totalClicks > 0 ? (totals.conversions / totalClicks) * 100 : 0;
    
    // Build trends data
    const trendMap: Record<string, TrendPoint> = {};
    
    for (const stat of stats as any[]) {
      const date = stat.stat_date;
      if (!trendMap[date]) {
        trendMap[date] = { date, spend: 0, revenue: 0, leads: 0, cpl: 0, roas: 0 };
      }
      trendMap[date].spend += parseFloat(stat.spend);
      trendMap[date].revenue += parseFloat(stat.revenue);
    }
    
    // Add leads to trends
    for (const lead of leads as any[]) {
      const date = new Date(lead.created_at).toISOString().split('T')[0];
      if (!trendMap[date]) {
        trendMap[date] = { date, spend: 0, revenue: 0, leads: 0, cpl: 0, roas: 0 };
      }
      trendMap[date].leads++;
    }
    
    // Calculate CPL and ROAS for each day
    const trends: TrendPoint[] = Object.values(trendMap)
      .map(t => ({
        ...t,
        cpl: t.leads > 0 ? t.spend / t.leads : 0,
        roas: t.spend > 0 ? t.revenue / t.spend : 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Generate insights
    const insights: string[] = [];
    
    if (googleAdsMetrics) {
      insights.push(`Google Ads spent $${googleAdsMetrics.totalSpend.toFixed(2)} (${googleAdsMetrics.totalClicks} clicks, ${googleAdsMetrics.totalConversions} conversions).`);
      
      const cpa = googleAdsMetrics.totalConversions > 0 
        ? googleAdsMetrics.totalSpend / googleAdsMetrics.totalConversions 
        : 0;
      if (cpa > 0) {
        insights.push(`Cost per conversion: $${cpa.toFixed(2)}`);
      }
    }
    
    // Find best and worst performing channels
    const sortedByLeads = [...channels].sort((a, b) => b.leads - a.leads);
    if (sortedByLeads.length > 0 && sortedByLeads[0].leads > 0) {
      insights.push(`${sortedByLeads[0].channel} generated the most leads (${sortedByLeads[0].leads}) this period.`);
    }
    
    if (totals.leads === 0 && totals.spend > 0) {
      insights.push(`No leads tracked yet this period. Check lead tracking integration.`);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        dateRange: { start: startDate, end: endDate },
        totals,
        channels,
        trends,
        insights,
      },
      meta: {
        googleAdsSource: googleAdsMetrics ? 'ppc-agent' : 'database',
      },
    });
    
  } catch (error) {
    console.error('Attribution API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch attribution data' 
      },
      { status: 500 }
    );
  }
}
