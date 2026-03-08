"use client"

import * as React from "react"
import { CheckCircle2, AlertCircle, Loader2, Search, Sparkles, Rocket, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MultiSelect, STILTNER_SERVICE_AREAS, DEFAULT_LOCATIONS } from "@/components/ui/multi-select"
import { MarketResearch } from "@/components/campaign/MarketResearch"
import { ExportInstructions } from "@/components/campaign/ExportInstructions"
import type { KeywordResearchResult } from "@/lib/dataforseo"
import type { MarketIntelligence } from "@/lib/apify"

const STEPS = ["Service & Goals", "Market Research", "Targeting", "Ad Generation", "Launch"]

const SERVICES = [
  { value: "hardscaping", label: "Hardscaping" },
  { value: "landscape-design", label: "Landscape Design" },
  { value: "lawn-care", label: "Lawn Care & Maintenance" },
  { value: "outdoor-lighting", label: "Outdoor Lighting" },
  { value: "irrigation", label: "Irrigation Systems" },
  { value: "seasonal", label: "Seasonal Services" },
  { value: "planting", label: "Planting & Gardens" },
]

interface GeneratedAd {
  platform: "google" | "meta"
  headlines: string[]
  descriptions: string[]
  keywords?: string[]
  targeting?: string[]
  imagePrompts?: string[]
}

export default function CampaignBuilderPage() {
  const [step, setStep] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isResearching, setIsResearching] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Step 1: Service & Goals
  const [service, setService] = React.useState("")
  const [description, setDescription] = React.useState("")

  // Step 2: Market Research Results
  const [keywordData, setKeywordData] = React.useState<KeywordResearchResult | null>(null)
  const [competitorData, setCompetitorData] = React.useState<MarketIntelligence | null>(null)
  const [selectedKeywords, setSelectedKeywords] = React.useState<string[]>([])
  const [selectedPainPoints, setSelectedPainPoints] = React.useState<string[]>([])
  const [selectedPraise, setSelectedPraise] = React.useState<string[]>([])

  // Step 3: Targeting
  const [locations, setLocations] = React.useState<string[]>(DEFAULT_LOCATIONS)
  const [budget, setBudget] = React.useState("50")

  // Step 4: Generated Ads
  const [generatedAds, setGeneratedAds] = React.useState<GeneratedAd[]>([])

  // Step 5: Launch Result
  const [launchResult, setLaunchResult] = React.useState<any>(null)

  // Run market research when moving from step 1 to step 2
  const runResearch = async () => {
    if (!service || locations.length === 0) {
      setError("Please select a service and at least one location")
      return
    }

    setIsResearching(true)
    setError(null)

    try {
      // Get location labels for API
      const locationLabels = locations.map(
        (loc) => STILTNER_SERVICE_AREAS.find((a) => a.value === loc)?.label || loc
      )

      // Get service label
      const serviceLabel = SERVICES.find((s) => s.value === service)?.label || service

      // Fetch keyword data
      const keywordRes = await fetch("/api/research/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: serviceLabel, locations: locationLabels }),
      })
      const keywordJson = await keywordRes.json()
      if (keywordJson.success) {
        setKeywordData(keywordJson.data)
        // Auto-select top 5 keywords
        const topTerms = keywordJson.data.topKeywords.slice(0, 5).map((k: any) => k.term)
        setSelectedKeywords(topTerms)
      }

      // Fetch competitor data
      const competitorRes = await fetch("/api/research/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: serviceLabel, locations: locationLabels }),
      })
      const competitorJson = await competitorRes.json()
      if (competitorJson.success) {
        setCompetitorData(competitorJson.data)
        // Auto-select top pain points
        const topPains = competitorJson.data.painPoints.slice(0, 3)
        setSelectedPainPoints(topPains)
        // Auto-select top praise points
        const topPraise = competitorJson.data.praisePoints.slice(0, 3)
        setSelectedPraise(topPraise)
      }

      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed")
    } finally {
      setIsResearching(false)
    }
  }

  // Generate ad copy using intelligence data
  const generateAds = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const serviceLabel = SERVICES.find((s) => s.value === service)?.label || service
      const locationLabels = locations.map(
        (loc) => STILTNER_SERVICE_AREAS.find((a) => a.value === loc)?.label || loc
      )

      // Build the intelligence context
      const context = {
        service: serviceLabel,
        locations: locationLabels,
        keywords: selectedKeywords,
        painPoints: selectedPainPoints,
        praisePoints: selectedPraise,
        customerLanguage: competitorData?.customerLanguage || [],
        budget,
        description,
      }

      // Call AI to generate ads
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-campaign-ads",
          context,
        }),
      })

      const json = await res.json()

      if (json.success && json.data) {
        setGeneratedAds(json.data.ads || [])
      } else {
        // Generate fallback ads locally
        setGeneratedAds(generateFallbackAds(context))
      }

      setStep(4)
    } catch (err) {
      // Use fallback generation
      const serviceLabel = SERVICES.find((s) => s.value === service)?.label || service
      const locationLabels = locations.map(
        (loc) => STILTNER_SERVICE_AREAS.find((a) => a.value === loc)?.label || loc
      )
      setGeneratedAds(
        generateFallbackAds({
          service: serviceLabel,
          locations: locationLabels,
          keywords: selectedKeywords,
          painPoints: selectedPainPoints,
          praisePoints: selectedPraise,
          customerLanguage: competitorData?.customerLanguage || [],
          budget,
          description,
        })
      )
      setStep(4)
    } finally {
      setIsLoading(false)
    }
  }

  // Fallback ad generation
  const generateFallbackAds = (context: any): GeneratedAd[] => {
    const { service, locations, painPoints, praisePoints, customerLanguage } = context
    const locationStr = locations.slice(0, 2).join(" & ")

    // Address pain points in headlines
    const painBasedHeadlines = painPoints.slice(0, 2).map((pain: string) => {
      if (pain.toLowerCase().includes("call") || pain.toLowerCase().includes("response")) {
        return "Same-Day Response Guaranteed"
      }
      if (pain.toLowerCase().includes("budget") || pain.toLowerCase().includes("price")) {
        return "Transparent Pricing - No Surprises"
      }
      if (pain.toLowerCase().includes("mess") || pain.toLowerCase().includes("debris")) {
        return "Clean Job Sites, Every Time"
      }
      if (pain.toLowerCase().includes("late") || pain.toLowerCase().includes("time")) {
        return "On-Time, Every Time"
      }
      return "Professional & Reliable Service"
    })

    // Use customer language
    const languageHeadline = customerLanguage[0]
      ? `Transform Your ${customerLanguage[0].charAt(0).toUpperCase() + customerLanguage[0].slice(1)}`
      : `Expert ${service} Services`

    return [
      {
        platform: "google",
        headlines: [
          `${service} in ${locationStr}`,
          languageHeadline,
          ...painBasedHeadlines,
          "Free Estimates Available",
          "20+ Years Experience",
        ].slice(0, 5),
        descriptions: [
          `Professional ${service.toLowerCase()} services in ${locationStr}. ${praisePoints[0] || "Quality work guaranteed"}. Get your free estimate today!`,
          `Looking for reliable ${service.toLowerCase()}? We deliver ${praisePoints[1] || "exceptional results"} with transparent pricing. Call now!`,
        ],
        keywords: selectedKeywords.slice(0, 10),
      },
      {
        platform: "meta",
        headlines: [
          `Transform Your Outdoor Space`,
          `${service} Experts - ${locationStr}`,
          painBasedHeadlines[0] || "Quality You Can Trust",
        ],
        descriptions: [
          `Ready for a ${customerLanguage[0] || "backyard transformation"}? Our ${service.toLowerCase()} team in ${locationStr} delivers ${praisePoints[0] || "beautiful results"}. ${painPoints[0] ? `Unlike others, we ${painBasedHeadlines[0]?.toLowerCase() || "respond same-day"}.` : ""} Book your free consultation!`,
          `${locationStr} homeowners love our ${service.toLowerCase()} services. ${praisePoints.slice(0, 2).join(". ")}. Limited spots available this season - get your free estimate now!`,
        ],
        targeting: [
          `Homeowners in ${locations.join(", ")} area`,
          "Interest: Home improvement, Outdoor living, Landscaping",
          "Age: 35-65",
          "Household income: Top 30%",
        ],
        imagePrompts: [
          `Beautiful ${service.toLowerCase()} project, ${customerLanguage[0] || "backyard"}, luxury home, Ohio, professional photography, golden hour`,
          `Before and after ${service.toLowerCase()} transformation, residential, ${locationStr} style`,
        ],
      },
    ]
  }

  // Handle campaign launch
  const handleLaunch = async (platform: "google" | "meta" | "both") => {
    setIsLoading(true)
    setError(null)

    try {
      const serviceLabel = SERVICES.find((s) => s.value === service)?.label || service
      const locationLabels = locations.map(
        (loc) => STILTNER_SERVICE_AREAS.find((a) => a.value === loc)?.label || loc
      )

      const campaignName = `${serviceLabel} - ${locationLabels.slice(0, 2).join("/")} - ${new Date().toLocaleDateString()}`
      
      const campaignData = {
        name: campaignName,
        service: serviceLabel,
        locations: locationLabels,
        budget: parseFloat(budget),
        keywords: selectedKeywords,
        ads: generatedAds,
      }

      let googleResult = null
      let metaResult = null

      // Create Google Ads campaign if requested
      if (platform === "google" || platform === "both") {
        const googleAd = generatedAds.find((a) => a.platform === "google")
        if (googleAd) {
          const res = await fetch("/api/campaigns/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform: "google",
              name: campaignName,
              budget: parseFloat(budget),
              keywords: googleAd.keywords || selectedKeywords,
              headlines: googleAd.headlines,
              descriptions: googleAd.descriptions,
              finalUrl: "https://stiltnerlandscapes.com/contact",
            }),
          })
          googleResult = await res.json()
        }
      }

      // For Meta, we still use manual mode (API not connected yet)
      if (platform === "meta" || platform === "both") {
        metaResult = { success: true, manual: true }
      }

      // Determine result message
      let message = ""
      if (platform === "google") {
        message = googleResult?.success 
          ? `Google Ads campaign created (PAUSED). ID: ${googleResult.campaignId || "Created"}`
          : `Google Ads: ${googleResult?.error || "Manual creation required"}`
      } else if (platform === "meta") {
        message = "Meta Ads ready for manual creation"
      } else {
        const gMsg = googleResult?.success ? "Google Ads created (PAUSED)" : "Google Ads ready for manual creation"
        message = `${gMsg}. Meta Ads ready for manual creation.`
      }

      setLaunchResult({
        success: googleResult?.success || metaResult?.success,
        platform,
        campaignData,
        googleResult,
        metaResult,
        message,
      })

      setStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed")
    } finally {
      setIsLoading(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return service && locations.length > 0
      case 2:
        return selectedKeywords.length > 0
      case 3:
        return budget && parseFloat(budget) > 0
      case 4:
        return generatedAds.length > 0
      default:
        return true
    }
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Campaign Builder</h2>
        <p className="text-muted-foreground">
          AI-powered campaign creation with market intelligence
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -z-10 -translate-y-1/2" />
        {STEPS.map((label, i) => {
          const s = i + 1
          const isActive = s === step
          const isCompleted = s < step
          return (
            <div key={s} className="flex flex-col items-center gap-2 bg-background px-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  isActive
                    ? "border-green-600 bg-green-600 text-white"
                    : isCompleted
                    ? "border-green-600 text-green-600"
                    : "border-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? <CheckCircle2 size={16} /> : s}
              </div>
              <span
                className={`text-xs text-center max-w-[80px] ${
                  isActive ? "font-bold" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Service & Goals */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Service & Goals
            </CardTitle>
            <CardDescription>
              Select the service to promote and describe your campaign goals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Service to Promote</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service..." />
                </SelectTrigger>
                <SelectContent>
                  {SERVICES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Locations</Label>
              <MultiSelect
                options={STILTNER_SERVICE_AREAS}
                selected={locations}
                onChange={setLocations}
                placeholder="Select service areas..."
              />
              <p className="text-xs text-muted-foreground">
                Select the areas you want to target with this campaign
              </p>
            </div>

            <div className="space-y-2">
              <Label>Campaign Goals (Optional)</Label>
              <Textarea
                placeholder="e.g., Generate leads for spring patio installations, target homeowners interested in outdoor living..."
                className="h-24"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={runResearch} disabled={!canProceed() || isResearching}>
              {isResearching ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Researching Market...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Research Market
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Market Research */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Market Research Results
              </CardTitle>
              <CardDescription>
                Review keywords, competitor insights, and customer language.
                Select items to include in your ad copy.
              </CardDescription>
            </CardHeader>
          </Card>

          <MarketResearch
            keywordData={keywordData}
            competitorData={competitorData}
            isLoading={isResearching}
            selectedKeywords={selectedKeywords}
            onKeywordsChange={setSelectedKeywords}
            selectedPainPoints={selectedPainPoints}
            onPainPointsChange={setSelectedPainPoints}
            selectedPraise={selectedPraise}
            onPraiseChange={setSelectedPraise}
          />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!canProceed()}>
              Continue to Targeting
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Targeting */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Targeting & Budget</CardTitle>
            <CardDescription>Set your daily budget and review targeting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Daily Budget ($)</Label>
                <Input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  min="10"
                  step="10"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: $50-100/day for local service campaigns
                </p>
              </div>

              <div className="space-y-2">
                <Label>Selected Locations ({locations.length})</Label>
                <div className="flex flex-wrap gap-1">
                  {locations.map((loc) => (
                    <span
                      key={loc}
                      className="px-2 py-1 text-xs bg-muted rounded"
                    >
                      {STILTNER_SERVICE_AREAS.find((a) => a.value === loc)?.label || loc}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Selected Keywords ({selectedKeywords.length})</Label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {selectedKeywords.map((kw) => (
                  <span key={kw} className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pain Points to Address ({selectedPainPoints.length})</Label>
                <div className="text-sm text-muted-foreground">
                  {selectedPainPoints.slice(0, 3).map((p, i) => (
                    <div key={i}>• {p}</div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Value Props to Emphasize ({selectedPraise.length})</Label>
                <div className="text-sm text-muted-foreground">
                  {selectedPraise.slice(0, 3).map((p, i) => (
                    <div key={i}>• {p}</div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={generateAds} disabled={!canProceed() || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Generating Ads...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Ad Copy
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Ad Generation */}
      {step === 4 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Generated Ad Copy
              </CardTitle>
              <CardDescription>
                Review the AI-generated ad copy for Google Ads and Meta Ads
              </CardDescription>
            </CardHeader>
          </Card>

          <Tabs defaultValue="google">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="google">Google Ads</TabsTrigger>
              <TabsTrigger value="meta">Meta Ads</TabsTrigger>
            </TabsList>

            {generatedAds.map((ad) => (
              <TabsContent key={ad.platform} value={ad.platform}>
                <Card>
                  <CardContent className="pt-6 space-y-6">
                    <div className="space-y-3">
                      <Label>Headlines</Label>
                      {ad.headlines.map((h, i) => (
                        <div
                          key={i}
                          className="p-3 bg-muted rounded-lg text-sm font-medium"
                        >
                          {h}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <Label>Descriptions</Label>
                      {ad.descriptions.map((d, i) => (
                        <div key={i} className="p-3 bg-muted rounded-lg text-sm">
                          {d}
                        </div>
                      ))}
                    </div>

                    {ad.keywords && ad.keywords.length > 0 && (
                      <div className="space-y-2">
                        <Label>Keywords</Label>
                        <div className="flex flex-wrap gap-1">
                          {ad.keywords.map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {ad.targeting && ad.targeting.length > 0 && (
                      <div className="space-y-2">
                        <Label>Targeting Suggestions</Label>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {ad.targeting.map((t, i) => (
                            <li key={i}>• {t}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ad.imagePrompts && ad.imagePrompts.length > 0 && (
                      <div className="space-y-2">
                        <Label>Image Prompts (for AI generation)</Label>
                        {ad.imagePrompts.map((p, i) => (
                          <div
                            key={i}
                            className="p-2 text-xs bg-muted/50 rounded italic"
                          >
                            {p}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <div className="flex gap-2">
              <ExportInstructions
                ads={generatedAds}
                campaignName={`${SERVICES.find((s) => s.value === service)?.label || service} - ${locations.slice(0, 2).map((l) => STILTNER_SERVICE_AREAS.find((a) => a.value === l)?.label || l).join("/")}`}
                budget={budget}
                service={SERVICES.find((s) => s.value === service)?.label || service}
                locations={locations.map((l) => STILTNER_SERVICE_AREAS.find((a) => a.value === l)?.label || l)}
              />
              <Button variant="outline" onClick={() => handleLaunch("google")}>
                <Rocket className="mr-2 h-4 w-4" />
                Launch Google Ads
              </Button>
              <Button variant="outline" onClick={() => handleLaunch("meta")}>
                <Rocket className="mr-2 h-4 w-4" />
                Launch Meta Ads
              </Button>
              <Button onClick={() => handleLaunch("both")}>
                <Rocket className="mr-2 h-4 w-4" />
                Launch Both
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Launch */}
      {step === 5 && launchResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-500 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Campaign Ready!
            </CardTitle>
            <CardDescription>{launchResult.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="h-16 w-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium">What&apos;s Next?</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Your campaign has been prepared. Use the export options below to create
                  the campaign in your ad platforms.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Google Ads</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="outline" asChild>
                    <a
                      href="https://ads.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Google Ads Manager
                    </a>
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      const googleAd = generatedAds.find((a) => a.platform === "google")
                      if (googleAd) {
                        const text = `# Google Ads Campaign: ${launchResult.campaignData.name}\n\n## Headlines:\n${googleAd.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\n## Descriptions:\n${googleAd.descriptions.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n\n## Keywords:\n${googleAd.keywords?.join(", ")}\n\n## Budget: $${budget}/day`
                        navigator.clipboard.writeText(text)
                      }
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Copy Campaign Details
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Meta Ads</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="outline" asChild>
                    <a
                      href="https://business.facebook.com/adsmanager"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Meta Ads Manager
                    </a>
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      const metaAd = generatedAds.find((a) => a.platform === "meta")
                      if (metaAd) {
                        const text = `# Meta Ads Campaign: ${launchResult.campaignData.name}\n\n## Headlines:\n${metaAd.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\n## Ad Copy:\n${metaAd.descriptions.map((d, i) => `Variation ${i + 1}:\n${d}`).join("\n\n")}\n\n## Targeting:\n${metaAd.targeting?.join("\n")}\n\n## Image Prompts:\n${metaAd.imagePrompts?.join("\n")}\n\n## Budget: $${budget}/day`
                        navigator.clipboard.writeText(text)
                      }
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Copy Campaign Details
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => window.location.reload()}>
              Create Another Campaign
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
