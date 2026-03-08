"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  Search, 
  Sparkles,
  AlertTriangle,
  ThumbsUp,
  MessageSquare,
  Download,
  Settings,
  Rocket
} from "lucide-react"
import { MultiSelect, STILTNER_SERVICE_AREAS, DEFAULT_LOCATIONS } from "@/components/ui/multi-select"
import type { MarketIntelligence } from "@/lib/apify"
import type { KeywordResearchResult } from "@/lib/dataforseo"

const SERVICES = [
  { value: "landscape-design", label: "Landscape Design" },
  { value: "hardscaping", label: "Hardscaping" },
  { value: "lawn-care", label: "Lawn Care & Maintenance" },
  { value: "outdoor-lighting", label: "Outdoor Lighting" },
  { value: "irrigation", label: "Irrigation Systems" },
  { value: "seasonal", label: "Seasonal Services" },
  { value: "planting", label: "Planting & Gardens" },
]

const OBJECTIVES = [
  { value: "leads", label: "Lead Generation" },
  { value: "awareness", label: "Brand Awareness" },
  { value: "traffic", label: "Website Traffic" },
  { value: "engagement", label: "Engagement" },
]

interface AdVariation {
  headline: string
  body: string
  cta: string
}

interface MetaAdCreative {
  variations: AdVariation[]
  targeting: string[]
  imagePrompts: string[]
  strategy: string
}

export default function MetaAdsPage() {
  // Configuration state
  const [service, setService] = React.useState<string>("hardscaping")
  const [locations, setLocations] = React.useState<string[]>(DEFAULT_LOCATIONS)
  const [objective, setObjective] = React.useState<string>("leads")
  const [budget, setBudget] = React.useState<string>("50")
  const [description, setDescription] = React.useState<string>("")
  
  // Research state
  const [competitorData, setCompetitorData] = React.useState<MarketIntelligence | null>(null)
  const [isResearching, setIsResearching] = React.useState(false)
  const [hasResearched, setHasResearched] = React.useState(false)
  
  // Selection state
  const [selectedPainPoints, setSelectedPainPoints] = React.useState<string[]>([])
  const [selectedPraise, setSelectedPraise] = React.useState<string[]>([])
  
  // Generation state
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [creative, setCreative] = React.useState<MetaAdCreative | null>(null)
  const [copied, setCopied] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  
  // API status
  const [metaApiConfigured, setMetaApiConfigured] = React.useState<boolean | null>(null)

  // Check if Meta API is configured
  React.useEffect(() => {
    fetch("/api/meta/health")
      .then(res => res.json())
      .then(data => setMetaApiConfigured(data.success))
      .catch(() => setMetaApiConfigured(false))
  }, [])

  // Run market research
  const runResearch = async () => {
    if (!service || locations.length === 0) {
      setError("Please select a service and at least one location")
      return
    }

    setIsResearching(true)
    setError(null)

    try {
      const locationLabels = locations.map(
        (loc) => STILTNER_SERVICE_AREAS.find((a) => a.value === loc)?.label || loc
      )
      const serviceLabel = SERVICES.find((s) => s.value === service)?.label || service

      const res = await fetch("/api/research/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: serviceLabel, locations: locationLabels }),
      })
      
      const json = await res.json()
      if (json.success) {
        setCompetitorData(json.data)
        // Auto-select top items
        setSelectedPainPoints(json.data.painPoints.slice(0, 3))
        setSelectedPraise(json.data.praisePoints.slice(0, 3))
        setHasResearched(true)
      } else {
        setError(json.error || "Research failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed")
    } finally {
      setIsResearching(false)
    }
  }

  // Generate ad creative using market intelligence
  const generateCreative = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const serviceLabel = SERVICES.find((s) => s.value === service)?.label || service
      const locationLabels = locations.map(
        (loc) => STILTNER_SERVICE_AREAS.find((a) => a.value === loc)?.label || loc
      )

      const context = {
        service: serviceLabel,
        locations: locationLabels,
        keywords: [], // We focus on competitor intelligence for Meta
        painPoints: selectedPainPoints,
        praisePoints: selectedPraise,
        customerLanguage: competitorData?.customerLanguage || [],
        budget,
        description,
      }

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
        const metaAd = json.data.ads?.find((a: any) => a.platform === "meta")
        if (metaAd) {
          setCreative({
            variations: metaAd.descriptions.map((body: string, i: number) => ({
              headline: metaAd.headlines[i] || metaAd.headlines[0],
              body,
              cta: "Get Quote",
            })),
            targeting: metaAd.targeting || [],
            imagePrompts: metaAd.imagePrompts || [],
            strategy: json.data.strategy || "",
          })
        } else {
          // Fallback to local generation
          generateFallbackCreative(context)
        }
      } else {
        generateFallbackCreative({
          service: serviceLabel,
          locations: locationLabels,
          painPoints: selectedPainPoints,
          praisePoints: selectedPraise,
          customerLanguage: competitorData?.customerLanguage || [],
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setIsGenerating(false)
    }
  }

  // Fallback local generation
  const generateFallbackCreative = (context: any) => {
    const { service, locations, painPoints, praisePoints, customerLanguage } = context
    const locationStr = locations.slice(0, 2).join(" & ")

    const painHeadlines = painPoints.slice(0, 2).map((pain: string) => {
      const p = pain.toLowerCase()
      if (p.includes("call") || p.includes("response")) return "Same-Day Response"
      if (p.includes("price") || p.includes("budget")) return "Transparent Pricing"
      if (p.includes("mess") || p.includes("clean")) return "Clean Work Sites"
      if (p.includes("late") || p.includes("time")) return "Always On Time"
      return "Quality Guaranteed"
    })

    setCreative({
      variations: [
        {
          headline: `Transform Your Outdoor Space`,
          body: `Ready for a ${customerLanguage[0] || "beautiful backyard"}? 🏡\n\nOur ${service.toLowerCase()} team in ${locationStr} delivers what others promise. ${painPoints[0] ? `Tired of contractors who ${painPoints[0].toLowerCase()}? We're different.` : ""}\n\n✅ ${praisePoints[0] || "Professional service"}\n✅ ${praisePoints[1] || "Quality guaranteed"}\n✅ Free estimates\n\nBook your consultation today!`,
          cta: "Get Free Quote",
        },
        {
          headline: painHeadlines[0] || `${service} Done Right`,
          body: `${locationStr} homeowners are raving about their new ${customerLanguage[0] || "outdoor spaces"}! 🌟\n\n"${praisePoints[0] || "Excellent work"}" - Recent customer\n\nWe specialize in ${service.toLowerCase()} that stands the test of time. No surprises, no excuses - just beautiful results.\n\n📞 Get your free estimate today!`,
          cta: "Schedule Estimate",
        },
        {
          headline: `${service} Experts - ${locationStr}`,
          body: `Looking for reliable ${service.toLowerCase()} in ${locationStr}?\n\nWe've helped hundreds of homeowners transform their outdoor spaces. Our promise:\n\n🔹 ${painHeadlines[0] || "Professional service"}\n🔹 ${praisePoints[0] || "Quality workmanship"}\n🔹 20+ years experience\n\nLimited spots for spring - reserve yours now!`,
          cta: "Book Now",
        },
      ],
      targeting: [
        `Homeowners in ${locations.join(", ")}, Ohio area`,
        "Interests: Home improvement, Outdoor living, Landscaping, DIY",
        "Age: 35-65",
        "Household income: Top 30%",
        "Homeowners (exclude renters)",
      ],
      imagePrompts: [
        `Beautiful ${service.toLowerCase()} project, ${customerLanguage[0] || "backyard patio"}, luxury Ohio home, professional photography, golden hour`,
        `Before and after ${service.toLowerCase()} transformation, residential, dramatic improvement`,
        `Happy homeowner family enjoying outdoor space, ${service.toLowerCase()} showcase, lifestyle photography`,
      ],
      strategy: `This campaign targets ${locationStr} homeowners using pain-point messaging that addresses competitor weaknesses (${painHeadlines.join(", ")}) while emphasizing proven value propositions (${praisePoints.slice(0, 2).join(", ")}).`,
    })
  }

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const downloadInstructions = () => {
    if (!creative) return

    const serviceLabel = SERVICES.find((s) => s.value === service)?.label || service
    const locationLabels = locations.map(
      (loc) => STILTNER_SERVICE_AREAS.find((a) => a.value === loc)?.label || loc
    )
    const campaignName = `${serviceLabel} - ${locationLabels.slice(0, 2).join("/")}`

    const content = `# Meta Ads Campaign: ${campaignName}

## Objective: ${OBJECTIVES.find(o => o.value === objective)?.label || objective}
## Daily Budget: $${budget}

---

## Ad Variations

${creative.variations.map((v, i) => `
### Variation ${i + 1}
**Headline:** ${v.headline}

**Body:**
${v.body}

**CTA Button:** ${v.cta}
`).join("\n")}

---

## Targeting Settings

${creative.targeting.map(t => `- ${t}`).join("\n")}

---

## Image Prompts (for AI generation)

${creative.imagePrompts.map((p, i) => `${i + 1}. ${p}`).join("\n")}

---

## Strategy Notes

${creative.strategy}

---

## Step-by-Step Setup Guide

1. Go to business.facebook.com/adsmanager
2. Click "+ Create"
3. Select "${OBJECTIVES.find(o => o.value === objective)?.label || "Leads"}" objective
4. Name: "${campaignName}"
5. Budget: $${budget}/day (Advantage Campaign Budget)
6. Set targeting as listed above
7. Create ad using variations provided
8. Add images using the prompts above
9. Review and publish

---
*Generated by Stiltner Campaign Builder*
`

    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `meta-ads-${campaignName.toLowerCase().replace(/\s+/g, "-")}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meta Ads Creative Generator</h1>
          <p className="text-sm text-muted-foreground">
            Generate Facebook & Instagram ads using market intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          {metaApiConfigured === null ? (
            <Badge variant="outline">Checking API...</Badge>
          ) : metaApiConfigured ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              API Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
              Manual Mode
            </Badge>
          )}
        </div>
      </div>

      {!metaApiConfigured && metaApiConfigured !== null && (
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertTitle>API Not Configured</AlertTitle>
          <AlertDescription>
            Meta Ads API is not set up. Ads will be generated for manual creation.{" "}
            <a href="/docs/META-ADS-SETUP.md" className="underline">
              See setup guide
            </a>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Campaign Setup</CardTitle>
            <CardDescription>
              Configure your Meta Ads campaign
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Service */}
            <div className="space-y-2">
              <Label>Service to Promote</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger>
                  <SelectValue />
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

            {/* Locations */}
            <div className="space-y-2">
              <Label>Target Locations</Label>
              <MultiSelect
                options={STILTNER_SERVICE_AREAS}
                selected={locations}
                onChange={setLocations}
                placeholder="Select areas..."
              />
            </div>

            {/* Objective */}
            <div className="space-y-2">
              <Label>Campaign Objective</Label>
              <Select value={objective} onValueChange={setObjective}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTIVES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Budget */}
            <div className="space-y-2">
              <Label>Daily Budget ($)</Label>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                min="10"
                step="10"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Campaign Notes (Optional)</Label>
              <Textarea
                placeholder="Any specific messaging or goals..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-20"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Research Button */}
            <Button
              onClick={runResearch}
              disabled={isResearching || !service || locations.length === 0}
              variant="outline"
              className="w-full"
            >
              {isResearching ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Research Market
                </>
              )}
            </Button>

            {/* Generate Button */}
            <Button
              onClick={generateCreative}
              disabled={isGenerating || !hasResearched}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Ads
                </>
              )}
            </Button>

            {/* External Links */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild className="flex-1">
                <a
                  href="https://business.facebook.com/adsmanager"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Ads Manager
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="flex-1">
                <a href="/campaigns" className="flex items-center">
                  <Rocket className="h-3 w-3 mr-1" />
                  Full Builder
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Market Intelligence (if researched) */}
          {hasResearched && competitorData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Market Intelligence</CardTitle>
                <CardDescription>
                  Select insights to include in your ad copy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pain">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="pain">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Pain Points
                    </TabsTrigger>
                    <TabsTrigger value="praise">
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      Value Props
                    </TabsTrigger>
                    <TabsTrigger value="language">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Language
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pain" className="mt-4">
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-2">
                        {competitorData.painPoints.slice(0, 8).map((point, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                            onClick={() => {
                              if (selectedPainPoints.includes(point)) {
                                setSelectedPainPoints(selectedPainPoints.filter(p => p !== point))
                              } else {
                                setSelectedPainPoints([...selectedPainPoints, point])
                              }
                            }}
                          >
                            <Checkbox checked={selectedPainPoints.includes(point)} />
                            <span className="text-sm">{point}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="praise" className="mt-4">
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-2">
                        {competitorData.praisePoints.slice(0, 8).map((point, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                            onClick={() => {
                              if (selectedPraise.includes(point)) {
                                setSelectedPraise(selectedPraise.filter(p => p !== point))
                              } else {
                                setSelectedPraise([...selectedPraise, point])
                              }
                            }}
                          >
                            <Checkbox checked={selectedPraise.includes(point)} />
                            <span className="text-sm">{point}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="language" className="mt-4">
                    <div className="flex flex-wrap gap-2">
                      {competitorData.customerLanguage.slice(0, 12).map((phrase, i) => (
                        <Badge key={i} variant="secondary">
                          "{phrase}"
                        </Badge>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Generated Creative */}
          {isGenerating ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-5 w-1/3 mb-3" />
                    <Skeleton className="h-24 w-full mb-3" />
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : creative ? (
            <div className="space-y-4">
              {/* Download button */}
              <div className="flex justify-end">
                <Button variant="outline" onClick={downloadInstructions}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Instructions
                </Button>
              </div>

              {/* Strategy */}
              {creative.strategy && (
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertTitle>Strategy</AlertTitle>
                  <AlertDescription>{creative.strategy}</AlertDescription>
                </Alert>
              )}

              {/* Ad Variations */}
              {creative.variations.map((variation, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Ad Variation {index + 1}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            `${variation.headline}\n\n${variation.body}\n\nCTA: ${variation.cta}`,
                            `ad-${index}`
                          )
                        }
                      >
                        {copied === `ad-${index}` ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Headline</Label>
                      <p className="font-medium">{variation.headline}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Body</Label>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {variation.body}
                      </p>
                    </div>
                    <div>
                      <Badge>{variation.cta}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Targeting */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Targeting Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {creative.targeting.map((target, index) => (
                      <li key={index} className="text-sm flex items-center gap-2">
                        <span className="text-green-500">•</span>
                        {target}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Image Prompts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Image Prompts</CardTitle>
                  <CardDescription>
                    Use with AI image generators (Midjourney, DALL-E, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {creative.imagePrompts.map((prompt, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between gap-2 p-3 bg-muted rounded-lg"
                    >
                      <p className="text-sm">{prompt}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(prompt, `prompt-${index}`)}
                      >
                        {copied === `prompt-${index}` ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <div className="space-y-4">
                  <Sparkles className="h-12 w-12 mx-auto opacity-50" />
                  <div>
                    <p className="font-medium">Generate Intelligence-Driven Ads</p>
                    <p className="text-sm">
                      {hasResearched 
                        ? "Click 'Generate Ads' to create ad variations using market intelligence"
                        : "Click 'Research Market' first to analyze competitors and customer language"
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
