import Anthropic from '@anthropic-ai/sdk';
import type { HealthCheckResult, HealthIssue, CampaignHealth } from './types';

const PPC_AGENT_URL = process.env.PPC_AGENT_URL || 'http://localhost:3847';

/**
 * Fetch real data from PPC Agent webhook
 */
async function fetchFromAgent(): Promise<{ metrics: any; campaigns: any[] } | null> {
  try {
    const response = await fetch(`${PPC_AGENT_URL}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get-metrics', // Note: hyphen not underscore
      }),
    });

    if (!response.ok) {
      console.error('[Health Check] PPC Agent error:', response.status);
      return null;
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      return {
        metrics: result.data.summary || {},
        campaigns: result.data.campaigns || [],
      };
    }
    
    return null;
  } catch (error) {
    console.error('[Health Check] Failed to fetch from PPC Agent:', error);
    return null;
  }
}

/**
 * Run a comprehensive health check on the Google Ads account
 */
export async function runHealthCheck(customerId?: string): Promise<HealthCheckResult> {
  try {
    // Fetch real data from PPC Agent
    const agentData = await fetchFromAgent();

    // Check if we got real data
    if (!agentData || !agentData.metrics) {
      return {
        status: 'warning',
        score: 50,
        issues: [{
          severity: 'warning',
          type: 'connection_error',
          message: 'Could not connect to Google Ads API',
          recommendation: 'Check that the PPC Agent webhook server is running: cd projects/ppc-agent && npm run webhook-server',
        }],
        recommendations: ['Start the PPC Agent webhook server'],
        campaigns: [],
        wastedSpend: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const { metrics, campaigns } = agentData;

    // Build campaign health data
    const campaignHealth: CampaignHealth[] = campaigns.map((c: any) => ({
      id: String(c.id),
      name: c.name || 'Unknown Campaign',
      status: c.status === 2 ? 'ENABLED' : c.status === 3 ? 'PAUSED' : 'UNKNOWN',
      budget: 0, // Not in this response
      spend: c.cost || 0,
      impressions: c.impressions || 0,
      clicks: c.clicks || 0,
      conversions: c.conversions || 0,
      ctr: (c.ctr || 0) * 100, // Convert to percentage
      cpc: c.avg_cpc || 0,
      score: c.impressions > 0 ? 70 : 50,
      issues: [],
    }));

    // Calculate basic health metrics
    const totalSpend = metrics.totalSpend || 0;
    const totalConversions = metrics.totalConversions || 0;
    const totalClicks = metrics.totalClicks || 0;
    const ctr = metrics.ctr || 0;
    
    const cpl = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const isHighCPL = cpl > 100 && totalConversions > 0;
    const isLowCTR = ctr < 2;
    const isLowConversions = totalConversions < 2;

    const issues: HealthIssue[] = [];
    const recommendations: string[] = [];
    let score = 100;

    if (isHighCPL) {
      issues.push({
        severity: 'warning',
        type: 'high_cpl',
        message: `Cost per lead is $${cpl.toFixed(2)} (target: $75-100)`,
        recommendation: 'Review keyword targeting and add negative keywords for irrelevant searches',
      });
      score -= 15;
    }

    if (isLowCTR) {
      issues.push({
        severity: 'warning',
        type: 'low_ctr',
        message: `Click-through rate is ${ctr.toFixed(2)}% (target: >3%)`,
        recommendation: 'Improve ad copy relevance or refine targeting',
      });
      score -= 10;
    }

    if (isLowConversions) {
      issues.push({
        severity: 'warning',
        type: 'low_conversions',
        message: `Only ${totalConversions} conversions in the period`,
        recommendation: 'Review landing pages and consider expanding keyword targeting',
      });
      score -= 15;
    }

    // Add recommendations based on data
    if (totalSpend > 0 && totalConversions === 0) {
      issues.push({
        severity: 'critical',
        type: 'no_conversions',
        message: 'You have spend but ZERO conversions',
        recommendation: 'URGENT: Verify conversion tracking is correctly configured',
      });
      score -= 30;
    }

    if (cpl > 150 && totalConversions > 0) {
      recommendations.push('Consider pausing underperforming keywords with high spend and zero conversions');
    }
    
    recommendations.push('Review search terms report weekly to find negative keyword opportunities');
    recommendations.push('Test new ad variations to improve CTR');
    recommendations.push('Ensure conversion tracking is firing correctly on form submissions');

    // Estimate wasted spend
    const wastedSpend = totalConversions === 0 ? totalSpend : 
      Math.max(0, totalSpend - (totalConversions * 75));

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (score < 60) status = 'critical';
    else if (score < 80) status = 'warning';

    // Use Claude for deeper analysis if available
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const aiAnalysis = await analyzeWithClaude(metrics, campaigns);
        return {
          ...aiAnalysis,
          campaigns: campaignHealth,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.warn('[Health Check] AI analysis failed, using basic analysis:', error);
      }
    }

    return {
      status,
      score: Math.max(0, score),
      issues,
      recommendations,
      campaigns: campaignHealth,
      wastedSpend,
      timestamp: new Date().toISOString(),
      response: formatBasicReport(metrics, campaigns, issues, recommendations),
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      status: 'warning',
      score: 50,
      issues: [{
        severity: 'warning',
        type: 'error',
        message: error instanceof Error ? error.message : 'Health check failed',
        recommendation: 'Check server logs for details',
      }],
      recommendations: ['Try running the health check again'],
      campaigns: [],
      wastedSpend: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

function formatBasicReport(metrics: any, campaigns: any[], issues: HealthIssue[], recommendations: string[]): string {
  const totalSpend = metrics.totalSpend || 0;
  const totalConversions = metrics.totalConversions || 0;
  const cpl = totalConversions > 0 ? totalSpend / totalConversions : 0;
  
  let report = `## Google Ads Account Health Report\n\n`;
  report += `### Account Summary (Last 7 Days)\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| **Total Spend** | $${totalSpend.toFixed(2)} |\n`;
  report += `| **Clicks** | ${(metrics.totalClicks || 0).toLocaleString()} |\n`;
  report += `| **Impressions** | ${(metrics.totalImpressions || 0).toLocaleString()} |\n`;
  report += `| **Conversions** | ${totalConversions} |\n`;
  report += `| **CTR** | ${(metrics.ctr || 0).toFixed(2)}% |\n`;
  report += `| **Avg CPC** | $${(metrics.cpc || 0).toFixed(2)} |\n`;
  report += `| **Cost per Lead** | $${cpl.toFixed(2)} |\n\n`;

  // Active campaigns
  const activeCampaigns = campaigns.filter(c => c.status === 2 && c.impressions > 0);
  if (activeCampaigns.length > 0) {
    report += `### Active Campaigns\n`;
    report += `| Campaign | Spend | Clicks | Conv | CPL |\n`;
    report += `|----------|-------|--------|------|-----|\n`;
    activeCampaigns.forEach(c => {
      const campCpl = c.conversions > 0 ? (c.cost / c.conversions).toFixed(2) : 'N/A';
      report += `| ${c.name} | $${c.cost.toFixed(2)} | ${c.clicks} | ${c.conversions} | $${campCpl} |\n`;
    });
    report += `\n`;
  }

  if (issues.length > 0) {
    report += `### Issues Found\n`;
    issues.forEach(issue => {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️';
      report += `${icon} **${issue.message}**\n`;
      report += `   → ${issue.recommendation}\n\n`;
    });
  } else {
    report += `### ✅ No Critical Issues Found\n\n`;
  }

  report += `### Recommendations\n`;
  recommendations.forEach((rec, i) => {
    report += `${i + 1}. ${rec}\n`;
  });

  return report;
}

async function analyzeWithClaude(metrics: any, campaigns: any[]): Promise<HealthCheckResult> {
  const anthropic = new Anthropic();
  
  const totalSpend = metrics.totalSpend || 0;
  const totalConversions = metrics.totalConversions || 0;
  const cpl = totalConversions > 0 ? totalSpend / totalConversions : 0;
  
  const activeCampaigns = campaigns.filter(c => c.status === 2);
  
  const prompt = `You are a Google Ads expert. Analyze this account data and provide actionable insights.

## Account Metrics (Last 7 Days)
- Spend: $${totalSpend.toFixed(2)}
- Clicks: ${metrics.totalClicks || 0}
- Impressions: ${metrics.totalImpressions || 0}
- Conversions: ${totalConversions}
- CTR: ${(metrics.ctr || 0).toFixed(2)}%
- Avg CPC: $${(metrics.cpc || 0).toFixed(2)}
- Cost per Lead: $${cpl.toFixed(2)}

## Active Campaigns (${activeCampaigns.length})
${activeCampaigns.map(c => `- ${c.name}: $${c.cost.toFixed(2)} spend, ${c.clicks} clicks, ${c.conversions} conversions`).join('\n')}

## Business Context
- Industry: Landscaping (Central Ohio)
- Target CPL: $75-100
- Good CTR benchmark: >3%
- Services: Design/Build, Maintenance, Hardscaping, Outdoor Living

Provide your analysis in markdown format with:
1. **Executive Summary** (2-3 sentences on account health)
2. **Key Metrics Analysis** (what's working, what's not)
3. **Issues Found** (prioritized list with severity)
4. **Specific Recommendations** (actionable steps)
5. **Estimated Wasted Spend** (based on inefficiencies)

Be specific and reference actual numbers. Be direct about problems.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response');

  const aiText = content.text;
  
  // Determine status based on metrics
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  let score = 75;
  
  if (totalConversions === 0 && totalSpend > 100) {
    status = 'critical';
    score = 35;
  } else if (cpl > 150 || (metrics.ctr || 0) < 1.5) {
    status = 'warning';
    score = 55;
  } else if (cpl > 100 || (metrics.ctr || 0) < 2) {
    status = 'warning';
    score = 65;
  }

  const wastedSpend = totalConversions === 0 ? totalSpend : 
    Math.max(0, totalSpend - (totalConversions * 75));

  return {
    status,
    score,
    issues: [],
    recommendations: [],
    campaigns: [],
    wastedSpend,
    response: aiText,
    timestamp: new Date().toISOString(),
  };
}
