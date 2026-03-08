"use client"

import { useEffect, useState } from "react"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Download, Lightbulb } from "lucide-react"
import { useRole, useOwnerLabels } from "@/components/layout/RoleToggle"

interface AttributionData {
  dateRange: { start: string; end: string }
  totals: {
    spend: number
    revenue: number
    leads: number
    conversions: number
    cpl: number
    cpa: number
    roas: number
    conversionRate: number
  }
  channels: {
    channel: string
    spend: number
    revenue: number
    leads: number
    conversions: number
    cpl: number
    cpa: number
    roas: number
    impressions: number
    clicks: number
    ctr: number
  }[]
  trends: {
    date: string
    spend: number
    revenue: number
    leads: number
    cpl: number
    roas: number
  }[]
  insights: string[]
}

const CHANNEL_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  bing_ads: "Bing Ads",
  website: "Website",
  direct: "Direct",
  organic: "Organic",
}

export default function AttributionPage() {
  const [data, setData] = useState<AttributionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isOwnerView } = useRole()
  const getLabel = useOwnerLabels()

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/attribution")
      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || "Failed to fetch attribution data")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const exportToCSV = () => {
    if (!data) return

    const headers = ["Channel", "Spend", "Leads", "CPL", "Conversions", "CPA", "ROAS"]
    const rows = data.channels.map((c) => [
      CHANNEL_LABELS[c.channel] || c.channel,
      `$${c.spend.toFixed(2)}`,
      c.leads,
      `$${c.cpl.toFixed(2)}`,
      c.conversions,
      `$${c.cpa.toFixed(2)}`,
      c.roas.toFixed(2),
    ])

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attribution-${data.dateRange.start}-${data.dateRange.end}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isOwnerView ? "Marketing Performance" : "Attribution & ROAS"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data?.dateRange
              ? `${data.dateRange.start} to ${data.dateRange.end}`
              : "Last 30 days"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!data}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Spend"
          value={data?.totals.spend ?? 0}
          prefix="$"
          isLoading={isLoading}
        />
        <MetricCard
          title="Total Leads"
          value={data?.totals.leads ?? 0}
          isLoading={isLoading}
        />
        <MetricCard
          title={isOwnerView ? "Average Cost per Lead" : "Blended CPL"}
          value={data?.totals.cpl ?? 0}
          prefix="$"
          isLoading={isLoading}
        />
        <MetricCard
          title={getLabel("roas")}
          value={data?.totals.roas ?? 0}
          suffix="x"
          isLoading={isLoading}
        />
      </div>

      {/* Channel Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isOwnerView ? "Performance by Channel" : "Channel Comparison"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">{getLabel("cpl")}</TableHead>
                <TableHead className="text-right">Conversions</TableHead>
                <TableHead className="text-right">{getLabel("roas")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : data?.channels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                data?.channels.map((channel) => (
                  <TableRow key={channel.channel}>
                    <TableCell className="font-medium">
                      {CHANNEL_LABELS[channel.channel] || channel.channel}
                    </TableCell>
                    <TableCell className="text-right">
                      ${channel.spend.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{channel.leads}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={channel.cpl <= 100 ? "default" : "destructive"}
                        className="font-mono"
                      >
                        ${channel.cpl.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{channel.conversions}</TableCell>
                    <TableCell className="text-right">
                      {channel.roas > 0 ? `${channel.roas.toFixed(2)}x` : "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title={isOwnerView ? "Cost per Lead Trend" : "CPL Trend"}
          data={(data?.trends ?? []).map((t) => ({ date: t.date, value: t.cpl }))}
          color="#16a34a"
          valuePrefix="$"
          isLoading={isLoading}
        />
        <TrendChart
          title="Daily Spend"
          data={(data?.trends ?? []).map((t) => ({ date: t.date, value: t.spend }))}
          color="#3b82f6"
          valuePrefix="$"
          isLoading={isLoading}
        />
      </div>

      {/* AI Insights */}
      {data?.insights && data.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              {isOwnerView ? "Key Takeaways" : "AI Insights"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.insights.map((insight, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="text-green-500 mt-1">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
