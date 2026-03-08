"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { Phone, Mail, MapPin } from "lucide-react"

export interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  propertyAddress?: string
  city?: string
  service: string
  message?: string
  status: string
  source: string
  medium?: string
  campaign?: string
  gclid?: string
  createdAt: string
  contactedAt?: string | null
  qualifiedAt?: string | null
  convertedAt?: string | null
  pipedriveUrl?: string | null
}

interface LeadCardProps {
  lead: Lead
  onClick?: () => void
  compact?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-green-500/10 text-green-500 border-green-500/20",
  contacted: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  qualified: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  quoted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  won: "bg-emerald-600/10 text-emerald-600 border-emerald-600/20",
  lost: "bg-red-500/10 text-red-500 border-red-500/20",
}

const SOURCE_LABELS: Record<string, string> = {
  google: "Google",
  google_ads: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
  meta: "Meta",
  direct: "Direct",
  organic: "Organic",
  bing: "Bing",
}

export function LeadCard({ lead, onClick, compact = false }: LeadCardProps) {
  const fullName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Unknown"
  
  const formatTimeAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return "Recently"
    }
  }

  if (compact) {
    return (
      <Card
        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{fullName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {lead.service || "General Inquiry"}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {SOURCE_LABELS[lead.source] || lead.source || "Direct"}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          {formatTimeAgo(lead.createdAt)}
        </p>
      </Card>
    )
  }

  return (
    <Card
      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{fullName}</p>
          <p className="text-sm text-muted-foreground truncate">
            {lead.service || "General Inquiry"}
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={`shrink-0 ${STATUS_COLORS[lead.status] || ""}`}
        >
          {lead.status}
        </Badge>
      </div>

      <div className="space-y-1.5 text-sm text-muted-foreground">
        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" />
            <span>{lead.phone}</span>
          </div>
        )}
        {lead.city && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            <span>{lead.city}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <Badge variant="secondary" className="text-xs">
          {SOURCE_LABELS[lead.source] || lead.source || "Direct"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(lead.createdAt)}
        </span>
      </div>
    </Card>
  )
}
