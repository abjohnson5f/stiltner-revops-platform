/**
 * Intelligence-Driven Ad Copy Generator
 * 
 * Uses market research data (keywords, pain points, customer language)
 * to generate compelling ad copy for Google Ads and Meta Ads.
 */

import Anthropic from "@anthropic-ai/sdk"

interface AdGenerationContext {
  service: string
  locations: string[]
  keywords: string[]
  painPoints: string[]
  praisePoints: string[]
  customerLanguage: string[]
  budget: string
  description?: string
}

interface GeneratedAd {
  platform: "google" | "meta"
  headlines: string[]
  descriptions: string[]
  keywords?: string[]
  targeting?: string[]
  imagePrompts?: string[]
}

interface AdGenerationResult {
  ads: GeneratedAd[]
  strategy: string
}

const SYSTEM_PROMPT = `You are an expert digital marketing copywriter specializing in local service businesses.
Your job is to create compelling ad copy that:
1. Uses the EXACT language and phrases that customers use (provided in customerLanguage)
2. Directly addresses customer pain points (what competitors do wrong)
3. Emphasizes what customers value most (from praisePoints)
4. Targets the specific service and locations provided

You write for both Google Ads and Meta (Facebook/Instagram) Ads.

Google Ads guidelines:
- Headlines: 30 characters max each, create 5-6 variations
- Descriptions: 90 characters max each, create 2-3 variations
- Include location and service keywords naturally
- Use action words and urgency when appropriate

Meta Ads guidelines:
- Headlines: Attention-grabbing, emotional hooks
- Body copy: Longer form, storytelling approach, 125-150 words
- Focus on transformation and benefits
- Include social proof elements when possible

Always output valid JSON matching the requested schema.`

/**
 * Generate ad copy using Claude AI
 */
export async function generateCampaignAds(
  context: AdGenerationContext
): Promise<AdGenerationResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  // If no API key, use fallback generation
  if (!anthropicKey) {
    return generateFallbackAds(context)
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey })

    const prompt = `Create ad copy for the following campaign:

SERVICE: ${context.service}
LOCATIONS: ${context.locations.join(", ")}
DAILY BUDGET: $${context.budget}

CUSTOMER KEYWORDS (use these exact terms):
${context.keywords.slice(0, 10).join(", ")}

PAIN POINTS TO ADDRESS (what competitors do wrong):
${context.painPoints.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join("\n")}

WHAT CUSTOMERS VALUE (emphasize these):
${context.praisePoints.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join("\n")}

CUSTOMER LANGUAGE (phrases customers actually use):
${context.customerLanguage.slice(0, 10).map((l) => `"${l}"`).join(", ")}

CAMPAIGN GOALS: ${context.description || "Generate high-quality leads"}

Generate compelling ad copy for both Google Ads and Meta Ads.

Output as JSON with this structure:
{
  "ads": [
    {
      "platform": "google",
      "headlines": ["headline1", "headline2", ...],
      "descriptions": ["desc1", "desc2"],
      "keywords": ["keyword1", "keyword2", ...]
    },
    {
      "platform": "meta",
      "headlines": ["headline1", "headline2", "headline3"],
      "descriptions": ["full ad copy 1", "full ad copy 2"],
      "targeting": ["targeting suggestion 1", ...],
      "imagePrompts": ["image prompt 1", ...]
    }
  ],
  "strategy": "Brief explanation of the ad strategy"
}`

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    })

    // Extract text content
    const textContent = message.content.find((c) => c.type === "text")
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from AI")
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("No JSON found in response")
    }

    const result = JSON.parse(jsonMatch[0]) as AdGenerationResult
    return result
  } catch (error) {
    console.error("AI ad generation error:", error)
    return generateFallbackAds(context)
  }
}

/**
 * Fallback ad generation when AI is not available
 */
function generateFallbackAds(context: AdGenerationContext): AdGenerationResult {
  const { service, locations, keywords, painPoints, praisePoints, customerLanguage } = context
  const locationStr = locations.slice(0, 2).join(" & ")

  // Create pain-point-based headlines
  const painHeadlines: string[] = []
  for (const pain of painPoints.slice(0, 3)) {
    const painLower = pain.toLowerCase()
    if (painLower.includes("call") || painLower.includes("response") || painLower.includes("respond")) {
      painHeadlines.push("Same-Day Response Guaranteed")
    } else if (painLower.includes("budget") || painLower.includes("price") || painLower.includes("cost")) {
      painHeadlines.push("Transparent Pricing Upfront")
    } else if (painLower.includes("mess") || painLower.includes("debris") || painLower.includes("clean")) {
      painHeadlines.push("Clean Job Sites Every Day")
    } else if (painLower.includes("late") || painLower.includes("time") || painLower.includes("delay")) {
      painHeadlines.push("On-Time, Every Project")
    } else if (painLower.includes("quality") || painLower.includes("shoddy")) {
      painHeadlines.push("Quality Craftsmanship")
    } else {
      painHeadlines.push("Professional & Reliable")
    }
  }

  // Create customer-language-based headlines
  const languageHeadline = customerLanguage[0]
    ? `Your ${customerLanguage[0].charAt(0).toUpperCase() + customerLanguage[0].slice(1)} Awaits`
    : `Expert ${service}`

  // Create value-based descriptions
  const valueStatements = praisePoints.slice(0, 2).map((p) => {
    const pLower = p.toLowerCase()
    if (pLower.includes("communication")) return "excellent communication throughout"
    if (pLower.includes("professional")) return "professional, courteous service"
    if (pLower.includes("time")) return "on-time completion"
    if (pLower.includes("clean")) return "clean, organized work"
    if (pLower.includes("price") || pLower.includes("fair")) return "fair, transparent pricing"
    if (pLower.includes("quality")) return "exceptional craftsmanship"
    if (pLower.includes("recommend")) return "highly recommended by neighbors"
    return p.toLowerCase()
  })

  return {
    ads: [
      {
        platform: "google",
        headlines: [
          `${service} - ${locationStr}`.slice(0, 30),
          languageHeadline.slice(0, 30),
          ...painHeadlines.slice(0, 3),
          "Free Estimates Available",
          "20+ Years Experience",
        ].slice(0, 6),
        descriptions: [
          `Professional ${service.toLowerCase()} in ${locationStr}. ${valueStatements[0] ? valueStatements[0].charAt(0).toUpperCase() + valueStatements[0].slice(1) : "Quality guaranteed"}. Get your free estimate today!`.slice(0, 90),
          `Looking for reliable ${service.toLowerCase()}? We deliver ${valueStatements[1] || "exceptional results"} with upfront pricing. Call now!`.slice(0, 90),
          `${locationStr} homeowners trust us for ${service.toLowerCase()}. ${painHeadlines[0] || "Professional service"}. Schedule your free consultation!`.slice(0, 90),
        ].slice(0, 3),
        keywords: keywords.slice(0, 15),
      },
      {
        platform: "meta",
        headlines: [
          `Transform Your Outdoor Space`,
          `${service} Done Right - ${locationStr}`,
          painHeadlines[0] || "Quality You Can Trust",
        ],
        descriptions: [
          `Ready for a ${customerLanguage[0] || "beautiful transformation"}? 🏡\n\nOur ${service.toLowerCase()} team in ${locationStr} delivers what others promise. ${painPoints[0] ? `Tired of contractors who ${painPoints[0].toLowerCase()}? We're different.` : ""}\n\n✅ ${valueStatements[0] ? valueStatements[0].charAt(0).toUpperCase() + valueStatements[0].slice(1) : "Professional service"}\n✅ ${valueStatements[1] ? valueStatements[1].charAt(0).toUpperCase() + valueStatements[1].slice(1) : "Quality guaranteed"}\n✅ Free estimates\n\nSpots filling up for spring season - book your consultation today!`,
          `${locationStr} homeowners are raving about their new ${customerLanguage[0] || "outdoor spaces"}! 🌟\n\n"${praisePoints[0] || "Excellent work and great communication"}" - Recent customer\n\nWe specialize in ${service.toLowerCase()} that stands the test of time. No surprises, no excuses - just beautiful results.\n\n📞 Get your free estimate: Limited spring availability!\n\n#${locations[0]?.replace(/\s/g, "")}Landscaping #OutdoorLiving`,
        ],
        targeting: [
          `Homeowners in ${locations.join(", ")}, Ohio area`,
          "Interests: Home improvement, Outdoor living, Landscaping, DIY",
          "Age: 35-65",
          "Household income: Top 30%",
          "Homeowners (exclude renters)",
          `Behavior: Recently searched for ${service.toLowerCase()} services`,
        ],
        imagePrompts: [
          `Beautiful ${service.toLowerCase()} project, ${customerLanguage[0] || "backyard patio"}, luxury Ohio home, professional photography, golden hour lighting, manicured lawn`,
          `Before and after ${service.toLowerCase()} transformation, residential property, ${locationStr} architectural style, dramatic improvement`,
          `Happy homeowner family enjoying ${customerLanguage[0] || "outdoor living space"}, ${service.toLowerCase()} in background, lifestyle photography`,
        ],
      },
    ],
    strategy: `This campaign targets ${locations.join(", ")} homeowners searching for ${service.toLowerCase()} services. Headlines address common pain points (${painHeadlines.slice(0, 2).join(", ")}) while emphasizing what customers value most (${valueStatements.slice(0, 2).join(", ")}). The ad copy uses actual customer language like "${customerLanguage.slice(0, 3).join('", "')}" to improve relevance and click-through rates.`,
  }
}

/**
 * Generate manual instructions for creating campaigns
 */
export function generateManualInstructions(
  ad: GeneratedAd,
  campaignName: string,
  budget: string
): string {
  if (ad.platform === "google") {
    return `# Google Ads Campaign: ${campaignName}

## Step 1: Create New Campaign
1. Go to [ads.google.com](https://ads.google.com)
2. Click "+ New Campaign"
3. Select "Leads" as your goal
4. Choose "Search" as campaign type
5. Name your campaign: "${campaignName}"

## Step 2: Set Budget & Bidding
- Daily budget: $${budget}
- Bidding strategy: Maximize conversions (recommended)
- Or set a target CPA if you know your cost per lead

## Step 3: Configure Targeting
- Locations: Target the specific cities/zip codes
- Language: English
- Audience: Leave broad initially, narrow based on performance

## Step 4: Create Ad Group
Name: "${campaignName} - Main"

### Add Keywords:
${ad.keywords?.map((kw) => `- [${kw}] (Exact match)\n- "${kw}" (Phrase match)`).join("\n") || "Add your target keywords"}

## Step 5: Create Responsive Search Ad

### Headlines (add all):
${ad.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

### Descriptions (add all):
${ad.descriptions.map((d, i) => `${i + 1}. ${d}`).join("\n")}

### Final URL: https://stiltnerlandscapes.com/contact

## Step 6: Add Extensions
- Call extension: (614) YOUR-NUMBER
- Sitelink extensions: Services, Gallery, About Us, Contact
- Callout extensions: Free Estimates, Licensed & Insured, 20+ Years

## Step 7: Review & Launch
- Review all settings
- Set campaign to PAUSED initially to review
- When ready, enable the campaign

---
*Generated by Stiltner Campaign Builder*`
  } else {
    return `# Meta Ads Campaign: ${campaignName}

## Step 1: Access Ads Manager
1. Go to [business.facebook.com/adsmanager](https://business.facebook.com/adsmanager)
2. Click "+ Create"

## Step 2: Choose Objective
- Select "Leads" as your campaign objective
- Name your campaign: "${campaignName}"
- Enable Advantage Campaign Budget: $${budget}/day

## Step 3: Configure Ad Set

### Targeting:
${ad.targeting?.map((t) => `- ${t}`).join("\n") || "Configure your audience"}

### Placements:
- Use "Advantage+ Placements" OR manually select:
  - Facebook Feed
  - Instagram Feed
  - Facebook Marketplace
  - Instagram Explore

### Budget & Schedule:
- Daily budget: $${budget}
- Run continuously (or set end date)

## Step 4: Create Ad

### Format: Single Image or Carousel

### Primary Text (choose one):
${ad.descriptions.map((d, i) => `\n**Variation ${i + 1}:**\n${d}`).join("\n")}

### Headline Options:
${ad.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

### Call to Action: "Get Quote" or "Learn More"

### Destination: https://stiltnerlandscapes.com/contact

## Step 5: Create Images
Use these prompts with AI image generators (Midjourney, DALL-E, etc.):

${ad.imagePrompts?.map((p, i) => `**Image ${i + 1}:** ${p}`).join("\n\n") || "Create relevant images for your service"}

### Image Specs:
- Recommended: 1080 x 1080 (square) or 1200 x 628 (landscape)
- Max file size: 30MB
- Format: JPG or PNG

## Step 6: Set Up Lead Form (Optional)
If using Instant Forms:
1. Create new form
2. Add fields: Name, Email, Phone
3. Add custom question: "What service are you interested in?"
4. Privacy policy URL: https://stiltnerlandscapes.com/privacy

## Step 7: Review & Publish
- Preview ads on different placements
- Check all targeting settings
- Submit for review (usually approved within 24 hours)

---
*Generated by Stiltner Campaign Builder*`
  }
}
