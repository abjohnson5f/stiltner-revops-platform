"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns"
import {
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  Tag,
  MessageSquare,
} from "lucide-react"
import { useState } from "react"
import type { Lead } from "./LeadCard"

interface LeadDetailModalProps {
  lead: Lead | null
  open: boolean
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-green-500/10 text-green-500 border-green-500/20",
  contacted: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  qualified: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  quoted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  won: "bg-emerald-600/10 text-emerald-600 border-emerald-600/20",
  lost: "bg-red-500/10 text-red-500 border-red-500/20",
}

export function LeadDetailModal({ lead, open, onClose }: LeadDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!lead) return null

  const fullName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Unknown"

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null
    try {
      return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a")
    } catch {
      return null
    }
  }

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        copyToClipboard(text, field)
      }}
      className="p-1 hover:bg-muted rounded"
    >
      {copiedField === field ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{fullName}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {lead.service || "General Inquiry"}
              </p>
            </div>
            <Badge
              variant="outline"
              className={STATUS_COLORS[lead.status] || ""}
            >
              {lead.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Contact</h4>
            {lead.email && (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{lead.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CopyButton text={lead.email} field="email" />
                  <a
                    href={`mailto:${lead.email}`}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                </div>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{lead.phone}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CopyButton text={lead.phone} field="phone" />
                  <a
                    href={`tel:${lead.phone}`}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                </div>
              </div>
            )}
            {(lead.propertyAddress || lead.city) && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {[lead.propertyAddress, lead.city].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Message */}
          {lead.message && (
            <>
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Message
                </h4>
                <p className="text-sm bg-muted/50 rounded-lg p-3">
                  {lead.message}
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Attribution */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Attribution
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lead.source && (
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="font-medium">{lead.source}</p>
                </div>
              )}
              {lead.medium && (
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Medium</p>
                  <p className="font-medium">{lead.medium}</p>
                </div>
              )}
              {lead.campaign && (
                <div className="bg-muted/50 rounded-lg p-2 col-span-2">
                  <p className="text-xs text-muted-foreground">Campaign</p>
                  <p className="font-medium truncate">{lead.campaign}</p>
                </div>
              )}
              {lead.gclid && (
                <div className="bg-muted/50 rounded-lg p-2 col-span-2">
                  <p className="text-xs text-muted-foreground">GCLID</p>
                  <p className="font-mono text-xs truncate">{lead.gclid}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(lead.createdAt) || "Unknown"}</span>
              </div>
              {lead.contactedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contacted</span>
                  <span>{formatDate(lead.contactedAt)}</span>
                </div>
              )}
              {lead.qualifiedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Qualified</span>
                  <span>{formatDate(lead.qualifiedAt)}</span>
                </div>
              )}
              {lead.convertedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Converted</span>
                  <span>{formatDate(lead.convertedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {lead.phone && (
              <Button asChild variant="outline" className="flex-1">
                <a href={`tel:${lead.phone}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </a>
              </Button>
            )}
            {lead.email && (
              <Button asChild variant="outline" className="flex-1">
                <a href={`mailto:${lead.email}`}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </a>
              </Button>
            )}
            {lead.pipedriveUrl && (
              <Button asChild variant="outline" className="flex-1">
                <a href={lead.pipedriveUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Pipedrive
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
