/**
 * Apify Client for Google Maps Scraper
 * 
 * Uses the apify/google-maps-scraper actor to extract competitor
 * data and customer reviews for market intelligence.
 */

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const GOOGLE_MAPS_SCRAPER_ACTOR = 'apify/google-maps-scraper';

interface ApifyRunInput {
  searchStringsArray: string[];
  maxCrawledPlacesPerSearch: number;
  language: string;
  maxReviews: number;
  reviewsSort: 'newest' | 'mostRelevant' | 'highestRating' | 'lowestRating';
  scrapeReviewerName: boolean;
  scrapeReviewerId: boolean;
  scrapeReviewerUrl: boolean;
  scrapeReviewId: boolean;
  scrapeReviewUrl: boolean;
  scrapeResponseFromOwnerText: boolean;
}

interface ApifyReview {
  name: string;
  text: string;
  publishAt: string;
  publishedAtDate: string;
  likesCount: number;
  reviewId: string;
  reviewUrl: string;
  reviewerId: string;
  reviewerUrl: string;
  reviewerNumberOfReviews: number;
  isLocalGuide: boolean;
  stars: number;
  rating: number;
  responseFromOwnerText?: string;
}

interface ApifyPlace {
  title: string;
  totalScore: number;
  reviewsCount: number;
  categoryName: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  website: string;
  url: string;
  reviews: ApifyReview[];
  reviewsDistribution: {
    oneStar: number;
    twoStar: number;
    threeStar: number;
    fourStar: number;
    fiveStar: number;
  };
}

export interface CompetitorData {
  name: string;
  rating: number;
  reviewCount: number;
  category: string;
  address: string;
  phone: string;
  website: string;
  url: string;
}

export interface MarketIntelligence {
  competitors: CompetitorData[];
  painPoints: string[];
  praisePoints: string[];
  customerLanguage: string[];
  reviewSummary: {
    totalReviews: number;
    averageRating: number;
    sentimentBreakdown: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
}

/**
 * Check if Apify is configured
 */
export function isApifyConfigured(): boolean {
  return !!process.env.APIFY_API_TOKEN;
}

/**
 * Run the Google Maps Scraper actor and wait for results
 */
async function runGoogleMapsScraper(
  searchQueries: string[],
  maxPlaces: number = 10,
  maxReviews: number = 50
): Promise<ApifyPlace[]> {
  const apiToken = process.env.APIFY_API_TOKEN;
  
  if (!apiToken) {
    throw new Error('APIFY_API_TOKEN not configured');
  }

  const input: ApifyRunInput = {
    searchStringsArray: searchQueries,
    maxCrawledPlacesPerSearch: maxPlaces,
    language: 'en',
    maxReviews: maxReviews,
    reviewsSort: 'newest',
    scrapeReviewerName: true,
    scrapeReviewerId: true,
    scrapeReviewerUrl: false,
    scrapeReviewId: true,
    scrapeReviewUrl: false,
    scrapeResponseFromOwnerText: true,
  };

  // Start the actor run
  const runResponse = await fetch(
    `${APIFY_BASE_URL}/acts/${GOOGLE_MAPS_SCRAPER_ACTOR}/runs?token=${apiToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );

  if (!runResponse.ok) {
    const error = await runResponse.text();
    throw new Error(`Failed to start Apify actor: ${error}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;

  // Poll for completion (max 5 minutes)
  const maxWaitTime = 5 * 60 * 1000;
  const pollInterval = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const statusResponse = await fetch(
      `${APIFY_BASE_URL}/actor-runs/${runId}?token=${apiToken}`
    );
    
    if (!statusResponse.ok) continue;
    
    const statusData = await statusResponse.json();
    const status = statusData.data.status;

    if (status === 'SUCCEEDED') {
      // Fetch results from dataset
      const datasetId = statusData.data.defaultDatasetId;
      const resultsResponse = await fetch(
        `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
      );
      
      if (!resultsResponse.ok) {
        throw new Error('Failed to fetch Apify results');
      }
      
      return await resultsResponse.json();
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify actor run ${status}`);
    }
  }

  throw new Error('Apify actor run timed out');
}

/**
 * Extract pain points from negative reviews (1-3 stars)
 */
function extractPainPoints(reviews: ApifyReview[]): string[] {
  const negativeReviews = reviews.filter(r => r.stars <= 3 && r.text);
  
  // Common pain point patterns
  const painPatterns = [
    /never (returned|called|showed|responded)/gi,
    /didn't (show|call|respond|communicate)/gi,
    /no (communication|response|follow.?up)/gi,
    /(late|delayed|slow|took forever)/gi,
    /(expensive|overpriced|over budget|cost more)/gi,
    /(mess|debris|cleanup|dirty)/gi,
    /(unprofessional|rude|disrespectful)/gi,
    /(poor quality|shoddy|cheap)/gi,
    /(damaged|broke|ruined)/gi,
    /(wouldn't recommend|avoid|terrible|awful|horrible)/gi,
  ];

  const painPoints = new Set<string>();
  
  for (const review of negativeReviews) {
    const text = review.text.toLowerCase();
    
    // Check for pattern matches
    for (const pattern of painPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        // Clean and add the matched phrase
        matches.forEach(match => {
          const cleaned = match.trim().replace(/\s+/g, ' ');
          if (cleaned.length > 3) {
            painPoints.add(cleaned);
          }
        });
      }
    }
    
    // Also extract short sentences that contain negative sentiment
    const sentences = review.text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    for (const sentence of sentences.slice(0, 2)) {
      if (sentence.length < 100 && /not|never|didn't|poor|bad|terrible|awful/i.test(sentence)) {
        painPoints.add(sentence.trim());
      }
    }
  }

  return Array.from(painPoints).slice(0, 15);
}

/**
 * Extract praise points from positive reviews (4-5 stars)
 */
function extractPraisePoints(reviews: ApifyReview[]): string[] {
  const positiveReviews = reviews.filter(r => r.stars >= 4 && r.text);
  
  // Common praise patterns
  const praisePatterns = [
    /(great|excellent|amazing|outstanding) (communication|service|work|job|team)/gi,
    /(professional|responsive|reliable|punctual|on time)/gi,
    /(beautiful|stunning|gorgeous|perfect) (work|job|design|result)/gi,
    /(highly recommend|would recommend|best .+ ever)/gi,
    /(exceeded expectations|above and beyond)/gi,
    /(fair price|reasonable|good value|worth every)/gi,
    /(clean|tidy|neat) (work|job|site)/gi,
    /(friendly|nice|pleasant|courteous) (team|crew|staff)/gi,
  ];

  const praisePoints = new Set<string>();
  
  for (const review of positiveReviews) {
    const text = review.text.toLowerCase();
    
    for (const pattern of praisePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.trim().replace(/\s+/g, ' ');
          if (cleaned.length > 5) {
            praisePoints.add(cleaned);
          }
        });
      }
    }
  }

  return Array.from(praisePoints).slice(0, 15);
}

/**
 * Extract customer language patterns (phrases they actually use)
 */
function extractCustomerLanguage(reviews: ApifyReview[]): string[] {
  const allReviews = reviews.filter(r => r.text);
  
  // Service-related phrases customers use
  const languagePatterns = [
    /backyard (makeover|transformation|project|renovation)/gi,
    /outdoor (living|space|kitchen|entertaining)/gi,
    /(patio|deck|walkway|driveway|retaining wall)/gi,
    /(curb appeal|front yard|landscape design)/gi,
    /(lawn care|lawn maintenance|grass|mowing)/gi,
    /(spring cleanup|fall cleanup|seasonal)/gi,
    /(drainage|grading|irrigation|sprinkler)/gi,
    /(stone|pavers|brick|concrete|flagstone)/gi,
    /(lighting|outdoor lights|landscape lighting)/gi,
    /(planting|plants|flowers|shrubs|trees|mulch)/gi,
  ];

  const language = new Set<string>();
  
  for (const review of allReviews) {
    const text = review.text;
    
    for (const pattern of languagePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          language.add(match.toLowerCase().trim());
        });
      }
    }
  }

  return Array.from(language).slice(0, 20);
}

/**
 * Main function: Get market intelligence for a service in specific locations
 */
export async function getCompetitorIntelligence(
  service: string,
  locations: string[]
): Promise<MarketIntelligence> {
  // Build search queries
  const searchQueries = locations.map(location => 
    `${service} in ${location}, Ohio`
  );

  // If Apify isn't configured, return mock data for development
  if (!isApifyConfigured()) {
    return getMockMarketIntelligence(service, locations);
  }

  try {
    const places = await runGoogleMapsScraper(searchQueries, 10, 30);
    
    // Collect all reviews
    const allReviews: ApifyReview[] = [];
    const competitors: CompetitorData[] = [];
    
    for (const place of places) {
      if (place.reviews) {
        allReviews.push(...place.reviews);
      }
      
      competitors.push({
        name: place.title,
        rating: place.totalScore || 0,
        reviewCount: place.reviewsCount || 0,
        category: place.categoryName || '',
        address: place.address || '',
        phone: place.phone || '',
        website: place.website || '',
        url: place.url || '',
      });
    }

    // Calculate sentiment breakdown
    const positive = allReviews.filter(r => r.stars >= 4).length;
    const negative = allReviews.filter(r => r.stars <= 2).length;
    const neutral = allReviews.length - positive - negative;

    return {
      competitors: competitors.sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 10),
      painPoints: extractPainPoints(allReviews),
      praisePoints: extractPraisePoints(allReviews),
      customerLanguage: extractCustomerLanguage(allReviews),
      reviewSummary: {
        totalReviews: allReviews.length,
        averageRating: allReviews.length > 0 
          ? allReviews.reduce((sum, r) => sum + r.stars, 0) / allReviews.length 
          : 0,
        sentimentBreakdown: {
          positive,
          neutral,
          negative,
        },
      },
    };
  } catch (error) {
    console.error('Apify scraper error:', error);
    // Fall back to mock data on error
    return getMockMarketIntelligence(service, locations);
  }
}

/**
 * Mock data for development/demo when Apify isn't configured
 */
function getMockMarketIntelligence(service: string, locations: string[]): MarketIntelligence {
  const locationStr = locations.slice(0, 2).join(', ');
  
  return {
    competitors: [
      { name: `${locationStr} Landscapes`, rating: 4.2, reviewCount: 87, category: 'Landscaper', address: `${locations[0]}, OH`, phone: '614-555-0100', website: '', url: '' },
      { name: 'Green Thumb Pro', rating: 3.8, reviewCount: 45, category: 'Landscaping Company', address: `${locations[0]}, OH`, phone: '614-555-0101', website: '', url: '' },
      { name: 'Premier Outdoor Services', rating: 4.6, reviewCount: 123, category: 'Landscape Designer', address: `${locations[0]}, OH`, phone: '614-555-0102', website: '', url: '' },
      { name: 'Buckeye Hardscaping', rating: 3.4, reviewCount: 28, category: 'Hardscape Contractor', address: `${locations[0]}, OH`, phone: '614-555-0103', website: '', url: '' },
      { name: 'Ohio Outdoor Living', rating: 4.1, reviewCount: 67, category: 'Landscape Company', address: `${locations[0]}, OH`, phone: '614-555-0104', website: '', url: '' },
    ],
    painPoints: [
      'Never returned my calls',
      'Project went over budget',
      'Left debris everywhere after the job',
      'Took much longer than quoted',
      'Poor communication throughout',
      'Workers showed up late',
      'Had to follow up multiple times',
      'Quality didn\'t match the price',
    ],
    praisePoints: [
      'Great communication throughout',
      'Professional and courteous team',
      'Finished on time and on budget',
      'Beautiful design work',
      'Clean job site every day',
      'Highly recommend their services',
      'Fair and transparent pricing',
      'Exceeded our expectations',
    ],
    customerLanguage: [
      'backyard makeover',
      'outdoor living space',
      'patio installation',
      'retaining wall',
      'curb appeal',
      'landscape design',
      'outdoor entertaining',
      'drainage solution',
      'stone pavers',
      'lawn maintenance',
    ],
    reviewSummary: {
      totalReviews: 350,
      averageRating: 4.0,
      sentimentBreakdown: {
        positive: 245,
        neutral: 70,
        negative: 35,
      },
    },
  };
}
