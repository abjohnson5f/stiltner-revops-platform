/**
 * Meta Ads Agent
 *
 * Creates and manages Facebook/Instagram ad campaigns using AI.
 * Leverages marketing skills for creative strategy and copy generation.
 *
 * Capabilities:
 * - Create campaigns from natural language descriptions
 * - Generate ad creative (images via Glif, copy via skills)
 * - Validate against Meta ad policies
 * - Create A/B test variations
 * - Pull and analyze performance metrics
 */

import Anthropic from '@anthropic-ai/sdk';
import { env, BUSINESS_CONTEXT, META_CONFIG } from '../config/index.js';
import { getSkill, getSkillsSummary } from '../skills/index.js';
import {
  createCampaign,
  createAdSet,
  createCreative,
  createAd,
  uploadImage,
  listCampaigns,
  getCampaignInsights,
  getAccountInsights,
  updateCampaignStatus,
  createQuickCampaign,
  type CreateCampaignInput,
  type TargetingSpec,
} from '../tools/meta-ads.js';
import { sendTextNotification } from '../tools/google-chat.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ============================================================
// TYPES
// ============================================================

export interface MetaCampaignPlan {
  name: string;
  objective: CreateCampaignInput['objective'];
  dailyBudget: number;
  targeting: {
    locations: string[];
    ageRange: { min: number; max: number };
    interests?: string[];
  };
  adSets: Array<{
    name: string;
    targeting: TargetingSpec;
    budget?: number;
  }>;
  creatives: Array<{
    name: string;
    headline: string;
    primaryText: string;
    description?: string;
    callToAction: 'LEARN_MORE' | 'GET_QUOTE' | 'CONTACT_US' | 'BOOK_NOW';
    imagePrompt: string;
  }>;
}

export interface MetaCampaignResult {
  success: boolean;
  plan?: MetaCampaignPlan;
  campaignId?: string;
  adSetIds?: string[];
  adIds?: string[];
  error?: string;
  dryRun?: boolean;
}

// ============================================================
// CAMPAIGN PLANNING
// ============================================================

/**
 * Generate a Meta campaign plan from a natural language description
 */
export async function planMetaCampaign(
  description: string,
  options?: {
    objective?: CreateCampaignInput['objective'];
    budget?: number;
    locations?: string[];
  }
): Promise<MetaCampaignPlan> {
  // Load relevant skills
  const positioningSkill = getSkill('positioning-angles');
  const copySkill = getSkill('direct-response-copy');
  const creativeSkill = getSkill('ai-creative-strategist');

  const systemPrompt = `You are a Meta Ads campaign strategist for ${BUSINESS_CONTEXT.name}, a premium landscaping company.

## Positioning Framework
${positioningSkill?.content || 'Focus on quality, expertise, and local service.'}

## Creative Strategy
${creativeSkill?.content || 'Create visually compelling ads that showcase transformations.'}

## Copy Framework
${copySkill?.content || 'Use direct response principles with clear CTAs.'}

## Business Context
- Services: ${BUSINESS_CONTEXT.services.join(', ')}
- Locations: ${BUSINESS_CONTEXT.locations.join(', ')}, ${BUSINESS_CONTEXT.state}
- Website: ${BUSINESS_CONTEXT.website}
- Phone: ${BUSINESS_CONTEXT.phone}

## Meta Ads Best Practices
- Keep primary text under 125 characters for feed
- Headlines max 40 characters
- Link descriptions max 30 characters
- Square (1:1) or vertical (4:5) images perform best
- Clear CTA matching the objective
- A/B test at least 2-3 creative variations

## Output Requirements
Generate a campaign plan as JSON with:
1. name: Campaign name
2. objective: One of OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_AWARENESS
3. dailyBudget: In dollars
4. targeting: locations, ageRange, interests
5. adSets: 1-3 ad sets with different targeting angles
6. creatives: 3-5 ad creative variations with:
   - name, headline, primaryText, description
   - callToAction: LEARN_MORE, GET_QUOTE, CONTACT_US, or BOOK_NOW
   - imagePrompt: Detailed prompt for AI image generation`;

  const userPrompt = `Create a Meta Ads campaign plan:

${description}

${options?.objective ? `Objective: ${options.objective}` : ''}
${options?.budget ? `Budget: $${options.budget}/day` : ''}
${options?.locations ? `Locations: ${options.locations.join(', ')}` : ''}

Output as JSON only.`;

  const response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error('No response from AI');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse campaign plan JSON');
  }

  return JSON.parse(jsonMatch[0]) as MetaCampaignPlan;
}

// ============================================================
// AD COPY GENERATION
// ============================================================

/**
 * Generate ad copy variations using marketing skills
 */
export async function generateAdCopyVariations(
  service: string,
  options?: {
    variations?: number;
    angle?: string;
    season?: string;
  }
): Promise<
  Array<{
    headline: string;
    primaryText: string;
    description: string;
    angle: string;
  }>
> {
  const copySkill = getSkill('direct-response-copy');
  const brandVoiceSkill = getSkill('brand-voice');

  const systemPrompt = `You are a direct response copywriter for ${BUSINESS_CONTEXT.name}.

## Brand Voice
${brandVoiceSkill?.content || 'Professional, friendly, knowledgeable.'}

## Copy Framework
${copySkill?.content || 'Use PAS formula and strong CTAs.'}

## Meta Ad Copy Rules
- Headlines: Max 40 characters, hook-driven
- Primary text: Under 125 characters for feed display
- Description: Max 30 characters
- Clear value proposition
- Urgency without being pushy

## Output Format
Generate ${options?.variations || 3} variations as JSON array.
Each variation should test a different angle:
- Pain point focus
- Benefit focus
- Social proof
- Urgency/scarcity
- Transformation promise`;

  const response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Generate ad copy variations for: ${service}
${options?.angle ? `Focus angle: ${options.angle}` : ''}
${options?.season ? `Season: ${options.season}` : ''}

Output as JSON array only.`,
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error('No response from AI');
  }

  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse ad copy JSON');
  }

  return JSON.parse(jsonMatch[0]);
}

// ============================================================
// IMAGE PROMPT GENERATION
// ============================================================

/**
 * Generate image prompts for ad creative
 */
export async function generateImagePrompts(
  service: string,
  style: 'photorealistic' | 'graphic' | 'before-after' = 'photorealistic'
): Promise<string[]> {
  const imageSkill = getSkill('ai-image-generation');
  const creativeSkill = getSkill('ai-creative-strategist');

  const systemPrompt = `You are an AI creative director for ${BUSINESS_CONTEXT.name}.

## Image Generation Guidelines
${imageSkill?.content || 'Create realistic, aspirational landscape imagery.'}

## Creative Strategy
${creativeSkill?.content || 'Focus on transformations and beautiful results.'}

## Meta Ad Image Best Practices
- High contrast, vibrant colors
- Clear focal point
- Minimal or no text in image (Meta penalizes >20% text)
- Show real results/transformations
- Include people when appropriate (relatability)
- Outdoor lighting, sunny/golden hour preferred
- Ohio-appropriate landscaping styles

## Style: ${style}
${style === 'before-after' ? 'Create prompts for side-by-side comparison images.' : ''}
${style === 'photorealistic' ? 'Photorealistic style, could be mistaken for a real photo.' : ''}
${style === 'graphic' ? 'Clean graphic design with brand colors and simple messaging.' : ''}

Generate 3 detailed image prompts optimized for AI image generation (Flux/SDXL).`;

  const response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Generate image prompts for: ${service} in Central Ohio

Output as JSON array of strings only.`,
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error('No response from AI');
  }

  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse image prompts JSON');
  }

  return JSON.parse(jsonMatch[0]);
}

// ============================================================
// CAMPAIGN EXECUTION
// ============================================================

/**
 * Execute a campaign plan (create in Meta)
 */
export async function executeMetaCampaignPlan(
  plan: MetaCampaignPlan,
  options?: {
    dryRun?: boolean;
    generateImages?: boolean;
    imageUrls?: string[];
  }
): Promise<MetaCampaignResult> {
  if (!META_CONFIG.isConfigured) {
    return {
      success: false,
      plan,
      error: 'Meta Marketing API not configured',
      dryRun: true,
    };
  }

  if (options?.dryRun) {
    return {
      success: true,
      plan,
      dryRun: true,
    };
  }

  try {
    // 1. Create campaign
    const campaign = await createCampaign({
      name: plan.name,
      objective: plan.objective,
      status: 'PAUSED',
    });

    const adSetIds: string[] = [];
    const adIds: string[] = [];

    // 2. Create ad sets
    for (const adSetPlan of plan.adSets) {
      const adSet = await createAdSet({
        name: adSetPlan.name,
        campaign_id: campaign.id,
        daily_budget: (adSetPlan.budget || plan.dailyBudget / plan.adSets.length) * 100,
        billing_event: 'IMPRESSIONS',
        optimization_goal: plan.objective === 'OUTCOME_LEADS' ? 'LEAD_GENERATION' : 'LINK_CLICKS',
        targeting: adSetPlan.targeting,
        status: 'PAUSED',
      });
      adSetIds.push(adSet.id);
    }

    // 3. Upload images and create ads
    const imageUrls = options?.imageUrls || [];
    
    for (let i = 0; i < plan.creatives.length; i++) {
      const creative = plan.creatives[i];
      const adSetId = adSetIds[i % adSetIds.length]; // Distribute across ad sets
      
      // Upload image if available
      let imageHash: string | undefined;
      if (imageUrls[i]) {
        const imageResult = await uploadImage(imageUrls[i]);
        imageHash = imageResult.hash;
      }

      // Create creative
      const adCreative = await createCreative({
        name: creative.name,
        object_story_spec: {
          page_id: META_CONFIG.pageId!,
          link_data: {
            link: BUSINESS_CONTEXT.website,
            message: creative.primaryText,
            name: creative.headline,
            description: creative.description,
            ...(imageHash && { image_hash: imageHash }),
            call_to_action: {
              type: creative.callToAction,
              value: { link: BUSINESS_CONTEXT.website },
            },
          },
        },
      });

      // Create ad
      const ad = await createAd({
        name: `${creative.name} - Ad`,
        adset_id: adSetId,
        creative_id: adCreative.id,
        status: 'PAUSED',
      });
      adIds.push(ad.id);
    }

    return {
      success: true,
      plan,
      campaignId: campaign.id,
      adSetIds,
      adIds,
      dryRun: false,
    };
  } catch (error) {
    return {
      success: false,
      plan,
      error: error instanceof Error ? error.message : 'Unknown error',
      dryRun: false,
    };
  }
}

// ============================================================
// CAMPAIGN ANALYSIS
// ============================================================

/**
 * Analyze Meta campaign performance
 */
export async function analyzeMetaCampaigns(dateRange?: {
  since: string;
  until: string;
}): Promise<{
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    leads?: number;
    cpl?: number;
  }>;
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    avgCpc: number;
    leads: number;
    cpl: number;
  };
  recommendations: string[];
}> {
  const campaigns = await listCampaigns({ status: 'ACTIVE' });
  const results: Array<{
    id: string;
    name: string;
    status: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    leads?: number;
    cpl?: number;
  }> = [];

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalLeads = 0;

  for (const campaign of campaigns) {
    const insights = await getCampaignInsights(campaign.id, dateRange);
    
    if (insights.length > 0) {
      const insight = insights[0];
      const spend = parseFloat(insight.spend) || 0;
      const impressions = parseInt(insight.impressions) || 0;
      const clicks = parseInt(insight.clicks) || 0;
      const ctr = parseFloat(insight.ctr) || 0;
      const cpc = parseFloat(insight.cpc) || 0;
      
      // Extract leads from actions
      const leadAction = insight.actions?.find(
        (a) => a.action_type === 'lead' || a.action_type === 'omni_view_content'
      );
      const leads = leadAction ? parseInt(leadAction.value) : 0;

      totalSpend += spend;
      totalImpressions += impressions;
      totalClicks += clicks;
      totalLeads += leads;

      results.push({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        spend,
        impressions,
        clicks,
        ctr,
        cpc,
        leads,
        cpl: leads > 0 ? spend / leads : undefined,
      });
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  for (const campaign of results) {
    if (campaign.ctr < 1.0) {
      recommendations.push(
        `${campaign.name}: Low CTR (${campaign.ctr.toFixed(2)}%) - consider refreshing creative`
      );
    }
    if (campaign.cpc > 5.0) {
      recommendations.push(
        `${campaign.name}: High CPC ($${campaign.cpc.toFixed(2)}) - review targeting`
      );
    }
    if (campaign.cpl && campaign.cpl > 50) {
      recommendations.push(
        `${campaign.name}: High CPL ($${campaign.cpl.toFixed(2)}) - optimize landing page`
      );
    }
  }

  return {
    campaigns: results,
    totals: {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalClicks > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      leads: totalLeads,
      cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
    },
    recommendations,
  };
}

// ============================================================
// MAIN AGENT RUNNER
// ============================================================

export interface MetaAdsAgentResult {
  action: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Run a Meta Ads workflow
 */
export async function runMetaAdsWorkflow(
  workflow: 'create' | 'analyze' | 'copy' | 'images',
  args: {
    description?: string;
    service?: string;
    objective?: CreateCampaignInput['objective'];
    budget?: number;
    locations?: string[];
    dryRun?: boolean;
    notify?: boolean;
    dateRange?: { since: string; until: string };
  }
): Promise<MetaAdsAgentResult> {
  try {
    switch (workflow) {
      case 'create': {
        if (!args.description) {
          return { action: 'create', success: false, error: 'Description required' };
        }

        const plan = await planMetaCampaign(args.description, {
          objective: args.objective,
          budget: args.budget,
          locations: args.locations,
        });

        const result = await executeMetaCampaignPlan(plan, {
          dryRun: args.dryRun !== false,
        });

        if (args.notify && result.success) {
          await sendTextNotification(
            `📱 Meta Campaign ${result.dryRun ? 'Planned' : 'Created'}: "${plan.name}"\n` +
              `Objective: ${plan.objective}\n` +
              `Budget: $${plan.dailyBudget}/day\n` +
              `Ad Sets: ${plan.adSets.length}\n` +
              `Creatives: ${plan.creatives.length}` +
              (result.campaignId ? `\nCampaign ID: ${result.campaignId}` : '')
          );
        }

        return { action: 'create', success: result.success, data: result };
      }

      case 'analyze': {
        const analysis = await analyzeMetaCampaigns(args.dateRange);

        if (args.notify) {
          await sendTextNotification(
            `📊 Meta Ads Report\n` +
              `Campaigns: ${analysis.campaigns.length}\n` +
              `Total Spend: $${analysis.totals.spend.toFixed(2)}\n` +
              `Total Leads: ${analysis.totals.leads}\n` +
              `Avg CPL: $${analysis.totals.cpl.toFixed(2)}\n` +
              `Recommendations: ${analysis.recommendations.length}`
          );
        }

        return { action: 'analyze', success: true, data: analysis };
      }

      case 'copy': {
        if (!args.service) {
          return { action: 'copy', success: false, error: 'Service required' };
        }

        const variations = await generateAdCopyVariations(args.service);
        return { action: 'copy', success: true, data: variations };
      }

      case 'images': {
        if (!args.service) {
          return { action: 'images', success: false, error: 'Service required' };
        }

        const prompts = await generateImagePrompts(args.service);
        return { action: 'images', success: true, data: prompts };
      }

      default:
        return { action: workflow, success: false, error: `Unknown workflow: ${workflow}` };
    }
  } catch (error) {
    return {
      action: workflow,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// TOOL DEFINITION FOR ORCHESTRATOR
// ============================================================

export const metaAdsAgentTool = {
  name: 'run_meta_ads_workflow',
  description:
    'Run Meta (Facebook/Instagram) Ads workflows: create (plan/create campaign), analyze (performance report), copy (generate ad copy), images (generate image prompts)',
  input_schema: {
    type: 'object' as const,
    properties: {
      workflow: {
        type: 'string',
        enum: ['create', 'analyze', 'copy', 'images'],
        description: 'Workflow to run',
      },
      description: {
        type: 'string',
        description: 'Campaign description (for create workflow)',
      },
      service: {
        type: 'string',
        description: 'Service to focus on (for copy/images workflows)',
      },
      objective: {
        type: 'string',
        enum: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC', 'OUTCOME_AWARENESS'],
        description: 'Campaign objective',
      },
      budget: {
        type: 'number',
        description: 'Daily budget in dollars',
      },
      locations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Target locations',
      },
      dry_run: {
        type: 'boolean',
        default: true,
        description: 'Plan only, do not create (default: true)',
      },
      notify: {
        type: 'boolean',
        default: true,
        description: 'Send G-Chat notification',
      },
    },
    required: ['workflow'],
  },
  handler: async (args: {
    workflow: 'create' | 'analyze' | 'copy' | 'images';
    description?: string;
    service?: string;
    objective?: CreateCampaignInput['objective'];
    budget?: number;
    locations?: string[];
    dry_run?: boolean;
    notify?: boolean;
  }) =>
    runMetaAdsWorkflow(args.workflow, {
      description: args.description,
      service: args.service,
      objective: args.objective,
      budget: args.budget,
      locations: args.locations,
      dryRun: args.dry_run,
      notify: args.notify,
    }),
};

// ============================================================
// STANDALONE EXECUTION
// ============================================================

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const workflow = (process.argv[2] || 'analyze') as 'create' | 'analyze' | 'copy' | 'images';
  const arg = process.argv[3];

  console.log(`\n📱 Running Meta Ads Agent: ${workflow}\n`);

  const args: Parameters<typeof runMetaAdsWorkflow>[1] = {
    notify: false,
    dryRun: true,
  };

  if (workflow === 'create' && arg) {
    args.description = arg;
  } else if ((workflow === 'copy' || workflow === 'images') && arg) {
    args.service = arg;
  }

  runMetaAdsWorkflow(workflow, args)
    .then((result) => {
      console.log('\n✅ Result:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(console.error);
}
