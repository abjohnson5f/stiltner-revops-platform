"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface Lead {
  id: string
  name: string
  email: string
  phone: string
  service: string
  source: string
  createdAt: string
  status: string
}

interface RecentLeadsProps {
  leads: Lead[]
  onLeadClick?: (lead: Lead) => void
  isLoading?: boolean
  maxItems?: number
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-green-500",
  contacted: "bg-blue-500",
  qualified: "bg-purple-500",
  quoted: "bg-yellow-500",
  won: "bg-emerald-600",
  lost: "bg-red-500",
}

const SOURCE_LABELS: Record<string, string> = {
  google: "Google Ads",
  google_ads: "Google Ads",
  facebook: "Facebook",
  instagram: "Instagram",
  meta: "Meta Ads",
  direct: "Direct",
  organic: "Organic",
}

export function RecentLeads({
  leads,
  onLeadClick,
  isLoading = false,
  maxItems = 5,
}: RecentLeadsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const displayLeads = leads.slice(0, maxItems)

  const formatTimeAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return "Recently"
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Recent Leads</CardTitle>
        <Link 
          href="/leads" 
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {displayLeads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No leads yet
          </div>
        ) : (
          <div className="space-y-4">
            {displayLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => onLeadClick?.(lead)}
              >
                {/* Status indicator */}
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${STATUS_COLORS[lead.status] || "bg-gray-500"}`}
                  />
                </div>

                {/* Lead info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lead.name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {lead.service || "General Inquiry"}
                  </p>
                </div>

                {/* Source and time */}
                <div className="text-right">
                  <Badge variant="secondary" className="text-xs mb-1">
                    {SOURCE_LABELS[lead.source] || lead.source || "Direct"}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeAgo(lead.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
