/**
 * Meta Ads API Client
 * Uses the Meta Marketing API to create and manage campaigns
 */

const META_API_VERSION = 'v18.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export function isMetaConfigured(): boolean {
  return !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

function getConfig() {
  return {
    accessToken: process.env.META_ACCESS_TOKEN!,
    adAccountId: process.env.META_AD_ACCOUNT_ID!,
    pageId: process.env.META_PAGE_ID || '',
  };
}

async function metaApiCall(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, any>) {
  const config = getConfig();
  const url = `${META_BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (method === 'POST' && body) {
    // Meta API uses form-encoded params with access_token
    const params = new URLSearchParams();
    params.append('access_token', config.accessToken);
    for (const [key, value] of Object.entries(body)) {
      params.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    options.body = params.toString();
    options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  }

  const separator = endpoint.includes('?') ? '&' : '?';
  const fullUrl = method === 'GET' ? `${url}${separator}access_token=${config.accessToken}` : url;

  const response = await fetch(fullUrl, options);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code})`);
  }

  return data;
}

/**
 * Create a Meta Ads campaign
 */
export async function createMetaCampaign(params: {
  name: string;
  objective?: string;
  budget: number;
  status?: string;
}): Promise<{ id: string; name: string }> {
  const config = getConfig();
  const result = await metaApiCall(`/${config.adAccountId}/campaigns`, 'POST', {
    name: params.name,
    objective: params.objective || 'OUTCOME_LEADS',
    status: params.status || 'PAUSED',
    special_ad_categories: '[]',
  });
  return { id: result.id, name: params.name };
}

/**
 * Create an ad set within a campaign
 */
export async function createMetaAdSet(params: {
  campaignId: string;
  name: string;
  budget: number;
  targeting: {
    geoLocations?: { cities?: Array<{ key: string; name: string }> };
    ageMin?: number;
    ageMax?: number;
    interests?: Array<{ id: string; name: string }>;
  };
  optimization_goal?: string;
  billing_event?: string;
}): Promise<{ id: string }> {
  const config = getConfig();

  // Build targeting spec
  const targetingSpec: any = {
    geo_locations: params.targeting.geoLocations || {
      countries: ['US'],
      location_types: ['home'],
    },
    age_min: params.targeting.ageMin || 25,
    age_max: params.targeting.ageMax || 65,
  };

  if (params.targeting.interests?.length) {
    targetingSpec.flexible_spec = [{ interests: params.targeting.interests }];
  }

  const result = await metaApiCall(`/${config.adAccountId}/adsets`, 'POST', {
    campaign_id: params.campaignId,
    name: params.name,
    daily_budget: Math.round(params.budget * 100), // Budget in cents
    targeting: targetingSpec,
    optimization_goal: params.optimization_goal || 'LEAD_GENERATION',
    billing_event: params.billing_event || 'IMPRESSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    status: 'PAUSED',
  });

  return { id: result.id };
}

/**
 * Create an ad creative
 */
export async function createMetaAdCreative(params: {
  name: string;
  pageId: string;
  headline: string;
  body: string;
  callToAction?: string;
  linkUrl?: string;
  imageUrl?: string;
}): Promise<{ id: string }> {
  const config = getConfig();

  const objectStorySpec: any = {
    page_id: params.pageId || config.pageId,
    link_data: {
      message: params.body,
      name: params.headline,
      link: params.linkUrl || 'https://stiltnerlandscapes.com/contact',
      call_to_action: {
        type: params.callToAction || 'LEARN_MORE',
      },
    },
  };

  if (params.imageUrl) {
    objectStorySpec.link_data.picture = params.imageUrl;
  }

  const result = await metaApiCall(`/${config.adAccountId}/adcreatives`, 'POST', {
    name: params.name,
    object_story_spec: objectStorySpec,
  });

  return { id: result.id };
}

/**
 * Create an ad
 */
export async function createMetaAd(params: {
  name: string;
  adSetId: string;
  creativeId: string;
}): Promise<{ id: string }> {
  const config = getConfig();

  const result = await metaApiCall(`/${config.adAccountId}/ads`, 'POST', {
    name: params.name,
    adset_id: params.adSetId,
    creative: { creative_id: params.creativeId },
    status: 'PAUSED',
  });

  return { id: result.id };
}

/**
 * Get account metrics
 */
export async function getMetaAccountMetrics(dateRange: string = 'last_7d'): Promise<{
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpl: number;
}> {
  const config = getConfig();

  const result = await metaApiCall(
    `/${config.adAccountId}/insights?fields=spend,impressions,clicks,actions,ctr,cpc&date_preset=${dateRange}`
  );

  const data = result.data?.[0] || {};
  const leads = (data.actions || []).find((a: any) => a.action_type === 'lead')?.value || 0;

  return {
    spend: parseFloat(data.spend || '0'),
    impressions: parseInt(data.impressions || '0'),
    clicks: parseInt(data.clicks || '0'),
    conversions: parseInt(leads),
    ctr: parseFloat(data.ctr || '0'),
    cpc: parseFloat(data.cpc || '0'),
    cpl: leads > 0 ? parseFloat(data.spend || '0') / parseInt(leads) : 0,
  };
}

/**
 * Get campaigns list with metrics
 */
export async function getMetaCampaigns(): Promise<Array<{
  id: string;
  name: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
}>> {
  const config = getConfig();

  const result = await metaApiCall(
    `/${config.adAccountId}/campaigns?fields=id,name,status,objective&limit=50`
  );

  return (result.data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    objective: c.objective,
    spend: 0,
    impressions: 0,
    clicks: 0,
  }));
}

/**
 * Full campaign creation flow: Campaign -> Ad Set -> Creative -> Ad
 * Returns all created IDs
 */
export async function createFullMetaCampaign(params: {
  name: string;
  budget: number;
  headlines: string[];
  descriptions: string[];
  targeting?: any;
  locations?: string[];
}): Promise<{
  success: boolean;
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
  error?: string;
}> {
  try {
    // Step 1: Create campaign
    const campaign = await createMetaCampaign({
      name: params.name,
      budget: params.budget,
      status: 'PAUSED',
    });

    // Step 2: Create ad set with targeting
    const adSet = await createMetaAdSet({
      campaignId: campaign.id,
      name: `${params.name} - Ad Set`,
      budget: params.budget,
      targeting: params.targeting || {},
    });

    // Step 3: Create ad creative with first headline and description
    const config = getConfig();
    const creative = await createMetaAdCreative({
      name: `${params.name} - Creative`,
      pageId: config.pageId,
      headline: params.headlines[0] || params.name,
      body: params.descriptions[0] || `Professional landscaping services. Get your free estimate today!`,
      callToAction: 'LEARN_MORE',
      linkUrl: 'https://stiltnerlandscapes.com/contact',
    });

    // Step 4: Create the ad linking everything
    const ad = await createMetaAd({
      name: `${params.name} - Ad`,
      adSetId: adSet.id,
      creativeId: creative.id,
    });

    return {
      success: true,
      campaignId: campaign.id,
      adSetId: adSet.id,
      creativeId: creative.id,
      adId: ad.id,
    };
  } catch (error) {
    console.error('Meta campaign creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Meta campaign',
    };
  }
}
