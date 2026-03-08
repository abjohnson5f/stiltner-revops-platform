import { NextRequest, NextResponse } from 'next/server';
import { createCampaign, isGoogleAdsConfigured } from '@/lib/google-ads';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, name, budget, keywords, headlines, descriptions, finalUrl } = body;

    if (!platform) {
      return NextResponse.json(
        { success: false, error: 'Platform is required' },
        { status: 400 }
      );
    }

    if (platform === 'google') {
      // Check if Google Ads is configured
      if (!isGoogleAdsConfigured()) {
        return NextResponse.json({
          success: false,
          error: 'Google Ads API not configured. Please add credentials to .env.local',
          manual: true,
        });
      }

      // Validate required fields
      if (!name || !budget || !keywords?.length || !headlines?.length || !descriptions?.length) {
        return NextResponse.json(
          { success: false, error: 'Missing required campaign data' },
          { status: 400 }
        );
      }

      // Create the campaign
      const result = await createCampaign({
        name,
        budget,
        keywords,
        headlines,
        descriptions,
        finalUrl: finalUrl || 'https://stiltnerlandscapes.com/contact',
      });

      return NextResponse.json({
        success: result.success,
        campaignId: result.campaignId,
        error: result.error,
        message: result.success 
          ? `Campaign "${name}" created successfully in PAUSED state`
          : result.error,
      });
    }

    if (platform === 'meta') {
      const { isMetaConfigured, createFullMetaCampaign } = await import('@/lib/meta-ads');

      if (!isMetaConfigured()) {
        return NextResponse.json({
          success: false,
          manual: true,
          message: 'Meta Ads API not configured. Use manual creation with the export instructions.',
        });
      }

      // Validate required fields
      if (!name || !budget || !headlines?.length || !descriptions?.length) {
        return NextResponse.json(
          { success: false, error: 'Missing required campaign data' },
          { status: 400 }
        );
      }

      const result = await createFullMetaCampaign({
        name,
        budget,
        headlines,
        descriptions,
        locations: body.locations,
        targeting: body.targeting,
      });

      return NextResponse.json({
        success: result.success,
        campaignId: result.campaignId,
        adSetId: result.adSetId,
        error: result.error,
        message: result.success
          ? `Meta campaign "${name}" created successfully in PAUSED state (Campaign: ${result.campaignId})`
          : result.error,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown platform: ${platform}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Campaign creation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create campaign',
      },
      { status: 500 }
    );
  }
}
