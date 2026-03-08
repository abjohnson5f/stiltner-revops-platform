/**
 * Meta Marketing API Tools
 *
 * Create and manage Facebook/Instagram ad campaigns.
 * Handles campaigns, ad sets, ads, and creative assets.
 */

import { META_CONFIG } from '../config/index.js';

// ============================================================
// API CLIENT
// ============================================================

interface MetaMarketingResponse<T> {
  data?: T;
  id?: string;
  success?: boolean;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Make a request to Meta Marketing API
 */
async function metaMarketingRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    params?: Record<string, string | number | boolean>;
  } = {}
): Promise<T> {
  if (!META_CONFIG.isConfigured) {
    throw new Error('Meta Marketing API not configured');
  }

  const { method = 'GET', body, params = {} } = options;

  const url = new URL(`${META_CONFIG.baseUrl}${endpoint}`);
  url.searchParams.set('access_token', META_CONFIG.accessToken!);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const fetchOptions: RequestInit = { method };

  if (body && method === 'POST') {
    // Meta API prefers form data for many endpoints
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
    fetchOptions.body = formData;
    fetchOptions.headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  const response = await fetch(url.toString(), fetchOptions);
  const data: MetaMarketingResponse<T> = await response.json();

  if (data.error) {
    throw new Error(
      `Meta Marketing API error: ${data.error.message} (code: ${data.error.code})`
    );
  }

  return (data.data || data) as T;
}

// ============================================================
// CAMPAIGNS
// ============================================================

export interface MetaCampaign {
  id: string;
  name: string;
  objective: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  buying_type: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time: string;
  updated_time: string;
}

export interface CreateCampaignInput {
  name: string;
  objective:
    | 'OUTCOME_AWARENESS'
    | 'OUTCOME_ENGAGEMENT'
    | 'OUTCOME_LEADS'
    | 'OUTCOME_SALES'
    | 'OUTCOME_TRAFFIC'
    | 'OUTCOME_APP_PROMOTION';
  status?: 'ACTIVE' | 'PAUSED';
  special_ad_categories?: Array<'NONE' | 'EMPLOYMENT' | 'HOUSING' | 'CREDIT'>;
  daily_budget?: number; // In cents
  lifetime_budget?: number; // In cents
}

/**
 * Create a new campaign
 */
export async function createCampaign(
  input: CreateCampaignInput
): Promise<MetaCampaign> {
  const result = await metaMarketingRequest<{ id: string }>(
    `/act_${META_CONFIG.adAccountId}/campaigns`,
    {
      method: 'POST',
      body: {
        name: input.name,
        objective: input.objective,
        status: input.status || 'PAUSED',
        special_ad_categories: input.special_ad_categories || ['NONE'],
        ...(input.daily_budget && { daily_budget: input.daily_budget }),
        ...(input.lifetime_budget && { lifetime_budget: input.lifetime_budget }),
      },
    }
  );

  // Fetch the created campaign
  return getCampaign(result.id);
}

/**
 * Get campaign by ID
 */
export async function getCampaign(campaignId: string): Promise<MetaCampaign> {
  return metaMarketingRequest<MetaCampaign>(`/${campaignId}`, {
    params: {
      fields: 'id,name,objective,status,buying_type,daily_budget,lifetime_budget,created_time,updated_time',
    },
  });
}

/**
 * List campaigns
 */
export async function listCampaigns(options?: {
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  limit?: number;
}): Promise<MetaCampaign[]> {
  const params: Record<string, string | number> = {
    fields: 'id,name,objective,status,daily_budget,lifetime_budget,created_time',
    limit: options?.limit || 25,
  };

  if (options?.status) {
    params.filtering = JSON.stringify([
      { field: 'effective_status', operator: 'IN', value: [options.status] },
    ]);
  }

  const result = await metaMarketingRequest<MetaCampaign[]>(
    `/act_${META_CONFIG.adAccountId}/campaigns`,
    { params }
  );

  return result;
}

/**
 * Update campaign status
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED'
): Promise<{ success: boolean }> {
  return metaMarketingRequest<{ success: boolean }>(`/${campaignId}`, {
    method: 'POST',
    body: { status },
  });
}

// ============================================================
// AD SETS
// ============================================================

export interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  daily_budget?: string;
  lifetime_budget?: string;
  bid_amount?: string;
  billing_event: string;
  optimization_goal: string;
  targeting: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
}

export interface TargetingSpec {
  geo_locations: {
    cities?: Array<{ key: string; radius?: number; distance_unit?: string }>;
    regions?: Array<{ key: string }>;
    countries?: string[];
    custom_locations?: Array<{
      latitude: number;
      longitude: number;
      radius: number;
      distance_unit: string;
    }>;
  };
  age_min?: number;
  age_max?: number;
  genders?: number[]; // 1 = male, 2 = female
  interests?: Array<{ id: string; name: string }>;
  behaviors?: Array<{ id: string; name: string }>;
  home_ownership?: Array<{ id: string; name: string }>;
  household_composition?: Array<{ id: string; name: string }>;
  publisher_platforms?: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
}

export interface CreateAdSetInput {
  name: string;
  campaign_id: string;
  daily_budget?: number; // In cents
  lifetime_budget?: number; // In cents
  bid_amount?: number; // In cents
  billing_event: 'IMPRESSIONS' | 'LINK_CLICKS' | 'PAGE_LIKES' | 'POST_ENGAGEMENT';
  optimization_goal:
    | 'NONE'
    | 'APP_INSTALLS'
    | 'BRAND_AWARENESS'
    | 'CLICKS'
    | 'ENGAGED_USERS'
    | 'IMPRESSIONS'
    | 'LANDING_PAGE_VIEWS'
    | 'LEAD_GENERATION'
    | 'LINK_CLICKS'
    | 'REACH'
    | 'THRUPLAY';
  targeting: TargetingSpec;
  status?: 'ACTIVE' | 'PAUSED';
  start_time?: string; // ISO 8601
  end_time?: string; // ISO 8601
}

/**
 * Create an ad set
 */
export async function createAdSet(input: CreateAdSetInput): Promise<MetaAdSet> {
  const result = await metaMarketingRequest<{ id: string }>(
    `/act_${META_CONFIG.adAccountId}/adsets`,
    {
      method: 'POST',
      body: {
        name: input.name,
        campaign_id: input.campaign_id,
        billing_event: input.billing_event,
        optimization_goal: input.optimization_goal,
        targeting: input.targeting,
        status: input.status || 'PAUSED',
        ...(input.daily_budget && { daily_budget: input.daily_budget }),
        ...(input.lifetime_budget && { lifetime_budget: input.lifetime_budget }),
        ...(input.bid_amount && { bid_amount: input.bid_amount }),
        ...(input.start_time && { start_time: input.start_time }),
        ...(input.end_time && { end_time: input.end_time }),
      },
    }
  );

  return getAdSet(result.id);
}

/**
 * Get ad set by ID
 */
export async function getAdSet(adSetId: string): Promise<MetaAdSet> {
  return metaMarketingRequest<MetaAdSet>(`/${adSetId}`, {
    params: {
      fields: 'id,name,campaign_id,status,daily_budget,lifetime_budget,bid_amount,billing_event,optimization_goal,targeting,start_time,end_time',
    },
  });
}

// ============================================================
// CREATIVES
// ============================================================

export interface MetaAdCreative {
  id: string;
  name: string;
  title?: string;
  body?: string;
  image_url?: string;
  video_id?: string;
  call_to_action_type?: string;
  link_url?: string;
}

export interface CreateCreativeInput {
  name: string;
  object_story_spec: {
    page_id: string;
    link_data?: {
      image_hash?: string;
      link: string;
      message: string;
      name?: string;
      description?: string;
      call_to_action?: {
        type: 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP' | 'BOOK_NOW' | 'CONTACT_US' | 'GET_QUOTE';
        value?: { link: string };
      };
    };
    video_data?: {
      video_id: string;
      title?: string;
      message: string;
      call_to_action?: {
        type: string;
        value?: { link: string };
      };
    };
    photo_data?: {
      image_hash: string;
      caption?: string;
    };
  };
}

/**
 * Upload an image and get its hash
 */
export async function uploadImage(
  imageUrl: string
): Promise<{ hash: string; url: string }> {
  const result = await metaMarketingRequest<{
    images: Record<string, { hash: string; url: string }>;
  }>(`/act_${META_CONFIG.adAccountId}/adimages`, {
    method: 'POST',
    body: { url: imageUrl },
  });

  const imageData = Object.values(result.images)[0];
  return { hash: imageData.hash, url: imageData.url };
}

/**
 * Create an ad creative
 */
export async function createCreative(
  input: CreateCreativeInput
): Promise<MetaAdCreative> {
  const result = await metaMarketingRequest<{ id: string }>(
    `/act_${META_CONFIG.adAccountId}/adcreatives`,
    {
      method: 'POST',
      body: {
        name: input.name,
        object_story_spec: input.object_story_spec,
      },
    }
  );

  return metaMarketingRequest<MetaAdCreative>(`/${result.id}`, {
    params: {
      fields: 'id,name,title,body,image_url,video_id,call_to_action_type,link_url',
    },
  });
}

// ============================================================
// ADS
// ============================================================

export interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  creative: { id: string };
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  created_time: string;
}

export interface CreateAdInput {
  name: string;
  adset_id: string;
  creative_id: string;
  status?: 'ACTIVE' | 'PAUSED';
}

/**
 * Create an ad
 */
export async function createAd(input: CreateAdInput): Promise<MetaAd> {
  const result = await metaMarketingRequest<{ id: string }>(
    `/act_${META_CONFIG.adAccountId}/ads`,
    {
      method: 'POST',
      body: {
        name: input.name,
        adset_id: input.adset_id,
        creative: { creative_id: input.creative_id },
        status: input.status || 'PAUSED',
      },
    }
  );

  return metaMarketingRequest<MetaAd>(`/${result.id}`, {
    params: {
      fields: 'id,name,adset_id,creative,status,created_time',
    },
  });
}

// ============================================================
// INSIGHTS / PERFORMANCE
// ============================================================

export interface AdInsights {
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  cpc: string;
  cpm: string;
  ctr: string;
  actions?: Array<{ action_type: string; value: string }>;
}

/**
 * Get campaign performance insights
 */
export async function getCampaignInsights(
  campaignId: string,
  dateRange?: { since: string; until: string }
): Promise<AdInsights[]> {
  const params: Record<string, string | number> = {
    fields: 'impressions,clicks,spend,reach,cpc,cpm,ctr,actions',
    level: 'campaign',
  };

  if (dateRange) {
    params.time_range = JSON.stringify({
      since: dateRange.since,
      until: dateRange.until,
    });
  }

  return metaMarketingRequest<AdInsights[]>(`/${campaignId}/insights`, { params });
}

/**
 * Get ad account insights (overall performance)
 */
export async function getAccountInsights(dateRange?: {
  since: string;
  until: string;
}): Promise<AdInsights[]> {
  const params: Record<string, string | number> = {
    fields: 'impressions,clicks,spend,reach,cpc,cpm,ctr,actions',
    level: 'account',
  };

  if (dateRange) {
    params.time_range = JSON.stringify({
      since: dateRange.since,
      until: dateRange.until,
    });
  }

  return metaMarketingRequest<AdInsights[]>(
    `/act_${META_CONFIG.adAccountId}/insights`,
    { params }
  );
}

// ============================================================
// HIGH-LEVEL CAMPAIGN BUILDER
// ============================================================

export interface QuickCampaignInput {
  name: string;
  objective: CreateCampaignInput['objective'];
  dailyBudget: number; // In dollars
  targetingLocations: string[]; // City names like "Dublin, Ohio"
  ageRange?: { min: number; max: number };
  imageUrl: string;
  headline: string;
  bodyText: string;
  linkUrl: string;
  callToAction: 'LEARN_MORE' | 'GET_QUOTE' | 'CONTACT_US' | 'BOOK_NOW';
}

/**
 * Create a complete campaign with ad set, creative, and ad in one call
 */
export async function createQuickCampaign(
  input: QuickCampaignInput
): Promise<{
  success: boolean;
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  error?: string;
}> {
  try {
    // 1. Create campaign
    const campaign = await createCampaign({
      name: input.name,
      objective: input.objective,
      status: 'PAUSED',
    });

    // 2. Upload image
    const image = await uploadImage(input.imageUrl);

    // 3. Create ad set with targeting
    // Note: In production, you'd look up geo IDs from Meta's targeting search
    const adSet = await createAdSet({
      name: `${input.name} - Ad Set`,
      campaign_id: campaign.id,
      daily_budget: input.dailyBudget * 100, // Convert to cents
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      targeting: {
        geo_locations: {
          // This is simplified - real implementation needs geo ID lookup
          countries: ['US'],
        },
        age_min: input.ageRange?.min || 25,
        age_max: input.ageRange?.max || 65,
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['feed', 'right_hand_column'],
        instagram_positions: ['stream', 'story'],
      },
      status: 'PAUSED',
    });

    // 4. Create creative
    const creative = await createCreative({
      name: `${input.name} - Creative`,
      object_story_spec: {
        page_id: META_CONFIG.pageId!,
        link_data: {
          image_hash: image.hash,
          link: input.linkUrl,
          message: input.bodyText,
          name: input.headline,
          call_to_action: {
            type: input.callToAction,
            value: { link: input.linkUrl },
          },
        },
      },
    });

    // 5. Create ad
    const ad = await createAd({
      name: `${input.name} - Ad`,
      adset_id: adSet.id,
      creative_id: creative.id,
      status: 'PAUSED',
    });

    return {
      success: true,
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// TOOL DEFINITIONS FOR AGENT
// ============================================================

export const metaAdsTools = {
  create_meta_campaign: {
    name: 'create_meta_campaign',
    description: 'Create a new Meta (Facebook/Instagram) ad campaign',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        objective: {
          type: 'string',
          enum: [
            'OUTCOME_AWARENESS',
            'OUTCOME_ENGAGEMENT',
            'OUTCOME_LEADS',
            'OUTCOME_SALES',
            'OUTCOME_TRAFFIC',
          ],
          description: 'Campaign objective',
        },
        daily_budget: {
          type: 'number',
          description: 'Daily budget in dollars',
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'PAUSED'],
          default: 'PAUSED',
        },
      },
      required: ['name', 'objective'],
    },
    handler: async (args: {
      name: string;
      objective: CreateCampaignInput['objective'];
      daily_budget?: number;
      status?: 'ACTIVE' | 'PAUSED';
    }) =>
      createCampaign({
        name: args.name,
        objective: args.objective,
        daily_budget: args.daily_budget ? args.daily_budget * 100 : undefined,
        status: args.status,
      }),
  },

  list_meta_campaigns: {
    name: 'list_meta_campaigns',
    description: 'List Meta ad campaigns',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
        },
        limit: { type: 'number', default: 25 },
      },
      required: [],
    },
    handler: listCampaigns,
  },

  get_meta_campaign_insights: {
    name: 'get_meta_campaign_insights',
    description: 'Get performance insights for a Meta campaign',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        since: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        until: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['campaign_id'],
    },
    handler: async ({
      campaign_id,
      since,
      until,
    }: {
      campaign_id: string;
      since?: string;
      until?: string;
    }) =>
      getCampaignInsights(
        campaign_id,
        since && until ? { since, until } : undefined
      ),
  },

  get_meta_account_insights: {
    name: 'get_meta_account_insights',
    description: 'Get overall Meta ad account performance',
    input_schema: {
      type: 'object' as const,
      properties: {
        since: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        until: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: [],
    },
    handler: async ({ since, until }: { since?: string; until?: string }) =>
      getAccountInsights(since && until ? { since, until } : undefined),
  },

  update_meta_campaign_status: {
    name: 'update_meta_campaign_status',
    description: 'Pause or activate a Meta campaign',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'PAUSED'] },
      },
      required: ['campaign_id', 'status'],
    },
    handler: async ({
      campaign_id,
      status,
    }: {
      campaign_id: string;
      status: 'ACTIVE' | 'PAUSED';
    }) => updateCampaignStatus(campaign_id, status),
  },

  create_quick_meta_campaign: {
    name: 'create_quick_meta_campaign',
    description:
      'Create a complete Meta campaign with ad set, creative, and ad in one call',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        objective: {
          type: 'string',
          enum: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC', 'OUTCOME_AWARENESS'],
        },
        daily_budget: { type: 'number', description: 'Daily budget in dollars' },
        targeting_locations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Target locations (e.g., ["Dublin, Ohio", "Powell, Ohio"])',
        },
        age_min: { type: 'number', default: 25 },
        age_max: { type: 'number', default: 65 },
        image_url: { type: 'string', description: 'URL of ad image' },
        headline: { type: 'string', description: 'Ad headline' },
        body_text: { type: 'string', description: 'Ad body text' },
        link_url: { type: 'string', description: 'Landing page URL' },
        call_to_action: {
          type: 'string',
          enum: ['LEARN_MORE', 'GET_QUOTE', 'CONTACT_US', 'BOOK_NOW'],
        },
      },
      required: [
        'name',
        'objective',
        'daily_budget',
        'image_url',
        'headline',
        'body_text',
        'link_url',
        'call_to_action',
      ],
    },
    handler: async (args: {
      name: string;
      objective: CreateCampaignInput['objective'];
      daily_budget: number;
      targeting_locations?: string[];
      age_min?: number;
      age_max?: number;
      image_url: string;
      headline: string;
      body_text: string;
      link_url: string;
      call_to_action: 'LEARN_MORE' | 'GET_QUOTE' | 'CONTACT_US' | 'BOOK_NOW';
    }) =>
      createQuickCampaign({
        name: args.name,
        objective: args.objective,
        dailyBudget: args.daily_budget,
        targetingLocations: args.targeting_locations || [],
        ageRange: args.age_min && args.age_max
          ? { min: args.age_min, max: args.age_max }
          : undefined,
        imageUrl: args.image_url,
        headline: args.headline,
        bodyText: args.body_text,
        linkUrl: args.link_url,
        callToAction: args.call_to_action,
      }),
  },
};

export const toolDefinitions = Object.values(metaAdsTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const tool of Object.values(metaAdsTools)) {
  toolHandlers[tool.name] = tool.handler;
}
