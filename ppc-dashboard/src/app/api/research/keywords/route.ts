import { NextRequest, NextResponse } from 'next/server';
import { researchKeywords, isDataForSEOConfigured } from '@/lib/dataforseo';

export async function POST(request: NextRequest) {
  try {
    const { service, locations } = await request.json();

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service is required' },
        { status: 400 }
      );
    }

    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one location is required' },
        { status: 400 }
      );
    }

    const result = await researchKeywords(service, locations);

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        service,
        locations,
        isLiveData: isDataForSEOConfigured(),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Keyword research error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Research failed',
      },
      { status: 500 }
    );
  }
}

// Also support GET for simple queries
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get('service');
  const locationsParam = searchParams.get('locations');

  if (!service || !locationsParam) {
    return NextResponse.json(
      { success: false, error: 'service and locations query params required' },
      { status: 400 }
    );
  }

  const locations = locationsParam.split(',').map(l => l.trim());

  try {
    const result = await researchKeywords(service, locations);

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        service,
        locations,
        isLiveData: isDataForSEOConfigured(),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Keyword research error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Research failed',
      },
      { status: 500 }
    );
  }
}
