/**
 * Social Media Tools
 *
 * Post to Instagram, Facebook, TikTok, and YouTube.
 * Uses Meta Graph API for FB/IG, TikTok API, and YouTube Data API.
 */

import { META_CONFIG, TIKTOK_CONFIG, YOUTUBE_CONFIG } from '../config/index.js';

// ============================================================
// META (INSTAGRAM & FACEBOOK)
// ============================================================

interface MetaResponse<T> {
  data?: T;
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

/**
 * Make a request to Meta Graph API
 */
async function metaRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    params?: Record<string, string | number | boolean>;
  } = {}
): Promise<T> {
  if (!META_CONFIG.isConfigured) {
    throw new Error('Meta API not configured');
  }

  const { method = 'GET', body, params = {} } = options;

  const url = new URL(`${META_CONFIG.baseUrl}${endpoint}`);
  url.searchParams.set('access_token', META_CONFIG.accessToken!);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const fetchOptions: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body && method === 'POST') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), fetchOptions);
  const data: MetaResponse<T> = await response.json();

  if (data.error) {
    throw new Error(`Meta API error: ${data.error.message}`);
  }

  return (data.data || data) as T;
}

// ============================================================
// INSTAGRAM
// ============================================================

export interface InstagramMediaResult {
  id: string;
  status?: string;
}

export interface InstagramContainerResult {
  id: string;
}

/**
 * Create an Instagram media container (for images or videos)
 */
async function createInstagramContainer(
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM',
  options: {
    imageUrl?: string;
    videoUrl?: string;
    caption?: string;
    children?: string[]; // Container IDs for carousel
  }
): Promise<string> {
  const body: Record<string, unknown> = {};

  if (mediaType === 'IMAGE') {
    body.image_url = options.imageUrl;
    body.caption = options.caption;
  } else if (mediaType === 'VIDEO') {
    body.video_url = options.videoUrl;
    body.caption = options.caption;
    body.media_type = 'REELS'; // Instagram Reels
  } else if (mediaType === 'CAROUSEL_ALBUM') {
    body.media_type = 'CAROUSEL';
    body.children = options.children;
    body.caption = options.caption;
  }

  const result = await metaRequest<InstagramContainerResult>(
    `/${META_CONFIG.instagramAccountId}/media`,
    { method: 'POST', body }
  );

  return result.id;
}

/**
 * Publish an Instagram media container
 */
async function publishInstagramMedia(containerId: string): Promise<string> {
  const result = await metaRequest<InstagramMediaResult>(
    `/${META_CONFIG.instagramAccountId}/media_publish`,
    { method: 'POST', body: { creation_id: containerId } }
  );

  return result.id;
}

/**
 * Post an image to Instagram
 */
export async function postToInstagram(
  imageUrl: string,
  caption: string
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    const containerId = await createInstagramContainer('IMAGE', {
      imageUrl,
      caption,
    });

    // Wait a moment for processing
    await new Promise((r) => setTimeout(r, 3000));

    const mediaId = await publishInstagramMedia(containerId);

    return { success: true, mediaId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Post a video (Reel) to Instagram
 */
export async function postInstagramReel(
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    const containerId = await createInstagramContainer('VIDEO', {
      videoUrl,
      caption,
    });

    // Videos take longer to process
    await new Promise((r) => setTimeout(r, 10000));

    const mediaId = await publishInstagramMedia(containerId);

    return { success: true, mediaId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Post a carousel to Instagram
 */
export async function postInstagramCarousel(
  imageUrls: string[],
  caption: string
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    // Create containers for each image
    const childContainerIds: string[] = [];
    for (const imageUrl of imageUrls.slice(0, 10)) {
      // Max 10 images
      const containerId = await createInstagramContainer('IMAGE', { imageUrl });
      childContainerIds.push(containerId);
    }

    // Create carousel container
    const carouselId = await createInstagramContainer('CAROUSEL_ALBUM', {
      children: childContainerIds,
      caption,
    });

    await new Promise((r) => setTimeout(r, 5000));

    const mediaId = await publishInstagramMedia(carouselId);

    return { success: true, mediaId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// FACEBOOK
// ============================================================

export interface FacebookPostResult {
  id: string;
  post_id?: string;
}

/**
 * Post to Facebook Page
 */
export async function postToFacebook(
  message: string,
  options?: {
    link?: string;
    imageUrl?: string;
  }
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = { message };

    if (options?.link) {
      body.link = options.link;
    }

    if (options?.imageUrl) {
      body.url = options.imageUrl;
      // Post as photo instead
      const result = await metaRequest<FacebookPostResult>(
        `/${META_CONFIG.pageId}/photos`,
        { method: 'POST', body: { url: options.imageUrl, caption: message } }
      );
      return { success: true, postId: result.id };
    }

    const result = await metaRequest<FacebookPostResult>(`/${META_CONFIG.pageId}/feed`, {
      method: 'POST',
      body,
    });

    return { success: true, postId: result.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Post a video to Facebook
 */
export async function postFacebookVideo(
  videoUrl: string,
  description: string,
  title?: string
): Promise<{ success: boolean; videoId?: string; error?: string }> {
  try {
    const result = await metaRequest<{ id: string }>(`/${META_CONFIG.pageId}/videos`, {
      method: 'POST',
      body: {
        file_url: videoUrl,
        description,
        title,
      },
    });

    return { success: true, videoId: result.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// TIKTOK
// ============================================================

/**
 * Post a video to TikTok
 * Note: TikTok requires a more complex OAuth flow and video upload process
 */
export async function postToTikTok(
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; shareId?: string; error?: string }> {
  if (!TIKTOK_CONFIG.isConfigured) {
    return { success: false, error: 'TikTok API not configured' };
  }

  try {
    // TikTok uses a different flow - init upload, then finalize
    // This is a simplified version - actual implementation needs chunked upload

    const initResponse = await fetch(
      `${TIKTOK_CONFIG.baseUrl}/post/publish/video/init/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TIKTOK_CONFIG.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            title: caption.slice(0, 150), // TikTok max title length
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_stitch: false,
            disable_comment: false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: videoUrl,
          },
        }),
      }
    );

    const initData = await initResponse.json();

    if (initData.error) {
      throw new Error(initData.error.message || 'TikTok API error');
    }

    return {
      success: true,
      shareId: initData.data?.publish_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get TikTok video status
 */
export async function getTikTokVideoStatus(
  publishId: string
): Promise<{ status: string; error?: string }> {
  if (!TIKTOK_CONFIG.isConfigured) {
    return { status: 'error', error: 'TikTok API not configured' };
  }

  try {
    const response = await fetch(
      `${TIKTOK_CONFIG.baseUrl}/post/publish/status/fetch/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TIKTOK_CONFIG.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publish_id: publishId }),
      }
    );

    const data = await response.json();
    return { status: data.data?.status || 'unknown' };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// YOUTUBE
// ============================================================

/**
 * Get YouTube access token from refresh token
 */
async function getYouTubeAccessToken(): Promise<string> {
  if (!YOUTUBE_CONFIG.refreshToken) {
    throw new Error('YouTube refresh token not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: YOUTUBE_CONFIG.clientId!,
      client_secret: YOUTUBE_CONFIG.clientSecret!,
      refresh_token: YOUTUBE_CONFIG.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`YouTube OAuth error: ${data.error_description}`);
  }

  return data.access_token;
}

/**
 * Upload a video to YouTube
 * Note: This is a simplified version - actual implementation needs resumable upload
 */
export async function uploadYouTubeVideo(
  videoUrl: string,
  metadata: {
    title: string;
    description: string;
    tags?: string[];
    categoryId?: string; // Default: 22 (People & Blogs)
    privacyStatus?: 'private' | 'unlisted' | 'public';
    madeForKids?: boolean;
  }
): Promise<{ success: boolean; videoId?: string; error?: string }> {
  if (!YOUTUBE_CONFIG.isConfigured) {
    return { success: false, error: 'YouTube API not configured' };
  }

  try {
    const accessToken = await getYouTubeAccessToken();

    // First, we need to download the video and upload it
    // This is a simplified version - real implementation needs chunked upload
    // For now, we'll create a placeholder response

    // In production, you'd:
    // 1. Download video from URL
    // 2. Use resumable upload to YouTube
    // 3. Set metadata

    // Placeholder for demonstration
    console.log('YouTube upload would process:', {
      videoUrl,
      metadata,
    });

    return {
      success: false,
      error:
        'YouTube upload requires resumable upload implementation. Use the YouTube Data API directly or a video upload service.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload a YouTube Short
 * Shorts are regular videos but:
 * - Vertical format (9:16)
 * - Under 60 seconds
 * - #Shorts in title or description
 */
export async function uploadYouTubeShort(
  videoUrl: string,
  metadata: {
    title: string;
    description: string;
    tags?: string[];
  }
): Promise<{ success: boolean; videoId?: string; error?: string }> {
  // Ensure #Shorts is in the title
  const shortTitle = metadata.title.includes('#Shorts')
    ? metadata.title
    : `${metadata.title} #Shorts`;

  return uploadYouTubeVideo(videoUrl, {
    ...metadata,
    title: shortTitle,
    categoryId: '22', // People & Blogs
    privacyStatus: 'public',
  });
}

// ============================================================
// TOOL DEFINITIONS FOR AGENT
// ============================================================

export const socialTools = {
  post_to_instagram: {
    name: 'post_to_instagram',
    description: 'Post an image to Instagram',
    input_schema: {
      type: 'object' as const,
      properties: {
        image_url: {
          type: 'string',
          description: 'Public URL of the image to post',
        },
        caption: {
          type: 'string',
          description: 'Post caption (can include hashtags)',
        },
      },
      required: ['image_url', 'caption'],
    },
    handler: async ({ image_url, caption }: { image_url: string; caption: string }) =>
      postToInstagram(image_url, caption),
  },

  post_instagram_reel: {
    name: 'post_instagram_reel',
    description: 'Post a video Reel to Instagram',
    input_schema: {
      type: 'object' as const,
      properties: {
        video_url: {
          type: 'string',
          description: 'Public URL of the video to post',
        },
        caption: {
          type: 'string',
          description: 'Reel caption',
        },
      },
      required: ['video_url', 'caption'],
    },
    handler: async ({ video_url, caption }: { video_url: string; caption: string }) =>
      postInstagramReel(video_url, caption),
  },

  post_instagram_carousel: {
    name: 'post_instagram_carousel',
    description: 'Post a carousel (multiple images) to Instagram',
    input_schema: {
      type: 'object' as const,
      properties: {
        image_urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of image URLs (2-10 images)',
        },
        caption: {
          type: 'string',
          description: 'Carousel caption',
        },
      },
      required: ['image_urls', 'caption'],
    },
    handler: async ({
      image_urls,
      caption,
    }: {
      image_urls: string[];
      caption: string;
    }) => postInstagramCarousel(image_urls, caption),
  },

  post_to_facebook: {
    name: 'post_to_facebook',
    description: 'Post to Facebook Page (text, link, or image)',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'Post message/caption',
        },
        link: {
          type: 'string',
          description: 'Optional link to share',
        },
        image_url: {
          type: 'string',
          description: 'Optional image URL (will post as photo)',
        },
      },
      required: ['message'],
    },
    handler: async ({
      message,
      link,
      image_url,
    }: {
      message: string;
      link?: string;
      image_url?: string;
    }) => postToFacebook(message, { link, imageUrl: image_url }),
  },

  post_facebook_video: {
    name: 'post_facebook_video',
    description: 'Post a video to Facebook Page',
    input_schema: {
      type: 'object' as const,
      properties: {
        video_url: {
          type: 'string',
          description: 'Public URL of the video',
        },
        description: {
          type: 'string',
          description: 'Video description',
        },
        title: {
          type: 'string',
          description: 'Video title (optional)',
        },
      },
      required: ['video_url', 'description'],
    },
    handler: async ({
      video_url,
      description,
      title,
    }: {
      video_url: string;
      description: string;
      title?: string;
    }) => postFacebookVideo(video_url, description, title),
  },

  post_to_tiktok: {
    name: 'post_to_tiktok',
    description: 'Post a video to TikTok',
    input_schema: {
      type: 'object' as const,
      properties: {
        video_url: {
          type: 'string',
          description: 'Public URL of the video',
        },
        caption: {
          type: 'string',
          description: 'Video caption (max 150 chars)',
        },
      },
      required: ['video_url', 'caption'],
    },
    handler: async ({ video_url, caption }: { video_url: string; caption: string }) =>
      postToTikTok(video_url, caption),
  },

  upload_youtube_short: {
    name: 'upload_youtube_short',
    description:
      'Upload a YouTube Short (vertical video under 60 seconds)',
    input_schema: {
      type: 'object' as const,
      properties: {
        video_url: {
          type: 'string',
          description: 'Public URL of the video',
        },
        title: {
          type: 'string',
          description: 'Video title (will add #Shorts automatically)',
        },
        description: {
          type: 'string',
          description: 'Video description',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Video tags',
        },
      },
      required: ['video_url', 'title', 'description'],
    },
    handler: async ({
      video_url,
      title,
      description,
      tags,
    }: {
      video_url: string;
      title: string;
      description: string;
      tags?: string[];
    }) => uploadYouTubeShort(video_url, { title, description, tags }),
  },
};

export const toolDefinitions = Object.values(socialTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const tool of Object.values(socialTools)) {
  toolHandlers[tool.name] = tool.handler;
}
