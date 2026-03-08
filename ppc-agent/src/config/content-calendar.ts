/**
 * Content Calendar Configuration
 *
 * Defines the content publishing schedule for newsletters and social media.
 * Used by the Content Agent to automate content creation and scheduling.
 */

export interface PlatformSchedule {
  postsPerDay?: number;
  postsPerWeek?: number;
  bestTimes: string[]; // HH:MM format (24h)
}

export interface ContentCalendarConfig {
  newsletter: {
    dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
    time: string; // HH:MM
    timezone: string;
  };
  social: {
    instagram: PlatformSchedule;
    facebook: PlatformSchedule;
    tiktok: PlatformSchedule;
    youtube: PlatformSchedule;
    linkedin: PlatformSchedule;
  };
  seasonal: {
    spring: string[];
    summer: string[];
    fall: string[];
    winter: string[];
  };
}

export const CONTENT_CALENDAR: ContentCalendarConfig = {
  // Weekly newsletter - sent Tuesday morning
  newsletter: {
    dayOfWeek: 2, // Tuesday
    time: '09:00',
    timezone: 'America/New_York',
  },

  // Social media posting schedules
  social: {
    instagram: {
      postsPerDay: 1,
      bestTimes: ['12:00', '18:00'], // Noon and 6 PM
    },
    facebook: {
      postsPerDay: 1,
      bestTimes: ['09:00', '15:00'], // 9 AM and 3 PM
    },
    tiktok: {
      postsPerWeek: 3,
      bestTimes: ['19:00', '21:00'], // 7 PM and 9 PM (evening engagement)
    },
    youtube: {
      postsPerWeek: 2, // YouTube Shorts
      bestTimes: ['14:00'], // 2 PM
    },
    linkedin: {
      postsPerWeek: 3,
      bestTimes: ['08:00', '12:00'], // 8 AM and noon (professional hours)
    },
  },

  // Seasonal content themes for landscaping business
  seasonal: {
    spring: [
      'lawn preparation',
      'spring cleanup',
      'mulching',
      'planting',
      'bed edging',
      'lawn aeration',
      'overseeding',
      'fertilization',
      'weed prevention',
      'irrigation startup',
    ],
    summer: [
      'lawn care tips',
      'irrigation maintenance',
      'outdoor living',
      'hardscaping projects',
      'patio installation',
      'retaining walls',
      'drainage solutions',
      'heat stress prevention',
      'water conservation',
      'landscape lighting',
    ],
    fall: [
      'leaf cleanup',
      'fall aeration',
      'overseeding',
      'fall color',
      'tree planting',
      'shrub pruning',
      'winterization prep',
      'final fertilization',
      'mum planting',
      'landscape planning',
    ],
    winter: [
      'snow removal',
      'ice management',
      'holiday lighting',
      'winter planning',
      'dormant pruning',
      'equipment maintenance',
      'project planning',
      'spring booking',
      'landscape design',
      'indoor plant tips',
    ],
  },
};

/**
 * Get current season based on date
 */
export function getCurrentSeason(
  date: Date = new Date()
): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = date.getMonth(); // 0-11

  if (month >= 2 && month <= 4) return 'spring'; // March-May
  if (month >= 5 && month <= 7) return 'summer'; // June-August
  if (month >= 8 && month <= 10) return 'fall'; // September-November
  return 'winter'; // December-February
}

/**
 * Get seasonal content themes for current season
 */
export function getSeasonalThemes(date: Date = new Date()): string[] {
  const season = getCurrentSeason(date);
  return CONTENT_CALENDAR.seasonal[season];
}

/**
 * Get next newsletter send date
 */
export function getNextNewsletterDate(fromDate: Date = new Date()): Date {
  const { dayOfWeek, time, timezone } = CONTENT_CALENDAR.newsletter;
  const [hours, minutes] = time.split(':').map(Number);

  const result = new Date(fromDate);

  // Find next occurrence of the day
  const currentDay = result.getDay();
  let daysUntilNext = dayOfWeek - currentDay;

  if (daysUntilNext <= 0) {
    // If today is the day but time has passed, or day has passed
    const todayTime = result.getHours() * 60 + result.getMinutes();
    const targetTime = hours * 60 + minutes;

    if (daysUntilNext === 0 && todayTime < targetTime) {
      daysUntilNext = 0; // Today is still valid
    } else {
      daysUntilNext += 7; // Next week
    }
  }

  result.setDate(result.getDate() + daysUntilNext);
  result.setHours(hours, minutes, 0, 0);

  return result;
}

/**
 * Get optimal posting time for a platform
 */
export function getOptimalPostTime(
  platform: keyof typeof CONTENT_CALENDAR.social,
  preferredSlot: number = 0
): string {
  const schedule = CONTENT_CALENDAR.social[platform];
  const slotIndex = Math.min(preferredSlot, schedule.bestTimes.length - 1);
  return schedule.bestTimes[slotIndex];
}

/**
 * Content types and their characteristics
 */
export const CONTENT_TYPES = {
  newsletter: {
    name: 'Weekly Newsletter',
    platform: 'beehiiv',
    frequency: 'weekly',
    format: 'html',
    targetLength: 1500, // words
    components: [
      'opening hook',
      'main story',
      'seasonal tip',
      'project showcase',
      'call to action',
    ],
  },
  instagramPost: {
    name: 'Instagram Post',
    platform: 'instagram',
    frequency: 'daily',
    format: 'image+caption',
    captionLength: 2200, // max chars
    hashtagCount: 20,
    components: ['hook', 'value', 'cta', 'hashtags'],
  },
  instagramReel: {
    name: 'Instagram Reel',
    platform: 'instagram',
    frequency: '3x/week',
    format: 'video',
    maxDuration: 90, // seconds
    aspectRatio: '9:16',
  },
  facebookPost: {
    name: 'Facebook Post',
    platform: 'facebook',
    frequency: 'daily',
    format: 'text+image',
    textLength: 500, // optimal chars
    components: ['hook', 'story', 'cta'],
  },
  tiktokVideo: {
    name: 'TikTok Video',
    platform: 'tiktok',
    frequency: '3x/week',
    format: 'video',
    maxDuration: 180, // seconds (but shorter is better)
    aspectRatio: '9:16',
    captionLength: 150,
  },
  youtubeShort: {
    name: 'YouTube Short',
    platform: 'youtube',
    frequency: '2x/week',
    format: 'video',
    maxDuration: 60, // seconds
    aspectRatio: '9:16',
    components: ['hook', 'content', '#Shorts tag'],
  },
  linkedinPost: {
    name: 'LinkedIn Post',
    platform: 'linkedin',
    frequency: '3x/week',
    format: 'text+image',
    textLength: 1300, // optimal chars
    components: ['hook', 'insight', 'story', 'cta'],
  },
};

/**
 * Content pillars for Stiltner Landscapes
 */
export const CONTENT_PILLARS = [
  {
    name: 'Educational',
    percentage: 40,
    examples: [
      'lawn care tips',
      'plant selection guides',
      'seasonal maintenance advice',
      'DIY vs professional',
    ],
  },
  {
    name: 'Showcase',
    percentage: 30,
    examples: [
      'before/after transformations',
      'project spotlights',
      'client testimonials',
      'team at work',
    ],
  },
  {
    name: 'Behind the Scenes',
    percentage: 15,
    examples: [
      'team introductions',
      'day in the life',
      'equipment tours',
      'company culture',
    ],
  },
  {
    name: 'Promotional',
    percentage: 15,
    examples: [
      'seasonal offers',
      'new service launches',
      'booking CTAs',
      'limited availability',
    ],
  },
];

/**
 * Hashtag sets for different platforms and topics
 */
export const HASHTAG_SETS = {
  landscaping: [
    '#landscaping',
    '#landscapedesign',
    '#outdoorliving',
    '#backyardgoals',
    '#yardtransformation',
  ],
  lawnCare: [
    '#lawncare',
    '#lawnmaintenance',
    '#greenlawn',
    '#healthylawn',
    '#lawntips',
  ],
  hardscaping: [
    '#hardscape',
    '#patiodesign',
    '#retainingwall',
    '#pavers',
    '#outdoorspace',
  ],
  local: [
    '#DublinOhio',
    '#PowellOhio',
    '#CentralOhio',
    '#ColumbusOhio',
    '#OhioLandscaping',
  ],
  seasonal: {
    spring: ['#springcleanup', '#springplanting', '#springlawncare'],
    summer: ['#summerlandscaping', '#outdoorliving', '#backyardoasis'],
    fall: ['#fallcleanup', '#fallcolors', '#leafremoval'],
    winter: ['#winterlandscaping', '#snowremoval', '#winterplanning'],
  },
};

export default CONTENT_CALENDAR;
