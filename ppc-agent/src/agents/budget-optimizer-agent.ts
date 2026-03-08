/**
 * Budget Optimizer Sub-Agent
 * 
 * Analyzes campaign performance and recommends budget reallocations
 * to maximize ROI across the account.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/index.js';
import { toolDefinitions as googleAdsTools, toolHandlers as googleAdsHandlers } from '../tools/google-ads.js';
import { getMCP, shutdownMCP } from '../tools/mcp-bridge.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const BUDGET_OPTIMIZER_SYSTEM_PROMPT = `You are a Budget Optimizer specialist for Google Ads. Your job is to:

1. **Analyze Campaign Performance**: Review spend, conversions, CPA across all campaigns
2. **Identify Opportunities**: Find campaigns with good CPA that could benefit from more budget
3. **Find Waste**: Identify campaigns with poor performance that should have budget reduced
4. **Calculate Reallocation**: Recommend specific budget moves with expected impact
5. **Consider Constraints**: Respect minimum viable budgets and campaign objectives

## Guidelines for Landscaping Business
- Peak season (March-October): More aggressive budgets
- Off season (Nov-Feb): Conservative spending
- Ideal CPA for leads: $50-100
- Minimum daily budget per campaign: $10

## Output Format
Provide:
- Current budget allocation summary
- Recommended reallocations (from → to)
- Expected impact (additional conversions, CPA change)
- Risk assessment
- Implementation priority (1-5)

Be specific with dollar amounts and percentages.`;

export interface BudgetRecommendation {
  campaignId: string;
  campaignName: string;
  currentBudget: number;
  recommendedBudget: number;
  change: number;
  changePercent: number;
  reason: string;
  expectedImpact: string;
  priority: 1 | 2 | 3 | 4 | 5;
}

export interface BudgetOptimizerResult {
  summary: string;
  currentTotalBudget: number;
  recommendedTotalBudget: number;
  recommendations: BudgetRecommendation[];
  expectedROIImprovement: string;
  risks: string[];
  implementationSteps: string[];
}

export async function runBudgetOptimizer(): Promise<BudgetOptimizerResult> {
  console.log('💰 Starting Budget Optimizer Agent...');

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Optimize budget allocation across our Google Ads campaigns.

Steps:
1. Get campaign performance data for last 30 days
2. Identify top performing campaigns (low CPA, good conversion rate)
3. Identify underperforming campaigns (high CPA or no conversions)
4. Calculate optimal budget reallocation
5. Provide specific recommendations with expected impact

Consider:
- We're a landscaping business in Central Ohio
- Peak season is March-October
- We want to maximize leads at $50-100 CPA target
- Current date determines seasonality context

Start by getting campaign performance data.`,
    },
  ];

  let response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: env.AGENT_MAX_TOKENS,
    system: BUDGET_OPTIMIZER_SYSTEM_PROMPT,
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
      system: BUDGET_OPTIMIZER_SYSTEM_PROMPT,
      tools: googleAdsTools,
      messages,
    });
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  console.log('✅ Budget optimization complete');

  return {
    summary: textBlock?.text || 'Budget optimization completed',
    currentTotalBudget: 0,
    recommendedTotalBudget: 0,
    recommendations: [],
    expectedROIImprovement: 'See analysis',
    risks: [],
    implementationSteps: [],
  };
}

/**
 * Apply budget changes via MCP
 * WARNING: This actually modifies budgets!
 */
export async function applyBudgetChanges(
  changes: Array<{ campaignId: string; newBudgetMicros: number }>,
  dryRun: boolean = true
): Promise<{ success: boolean; results: any[] }> {
  console.log(`${dryRun ? '🧪 DRY RUN:' : '🚀 LIVE:'} Applying ${changes.length} budget changes...`);

  const mcp = await getMCP();
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  
  try {
    const operations = changes.map((change, index) => ({
      entity: 'campaign_budget',
      operation: 'update',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/${change.campaignId}`,
        amount_micros: change.newBudgetMicros,
      },
      update_mask: ['amount_micros'],
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
export const budgetOptimizerTool = {
  name: 'optimize_budgets',
  description: 'Analyze campaign performance and recommend budget reallocations to maximize ROI',
  input_schema: {
    type: 'object' as const,
    properties: {
      apply_recommendations: {
        type: 'boolean',
        description: 'If true, apply the recommended budget changes (dry run first)',
        default: false,
      },
    },
    required: [],
  },
  handler: async ({ apply_recommendations = false }: { apply_recommendations?: boolean }) => {
    const result = await runBudgetOptimizer();
    
    if (apply_recommendations && result.recommendations.length > 0) {
      const changes = result.recommendations.map(r => ({
        campaignId: r.campaignId,
        newBudgetMicros: r.recommendedBudget * 1_000_000,
      }));
      
      // Always dry run first
      const dryRunResult = await applyBudgetChanges(changes, true);
      
      return {
        ...result,
        dryRunResult,
        message: 'Budget changes validated. Set dry_run: false to apply.',
      };
    }
    
    return result;
  },
};
