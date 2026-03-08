/**
 * Neon Database Tools
 *
 * Direct database operations for leads, events, and outbox queue processing.
 * This enables the Operations Agent to process the outbox queue that drives
 * Pipedrive sync, G-Chat notifications, and other integrations.
 */

import { NEON_CONFIG } from '../config/index.js';

// ============================================================
// DATABASE CLIENT (using native pg via fetch for Neon HTTP)
// ============================================================

interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

/**
 * Execute a SQL query against Neon using the HTTP API
 * This avoids needing to install pg package - uses Neon's HTTP endpoint
 */
async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  if (!NEON_CONFIG.connectionString) {
    throw new Error('NEON_DATABASE_URL is not configured');
  }

  // Parse the connection string to get the HTTP endpoint
  const url = new URL(NEON_CONFIG.connectionString);
  const httpEndpoint = `https://${url.hostname}/sql`;

  // Extract credentials
  const username = url.username;
  const password = url.password;
  const database = url.pathname.slice(1); // Remove leading /

  const response = await fetch(httpEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': NEON_CONFIG.connectionString,
    },
    body: JSON.stringify({
      query: sql,
      params,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Neon query failed: ${error}`);
  }

  const result = await response.json();

  // Neon HTTP API returns { rows: [...], rowCount: n }
  return {
    rows: result.rows || [],
    rowCount: result.rowCount || result.rows?.length || 0,
  };
}

// ============================================================
// LEAD OPERATIONS
// ============================================================

export interface Lead {
  id: string;
  email: string;
  email_normalized: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_e164: string | null;
  lead_type: string;
  status: string;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  service_interest: string | null;
  message: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  gclid: string | null;
  created_at: string;
  updated_at: string;
  contacted_at?: string | null;
  qualified_at?: string | null;
  converted_at?: string | null;
}

export interface LeadFilters {
  status?: string;
  lead_type?: string;
  service_interest?: string;
  city?: string;
  since?: string; // ISO date string
  limit?: number;
}

/**
 * Query leads with filters
 */
export async function queryLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.lead_type) {
    conditions.push(`lead_type = $${paramIndex++}`);
    params.push(filters.lead_type);
  }

  if (filters.service_interest) {
    conditions.push(`service_interest = $${paramIndex++}`);
    params.push(filters.service_interest);
  }

  if (filters.city) {
    conditions.push(`property_city ILIKE $${paramIndex++}`);
    params.push(`%${filters.city}%`);
  }

  if (filters.since) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.since);
  }

  const limit = filters.limit || 100;

  const sql = `
    SELECT * FROM leads
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  const result = await query<Lead>(sql, params);
  return result.rows;
}

/**
 * Get a single lead by ID
 */
export async function getLeadById(leadId: string): Promise<Lead | null> {
  const result = await query<Lead>(
    'SELECT * FROM leads WHERE id = $1 AND deleted_at IS NULL',
    [leadId]
  );
  return result.rows[0] || null;
}

/**
 * Update lead status
 */
export async function updateLeadStatus(
  leadId: string,
  status: string,
  additionalFields?: Partial<Pick<Lead, 'contacted_at' | 'qualified_at' | 'converted_at'>>
): Promise<Lead | null> {
  const updates = ['status = $2', 'updated_at = NOW()'];
  const params: unknown[] = [leadId, status];
  let paramIndex = 3;

  if (additionalFields?.contacted_at) {
    updates.push(`contacted_at = $${paramIndex++}`);
    params.push(additionalFields.contacted_at);
  }
  if (additionalFields?.qualified_at) {
    updates.push(`qualified_at = $${paramIndex++}`);
    params.push(additionalFields.qualified_at);
  }
  if (additionalFields?.converted_at) {
    updates.push(`converted_at = $${paramIndex++}`);
    params.push(additionalFields.converted_at);
  }

  const sql = `
    UPDATE leads
    SET ${updates.join(', ')}
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
  `;

  const result = await query<Lead>(sql, params);
  return result.rows[0] || null;
}

// ============================================================
// OUTBOX OPERATIONS
// ============================================================

export interface OutboxMessage {
  id: string;
  message_type: string;
  lead_id: string | null;
  event_id: string | null;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface ClaimOptions {
  workerId: string;
  messageTypes: string[];
  batchSize?: number;
  lockDurationMinutes?: number;
}

/**
 * Claim messages from the outbox for processing
 * Uses Postgres function with row-level locking
 */
export async function claimOutboxMessages(options: ClaimOptions): Promise<OutboxMessage[]> {
  const { workerId, messageTypes, batchSize = 10, lockDurationMinutes = 5 } = options;

  // Use the Postgres function defined in the schema
  const sql = `
    SELECT * FROM claim_outbox_messages($1, $2, $3, $4)
  `;

  const result = await query<OutboxMessage>(sql, [
    workerId,
    messageTypes,
    batchSize,
    `${lockDurationMinutes} minutes`,
  ]);

  return result.rows;
}

/**
 * Mark an outbox message as completed
 */
export async function completeOutboxMessage(messageId: string): Promise<void> {
  await query(
    `
    UPDATE outbox
    SET status = 'completed',
        processed_at = NOW(),
        locked_by = NULL,
        locked_at = NULL,
        lock_expires_at = NULL
    WHERE id = $1
  `,
    [messageId]
  );
}

/**
 * Mark an outbox message as failed with error details
 * Implements exponential backoff: 5min, 10min, 20min, 40min, 80min
 */
export async function failOutboxMessage(
  messageId: string,
  error: string
): Promise<void> {
  await query(
    `
    UPDATE outbox
    SET status = CASE
          WHEN attempts >= max_attempts THEN 'dead_letter'
          ELSE 'failed'
        END,
        last_error = $2,
        last_error_at = NOW(),
        next_retry_at = NOW() + (POWER(2, attempts) * INTERVAL '5 minutes'),
        locked_by = NULL,
        locked_at = NULL,
        lock_expires_at = NULL
    WHERE id = $1
  `,
    [messageId, error]
  );
}

/**
 * Get pending outbox messages count by type
 */
export async function getOutboxStats(): Promise<
  Array<{ message_type: string; status: string; count: number }>
> {
  const result = await query<{ message_type: string; status: string; count: string }>(
    `
    SELECT message_type, status, COUNT(*)::int as count
    FROM outbox
    GROUP BY message_type, status
    ORDER BY message_type, status
  `
  );

  return result.rows.map((row) => ({
    message_type: row.message_type,
    status: row.status,
    count: parseInt(row.count, 10),
  }));
}

/**
 * Queue a new outbox message
 */
export async function queueOutboxMessage(
  messageType: string,
  payload: Record<string, unknown>,
  options?: { leadId?: string; eventId?: string; maxAttempts?: number }
): Promise<OutboxMessage> {
  const result = await query<OutboxMessage>(
    `
    INSERT INTO outbox (message_type, lead_id, event_id, payload, max_attempts)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,
    [
      messageType,
      options?.leadId || null,
      options?.eventId || null,
      JSON.stringify(payload),
      options?.maxAttempts || 5,
    ]
  );

  return result.rows[0];
}

// ============================================================
// CRM LINKS OPERATIONS
// ============================================================

export interface CrmLink {
  id: string;
  lead_id: string;
  system_name: string;
  external_id: string;
  external_url: string | null;
  last_synced_at: string | null;
  sync_status: string;
  sync_error: string | null;
}

/**
 * Get CRM links for a lead
 */
export async function getCrmLinks(leadId: string): Promise<CrmLink[]> {
  const result = await query<CrmLink>(
    'SELECT * FROM crm_links WHERE lead_id = $1',
    [leadId]
  );
  return result.rows;
}

/**
 * Upsert a CRM link
 */
export async function upsertCrmLink(
  leadId: string,
  systemName: string,
  externalId: string,
  externalUrl?: string
): Promise<CrmLink> {
  const result = await query<CrmLink>(
    `
    INSERT INTO crm_links (lead_id, system_name, external_id, external_url, last_synced_at, sync_status)
    VALUES ($1, $2, $3, $4, NOW(), 'synced')
    ON CONFLICT (lead_id, system_name)
    DO UPDATE SET
      external_id = $3,
      external_url = $4,
      last_synced_at = NOW(),
      sync_status = 'synced',
      sync_error = NULL,
      updated_at = NOW()
    RETURNING *
  `,
    [leadId, systemName, externalId, externalUrl || null]
  );

  return result.rows[0];
}

/**
 * Mark a CRM link sync as failed
 */
export async function markCrmLinkError(
  leadId: string,
  systemName: string,
  error: string
): Promise<void> {
  await query(
    `
    UPDATE crm_links
    SET sync_status = 'error',
        sync_error = $3,
        updated_at = NOW()
    WHERE lead_id = $1 AND system_name = $2
  `,
    [leadId, systemName, error]
  );
}

// ============================================================
// DAILY STATS OPERATIONS
// ============================================================

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
}

/**
 * Upsert daily stats
 */
export async function upsertDailyStats(stats: {
  stat_date: string;
  source_type: string;
  campaign_id?: string;
  spend?: number;
  revenue?: number;
  conversions?: number;
  impressions?: number;
  clicks?: number;
}): Promise<DailyStat> {
  const ctr = stats.impressions && stats.impressions > 0
    ? (stats.clicks || 0) / stats.impressions
    : 0;
  const cpa = stats.conversions && stats.conversions > 0
    ? (stats.spend || 0) / stats.conversions
    : 0;
  const roas = stats.spend && stats.spend > 0
    ? (stats.revenue || 0) / stats.spend
    : 0;

  const result = await query<DailyStat>(
    `
    INSERT INTO daily_stats (
      stat_date, source_type, campaign_id,
      spend, revenue, conversions, impressions, clicks,
      ctr, cpa, roas
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (stat_date, source_type, campaign_id)
    DO UPDATE SET
      spend = $4,
      revenue = $5,
      conversions = $6,
      impressions = $7,
      clicks = $8,
      ctr = $9,
      cpa = $10,
      roas = $11,
      updated_at = NOW()
    RETURNING *
  `,
    [
      stats.stat_date,
      stats.source_type,
      stats.campaign_id || null,
      stats.spend || 0,
      stats.revenue || 0,
      stats.conversions || 0,
      stats.impressions || 0,
      stats.clicks || 0,
      ctr,
      cpa,
      roas,
    ]
  );

  return result.rows[0];
}

/**
 * Get daily stats for a date range
 */
export async function getDailyStats(
  startDate: string,
  endDate: string,
  sourceType?: string
): Promise<DailyStat[]> {
  let sql = `
    SELECT * FROM daily_stats
    WHERE stat_date >= $1 AND stat_date <= $2
  `;
  const params: unknown[] = [startDate, endDate];

  if (sourceType) {
    sql += ` AND source_type = $3`;
    params.push(sourceType);
  }

  sql += ` ORDER BY stat_date DESC`;

  const result = await query<DailyStat>(sql, params);
  return result.rows;
}

// ============================================================
// TOOL DEFINITIONS FOR AGENT
// ============================================================

export const neonTools = {
  query_leads: {
    name: 'query_leads',
    description: 'Query leads from the Neon database with optional filters (status, lead_type, service_interest, city, since date)',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost', 'unsubscribed'],
          description: 'Filter by lead status',
        },
        lead_type: {
          type: 'string',
          enum: ['estimate', 'newsletter', 'contact', 'quote_request'],
          description: 'Filter by lead type',
        },
        service_interest: {
          type: 'string',
          description: 'Filter by service interest (e.g., "maintenance", "design-build")',
        },
        city: {
          type: 'string',
          description: 'Filter by city (partial match)',
        },
        since: {
          type: 'string',
          description: 'Filter leads created after this ISO date',
        },
        limit: {
          type: 'number',
          default: 100,
          description: 'Max number of leads to return',
        },
      },
      required: [],
    },
    handler: queryLeads,
  },

  get_outbox_stats: {
    name: 'get_outbox_stats',
    description: 'Get statistics about the outbox queue (pending, processing, failed messages by type)',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: async () => getOutboxStats(),
  },

  claim_outbox_messages: {
    name: 'claim_outbox_messages',
    description: 'Claim pending outbox messages for processing. Returns messages locked for this worker.',
    input_schema: {
      type: 'object' as const,
      properties: {
        worker_id: {
          type: 'string',
          description: 'Unique identifier for this worker',
        },
        message_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of messages to claim (e.g., ["lead.sync_pipedrive", "lead.notify_gchat"])',
        },
        batch_size: {
          type: 'number',
          default: 10,
          description: 'Max messages to claim',
        },
      },
      required: ['worker_id', 'message_types'],
    },
    handler: async ({
      worker_id,
      message_types,
      batch_size,
    }: {
      worker_id: string;
      message_types: string[];
      batch_size?: number;
    }) =>
      claimOutboxMessages({
        workerId: worker_id,
        messageTypes: message_types,
        batchSize: batch_size,
      }),
  },

  complete_outbox_message: {
    name: 'complete_outbox_message',
    description: 'Mark an outbox message as successfully completed',
    input_schema: {
      type: 'object' as const,
      properties: {
        message_id: {
          type: 'string',
          description: 'ID of the outbox message',
        },
      },
      required: ['message_id'],
    },
    handler: async ({ message_id }: { message_id: string }) => {
      await completeOutboxMessage(message_id);
      return { success: true, message_id };
    },
  },

  fail_outbox_message: {
    name: 'fail_outbox_message',
    description: 'Mark an outbox message as failed with error. Will be retried with exponential backoff.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message_id: {
          type: 'string',
          description: 'ID of the outbox message',
        },
        error: {
          type: 'string',
          description: 'Error message describing the failure',
        },
      },
      required: ['message_id', 'error'],
    },
    handler: async ({ message_id, error }: { message_id: string; error: string }) => {
      await failOutboxMessage(message_id, error);
      return { success: true, message_id, error };
    },
  },

  queue_outbox_message: {
    name: 'queue_outbox_message',
    description: 'Add a new message to the outbox queue for async processing',
    input_schema: {
      type: 'object' as const,
      properties: {
        message_type: {
          type: 'string',
          description: 'Type of message (e.g., "lead.sync_pipedrive", "lead.notify_gchat")',
        },
        payload: {
          type: 'object',
          description: 'Message payload data',
        },
        lead_id: {
          type: 'string',
          description: 'Optional associated lead ID',
        },
      },
      required: ['message_type', 'payload'],
    },
    handler: async ({
      message_type,
      payload,
      lead_id,
    }: {
      message_type: string;
      payload: Record<string, unknown>;
      lead_id?: string;
    }) => queueOutboxMessage(message_type, payload, { leadId: lead_id }),
  },

  get_daily_stats: {
    name: 'get_daily_stats',
    description: 'Get daily marketing stats for a date range',
    input_schema: {
      type: 'object' as const,
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
        },
        source_type: {
          type: 'string',
          enum: ['google_ads', 'meta_ads', 'website', 'aggregated'],
          description: 'Filter by source type',
        },
      },
      required: ['start_date', 'end_date'],
    },
    handler: async ({
      start_date,
      end_date,
      source_type,
    }: {
      start_date: string;
      end_date: string;
      source_type?: string;
    }) => getDailyStats(start_date, end_date, source_type),
  },

  upsert_daily_stats: {
    name: 'upsert_daily_stats',
    description: 'Insert or update daily marketing stats',
    input_schema: {
      type: 'object' as const,
      properties: {
        stat_date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
        source_type: {
          type: 'string',
          enum: ['google_ads', 'meta_ads', 'website', 'aggregated'],
        },
        campaign_id: { type: 'string' },
        spend: { type: 'number' },
        revenue: { type: 'number' },
        conversions: { type: 'number' },
        impressions: { type: 'number' },
        clicks: { type: 'number' },
      },
      required: ['stat_date', 'source_type'],
    },
    handler: upsertDailyStats,
  },
};

export const toolDefinitions = Object.values(neonTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const tool of Object.values(neonTools)) {
  toolHandlers[tool.name] = tool.handler;
}
