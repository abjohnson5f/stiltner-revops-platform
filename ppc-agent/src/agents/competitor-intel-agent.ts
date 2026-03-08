/**
 * Competitor Intelligence Sub-Agent
 * 
 * Analyzes competitor PPC strategies using DataForSEO data.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/index.js';
import { toolDefinitions as dataForSEOTools, toolHandlers as dataForSEOHandlers } from '../tools/dataforseo.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const COMPETITOR_INTEL_SYSTEM_PROMPT = `You are a Competitive Intelligence specialist for PPC advertising. Your job is to:

1. **Identify Competitors**: Find who's bidding on similar keywords
2. **Analyze Their Strategy**: What keywords they target, their ad copy themes
3. **Find Gaps**: Keywords they're missing that you could target
4. **Find Opportunities**: Keywords where they're weak but have volume
5. **Estimate Their Spend**: Based on position and keyword volume

For landscaping/home services businesses:
- Focus on local intent keywords (city + service)
- Look for seasonal opportunities
- Identify high-value services competitors are pushing

Output structured intelligence including:
- Top 5 competitors with estimated spend
- Their strongest keywords
- Gap opportunities (they have, you don't)
- Attack opportunities (they're weak, you can win)`;

export interface CompetitorIntelResult {
  summary: string;
  competitors: Array<{
    domain: string;
    estimatedSpend: number;
    keywordsCount: number;
    avgPosition: number;
    threatLevel: 'high' | 'medium' | 'low';
  }>;
  gapKeywords: Array<{
    keyword: string;
    volume: number;
    cpc: number;
    competitorRanking: string;
  }>;
  attackOpportunities: Array<{
    keyword: string;
    volume: number;
    competitorPosition: number;
    recommendation: string;
  }>;
}

export async function runCompetitorIntel(
  targetDomain: string,
  seedKeywords: string[],
  location: string = 'United States'
): Promise<CompetitorIntelResult> {
  console.log('🔍 Starting Competitor Intelligence Agent...');

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Analyze competitive landscape for: ${targetDomain}

Target location: ${location}
Seed keywords: ${seedKeywords.join(', ')}

Steps:
1. Get competitors bidding on these keywords
2. Analyze top 3 competitors' keyword strategies
3. Find gap keywords (they have, we don't)
4. Identify attack opportunities (weak positions we can win)
5. Provide strategic recommendations

Start by finding SERP competitors for the seed keywords.`,
    },
  ];

  let response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: env.AGENT_MAX_TOKENS,
    system: COMPETITOR_INTEL_SYSTEM_PROMPT,
    tools: dataForSEOTools,
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
            const handler = dataForSEOHandlers[toolUse.name];
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
      system: COMPETITOR_INTEL_SYSTEM_PROMPT,
      tools: dataForSEOTools,
      messages,
    });
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  console.log('✅ Competitor Intel complete');

  return {
    summary: textBlock?.text || 'Competitor analysis completed',
    competitors: [],
    gapKeywords: [],
    attackOpportunities: [],
  };
}
