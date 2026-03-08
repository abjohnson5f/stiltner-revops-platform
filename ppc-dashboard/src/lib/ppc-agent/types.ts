// PPC Agent Types

// Health Check Types
export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  type: string;
  message: string;
  recommendation: string;
  impact?: string;
  resource?: {
    type: string;
    id: string;
    name: string;
  };
}

export interface CampaignHealth {
  id: string;
  name: string;
  status: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  score: number;
  issues: HealthIssue[];
}

export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  score: number;
  issues: HealthIssue[];
  recommendations: string[];
  campaigns: CampaignHealth[];
  wastedSpend: number;
  timestamp: string;
}

// Campaign Builder Types
export interface KeywordData {
  text: string;
  matchType: 'BROAD' | 'PHRASE' | 'EXACT';
  bid?: number;
}

export interface KeywordGroup {
  name: string;
  keywords: KeywordData[];
}

export interface AdCopy {
  headlines: string[];
  descriptions: string[];
  path1?: string;
  path2?: string;
  finalUrl: string;
}

export interface AdGroup {
  name: string;
  keywords: KeywordGroup;
  ads: AdCopy[];
}

export interface CampaignPlan {
  name: string;
  budget: number;
  targetLocations: string[];
  keywords: KeywordGroup[];
  adGroups: AdGroup[];
  negativeKeywords: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CampaignCreateParams {
  description: string;
  businessInfo?: {
    name?: string;
    services?: string[];
    locations?: string[];
    targetAudience?: string;
  };
  dryRun?: boolean;
}

// Content Generation Types
export interface NewsletterParams {
  topics: string[];
  seasonalTheme?: 'spring' | 'summer' | 'fall' | 'winter';
  featuredProject?: string;
}

export interface NewsletterResult {
  subject: string;
  preview: string;
  body: string;
}

export interface AtomizeParams {
  sourceContent: string;
  platforms: ('instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'twitter')[];
}

export interface SocialPost {
  platform: string;
  content: string;
  hashtags: string[];
  characterCount: number;
}

export interface AtomizeResult {
  posts: SocialPost[];
}

export interface EmailSequenceParams {
  campaignType: 'welcome' | 'nurture' | 'promotional';
  numEmails: 3 | 5 | 7;
  audience: string;
}

export interface EmailContent {
  subject: string;
  preview: string;
  body: string;
  delay: string;
}

export interface EmailSequenceResult {
  emails: EmailContent[];
}

// Insights Types
export interface MetricsContext {
  leadsToday: number;
  leadsYesterday: number;
  spendToday: number;
  spendYesterday: number;
  cplThisWeek: number;
  cplLastWeek: number;
  channels: { name: string; leads: number; spend: number }[];
}

export type InsightContext = 'homepage_summary' | 'attribution_analysis' | 'lead_pipeline';

// MCP Bridge Types
export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
}
