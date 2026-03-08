"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ThumbsUp,
  MessageSquare,
  Star,
} from "lucide-react"
import type { KeywordResearchResult } from "@/lib/dataforseo"
import type { MarketIntelligence } from "@/lib/apify"

interface MarketResearchProps {
  keywordData: KeywordResearchResult | null
  competitorData: MarketIntelligence | null
  isLoading: boolean
  selectedKeywords: string[]
  onKeywordsChange: (keywords: string[]) => void
  selectedPainPoints: string[]
  onPainPointsChange: (painPoints: string[]) => void
  selectedPraise: string[]
  onPraiseChange: (praise: string[]) => void
}

export function MarketResearch({
  keywordData,
  competitorData,
  isLoading,
  selectedKeywords,
  onKeywordsChange,
  selectedPainPoints,
  onPainPointsChange,
  selectedPraise,
  onPraiseChange,
}: MarketResearchProps) {
  const toggleKeyword = (term: string) => {
    if (selectedKeywords.includes(term)) {
      onKeywordsChange(selectedKeywords.filter((k) => k !== term))
    } else {
      onKeywordsChange([...selectedKeywords, term])
    }
  }

  const togglePainPoint = (point: string) => {
    if (selectedPainPoints.includes(point)) {
      onPainPointsChange(selectedPainPoints.filter((p) => p !== point))
    } else {
      onPainPointsChange([...selectedPainPoints, point])
    }
  }

  const togglePraise = (praise: string) => {
    if (selectedPraise.includes(praise)) {
      onPraiseChange(selectedPraise.filter((p) => p !== praise))
    } else {
      onPraiseChange([...selectedPraise, praise])
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "low":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "high":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      default:
        return ""
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {(keywordData || competitorData) && (
        <div className="grid gap-4 md:grid-cols-4">
          {keywordData && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{keywordData.keywords.length}</div>
                  <p className="text-xs text-muted-foreground">Keywords Found</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {keywordData.totalVolume.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Total Monthly Volume</p>
                </CardContent>
              </Card>
            </>
          )}
          {competitorData && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{competitorData.competitors.length}</div>
                  <p className="text-xs text-muted-foreground">Competitors Analyzed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {competitorData.reviewSummary.averageRating.toFixed(1)}
                  </div>
                  <p className="text-xs text-muted-foreground">Avg Competitor Rating</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Keyword Opportunities */}
        {keywordData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Keyword Opportunities
              </CardTitle>
              <CardDescription>
                Select keywords to target in your campaign ({selectedKeywords.length} selected)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-center">Diff</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywordData.keywords.slice(0, 20).map((kw) => (
                      <TableRow key={kw.term} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedKeywords.includes(kw.term)}
                            onCheckedChange={() => toggleKeyword(kw.term)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{kw.term}</TableCell>
                        <TableCell className="text-right text-sm">
                          {kw.volume.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={getDifficultyColor(kw.difficulty)}
                          >
                            {kw.difficulty}
                          </Badge>
                        </TableCell>
                        <TableCell>{getTrendIcon(kw.trend)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              {/* Easy Wins Section */}
              {keywordData.easyWins.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-2 text-green-500">
                    Easy Wins (Low Difficulty)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {keywordData.easyWins.slice(0, 5).map((kw) => (
                      <Badge
                        key={kw.term}
                        variant="outline"
                        className="cursor-pointer bg-green-500/10 border-green-500/30"
                        onClick={() => toggleKeyword(kw.term)}
                      >
                        {kw.term} ({kw.volume})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Competitor Landscape */}
        {competitorData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4" />
                Competitor Landscape
              </CardTitle>
              <CardDescription>
                Top competitors by review count
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {competitorData.competitors.slice(0, 8).map((comp, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{comp.name}</p>
                        <p className="text-xs text-muted-foreground">{comp.category}</p>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            <span className="font-medium text-sm">{comp.rating.toFixed(1)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {comp.reviewCount} reviews
                          </p>
                        </div>
                        {comp.rating < 4.0 && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                            Opportunity
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pain Points & Praise */}
      {competitorData && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pain Points */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Pain Points to Address
              </CardTitle>
              <CardDescription>
                Common complaints from competitor reviews - address these in your ads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {competitorData.painPoints.slice(0, 8).map((point, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => togglePainPoint(point)}
                  >
                    <Checkbox
                      checked={selectedPainPoints.includes(point)}
                      onCheckedChange={() => togglePainPoint(point)}
                    />
                    <span className="text-sm">{point}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Praise Points */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-green-500" />
                What Customers Value
              </CardTitle>
              <CardDescription>
                Positive themes from reviews - emphasize these in your messaging
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {competitorData.praisePoints.slice(0, 8).map((point, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => togglePraise(point)}
                  >
                    <Checkbox
                      checked={selectedPraise.includes(point)}
                      onCheckedChange={() => togglePraise(point)}
                    />
                    <span className="text-sm">{point}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Customer Language */}
      {competitorData && competitorData.customerLanguage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Customer Language
            </CardTitle>
            <CardDescription>
              Phrases customers actually use - incorporate these into your ad copy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {competitorData.customerLanguage.map((phrase, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                >
                  "{phrase}"
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
