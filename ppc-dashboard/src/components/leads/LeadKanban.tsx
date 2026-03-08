"use client"

import { useState } from "react"
import { LeadCard, type Lead } from "./LeadCard"
import { LeadDetailModal } from "./LeadDetailModal"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface LeadKanbanProps {
  leads: Lead[]
  isLoading?: boolean
  onStatusChange?: (leadId: string, newStatus: string) => void
}

const COLUMNS = [
  { id: "new", label: "New", color: "border-t-green-500" },
  { id: "contacted", label: "Contacted", color: "border-t-blue-500" },
  { id: "qualified", label: "Qualified", color: "border-t-purple-500" },
  { id: "quoted", label: "Quoted", color: "border-t-yellow-500" },
  { id: "won", label: "Won", color: "border-t-emerald-600" },
]

export function LeadKanban({ leads, isLoading = false, onStatusChange }: LeadKanbanProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Group leads by status
  const leadsByStatus: Record<string, Lead[]> = {}
  COLUMNS.forEach((col) => {
    leadsByStatus[col.id] = []
  })
  
  leads.forEach((lead) => {
    const status = lead.status.toLowerCase()
    if (leadsByStatus[status]) {
      leadsByStatus[status].push(lead)
    } else {
      // Default to 'new' if status not recognized
      leadsByStatus["new"].push(lead)
    }
  })

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-72 bg-muted/50 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const columnLeads = leadsByStatus[column.id] || []
          return (
            <div
              key={column.id}
              className={cn(
                "flex-shrink-0 w-72 bg-muted/30 rounded-lg border-t-4",
                column.color
              )}
            >
              {/* Column header */}
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-medium text-sm">{column.label}</h3>
                <span className="text-xs bg-muted rounded-full px-2 py-0.5">
                  {columnLeads.length}
                </span>
              </div>

              {/* Column content */}
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="p-2 space-y-2">
                  {columnLeads.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No leads
                    </div>
                  ) : (
                    columnLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        compact
                        onClick={() => setSelectedLead(lead)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>

      <LeadDetailModal
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </>
  )
}
