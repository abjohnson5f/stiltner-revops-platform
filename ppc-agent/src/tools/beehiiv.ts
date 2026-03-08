/**
 * Beehiiv Newsletter Tools
 *
 * Manage newsletter subscribers and posts via the Beehiiv API.
 * Enables automated newsletter creation and subscriber management.
 */

import { BEEHIIV_CONFIG } from '../config/index.js';

// ============================================================
// API CLIENT
// ============================================================

interface BeehiivResponse<T> {
  data: T;
  limit?: number;
  page?: number;
  total_results?: number;
  total_pages?: number;
}

/**
 * Make an authenticated request to Beehiiv API
 */
async function beehiivRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: Record<string, unknown>;
    params?: Record<string, string | number | boolean>;
  } = {}
): Promise<T> {
  if (!BEEHIIV_CONFIG.isConfigured) {
    throw new Error('Beehiiv API key or publication ID not configured');
  }

  const { method = 'GET', body, params = {} } = options;

  const url = new URL(`${BEEHIIV_CONFIG.baseUrl}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${BEEHIIV_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Beehiiv API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

// ============================================================
// SUBSCRIBERS
// ============================================================

export interface BeehiivSubscriber {
  id: string;
  email: string;
  status: 'active' | 'inactive' | 'validating' | 'pending';
  created: number; // Unix timestamp
  subscription_tier: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referring_site?: string;
  referral_code?: string;
  custom_fields?: Array<{
    name: string;
    value: string;
  }>;
}

export interface CreateSubscriberInput {
  email: string;
  reactivate_existing?: boolean;
  send_welcome_email?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referring_site?: string;
  custom_fields?: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Add a subscriber to the newsletter
 */
export async function addSubscriber(
  input: CreateSubscriberInput
): Promise<BeehiivSubscriber> {
  const endpoint = `/publications/${BEEHIIV_CONFIG.publicationId}/subscriptions`;
  const response = await beehiivRequest<BeehiivResponse<BeehiivSubscriber>>(endpoint, {
    method: 'POST',
    body: { ...input },
  });
  return response.data;
}

/**
 * Get subscriber by email
 */
export async function getSubscriberByEmail(
  email: string
): Promise<BeehiivSubscriber | null> {
  const endpoint = `/publications/${BEEHIIV_CONFIG.publicationId}/subscriptions`;
  try {
    const response = await beehiivRequest<BeehiivResponse<BeehiivSubscriber[]>>(
      endpoint,
      { params: { email } }
    );
    return response.data[0] || null;
  } catch {
    return null;
  }
}

/**
 * Update subscriber
 */
export async function updateSubscriber(
  subscriberId: string,
  updates: {
    custom_fields?: Array<{ name: string; value: string }>;
  }
): Promise<BeehiivSubscriber> {
  const endpoint = `/publications/${BEEHIIV_CONFIG.publicationId}/subscriptions/${subscriberId}`;
  const response = await beehiivRequest<BeehiivResponse<BeehiivSubscriber>>(endpoint, {
    method: 'PATCH',
    body: updates,
  });
  return response.data;
}

/**
 * Get subscriber stats
 */
export async function getSubscriberStats(): Promise<{
  total_subscriptions: number;
  active_subscriptions: number;
  active_premium_subscriptions: number;
  free_subscriptions: number;
}> {
  const endpoint = `/publications/${BEEHIIV_CONFIG.publicationId}`;
  const response = await beehiivRequest<{
    data: {
      total_subscriptions: number;
      active_subscriptions: number;
      active_premium_subscriptions: number;
      free_subscriptions: number;
    };
  }>(endpoint);
  return response.data;
}

// ============================================================
// POSTS (Newsletter Content)
// ============================================================

export interface BeehiivPost {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  authors: string[];
  status: 'draft' | 'confirmed' | 'archived';
  publish_date?: number; // Unix timestamp
  displayed_date?: number;
  split_tested: boolean;
  subject_line: string;
  preview_text: string;
  web_url: string;
  thumbnail_url?: string;
  content_tags: string[];
  audience: 'all' | 'free' | 'premium';
  created: number;
  stats?: {
    email: {
      recipients: number;
      opens: number;
      unique_opens: number;
      open_rate: number;
      clicks: number;
      unique_clicks: number;
      click_rate: number;
    };
    web: {
      views: number;
    };
  };
}

export interface CreatePostInput {
  title: string;
  subtitle?: string;
  content: string; // HTML content
  authors?: string[];
  subject_line?: string;
  preview_text?: string;
  content_tags?: string[];
  audience?: 'all' | 'free' | 'premium';
  status?: 'draft' | 'confirmed';
  publish_date?: string; // ISO 8601 format for scheduling
}

/**
 * Create a new post (newsletter draft)
 */
export async function createPost(input: CreatePostInput): Promise<BeehiivPost> {
  const endpoint = `/publications/${BEEHIIV_CONFIG.publicationId}/posts`;
  const response = await beehiivRequest<BeehiivResponse<BeehiivPost>>(endpoint, {
    method: 'POST',
    body: {
      ...input,
      // Convert ISO date to Unix timestamp if provided
      publish_date: input.publish_date
        ? Math.floor(new Date(input.publish_date).getTime() / 1000)
        : undefined,
    } as Record<string, unknown>,
  });
  return response.data;
}

/**
 * Get a post by ID
 */
export async function getPost(postId: string): Promise<BeehiivPost> {
  const endpoint = `/publications/${BEEHIIV_CONFIG.publicationId}/posts/${postId}`;
  const response = await beehiivRequest<BeehiivResponse<BeehiivPost>>(endpoint);
  return response.data;
}

/**
 * Update a post
 */
export async function updatePost(
  postId: string,
  updates: Partial<CreatePostInput>
): Promise<BeehiivPost> {
  const endpoint = `/publications/${BEEHIIV_CONFIG.publicationId}/posts/${postId}`;
  const response = await beehiivRequest<BeehiivResponse<BeehiivPost>>(endpoint, {
    method: 'PUT',
    body: updates as Record<string, unknown>,
  });
  return response.data;
}

/**
 * List recent posts
 */
export async function listPosts(options?: {
  status?: 'draft' | 'confirmed' | 'archived';
  limit?: number;
  page?: number;
}): Promise<{ posts: BeehiivPost[]; totalPages: number }> {
  const endpoint = `/publications/${BEEHIIV_CONFIG.publicationId}/posts`;
  const response = await beehiivRequest<BeehiivResponse<BeehiivPost[]>>(endpoint, {
    params: {
      status: options?.status || 'confirmed',
      limit: options?.limit || 10,
      page: options?.page || 1,
      expand: 'stats',
    },
  });
  return {
    posts: response.data,
    totalPages: response.total_pages || 1,
  };
}

/**
 * Get post analytics
 */
export async function getPostAnalytics(
  postId: string
): Promise<BeehiivPost['stats']> {
  const post = await getPost(postId);
  return post.stats;
}

/**
 * Schedule a post for publishing
 */
export async function schedulePost(
  postId: string,
  publishDate: string // ISO 8601
): Promise<BeehiivPost> {
  return updatePost(postId, {
    publish_date: publishDate,
    status: 'confirmed',
  });
}

// ============================================================
// CONTENT TAGS
// ============================================================

export interface BeehiivContentTag {
  id: string;
  name: string;
  created: number;
}

/**
 * Get all content tags
 */
export async function getContentTags(): Promise<BeehiivContentTag[]> {
  const endpoint = `/publications/${BEEHIIV_CONFIG.publicationId}/content_tags`;
  const response = await beehiivRequest<BeehiivResponse<BeehiivContentTag[]>>(endpoint);
  return response.data;
}

// ============================================================
// TOOL DEFINITIONS FOR AGENT
// ============================================================

export const beehiivTools = {
  add_newsletter_subscriber: {
    name: 'add_newsletter_subscriber',
    description: 'Add a new subscriber to the Beehiiv newsletter',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', description: 'Subscriber email address' },
        send_welcome_email: {
          type: 'boolean',
          default: true,
          description: 'Send welcome email to new subscriber',
        },
        reactivate_existing: {
          type: 'boolean',
          default: true,
          description: 'Reactivate if subscriber was previously unsubscribed',
        },
        utm_source: { type: 'string', description: 'Attribution source' },
        utm_medium: { type: 'string', description: 'Attribution medium' },
        utm_campaign: { type: 'string', description: 'Attribution campaign' },
        custom_fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
            },
          },
          description: 'Custom field values',
        },
      },
      required: ['email'],
    },
    handler: addSubscriber,
  },

  get_subscriber_stats: {
    name: 'get_subscriber_stats',
    description: 'Get newsletter subscriber statistics',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: getSubscriberStats,
  },

  create_newsletter_post: {
    name: 'create_newsletter_post',
    description: 'Create a new newsletter post draft in Beehiiv',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Post title' },
        subtitle: { type: 'string', description: 'Post subtitle' },
        content: { type: 'string', description: 'HTML content of the newsletter' },
        subject_line: {
          type: 'string',
          description: 'Email subject line (defaults to title)',
        },
        preview_text: {
          type: 'string',
          description: 'Email preview text',
        },
        content_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Content tags for categorization',
        },
        audience: {
          type: 'string',
          enum: ['all', 'free', 'premium'],
          default: 'all',
        },
        status: {
          type: 'string',
          enum: ['draft', 'confirmed'],
          default: 'draft',
        },
        publish_date: {
          type: 'string',
          description: 'ISO 8601 date for scheduling (optional)',
        },
      },
      required: ['title', 'content'],
    },
    handler: createPost,
  },

  list_newsletter_posts: {
    name: 'list_newsletter_posts',
    description: 'List recent newsletter posts',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'confirmed', 'archived'],
          default: 'confirmed',
        },
        limit: { type: 'number', default: 10 },
        page: { type: 'number', default: 1 },
      },
      required: [],
    },
    handler: listPosts,
  },

  get_post_analytics: {
    name: 'get_post_analytics',
    description: 'Get analytics for a specific newsletter post',
    input_schema: {
      type: 'object' as const,
      properties: {
        post_id: { type: 'string', description: 'Post ID' },
      },
      required: ['post_id'],
    },
    handler: async ({ post_id }: { post_id: string }) => getPostAnalytics(post_id),
  },

  schedule_newsletter: {
    name: 'schedule_newsletter',
    description: 'Schedule a newsletter draft for publishing',
    input_schema: {
      type: 'object' as const,
      properties: {
        post_id: { type: 'string', description: 'Post ID to schedule' },
        publish_date: {
          type: 'string',
          description: 'ISO 8601 date/time to publish',
        },
      },
      required: ['post_id', 'publish_date'],
    },
    handler: async ({ post_id, publish_date }: { post_id: string; publish_date: string }) =>
      schedulePost(post_id, publish_date),
  },

  get_content_tags: {
    name: 'get_content_tags',
    description: 'Get all content tags for categorizing newsletter posts',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: getContentTags,
  },
};

export const toolDefinitions = Object.values(beehiivTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const tool of Object.values(beehiivTools)) {
  toolHandlers[tool.name] = tool.handler;
}
