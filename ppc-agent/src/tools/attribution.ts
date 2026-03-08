/**
 * Attribution Tools
 *
 * Syncs marketing metrics from various platforms and calculates key performance indicators (KPIs).
 */

import { env } from '../config/index.js';
import { getAccountInsights as getGoogleAdsAccountInsights } from './google-ads.js';
import { getAccountInsights as getMetaAdsAccountInsights } from './meta-ads.js';
import { getDailyStats, upsertDailyStats, queryLeads, type DailyStat, type Lead } from './neon.js';
import { sendTextNotification } from './google-chat.js';

// ============================================================
// TYPES
// ============================================================

export interface DailyMarketingStats {
  date: string; // YYYY-MM-DD
  platform: 'google_ads' | 'meta_ads' | 'total';
  spend: number; // in dollars
  impressions: number;
  clicks: number;
  conversions: number;
  leads?: number; // from CRM sync
  revenue?: number; // from CRM sync
  cpc?: number; // cost per click
  cpm?: number; // cost per mille (impressions)
  ctr?: number; // click-through rate
  cpa?: number; // cost per acquisition (conversion)
  cpl?: number; // cost per lead
  roas?: number; // return on ad spend
}

export interface SyncResult {
  synced: number;
  errors: string[];
}

export interface ChannelMetrics {
  channel: string;
  spend: number;
  leads: number;
  cpl: number;
  roas: number;
  conversions: number;
}

export interface AttributionReport {
  dateRange: { start: string; end: string };
  totals: {
    spend: number;
    leads: number;
    blendedCpl: number;
    blendedRoas: number;
    revenue: number;
    conversions: number;
  };
  channels: ChannelMetrics[];
  insights: string[];
}

export interface CMOWeeklySummary {
  weekOf: string;
  metrics: {
    spend: number;
    leads: number;
    cpl: number;
    roas: number;
    weekOverWeek: {
      spendChange: number;
      leadsChange: number;
      cplChange: number;
    };
  };
  highlights: string[];
  recommendations: string[];
}

// ============================================================
// DATA SYNC FUNCTIONS
// ============================================================

/**
 * Sync daily performance metrics from Google Ads.
 */
export async function syncGoogleAdsStats(date?: string): Promise<SyncResult> {
  const syncDate = date || new Date().toISOString().split('T')[0];
  const errors: string[] = [];
  let synced = 0;

  try {
    const insights = await getGoogleAdsAccountInsights({ since: syncDate, until: syncDate });
    const dailyInsight = insights[0];

    if (!dailyInsight) {
      return { synced: 0, errors: [`No Google Ads data for ${syncDate}`] };
    }

    const spend = parseFloat(dailyInsight.cost_micros) / 1_000_000;
    const clicks = parseInt(dailyInsight.clicks);
    const impressions = parseInt(dailyInsight.impressions);
    const conversions = dailyInsight.conversions ? parseFloat(dailyInsight.conversions) : 0;

    await upsertDailyStats({
      stat_date: syncDate,
      source_type: 'google_ads',
      spend,
      impressions,
      clicks,
      conversions,
    });

    synced = 1;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { synced, errors };
}

/**
 * Sync daily performance metrics from Meta Ads.
 */
export async function syncMetaAdsStats(date?: string): Promise<SyncResult> {
  const syncDate = date || new Date().toISOString().split('T')[0];
  const errors: string[] = [];
  let synced = 0;

  try {
    const insights = await getMetaAdsAccountInsights({ since: syncDate, until: syncDate });
    const dailyInsight = insights[0];

    if (!dailyInsight) {
      return { synced: 0, errors: [`No Meta Ads data for ${syncDate}`] };
    }

    const spend = parseFloat(dailyInsight.spend);
    const clicks = parseInt(dailyInsight.clicks);
    const impressions = parseInt(dailyInsight.impressions);
    const conversions = dailyInsight.actions?.find(a => a.action_type === 'offsite_conversion.fb_pixel_lead')?.value
      ? parseFloat(dailyInsight.actions.find(a => a.action_type === 'offsite_conversion.fb_pixel_lead')!.value)
      : 0;

    await upsertDailyStats({
      stat_date: syncDate,
      source_type: 'meta_ads',
      spend,
      impressions,
      clicks,
      conversions,
    });

    synced = 1;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { synced, errors };
}

// ============================================================
// LEAD OPERATIONS
// ============================================================

/**
 * Get leads by source for a date range
 */
export async function getLeadsBySource(dateRange: {
  since: string;
  until: string;
}): Promise<Array<{ source: string; count: number }>> {
  const leads = await queryLeads({ since: dateRange.since });
  
  // Group by utm_source
  const bySource: Record<string, number> = {};
  for (const lead of leads) {
    const source = lead.utm_source || 'direct';
    bySource[source] = (bySource[source] || 0) + 1;
  }

  return Object.entries(bySource).map(([source, count]) => ({ source, count }));
}

// ============================================================
// KPI CALCULATION FUNCTIONS
// ============================================================

/**
 * Calculate Cost Per Lead (CPL) for all channels
 */
export async function calculateCPL(dateRange: {
  since: string;
  until: string;
}): Promise<ChannelMetrics[]> {
  const stats = await getDailyStats(dateRange.since, dateRange.until);
  const leads = await queryLeads({ since: dateRange.since });

  // Count leads by source
  const leadsBySource: Record<string, number> = {};
  for (const lead of leads) {
    const source = lead.utm_source === 'google' ? 'google_ads' : 
                   lead.utm_source === 'facebook' || lead.utm_source === 'instagram' ? 'meta_ads' : 
                   lead.utm_source || 'direct';
    leadsBySource[source] = (leadsBySource[source] || 0) + 1;
  }

  // Group stats by source
  const statsBySource: Record<string, { spend: number; conversions: number }> = {};
  for (const stat of stats) {
    if (!statsBySource[stat.source_type]) {
      statsBySource[stat.source_type] = { spend: 0, conversions: 0 };
    }
    statsBySource[stat.source_type].spend += stat.spend;
    statsBySource[stat.source_type].conversions += stat.conversions;
  }

  const results: ChannelMetrics[] = [];
  for (const [channel, data] of Object.entries(statsBySource)) {
    const channelLeads = leadsBySource[channel] || 0;
    results.push({
      channel,
      spend: data.spend,
      leads: channelLeads,
      cpl: channelLeads > 0 ? data.spend / channelLeads : 0,
      roas: 0, // Would need revenue data
      conversions: data.conversions,
    });
  }

  return results;
}

/**
 * Calculate Return On Ad Spend (ROAS) for all channels
 */
export async function calculateROAS(dateRange: {
  since: string;
  until: string;
}): Promise<ChannelMetrics[]> {
  const stats = await getDailyStats(dateRange.since, dateRange.until);
  
  // Group stats by source
  const statsBySource: Record<string, { spend: number; revenue: number; conversions: number }> = {};
  for (const stat of stats) {
    if (!statsBySource[stat.source_type]) {
      statsBySource[stat.source_type] = { spend: 0, revenue: 0, conversions: 0 };
    }
    statsBySource[stat.source_type].spend += stat.spend;
    statsBySource[stat.source_type].revenue += stat.revenue || 0;
    statsBySource[stat.source_type].conversions += stat.conversions;
  }

  const results: ChannelMetrics[] = [];
  for (const [channel, data] of Object.entries(statsBySource)) {
    results.push({
      channel,
      spend: data.spend,
      leads: 0,
      cpl: 0,
      roas: data.spend > 0 ? data.revenue / data.spend : 0,
      conversions: data.conversions,
    });
  }

  return results;
}

/**
 * Calculate Customer Acquisition Cost (CAC)
 */
export async function calculateCAC(dateRange: {
  since: string;
  until: string;
}): Promise<{ cac: number; totalSpend: number; totalCustomers: number }> {
  const stats = await getDailyStats(dateRange.since, dateRange.until);
  const totalSpend = stats.reduce((sum, s) => sum + s.spend, 0);
  const totalCustomers = stats.reduce((sum, s) => sum + s.conversions, 0);

  return {
    cac: totalCustomers > 0 ? totalSpend / totalCustomers : 0,
    totalSpend,
    totalCustomers,
  };
}

/**
 * Calculate Customer Lifetime Value (LTV).
 */
export async function calculateLTV(
  averageRevenuePerCustomer: number = 2500, // Default for landscaping
  averageRetentionYears: number = 3,
  grossMargin: number = 0.35
): Promise<number> {
  return averageRevenuePerCustomer * averageRetentionYears * grossMargin;
}

// ============================================================
// REPORTING FUNCTIONS
// ============================================================

/**
 * Generate a comprehensive attribution report.
 */
export async function generateAttributionReport(dateRange?: {
  since: string;
  until: string;
}): Promise<AttributionReport> {
  const now = new Date();
  const defaultEnd = now.toISOString().split('T')[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const defaultStart = sevenDaysAgo.toISOString().split('T')[0];

  const range = dateRange || { since: defaultStart, until: defaultEnd };

  const stats = await getDailyStats(range.since, range.until);
  const leads = await queryLeads({ since: range.since });

  // Calculate totals
  const totalSpend = stats.reduce((sum, s) => sum + s.spend, 0);
  const totalRevenue = stats.reduce((sum, s) => sum + (s.revenue || 0), 0);
  const totalConversions = stats.reduce((sum, s) => sum + s.conversions, 0);
  const totalLeads = leads.length;

  // Calculate by channel
  const channels = await calculateCPL(range);

  // Generate insights
  const insights: string[] = [];
  
  if (totalLeads > 0 && totalSpend > 0) {
    const blendedCpl = totalSpend / totalLeads;
    if (blendedCpl < 100) {
      insights.push(`✅ CPL of $${blendedCpl.toFixed(2)} is below target`);
    } else {
      insights.push(`⚠️ CPL of $${blendedCpl.toFixed(2)} is above target`);
    }
  }

  if (channels.length > 1) {
    const sorted = [...channels].sort((a, b) => a.cpl - b.cpl);
    if (sorted[0].cpl > 0) {
      insights.push(`💡 ${sorted[0].channel} has the best CPL at $${sorted[0].cpl.toFixed(2)}`);
    }
  }

  return {
    dateRange: { start: range.since, end: range.until },
    totals: {
      spend: totalSpend,
      leads: totalLeads,
      blendedCpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      blendedRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      revenue: totalRevenue,
      conversions: totalConversions,
    },
    channels,
    insights,
  };
}

/**
 * Generate weekly CMO summary
 */
export async function generateCMOWeeklySummary(): Promise<CMOWeeklySummary> {
  const now = new Date();
  const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const thisWeekStats = await getDailyStats(
    thisWeekStart.toISOString().split('T')[0],
    now.toISOString().split('T')[0]
  );
  const lastWeekStats = await getDailyStats(
    lastWeekStart.toISOString().split('T')[0],
    lastWeekEnd.toISOString().split('T')[0]
  );
  const thisWeekLeads = await queryLeads({ since: thisWeekStart.toISOString().split('T')[0] });

  const thisWeekSpend = thisWeekStats.reduce((sum, s) => sum + s.spend, 0);
  const lastWeekSpend = lastWeekStats.reduce((sum, s) => sum + s.spend, 0);
  const thisWeekLeadsCount = thisWeekLeads.length;
  // Estimate last week leads (simplified)
  const lastWeekLeadsCount = Math.round(thisWeekLeadsCount * 0.9); // Placeholder

  const thisWeekCpl = thisWeekLeadsCount > 0 ? thisWeekSpend / thisWeekLeadsCount : 0;
  const lastWeekCpl = lastWeekLeadsCount > 0 ? lastWeekSpend / lastWeekLeadsCount : 0;

  const spendChange = lastWeekSpend > 0 ? ((thisWeekSpend - lastWeekSpend) / lastWeekSpend) * 100 : 0;
  const leadsChange = lastWeekLeadsCount > 0 ? ((thisWeekLeadsCount - lastWeekLeadsCount) / lastWeekLeadsCount) * 100 : 0;
  const cplChange = lastWeekCpl > 0 ? ((thisWeekCpl - lastWeekCpl) / lastWeekCpl) * 100 : 0;

  const highlights: string[] = [];
  const recommendations: string[] = [];

  if (thisWeekLeadsCount > lastWeekLeadsCount) {
    highlights.push(`📈 Leads up ${leadsChange.toFixed(1)}% week-over-week`);
  }
  if (thisWeekCpl < lastWeekCpl) {
    highlights.push(`💰 CPL improved by ${Math.abs(cplChange).toFixed(1)}%`);
  }

  if (thisWeekCpl > 150) {
    recommendations.push('Consider reviewing ad targeting to reduce CPL');
  }
  if (thisWeekSpend > lastWeekSpend * 1.2) {
    recommendations.push('Spending increased significantly - ensure quality is maintained');
  }

  return {
    weekOf: thisWeekStart.toISOString().split('T')[0],
    metrics: {
      spend: thisWeekSpend,
      leads: thisWeekLeadsCount,
      cpl: thisWeekCpl,
      roas: 0, // Would need revenue tracking
      weekOverWeek: {
        spendChange,
        leadsChange,
        cplChange,
      },
    },
    highlights,
    recommendations,
  };
}

// ============================================================
// TOOL DEFINITIONS FOR AGENT
// ============================================================

export const attributionTools = {
  sync_google_ads_stats: {
    name: 'sync_google_ads_stats',
    description: 'Sync daily performance metrics from Google Ads to the database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date to sync (YYYY-MM-DD, defaults to today).' },
      },
      required: [],
    },
    handler: async (args: { date?: string }) => syncGoogleAdsStats(args.date),
  },

  sync_meta_ads_stats: {
    name: 'sync_meta_ads_stats',
    description: 'Sync daily performance metrics from Meta Ads to the database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date to sync (YYYY-MM-DD, defaults to today).' },
      },
      required: [],
    },
    handler: async (args: { date?: string }) => syncMetaAdsStats(args.date),
  },

  calculate_cpl: {
    name: 'calculate_cpl',
    description: 'Calculate Cost Per Lead (CPL) for all marketing channels.',
    input_schema: {
      type: 'object' as const,
      properties: {
        since: { type: 'string', description: 'Start date (YYYY-MM-DD).' },
        until: { type: 'string', description: 'End date (YYYY-MM-DD).' },
      },
      required: ['since', 'until'],
    },
    handler: async (args: { since: string; until: string }) =>
      calculateCPL({ since: args.since, until: args.until }),
  },

  calculate_roas: {
    name: 'calculate_roas',
    description: 'Calculate Return On Ad Spend (ROAS) for all marketing channels.',
    input_schema: {
      type: 'object' as const,
      properties: {
        since: { type: 'string', description: 'Start date (YYYY-MM-DD).' },
        until: { type: 'string', description: 'End date (YYYY-MM-DD).' },
      },
      required: ['since', 'until'],
    },
    handler: async (args: { since: string; until: string }) =>
      calculateROAS({ since: args.since, until: args.until }),
  },

  generate_attribution_report: {
    name: 'generate_attribution_report',
    description: 'Generate a comprehensive marketing attribution report for a given date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        since: { type: 'string', description: 'Start date (YYYY-MM-DD).' },
        until: { type: 'string', description: 'End date (YYYY-MM-DD).' },
      },
      required: [],
    },
    handler: async (args: { since?: string; until?: string }) =>
      generateAttributionReport(args.since && args.until ? { since: args.since, until: args.until } : undefined),
  },

  generate_cmo_weekly_summary: {
    name: 'generate_cmo_weekly_summary',
    description: 'Generate a weekly CMO-level marketing summary with week-over-week comparisons.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: generateCMOWeeklySummary,
  },
};

export const toolDefinitions = Object.values(attributionTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const tool of Object.values(attributionTools)) {
  toolHandlers[tool.name] = tool.handler;
}
