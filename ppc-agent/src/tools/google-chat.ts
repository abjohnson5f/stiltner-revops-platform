/**
 * Google Chat Tools
 *
 * Send team notifications to Google Chat spaces.
 * Uses Google Chat API with service account authentication.
 */

import { GOOGLE_CHAT_CONFIG, BUSINESS_CONTEXT } from '../config/index.js';

// ============================================================
// TYPES
// ============================================================

interface ChatMessage {
  text?: string;
  cards?: ChatCard[];
  cardsV2?: ChatCardV2[];
}

interface ChatCard {
  header?: {
    title: string;
    subtitle?: string;
    imageUrl?: string;
    imageStyle?: 'IMAGE' | 'AVATAR';
  };
  sections?: ChatSection[];
}

interface ChatCardV2 {
  cardId: string;
  card: {
    header?: {
      title: string;
      subtitle?: string;
      imageUrl?: string;
      imageType?: 'CIRCLE' | 'SQUARE';
    };
    sections?: ChatSectionV2[];
  };
}

interface ChatSection {
  header?: string;
  widgets?: ChatWidget[];
}

interface ChatSectionV2 {
  header?: string;
  widgets?: ChatWidgetV2[];
  collapsible?: boolean;
}

interface ChatWidget {
  textParagraph?: { text: string };
  keyValue?: {
    topLabel?: string;
    content: string;
    contentMultiline?: boolean;
    bottomLabel?: string;
    icon?: string;
    button?: ChatButton;
  };
  buttons?: ChatButton[];
}

interface ChatWidgetV2 {
  decoratedText?: {
    topLabel?: string;
    text: string;
    bottomLabel?: string;
    startIcon?: { knownIcon: string };
    button?: ChatButtonV2;
  };
  textParagraph?: { text: string };
  buttonList?: { buttons: ChatButtonV2[] };
  divider?: {};
}

interface ChatButton {
  textButton?: {
    text: string;
    onClick?: { openLink?: { url: string } };
  };
}

interface ChatButtonV2 {
  text: string;
  onClick?: { openLink?: { url: string } };
  color?: { red: number; green: number; blue: number };
}

// ============================================================
// AUTHENTICATION
// ============================================================

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Get an access token using service account credentials
 * Uses the JWT Bearer flow for Google APIs
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a cached token that's still valid
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60000) {
    return cachedAccessToken.token;
  }

  if (!GOOGLE_CHAT_CONFIG.serviceAccountJson) {
    throw new Error('Google Chat service account JSON not configured');
  }

  const credentials: ServiceAccountCredentials = JSON.parse(
    GOOGLE_CHAT_CONFIG.serviceAccountJson
  );

  // Create JWT header and claim
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/chat.bot',
    aud: credentials.token_uri,
    iat: now,
    exp: now + 3600, // 1 hour
  };

  // Sign the JWT (using native crypto in Node.js 20+)
  const { createSign } = await import('node:crypto');

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedClaim = Buffer.from(JSON.stringify(claim)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const sign = createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(credentials.private_key, 'base64url');

  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get Google Chat access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();

  // Cache the token
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000,
  };

  return cachedAccessToken.token;
}

// ============================================================
// CORE API FUNCTIONS
// ============================================================

/**
 * Send a message via webhook (simple POST request)
 */
async function sendViaWebhook(
  message: ChatMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!GOOGLE_CHAT_CONFIG.webhookUrl) {
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const response = await fetch(GOOGLE_CHAT_CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Chat webhook error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('✅ Google Chat message sent via webhook');

    return {
      success: true,
      messageId: result.name,
    };
  } catch (error) {
    console.error('❌ Failed to send Google Chat message via webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a message via service account (OAuth2 flow)
 */
async function sendViaServiceAccount(
  message: ChatMessage,
  spaceId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      `https://chat.googleapis.com/v1/${spaceId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Chat API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('✅ Google Chat message sent via service account');

    return {
      success: true,
      messageId: result.name,
    };
  } catch (error) {
    console.error('❌ Failed to send Google Chat message via service account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a message to a Google Chat space
 * Automatically uses webhook if configured, otherwise falls back to service account
 */
export async function sendMessage(
  message: ChatMessage,
  spaceId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!GOOGLE_CHAT_CONFIG.isConfigured) {
    console.warn('⚠️  Google Chat not configured. Message not sent.');
    return { success: false, error: 'Google Chat not configured' };
  }

  // Prefer webhook (simpler, no auth required)
  if (GOOGLE_CHAT_CONFIG.useWebhook && GOOGLE_CHAT_CONFIG.webhookUrl) {
    return sendViaWebhook(message);
  }

  // Fall back to service account
  const targetSpaceId = spaceId || GOOGLE_CHAT_CONFIG.spaceId;
  if (!targetSpaceId) {
    return { success: false, error: 'Space ID not configured' };
  }

  return sendViaServiceAccount(message, targetSpaceId);
}

// ============================================================
// PRE-BUILT NOTIFICATION TEMPLATES
// ============================================================

export interface LeadNotificationData {
  leadId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  service?: string;
  propertyAddress?: string;
  city?: string;
  message?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

/**
 * Send a new lead notification with rich card format
 */
export async function sendLeadNotification(
  lead: LeadNotificationData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown';
  const location = lead.city ? `${lead.city}, OH` : 'Location not provided';

  // Build attribution string
  const attribution: string[] = [];
  if (lead.utmSource) attribution.push(`Source: ${lead.utmSource}`);
  if (lead.utmMedium) attribution.push(`Medium: ${lead.utmMedium}`);
  if (lead.utmCampaign) attribution.push(`Campaign: ${lead.utmCampaign}`);
  const attributionText = attribution.length > 0 ? attribution.join(' | ') : 'Direct';

  const message: ChatMessage = {
    cardsV2: [
      {
        cardId: `lead-${lead.leadId}`,
        card: {
          header: {
            title: '🌿 New Lead!',
            subtitle: `${lead.service || 'General Inquiry'} - ${location}`,
            imageUrl: 'https://stiltnerlandscapes.com/favicon-96x96.png',
            imageType: 'CIRCLE',
          },
          sections: [
            {
              header: 'Contact Information',
              widgets: [
                {
                  decoratedText: {
                    startIcon: { knownIcon: 'PERSON' },
                    topLabel: 'Name',
                    text: fullName,
                  },
                },
                {
                  decoratedText: {
                    startIcon: { knownIcon: 'EMAIL' },
                    topLabel: 'Email',
                    text: lead.email,
                    button: {
                      text: 'Email',
                      onClick: { openLink: { url: `mailto:${lead.email}` } },
                    },
                  },
                },
                ...(lead.phone
                  ? [
                      {
                        decoratedText: {
                          startIcon: { knownIcon: 'PHONE' },
                          topLabel: 'Phone',
                          text: lead.phone,
                          button: {
                            text: 'Call',
                            onClick: { openLink: { url: `tel:${lead.phone}` } },
                          },
                        },
                      },
                    ]
                  : []),
              ],
            },
            ...(lead.propertyAddress || lead.message
              ? [
                  {
                    header: 'Request Details',
                    widgets: [
                      ...(lead.propertyAddress
                        ? [
                            {
                              decoratedText: {
                                startIcon: { knownIcon: 'MAP_PIN' },
                                topLabel: 'Property Address',
                                text: lead.propertyAddress,
                              },
                            },
                          ]
                        : []),
                      ...(lead.message
                        ? [
                            {
                              textParagraph: {
                                text: `<b>Message:</b>\n${lead.message}`,
                              },
                            },
                          ]
                        : []),
                    ],
                  },
                ]
              : []),
            {
              header: 'Attribution',
              collapsible: true,
              widgets: [
                {
                  decoratedText: {
                    startIcon: { knownIcon: 'BOOKMARK' },
                    text: attributionText,
                  },
                },
              ],
            },
            {
              widgets: [
                {
                  buttonList: {
                    buttons: [
                      {
                        text: 'View in Pipedrive',
                        onClick: {
                          openLink: {
                            url: `https://stiltner.pipedrive.com/leads/inbox`,
                          },
                        },
                        color: { red: 0.2, green: 0.6, blue: 0.2 },
                      },
                      {
                        text: 'View Lead',
                        onClick: {
                          openLink: {
                            url: `${BUSINESS_CONTEXT.website}/admin/leads/${lead.leadId}`,
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  return sendMessage(message);
}

/**
 * Send a workflow error notification
 */
export async function sendErrorNotification(
  workflowName: string,
  error: string,
  context?: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const contextText = context
    ? Object.entries(context)
        .map(([k, v]) => `• ${k}: ${v}`)
        .join('\n')
    : 'No additional context';

  const message: ChatMessage = {
    cardsV2: [
      {
        cardId: `error-${Date.now()}`,
        card: {
          header: {
            title: '⚠️ Workflow Error',
            subtitle: workflowName,
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `<b>Error:</b>\n<font color="#cc0000">${error}</font>`,
                  },
                },
              ],
            },
            {
              header: 'Context',
              collapsible: true,
              widgets: [
                {
                  textParagraph: {
                    text: contextText,
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  return sendMessage(message);
}

/**
 * Send a simple text notification
 */
export async function sendTextNotification(
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendMessage({ text });
}

/**
 * Send a daily summary notification
 */
export async function sendDailySummary(summary: {
  date: string;
  newLeads: number;
  totalSpend: number;
  conversions: number;
  topSources: Array<{ source: string; leads: number }>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message: ChatMessage = {
    cardsV2: [
      {
        cardId: `summary-${summary.date}`,
        card: {
          header: {
            title: '📊 Daily Marketing Summary',
            subtitle: summary.date,
          },
          sections: [
            {
              widgets: [
                {
                  decoratedText: {
                    startIcon: { knownIcon: 'PERSON' },
                    topLabel: 'New Leads',
                    text: `<b>${summary.newLeads}</b>`,
                  },
                },
                {
                  decoratedText: {
                    startIcon: { knownIcon: 'DOLLAR' },
                    topLabel: 'Ad Spend',
                    text: `<b>$${summary.totalSpend.toFixed(2)}</b>`,
                  },
                },
                {
                  decoratedText: {
                    startIcon: { knownIcon: 'CONFIRMATION_NUMBER_ICON' },
                    topLabel: 'Conversions',
                    text: `<b>${summary.conversions}</b>`,
                  },
                },
              ],
            },
            {
              header: 'Top Sources',
              widgets: summary.topSources.map((s) => ({
                decoratedText: {
                  text: `${s.source}: ${s.leads} leads`,
                },
              })),
            },
          ],
        },
      },
    ],
  };

  return sendMessage(message);
}

// ============================================================
// TOOL DEFINITIONS FOR AGENT
// ============================================================

export const googleChatTools = {
  send_gchat_message: {
    name: 'send_gchat_message',
    description: 'Send a text message to the team Google Chat space',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'The message text to send',
        },
      },
      required: ['text'],
    },
    handler: async ({ text }: { text: string }) => sendTextNotification(text),
  },

  send_lead_notification: {
    name: 'send_lead_notification',
    description: 'Send a rich lead notification card to the team Google Chat space',
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
    }) =>
      sendLeadNotification({
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
      }),
  },

  send_error_notification: {
    name: 'send_error_notification',
    description: 'Send a workflow error notification to the team',
    input_schema: {
      type: 'object' as const,
      properties: {
        workflow_name: { type: 'string', description: 'Name of the failed workflow' },
        error: { type: 'string', description: 'Error message' },
        context: {
          type: 'object',
          description: 'Additional context about the error',
        },
      },
      required: ['workflow_name', 'error'],
    },
    handler: async ({
      workflow_name,
      error,
      context,
    }: {
      workflow_name: string;
      error: string;
      context?: Record<string, unknown>;
    }) => sendErrorNotification(workflow_name, error, context),
  },

  send_daily_summary: {
    name: 'send_daily_summary',
    description: 'Send a daily marketing summary to the team',
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
    }) =>
      sendDailySummary({
        date: args.date,
        newLeads: args.new_leads,
        totalSpend: args.total_spend,
        conversions: args.conversions,
        topSources: args.top_sources || [],
      }),
  },
};

export const toolDefinitions = Object.values(googleChatTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const tool of Object.values(googleChatTools)) {
  toolHandlers[tool.name] = tool.handler;
}
