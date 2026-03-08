/**
 * Negative Keyword Sub-Agent
 * 
 * Analyzes search terms to identify and add negative keywords,
 * preventing wasted spend on irrelevant searches.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/index.js';
import { toolDefinitions as googleAdsTools, toolHandlers as googleAdsHandlers } from '../tools/google-ads.js';
import { getMCP, shutdownMCP } from '../tools/mcp-bridge.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const NEGATIVE_KEYWORD_SYSTEM_PROMPT = `You are a Negative Keyword specialist for Google Ads. Your job is to:

1. **Analyze Search Terms**: Review search terms that triggered ads
2. **Identify Waste**: Find irrelevant searches wasting money
3. **Categorize Negatives**: Group by theme (competitors, DIY, wrong location, etc.)
4. **Recommend Match Types**: Choose appropriate negative match types
5. **Estimate Savings**: Calculate expected cost reduction

## Common Negative Categories for Landscaping
- **Competitors**: Other landscape company names
- **DIY**: "how to", "tutorial", "DIY", "plans"
- **Jobs/Careers**: "jobs", "salary", "hiring", "careers"
- **Wrong Location**: Cities outside service area
- **Wrong Intent**: "free", "cheap", "pictures", "images"
- **B2B/Commercial**: "commercial", "municipal" (if residential focused)
- **Irrelevant Services**: Services not offered

## Match Type Guidelines
- EXACT [keyword]: Block only exact term
- PHRASE "keyword": Block phrases containing term
- BROAD keyword: Block any related variations

## Best Practices
- Start with PHRASE match for most negatives
- Use EXACT for very specific blocks
- Add negatives at campaign AND ad group levels
- Create negative keyword lists for account-wide blocks

Output should include:
- Recommended negatives with match types
- Expected monthly savings
- Risk assessment (potential for blocking good traffic)
- Implementation priority`;

export interface NegativeKeywordRecommendation {
  keyword: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  category: string;
  searchTermsBlocked: number;
  estimatedSavings: number;
  risk: 'low' | 'medium' | 'high';
  reason: string;
}

export interface NegativeKeywordResult {
  summary: string;
  totalWastedSpend: number;
  recommendations: NegativeKeywordRecommendation[];
  categorySummary: Array<{ category: string; count: number; savings: number }>;
  implementationPlan: string[];
  riskWarnings: string[];
}

export async function runNegativeKeywordAnalysis(): Promise<NegativeKeywordResult> {
  console.log('🚫 Starting Negative Keyword Agent...');

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Analyze search terms and recommend negative keywords.

Steps:
1. Get search terms report for last 30 days
2. Identify irrelevant searches that wasted money
3. Group negatives by category
4. Recommend match types
5. Calculate expected savings

Focus on:
- Searches with clicks but 0 conversions
- Clearly irrelevant intent (DIY, jobs, wrong location)
- Competitor brand searches (unless intentional)
- Very low CTR search terms

We're a residential landscaping company in Dublin/Powell/Galena/New Albany, Ohio.
Services: Landscape Design, Hardscaping, Lawn Care, Outdoor Living.

Start by getting the search terms report.`,
    },
  ];

  let response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: env.AGENT_MAX_TOKENS,
    system: NEGATIVE_KEYWORD_SYSTEM_PROMPT,
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
      system: NEGATIVE_KEYWORD_SYSTEM_PROMPT,
      tools: googleAdsTools,
      messages,
    });
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  console.log('✅ Negative keyword analysis complete');

  return {
    summary: textBlock?.text || 'Negative keyword analysis completed',
    totalWastedSpend: 0,
    recommendations: [],
    categorySummary: [],
    implementationPlan: [],
    riskWarnings: [],
  };
}

/**
 * Add negative keywords via MCP
 */
export async function addNegativeKeywords(
  campaignId: string,
  keywords: Array<{ keyword: string; matchType: 'EXACT' | 'PHRASE' | 'BROAD' }>,
  dryRun: boolean = true
): Promise<{ success: boolean; results: any[] }> {
  console.log(`${dryRun ? '🧪 DRY RUN:' : '🚀 LIVE:'} Adding ${keywords.length} negative keywords...`);

  const mcp = await getMCP();
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;

  try {
    const matchTypeMap = {
      EXACT: 2,
      PHRASE: 3,
      BROAD: 4, // For negatives, BROAD is actually 4
    };

    const operations = keywords.map((kw, index) => ({
      entity: 'campaign_criterion',
      operation: 'create',
      resource: {
        campaign: `customers/${customerId}/campaigns/${campaignId}`,
        type: 4, // KEYWORD
        negative: true,
        keyword: {
          text: kw.keyword,
          match_type: matchTypeMap[kw.matchType],
        },
      },
    }));

    const result = await mcp.mutate(operations, {
      customerId,
      dryRun,
      partialFailure: true,
    });

    return {
      success: result.success,
      results: result.data || [],
    };
  } finally {
    await shutdownMCP();
  }
}

// Tool definition for orchestrator
export const negativeKeywordTool = {
  name: 'analyze_negative_keywords',
  description: 'Analyze search terms and recommend negative keywords to reduce wasted spend',
  input_schema: {
    type: 'object' as const,
    properties: {
      apply_recommendations: {
        type: 'boolean',
        description: 'If true, add recommended negative keywords (dry run first)',
        default: false,
      },
      campaign_id: {
        type: 'string',
        description: 'Specific campaign to analyze (optional)',
      },
    },
    required: [],
  },
  handler: async ({ 
    apply_recommendations = false,
    campaign_id,
  }: { 
    apply_recommendations?: boolean;
    campaign_id?: string;
  }) => {
    const result = await runNegativeKeywordAnalysis();
    
    if (apply_recommendations && result.recommendations.length > 0 && campaign_id) {
      const keywords = result.recommendations.map(r => ({
        keyword: r.keyword,
        matchType: r.matchType,
      }));
      
      // Always dry run first
      const dryRunResult = await addNegativeKeywords(campaign_id, keywords, true);
      
      return {
        ...result,
        dryRunResult,
        message: 'Negative keywords validated. Set dry_run: false to apply.',
      };
    }
    
    return result;
  },
};
