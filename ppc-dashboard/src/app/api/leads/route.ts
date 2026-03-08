import { NextRequest, NextResponse } from 'next/server';
import { sql, isDatabaseConfigured } from '@/lib/db';

// Mock leads for demo mode
const mockLeads: LeadResponse[] = [
  { id: 'demo-1', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah@example.com', phone: '614-555-0123', propertyAddress: '123 Oak St', city: 'Dublin', service: 'Landscape Design', message: 'Looking to redesign my backyard with a patio area.', status: 'new', source: 'google', medium: 'cpc', campaign: 'landscape_design', gclid: 'abc123', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), contactedAt: null, qualifiedAt: null, convertedAt: null, pipedriveUrl: null },
  { id: 'demo-2', firstName: 'Mike', lastName: 'Thompson', email: 'mike@example.com', phone: '614-555-0456', propertyAddress: '456 Maple Ave', city: 'Powell', service: 'Lawn Care', message: 'Need weekly lawn maintenance starting in spring.', status: 'contacted', source: 'website', medium: 'organic', campaign: '', gclid: '', createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), contactedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), qualifiedAt: null, convertedAt: null, pipedriveUrl: null },
  { id: 'demo-3', firstName: 'Jennifer', lastName: 'Lee', email: 'jennifer@example.com', phone: '614-555-0789', propertyAddress: '789 Pine Rd', city: 'New Albany', service: 'Hardscaping', message: 'Want a quote for a new stone patio and fire pit.', status: 'qualified', source: 'google', medium: 'cpc', campaign: 'hardscaping', gclid: 'def456', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), contactedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), qualifiedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), convertedAt: null, pipedriveUrl: 'https://pipedrive.com/deal/123' },
  { id: 'demo-4', firstName: 'David', lastName: 'Wilson', email: 'david@example.com', phone: '614-555-0321', propertyAddress: '321 Elm Blvd', city: 'Galena', service: 'Spring Cleanup', message: 'Need spring cleanup and mulching for front and back yards.', status: 'quoted', source: 'direct', medium: '', campaign: '', gclid: '', createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), contactedAt: new Date(Date.now() - 44 * 60 * 60 * 1000).toISOString(), qualifiedAt: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(), convertedAt: null, pipedriveUrl: 'https://pipedrive.com/deal/124' },
  { id: 'demo-5', firstName: 'Amanda', lastName: 'Brown', email: 'amanda@example.com', phone: '614-555-0654', propertyAddress: '654 Birch Ln', city: 'Dublin', service: 'Patio Installation', message: 'Beautiful paver patio with lighting installed last month!', status: 'won', source: 'meta', medium: 'cpc', campaign: 'patios', gclid: '', createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), contactedAt: new Date(Date.now() - 68 * 60 * 60 * 1000).toISOString(), qualifiedAt: new Date(Date.now() - 60 * 60 * 60 * 1000).toISOString(), convertedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), pipedriveUrl: 'https://pipedrive.com/deal/125' },
  { id: 'demo-6', firstName: 'Robert', lastName: 'Garcia', email: 'robert@example.com', phone: '614-555-0987', propertyAddress: '987 Cedar Ct', city: 'Powell', service: 'Landscape Design', message: 'Interested in a complete front yard renovation.', status: 'new', source: 'google', medium: 'cpc', campaign: 'landscape_design', gclid: 'ghi789', createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), contactedAt: null, qualifiedAt: null, convertedAt: null, pipedriveUrl: null },
];

interface LeadResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  propertyAddress: string;
  city: string;
  service: string;
  message: string;
  status: string;
  source: string;
  medium: string;
  campaign: string;
  gclid: string;
  createdAt: string;
  contactedAt: string | null;
  qualifiedAt: string | null;
  convertedAt: string | null;
  pipedriveUrl: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Return mock data if database isn't configured
    if (!isDatabaseConfigured) {
      let filteredLeads = [...mockLeads];
      if (status) {
        filteredLeads = filteredLeads.filter(l => l.status === status);
      }
      if (source) {
        filteredLeads = filteredLeads.filter(l => l.source === source);
      }
      return NextResponse.json({
        success: true,
        data: {
          leads: filteredLeads.slice(offset, offset + limit),
          total: filteredLeads.length,
          pagination: {
            limit,
            offset,
            hasMore: offset + limit < filteredLeads.length,
          },
        },
        meta: { isDemo: true },
      });
    }

    // Use separate queries based on filters for type safety
    let leads;
    let total;

    if (status && source) {
      // Filter by both status and source
      leads = await sql`
        SELECT 
          l.id, l.first_name, l.last_name, l.email, l.phone,
          l.property_address, l.property_city, l.service_interest,
          l.message, l.status, l.utm_source, l.utm_medium, l.utm_campaign,
          l.gclid, l.created_at, l.contacted_at, l.qualified_at, l.converted_at
        FROM leads l
        WHERE l.deleted_at IS NULL
          AND l.status = ${status}
          AND l.utm_source = ${source}
        ORDER BY l.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM leads 
        WHERE deleted_at IS NULL AND status = ${status} AND utm_source = ${source}
      `;
      total = parseInt(countResult[0]?.total || '0');
    } else if (status) {
      // Filter by status only
      leads = await sql`
        SELECT 
          l.id, l.first_name, l.last_name, l.email, l.phone,
          l.property_address, l.property_city, l.service_interest,
          l.message, l.status, l.utm_source, l.utm_medium, l.utm_campaign,
          l.gclid, l.created_at, l.contacted_at, l.qualified_at, l.converted_at
        FROM leads l
        WHERE l.deleted_at IS NULL AND l.status = ${status}
        ORDER BY l.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM leads WHERE deleted_at IS NULL AND status = ${status}
      `;
      total = parseInt(countResult[0]?.total || '0');
    } else if (source) {
      // Filter by source only
      leads = await sql`
        SELECT 
          l.id, l.first_name, l.last_name, l.email, l.phone,
          l.property_address, l.property_city, l.service_interest,
          l.message, l.status, l.utm_source, l.utm_medium, l.utm_campaign,
          l.gclid, l.created_at, l.contacted_at, l.qualified_at, l.converted_at
        FROM leads l
        WHERE l.deleted_at IS NULL AND l.utm_source = ${source}
        ORDER BY l.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM leads WHERE deleted_at IS NULL AND utm_source = ${source}
      `;
      total = parseInt(countResult[0]?.total || '0');
    } else {
      // No filters
      leads = await sql`
        SELECT 
          l.id, l.first_name, l.last_name, l.email, l.phone,
          l.property_address, l.property_city, l.service_interest,
          l.message, l.status, l.utm_source, l.utm_medium, l.utm_campaign,
          l.gclid, l.created_at, l.contacted_at, l.qualified_at, l.converted_at
        FROM leads l
        WHERE l.deleted_at IS NULL
        ORDER BY l.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM leads WHERE deleted_at IS NULL
      `;
      total = parseInt(countResult[0]?.total || '0');
    }

    // Format response
    const formattedLeads: LeadResponse[] = (leads as any[]).map(l => ({
      id: l.id,
      firstName: l.first_name || '',
      lastName: l.last_name || '',
      email: l.email,
      phone: l.phone || '',
      propertyAddress: l.property_address || '',
      city: l.property_city || '',
      service: l.service_interest || '',
      message: l.message || '',
      status: l.status,
      source: l.utm_source || '',
      medium: l.utm_medium || '',
      campaign: l.utm_campaign || '',
      gclid: l.gclid || '',
      createdAt: l.created_at,
      contactedAt: l.contacted_at,
      qualifiedAt: l.qualified_at,
      convertedAt: l.converted_at,
      pipedriveUrl: null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        leads: formattedLeads,
        total,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });

  } catch (error) {
    console.error('Leads API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch leads' 
      },
      { status: 500 }
    );
  }
}

// Update lead status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, contactedAt, qualifiedAt, convertedAt } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Lead ID required' },
        { status: 400 }
      );
    }

    // Update the lead with provided fields
    const result = await sql`
      UPDATE leads
      SET 
        status = COALESCE(${status || null}, status),
        contacted_at = COALESCE(${contactedAt || null}::timestamptz, contacted_at),
        qualified_at = COALESCE(${qualifiedAt || null}::timestamptz, qualified_at),
        converted_at = COALESCE(${convertedAt || null}::timestamptz, converted_at),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });

  } catch (error) {
    console.error('Lead Update Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update lead' 
      },
      { status: 500 }
    );
  }
}
