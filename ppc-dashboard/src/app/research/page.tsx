"use client"

import * as React from "react"
import { Search, Globe, Loader2, Star, MessageSquare, ThumbsUp, ThumbsDown, Languages } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type KeywordEntry = {
  keyword: string
  searchVolume?: number
  cpc?: number
  competition?: string | number
}

type CompetitorEntry = {
  name: string
  rating?: number
  reviews?: number
  address?: string
  url?: string
}

type KeywordResult = {
  success: boolean
  data: {
    keywords: KeywordEntry[]
    stats: Record<string, any>
  }
}

type CompetitorResult = {
  success: boolean
  data: {
    competitors: CompetitorEntry[]
    painPoints: string[]
    praisePoints: string[]
    customerLanguage: string[]
  }
}

export default function ResearchPage() {
  const [loading, setLoading] = React.useState(false)
  const [keywordResult, setKeywordResult] = React.useState<KeywordResult | null>(null)
  const [competitorResult, setCompetitorResult] = React.useState<CompetitorResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Keyword State
  const [keywords, setKeywords] = React.useState("")
  const [location, setLocation] = React.useState("Columbus, Gahanna, Westerville")

  // Competitor State
  const [competitorService, setCompetitorService] = React.useState("")
  const [competitorLocation, setCompetitorLocation] = React.useState("Columbus, Gahanna, Westerville")

  const handleKeywordResearch = async () => {
    if (!keywords) return
    setLoading(true)
    setKeywordResult(null)
    setCompetitorResult(null)
    setError(null)
    try {
      const res = await fetch("/api/research/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: keywords,
          locations: location.split(",").map((l) => l.trim()),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Request failed with status ${res.status}`)
      } else {
        setKeywordResult(data)
      }
    } catch (e: any) {
      console.error(e)
      setError(e.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleCompetitorIntel = async () => {
    if (!competitorService) return
    setLoading(true)
    setKeywordResult(null)
    setCompetitorResult(null)
    setError(null)
    try {
      const res = await fetch("/api/research/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: competitorService,
          locations: competitorLocation.split(",").map((l) => l.trim()),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Request failed with status ${res.status}`)
      } else {
        setCompetitorResult(data)
      }
    } catch (e: any) {
      console.error(e)
      setError(e.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value?: number) => {
    if (value == null) return "—"
    return `$${value.toFixed(2)}`
  }

  const formatNumber = (value?: number) => {
    if (value == null) return "—"
    return value.toLocaleString()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Market Research</h2>
        <p className="text-muted-foreground">Deep dive into keywords and competitors.</p>
      </div>

      <Tabs defaultValue="keywords" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="keywords">Keyword Research</TabsTrigger>
          <TabsTrigger value="competitors">Competitor Intel</TabsTrigger>
        </TabsList>

        <TabsContent value="keywords">
          <Card>
            <CardHeader>
              <CardTitle>Keyword Opportunities</CardTitle>
              <CardDescription>Find high-intent keywords with search volume and CPC data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service</Label>
                  <Input
                    placeholder="e.g. landscape design, patio installation"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Locations (comma-separated cities)</Label>
                  <Input
                    placeholder="Columbus, Gahanna, Westerville"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleKeywordResearch} disabled={loading || !keywords}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Run Research
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors">
          <Card>
            <CardHeader>
              <CardTitle>Competitor Spy</CardTitle>
              <CardDescription>Analyze what your competitors are doing and what customers say about them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service</Label>
                  <Input
                    placeholder="e.g. landscape design, patio installation"
                    value={competitorService}
                    onChange={(e) => setCompetitorService(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Locations (comma-separated cities)</Label>
                  <Input
                    placeholder="Columbus, Gahanna, Westerville"
                    value={competitorLocation}
                    onChange={(e) => setCompetitorLocation(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleCompetitorIntel} disabled={loading || !competitorService}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                Analyze Competitors
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive animate-in fade-in-50 duration-500">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Keyword Results */}
      {keywordResult && keywordResult.success && (
        <div className="space-y-4 animate-in fade-in-50 duration-500">
          {/* Stats Summary */}
          {keywordResult.data.stats && Object.keys(keywordResult.data.stats).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(keywordResult.data.stats).map(([key, value]) => (
                <Card key={key}>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
                    </p>
                    <p className="text-2xl font-bold">
                      {typeof value === "number" ? value.toLocaleString() : String(value)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Keywords Table */}
          {keywordResult.data.keywords && keywordResult.data.keywords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Keyword Results</CardTitle>
                <CardDescription>{keywordResult.data.keywords.length} keywords found</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Keyword</th>
                        <th className="text-right p-3 font-medium">Search Volume</th>
                        <th className="text-right p-3 font-medium">CPC</th>
                        <th className="text-right p-3 font-medium">Competition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywordResult.data.keywords.map((kw, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{kw.keyword}</td>
                          <td className="p-3 text-right tabular-nums">{formatNumber(kw.searchVolume)}</td>
                          <td className="p-3 text-right tabular-nums">{formatCurrency(kw.cpc)}</td>
                          <td className="p-3 text-right">
                            {kw.competition != null ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  String(kw.competition).toLowerCase() === "low" || Number(kw.competition) < 0.33
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : String(kw.competition).toLowerCase() === "high" || Number(kw.competition) > 0.66
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                }`}
                              >
                                {typeof kw.competition === "number"
                                  ? kw.competition.toFixed(2)
                                  : kw.competition}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Competitor Results */}
      {competitorResult && competitorResult.success && (
        <div className="space-y-4 animate-in fade-in-50 duration-500">
          {/* Competitor Cards */}
          {competitorResult.data.competitors && competitorResult.data.competitors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Competitors Found</CardTitle>
                <CardDescription>{competitorResult.data.competitors.length} competitors analyzed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {competitorResult.data.competitors.map((comp, i) => (
                    <Card key={i} className="border shadow-sm">
                      <CardContent className="pt-4 space-y-2">
                        <p className="font-semibold text-base">{comp.name}</p>
                        {comp.address && (
                          <p className="text-xs text-muted-foreground">{comp.address}</p>
                        )}
                        <div className="flex items-center gap-3 text-sm">
                          {comp.rating != null && (
                            <span className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              {comp.rating.toFixed(1)}
                            </span>
                          )}
                          {comp.reviews != null && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <MessageSquare className="h-3.5 w-3.5" />
                              {comp.reviews.toLocaleString()} reviews
                            </span>
                          )}
                        </div>
                        {comp.url && (
                          <a
                            href={comp.url.startsWith("http") ? comp.url : `https://${comp.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                          >
                            {comp.url}
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pain Points */}
          {competitorResult.data.painPoints && competitorResult.data.painPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ThumbsDown className="h-5 w-5 text-red-500" />
                  Pain Points
                </CardTitle>
                <CardDescription>Common complaints and weaknesses found in competitor reviews</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {competitorResult.data.painPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Praise Points */}
          {competitorResult.data.praisePoints && competitorResult.data.praisePoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-green-500" />
                  Praise Points
                </CardTitle>
                <CardDescription>What customers love about these competitors</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {competitorResult.data.praisePoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Customer Language */}
          {competitorResult.data.customerLanguage && competitorResult.data.customerLanguage.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5 text-blue-500" />
                  Customer Language
                </CardTitle>
                <CardDescription>Exact phrases and terms customers use -- great for ad copy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {competitorResult.data.customerLanguage.map((phrase, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full border px-3 py-1 text-sm bg-muted/50 hover:bg-muted transition-colors"
                    >
                      {phrase}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
