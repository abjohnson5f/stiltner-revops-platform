import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Initialize Neon serverless connection (only if env var is set)
const databaseUrl = process.env.NEON_DATABASE_URL;

// Create a no-op SQL function for when database isn't configured
const noopSql = (() => Promise.resolve([])) as unknown as NeonQueryFunction<false, false>;

export const sql: NeonQueryFunction<false, false> = databaseUrl 
  ? neon(databaseUrl) 
  : noopSql;

// Check if database is configured
export const isDatabaseConfigured = !!databaseUrl;

// Type definitions for database tables
export interface Lead {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  lead_type: string;
  status: string;
  property_address: string;
  property_city: string;
  service_interest: string;
  message: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  gclid: string;
  created_at: string;
  contacted_at: string | null;
  qualified_at: string | null;
  converted_at: string | null;
}

export interface DailyStat {
  id: string;
  stat_date: string;
  source_type: string;
  campaign_id: string | null;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpa: number;
  roas: number;
  sessions: number;
  users: number;
  bounce_rate: number;
  created_at: string;
  updated_at: string;
}

export interface CRMLink {
  id: string;
  lead_id: string;
  system_name: string;
  external_id: string;
  external_url: string;
  created_at: string;
}

// Helper types for API responses
export interface MetricsSummary {
  leadsToday: number;
  leadsThisWeek: number;
  spendToday: number;
  spendThisWeek: number;
  cplThisWeek: number;
  roasThisWeek: number;
  conversionRate: number;
}

export interface ChannelMetrics {
  name: string;
  leads: number;
  spend: number;
  cpl: number;
  percentage: number;
}

export interface TrendDataPoint {
  date: string;
  leads: number;
  spend: number;
  conversions: number;
}

export interface LeadSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  source: string;
  createdAt: string;
  status: string;
}

// Date helper functions
export function getDateRangeSQL(range: string): { startDate: string; daysBack: number } {
  const now = new Date();
  let daysBack = 7;
  
  switch (range) {
    case 'today':
      daysBack = 0;
      break;
    case '7d':
      daysBack = 7;
      break;
    case '30d':
      daysBack = 30;
      break;
    case '90d':
      daysBack = 90;
      break;
  }
  
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  
  return { startDate, daysBack };
}

// Map UTM source to channel name
export function mapSourceToChannel(utmSource: string | null): string {
  if (!utmSource) return 'direct';
  
  const source = utmSource.toLowerCase();
  if (source === 'google' || source.includes('gclid')) return 'google_ads';
  if (source === 'facebook' || source === 'instagram' || source === 'meta') return 'meta_ads';
  if (source === 'bing') return 'bing_ads';
  return 'website';
}
