/**
 * Notification Tools
 * 
 * Send alerts and reports via Google Chat (primary), Slack (fallback), etc.
 */

import { env } from '../config/index.js';
import { GOOGLE_CHAT_CONFIG } from '../config/index.js';
import { 
  sendTextNotification as sendGChatText,
  sendLeadNotification as sendGChatLead,
  sendErrorNotification as sendGChatError,
  sendDailySummary as sendGChatSummary,
  type LeadNotificationData
} from './google-chat.js';

// ============================================================
// GOOGLE CHAT NOTIFICATIONS (PRIMARY)
// ============================================================

/**
 * Send a message to Google Chat (preferred) or Slack (fallback)
 */
export async function sendNotification(message: string): Promise<boolean> {
  // Try Google Chat first
  if (GOOGLE_CHAT_CONFIG.isConfigured) {
    const result = await sendGChatText(message);
    if (result.success) return true;
  }

  // Fall back to Slack
  if (env.SLACK_WEBHOOK_URL) {
    return sendSlackMessage({ text: message });
  }

  console.warn('⚠️  No notification channel configured');
  return false;
}

// ============================================================
// SLACK NOTIFICATIONS (FALLBACK)
// ============================================================

interface SlackMessage {
  channel?: string;
  text: string;
  blocks?: any[];
  attachments?: any[];
}

export async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('⚠️  Slack webhook not configured. Message not sent.');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message.text,
        blocks: message.blocks,
        attachments: message.attachments,
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    console.log('✅ Slack message sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send Slack message:', error);
    return false;
  }
}

// ============================================================
// PRE-BUILT NOTIFICATION TEMPLATES
// ============================================================

/**
 * Send a health check alert
 */
export async function sendHealthCheckAlert(
  issues: Array<{ severity: string; title: string; impact: string }>,
  metrics: { totalSpend: number; wastedSpend: number; ctr: number }
): Promise<boolean> {
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const highIssues = issues.filter(i => i.severity === 'high');

  const text = `🏥 *PPC Health Check Alert*\n\n` +
    `💰 Total Spend: $${metrics.totalSpend.toFixed(2)}\n` +
    `💸 Wasted Spend: $${metrics.wastedSpend.toFixed(2)}\n` +
    `📊 CTR: ${(metrics.ctr * 100).toFixed(2)}%\n\n` +
    `🔴 Critical Issues: ${criticalIssues.length}\n` +
    `🟠 High Issues: ${highIssues.length}`;

  return sendNotification(text);
}

/**
 * Send a campaign created notification
 */
export async function sendCampaignCreatedAlert(
  campaignName: string,
  budget: number,
  adGroups: number,
  keywords: number,
  status: 'validated' | 'created'
): Promise<boolean> {
  const emoji = status === 'created' ? '🚀' : '✅';
  const statusText = status === 'created' ? 'CREATED' : 'VALIDATED';

  const text = `${emoji} *Campaign ${statusText}*\n\n` +
    `📋 ${campaignName}\n` +
    `💰 Budget: $${budget}/day\n` +
    `📁 Ad Groups: ${adGroups}\n` +
    `🔑 Keywords: ${keywords}`;

  return sendNotification(text);
}

/**
 * Send a wasted spend alert
 */
export async function sendWastedSpendAlert(
  totalWasted: number,
  topKeywords: Array<{ keyword: string; spend: number; clicks: number }>
): Promise<boolean> {
  if (totalWasted < 10) {
    // Don't alert for small amounts
    return false;
  }

  const urgency = totalWasted > 100 ? '🔴 URGENT' : totalWasted > 50 ? '🟠 WARNING' : '🟡 INFO';

  const text = `${urgency} *Wasted Spend Detected*\n\n` +
    `💸 Total: $${totalWasted.toFixed(2)}\n\n` +
    `Top wasting keywords:\n` +
    topKeywords.slice(0, 5).map(k => 
      `• "${k.keyword}": $${k.spend.toFixed(2)} (${k.clicks} clicks, 0 conv)`
    ).join('\n');

  return sendNotification(text);
}

/**
 * Send a competitor alert
 */
export async function sendCompetitorAlert(
  competitors: Array<{ domain: string; keywords: number; estimatedSpend: number }>
): Promise<boolean> {
  const text = `🔍 *Competitor Intelligence Update*\n\n` +
    competitors.slice(0, 5).map(c =>
      `• *${c.domain}*: ${c.keywords} keywords, ~$${c.estimatedSpend.toLocaleString()}/mo`
    ).join('\n');

  return sendNotification(text);
}

// ============================================================
// TOOL DEFINITIONS FOR AGENT
// ============================================================

export const notificationTools = {
  send_notification: {
    name: 'send_notification',
    description: 'Send a notification to the team (via Google Chat or Slack)',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'The message to send',
        },
        urgency: {
          type: 'string',
          enum: ['info', 'warning', 'critical'],
          default: 'info',
        },
      },
      required: ['message'],
    },
    handler: async ({ message, urgency = 'info' }: { message: string; urgency?: string }) => {
      const emoji = { info: 'ℹ️', warning: '⚠️', critical: '🚨' }[urgency] || 'ℹ️';
      return sendNotification(`${emoji} ${message}`);
    },
  },

  send_gchat_message: {
    name: 'send_gchat_message',
    description: 'Send a message to Google Chat (team notifications)',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'The message to send',
        },
      },
      required: ['message'],
    },
    handler: async ({ message }: { message: string }) => {
      if (!GOOGLE_CHAT_CONFIG.isConfigured) {
        return { success: false, error: 'Google Chat not configured' };
      }
      return sendGChatText(message);
    },
  },

  send_lead_notification: {
    name: 'send_lead_notification',
    description: 'Send a rich lead notification card to Google Chat',
    input_schema: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string', description: 'Lead ID' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        service: { type: 'string', description: 'Service interest' },
        property_address: { type: 'string' },
        city: { type: 'string' },
        message: { type: 'string' },
        utm_source: { type: 'string' },
        utm_medium: { type: 'string' },
        utm_campaign: { type: 'string' },
      },
      required: ['lead_id', 'email'],
    },
    handler: async (args: {
      lead_id: string;
      first_name?: string;
      last_name?: string;
      email: string;
      phone?: string;
      service?: string;
      property_address?: string;
      city?: string;
      message?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    }) => {
      if (!GOOGLE_CHAT_CONFIG.isConfigured) {
        return { success: false, error: 'Google Chat not configured' };
      }
      return sendGChatLead({
        leadId: args.lead_id,
        firstName: args.first_name,
        lastName: args.last_name,
        email: args.email,
        phone: args.phone,
        service: args.service,
        propertyAddress: args.property_address,
        city: args.city,
        message: args.message,
        utmSource: args.utm_source,
        utmMedium: args.utm_medium,
        utmCampaign: args.utm_campaign,
      });
    },
  },

  send_daily_summary: {
    name: 'send_daily_summary',
    description: 'Send a daily marketing summary to Google Chat',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
        new_leads: { type: 'number' },
        total_spend: { type: 'number' },
        conversions: { type: 'number' },
        top_sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              leads: { type: 'number' },
            },
          },
        },
      },
      required: ['date', 'new_leads', 'total_spend', 'conversions'],
    },
    handler: async (args: {
      date: string;
      new_leads: number;
      total_spend: number;
      conversions: number;
      top_sources?: Array<{ source: string; leads: number }>;
    }) => {
      if (!GOOGLE_CHAT_CONFIG.isConfigured) {
        return { success: false, error: 'Google Chat not configured' };
      }
      return sendGChatSummary({
        date: args.date,
        newLeads: args.new_leads,
        totalSpend: args.total_spend,
        conversions: args.conversions,
        topSources: args.top_sources || [],
      });
    },
  },

  // Legacy Slack support
  send_slack_alert: {
    name: 'send_slack_alert',
    description: 'Send a Slack notification (legacy - prefer send_notification)',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'The message to send',
        },
        urgency: {
          type: 'string',
          enum: ['info', 'warning', 'critical'],
          default: 'info',
        },
      },
      required: ['message'],
    },
    handler: async ({ message, urgency = 'info' }: { message: string; urgency?: string }) => {
      const emoji = { info: 'ℹ️', warning: '⚠️', critical: '🚨' }[urgency] || 'ℹ️';
      return sendSlackMessage({ text: `${emoji} ${message}` });
    },
  },
};

export const toolDefinitions = Object.values(notificationTools).map(tool => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const tool of Object.values(notificationTools)) {
  toolHandlers[tool.name] = tool.handler;
}
