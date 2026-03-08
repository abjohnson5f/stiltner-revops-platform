/**
 * Content Agent
 *
 * Generates newsletter content and social media posts using AI.
 * Leverages the marketing skills library for consistent brand voice and messaging.
 *
 * Capabilities:
 * - Generate weekly newsletters for Beehiiv
 * - Atomize content into social media posts
 * - Schedule posts across platforms (IG, FB, TikTok, YouTube, LinkedIn)
 * - Generate AI images via Glif MCP
 */

import Anthropic from '@anthropic-ai/sdk';
import { env, BUSINESS_CONTEXT } from '../config/index.js';
import {
  CONTENT_CALENDAR,
  getCurrentSeason,
  getSeasonalThemes,
  getNextNewsletterDate,
  CONTENT_TYPES,
  CONTENT_PILLARS,
  HASHTAG_SETS,
} from '../config/content-calendar.js';
import { getSkill, getSkillsSummary } from '../skills/index.js';
import {
  createPost as createBeehiivPost,
  schedulePost as scheduleBeehiivPost,
  getSubscriberStats,
} from '../tools/beehiiv.js';
import {
  postToInstagram,
  postInstagramCarousel,
  postToFacebook,
  postToTikTok,
} from '../tools/social.js';
import { sendTextNotification } from '../tools/google-chat.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ============================================================
// TYPES
// ============================================================

export interface NewsletterContent {
  title: string;
  subtitle?: string;
  subjectLine: string;
  previewText: string;
  htmlContent: string;
  topics: string[];
}

export interface SocialPost {
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin';
  contentType: 'image' | 'video' | 'carousel' | 'text';
  caption: string;
  hashtags: string[];
  imagePrompt?: string;
  imageUrl?: string;
  videoUrl?: string;
  scheduledTime?: string;
}

export interface ContentPlan {
  week: string; // YYYY-Www format
  newsletter: NewsletterContent | null;
  socialPosts: SocialPost[];
  theme: string;
  season: string;
}

// ============================================================
// NEWSLETTER GENERATION
// ============================================================

/**
 * Generate newsletter content using AI
 */
export async function generateNewsletter(options?: {
  topics?: string[];
  featuredProject?: string;
  seasonalOverride?: string;
}): Promise<NewsletterContent> {
  const season = options?.seasonalOverride || getCurrentSeason();
  const seasonalThemes = getSeasonalThemes();
  const topics = options?.topics || seasonalThemes.slice(0, 3);

  // Load relevant skills
  const newsletterSkill = getSkill('newsletter');
  const brandVoiceSkill = getSkill('brand-voice');
  const directResponseSkill = getSkill('direct-response-copy');

  const systemPrompt = `You are a content writer for ${BUSINESS_CONTEXT.name}, a premium landscaping company in Central Ohio.

## Brand Voice
${brandVoiceSkill?.content || 'Professional, friendly, knowledgeable. We speak like a trusted neighbor who happens to be an expert.'}

## Newsletter Framework
${newsletterSkill?.content || 'Follow standard newsletter best practices.'}

## Business Context
- Services: ${BUSINESS_CONTEXT.services.join(', ')}
- Locations: ${BUSINESS_CONTEXT.locations.join(', ')}, ${BUSINESS_CONTEXT.state}
- Phone: ${BUSINESS_CONTEXT.phone}
- Website: ${BUSINESS_CONTEXT.website}

## Current Season: ${season}
## Focus Topics: ${topics.join(', ')}

## Output Requirements
Generate a newsletter in JSON format with:
1. title: Catchy newsletter title (5-10 words)
2. subtitle: Supporting subtitle
3. subjectLine: Email subject line (under 60 chars, compelling open)
4. previewText: Preview text (under 100 chars)
5. htmlContent: Full HTML content with:
   - Opening hook paragraph
   - Main educational content (2-3 tips related to topics)
   - Featured project showcase (if provided)
   - Seasonal call to action
   - Proper HTML formatting (h2, p, ul, strong, etc.)

Make the content valuable and actionable. Include a clear CTA to book a consultation.`;

  const userPrompt = `Generate a newsletter for the week of ${new Date().toLocaleDateString()}.

Topics to cover: ${topics.join(', ')}
${options?.featuredProject ? `Featured Project: ${options.featuredProject}` : ''}

Output as JSON only, no markdown code blocks.`;

  const response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error('No response from AI');
  }

  // Parse JSON response
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse newsletter JSON');
  }

  const newsletter = JSON.parse(jsonMatch[0]) as NewsletterContent;
  newsletter.topics = topics;

  return newsletter;
}

/**
 * Create and optionally schedule a newsletter in Beehiiv
 */
export async function createAndScheduleNewsletter(
  content: NewsletterContent,
  options?: {
    schedule?: boolean;
    publishDate?: string;
  }
): Promise<{ postId: string; scheduledFor?: string }> {
  const post = await createBeehiivPost({
    title: content.title,
    subtitle: content.subtitle,
    content: content.htmlContent,
    subject_line: content.subjectLine,
    preview_text: content.previewText,
    content_tags: content.topics,
    status: 'draft',
  });

  let scheduledFor: string | undefined;

  if (options?.schedule) {
    const publishDate = options.publishDate || getNextNewsletterDate().toISOString();
    await scheduleBeehiivPost(post.id, publishDate);
    scheduledFor = publishDate;
  }

  return {
    postId: post.id,
    scheduledFor,
  };
}

// ============================================================
// SOCIAL CONTENT GENERATION
// ============================================================

/**
 * Atomize newsletter content into social posts
 */
export async function atomizeContentToSocial(
  sourceContent: string,
  options?: {
    platforms?: Array<'instagram' | 'facebook' | 'tiktok' | 'linkedin'>;
    postsPerPlatform?: number;
  }
): Promise<SocialPost[]> {
  const platforms = options?.platforms || ['instagram', 'facebook', 'linkedin'];
  const postsPerPlatform = options?.postsPerPlatform || 3;

  // Load content atomizer skill
  const atomizerSkill = getSkill('content-atomizer');
  const brandVoiceSkill = getSkill('brand-voice');

  const systemPrompt = `You are a social media content specialist for ${BUSINESS_CONTEXT.name}.

## Content Atomizer Framework
${atomizerSkill?.content || 'Break down long-form content into platform-specific posts.'}

## Brand Voice
${brandVoiceSkill?.content || 'Professional, friendly, knowledgeable.'}

## Platform Guidelines
- Instagram: Visual focus, engaging captions, 20-30 hashtags
- Facebook: Story-driven, community engagement, 3-5 hashtags
- LinkedIn: Professional insights, industry relevance, 3-5 hashtags
- TikTok: Hook in first 3 seconds, trending sounds, 5-10 hashtags

## Available Hashtag Sets
- Landscaping: ${HASHTAG_SETS.landscaping.join(', ')}
- Lawn Care: ${HASHTAG_SETS.lawnCare.join(', ')}
- Hardscaping: ${HASHTAG_SETS.hardscaping.join(', ')}
- Local: ${HASHTAG_SETS.local.join(', ')}

## Output Requirements
Generate ${postsPerPlatform} posts for each platform: ${platforms.join(', ')}

Output as JSON array with objects containing:
- platform: string
- contentType: "image" | "carousel" | "video" | "text"
- caption: string (platform-appropriate length)
- hashtags: string[] (platform-appropriate count)
- imagePrompt: string (for AI image generation, if applicable)`;

  const response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Atomize this content into social posts:\n\n${sourceContent}\n\nOutput as JSON array only.`,
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error('No response from AI');
  }

  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse social posts JSON');
  }

  return JSON.parse(jsonMatch[0]) as SocialPost[];
}

/**
 * Generate a single social post for a specific platform
 */
export async function generateSocialPost(
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin',
  topic: string,
  contentPillar?: string
): Promise<SocialPost> {
  const pillar = contentPillar || CONTENT_PILLARS[0].name;

  const systemPrompt = `You are creating a ${platform} post for ${BUSINESS_CONTEXT.name}, a landscaping company.

Content Pillar: ${pillar}
Topic: ${topic}

Platform: ${platform}
${JSON.stringify(CONTENT_TYPES[`${platform}Post` as keyof typeof CONTENT_TYPES] || {}, null, 2)}

Generate a single post as JSON with:
- platform: "${platform}"
- contentType: appropriate type
- caption: engaging caption
- hashtags: array of relevant hashtags
- imagePrompt: descriptive prompt for AI image generation`;

  const response = await client.messages.create({
    model: env.AGENT_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Generate the post. Output JSON only.` }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error('No response from AI');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse social post JSON');
  }

  return JSON.parse(jsonMatch[0]) as SocialPost;
}

// ============================================================
// CONTENT PLAN GENERATION
// ============================================================

/**
 * Generate a full week's content plan
 */
export async function generateWeeklyContentPlan(): Promise<ContentPlan> {
  const season = getCurrentSeason();
  const themes = getSeasonalThemes();
  const weekTheme = themes[Math.floor(Math.random() * themes.length)];

  // Generate newsletter
  const newsletter = await generateNewsletter({
    topics: [weekTheme, ...themes.slice(0, 2)],
  });

  // Atomize into social posts
  const socialPosts = await atomizeContentToSocial(newsletter.htmlContent, {
    platforms: ['instagram', 'facebook', 'linkedin'],
    postsPerPlatform: 2,
  });

  // Add TikTok/YouTube video concepts
  const videoPost = await generateSocialPost('tiktok', weekTheme, 'Educational');
  socialPosts.push(videoPost);

  const now = new Date();
  const weekNumber = Math.ceil(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  return {
    week: `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`,
    newsletter,
    socialPosts,
    theme: weekTheme,
    season,
  };
}

// ============================================================
// PUBLISHING FUNCTIONS
// ============================================================

/**
 * Publish a social post to its platform
 */
export async function publishSocialPost(
  post: SocialPost
): Promise<{ success: boolean; id?: string; error?: string }> {
  const fullCaption = `${post.caption}\n\n${post.hashtags.join(' ')}`;

  switch (post.platform) {
    case 'instagram':
      if (!post.imageUrl) {
        return { success: false, error: 'Image URL required for Instagram' };
      }
      if (post.contentType === 'carousel' && Array.isArray(post.imageUrl)) {
        return postInstagramCarousel(post.imageUrl as unknown as string[], fullCaption);
      }
      return postToInstagram(post.imageUrl, fullCaption);

    case 'facebook':
      return postToFacebook(fullCaption, {
        imageUrl: post.imageUrl,
      });

    case 'tiktok':
      if (!post.videoUrl) {
        return { success: false, error: 'Video URL required for TikTok' };
      }
      return postToTikTok(post.videoUrl, post.caption.slice(0, 150));

    case 'linkedin':
      // LinkedIn posting would need additional API integration
      return {
        success: false,
        error: 'LinkedIn posting not yet implemented',
      };

    case 'youtube':
      return {
        success: false,
        error: 'YouTube posting requires video upload - use upload_youtube_short tool',
      };

    default:
      return { success: false, error: `Unknown platform: ${post.platform}` };
  }
}

// ============================================================
// CONTENT AGENT RUNNER
// ============================================================

export interface ContentAgentResult {
  action: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Run a content generation workflow
 */
export async function runContentWorkflow(
  workflow: 'newsletter' | 'social' | 'weekly-plan',
  options?: {
    topics?: string[];
    platform?: 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
    schedule?: boolean;
    notify?: boolean;
  }
): Promise<ContentAgentResult> {
  try {
    switch (workflow) {
      case 'newsletter': {
        const newsletter = await generateNewsletter({ topics: options?.topics });
        const result = await createAndScheduleNewsletter(newsletter, {
          schedule: options?.schedule,
        });

        if (options?.notify) {
          await sendTextNotification(
            `📧 Newsletter draft created: "${newsletter.title}"\n` +
              `Topics: ${newsletter.topics.join(', ')}\n` +
              (result.scheduledFor
                ? `Scheduled for: ${new Date(result.scheduledFor).toLocaleString()}`
                : 'Ready for review')
          );
        }

        return {
          action: 'newsletter',
          success: true,
          data: { newsletter, ...result },
        };
      }

      case 'social': {
        const theme = getSeasonalThemes()[0];
        const posts = await Promise.all([
          generateSocialPost(options?.platform || 'instagram', theme),
          generateSocialPost(options?.platform || 'instagram', theme, 'Showcase'),
        ]);

        return {
          action: 'social',
          success: true,
          data: { posts },
        };
      }

      case 'weekly-plan': {
        const plan = await generateWeeklyContentPlan();

        if (options?.notify) {
          await sendTextNotification(
            `📅 Weekly Content Plan Generated\n` +
              `Theme: ${plan.theme}\n` +
              `Newsletter: ${plan.newsletter?.title || 'N/A'}\n` +
              `Social Posts: ${plan.socialPosts.length}`
          );
        }

        return {
          action: 'weekly-plan',
          success: true,
          data: plan,
        };
      }

      default:
        return {
          action: workflow,
          success: false,
          error: `Unknown workflow: ${workflow}`,
        };
    }
  } catch (error) {
    return {
      action: workflow,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// TOOL DEFINITION FOR ORCHESTRATOR
// ============================================================

export const contentAgentTool = {
  name: 'run_content_workflow',
  description:
    'Run content generation workflows: newsletter (create Beehiiv draft), social (generate platform posts), weekly-plan (full content plan)',
  input_schema: {
    type: 'object' as const,
    properties: {
      workflow: {
        type: 'string',
        enum: ['newsletter', 'social', 'weekly-plan'],
        description: 'Content workflow to run',
      },
      topics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Topics to focus on (optional)',
      },
      platform: {
        type: 'string',
        enum: ['instagram', 'facebook', 'tiktok', 'linkedin'],
        description: 'Target platform for social workflow',
      },
      schedule: {
        type: 'boolean',
        default: false,
        description: 'Auto-schedule the content',
      },
      notify: {
        type: 'boolean',
        default: true,
        description: 'Send G-Chat notification',
      },
    },
    required: ['workflow'],
  },
  handler: async (args: {
    workflow: 'newsletter' | 'social' | 'weekly-plan';
    topics?: string[];
    platform?: 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
    schedule?: boolean;
    notify?: boolean;
  }) => runContentWorkflow(args.workflow, args),
};

// ============================================================
// STANDALONE EXECUTION
// ============================================================

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const workflow = (process.argv[2] || 'weekly-plan') as 'newsletter' | 'social' | 'weekly-plan';

  console.log(`\n📝 Running Content Agent: ${workflow}\n`);

  runContentWorkflow(workflow, { notify: false })
    .then((result) => {
      console.log('\n✅ Result:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(console.error);
}
