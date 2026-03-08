import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  // ============================================================
  // ANTHROPIC / CLAUDE
  // ============================================================
  ANTHROPIC_API_KEY: z.string().min(1),
  AGENT_MODEL: z.string().default('claude-sonnet-4-20250514'),
  AGENT_MAX_TOKENS: z.coerce.number().default(8192),

  // ============================================================
  // GOOGLE ADS
  // ============================================================
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().min(1),
  GOOGLE_ADS_CLIENT_ID: z.string().min(1),
  GOOGLE_ADS_CLIENT_SECRET: z.string().min(1),
  GOOGLE_ADS_REFRESH_TOKEN: z.string().min(1),
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().min(1),
  GOOGLE_ADS_DEFAULT_CUSTOMER_ID: z.string().min(1),

  // ============================================================
  // DATAFORSEO
  // ============================================================
  DATAFORSEO_LOGIN: z.string().optional(),
  DATAFORSEO_PASSWORD: z.string().optional(),

  // ============================================================
  // NEON POSTGRES (Lead Database)
  // ============================================================
  NEON_DATABASE_URL: z.string().url().optional(),

  // ============================================================
  // GOOGLE CHAT (Team Notifications)
  // ============================================================
  GOOGLE_CHAT_WEBHOOK_URL: z.string().url().optional(), // Webhook URL (preferred)
  GOOGLE_CHAT_SERVICE_ACCOUNT_JSON: z.string().optional(), // JSON string of service account
  GOOGLE_CHAT_SPACE_ID: z.string().optional(), // spaces/XXXXXXX

  // ============================================================
  // PIPEDRIVE CRM
  // ============================================================
  PIPEDRIVE_API_TOKEN: z.string().optional(),
  PIPEDRIVE_COMPANY_DOMAIN: z.string().optional(), // e.g., "stiltner"

  // ============================================================
  // BEEHIIV (Newsletter)
  // ============================================================
  BEEHIIV_API_KEY: z.string().optional(),
  BEEHIIV_PUBLICATION_ID: z.string().optional(),

  // ============================================================
  // META MARKETING API (Facebook/Instagram Ads)
  // ============================================================
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  META_INSTAGRAM_ACCOUNT_ID: z.string().optional(),

  // ============================================================
  // TIKTOK
  // ============================================================
  TIKTOK_ACCESS_TOKEN: z.string().optional(),
  TIKTOK_OPEN_ID: z.string().optional(),

  // ============================================================
  // YOUTUBE
  // ============================================================
  YOUTUBE_API_KEY: z.string().optional(),
  YOUTUBE_CHANNEL_ID: z.string().optional(),
  YOUTUBE_OAUTH_CLIENT_ID: z.string().optional(),
  YOUTUBE_OAUTH_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_OAUTH_REFRESH_TOKEN: z.string().optional(),

  // ============================================================
  // GLIF (AI Image/Video Generation)
  // ============================================================
  GLIF_API_TOKEN: z.string().optional(),

  // ============================================================
  // NOTIFICATIONS (Legacy Slack)
  // ============================================================
  SLACK_WEBHOOK_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);

// ============================================================
// CONFIGURATION OBJECTS
// ============================================================

export const GOOGLE_ADS_CONFIG = {
  developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
  client_id: env.GOOGLE_ADS_CLIENT_ID,
  client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
  refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
  login_customer_id: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  customer_id: env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID,
};

export const DATAFORSEO_CONFIG = {
  login: env.DATAFORSEO_LOGIN,
  password: env.DATAFORSEO_PASSWORD,
  baseUrl: 'https://api.dataforseo.com/v3',
};

export const NEON_CONFIG = {
  connectionString: env.NEON_DATABASE_URL,
  isConfigured: !!env.NEON_DATABASE_URL,
};

export const GOOGLE_CHAT_CONFIG = {
  webhookUrl: env.GOOGLE_CHAT_WEBHOOK_URL,
  serviceAccountJson: env.GOOGLE_CHAT_SERVICE_ACCOUNT_JSON,
  spaceId: env.GOOGLE_CHAT_SPACE_ID,
  // Configured if we have webhook OR (service account + space)
  isConfigured: !!(env.GOOGLE_CHAT_WEBHOOK_URL || (env.GOOGLE_CHAT_SERVICE_ACCOUNT_JSON && env.GOOGLE_CHAT_SPACE_ID)),
  useWebhook: !!env.GOOGLE_CHAT_WEBHOOK_URL,
};

export const PIPEDRIVE_CONFIG = {
  apiToken: env.PIPEDRIVE_API_TOKEN,
  companyDomain: env.PIPEDRIVE_COMPANY_DOMAIN || 'stiltner',
  baseUrl: `https://${env.PIPEDRIVE_COMPANY_DOMAIN || 'stiltner'}.pipedrive.com/api/v1`,
  isConfigured: !!env.PIPEDRIVE_API_TOKEN,
};

export const BEEHIIV_CONFIG = {
  apiKey: env.BEEHIIV_API_KEY,
  publicationId: env.BEEHIIV_PUBLICATION_ID,
  baseUrl: 'https://api.beehiiv.com/v2',
  isConfigured: !!(env.BEEHIIV_API_KEY && env.BEEHIIV_PUBLICATION_ID),
};

export const META_CONFIG = {
  appId: env.META_APP_ID,
  appSecret: env.META_APP_SECRET,
  accessToken: env.META_ACCESS_TOKEN,
  adAccountId: env.META_AD_ACCOUNT_ID,
  pageId: env.META_PAGE_ID,
  instagramAccountId: env.META_INSTAGRAM_ACCOUNT_ID,
  baseUrl: 'https://graph.facebook.com/v19.0',
  isConfigured: !!(env.META_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID),
};

export const TIKTOK_CONFIG = {
  accessToken: env.TIKTOK_ACCESS_TOKEN,
  openId: env.TIKTOK_OPEN_ID,
  baseUrl: 'https://open.tiktokapis.com/v2',
  isConfigured: !!(env.TIKTOK_ACCESS_TOKEN && env.TIKTOK_OPEN_ID),
};

export const YOUTUBE_CONFIG = {
  apiKey: env.YOUTUBE_API_KEY,
  channelId: env.YOUTUBE_CHANNEL_ID,
  clientId: env.YOUTUBE_OAUTH_CLIENT_ID,
  clientSecret: env.YOUTUBE_OAUTH_CLIENT_SECRET,
  refreshToken: env.YOUTUBE_OAUTH_REFRESH_TOKEN,
  baseUrl: 'https://www.googleapis.com/youtube/v3',
  isConfigured: !!(env.YOUTUBE_API_KEY && env.YOUTUBE_CHANNEL_ID),
};

export const GLIF_CONFIG = {
  apiToken: env.GLIF_API_TOKEN,
  baseUrl: 'https://simple-api.glif.app',
  isConfigured: !!env.GLIF_API_TOKEN,
};

// ============================================================
// BUSINESS CONTEXT (Stiltner Landscapes)
// ============================================================

export const BUSINESS_CONTEXT = {
  name: 'Stiltner Landscapes',
  website: 'https://stiltnerlandscapes.com',
  phone: '(614) 707-4788',
  email: 'info@stiltnerlandscapes.com',
  locations: ['Dublin', 'Powell', 'Galena', 'New Albany', 'Westerville'],
  state: 'Ohio',
  services: [
    'Landscape Design',
    'Hardscaping',
    'Outdoor Living',
    'Lawn Care',
    'Seasonal Maintenance',
    'Drainage Solutions',
    'Seasonal Color',
  ],
  seasonalPeaks: {
    spring: ['March', 'April', 'May'],
    summer: ['June', 'July', 'August'],
    fall: ['September', 'October', 'November'],
    winter: ['December', 'January', 'February'],
  },
};
