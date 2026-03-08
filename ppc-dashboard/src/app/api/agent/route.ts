import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  runHealthCheck,
  createCampaign,
  generateInsights,
  generateNewsletter,
  atomizeContent,
  generateEmailSequence,
} from '@/lib/ppc-agent';
import { generateCampaignAds } from '@/lib/ad-generator';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action required' },
        { status: 400 }
      );
    }

    // Handle actions directly using embedded agent SDK
    switch (action) {
      case 'health-check': {
        const result = await runHealthCheck(params?.customerId);
        return NextResponse.json({ 
          success: true, 
          data: result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'create-campaign': {
        const result = await createCampaign(params);
        return NextResponse.json({ 
          success: true, 
          data: result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'insights': {
        const result = await generateInsights(params.metrics, params.context);
        return NextResponse.json({ 
          success: true, 
          data: result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'newsletter': {
        const result = await generateNewsletter(params);
        return NextResponse.json({ 
          success: true, 
          data: result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'atomize': {
        const result = await atomizeContent(params);
        return NextResponse.json({ 
          success: true, 
          data: result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'email-sequence': {
        const result = await generateEmailSequence(params);
        return NextResponse.json({ 
          success: true, 
          data: result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'generate-campaign-ads': {
        const context = body.context;
        if (!context || !context.service || !context.locations) {
          return NextResponse.json(
            { success: false, error: 'Campaign context with service and locations required' },
            { status: 400 }
          );
        }
        const result = await generateCampaignAds(context);
        return NextResponse.json({ 
          success: true, 
          data: result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'keyword-research': {
        // Forward to the dedicated research endpoint
        const { keywords, location } = params || {};
        const service = Array.isArray(keywords) ? keywords.join(', ') : keywords || '';
        const locations = location ? [location] : ['Columbus, Ohio'];

        const { researchKeywords } = await import('@/lib/dataforseo');
        const result = await researchKeywords(service, locations);
        return NextResponse.json({
          success: true,
          data: { response: `## Keyword Research Results\n\n${JSON.stringify(result, null, 2)}` },
          timestamp: new Date().toISOString(),
        });
      }

      case 'competitor-analysis': {
        const { competitors } = params || {};
        const service = Array.isArray(competitors) ? competitors.join(', ') : competitors || 'landscaping';
        const locations = ['Columbus, Ohio'];

        const { getCompetitorIntelligence } = await import('@/lib/apify');
        const result = await getCompetitorIntelligence(service, locations);
        return NextResponse.json({
          success: true,
          data: { response: `## Competitor Analysis\n\n${JSON.stringify(result, null, 2)}` },
          timestamp: new Date().toISOString(),
        });
      }

      case 'custom': {
        const query = params?.query || '';
        if (!query) {
          return NextResponse.json({
            success: true,
            data: { response: 'Please ask me a question about your PPC campaigns, marketing strategy, or anything related to Stiltner Landscapes.' },
            timestamp: new Date().toISOString(),
          });
        }

        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicKey) {
          return NextResponse.json({
            success: true,
            data: { response: 'AI chat requires an Anthropic API key. Please configure ANTHROPIC_API_KEY in your environment.' },
            timestamp: new Date().toISOString(),
          });
        }

        try {
          const anthropic = new Anthropic({ apiKey: anthropicKey });
          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            system: `You are the PPC Intelligence Agent for Stiltner Landscapes & Co., a landscaping company in Central Ohio (Columbus, Gahanna, Westerville area).

You help with:
- Google Ads campaign strategy and optimization
- Meta/Facebook Ads creative and targeting
- Keyword research and competitor analysis
- Marketing performance analysis
- Campaign creation recommendations
- Budget allocation advice

You have access to real Google Ads data, DataForSEO keyword research, and Apify competitor intelligence.
Be concise, actionable, and data-driven. Use markdown formatting for readability.
When you don't have specific data, give strategic advice based on local service business best practices.`,
            messages: [{ role: 'user', content: query }],
          });

          const textContent = message.content.find(c => c.type === 'text');
          return NextResponse.json({
            success: true,
            data: { response: textContent?.type === 'text' ? textContent.text : 'No response generated.' },
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Claude chat error:', error);
          return NextResponse.json({
            success: true,
            data: { response: `I encountered an error processing your request. Please try again or use specific actions like "health-check" or "create-campaign".` },
            timestamp: new Date().toISOString(),
          });
        }
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({
    status: 'online',
    version: '2.1.0',
    features: ['health-check', 'create-campaign', 'insights', 'newsletter', 'atomize', 'email-sequence', 'generate-campaign-ads', 'keyword-research', 'competitor-analysis', 'custom'],
    timestamp: new Date().toISOString(),
  });
}
