/**
 * DataForSEO API Tools
 * 
 * These tools provide competitive intelligence, keyword research,
 * and market data for the PPC agent.
 */

import { DATAFORSEO_CONFIG } from '../config/index.js';

const authHeader = DATAFORSEO_CONFIG.login && DATAFORSEO_CONFIG.password
  ? `Basic ${Buffer.from(`${DATAFORSEO_CONFIG.login}:${DATAFORSEO_CONFIG.password}`).toString('base64')}`
  : null;

async function callDataForSEO(endpoint: string, body: any) {
  if (!authHeader) {
    throw new Error('DataForSEO credentials not configured');
  }

  const response = await fetch(`${DATAFORSEO_CONFIG.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([body]),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status}`);
  }

  const data = await response.json();
  return data.tasks?.[0]?.result || [];
}

export const dataForSEOTools = {
  /**
   * Get keyword search volume and metrics
   */
  get_keyword_data: {
    name: 'get_keyword_data',
    description: 'Get search volume, CPC, and competition data for keywords',
    input_schema: {
      type: 'object' as const,
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of keywords to research (max 1000)',
        },
        location_name: {
          type: 'string',
          default: 'United States',
        },
        language_code: {
          type: 'string',
          default: 'en',
        },
      },
      required: ['keywords'],
    },
    handler: async ({ keywords, location_name = 'United States', language_code = 'en' }: { keywords: string[]; location_name?: string; language_code?: string }) => {
      const results = await callDataForSEO('/keywords_data/google_ads/search_volume/live', {
        keywords,
        location_name,
        language_code,
      });

      return results.map((item: any) => ({
        keyword: item.keyword,
        search_volume: item.search_volume,
        cpc: item.cpc,
        competition: item.competition,
        competition_index: item.competition_index,
        monthly_searches: item.monthly_searches,
      }));
    },
  },

  /**
   * Get competitor domain keywords
   */
  get_competitor_keywords: {
    name: 'get_competitor_keywords',
    description: 'Get keywords a competitor domain ranks for in paid search',
    input_schema: {
      type: 'object' as const,
      properties: {
        domain: {
          type: 'string',
          description: 'Competitor domain (e.g., competitor.com)',
        },
        location_name: {
          type: 'string',
          default: 'United States',
        },
        limit: {
          type: 'number',
          default: 100,
        },
      },
      required: ['domain'],
    },
    handler: async ({ domain, location_name = 'United States', limit = 100 }: { domain: string; location_name?: string; limit?: number }) => {
      const results = await callDataForSEO('/dataforseo_labs/google/ranked_keywords/live', {
        target: domain,
        location_name,
        language_code: 'en',
        limit,
        item_types: ['paid'],
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
      });

      return results.flatMap((r: any) => r.items || []).map((item: any) => ({
        keyword: item.keyword_data?.keyword,
        search_volume: item.keyword_data?.keyword_info?.search_volume,
        cpc: item.keyword_data?.keyword_info?.cpc,
        position: item.ranked_serp_element?.serp_item?.rank_absolute,
        url: item.ranked_serp_element?.serp_item?.url,
      }));
    },
  },

  /**
   * Get SERP competitors for keywords
   */
  get_serp_competitors: {
    name: 'get_serp_competitors',
    description: 'Find competitors bidding on the same keywords',
    input_schema: {
      type: 'object' as const,
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords to analyze',
        },
        location_name: {
          type: 'string',
          default: 'United States',
        },
      },
      required: ['keywords'],
    },
    handler: async ({ keywords, location_name = 'United States' }: { keywords: string[]; location_name?: string }) => {
      const results = await callDataForSEO('/dataforseo_labs/google/serp_competitors/live', {
        keywords,
        location_name,
        language_code: 'en',
        item_types: ['paid'],
        limit: 20,
      });

      return results.flatMap((r: any) => r.items || []).map((item: any) => ({
        domain: item.domain,
        avg_position: item.avg_position,
        keywords_count: item.se_results_count,
        etv: item.etv, // Estimated traffic value
        visibility: item.visibility,
      }));
    },
  },

  /**
   * Get keyword suggestions
   */
  get_keyword_suggestions: {
    name: 'get_keyword_suggestions',
    description: 'Get keyword suggestions/ideas based on a seed keyword',
    input_schema: {
      type: 'object' as const,
      properties: {
        keyword: {
          type: 'string',
          description: 'Seed keyword',
        },
        location_name: {
          type: 'string',
          default: 'United States',
        },
        limit: {
          type: 'number',
          default: 50,
        },
      },
      required: ['keyword'],
    },
    handler: async ({ keyword, location_name = 'United States', limit = 50 }: { keyword: string; location_name?: string; limit?: number }) => {
      const results = await callDataForSEO('/dataforseo_labs/google/keyword_suggestions/live', {
        keyword,
        location_name,
        language_code: 'en',
        limit,
        order_by: ['keyword_info.search_volume,desc'],
      });

      return results.flatMap((r: any) => r.items || []).map((item: any) => ({
        keyword: item.keyword,
        search_volume: item.keyword_info?.search_volume,
        cpc: item.keyword_info?.cpc,
        competition: item.keyword_info?.competition_level,
      }));
    },
  },

  /**
   * Get live SERP results
   */
  get_serp_results: {
    name: 'get_serp_results',
    description: 'Get live Google SERP results for a keyword',
    input_schema: {
      type: 'object' as const,
      properties: {
        keyword: {
          type: 'string',
        },
        location_name: {
          type: 'string',
          default: 'United States',
        },
      },
      required: ['keyword'],
    },
    handler: async ({ keyword, location_name = 'United States' }: { keyword: string; location_name?: string }) => {
      const results = await callDataForSEO('/serp/google/organic/live/advanced', {
        keyword,
        location_name,
        language_code: 'en',
        depth: 20,
      });

      const items = results.flatMap((r: any) => r.items || []);
      
      return {
        organic: items.filter((i: any) => i.type === 'organic').map((item: any) => ({
          position: item.rank_absolute,
          title: item.title,
          url: item.url,
          domain: item.domain,
        })),
        paid: items.filter((i: any) => i.type === 'paid').map((item: any) => ({
          position: item.rank_absolute,
          title: item.title,
          url: item.url,
          domain: item.domain,
          description: item.description,
        })),
      };
    },
  },
};

export const toolDefinitions = Object.values(dataForSEOTools).map(tool => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const tool of Object.values(dataForSEOTools)) {
  toolHandlers[tool.name] = tool.handler;
}
