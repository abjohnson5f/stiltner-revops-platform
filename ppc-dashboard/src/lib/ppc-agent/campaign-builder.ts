import Anthropic from '@anthropic-ai/sdk';
import type { CampaignPlan, CampaignCreateParams, ValidationResult } from './types';

/**
 * Create a Google Ads campaign from natural language description
 */
export async function createCampaign(params: CampaignCreateParams): Promise<{
  plan: CampaignPlan;
  created: boolean;
  campaignId?: string;
  error?: string;
}> {
  const { description, businessInfo, dryRun = true } = params;

  try {
    const plan = await generateCampaignPlan(description, businessInfo);
    const validation = await validateCampaign(plan);
    
    if (!validation.valid) {
      return { plan, created: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    // For now, always return dry run result
    // Full MCP integration will enable actual creation
    return { plan, created: false };
  } catch (error) {
    console.error('Campaign creation error:', error);
    throw error;
  }
}

async function generateCampaignPlan(
  description: string,
  businessInfo?: CampaignCreateParams['businessInfo']
): Promise<CampaignPlan> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return getDefaultCampaignPlan(description);
  }

  const anthropic = new Anthropic();
  const prompt = `You are an expert Google Ads campaign strategist for a landscaping company in Central Ohio.

Business Info:
- Name: ${businessInfo?.name || 'Stiltner Landscapes'}
- Services: ${businessInfo?.services?.join(', ') || 'Landscape Design, Hardscaping, Lawn Care'}
- Locations: ${businessInfo?.locations?.join(', ') || 'Dublin, Powell, Galena, New Albany, OH'}

User Request: "${description}"

Create a campaign plan in this JSON format:
{
  "name": "<campaign_name>",
  "budget": <daily_budget_usd>,
  "targetLocations": ["<city>, OH"],
  "keywords": [{"name": "<group>", "keywords": [{"text": "<kw>", "matchType": "PHRASE"}]}],
  "adGroups": [{"name": "<name>", "keywords": {"name": "<group>", "keywords": [{"text": "<kw>", "matchType": "PHRASE"}]}, "ads": [{"headlines": ["<30 chars max>"], "descriptions": ["<90 chars max>"], "finalUrl": "https://stiltnerlandscapes.com"}]}],
  "negativeKeywords": ["diy", "free", "cheap", "jobs"]
}

Return ONLY valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');
    return JSON.parse(content.text) as CampaignPlan;
  } catch (error) {
    return getDefaultCampaignPlan(description);
  }
}

function getDefaultCampaignPlan(description: string): CampaignPlan {
  return {
    name: `${description.slice(0, 30)} Campaign`,
    budget: 50,
    targetLocations: ['Dublin, OH', 'Powell, OH', 'Galena, OH'],
    keywords: [{
      name: 'Main Keywords',
      keywords: [
        { text: 'landscaping services', matchType: 'PHRASE' },
        { text: 'landscaping near me', matchType: 'PHRASE' },
      ],
    }],
    adGroups: [{
      name: 'General Services',
      keywords: { name: 'Main Keywords', keywords: [{ text: 'landscaping services', matchType: 'PHRASE' }] },
      ads: [{
        headlines: ['Expert Landscaping', 'Free Estimates', 'Serving Dublin'],
        descriptions: ['Transform your outdoor space. Call for a free estimate today!'],
        finalUrl: 'https://stiltnerlandscapes.com',
      }],
    }],
    negativeKeywords: ['diy', 'free', 'cheap', 'jobs', 'salary'],
  };
}

export async function validateCampaign(plan: CampaignPlan): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan.name || plan.name.length < 3) errors.push('Campaign name must be at least 3 characters');
  if (plan.budget < 10) errors.push('Daily budget must be at least $10');
  if (plan.budget > 500) warnings.push('Daily budget is high ($500+)');
  if (!plan.targetLocations?.length) errors.push('At least one target location required');
  if (!plan.keywords?.length) errors.push('At least one keyword group required');
  if (!plan.adGroups?.length) errors.push('At least one ad group required');

  for (const adGroup of plan.adGroups || []) {
    if (!adGroup.name) errors.push('All ad groups must have a name');
    for (const ad of adGroup.ads || []) {
      if (!ad.headlines || ad.headlines.length < 3) errors.push(`Ad group "${adGroup.name}" needs at least 3 headlines`);
      for (const h of ad.headlines || []) {
        if (h.length > 30) errors.push(`Headline "${h.slice(0, 20)}..." exceeds 30 chars`);
      }
      if (!ad.descriptions || ad.descriptions.length < 2) errors.push(`Ad group "${adGroup.name}" needs at least 2 descriptions`);
      for (const d of ad.descriptions || []) {
        if (d.length > 90) errors.push(`Description exceeds 90 chars`);
      }
      if (!ad.finalUrl?.startsWith('http')) errors.push('All ads must have a valid URL');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
