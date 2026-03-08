/**
 * Attribution Agent
 *
 * Responsible for:
 * - Daily sync of marketing metrics from Google Ads and Meta Ads
 * - Calculating attribution KPIs (CPL, ROAS, CAC, LTV)
 * - Generating CMO-level reports and insights
 * - Alerting on anomalies and threshold breaches
 */

import Anthropic from '@anthropic-ai/sdk';
import { env, GOOGLE_CHAT_CONFIG } from '../config/index.js';
import {
  syncGoogleAdsStats,
  syncMetaAdsStats,
  calculateCPL,
  calculateROAS,
  calculateCAC,
  calculateLTV,
  generateAttributionReport,
  generateCMOWeeklySummary,
  getLeadsBySource,
  type SyncResult,
  type AttributionReport,
  type CMOWeeklySummary,
} from '../tools/attribution.js';
import { sendTextNotification } from '../tools/google-chat.js';

const anthropic = new Anthropic();

// ============================================================
// CONFIGURATION
// ============================================================

const THRESHOLDS = {
  CPL_WARNING: 100, // Alert if CPL exceeds $100
  CPL_CRITICAL: 150, // Critical alert if CPL exceeds $150
  DAILY_SPEND_MAX: 500, // Alert if daily spend exceeds $500
  ROAS_MIN: 2.0, // Alert if ROAS drops below 2.0
};

// ============================================================
// DAILY SYNC WORKFLOW
// ============================================================

/**
 * Run daily metrics sync from all ad platforms.
 */
export async function runDailySync(date?: string): Promise<{
  googleAds: SyncResult;
  metaAds: SyncResult;
  success: boolean;
}> {
  console.log(`\n📊 Running daily metrics sync for ${date || 'today'}...`);

  const [googleAds, metaAds] = await Promise.all([
    syncGoogleAdsStats(date),
    syncMetaAdsStats(date),
  ]);

  const success =
    googleAds.errors.length === 0 && metaAds.errors.length === 0;

  if (!success) {
    console.error('⚠️ Sync completed with errors');
    if (googleAds.errors.length > 0) {
      console.error('  Google Ads errors:', googleAds.errors);
    }
    if (metaAds.errors.length > 0) {
      console.error('  Meta Ads errors:', metaAds.errors);
    }
  } else {
    console.log('✅ Daily sync completed successfully');
    console.log(`  Google Ads: ${googleAds.synced} records`);
    console.log(`  Meta Ads: ${metaAds.synced} records`);
  }

  return { googleAds, metaAds, success };
}

// ============================================================
// ALERTING WORKFLOW
// ============================================================

/**
 * Check KPIs against thresholds and send alerts if needed.
 */
export async function checkAndAlert(): Promise<{
  alerts: string[];
  sent: boolean;
}> {
  const alerts: string[] = [];

  // Get last 7 days of data
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = {
    since: sevenDaysAgo.toISOString().split('T')[0],
    until: now.toISOString().split('T')[0],
  };

  try {
    const cplData = await calculateCPL(dateRange);
    const roasData = await calculateROAS(dateRange);

    // Check CPL thresholds
    for (const channel of cplData) {
      if (channel.cpl > THRESHOLDS.CPL_CRITICAL) {
        alerts.push(
          `🚨 CRITICAL: ${channel.channel} CPL is $${channel.cpl.toFixed(2)} (threshold: $${THRESHOLDS.CPL_CRITICAL})`
        );
      } else if (channel.cpl > THRESHOLDS.CPL_WARNING) {
        alerts.push(
          `⚠️ WARNING: ${channel.channel} CPL is $${channel.cpl.toFixed(2)} (threshold: $${THRESHOLDS.CPL_WARNING})`
        );
      }
    }

    // Check ROAS thresholds
    for (const channel of roasData) {
      if (channel.roas > 0 && channel.roas < THRESHOLDS.ROAS_MIN) {
        alerts.push(
          `⚠️ WARNING: ${channel.channel} ROAS is ${channel.roas.toFixed(2)}x (threshold: ${THRESHOLDS.ROAS_MIN}x)`
        );
      }
    }
  } catch (error) {
    alerts.push(`❌ Error checking thresholds: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Send alerts via Google Chat
  let sent = false;
  if (alerts.length > 0 && GOOGLE_CHAT_CONFIG.isConfigured) {
    const message = `📊 Marketing Alert Summary\n\n${alerts.join('\n')}`;
    await sendTextNotification(message);
    sent = true;
    console.log('📤 Alerts sent to Google Chat');
  }

  return { alerts, sent };
}

// ============================================================
// REPORTING WORKFLOWS
// ============================================================

/**
 * Generate and send daily marketing report.
 */
export async function sendDailyReport(): Promise<AttributionReport> {
  console.log('\n📈 Generating daily attribution report...');

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const report = await generateAttributionReport({
    since: yesterday.toISOString().split('T')[0],
    until: now.toISOString().split('T')[0],
  });

  // Format for Google Chat
  const message = formatDailyReportMessage(report);

  if (GOOGLE_CHAT_CONFIG.isConfigured) {
    await sendTextNotification(message);
    console.log('📤 Daily report sent to Google Chat');
  }

  return report;
}

/**
 * Generate and send weekly CMO report.
 */
export async function sendWeeklyReport(): Promise<CMOWeeklySummary> {
  console.log('\n📊 Generating weekly CMO report...');

  const summary = await generateCMOWeeklySummary();

  // Format for Google Chat
  const message = formatWeeklyReportMessage(summary);

  if (GOOGLE_CHAT_CONFIG.isConfigured) {
    await sendTextNotification(message);
    console.log('📤 Weekly CMO report sent to Google Chat');
  }

  return summary;
}

// ============================================================
// AI INSIGHTS
// ============================================================

/**
 * Use Claude to generate AI-powered insights from marketing data.
 */
export async function generateAIInsights(report: AttributionReport): Promise<string[]> {
  const prompt = `You are a marketing analytics expert. Analyze this marketing performance data and provide 3-5 actionable insights:

${JSON.stringify(report, null, 2)}

Focus on:
1. Cost efficiency opportunities
2. Channel performance comparisons
3. Trends and anomalies
4. Specific recommendations to improve ROI

Format as bullet points. Be specific and data-driven.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return text.split('\n').filter((line) => line.trim().startsWith('•') || line.trim().startsWith('-'));
  } catch (error) {
    console.error('Failed to generate AI insights:', error);
    return ['Unable to generate AI insights at this time.'];
  }
}

// ============================================================
// MAIN WORKFLOW
// ============================================================

/**
 * Run the full attribution workflow:
 * 1. Sync metrics from all platforms
 * 2. Check thresholds and send alerts
 * 3. Generate and send daily report
 */
export async function runDailyAttributionTasks(): Promise<{
  sync: Awaited<ReturnType<typeof runDailySync>>;
  alerts: Awaited<ReturnType<typeof checkAndAlert>>;
  report: AttributionReport;
}> {
  console.log('\n🚀 Starting daily attribution tasks...\n');

  // Step 1: Sync metrics
  const sync = await runDailySync();

  // Step 2: Check thresholds
  const alerts = await checkAndAlert();

  // Step 3: Generate report
  const report = await sendDailyReport();

  console.log('\n✅ Daily attribution tasks completed');

  return { sync, alerts, report };
}

/**
 * Run attribution workflow based on command
 */
export async function runAttributionWorkflow(command: string): Promise<any> {
  switch (command) {
    case 'daily':
    case 'sync':
      return runDailySync();
    case 'alerts':
    case 'check':
      return checkAndAlert();
    case 'report':
    case 'daily-report':
      return sendDailyReport();
    case 'weekly':
    case 'weekly-report':
      return sendWeeklyReport();
    case 'full':
    case 'all':
      return runDailyAttributionTasks();
    default:
      return generateAttributionReport();
  }
}

// ============================================================
// FORMATTING HELPERS
// ============================================================

function formatDailyReportMessage(report: AttributionReport): string {
  const { totals, channels, insights } = report;

  let message = `📊 *Daily Marketing Report*\n`;
  message += `📅 ${report.dateRange.start} to ${report.dateRange.end}\n\n`;

  message += `*Totals:*\n`;
  message += `• Spend: $${totals.spend.toFixed(2)}\n`;
  message += `• Leads: ${totals.leads}\n`;
  message += `• Blended CPL: $${totals.blendedCpl.toFixed(2)}\n`;
  message += `• Conversions: ${totals.conversions}\n\n`;

  if (channels.length > 0) {
    message += `*By Channel:*\n`;
    for (const ch of channels) {
      message += `• ${ch.channel}: $${ch.spend.toFixed(2)} spend, ${ch.leads} leads, $${ch.cpl.toFixed(2)} CPL\n`;
    }
    message += '\n';
  }

  if (insights.length > 0) {
    message += `*Insights:*\n`;
    for (const insight of insights) {
      message += `${insight}\n`;
    }
  }

  return message;
}

function formatWeeklyReportMessage(summary: CMOWeeklySummary): string {
  const { metrics, highlights, recommendations } = summary;

  let message = `📈 *Weekly CMO Report*\n`;
  message += `📅 Week of ${summary.weekOf}\n\n`;

  message += `*Key Metrics:*\n`;
  message += `• Total Spend: $${metrics.spend.toFixed(2)} (${metrics.weekOverWeek.spendChange >= 0 ? '+' : ''}${metrics.weekOverWeek.spendChange.toFixed(1)}% WoW)\n`;
  message += `• Total Leads: ${metrics.leads} (${metrics.weekOverWeek.leadsChange >= 0 ? '+' : ''}${metrics.weekOverWeek.leadsChange.toFixed(1)}% WoW)\n`;
  message += `• CPL: $${metrics.cpl.toFixed(2)} (${metrics.weekOverWeek.cplChange >= 0 ? '+' : ''}${metrics.weekOverWeek.cplChange.toFixed(1)}% WoW)\n\n`;

  if (highlights.length > 0) {
    message += `*Highlights:*\n`;
    for (const h of highlights) {
      message += `${h}\n`;
    }
    message += '\n';
  }

  if (recommendations.length > 0) {
    message += `*Recommendations:*\n`;
    for (const r of recommendations) {
      message += `• ${r}\n`;
    }
  }

  return message;
}

// ============================================================
// AGENT TOOL DEFINITION
// ============================================================

export const attributionAgentTool = {
  name: 'attribution_agent',
  description: `Attribution and analytics agent for marketing metrics. Commands:
    - "sync" or "daily": Sync metrics from all ad platforms
    - "check" or "alerts": Check thresholds and send alerts
    - "report" or "daily-report": Generate daily report
    - "weekly" or "weekly-report": Generate weekly CMO report
    - "full" or "all": Run all daily attribution tasks`,
  input_schema: {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        enum: ['sync', 'daily', 'check', 'alerts', 'report', 'daily-report', 'weekly', 'weekly-report', 'full', 'all'],
        description: 'The attribution workflow command to run.',
      },
    },
    required: ['command'],
  },
  handler: async (args: { command: string }) => runAttributionWorkflow(args.command),
};
