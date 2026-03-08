import Anthropic from '@anthropic-ai/sdk';
import type { MetricsContext, InsightContext } from './types';

export async function generateInsights(metrics: MetricsContext, context: InsightContext): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateBasicInsights(metrics);
  }

  const anthropic = new Anthropic();
  const contextDesc: Record<InsightContext, string> = {
    homepage_summary: 'a business owner viewing their dashboard',
    attribution_analysis: 'someone analyzing channel performance',
    lead_pipeline: 'someone reviewing lead pipeline status',
  };

  const prompt = `Generate 3-5 plain-English insights for ${contextDesc[context]}:

Metrics:
- Leads today: ${metrics.leadsToday} (yesterday: ${metrics.leadsYesterday})
- Spend today: $${metrics.spendToday.toFixed(2)} (yesterday: $${metrics.spendYesterday.toFixed(2)})
- CPL this week: $${metrics.cplThisWeek.toFixed(2)} (last week: $${metrics.cplLastWeek.toFixed(2)})

Channels:
${metrics.channels.map(c => `- ${c.name}: ${c.leads} leads, $${c.spend.toFixed(2)} spend`).join('\n')}

Return JSON array: ["<insight 1>", "<insight 2>", ...]
Return ONLY the JSON array.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');
    const insights = JSON.parse(content.text);
    return Array.isArray(insights) ? insights : [content.text];
  } catch (error) {
    return generateBasicInsights(metrics);
  }
}

function generateBasicInsights(metrics: MetricsContext): string[] {
  const insights: string[] = [];
  
  if (metrics.leadsToday !== metrics.leadsYesterday) {
    const change = metrics.leadsToday - metrics.leadsYesterday;
    const pctChange = metrics.leadsYesterday > 0 ? Math.abs((change / metrics.leadsYesterday) * 100).toFixed(0) : 100;
    if (change > 0) {
      insights.push(`You got ${metrics.leadsToday} leads today, ${pctChange}% more than yesterday.`);
    } else if (change < 0) {
      insights.push(`Lead volume is down today (${metrics.leadsToday} vs ${metrics.leadsYesterday} yesterday).`);
    }
  } else {
    insights.push(`Steady day with ${metrics.leadsToday} leads, same as yesterday.`);
  }
  
  if (metrics.cplThisWeek > 0) {
    if (metrics.cplThisWeek <= 75) {
      insights.push(`Your CPL ($${metrics.cplThisWeek.toFixed(2)}) is below target - great!`);
    } else if (metrics.cplThisWeek <= 100) {
      insights.push(`CPL ($${metrics.cplThisWeek.toFixed(2)}) is in a healthy range.`);
    } else {
      insights.push(`CPL ($${metrics.cplThisWeek.toFixed(2)}) is above $100 target.`);
    }
  }
  
  if (metrics.channels.length > 0) {
    const top = [...metrics.channels].sort((a, b) => b.leads - a.leads)[0];
    if (top.leads > 0) {
      const names: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads', direct: 'Direct', organic: 'Organic' };
      insights.push(`${names[top.name] || top.name} is your top performer with ${top.leads} leads.`);
    }
  }
  
  return insights.slice(0, 5);
}
