/**
 * Google Ads API Tools
 * 
 * These tools are exposed to the Claude Agent for querying
 * and (optionally) modifying Google Ads campaigns.
 */

import { GoogleAdsApi } from 'google-ads-api';
import { GOOGLE_ADS_CONFIG } from '../config/index.js';

// Initialize the Google Ads client
const client = new GoogleAdsApi({
  client_id: GOOGLE_ADS_CONFIG.client_id,
  client_secret: GOOGLE_ADS_CONFIG.client_secret,
  developer_token: GOOGLE_ADS_CONFIG.developer_token,
});

const customer = client.Customer({
  customer_id: GOOGLE_ADS_CONFIG.customer_id,
  login_customer_id: GOOGLE_ADS_CONFIG.login_customer_id,
  refresh_token: GOOGLE_ADS_CONFIG.refresh_token,
});

// ============================================================
// TOOL DEFINITIONS (for Claude Agent SDK)
// ============================================================

export const googleAdsTools = {
  /**
   * List all accessible Google Ads accounts
   */
  list_accounts: {
    name: 'list_accounts',
    description: 'List all Google Ads accounts accessible via the MCC',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: async () => {
      const query = `
        SELECT 
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.currency_code,
          customer_client.time_zone,
          customer_client.manager
        FROM customer_client
        WHERE customer_client.status = 'ENABLED'
      `;
      
      const results = await customer.query(query);
      return results.map((row: any) => ({
        id: row.customer_client?.id,
        name: row.customer_client?.descriptive_name,
        currency: row.customer_client?.currency_code,
        timezone: row.customer_client?.time_zone,
        is_manager: row.customer_client?.manager,
      }));
    },
  },

  /**
   * Get campaign performance metrics
   */
  get_campaign_performance: {
    name: 'get_campaign_performance',
    description: 'Get performance metrics for campaigns over a date range',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_range: {
          type: 'string',
          description: 'GAQL date range like LAST_30_DAYS, LAST_7_DAYS, THIS_MONTH',
          default: 'LAST_30_DAYS',
        },
        campaign_status: {
          type: 'string',
          enum: ['ENABLED', 'PAUSED', 'ALL'],
          default: 'ALL',
        },
      },
      required: [],
    },
    handler: async ({ date_range = 'LAST_30_DAYS', campaign_status = 'ALL' }) => {
      let statusFilter = '';
      if (campaign_status !== 'ALL') {
        statusFilter = `AND campaign.status = '${campaign_status}'`;
      }

      const query = `
        SELECT 
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.average_cpc,
          metrics.ctr,
          metrics.cost_per_conversion
        FROM campaign 
        WHERE segments.date DURING ${date_range}
        ${statusFilter}
        ORDER BY metrics.cost_micros DESC
      `;

      const results = await customer.query(query);
      return results.map((row: any) => ({
        id: row.campaign?.id,
        name: row.campaign?.name,
        status: row.campaign?.status,
        channel: row.campaign?.advertising_channel_type,
        impressions: row.metrics?.impressions || 0,
        clicks: row.metrics?.clicks || 0,
        cost: (row.metrics?.cost_micros || 0) / 1_000_000,
        conversions: row.metrics?.conversions || 0,
        conversion_value: row.metrics?.conversions_value || 0,
        avg_cpc: (row.metrics?.average_cpc || 0) / 1_000_000,
        ctr: row.metrics?.ctr || 0,
        cost_per_conversion: (row.metrics?.cost_per_conversion || 0) / 1_000_000,
      }));
    },
  },

  /**
   * Get keyword performance
   */
  get_keyword_performance: {
    name: 'get_keyword_performance',
    description: 'Get performance metrics for keywords',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_range: {
          type: 'string',
          default: 'LAST_30_DAYS',
        },
        min_impressions: {
          type: 'number',
          description: 'Minimum impressions filter',
          default: 0,
        },
        limit: {
          type: 'number',
          description: 'Max results to return',
          default: 50,
        },
      },
      required: [],
    },
    handler: async ({ date_range = 'LAST_30_DAYS', min_impressions = 0, limit = 50 }) => {
      const query = `
        SELECT 
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group.name,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.average_cpc,
          metrics.ctr
        FROM keyword_view 
        WHERE segments.date DURING ${date_range}
          AND metrics.impressions >= ${min_impressions}
        ORDER BY metrics.cost_micros DESC
        LIMIT ${limit}
      `;

      const results = await customer.query(query);
      return results.map((row: any) => ({
        keyword: row.ad_group_criterion?.keyword?.text,
        match_type: row.ad_group_criterion?.keyword?.match_type,
        ad_group: row.ad_group?.name,
        campaign: row.campaign?.name,
        impressions: row.metrics?.impressions || 0,
        clicks: row.metrics?.clicks || 0,
        cost: (row.metrics?.cost_micros || 0) / 1_000_000,
        conversions: row.metrics?.conversions || 0,
        avg_cpc: (row.metrics?.average_cpc || 0) / 1_000_000,
        ctr: row.metrics?.ctr || 0,
      }));
    },
  },

  /**
   * Get search terms report (what users actually searched)
   */
  get_search_terms: {
    name: 'get_search_terms',
    description: 'Get search terms that triggered your ads',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_range: { type: 'string', default: 'LAST_30_DAYS' },
        limit: { type: 'number', default: 100 },
      },
      required: [],
    },
    handler: async ({ date_range = 'LAST_30_DAYS', limit = 100 }) => {
      const query = `
        SELECT 
          search_term_view.search_term,
          campaign.name,
          ad_group.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM search_term_view
        WHERE segments.date DURING ${date_range}
        ORDER BY metrics.impressions DESC
        LIMIT ${limit}
      `;

      const results = await customer.query(query);
      return results.map((row: any) => ({
        search_term: row.search_term_view?.search_term,
        campaign: row.campaign?.name,
        ad_group: row.ad_group?.name,
        impressions: row.metrics?.impressions || 0,
        clicks: row.metrics?.clicks || 0,
        cost: (row.metrics?.cost_micros || 0) / 1_000_000,
        conversions: row.metrics?.conversions || 0,
      }));
    },
  },

  /**
   * Get location targeting for campaigns
   */
  get_location_targeting: {
    name: 'get_location_targeting',
    description: 'Get location targeting criteria for all campaigns (or a specific campaign). Shows which geographic locations are targeted or excluded.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Optional campaign ID to filter. If omitted, returns all campaigns.',
        },
      },
      required: [],
    },
    handler: async ({ campaign_id }: { campaign_id?: string } = {}) => {
      let campaignFilter = '';
      if (campaign_id) {
        campaignFilter = `AND campaign.id = ${campaign_id}`;
      }

      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign_criterion.criterion_id,
          campaign_criterion.location.geo_target_constant,
          campaign_criterion.negative,
          campaign_criterion.type
        FROM campaign_criterion
        WHERE campaign_criterion.type = 'LOCATION'
          AND campaign.status != 'REMOVED'
          ${campaignFilter}
        ORDER BY campaign.name
      `;

      const results = await customer.query(query);

      // Also get the geo targeting settings per campaign
      const settingsQuery = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.geo_target_type_setting.positive_geo_target_type,
          campaign.geo_target_type_setting.negative_geo_target_type
        FROM campaign
        WHERE campaign.status != 'REMOVED'
          ${campaignFilter}
      `;

      const settingsResults = await customer.query(settingsQuery);

      const settings = settingsResults.reduce((acc: any, row: any) => {
        acc[row.campaign?.id] = {
          positive_geo_target_type: row.campaign?.geo_target_type_setting?.positive_geo_target_type || 'NOT_SET',
          negative_geo_target_type: row.campaign?.geo_target_type_setting?.negative_geo_target_type || 'NOT_SET',
        };
        return acc;
      }, {});

      const campaigns: Record<string, any> = {};

      for (const row of results) {
        const cId = row.campaign?.id;
        if (!campaigns[cId]) {
          campaigns[cId] = {
            campaign_id: cId,
            campaign_name: row.campaign?.name,
            campaign_status: row.campaign?.status,
            geo_target_settings: settings[cId] || { positive_geo_target_type: 'NOT_SET', negative_geo_target_type: 'NOT_SET' },
            targeted_locations: [],
            excluded_locations: [],
          };
        }

        const locationData = {
          criterion_id: row.campaign_criterion?.criterion_id,
          geo_target_constant: row.campaign_criterion?.location?.geo_target_constant,
        };

        if (row.campaign_criterion?.negative) {
          campaigns[cId].excluded_locations.push(locationData);
        } else {
          campaigns[cId].targeted_locations.push(locationData);
        }
      }

      // Flag campaigns with NO location targeting (running nationally)
      for (const settingsRow of settingsResults) {
        const cId = settingsRow.campaign?.id;
        if (!campaigns[cId]) {
          campaigns[cId] = {
            campaign_id: cId,
            campaign_name: settingsRow.campaign?.name,
            campaign_status: settingsRow.campaign?.status,
            geo_target_settings: settings[cId] || {},
            targeted_locations: [],
            excluded_locations: [],
            WARNING: 'NO LOCATION TARGETING — this campaign serves NATIONALLY',
          };
        }
      }

      return Object.values(campaigns);
    },
  },

  /**
   * Get geographic performance data (where ads are actually serving)
   */
  get_geo_performance: {
    name: 'get_geo_performance',
    description: 'Get performance metrics broken down by geographic location (where users physically are). Shows where your ads are actually being shown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_range: {
          type: 'string',
          description: 'GAQL date range like LAST_30_DAYS, LAST_7_DAYS',
          default: 'LAST_30_DAYS',
        },
        campaign_id: {
          type: 'string',
          description: 'Optional campaign ID to filter',
        },
        limit: {
          type: 'number',
          description: 'Max results to return',
          default: 50,
        },
      },
      required: [],
    },
    handler: async ({ date_range = 'LAST_30_DAYS', campaign_id, limit = 50 }: { date_range?: string; campaign_id?: string; limit?: number } = {}) => {
      let campaignFilter = '';
      if (campaign_id) {
        campaignFilter = `AND campaign.id = ${campaign_id}`;
      }

      const query = `
        SELECT
          campaign.id,
          campaign.name,
          geographic_view.country_criterion_id,
          geographic_view.location_type,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM geographic_view
        WHERE segments.date DURING ${date_range}
          ${campaignFilter}
        ORDER BY metrics.cost_micros DESC
        LIMIT ${limit}
      `;

      const results = await customer.query(query);
      return results.map((row: any) => ({
        campaign_id: row.campaign?.id,
        campaign_name: row.campaign?.name,
        country_criterion_id: row.geographic_view?.country_criterion_id,
        location_type: row.geographic_view?.location_type,
        impressions: row.metrics?.impressions || 0,
        clicks: row.metrics?.clicks || 0,
        cost: (row.metrics?.cost_micros || 0) / 1_000_000,
        conversions: row.metrics?.conversions || 0,
      }));
    },
  },

  /**
   * Execute a raw GAQL query
   */
  query: {
    name: 'query',
    description: 'Execute a raw GAQL (Google Ads Query Language) query',
    input_schema: {
      type: 'object' as const,
      properties: {
        gaql: {
          type: 'string',
          description: 'The GAQL query to execute',
        },
      },
      required: ['gaql'],
    },
    handler: async ({ gaql }: { gaql: string }) => {
      // Security: Block mutation keywords in queries
      const blocked = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'MUTATE'];
      const upperQuery = gaql.toUpperCase();
      for (const keyword of blocked) {
        if (upperQuery.includes(keyword)) {
          throw new Error(`Mutation keyword "${keyword}" not allowed in query tool. Use mutation tools instead.`);
        }
      }

      const results = await customer.query(gaql);
      return results;
    },
  },
};

// Export tool list for Claude Agent SDK registration
export const toolDefinitions = Object.values(googleAdsTools).map(tool => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

// Export handler map
export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const [key, tool] of Object.entries(googleAdsTools)) {
  toolHandlers[tool.name] = tool.handler;
}

// ============================================================
// ACCOUNT-LEVEL INSIGHTS (for Attribution Agent)
// ============================================================

export interface GoogleAdsAccountInsight {
  date: string;
  impressions: string;
  clicks: string;
  cost_micros: string;
  conversions?: string;
  conversions_value?: string;
}

/**
 * Get account-level insights for a date range
 * Used by Attribution Agent for daily stats sync
 */
export async function getAccountInsights(dateRange?: {
  since: string;
  until: string;
}): Promise<GoogleAdsAccountInsight[]> {
  const dateFilter = dateRange
    ? `segments.date >= '${dateRange.since}' AND segments.date <= '${dateRange.until}'`
    : `segments.date DURING LAST_7_DAYS`;

  const query = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM customer
    WHERE ${dateFilter}
    ORDER BY segments.date DESC
  `;

  const results = await customer.query(query);
  return results.map((row: any) => ({
    date: row.segments?.date,
    impressions: String(row.metrics?.impressions || 0),
    clicks: String(row.metrics?.clicks || 0),
    cost_micros: String(row.metrics?.cost_micros || 0),
    conversions: String(row.metrics?.conversions || 0),
    conversions_value: String(row.metrics?.conversions_value || 0),
  }));
}
