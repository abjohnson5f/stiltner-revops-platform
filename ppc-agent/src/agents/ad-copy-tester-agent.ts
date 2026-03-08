/**
 * Ad Copy Tester Sub-Agent
 * 
 * Generates A/B test variations of ad copy and tracks performance.
 * Uses AI to create compelling, policy-compliant ad variations.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/index.js';
import { toolDefinitions as googleAdsTools, toolHandlers as googleAdsHandlers } from '../tools/google-ads.js';
import { getMCP, shutdownMCP } from '../tools/mcp-bridge.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const AD_COPY_TESTER_SYSTEM_PROMPT = `You are an Ad Copy Testing specialist for Google Ads. Your job is to:

1. **Analyze Current Ads**: Review existing ad performance (CTR, conversion rate)
2. **Generate Variations**: Create compelling A/B test variations
3. **Ensure Compliance**: All ads must follow Google's strict policies
4. **Target Emotions**: Appeal to homeowner desires (pride, convenience, value)
5. **Include CTAs**: Clear calls-to-action in every ad

## Character Limits (STRICT)
- Headlines: MAX 30 characters each (3-15 per ad)
- Descriptions: MAX 90 characters each (2-4 per ad)
- Display Paths: MAX 15 characters each

## Policy Rules
- NO phone numbers in ad text
- NO excessive punctuation (!!!, $$$)
- NO misleading claims
- NO all caps (except abbreviations)

## Landscaping Ad Best Practices
- Highlight local service (Central Ohio, Dublin, Powell)
- Mention credentials (Licensed, Insured, Award-Winning)
- Include urgency for seasonal services
- Emphasize value propositions (Free Estimates, Quality Work)
- Use emotional triggers (Beautiful Yard, Dream Landscape)

## Test Hypotheses to Try
1. Price-focused vs Quality-focused
2. Urgency ("Limited Spots") vs Trust ("20+ Years")
3. Benefit-focused vs Feature-focused
4. Question headlines vs Statement headlines

Output variations in JSON format matching the ad spec requirements.`;

export interface AdVariation {
  headlines: string[];
  descriptions: string[];
  path1: string;
  path2: string;
  hypothesis: string;
  expectedImpact: string;
}

export interface AdTestResult {
  summary: string;
  currentAdPerformance: Array<{
    adGroupName: string;
    headlines: string[];
    ctr: number;
    conversions: number;
  }>;
  variations: AdVariation[];
  testRecommendations: string[];
  implementationOrder: string[];
}

export async function runAdCopyTester(adGroupId?: string): Promise<AdTestResult> {
  console.log('📝 Starting Ad Copy Tester Agent...');

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Analyze our current ad copy and generate A/B test variations.

${adGroupId ? `Focus on ad group ID: ${adGroupId}` : 'Analyze all ad groups'}

Steps:
1. Get current ad performance data
2. Identify top and bottom performing ads
3. Analyze what makes top performers work
4. Generate 3-5 test variations for underperforming ads
5. Provide testing recommendations

Business Context:
- Stiltner Landscapes in Central Ohio
- Services: Landscape Design, Hardscaping, Lawn Care, Outdoor Living
- Target: Homeowners in Dublin, Powell, Galena, New Albany
- USPs: Award-winning designs, 20+ years experience, free estimates

Generate ads that would appeal to affluent homeowners wanting beautiful outdoor spaces.`,
    },
  ];

  let response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: env.AGENT_MAX_TOKENS,
    system: AD_COPY_TESTER_SYSTEM_PROMPT,
    tools: googleAdsTools,
    messages,
  });

  // Process tool calls
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    const toolResults: Anthropic.MessageParam = {
      role: 'user',
      content: await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          console.log(`  🔧 Calling tool: ${toolUse.name}`);
          try {
            const handler = googleAdsHandlers[toolUse.name];
            if (!handler) {
              throw new Error(`Unknown tool: ${toolUse.name}`);
            }
            const result = await handler(toolUse.input as any);
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify(result, null, 2),
            };
          } catch (error) {
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              is_error: true,
            };
          }
        })
      ),
    };

    messages.push({ role: 'assistant', content: response.content });
    messages.push(toolResults);

    response = await client.messages.create({
      model: env.AGENT_MODEL,
      max_tokens: env.AGENT_MAX_TOKENS,
      system: AD_COPY_TESTER_SYSTEM_PROMPT,
      tools: googleAdsTools,
      messages,
    });
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  console.log('✅ Ad copy analysis complete');

  return {
    summary: textBlock?.text || 'Ad copy analysis completed',
    currentAdPerformance: [],
    variations: [],
    testRecommendations: [],
    implementationOrder: [],
  };
}

/**
 * Create new ad variation via MCP
 */
export async function createAdVariation(
  adGroupId: string,
  variation: AdVariation,
  dryRun: boolean = true
): Promise<{ success: boolean; result: any }> {
  console.log(`${dryRun ? '🧪 DRY RUN:' : '🚀 LIVE:'} Creating ad variation...`);

  const mcp = await getMCP();
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;

  try {
    const tempId = `-${Date.now()}`;
    
    const operation = {
      entity: 'ad_group_ad',
      operation: 'create',
      resource: {
        ad_group: `customers/${customerId}/adGroups/${adGroupId}`,
        status: 2, // ENABLED
        ad: {
          responsive_search_ad: {
            headlines: variation.headlines.map(text => ({ text })),
            descriptions: variation.descriptions.map(text => ({ text })),
            path1: variation.path1,
            path2: variation.path2,
          },
          final_urls: ['https://stiltnerlandscapes.com'],
        },
      },
    };

    const result = await mcp.mutate([operation], {
      customerId,
      dryRun,
      partialFailure: false,
    });

    return {
      success: result.success,
      result: result.data?.[0] || result,
    };
  } finally {
    await shutdownMCP();
  }
}

/**
 * Generate ad variations without API calls (pure AI generation)
 */
export async function generateAdVariations(
  service: string,
  location: string,
  count: number = 3
): Promise<AdVariation[]> {
  console.log(`🎨 Generating ${count} ad variations for "${service}" in ${location}...`);

  const response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: 4096,
    system: AD_COPY_TESTER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate ${count} unique ad variations for:

Service: ${service}
Location: ${location}
Business: Stiltner Landscapes

Each variation should test a different hypothesis:
1. Price/Value focused
2. Quality/Trust focused
3. Urgency/Seasonal focused

Return ONLY valid JSON array of variations:
[
  {
    "headlines": ["30 char max headline 1", "headline 2", ...], // 5-8 headlines
    "descriptions": ["90 char max description 1", "description 2"], // 2-3 descriptions
    "path1": "15charmax",
    "path2": "15charmax",
    "hypothesis": "What this tests",
    "expectedImpact": "Expected improvement"
  }
]`,
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error('No response from ad generator');
  }

  // Extract JSON from response
  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Could not extract variations from response');
  }

  const variations: AdVariation[] = JSON.parse(jsonMatch[0]);

  // Validate and sanitize
  for (const v of variations) {
    v.headlines = v.headlines.map(h => h.substring(0, 30));
    v.descriptions = v.descriptions.map(d => d.substring(0, 90));
    v.path1 = v.path1?.substring(0, 15) || '';
    v.path2 = v.path2?.substring(0, 15) || '';
  }

  return variations;
}

// Tool definition for orchestrator
export const adCopyTesterTool = {
  name: 'test_ad_copy',
  description: 'Analyze current ad performance and generate A/B test variations',
  input_schema: {
    type: 'object' as const,
    properties: {
      ad_group_id: {
        type: 'string',
        description: 'Specific ad group to analyze (optional)',
      },
      generate_only: {
        type: 'boolean',
        description: 'If true, only generate variations without analyzing existing ads',
        default: false,
      },
      service: {
        type: 'string',
        description: 'Service to generate ads for (if generate_only)',
      },
      location: {
        type: 'string',
        description: 'Location to target (if generate_only)',
        default: 'Dublin Ohio',
      },
    },
    required: [],
  },
  handler: async ({ 
    ad_group_id, 
    generate_only = false, 
    service, 
    location = 'Dublin Ohio' 
  }: { 
    ad_group_id?: string; 
    generate_only?: boolean; 
    service?: string; 
    location?: string;
  }) => {
    if (generate_only && service) {
      return {
        variations: await generateAdVariations(service, location, 3),
        message: 'Generated ad variations. Review and use create_campaign to implement.',
      };
    }
    
    return await runAdCopyTester(ad_group_id);
  },
};
