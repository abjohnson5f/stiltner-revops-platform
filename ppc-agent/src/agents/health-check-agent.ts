/**
 * Health Check Sub-Agent
 * 
 * Analyzes Google Ads account health and identifies issues.
 * This is a specialized sub-agent called by the main orchestrator.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/index.js';
import { toolDefinitions as googleAdsTools, toolHandlers as googleAdsHandlers } from '../tools/google-ads.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const HEALTH_CHECK_SYSTEM_PROMPT = `You are a Google Ads Health Check specialist. Your job is to analyze PPC account data and identify:

1. **Wasted Spend**: Keywords with clicks but zero conversions
2. **Efficiency Issues**: High CPC keywords relative to market rates
3. **Missing Opportunities**: Important keywords not being targeted
4. **Account Structure**: Problems with campaign/ad group organization
5. **Quality Score Issues**: Low quality scores affecting performance
6. **Location Targeting Issues**: Campaigns running outside intended service areas

CRITICAL — Location Targeting Audit:
- Use the get_location_targeting tool to check EVERY enabled campaign
- This is a LOCAL service business in central Ohio (Dublin, Powell, Galena, New Albany, Westerville)
- Flag any campaign with NO location criteria — this means it's serving NATIONALLY and wasting budget
- Check that positive_geo_target_type is set to PRESENCE (not PRESENCE_OR_INTEREST)
- Use get_geo_performance to verify where ads are actually being shown
- Out-of-area spend is the #1 wasted budget risk for local service businesses

When analyzing data:
- Calculate key metrics: CTR, CPC, CPA, Conversion Rate
- Compare to industry benchmarks for landscaping/home services:
  - CTR benchmark: >3%
  - CPC benchmark: $5-15 for landscaping
  - CPA benchmark: <$100 for leads
- Identify the top 3-5 most impactful issues
- Prioritize by potential cost savings or revenue gain

Output your analysis in a structured format with:
- Executive Summary
- Critical Issues (with $ impact)
- Location Targeting Status (per campaign — PASS/FAIL)
- Recommendations (prioritized)
- Quick Wins (can be done immediately)`;

export interface HealthCheckResult {
  summary: string;
  metrics: {
    totalSpend: number;
    totalClicks: number;
    totalConversions: number;
    ctr: number;
    avgCpc: number;
    cpa: number;
  };
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    recommendation: string;
  }>;
  wastedSpend: {
    total: number;
    keywords: Array<{ keyword: string; spend: number; clicks: number }>;
  };
  quickWins: string[];
}

export async function runHealthCheck(customerId?: string): Promise<HealthCheckResult> {
  console.log('🏥 Starting Health Check Agent...');

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Run a comprehensive health check on this Google Ads account${customerId ? ` (Customer ID: ${customerId})` : ''}.

Steps to follow:
1. First, get campaign performance for the last 30 days
2. Get keyword performance data
3. Get search terms report to see what's triggering ads
4. CRITICAL: Use get_location_targeting to audit location criteria on ALL campaigns
5. Use get_geo_performance to see where ads are actually serving geographically
6. Analyze the data and identify issues
7. Calculate wasted spend on non-converting keywords AND out-of-area spend
8. Provide prioritized recommendations

Start by getting the campaign performance data and location targeting data in parallel.`,
    },
  ];

  // Run the agent loop
  let response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: env.AGENT_MAX_TOKENS,
    system: HEALTH_CHECK_SYSTEM_PROMPT,
    tools: googleAdsTools,
    messages,
  });

  // Process tool calls until done
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
      system: HEALTH_CHECK_SYSTEM_PROMPT,
      tools: googleAdsTools,
      messages,
    });
  }

  // Extract final text response
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  console.log('✅ Health Check complete');

  // Parse the response into structured format
  // (In production, you'd use structured output or more robust parsing)
  return {
    summary: textBlock?.text || 'Health check completed',
    metrics: {
      totalSpend: 0,
      totalClicks: 0,
      totalConversions: 0,
      ctr: 0,
      avgCpc: 0,
      cpa: 0,
    },
    issues: [],
    wastedSpend: { total: 0, keywords: [] },
    quickWins: [],
  };
}
