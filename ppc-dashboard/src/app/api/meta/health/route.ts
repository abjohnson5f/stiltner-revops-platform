import { NextResponse } from 'next/server';

/**
 * Meta Ads API Health Check
 * 
 * Checks if the Meta Ads API credentials are configured and valid.
 */
export async function GET() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const pageId = process.env.META_PAGE_ID;

  // Check if basic credentials are configured
  if (!accessToken || !adAccountId) {
    return NextResponse.json({
      success: false,
      error: 'Meta Ads API not configured',
      configured: {
        accessToken: !!accessToken,
        adAccountId: !!adAccountId,
        pageId: !!pageId,
      },
    });
  }

  try {
    // Verify the access token by making a simple API call
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${adAccountId}?fields=name,account_status&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({
        success: false,
        error: error.error?.message || 'Failed to verify Meta API credentials',
        configured: {
          accessToken: true,
          adAccountId: true,
          pageId: !!pageId,
        },
      });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      accountName: data.name,
      accountStatus: data.account_status === 1 ? 'Active' : 'Inactive',
      configured: {
        accessToken: true,
        adAccountId: true,
        pageId: !!pageId,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to Meta API',
      configured: {
        accessToken: true,
        adAccountId: true,
        pageId: !!pageId,
      },
    });
  }
}
