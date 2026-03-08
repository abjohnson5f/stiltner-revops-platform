import Anthropic from '@anthropic-ai/sdk';
import type { NewsletterParams, NewsletterResult, AtomizeParams, AtomizeResult, EmailSequenceParams, EmailSequenceResult } from './types';

export async function generateNewsletter(params: NewsletterParams): Promise<NewsletterResult> {
  const { topics, seasonalTheme, featuredProject } = params;
  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const season = seasonalTheme || getSeasonFromMonth(new Date().getMonth());

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      subject: `${season.charAt(0).toUpperCase() + season.slice(1)} Landscaping Tips`,
      preview: `Get your yard ready for ${season} with expert tips.`,
      body: `# ${currentMonth} Newsletter\n\nHello!\n\nAs ${season} arrives, it's time to plan your outdoor space.\n\n## Quick Tips\n\n- Review your landscape plan\n- Schedule a consultation\n- Consider seasonal plantings\n\n**Ready to get started?** Contact us for a free estimate!\n\nBest,\nStiltner Landscapes`,
    };
  }

  const anthropic = new Anthropic();
  const prompt = `You are a content writer for Stiltner Landscapes in Central Ohio.

Write a newsletter for ${currentMonth}:
Topics: ${topics.join(', ')}
Theme: ${season}
${featuredProject ? `Featured project: ${featuredProject}` : ''}

Return JSON: {"subject": "<50 chars>", "preview": "<100 chars>", "body": "<markdown body>"}
Return ONLY valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');
    return JSON.parse(content.text) as NewsletterResult;
  } catch (error) {
    return {
      subject: `${season.charAt(0).toUpperCase() + season.slice(1)} Landscaping Tips`,
      preview: `Expert tips for ${season}.`,
      body: `# Newsletter\n\nContent generation unavailable.`,
    };
  }
}

export async function atomizeContent(params: AtomizeParams): Promise<AtomizeResult> {
  const { sourceContent, platforms } = params;
  const specs: Record<string, { maxChars: number }> = {
    instagram: { maxChars: 2200 }, facebook: { maxChars: 500 },
    tiktok: { maxChars: 150 }, linkedin: { maxChars: 700 }, twitter: { maxChars: 280 },
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      posts: platforms.map(p => ({
        platform: p,
        content: sourceContent.slice(0, specs[p]?.maxChars || 280),
        hashtags: ['#landscaping', '#centralohio'],
        characterCount: Math.min(sourceContent.length, specs[p]?.maxChars || 280),
      })),
    };
  }

  const anthropic = new Anthropic();
  const prompt = `Atomize this content for ${platforms.join(', ')}:

${sourceContent}

Return JSON: {"posts": [{"platform": "<name>", "content": "<text>", "hashtags": ["<tags>"], "characterCount": <num>}]}
Return ONLY valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');
    return JSON.parse(content.text) as AtomizeResult;
  } catch (error) {
    return {
      posts: platforms.map(p => ({
        platform: p,
        content: sourceContent.slice(0, specs[p]?.maxChars || 280),
        hashtags: ['#landscaping'],
        characterCount: Math.min(sourceContent.length, specs[p]?.maxChars || 280),
      })),
    };
  }
}

export async function generateEmailSequence(params: EmailSequenceParams): Promise<EmailSequenceResult> {
  const { campaignType, numEmails, audience } = params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      emails: Array.from({ length: numEmails }, (_, i) => ({
        subject: `Email ${i + 1}: ${campaignType} Series`,
        preview: `Part ${i + 1} of your ${campaignType} sequence`,
        body: `# Email ${i + 1}\n\nHello!\n\nThis is email ${i + 1}.\n\nBest,\nStiltner Landscapes`,
        delay: i === 0 ? 'Immediately' : `${i * 2} days`,
      })),
    };
  }

  const anthropic = new Anthropic();
  const prompt = `Create a ${numEmails}-email ${campaignType} sequence for: ${audience}

Return JSON: {"emails": [{"subject": "<subject>", "preview": "<preview>", "body": "<markdown>", "delay": "<timing>"}]}
Return ONLY valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');
    return JSON.parse(content.text) as EmailSequenceResult;
  } catch (error) {
    return {
      emails: Array.from({ length: numEmails }, (_, i) => ({
        subject: `Email ${i + 1}`,
        preview: `Part ${i + 1}`,
        body: `# Email ${i + 1}\n\nContent unavailable.`,
        delay: i === 0 ? 'Immediately' : `${i * 2} days`,
      })),
    };
  }
}

function getSeasonFromMonth(month: number): string {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}
