/**
 * Campaign Builder Agent
 * 
 * This agent creates complete Google Ads campaigns from natural language descriptions.
 * It handles the complex multi-step process of:
 * 1. Designing campaign structure
 * 2. Creating budgets
 * 3. Creating campaigns with proper settings
 * 4. Creating ad groups
 * 5. Adding keywords
 * 6. Creating responsive search ads
 * 7. Setting up location targeting
 * 
 * Uses the MCP bridge (proven to work!) for all Google Ads operations.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/index.js';
import { getMCP, MCPBridge } from '../tools/mcp-bridge.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ============================================================
// CAMPAIGN TEMPLATES & HELPERS
// ============================================================

/**
 * Google Ads resource name formats
 */
const resourceName = {
  customer: (customerId: string) => `customers/${customerId}`,
  campaignBudget: (customerId: string, budgetId: string) => 
    `customers/${customerId}/campaignBudgets/${budgetId}`,
  campaign: (customerId: string, campaignId: string) => 
    `customers/${customerId}/campaigns/${campaignId}`,
  adGroup: (customerId: string, adGroupId: string) => 
    `customers/${customerId}/adGroups/${adGroupId}`,
  adGroupCriterion: (customerId: string, adGroupId: string, criterionId: string) =>
    `customers/${customerId}/adGroupCriteria/${adGroupId}~${criterionId}`,
  adGroupAd: (customerId: string, adGroupId: string, adId: string) =>
    `customers/${customerId}/adGroupAds/${adGroupId}~${adId}`,
  geoTargetConstant: (id: string) => `geoTargetConstants/${id}`,
};

/**
 * Common geo target constants for Ohio
 * Supports both "Dublin" and "Dublin, Ohio" formats
 */
const OHIO_GEO_TARGETS: Record<string, string> = {
  // Full format (with state)
  'Dublin, Ohio': '1014895',
  'Powell, Ohio': '1015053', 
  'Galena, Ohio': '1014921',
  'New Albany, Ohio': '1015007',
  'Westerville, Ohio': '1015149',
  'Columbus, Ohio': '1014868',
  'Delaware, Ohio': '1014893',
  'Lewis Center, Ohio': '1014977',
  // Short format (without state)
  'Dublin': '1014895',
  'Powell': '1015053', 
  'Galena': '1014921',
  'New Albany': '1015007',
  'Westerville': '1015149',
  'Columbus': '1014868',
  'Delaware': '1014893',
  'Lewis Center': '1014977',
};

/**
 * Bidding strategy types
 */
const BIDDING_STRATEGIES = {
  MAXIMIZE_CONVERSIONS: 'MAXIMIZE_CONVERSIONS',
  MAXIMIZE_CLICKS: 'MAXIMIZE_CLICKS',
  TARGET_CPA: 'TARGET_CPA',
  TARGET_ROAS: 'TARGET_ROAS',
  MANUAL_CPC: 'MANUAL_CPC',
};

/**
 * Network settings
 */
const NETWORK_SETTINGS = {
  SEARCH_ONLY: {
    target_google_search: true,
    target_search_network: false,
    target_content_network: false,
  },
  SEARCH_AND_PARTNERS: {
    target_google_search: true,
    target_search_network: true,
    target_content_network: false,
  },
  SEARCH_AND_DISPLAY: {
    target_google_search: true,
    target_search_network: true,
    target_content_network: true,
  },
};

// ============================================================
// CAMPAIGN STRUCTURE TYPES
// ============================================================

export interface CampaignSpec {
  name: string;
  dailyBudget: number;
  biddingStrategy: keyof typeof BIDDING_STRATEGIES;
  targetCpa?: number;
  targetRoas?: number;
  networks: keyof typeof NETWORK_SETTINGS;
  locations: string[];
  adGroups: AdGroupSpec[];
}

export interface AdGroupSpec {
  name: string;
  keywords: KeywordSpec[];
  ads: AdSpec[];
}

export interface KeywordSpec {
  text: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
}

export interface AdSpec {
  headlines: string[]; // 3-15 headlines (max 30 chars each)
  descriptions: string[]; // 2-4 descriptions (max 90 chars each)
  finalUrl: string;
  path1?: string; // max 15 chars
  path2?: string; // max 15 chars
}

// ============================================================
// OPERATION BUILDERS
// ============================================================

/**
 * Build a campaign budget operation
 * 
 * NOTE: Per Opteo library/Google Ads API:
 * - amount_micros is a NUMBER (int64)
 * - delivery_method is a numeric enum (2 = STANDARD)
 */
function buildBudgetOperation(
  customerId: string,
  tempId: string,
  dailyBudgetDollars: number,
  name: string
): any {
  return {
    create: {
      resource_name: `customers/${customerId}/campaignBudgets/${tempId}`,
      name: `${name} Budget`,
      amount_micros: Math.round(dailyBudgetDollars * 1_000_000),
      delivery_method: 2, // STANDARD
    },
  };
}

/**
 * Build a campaign operation
 * 
 * NOTE: Per Google Ads API docs (January 2026):
 * - start_date and end_date are OPTIONAL
 * - manual_cpc should be { enhanced_cpc_enabled: false }
 * - target_cpa_micros is a NUMBER (int64)
 * - contains_eu_political_advertising is REQUIRED (enum value 3 = DOES_NOT_CONTAIN)
 */
function buildCampaignOperation(
  customerId: string,
  tempId: string,
  budgetTempId: string,
  spec: CampaignSpec
): any {
  const operation: any = {
    create: {
      resource_name: `customers/${customerId}/campaigns/${tempId}`,
      name: spec.name,
      status: 3, // PAUSED - Always create as PAUSED for safety
      advertising_channel_type: 2, // SEARCH
      campaign_budget: `customers/${customerId}/campaignBudgets/${budgetTempId}`,
      network_settings: NETWORK_SETTINGS[spec.networks],
      // REQUIRED: EU Political Advertising declaration (3 = DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING)
      contains_eu_political_advertising: 3,
    },
  };

  // Add bidding strategy (per Google's API examples)
  // NOTE: Bidding strategy objects CANNOT be empty - they need at least one field
  // or the API will reject them as "required field not present"
  switch (spec.biddingStrategy) {
    case 'MAXIMIZE_CONVERSIONS':
      if (spec.targetCpa) {
        operation.create.maximize_conversions = {
          target_cpa_micros: Math.round(spec.targetCpa * 1_000_000),
        };
      } else {
        operation.create.maximize_conversions = {
          cpc_bid_ceiling_micros: 0, // No ceiling
        };
      }
      break;
    case 'MAXIMIZE_CLICKS':
      // NOTE: "target_spend" is the correct API field for Maximize Clicks bidding strategy
      // "maximize_clicks" field doesn't work via MCP Bridge - use target_spend instead
      operation.create.target_spend = {};
      break;
    case 'TARGET_CPA':
      operation.create.target_cpa = {
        target_cpa_micros: Math.round((spec.targetCpa || 50) * 1_000_000),
      };
      break;
    case 'MANUAL_CPC':
      operation.create.manual_cpc = { enhanced_cpc_enabled: false };
      break;
  }

  return operation;
}

/**
 * Build an ad group operation
 * 
 * NOTE: Per Opteo library/Google Ads API:
 * - status is a numeric enum (2 = ENABLED)
 * - type is a numeric enum (2 = SEARCH_STANDARD)
 */
function buildAdGroupOperation(
  customerId: string,
  tempId: string,
  campaignTempId: string,
  name: string
): any {
  return {
    create: {
      resource_name: `customers/${customerId}/adGroups/${tempId}`,
      name,
      campaign: `customers/${customerId}/campaigns/${campaignTempId}`,
      status: 2, // ENABLED
      type: 2, // SEARCH_STANDARD
    },
  };
}

/**
 * Build a keyword operation
 * 
 * NOTE: Per Opteo library/Google Ads API:
 * - status is a numeric enum (2 = ENABLED)
 * - match_type is a numeric enum (2 = EXACT, 3 = PHRASE, 4 = BROAD)
 */
function buildKeywordOperation(
  customerId: string,
  tempId: string,
  adGroupTempId: string,
  keyword: KeywordSpec
): any {
  const matchTypeMap: Record<string, number> = {
    EXACT: 2,
    PHRASE: 3,
    BROAD: 4,
  };

  return {
    create: {
      resource_name: `customers/${customerId}/adGroupCriteria/${adGroupTempId}~${tempId}`,
      ad_group: `customers/${customerId}/adGroups/${adGroupTempId}`,
      status: 2, // ENABLED
      keyword: {
        text: keyword.text,
        match_type: matchTypeMap[keyword.matchType],
      },
    },
  };
}

/**
 * Build a responsive search ad operation
 * 
 * NOTE: Per Opteo library/Google Ads API:
 * - status is a numeric enum (2 = ENABLED)
 */
function buildAdOperation(
  customerId: string,
  tempId: string,
  adGroupTempId: string,
  ad: AdSpec
): any {
  return {
    create: {
      resource_name: `customers/${customerId}/adGroupAds/${adGroupTempId}~${tempId}`,
      ad_group: `customers/${customerId}/adGroups/${adGroupTempId}`,
      status: 2, // ENABLED
      ad: {
        responsive_search_ad: {
          headlines: ad.headlines.map(text => ({ text })),
          descriptions: ad.descriptions.map(text => ({ text })),
          path1: ad.path1,
          path2: ad.path2,
        },
        final_urls: [ad.finalUrl],
      },
    },
  };
}

/**
 * Build location targeting operation
 * 
 * NOTE: Per Google Ads API:
 * - Don't include resource_name for campaign_criterion
 * - type is a numeric enum (6 = LOCATION)
 * - location should be flat (not wrapped in criterion)
 */
function buildLocationTargetOperation(
  customerId: string,
  campaignTempId: string,
  geoTargetId: string
): any {
  return {
    create: {
      campaign: `customers/${customerId}/campaigns/${campaignTempId}`,
      type: 6, // LOCATION
      location: {
        geo_target_constant: `geoTargetConstants/${geoTargetId}`,
      },
      negative: false,
    },
  };
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

// ============================================================
// CAMPAIGN BUILDER AGENT
// ============================================================

const CAMPAIGN_BUILDER_SYSTEM_PROMPT = `You are an expert Google Ads campaign builder for a landscaping business.

When given a campaign request, you will:
1. Design the optimal campaign structure
2. Create keyword lists with appropriate match types
3. Write compelling ad copy that follows Google's guidelines
4. Set appropriate bidding strategies

## Guidelines for Landscaping Campaigns

### Keywords
- Include service + location variants (e.g., "landscape design Dublin Ohio")
- Use EXACT match for high-intent terms
- Use PHRASE match for service + modifier combinations
- Use BROAD match sparingly for discovery

### Ad Copy Rules (CRITICAL - CHARACTER LIMITS ARE STRICT!)
⚠️ IMPORTANT: These character limits are ENFORCED by Google and CANNOT be exceeded!
- Headlines: MAX 30 characters each (count carefully!), need 3-15
- Descriptions: MAX 90 characters each (count carefully!), need 2-4
- Path1: MAX 15 characters (e.g., "design" not "landscape-design")
- Path2: MAX 15 characters (e.g., "dublin" not "dublin-ohio")
- Include location in at least one headline
- Include call-to-action (Free Estimate, Call Now, etc.)
- Highlight differentiators (Licensed, Insured, etc.)
⚠️ If a headline is 31+ chars or description is 91+ chars, it WILL be rejected!

### Ad Policy Rules (NEVER VIOLATE)
- NEVER put phone numbers in headlines (use "Call Today" instead)
- NEVER use excessive punctuation (no !!! or ... or ???)
- NEVER use ALL CAPS words (except acronyms like LLC)
- NEVER include prices in ad copy unless they are exact and current
- NEVER make claims you can't prove (avoid "Best", "#1", "Award-Winning" without proof)
- Instead of "Call (614) 555-1234", use "Call Now" or "Call Today"

### Structure
- One theme per ad group (e.g., "Landscape Design", "Lawn Care")
- 10-20 keywords per ad group
- At least 2 responsive search ads per ad group

### Bidding
- New campaigns: Start with MAXIMIZE_CLICKS to gather data
- Established: MAXIMIZE_CONVERSIONS or TARGET_CPA
- Typical CPA for landscaping leads: $50-150

## Ohio Service Areas
Available for targeting: Dublin, Powell, Galena, New Albany, Westerville, Columbus, Delaware, Lewis Center

Output your campaign design as valid JSON matching the CampaignSpec interface.`;

export interface CampaignBuilderResult {
  spec: CampaignSpec;
  operations: any[];
  dryRunResult?: any;
  liveResult?: any;
  summary: string;
}

/**
 * Design a campaign from natural language description
 */
export async function designCampaign(
  description: string,
  businessInfo: {
    name: string;
    website: string;
    phone?: string;
    services?: string[];
  }
): Promise<CampaignSpec> {
  console.log('📐 Designing campaign structure...');

  const response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: 4096,
    system: CAMPAIGN_BUILDER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Design a Google Ads search campaign for:

Business: ${businessInfo.name}
Website: ${businessInfo.website}
${businessInfo.phone ? `Phone: ${businessInfo.phone}` : ''}
${businessInfo.services ? `Services: ${businessInfo.services.join(', ')}` : ''}

Campaign Request:
${description}

Return ONLY valid JSON matching this TypeScript interface:
\`\`\`typescript
interface CampaignSpec {
  name: string;
  dailyBudget: number;
  biddingStrategy: 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CLICKS' | 'TARGET_CPA' | 'MANUAL_CPC';
  targetCpa?: number;
  networks: 'SEARCH_ONLY' | 'SEARCH_AND_PARTNERS';
  locations: string[]; // Use city names from Ohio list
  adGroups: Array<{
    name: string;
    keywords: Array<{
      text: string;
      matchType: 'EXACT' | 'PHRASE' | 'BROAD';
    }>;
    ads: Array<{
      headlines: string[]; // 3-15 headlines, each MAX 30 chars
      descriptions: string[]; // 2-4 descriptions, each MAX 90 chars
      finalUrl: string;
      path1?: string;
      path2?: string;
    }>;
  }>;
}
\`\`\``,
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error('No response from campaign designer');
  }

  // Extract JSON from response
  const jsonMatch = textBlock.text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
    textBlock.text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('Could not extract campaign spec from response');
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  let spec: CampaignSpec = JSON.parse(jsonStr);

  // Sanitize the spec (fix common AI mistakes like too-long text)
  spec = sanitizeSpec(spec);

  // Validate the spec
  validateCampaignSpec(spec);

  return spec;
}

/**
 * Sanitize and fix common AI-generated issues
 */
function sanitizeSpec(spec: CampaignSpec): CampaignSpec {
  for (const adGroup of spec.adGroups) {
    for (const ad of adGroup.ads) {
      // Truncate headlines that are too long (max 30 chars)
      ad.headlines = ad.headlines.map(h => h.length > 30 ? h.slice(0, 30).trim() : h);
      
      // Truncate descriptions that are too long (max 90 chars)
      ad.descriptions = ad.descriptions.map(d => {
        if (d.length > 90) {
          // Try to truncate at a word boundary
          const truncated = d.slice(0, 87);
          const lastSpace = truncated.lastIndexOf(' ');
          return lastSpace > 60 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
        }
        return d;
      });

      // Truncate path1/path2 (max 15 chars)
      if (ad.path1 && ad.path1.length > 15) {
        ad.path1 = ad.path1.slice(0, 15).replace(/-$/, '');
      }
      if (ad.path2 && ad.path2.length > 15) {
        ad.path2 = ad.path2.slice(0, 15).replace(/-$/, '');
      }

      // Remove phone numbers from headlines (policy violation)
      ad.headlines = ad.headlines.map(h =>
        h.replace(/\(\d{3}\)\s?\d{3}[-.]?\d{4}|\d{3}[-.]?\d{3}[-.]?\d{4}/g, 'Call Today')
      );
    }
  }
  return spec;
}

/**
 * Validate campaign spec meets Google Ads requirements
 */
function validateCampaignSpec(spec: CampaignSpec): void {
  // Check budget
  if (spec.dailyBudget < 1) {
    throw new Error('Daily budget must be at least $1');
  }

  // Check ad groups
  if (spec.adGroups.length === 0) {
    throw new Error('Campaign must have at least one ad group');
  }

  for (const adGroup of spec.adGroups) {
    // Check keywords
    if (adGroup.keywords.length === 0) {
      throw new Error(`Ad group "${adGroup.name}" must have at least one keyword`);
    }

    // Check ads
    if (adGroup.ads.length === 0) {
      throw new Error(`Ad group "${adGroup.name}" must have at least one ad`);
    }

    for (const ad of adGroup.ads) {
      // Validate headlines
      if (ad.headlines.length < 3 || ad.headlines.length > 15) {
        throw new Error('Ads must have 3-15 headlines');
      }
      for (const headline of ad.headlines) {
        if (headline.length > 30) {
          throw new Error(`Headline too long (${headline.length} chars, max 30): "${headline}"`);
        }
        // Google Ads policy: No phone numbers in headlines
        if (/\(\d{3}\)\s?\d{3}[-.]?\d{4}|\d{3}[-.]?\d{3}[-.]?\d{4}/.test(headline)) {
          throw new Error(`Phone numbers not allowed in headlines: "${headline}"`);
        }
        // Google Ads policy: No excessive punctuation
        if (/[!]{2,}|[.]{3,}|[?]{2,}/.test(headline)) {
          throw new Error(`Excessive punctuation not allowed in headlines: "${headline}"`);
        }
      }

      // Validate descriptions
      if (ad.descriptions.length < 2 || ad.descriptions.length > 4) {
        throw new Error('Ads must have 2-4 descriptions');
      }
      for (const desc of ad.descriptions) {
        if (desc.length > 90) {
          throw new Error(`Description too long (${desc.length} chars, max 90): "${desc}"`);
        }
      }

      // Validate path1 and path2 (max 15 characters each)
      if (ad.path1 && ad.path1.length > 15) {
        throw new Error(`path1 too long (${ad.path1.length} chars, max 15): "${ad.path1}"`);
      }
      if (ad.path2 && ad.path2.length > 15) {
        throw new Error(`path2 too long (${ad.path2.length} chars, max 15): "${ad.path2}"`);
      }
    }
  }
}

/**
 * Build all operations for a campaign using Opteo format
 * 
 * The MCP expects operations in Opteo format:
 * { entity: "campaign_budget", operation: "create", resource: {...} }
 */
export function buildCampaignOperations(
  customerId: string,
  spec: CampaignSpec
): any[] {
  const operations: any[] = [];
  let tempIdCounter = -1;

  const getNextTempId = () => String(tempIdCounter--);

  // 1. Create budget
  const budgetTempId = getNextTempId();
  const budgetOp = buildBudgetOperation(customerId, budgetTempId, spec.dailyBudget, spec.name);
  operations.push({
    entity: 'campaign_budget',
    operation: 'create',
    resource: budgetOp.create,
  });

  // 2. Create campaign
  const campaignTempId = getNextTempId();
  const campaignOp = buildCampaignOperation(customerId, campaignTempId, budgetTempId, spec);
  operations.push({
    entity: 'campaign',
    operation: 'create',
    resource: campaignOp.create,
  });

  // 3. Create location targeting
  for (const location of spec.locations) {
    // Try exact match first, then try case-insensitive
    let geoTargetId = OHIO_GEO_TARGETS[location];
    if (!geoTargetId) {
      // Try to find a case-insensitive match
      const lowerLocation = location.toLowerCase();
      const matchingKey = Object.keys(OHIO_GEO_TARGETS).find(
        key => key.toLowerCase() === lowerLocation || 
               key.toLowerCase().startsWith(lowerLocation.split(',')[0].toLowerCase())
      );
      if (matchingKey) {
        geoTargetId = OHIO_GEO_TARGETS[matchingKey];
      }
    }
    
    if (geoTargetId) {
      const locationOp = buildLocationTargetOperation(
        customerId,
        campaignTempId,
        geoTargetId
      );
      operations.push({
        entity: 'campaign_criterion',
        operation: 'create',
        resource: locationOp.create,
      });
    } else {
      console.warn(`⚠️  Unknown location "${location}" - skipping location targeting`);
    }
  }

  // 4. Create ad groups, keywords, and ads
  for (const adGroupSpec of spec.adGroups) {
    const adGroupTempId = getNextTempId();
    
    // Ad group
    const adGroupOp = buildAdGroupOperation(
      customerId,
      adGroupTempId,
      campaignTempId,
      adGroupSpec.name
    );
    operations.push({
      entity: 'ad_group',
      operation: 'create',
      resource: adGroupOp.create,
    });

    // Keywords
    for (const keyword of adGroupSpec.keywords) {
      const keywordOp = buildKeywordOperation(
        customerId,
        getNextTempId(),
        adGroupTempId,
        keyword
      );
      operations.push({
        entity: 'ad_group_criterion',
        operation: 'create',
        resource: keywordOp.create,
      });
    }

    // Ads
    for (const ad of adGroupSpec.ads) {
      const adOp = buildAdOperation(
        customerId,
        getNextTempId(),
        adGroupTempId,
        ad
      );
      operations.push({
        entity: 'ad_group_ad',
        operation: 'create',
        resource: adOp.create,
      });
    }
  }

  return operations;
}

/**
 * Create a campaign (full workflow)
 */
export async function createCampaign(
  description: string,
  businessInfo: {
    name: string;
    website: string;
    phone?: string;
    services?: string[];
  },
  options: {
    customerId?: string;
    dryRun?: boolean;
    autoApprove?: boolean;
  } = {}
): Promise<CampaignBuilderResult> {
  const { customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID, dryRun = true } = options;

  console.log('\n🚀 CAMPAIGN BUILDER AGENT\n');
  console.log('━'.repeat(50));

  // Step 1: Design the campaign
  const spec = await designCampaign(description, businessInfo);
  
  // For dry runs, add a unique suffix to avoid name conflicts with previous tests
  if (dryRun) {
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits
    spec.name = `${spec.name} [TEST-${timestamp}]`;
  }
  
  console.log('\n📋 Campaign Design:');
  console.log(`   Name: ${spec.name}`);
  console.log(`   Budget: $${spec.dailyBudget}/day`);
  console.log(`   Bidding: ${spec.biddingStrategy}`);
  console.log(`   Locations: ${spec.locations.join(', ')}`);
  console.log(`   Ad Groups: ${spec.adGroups.length}`);
  
  let totalKeywords = 0;
  let totalAds = 0;
  for (const ag of spec.adGroups) {
    totalKeywords += ag.keywords.length;
    totalAds += ag.ads.length;
  }
  console.log(`   Keywords: ${totalKeywords}`);
  console.log(`   Ads: ${totalAds}`);

  // Step 2: Build operations
  console.log('\n🔧 Building operations...');
  const operations = buildCampaignOperations(customerId, spec);
  console.log(`   Generated ${operations.length} operations`);

  // Step 3: Execute via MCP
  const mcp = await getMCP();

  // Always do a dry run first
  console.log('\n🧪 Running dry run validation...');
  const dryRunResult = await mcp.mutate(operations, {
    customerId,
    dryRun: true,
    partialFailure: true, // Enable partial failure to see detailed errors
  });

  if (!dryRunResult.success) {
    console.log('❌ Dry run failed:', dryRunResult.error || dryRunResult);
    return {
      spec,
      operations,
      dryRunResult,
      summary: `Campaign validation failed: ${dryRunResult.error || 'Unknown error'}`,
    };
  }

  console.log('✅ Dry run passed!');

  // Step 4: Execute for real if not dry run mode
  let liveResult;
  if (!dryRun) {
    console.log('\n⚡ Executing campaign creation...');
    liveResult = await mcp.mutate(operations, {
      customerId,
      dryRun: false,
      partialFailure: false,
    });

    if (liveResult.success) {
      console.log('✅ Campaign created successfully!');
    } else {
      console.log('❌ Campaign creation failed:', liveResult.error);
    }
  } else {
    console.log('\n⚠️  DRY RUN MODE - Campaign was NOT created');
    console.log('   Set dryRun: false to create the campaign');
  }

  // Build summary
  const summary = dryRun
    ? `Campaign "${spec.name}" validated successfully. Ready to create with ${spec.adGroups.length} ad groups, ${totalKeywords} keywords, and ${totalAds} ads. Set dryRun: false to create.`
    : liveResult?.success
    ? `Campaign "${spec.name}" created successfully! It's currently PAUSED - enable it when ready to start spending.`
    : `Campaign creation failed: ${liveResult?.error || 'Unknown error'}`;

  return {
    spec,
    operations,
    dryRunResult,
    liveResult,
    summary,
  };
}

// Export for use as sub-agent tool
export const campaignBuilderTool = {
  name: 'create_campaign',
  description: `Create a complete Google Ads search campaign from a natural language description.
    
This tool will:
1. Design campaign structure (ad groups, keywords, ads)
2. Generate all required Google Ads API operations
3. Validate via dry run
4. Optionally create the campaign (if dryRun: false)

The campaign is created in PAUSED state for safety.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      description: {
        type: 'string',
        description: 'Natural language description of the campaign you want to create',
      },
      business_name: {
        type: 'string',
        description: 'Business name',
      },
      website: {
        type: 'string',
        description: 'Business website URL',
      },
      services: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of services offered',
      },
      dry_run: {
        type: 'boolean',
        description: 'If true (default), validates but does not create. Set to false to actually create.',
        default: true,
      },
    },
    required: ['description', 'business_name', 'website'],
  },
  handler: async (args: {
    description: string;
    business_name: string;
    website: string;
    services?: string[];
    dry_run?: boolean;
  }) => {
    return createCampaign(
      args.description,
      {
        name: args.business_name,
        website: args.website,
        services: args.services,
      },
      { dryRun: args.dry_run ?? true }
    );
  },
};
