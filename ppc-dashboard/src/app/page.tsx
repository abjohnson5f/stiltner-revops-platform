"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { ChannelBreakdown } from "@/components/dashboard/ChannelBreakdown"
import { RecentLeads } from "@/components/dashboard/RecentLeads"
import { LeadDetailModal } from "@/components/leads/LeadDetailModal"
import { useRole, useOwnerLabels } from "@/components/layout/RoleToggle"
import { Button } from "@/components/ui/button"
import { DateRangePicker, getDateRangeFromValue, type DateRange } from "@/components/ui/date-range-picker"
import { RefreshCw } from "lucide-react"
import type { Lead } from "@/components/leads/LeadCard"

interface MetricsData {
  summary: {
    leadsToday: number
    leadsThisWeek: number
    spendToday: number
    spendThisWeek: number
    cplThisWeek: number
    roasThisWeek: number
    conversionRate: number
  }
  trends: { date: string; leads: number; spend: number; conversions: number }[]
  channels: { name: string; leads: number; spend: number; cpl: number; percentage: number }[]
  recentLeads: {
    id: string
    name: string
    email: string
    phone: string
    service: string
    source: string
    createdAt: string
    status: string
  }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeFromValue("7d"))
  const { isOwnerView } = useRole()
  const getLabel = useOwnerLabels()

  const fetchData = async (range: DateRange) => {
    setIsLoading(true)
    setError(null)
    try {
      // Build query params based on date range
      const params = new URLSearchParams()
      params.set("range", range.value)
      params.set("from", format(range.from, "yyyy-MM-dd"))
      params.set("to", format(range.to, "yyyy-MM-dd"))
      
      const response = await fetch(`/api/metrics?${params.toString()}`)
      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || "Failed to fetch metrics")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData(dateRange)
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => fetchData(dateRange), 120000)
    return () => clearInterval(interval)
  }, [dateRange])

  const handleDateRangeChange = (newRange: DateRange) => {
    setDateRange(newRange)
  }

  // Calculate trends for comparison (mock for now)
  const calculateTrend = (current: number, baseline: number): number => {
    if (baseline === 0) return 0
    return ((current - baseline) / baseline) * 100
  }

  // Map recent leads to Lead type for modal
  const handleLeadClick = (lead: { id: string; name: string; email: string; phone: string; service: string; source: string; createdAt: string; status: string }) => {
    const nameParts = lead.name.split(" ")
    const mappedLead: Lead = {
      id: lead.id,
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" ") || "",
      email: lead.email,
      phone: lead.phone,
      service: lead.service,
      source: lead.source,
      status: lead.status,
      createdAt: lead.createdAt,
    }
    setSelectedLead(mappedLead)
  }

  // Get period label for cards
  const getPeriodLabel = () => {
    switch (dateRange.value) {
      case "today":
      case "24h":
        return "today"
      case "7d":
        return "7-day"
      case "30d":
        return "30-day"
      case "quarter":
        return "quarterly"
      case "all":
        return "all-time"
      default:
        return "period"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isOwnerView ? "Business Overview" : "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOwnerView 
              ? "How your marketing is performing" 
              : "Real-time metrics and lead tracking"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchData(dateRange)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={isOwnerView ? "Total Leads" : "Leads"}
          value={data?.summary.leadsThisWeek ?? 0}
          trend={calculateTrend(data?.summary.leadsToday ?? 0, 5)}
          trendLabel={getPeriodLabel()}
          isLoading={isLoading}
        />
        <MetricCard
          title={isOwnerView ? "Ad Spend" : "Spend"}
          value={data?.summary.spendThisWeek ?? 0}
          prefix="$"
          trend={calculateTrend(data?.summary.spendToday ?? 0, 200)}
          trendLabel={getPeriodLabel()}
          isLoading={isLoading}
        />
        <MetricCard
          title={getLabel("cpl")}
          value={data?.summary.cplThisWeek ?? 0}
          prefix="$"
          trend={calculateTrend(data?.summary.cplThisWeek ?? 0, 85)}
          trendLabel={`${getPeriodLabel()} average`}
          isLoading={isLoading}
        />
        <MetricCard
          title={getLabel("conversionRate")}
          value={data?.summary.conversionRate ?? 0}
          suffix="%"
          trend={calculateTrend(data?.summary.conversionRate ?? 0, 25)}
          trendLabel="leads qualified"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title={isOwnerView ? `Leads (${dateRange.label})` : `Lead Velocity (${dateRange.label})`}
          data={(data?.trends ?? []).map(t => ({ date: t.date, value: t.leads }))}
          color="#16a34a"
          isLoading={isLoading}
        />
        <ChannelBreakdown
          title={isOwnerView ? "Where Leads Come From" : "Channel Breakdown"}
          data={(data?.channels ?? []).map(c => ({ name: c.name, value: c.leads }))}
          isLoading={isLoading}
        />
      </div>

      {/* Recent Leads */}
      <RecentLeads
        leads={data?.recentLeads ?? []}
        onLeadClick={handleLeadClick}
        isLoading={isLoading}
      />

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  )
}
