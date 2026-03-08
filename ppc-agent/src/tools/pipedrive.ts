/**
 * Pipedrive CRM Tools
 *
 * Full CRM entity support: Leads, Persons, Organizations, Deals, Notes, Activities.
 * This enables the Operations Agent to sync leads from Neon to Pipedrive.
 */

import { PIPEDRIVE_CONFIG } from '../config/index.js';

// ============================================================
// API CLIENT
// ============================================================

interface PipedriveResponse<T> {
  success: boolean;
  data: T;
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
  error?: string;
  error_info?: string;
}

/**
 * Make an authenticated request to Pipedrive API
 */
async function pipedriveRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    params?: Record<string, string | number | boolean>;
  } = {}
): Promise<T> {
  if (!PIPEDRIVE_CONFIG.isConfigured) {
    throw new Error('Pipedrive API token not configured');
  }

  const { method = 'GET', body, params = {} } = options;

  // Build URL with API token
  const url = new URL(`${PIPEDRIVE_CONFIG.baseUrl}${endpoint}`);
  url.searchParams.set('api_token', PIPEDRIVE_CONFIG.apiToken!);

  // Add query params
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), fetchOptions);
  const data: PipedriveResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(
      `Pipedrive API error: ${data.error || 'Unknown error'} - ${data.error_info || ''}`
    );
  }

  return data.data;
}

// ============================================================
// LEADS (Unqualified Prospects)
// ============================================================

export interface PipedriveLead {
  id: string;
  title: string;
  person_id: number | null;
  organization_id: number | null;
  source_name: string | null;
  owner_id: number;
  label_ids: string[];
  value: { amount: number; currency: string } | null;
  expected_close_date: string | null;
  is_archived: boolean;
  was_seen: boolean;
  add_time: string;
  update_time: string;
}

export interface CreateLeadInput {
  title: string;
  person_id?: number;
  organization_id?: number;
  owner_id?: number;
  label_ids?: string[];
  value?: { amount: number; currency: string };
  expected_close_date?: string;
  visible_to?: '1' | '3' | '5' | '7'; // Owner, Owner + followers, entire company, etc.
}

/**
 * Create a new lead in Pipedrive
 */
export async function createLead(input: CreateLeadInput): Promise<PipedriveLead> {
  return pipedriveRequest<PipedriveLead>('/leads', {
    method: 'POST',
    body: { ...input },
  });
}

/**
 * Get a lead by ID
 */
export async function getLead(leadId: string): Promise<PipedriveLead> {
  return pipedriveRequest<PipedriveLead>(`/leads/${leadId}`);
}

/**
 * Update a lead
 */
export async function updateLead(
  leadId: string,
  updates: Partial<CreateLeadInput>
): Promise<PipedriveLead> {
  return pipedriveRequest<PipedriveLead>(`/leads/${leadId}`, {
    method: 'PUT',
    body: { ...updates },
  });
}

/**
 * Search leads
 */
export async function searchLeads(
  term: string,
  options?: { limit?: number }
): Promise<PipedriveLead[]> {
  interface SearchResult {
    items: Array<{ item: PipedriveLead }>;
  }
  const result = await pipedriveRequest<SearchResult>('/leads/search', {
    params: { term, limit: options?.limit || 10 },
  });
  return result.items.map((i) => i.item);
}

// ============================================================
// PERSONS (Contacts)
// ============================================================

export interface PipedrivePerson {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: Array<{ value: string; primary: boolean; label: string }>;
  phone: Array<{ value: string; primary: boolean; label: string }>;
  org_id: number | null;
  owner_id: number;
  visible_to: string;
  add_time: string;
  update_time: string;
  active_flag: boolean;
}

export interface CreatePersonInput {
  name: string;
  owner_id?: number;
  org_id?: number;
  email?: string | string[] | Array<{ value: string; primary?: boolean; label?: string }>;
  phone?: string | string[] | Array<{ value: string; primary?: boolean; label?: string }>;
  visible_to?: '1' | '3' | '5' | '7';
  marketing_status?: 'no_consent' | 'unsubscribed' | 'subscribed' | 'archived';
  // Custom fields use their API key as property name
  [key: string]: unknown;
}

/**
 * Create a new person (contact) in Pipedrive
 */
export async function createPerson(input: CreatePersonInput): Promise<PipedrivePerson> {
  return pipedriveRequest<PipedrivePerson>('/persons', {
    method: 'POST',
    body: { ...input },
  });
}

/**
 * Get a person by ID
 */
export async function getPerson(personId: number): Promise<PipedrivePerson> {
  return pipedriveRequest<PipedrivePerson>(`/persons/${personId}`);
}

/**
 * Update a person
 */
export async function updatePerson(
  personId: number,
  updates: Partial<CreatePersonInput>
): Promise<PipedrivePerson> {
  return pipedriveRequest<PipedrivePerson>(`/persons/${personId}`, {
    method: 'PUT',
    body: { ...updates },
  });
}

/**
 * Search for persons by email or phone
 */
export async function searchPersons(
  term: string,
  options?: { fields?: 'email' | 'phone' | 'name'; limit?: number }
): Promise<PipedrivePerson[]> {
  interface SearchResult {
    items: Array<{ item: PipedrivePerson }>;
  }
  const result = await pipedriveRequest<SearchResult>('/persons/search', {
    params: {
      term,
      fields: options?.fields || 'email,phone,name',
      limit: options?.limit || 10,
    },
  });
  return result.items?.map((i) => i.item) || [];
}

/**
 * Find person by exact email match
 */
export async function findPersonByEmail(email: string): Promise<PipedrivePerson | null> {
  const results = await searchPersons(email, { fields: 'email', limit: 1 });
  return results[0] || null;
}

// ============================================================
// ORGANIZATIONS (Accounts)
// ============================================================

export interface PipedriveOrganization {
  id: number;
  name: string;
  owner_id: number;
  address: string | null;
  address_street_number: string | null;
  address_route: string | null;
  address_locality: string | null; // City
  address_admin_area_level_1: string | null; // State
  address_postal_code: string | null;
  add_time: string;
  update_time: string;
  active_flag: boolean;
}

export interface CreateOrganizationInput {
  name: string;
  owner_id?: number;
  address?: string;
  visible_to?: '1' | '3' | '5' | '7';
  // Custom fields
  [key: string]: unknown;
}

/**
 * Create a new organization in Pipedrive
 */
export async function createOrganization(
  input: CreateOrganizationInput
): Promise<PipedriveOrganization> {
  return pipedriveRequest<PipedriveOrganization>('/organizations', {
    method: 'POST',
    body: { ...input },
  });
}

/**
 * Search organizations
 */
export async function searchOrganizations(
  term: string,
  options?: { limit?: number }
): Promise<PipedriveOrganization[]> {
  interface SearchResult {
    items: Array<{ item: PipedriveOrganization }>;
  }
  const result = await pipedriveRequest<SearchResult>('/organizations/search', {
    params: { term, limit: options?.limit || 10 },
  });
  return result.items?.map((i) => i.item) || [];
}

// ============================================================
// DEALS (Opportunities)
// ============================================================

export interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  person_id: number | null;
  org_id: number | null;
  stage_id: number;
  pipeline_id: number;
  status: 'open' | 'won' | 'lost' | 'deleted';
  expected_close_date: string | null;
  probability: number | null;
  lost_reason: string | null;
  won_time: string | null;
  lost_time: string | null;
  add_time: string;
  update_time: string;
  owner_id: number;
}

export interface CreateDealInput {
  title: string;
  value?: number;
  currency?: string;
  person_id?: number;
  org_id?: number;
  stage_id?: number;
  pipeline_id?: number;
  status?: 'open' | 'won' | 'lost';
  expected_close_date?: string;
  probability?: number;
  visible_to?: '1' | '3' | '5' | '7';
  // Custom fields
  [key: string]: unknown;
}

/**
 * Create a new deal in Pipedrive
 */
export async function createDeal(input: CreateDealInput): Promise<PipedriveDeal> {
  return pipedriveRequest<PipedriveDeal>('/deals', {
    method: 'POST',
    body: { ...input },
  });
}

/**
 * Get a deal by ID
 */
export async function getDeal(dealId: number): Promise<PipedriveDeal> {
  return pipedriveRequest<PipedriveDeal>(`/deals/${dealId}`);
}

/**
 * Update a deal
 */
export async function updateDeal(
  dealId: number,
  updates: Partial<CreateDealInput>
): Promise<PipedriveDeal> {
  return pipedriveRequest<PipedriveDeal>(`/deals/${dealId}`, {
    method: 'PUT',
    body: { ...updates },
  });
}

/**
 * Update deal stage
 */
export async function updateDealStage(
  dealId: number,
  stageId: number
): Promise<PipedriveDeal> {
  return updateDeal(dealId, { stage_id: stageId });
}

/**
 * Mark deal as won
 */
export async function markDealWon(dealId: number): Promise<PipedriveDeal> {
  return updateDeal(dealId, { status: 'won' });
}

/**
 * Mark deal as lost
 */
export async function markDealLost(
  dealId: number,
  lostReason?: string
): Promise<PipedriveDeal> {
  return pipedriveRequest<PipedriveDeal>(`/deals/${dealId}`, {
    method: 'PUT',
    body: {
      status: 'lost',
      ...(lostReason && { lost_reason: lostReason }),
    },
  });
}

// ============================================================
// NOTES
// ============================================================

export interface PipedriveNote {
  id: number;
  content: string;
  deal_id: number | null;
  person_id: number | null;
  org_id: number | null;
  lead_id: string | null;
  add_time: string;
  update_time: string;
  user_id: number;
  pinned_to_deal_flag: boolean;
  pinned_to_person_flag: boolean;
  pinned_to_organization_flag: boolean;
  pinned_to_lead_flag: boolean;
}

export interface CreateNoteInput {
  content: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  lead_id?: string;
  pinned_to_deal_flag?: boolean;
  pinned_to_person_flag?: boolean;
  pinned_to_organization_flag?: boolean;
  pinned_to_lead_flag?: boolean;
}

/**
 * Add a note to a deal, person, organization, or lead
 */
export async function addNote(input: CreateNoteInput): Promise<PipedriveNote> {
  return pipedriveRequest<PipedriveNote>('/notes', {
    method: 'POST',
    body: { ...input },
  });
}

// ============================================================
// ACTIVITIES
// ============================================================

export interface PipedriveActivity {
  id: number;
  type: string;
  subject: string;
  due_date: string;
  due_time: string | null;
  duration: string | null;
  deal_id: number | null;
  person_id: number | null;
  org_id: number | null;
  lead_id: string | null;
  done: boolean;
  add_time: string;
  marked_as_done_time: string | null;
}

export interface CreateActivityInput {
  subject: string;
  type: string; // 'call', 'meeting', 'task', 'deadline', 'email', 'lunch'
  due_date: string; // YYYY-MM-DD
  due_time?: string; // HH:MM
  duration?: string; // HH:MM
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  lead_id?: string;
  note?: string;
  done?: boolean;
}

/**
 * Create an activity (task, call, meeting, etc.)
 */
export async function createActivity(input: CreateActivityInput): Promise<PipedriveActivity> {
  return pipedriveRequest<PipedriveActivity>('/activities', {
    method: 'POST',
    body: { ...input },
  });
}

// ============================================================
// PIPELINES AND STAGES
// ============================================================

export interface PipedrivePipeline {
  id: number;
  name: string;
  url_title: string;
  order_nr: number;
  active: boolean;
  deal_probability: boolean;
}

export interface PipedriveStage {
  id: number;
  name: string;
  pipeline_id: number;
  order_nr: number;
  active_flag: boolean;
  deal_probability: number;
  rotten_flag: boolean;
  rotten_days: number | null;
}

/**
 * Get all pipelines
 */
export async function getPipelines(): Promise<PipedrivePipeline[]> {
  return pipedriveRequest<PipedrivePipeline[]>('/pipelines');
}

/**
 * Get stages for a pipeline
 */
export async function getStages(pipelineId?: number): Promise<PipedriveStage[]> {
  const params: Record<string, string | number> = {};
  if (pipelineId) params.pipeline_id = pipelineId;
  return pipedriveRequest<PipedriveStage[]>('/stages', { params });
}

// ============================================================
// HIGH-LEVEL SYNC FUNCTION
// ============================================================

export interface SyncLeadToPipedriveInput {
  neonLeadId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  propertyAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  serviceInterest?: string;
  message?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  gclid?: string;
}

export interface SyncLeadResult {
  success: boolean;
  personId?: number;
  dealId?: number;
  noteId?: number;
  error?: string;
}

/**
 * Sync a lead from Neon to Pipedrive
 * Creates Person + Deal + Note with attribution
 */
export async function syncLeadToPipedrive(
  input: SyncLeadToPipedriveInput
): Promise<SyncLeadResult> {
  try {
    // 1. Check if person already exists by email
    let person = await findPersonByEmail(input.email);

    // 2. Create person if not exists
    if (!person) {
      const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ') ||
        input.email.split('@')[0];

      person = await createPerson({
        name: fullName,
        email: [{ value: input.email, primary: true, label: 'work' }],
        ...(input.phone && {
          phone: [{ value: input.phone, primary: true, label: 'mobile' }],
        }),
      });
    }

    // 3. Create deal linked to person
    const dealTitle = input.serviceInterest
      ? `${input.serviceInterest} - ${input.firstName || 'Lead'}`
      : `New Lead - ${input.firstName || input.email}`;

    const deal = await createDeal({
      title: dealTitle,
      person_id: person.id,
      // Custom fields would be added here with their API keys
      // e.g., 'abc123_property_address': input.propertyAddress
    });

    // 4. Create note with full lead details
    const noteLines: string[] = [];

    if (input.propertyAddress) {
      noteLines.push(`📍 **Property Address:**`);
      noteLines.push(input.propertyAddress);
      if (input.city || input.state || input.zip) {
        noteLines.push(`${input.city || ''}, ${input.state || 'OH'} ${input.zip || ''}`);
      }
      noteLines.push('');
    }

    if (input.message) {
      noteLines.push(`💬 **Message:**`);
      noteLines.push(input.message);
      noteLines.push('');
    }

    noteLines.push(`📊 **Attribution:**`);
    noteLines.push(`- Source: ${input.utmSource || 'Direct'}`);
    if (input.utmMedium) noteLines.push(`- Medium: ${input.utmMedium}`);
    if (input.utmCampaign) noteLines.push(`- Campaign: ${input.utmCampaign}`);
    if (input.gclid) noteLines.push(`- Google Click ID: ${input.gclid}`);

    noteLines.push('');
    noteLines.push(`🔗 **Neon Lead ID:** ${input.neonLeadId}`);

    const note = await addNote({
      content: noteLines.join('\n'),
      deal_id: deal.id,
      person_id: person.id,
      pinned_to_deal_flag: true,
    });

    return {
      success: true,
      personId: person.id,
      dealId: deal.id,
      noteId: note.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// TOOL DEFINITIONS FOR AGENT
// ============================================================

export const pipedriveTools = {
  search_person: {
    name: 'search_person',
    description: 'Search for a person (contact) in Pipedrive by email, phone, or name',
    input_schema: {
      type: 'object' as const,
      properties: {
        term: { type: 'string', description: 'Search term (email, phone, or name)' },
        fields: {
          type: 'string',
          enum: ['email', 'phone', 'name'],
          description: 'Field to search in',
        },
        limit: { type: 'number', default: 10 },
      },
      required: ['term'],
    },
    handler: async ({
      term,
      fields,
      limit,
    }: {
      term: string;
      fields?: 'email' | 'phone' | 'name';
      limit?: number;
    }) => searchPersons(term, { fields, limit }),
  },

  create_person: {
    name: 'create_person',
    description: 'Create a new person (contact) in Pipedrive',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Full name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        org_id: { type: 'number', description: 'Organization ID to link to' },
      },
      required: ['name'],
    },
    handler: async ({
      name,
      email,
      phone,
      org_id,
    }: {
      name: string;
      email?: string;
      phone?: string;
      org_id?: number;
    }) => {
      const input: CreatePersonInput = { name };
      if (email) input.email = [{ value: email, primary: true, label: 'work' }];
      if (phone) input.phone = [{ value: phone, primary: true, label: 'mobile' }];
      if (org_id) input.org_id = org_id;
      return createPerson(input);
    },
  },

  create_deal: {
    name: 'create_deal',
    description: 'Create a new deal (opportunity) in Pipedrive',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Deal title' },
        person_id: { type: 'number', description: 'Person ID to link to' },
        org_id: { type: 'number', description: 'Organization ID to link to' },
        value: { type: 'number', description: 'Deal value' },
        currency: { type: 'string', default: 'USD' },
        stage_id: { type: 'number', description: 'Pipeline stage ID' },
      },
      required: ['title'],
    },
    handler: createDeal,
  },

  update_deal_stage: {
    name: 'update_deal_stage',
    description: 'Move a deal to a different pipeline stage',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'number', description: 'Deal ID' },
        stage_id: { type: 'number', description: 'New stage ID' },
      },
      required: ['deal_id', 'stage_id'],
    },
    handler: async ({ deal_id, stage_id }: { deal_id: number; stage_id: number }) =>
      updateDealStage(deal_id, stage_id),
  },

  mark_deal_won: {
    name: 'mark_deal_won',
    description: 'Mark a deal as won',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'number', description: 'Deal ID' },
      },
      required: ['deal_id'],
    },
    handler: async ({ deal_id }: { deal_id: number }) => markDealWon(deal_id),
  },

  mark_deal_lost: {
    name: 'mark_deal_lost',
    description: 'Mark a deal as lost',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'number', description: 'Deal ID' },
        lost_reason: { type: 'string', description: 'Reason the deal was lost' },
      },
      required: ['deal_id'],
    },
    handler: async ({ deal_id, lost_reason }: { deal_id: number; lost_reason?: string }) =>
      markDealLost(deal_id, lost_reason),
  },

  add_note: {
    name: 'add_note',
    description: 'Add a note to a deal, person, or organization',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'Note content' },
        deal_id: { type: 'number' },
        person_id: { type: 'number' },
        org_id: { type: 'number' },
        pinned: { type: 'boolean', default: false },
      },
      required: ['content'],
    },
    handler: async ({
      content,
      deal_id,
      person_id,
      org_id,
      pinned,
    }: {
      content: string;
      deal_id?: number;
      person_id?: number;
      org_id?: number;
      pinned?: boolean;
    }) =>
      addNote({
        content,
        deal_id,
        person_id,
        org_id,
        pinned_to_deal_flag: pinned && !!deal_id,
        pinned_to_person_flag: pinned && !!person_id,
        pinned_to_organization_flag: pinned && !!org_id,
      }),
  },

  create_activity: {
    name: 'create_activity',
    description: 'Create a task, call, meeting, or other activity',
    input_schema: {
      type: 'object' as const,
      properties: {
        subject: { type: 'string', description: 'Activity subject' },
        type: {
          type: 'string',
          enum: ['call', 'meeting', 'task', 'deadline', 'email', 'lunch'],
          description: 'Activity type',
        },
        due_date: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
        due_time: { type: 'string', description: 'Due time (HH:MM)' },
        deal_id: { type: 'number' },
        person_id: { type: 'number' },
        note: { type: 'string' },
      },
      required: ['subject', 'type', 'due_date'],
    },
    handler: createActivity,
  },

  get_pipelines: {
    name: 'get_pipelines',
    description: 'Get all pipelines and their stages',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: async () => {
      const pipelines = await getPipelines();
      const stages = await getStages();
      return {
        pipelines,
        stages: stages.reduce(
          (acc, stage) => {
            if (!acc[stage.pipeline_id]) acc[stage.pipeline_id] = [];
            acc[stage.pipeline_id].push(stage);
            return acc;
          },
          {} as Record<number, PipedriveStage[]>
        ),
      };
    },
  },

  sync_lead_to_pipedrive: {
    name: 'sync_lead_to_pipedrive',
    description:
      'Sync a lead from Neon database to Pipedrive (creates Person + Deal + Note)',
    input_schema: {
      type: 'object' as const,
      properties: {
        neon_lead_id: { type: 'string', description: 'Lead ID from Neon database' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        property_address: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        zip: { type: 'string' },
        service_interest: { type: 'string' },
        message: { type: 'string' },
        utm_source: { type: 'string' },
        utm_medium: { type: 'string' },
        utm_campaign: { type: 'string' },
        gclid: { type: 'string' },
      },
      required: ['neon_lead_id', 'email'],
    },
    handler: async (args: {
      neon_lead_id: string;
      first_name?: string;
      last_name?: string;
      email: string;
      phone?: string;
      property_address?: string;
      city?: string;
      state?: string;
      zip?: string;
      service_interest?: string;
      message?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      gclid?: string;
    }) =>
      syncLeadToPipedrive({
        neonLeadId: args.neon_lead_id,
        firstName: args.first_name,
        lastName: args.last_name,
        email: args.email,
        phone: args.phone,
        propertyAddress: args.property_address,
        city: args.city,
        state: args.state,
        zip: args.zip,
        serviceInterest: args.service_interest,
        message: args.message,
        utmSource: args.utm_source,
        utmMedium: args.utm_medium,
        utmCampaign: args.utm_campaign,
        gclid: args.gclid,
      }),
  },
};

export const toolDefinitions = Object.values(pipedriveTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const tool of Object.values(pipedriveTools)) {
  toolHandlers[tool.name] = tool.handler;
}
