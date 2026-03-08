/**
 * Marketing Intelligence Orchestrator
 * 
 * This is the main agent that coordinates sub-agents and tools
 * to provide comprehensive marketing management capabilities.
 * 
 * Includes:
 * - PPC Management (Google Ads, Meta Ads)
 * - Content Automation (Newsletter, Social Media)
 * - CRM Operations (Pipedrive, Lead Management)
 * - Attribution Tracking (CPL, ROAS, CAC, LTV)
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/index.js';
// PPC Agents
import { runHealthCheck, type HealthCheckResult } from './health-check-agent.js';
import { runCompetitorIntel, type CompetitorIntelResult } from './competitor-intel-agent.js';
import { createCampaign, campaignBuilderTool } from './campaign-builder-agent.js';
import { runBudgetOptimizer, budgetOptimizerTool } from './budget-optimizer-agent.js';
import { runAdCopyTester, adCopyTesterTool } from './ad-copy-tester-agent.js';
import { runNegativeKeywordAnalysis, negativeKeywordTool } from './negative-keyword-agent.js';
// Marketing Ops Agents
import { processOutboxOnce, operationsAgentTool } from './operations-agent.js';
import { runContentWorkflow, contentAgentTool } from './content-agent.js';
import { runMetaAdsWorkflow, metaAdsAgentTool } from './meta-ads-agent.js';
import { runAttributionWorkflow, attributionAgentTool } from './attribution-agent.js';
// Tools
import { toolDefinitions as googleAdsTools, toolHandlers as googleAdsHandlers } from '../tools/google-ads.js';
import { toolDefinitions as dataForSEOTools, toolHandlers as dataForSEOHandlers } from '../tools/dataforseo.js';
import { toolDefinitions as notificationTools, toolHandlers as notificationHandlers } from '../tools/notifications.js';
import { toolDefinitions as metaAdsToolDefs, toolHandlers as metaAdsToolHandlers } from '../tools/meta-ads.js';
import { toolDefinitions as attributionToolDefs, toolHandlers as attributionToolHandlers } from '../tools/attribution.js';
import { getSkillsSummary, getSkill, skillCount } from '../skills/index.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Load marketing skills summary
const skillsSummary = getSkillsSummary();
console.log(`📚 Loaded ${skillCount} marketing skills`);

const ORCHESTRATOR_SYSTEM_PROMPT = `You are an elite Marketing Intelligence Agent with deep expertise in PPC, SEO, content strategy, and creative production. You have access to:

## PPC Sub-Agents
- **Health Check Agent**: Run comprehensive account health analysis
- **Competitor Intel Agent**: Analyze competitor PPC strategies
- **Campaign Builder Agent**: Create new Google Ads campaigns from descriptions
- **Budget Optimizer Agent**: Recommend budget reallocations
- **Ad Copy Tester Agent**: Generate A/B test ad variations
- **Negative Keyword Agent**: Find and add negative keywords

## Marketing Ops Sub-Agents
- **Operations Agent**: Process lead queue, sync to CRM, send notifications
- **Content Agent**: Generate newsletters, social media posts, content plans
- **Meta Ads Agent**: Create Facebook/Instagram ad campaigns
- **Attribution Agent**: Sync metrics, calculate ROI, generate CMO reports

## Direct Tools (Granular Tasks)
- Google Ads API tools for querying campaign/keyword data
- Meta Marketing API tools for Facebook/Instagram ads
- DataForSEO tools for market research and competitor analysis
- Attribution tools for CPL, ROAS, CAC, LTV calculations
- Notification tools for sending alerts

## Your Capabilities
1. **Audit**: Run full account audits identifying waste and opportunities
2. **Research**: Research keywords, competitors, and market trends
3. **Optimize**: Recommend bid adjustments, negative keywords, new keywords
4. **Create**: Build new campaigns (Google & Meta) from natural language
5. **Report**: Generate executive summaries, daily/weekly CMO reports
6. **Alert**: Send notifications about important findings
7. **Marketing Strategy**: Brand voice, positioning, content strategy, lead magnets
8. **Content Creation**: Direct response copy, email sequences, newsletters, SEO content
9. **Creative Direction**: Visual strategy, ad creative concepts, social graphics
10. **Operations**: Process leads, sync CRM, manage outbox queue
11. **Attribution**: Track CPL, ROAS, CAC, LTV across all channels

${skillsSummary}

## Guidelines
- Always start with data gathering before making recommendations
- Prioritize recommendations by ROI impact
- Consider seasonal trends for landscaping businesses
- Focus on local/geo-targeted opportunities
- Be specific with numbers and dollar amounts
- Use sub-agents for complex multi-step tasks
- Use direct tools for specific data queries
- For marketing strategy questions, apply the relevant skill framework
- When creating content, use the direct-response-copy or seo-content frameworks
- For complex multi-step marketing projects, route through skill dependencies
- For attribution questions, use the attribution tools and agent

## Output Format
Structure your responses with:
- **Summary**: 2-3 sentence overview
- **Key Findings**: Bullet points of important discoveries
- **Recommendations**: Prioritized action items with expected impact
- **Next Steps**: What to do immediately

## Business Context
**Business:** Stiltner Landscapes - Premium landscaping services in Central Ohio
**Location:** Dublin, Powell, Galena, New Albany, Westerville
**Services:** Landscape Design, Hardscaping, Outdoor Living, Lawn Care, Seasonal Maintenance
**Website:** https://stiltnerlandscapes.com
**Phone:** (614) 707-4788`;

// Sub-agent tools that the orchestrator can call
const subAgentTools: Anthropic.Tool[] = [
  // Skill loading tool
  {
    name: 'use_marketing_skill',
    description: 'Load a detailed marketing skill framework. Use this when you need the full methodology for: brand-voice, positioning-angles, keyword-research, direct-response-copy, seo-content, email-sequences, lead-magnet, newsletter, content-atomizer, ai-creative-strategist, ai-image-generation, ai-product-photo, ai-social-graphics, or orchestrator.',
    input_schema: {
      type: 'object' as const,
      properties: {
        skill_name: {
          type: 'string',
          description: 'Name of the skill to load (e.g., "direct-response-copy", "brand-voice", "positioning-angles")',
        },
      },
      required: ['skill_name'],
    },
  },
  // PPC Sub-Agents
  {
    name: 'run_health_check',
    description: 'Run a comprehensive health check on the Google Ads account. Returns analysis of wasted spend, efficiency issues, and recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_id: {
          type: 'string',
          description: 'Optional specific customer ID to check',
        },
      },
      required: [],
    },
  },
  {
    name: 'run_competitor_intel',
    description: 'Analyze competitor PPC strategies, find gap keywords, and identify attack opportunities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target_domain: {
          type: 'string',
          description: 'Your domain (e.g., stiltnerlandscapes.com)',
        },
        seed_keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Seed keywords to analyze',
        },
        location: {
          type: 'string',
          default: 'United States',
        },
      },
      required: ['target_domain', 'seed_keywords'],
    },
  },
  {
    name: campaignBuilderTool.name,
    description: campaignBuilderTool.description,
    input_schema: campaignBuilderTool.input_schema,
  },
  {
    name: budgetOptimizerTool.name,
    description: budgetOptimizerTool.description,
    input_schema: budgetOptimizerTool.input_schema,
  },
  {
    name: adCopyTesterTool.name,
    description: adCopyTesterTool.description,
    input_schema: adCopyTesterTool.input_schema,
  },
  {
    name: negativeKeywordTool.name,
    description: negativeKeywordTool.description,
    input_schema: negativeKeywordTool.input_schema,
  },
  // Marketing Ops Sub-Agents
  {
    name: operationsAgentTool.name,
    description: operationsAgentTool.description,
    input_schema: operationsAgentTool.input_schema,
  },
  {
    name: contentAgentTool.name,
    description: contentAgentTool.description,
    input_schema: contentAgentTool.input_schema,
  },
  {
    name: metaAdsAgentTool.name,
    description: metaAdsAgentTool.description,
    input_schema: metaAdsAgentTool.input_schema,
  },
  {
    name: attributionAgentTool.name,
    description: attributionAgentTool.description,
    input_schema: attributionAgentTool.input_schema,
  },
];

// Combine all tools
const allTools = [
  ...subAgentTools,
  ...googleAdsTools,
  ...dataForSEOTools,
  ...notificationTools,
  ...metaAdsToolDefs,
  ...attributionToolDefs,
];

// Combined handler map
const allHandlers: Record<string, (args: any) => Promise<any>> = {
  ...googleAdsHandlers,
  ...dataForSEOHandlers,
  ...notificationHandlers,
  ...metaAdsToolHandlers,
  ...attributionToolHandlers,
  // Marketing skill handler
  use_marketing_skill: async ({ skill_name }: { skill_name: string }) => {
    const skill = getSkill(skill_name);
    if (!skill) {
      return { 
        error: `Skill "${skill_name}" not found. Available skills: brand-voice, positioning-angles, keyword-research, direct-response-copy, seo-content, email-sequences, lead-magnet, newsletter, content-atomizer, ai-creative-strategist, ai-image-generation, ai-product-photo, ai-social-graphics, orchestrator` 
      };
    }
    return {
      name: skill.name,
      description: skill.description,
      framework: skill.content,
      references: skill.references,
    };
  },
  // PPC Sub-agent handlers
  run_health_check: async ({ customer_id }: { customer_id?: string }) => {
    return await runHealthCheck(customer_id);
  },
  run_competitor_intel: async ({ 
    target_domain, 
    seed_keywords, 
    location 
  }: { 
    target_domain: string; 
    seed_keywords: string[]; 
    location?: string 
  }) => {
    return await runCompetitorIntel(target_domain, seed_keywords, location);
  },
  [campaignBuilderTool.name]: campaignBuilderTool.handler,
  [budgetOptimizerTool.name]: budgetOptimizerTool.handler,
  [adCopyTesterTool.name]: adCopyTesterTool.handler,
  [negativeKeywordTool.name]: negativeKeywordTool.handler,
  // Marketing Ops Sub-agent handlers
  [operationsAgentTool.name]: operationsAgentTool.handler,
  [contentAgentTool.name]: contentAgentTool.handler,
  [metaAdsAgentTool.name]: metaAdsAgentTool.handler,
  [attributionAgentTool.name]: attributionAgentTool.handler,
};

export interface OrchestratorOptions {
  maxIterations?: number;
  verbose?: boolean;
}

export interface AgentResponse {
  response: string;
  toolCalls: Array<{ tool: string; input: any; result: any }>;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Run the PPC Intelligence Agent
 */
export async function runAgent(
  userMessage: string,
  options: OrchestratorOptions = {}
): Promise<AgentResponse> {
  const { maxIterations = 10, verbose = true } = options;

  if (verbose) {
    console.log('\n🤖 PPC Intelligence Agent Starting...\n');
    console.log(`📝 Task: ${userMessage}\n`);
  }

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  const toolCallLog: Array<{ tool: string; input: any; result: any }> = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    let retries = 0;
    const maxRetries = 3;
    let response;

    while (retries <= maxRetries) {
      try {
        response = await client.messages.create({
          model: env.AGENT_MODEL,
          max_tokens: env.AGENT_MAX_TOKENS,
          system: ORCHESTRATOR_SYSTEM_PROMPT,
          tools: allTools,
          messages,
        });
        break; // Success, exit retry loop
      } catch (error: any) {
        if (error.type === 'rate_limit_error' || error.status === 429) {
          retries++;
          if (retries > maxRetries) throw error;
          
          console.log(`⚠️ Rate limit hit. Retrying in ${retries * 5} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retries * 5000));
        } else {
          throw error; // Other errors, crash immediately
        }
      }
    }

    if (!response) throw new Error('Failed to get response from Anthropic');

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Check if we're done
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      if (verbose) {
        console.log('\n✅ Agent completed task\n');
      }

      return {
        response: textBlock?.text || '',
        toolCalls: toolCallLog,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };
    }

    // Process tool calls
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (verbose) {
        console.log(`🔄 Iteration ${iterations}: ${toolUseBlocks.length} tool call(s)`);
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        if (verbose) {
          console.log(`  🔧 ${toolUse.name}`);
        }

        try {
          const handler = allHandlers[toolUse.name];
          if (!handler) {
            throw new Error(`Unknown tool: ${toolUse.name}`);
          }

          const result = await handler(toolUse.input as any);
          const resultStr = JSON.stringify(result, null, 2);

          toolCallLog.push({
            tool: toolUse.name,
            input: toolUse.input,
            result,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: resultStr.length > 5000 
              ? resultStr.substring(0, 5000) + '\n... (truncated to save tokens)'
              : resultStr,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          if (verbose) {
            console.log(`    ❌ Error: ${errorMsg}`);
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${errorMsg}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }
  }

  throw new Error(`Agent exceeded max iterations (${maxIterations})`);
}

/**
 * Run a specific workflow
 */
export const workflows = {
  // ==========================================
  // PPC WORKFLOWS
  // ==========================================

  /**
   * Full account audit
   */
  async fullAudit(customerId?: string): Promise<AgentResponse> {
    return runAgent(`
      Run a complete audit of the Google Ads account:
      
      1. Start with a health check to identify issues
      2. Analyze competitor landscape for landscaping keywords in Central Ohio
      3. Identify wasted spend and recommend negative keywords
      4. Find new keyword opportunities
      5. Provide a prioritized action plan with expected ROI
      
      ${customerId ? `Customer ID: ${customerId}` : ''}
      
      Focus on landscaping services: landscape design, lawn care, hardscaping, outdoor living.
      Target areas: Dublin OH, Powell OH, Galena OH, New Albany OH.
    `);
  },

  /**
   * Quick health check
   */
  async quickHealthCheck(customerId?: string): Promise<AgentResponse> {
    return runAgent(`
      Run a quick health check on the Google Ads account.
      Focus on:
      - Top 5 wasted spend keywords
      - Top 5 performing keywords
      - Overall CTR, CPC, CPA metrics vs benchmarks
      - Immediate recommendations
      
      ${customerId ? `Customer ID: ${customerId}` : ''}
    `);
  },

  /**
   * Competitor analysis
   */
  async competitorAnalysis(competitors: string[]): Promise<AgentResponse> {
    return runAgent(`
      Analyze these competitors for landscaping services in Central Ohio:
      ${competitors.join(', ')}
      
      Find:
      1. What keywords they're bidding on
      2. Their estimated spend
      3. Gap keywords we should target
      4. Their ad copy themes
      5. Opportunities to outcompete them
    `);
  },

  /**
   * Keyword research
   */
  async keywordResearch(seedKeywords: string[], location: string): Promise<AgentResponse> {
    return runAgent(`
      Research keywords for a landscaping business:
      
      Seed keywords: ${seedKeywords.join(', ')}
      Location: ${location}
      
      Find:
      1. Related keywords with search volume and CPC
      2. Long-tail variations
      3. Local intent keywords (city + service)
      4. Seasonal opportunities
      5. Recommended bid ranges
      
      Prioritize by potential ROI for a landscaping business.
    `);
  },

  /**
   * Create a new Google Ads campaign
   */
  async createCampaign(
    description: string,
    options: { dryRun?: boolean } = {}
  ): Promise<AgentResponse> {
    return runAgent(`
      Create a new Google Ads search campaign:
      
      ${description}
      
      Business: Stiltner Landscapes
      Website: https://stiltnerlandscapes.com
      Phone: (614) 707-4788
      Services: Landscape Design, Hardscaping, Outdoor Living, Lawn Care
      
      Use the create_campaign tool to build and ${options.dryRun !== false ? 'validate (dry run)' : 'CREATE'} the campaign.
      ${options.dryRun !== false ? 'This is a dry run - the campaign will NOT be created yet.' : 'This will CREATE the campaign in PAUSED state.'}
    `);
  },

  /**
   * Optimize budgets
   */
  async optimizeBudgets(): Promise<AgentResponse> {
    return runAgent(`
      Analyze our campaign budgets and recommend optimizations:
      
      1. Review performance of all campaigns
      2. Identify campaigns with good CPA that could benefit from more budget
      3. Find campaigns with poor performance that should have budget reduced
      4. Calculate specific budget reallocation recommendations
      5. Estimate the impact of the changes
      
      We're a landscaping business, so consider seasonality (peak: March-October).
    `);
  },

  /**
   * Analyze negative keywords
   */
  async analyzeNegativeKeywords(): Promise<AgentResponse> {
    return runAgent(`
      Analyze search terms and recommend negative keywords:
      
      1. Get the search terms report
      2. Identify irrelevant searches wasting money
      3. Group negatives by category (DIY, jobs, wrong location, etc.)
      4. Recommend match types for each negative
      5. Calculate expected monthly savings
      
      We're a residential landscaping company in Dublin/Powell/Galena/New Albany, Ohio.
    `);
  },

  /**
   * Generate ad variations
   */
  async generateAdVariations(service: string, location: string = 'Dublin Ohio'): Promise<AgentResponse> {
    return runAgent(`
      Generate A/B test ad variations for:
      
      Service: ${service}
      Location: ${location}
      Business: Stiltner Landscapes
      
      Create 3-5 compelling ad variations that:
      1. Test different emotional appeals
      2. Test different CTAs
      3. Follow all Google Ads policies
      4. Highlight local presence and expertise
      
      Each variation should have a hypothesis for what it tests.
    `);
  },

  // ==========================================
  // MARKETING OPS WORKFLOWS
  // ==========================================

  /**
   * Process the outbox queue (leads to CRM, notifications)
   */
  async processOutbox(): Promise<AgentResponse> {
    return runAgent(`
      Process the Neon outbox queue:
      1. Claim pending messages
      2. Sync leads to Pipedrive
      3. Send Google Chat notifications
      4. Handle any failures with retry logic
      
      Use the run_operations_workflow tool with mode "process".
    `);
  },

  /**
   * Generate weekly newsletter
   */
  async generateNewsletter(topics?: string[]): Promise<AgentResponse> {
    return runAgent(`
      Generate this week's newsletter for Beehiiv:
      ${topics ? `Focus on these topics: ${topics.join(', ')}` : 'Choose seasonal landscaping topics.'}
      
      Use the run_content_workflow tool with workflow "newsletter".
      
      The newsletter should:
      1. Have a compelling subject line
      2. Include actionable landscaping tips
      3. Showcase our services
      4. Have a clear CTA to book a consultation
    `);
  },

  /**
   * Generate weekly content plan (newsletter + social posts)
   */
  async generateWeeklyPlan(): Promise<AgentResponse> {
    return runAgent(`
      Generate a full weekly content plan:
      
      1. Create newsletter content
      2. Generate social media posts for Instagram, Facebook, LinkedIn
      3. Plan TikTok video concepts
      
      Use the run_content_workflow tool with workflow "weekly-plan".
      
      Consider seasonal themes for landscaping in Central Ohio.
    `);
  },

  /**
   * Create a Meta (Facebook/Instagram) ad campaign
   */
  async createMetaCampaign(
    description: string,
    options: { dryRun?: boolean; budget?: number } = {}
  ): Promise<AgentResponse> {
    return runAgent(`
      Create a new Meta (Facebook/Instagram) ad campaign:
      
      ${description}
      
      Budget: ${options.budget ? `$${options.budget}/day` : 'Use reasonable default for landscaping'}
      
      Business: Stiltner Landscapes
      Website: https://stiltnerlandscapes.com
      Phone: (614) 707-4788
      
      Use the run_meta_ads_workflow tool with workflow "create".
      ${options.dryRun !== false ? 'This is a dry run - the campaign will NOT be created yet.' : 'This will CREATE the campaign in PAUSED state.'}
    `);
  },

  /**
   * Get Meta Ads performance report
   */
  async metaAdsReport(dateRange?: { since: string; until: string }): Promise<AgentResponse> {
    return runAgent(`
      Generate a performance report for our Meta (Facebook/Instagram) ads:
      ${dateRange ? `Date range: ${dateRange.since} to ${dateRange.until}` : 'Last 30 days'}
      
      Use the run_meta_ads_workflow tool with workflow "analyze".
      
      Include:
      1. Campaign performance by objective
      2. CPL and ROAS metrics
      3. Creative performance
      4. Recommendations for optimization
    `);
  },

  /**
   * Generate daily marketing report
   */
  async dailyReport(): Promise<AgentResponse> {
    return runAgent(`
      Generate the daily marketing report:
      
      1. Sync metrics from Google Ads and Meta Ads
      2. Calculate CPL, ROAS across all channels
      3. Compare to yesterday and last week
      4. Identify any anomalies or alerts
      5. Send the report to Google Chat
      
      Use the run_attribution_workflow tool with workflow "daily-report".
    `);
  },

  /**
   * Generate weekly CMO summary
   */
  async weeklyReport(): Promise<AgentResponse> {
    return runAgent(`
      Generate the weekly CMO marketing summary:
      
      1. Aggregate all channel performance
      2. Calculate week-over-week changes
      3. Highlight wins and concerns
      4. Provide strategic recommendations
      5. Send to Google Chat
      
      Use the run_attribution_workflow tool with workflow "weekly-report".
    `);
  },

  /**
   * Full attribution analysis with AI insights
   */
  async attributionAnalysis(dateRange?: { since: string; until: string }): Promise<AgentResponse> {
    return runAgent(`
      Run a comprehensive marketing attribution analysis:
      ${dateRange ? `Date range: ${dateRange.since} to ${dateRange.until}` : 'Last 30 days'}
      
      1. Calculate CPL, ROAS, CAC, LTV across all channels
      2. Compare channel efficiency
      3. Identify best-performing campaigns
      4. Generate AI-powered insights
      5. Provide optimization recommendations
      
      Use the run_attribution_workflow tool with workflow "full-analysis".
    `);
  },
};
