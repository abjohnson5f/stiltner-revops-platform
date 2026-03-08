/**
 * Glif MCP Tools
 *
 * Interface for AI image and video generation using Glif workflows.
 * Glif is configured as an MCP server - this file provides wrapper functions
 * and tool definitions for the agent system.
 *
 * Note: Requires GLIF_API_TOKEN to be configured and Glif MCP server to be available.
 */

import { GLIF_CONFIG } from '../config/index.js';

// ============================================================
// TYPES
// ============================================================

export interface GlifWorkflowResult {
  success: boolean;
  outputUrl?: string;
  outputs?: Record<string, unknown>;
  error?: string;
  creditsUsed?: number;
}

export interface GlifImageInput {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  style?: string;
}

export interface GlifVideoInput {
  prompt: string;
  duration?: number; // seconds
  aspectRatio?: '1:1' | '16:9' | '9:16';
}

// ============================================================
// GLIF API CLIENT
// ============================================================

const GLIF_API_BASE = 'https://glif.app/api';

/**
 * Run a Glif workflow via the API
 */
export async function runGlifWorkflow(
  workflowId: string,
  inputs: Record<string, unknown>
): Promise<GlifWorkflowResult> {
  if (!GLIF_CONFIG.isConfigured) {
    return {
      success: false,
      error: 'Glif API token not configured. Set GLIF_API_TOKEN in environment.',
    };
  }

  try {
    const response = await fetch(`${GLIF_API_BASE}/glifs/${workflowId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GLIF_CONFIG.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Glif API error: ${response.status} - ${error}`,
      };
    }

    const result = await response.json();
    
    return {
      success: true,
      outputUrl: result.output?.url || result.output,
      outputs: result.output,
      creditsUsed: result.creditsUsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// PREDEFINED WORKFLOWS
// ============================================================

// These workflow IDs would be configured based on your Glif account
// Update these with actual workflow IDs from your Glif workspace
const WORKFLOWS = {
  // Landscape-focused image generation
  landscapeImage: process.env.GLIF_LANDSCAPE_IMAGE_WORKFLOW || 'landscape-image-v1',
  // Social media graphics
  socialGraphic: process.env.GLIF_SOCIAL_GRAPHIC_WORKFLOW || 'social-graphic-v1',
  // Ad creative generation
  adCreative: process.env.GLIF_AD_CREATIVE_WORKFLOW || 'ad-creative-v1',
  // Video generation
  shortVideo: process.env.GLIF_SHORT_VIDEO_WORKFLOW || 'short-video-v1',
};

/**
 * Generate a landscape-themed image
 */
export async function generateLandscapeImage(
  input: GlifImageInput
): Promise<GlifWorkflowResult> {
  const enhancedPrompt = `Professional landscaping photo: ${input.prompt}. High quality, realistic, daylight, beautiful lawn and garden.`;
  
  return runGlifWorkflow(WORKFLOWS.landscapeImage, {
    prompt: enhancedPrompt,
    negative_prompt: input.negativePrompt || 'blurry, low quality, text, watermark, cartoon',
    aspect_ratio: input.aspectRatio || '16:9',
    style: input.style || 'photorealistic',
  });
}

/**
 * Generate a social media graphic
 */
export async function generateSocialGraphic(
  input: GlifImageInput & { platform?: 'instagram' | 'facebook' | 'linkedin' }
): Promise<GlifWorkflowResult> {
  const aspectRatios: Record<string, string> = {
    instagram: '1:1',
    facebook: '16:9',
    linkedin: '16:9',
  };
  
  return runGlifWorkflow(WORKFLOWS.socialGraphic, {
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio || aspectRatios[input.platform || 'instagram'],
    brand_colors: ['#4A7C59', '#2D5016', '#8BC34A'], // Stiltner brand colors
  });
}

/**
 * Generate an ad creative image
 */
export async function generateAdCreative(
  input: GlifImageInput & {
    headline?: string;
    ctaText?: string;
  }
): Promise<GlifWorkflowResult> {
  return runGlifWorkflow(WORKFLOWS.adCreative, {
    prompt: input.prompt,
    headline: input.headline,
    cta_text: input.ctaText || 'Get a Free Quote',
    aspect_ratio: input.aspectRatio || '1:1',
    brand_logo_url: 'https://stiltnerlandscapes.com/StiltnerLandscapesLogo-optimized.svg',
  });
}

/**
 * Generate a short video clip
 */
export async function generateShortVideo(
  input: GlifVideoInput
): Promise<GlifWorkflowResult> {
  return runGlifWorkflow(WORKFLOWS.shortVideo, {
    prompt: input.prompt,
    duration: input.duration || 5,
    aspect_ratio: input.aspectRatio || '9:16',
  });
}

// ============================================================
// TOOL DEFINITIONS FOR AGENT
// ============================================================

export const glifTools = {
  generate_landscape_image: {
    name: 'generate_landscape_image',
    description: 'Generate a professional landscaping-themed image using AI',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'Description of the image to generate (e.g., "beautiful patio with outdoor lighting")',
        },
        negative_prompt: {
          type: 'string',
          description: 'Things to avoid in the image',
        },
        aspect_ratio: {
          type: 'string',
          enum: ['1:1', '16:9', '9:16', '4:3'],
          default: '16:9',
        },
      },
      required: ['prompt'],
    },
    handler: generateLandscapeImage,
  },

  generate_social_graphic: {
    name: 'generate_social_graphic',
    description: 'Generate a branded social media graphic',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'Description of the graphic to generate',
        },
        platform: {
          type: 'string',
          enum: ['instagram', 'facebook', 'linkedin'],
          description: 'Target social media platform',
        },
        aspect_ratio: {
          type: 'string',
          enum: ['1:1', '16:9', '9:16'],
        },
      },
      required: ['prompt'],
    },
    handler: generateSocialGraphic,
  },

  generate_ad_creative: {
    name: 'generate_ad_creative',
    description: 'Generate an advertising creative image with optional headline and CTA',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'Description of the ad image',
        },
        headline: {
          type: 'string',
          description: 'Ad headline text to overlay',
        },
        cta_text: {
          type: 'string',
          description: 'Call-to-action button text',
        },
        aspect_ratio: {
          type: 'string',
          enum: ['1:1', '16:9', '4:5'],
          default: '1:1',
        },
      },
      required: ['prompt'],
    },
    handler: generateAdCreative,
  },

  generate_short_video: {
    name: 'generate_short_video',
    description: 'Generate a short AI video clip',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'Description of the video to generate',
        },
        duration: {
          type: 'number',
          description: 'Video duration in seconds (default 5)',
          default: 5,
        },
        aspect_ratio: {
          type: 'string',
          enum: ['1:1', '16:9', '9:16'],
          default: '9:16',
        },
      },
      required: ['prompt'],
    },
    handler: generateShortVideo,
  },

  run_custom_glif_workflow: {
    name: 'run_custom_glif_workflow',
    description: 'Run a custom Glif workflow by ID',
    input_schema: {
      type: 'object' as const,
      properties: {
        workflow_id: {
          type: 'string',
          description: 'Glif workflow ID',
        },
        inputs: {
          type: 'object',
          description: 'Workflow input parameters',
        },
      },
      required: ['workflow_id', 'inputs'],
    },
    handler: async ({ workflow_id, inputs }: { workflow_id: string; inputs: Record<string, unknown> }) =>
      runGlifWorkflow(workflow_id, inputs),
  },
};

export const toolDefinitions = Object.values(glifTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.input_schema,
}));

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {};
for (const tool of Object.values(glifTools)) {
  toolHandlers[tool.name] = tool.handler;
}
