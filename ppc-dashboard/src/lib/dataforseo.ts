/**
 * DataForSEO Client for Keyword Research
 * 
 * Provides keyword suggestions, search volume, and difficulty
 * data for campaign targeting.
 */

const DATAFORSEO_BASE_URL = 'https://api.dataforseo.com/v3';

interface KeywordData {
  keyword: string;
  searchVolume: number;
  competition: number;
  competitionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  cpc: number;
  monthlySearches: { year: number; month: number; search_volume: number }[];
}

interface KeywordSuggestion {
  term: string;
  volume: number;
  difficulty: 'low' | 'medium' | 'high';
  cpc: number;
  trend: 'up' | 'down' | 'stable';
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
}

export interface KeywordResearchResult {
  keywords: KeywordSuggestion[];
  totalVolume: number;
  averageCpc: number;
  topKeywords: KeywordSuggestion[];
  easyWins: KeywordSuggestion[]; // Low difficulty, decent volume
}

/**
 * Check if DataForSEO is configured
 */
export function isDataForSEOConfigured(): boolean {
  return !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

/**
 * Get auth header for DataForSEO API
 */
function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
}

/**
 * Make authenticated request to DataForSEO
 */
async function dataForSEORequest<T>(endpoint: string, body: any): Promise<T> {
  if (!isDataForSEOConfigured()) {
    throw new Error('DataForSEO credentials not configured');
  }

  const response = await fetch(`${DATAFORSEO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DataForSEO API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO error: ${data.status_message}`);
  }

  return data;
}

/**
 * Get keyword suggestions for a service + location
 */
async function getKeywordSuggestions(
  seedKeyword: string,
  locationName: string = 'United States'
): Promise<KeywordData[]> {
  const response = await dataForSEORequest<any>(
    '/dataforseo_labs/google/keyword_suggestions/live',
    [{
      keyword: seedKeyword,
      location_name: locationName,
      language_name: 'English',
      include_seed_keyword: true,
      limit: 50,
    }]
  );

  const results = response.tasks?.[0]?.result?.[0]?.items || [];
  
  return results.map((item: any) => ({
    keyword: item.keyword,
    searchVolume: item.keyword_info?.search_volume || 0,
    competition: item.keyword_info?.competition || 0,
    competitionLevel: item.keyword_info?.competition_level || 'MEDIUM',
    cpc: item.keyword_info?.cpc || 0,
    monthlySearches: item.keyword_info?.monthly_searches || [],
  }));
}

/**
 * Get search volume for specific keywords
 */
async function getSearchVolume(
  keywords: string[],
  locationCode: number = 2840 // US
): Promise<Map<string, KeywordData>> {
  const response = await dataForSEORequest<any>(
    '/keywords_data/google_ads/search_volume/live',
    [{
      keywords: keywords.slice(0, 100), // API limit
      location_code: locationCode,
      language_code: 'en',
    }]
  );

  const results = new Map<string, KeywordData>();
  const items = response.tasks?.[0]?.result || [];
  
  for (const item of items) {
    if (item.keyword) {
      results.set(item.keyword.toLowerCase(), {
        keyword: item.keyword,
        searchVolume: item.search_volume || 0,
        competition: item.competition || 0,
        competitionLevel: item.competition_level || 'MEDIUM',
        cpc: item.cpc || 0,
        monthlySearches: item.monthly_searches || [],
      });
    }
  }

  return results;
}

/**
 * Determine keyword intent based on modifiers
 */
function determineIntent(keyword: string): 'informational' | 'commercial' | 'transactional' | 'navigational' {
  const kw = keyword.toLowerCase();
  
  // Transactional
  if (/\b(buy|hire|get|book|schedule|quote|estimate|cost|price|near me|services?)\b/.test(kw)) {
    return 'transactional';
  }
  
  // Commercial
  if (/\b(best|top|review|compare|vs|affordable|cheap|professional)\b/.test(kw)) {
    return 'commercial';
  }
  
  // Navigational
  if (/\b(company|business|contractor|stiltner)\b/.test(kw)) {
    return 'navigational';
  }
  
  // Default to informational
  return 'informational';
}

/**
 * Determine trend direction from monthly searches
 */
function determineTrend(monthlySearches: { search_volume: number }[]): 'up' | 'down' | 'stable' {
  if (!monthlySearches || monthlySearches.length < 3) return 'stable';
  
  const recent = monthlySearches.slice(0, 3).reduce((sum, m) => sum + m.search_volume, 0) / 3;
  const older = monthlySearches.slice(3, 6).reduce((sum, m) => sum + m.search_volume, 0) / 3;
  
  if (recent > older * 1.2) return 'up';
  if (recent < older * 0.8) return 'down';
  return 'stable';
}

/**
 * Map competition level to difficulty
 */
function mapDifficulty(level: string, competition: number): 'low' | 'medium' | 'high' {
  if (level === 'LOW' || competition < 0.3) return 'low';
  if (level === 'HIGH' || competition > 0.7) return 'high';
  return 'medium';
}

/**
 * Main function: Research keywords for a service + locations
 */
export async function researchKeywords(
  service: string,
  locations: string[]
): Promise<KeywordResearchResult> {
  // If DataForSEO isn't configured, return mock data
  if (!isDataForSEOConfigured()) {
    return getMockKeywordResearch(service, locations);
  }

  try {
    // Build seed keywords with location variations
    const seedKeywords: string[] = [];
    
    for (const location of locations) {
      seedKeywords.push(`${service} ${location}`);
      seedKeywords.push(`${service} ${location} ohio`);
      seedKeywords.push(`${service} near ${location}`);
    }
    
    // Also add generic service keywords
    seedKeywords.push(`${service} services`);
    seedKeywords.push(`${service} contractors`);
    seedKeywords.push(`${service} companies`);
    seedKeywords.push(`best ${service}`);
    seedKeywords.push(`${service} cost`);
    seedKeywords.push(`${service} near me`);

    // Get suggestions for primary seed
    const suggestions = await getKeywordSuggestions(
      `${service} ${locations[0]} ohio`,
      'United States'
    );

    // Get volume data for all keywords
    const allKeywords = [
      ...seedKeywords,
      ...suggestions.map(s => s.keyword),
    ];
    
    const volumeData = await getSearchVolume(allKeywords);

    // Process and deduplicate keywords
    const keywordMap = new Map<string, KeywordSuggestion>();
    
    for (const [kw, data] of volumeData) {
      if (data.searchVolume > 0) {
        keywordMap.set(kw, {
          term: data.keyword,
          volume: data.searchVolume,
          difficulty: mapDifficulty(data.competitionLevel, data.competition),
          cpc: data.cpc,
          trend: determineTrend(data.monthlySearches),
          intent: determineIntent(data.keyword),
        });
      }
    }

    // Add suggestions that might not have volume data
    for (const suggestion of suggestions) {
      const kw = suggestion.keyword.toLowerCase();
      if (!keywordMap.has(kw) && suggestion.searchVolume > 0) {
        keywordMap.set(kw, {
          term: suggestion.keyword,
          volume: suggestion.searchVolume,
          difficulty: mapDifficulty(suggestion.competitionLevel, suggestion.competition),
          cpc: suggestion.cpc,
          trend: determineTrend(suggestion.monthlySearches),
          intent: determineIntent(suggestion.keyword),
        });
      }
    }

    const keywords = Array.from(keywordMap.values());
    
    // Sort by volume
    keywords.sort((a, b) => b.volume - a.volume);

    // Calculate aggregates
    const totalVolume = keywords.reduce((sum, k) => sum + k.volume, 0);
    const averageCpc = keywords.length > 0
      ? keywords.reduce((sum, k) => sum + k.cpc, 0) / keywords.length
      : 0;

    // Get top keywords (highest volume)
    const topKeywords = keywords.slice(0, 10);

    // Get easy wins (low difficulty, volume > 50)
    const easyWins = keywords
      .filter(k => k.difficulty === 'low' && k.volume >= 50)
      .slice(0, 10);

    return {
      keywords: keywords.slice(0, 50),
      totalVolume,
      averageCpc,
      topKeywords,
      easyWins,
    };
  } catch (error) {
    console.error('DataForSEO error:', error);
    // Fall back to mock data on error
    return getMockKeywordResearch(service, locations);
  }
}

/**
 * Mock data for development/demo when DataForSEO isn't configured
 */
function getMockKeywordResearch(service: string, locations: string[]): KeywordResearchResult {
  const serviceMap: Record<string, string[]> = {
    'hardscaping': ['patio installation', 'retaining wall', 'stone pavers', 'outdoor living', 'hardscape design'],
    'landscape design': ['landscape design', 'backyard landscaping', 'front yard design', 'garden design', 'landscape architecture'],
    'lawn care': ['lawn care', 'lawn maintenance', 'grass cutting', 'lawn treatment', 'lawn service'],
    'outdoor lighting': ['outdoor lighting', 'landscape lighting', 'path lights', 'garden lights', 'accent lighting'],
    'irrigation': ['irrigation system', 'sprinkler installation', 'drip irrigation', 'lawn sprinklers', 'irrigation repair'],
  };

  const baseTerms = serviceMap[service.toLowerCase()] || [service];
  const keywords: KeywordSuggestion[] = [];

  // Generate location-specific keywords
  for (const location of locations) {
    for (const term of baseTerms) {
      keywords.push({
        term: `${term} ${location.toLowerCase()}`,
        volume: Math.floor(Math.random() * 500) + 100,
        difficulty: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
        cpc: Math.round((Math.random() * 10 + 2) * 100) / 100,
        trend: ['up', 'stable', 'down'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
        intent: 'transactional',
      });
      
      keywords.push({
        term: `${term} ${location.toLowerCase()} ohio`,
        volume: Math.floor(Math.random() * 300) + 50,
        difficulty: 'low',
        cpc: Math.round((Math.random() * 8 + 1.5) * 100) / 100,
        trend: 'stable',
        intent: 'transactional',
      });
    }
  }

  // Add generic keywords
  keywords.push(
    { term: `${service} near me`, volume: 720, difficulty: 'high', cpc: 8.50, trend: 'up', intent: 'transactional' },
    { term: `${service} cost`, volume: 480, difficulty: 'medium', cpc: 5.25, trend: 'stable', intent: 'commercial' },
    { term: `best ${service} companies`, volume: 320, difficulty: 'medium', cpc: 6.75, trend: 'up', intent: 'commercial' },
    { term: `${service} contractors`, volume: 590, difficulty: 'high', cpc: 7.80, trend: 'stable', intent: 'transactional' },
    { term: `${service} services`, volume: 410, difficulty: 'medium', cpc: 5.90, trend: 'stable', intent: 'transactional' },
  );

  // Sort by volume
  keywords.sort((a, b) => b.volume - a.volume);

  const totalVolume = keywords.reduce((sum, k) => sum + k.volume, 0);
  const averageCpc = keywords.reduce((sum, k) => sum + k.cpc, 0) / keywords.length;

  return {
    keywords: keywords.slice(0, 50),
    totalVolume,
    averageCpc: Math.round(averageCpc * 100) / 100,
    topKeywords: keywords.slice(0, 10),
    easyWins: keywords.filter(k => k.difficulty === 'low').slice(0, 10),
  };
}
