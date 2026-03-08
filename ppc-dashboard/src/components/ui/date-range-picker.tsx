"use client"

import * as React from "react"
import { CalendarIcon, ChevronDown } from "lucide-react"
import { format, subDays, subMonths, startOfQuarter, subQuarters } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Calendar } from "@/components/ui/calendar"
// Removed Popover imports - using custom modal instead
import { cn } from "@/lib/utils"

export interface DateRange {
  from: Date
  to: Date
  label: string
  value: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

const PRESET_RANGES = [
  { label: "Today", value: "today", days: 0 },
  { label: "Last 24 Hours", value: "24h", days: 1 },
  { label: "Last 7 Days", value: "7d", days: 7 },
  { label: "Last 30 Days", value: "30d", days: 30 },
  { label: "Last Quarter", value: "quarter", days: 90 },
  { label: "All Time", value: "all", days: 365 },
] as const

export function getDateRangeFromValue(value: string): DateRange {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  switch (value) {
    case "today":
      return {
        from: today,
        to: now,
        label: "Today",
        value: "today",
      }
    case "24h":
      return {
        from: subDays(now, 1),
        to: now,
        label: "Last 24 Hours",
        value: "24h",
      }
    case "7d":
      return {
        from: subDays(today, 6),
        to: now,
        label: "Last 7 Days",
        value: "7d",
      }
    case "30d":
      return {
        from: subDays(today, 29),
        to: now,
        label: "Last 30 Days",
        value: "30d",
      }
    case "quarter":
      return {
        from: subQuarters(startOfQuarter(now), 1),
        to: now,
        label: "Last Quarter",
        value: "quarter",
      }
    case "all":
      // All time - start from Jan 1, 2026 (when campaigns started)
      return {
        from: new Date(2026, 0, 1),
        to: now,
        label: "All Time",
        value: "all",
      }
    default:
      // Default to last 7 days
      return {
        from: subDays(today, 6),
        to: now,
        label: "Last 7 Days",
        value: "7d",
      }
  }
}

export function dateRangeToGAQL(range: DateRange): string {
  // Convert to GAQL date range format
  switch (range.value) {
    case "today":
      return "TODAY"
    case "24h":
      return "YESTERDAY" // Google Ads doesn't have "last 24 hours", use yesterday
    case "7d":
      return "LAST_7_DAYS"
    case "30d":
      return "LAST_30_DAYS"
    case "quarter":
      return "LAST_90_DAYS"
    case "all":
      // For all time, we need to use a date range
      const fromStr = format(range.from, "yyyy-MM-dd")
      const toStr = format(range.to, "yyyy-MM-dd")
      return `CUSTOM:${fromStr}:${toStr}`
    default:
      if (range.value.startsWith("custom:")) {
        const fromStr = format(range.from, "yyyy-MM-dd")
        const toStr = format(range.to, "yyyy-MM-dd")
        return `CUSTOM:${fromStr}:${toStr}`
      }
      return "LAST_7_DAYS"
  }
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [isCustomOpen, setIsCustomOpen] = React.useState(false)
  const [customFrom, setCustomFrom] = React.useState<Date | undefined>(value.from)
  const [customTo, setCustomTo] = React.useState<Date | undefined>(value.to)

  const handlePresetSelect = (preset: typeof PRESET_RANGES[number]) => {
    const range = getDateRangeFromValue(preset.value)
    onChange(range)
  }

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onChange({
        from: customFrom,
        to: customTo,
        label: `${format(customFrom, "MMM d")} - ${format(customTo, "MMM d, yyyy")}`,
        value: `custom:${format(customFrom, "yyyy-MM-dd")}:${format(customTo, "yyyy-MM-dd")}`,
      })
      setIsCustomOpen(false)
    }
  }

  const isCustomRange = value.value.startsWith("custom:")

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[180px] justify-between">
            <span className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {value.label}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          {PRESET_RANGES.map((preset) => (
            <DropdownMenuItem
              key={preset.value}
              onClick={() => handlePresetSelect(preset)}
              className={cn(
                value.value === preset.value && "bg-accent"
              )}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCustomOpen(true)}>
            Custom Range...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom Date Range Dialog */}
      {isCustomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-popover border rounded-lg p-4 shadow-lg">
            <div className="space-y-4">
              <div className="text-sm font-medium">Select Date Range</div>
              <div className="flex gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">From</div>
                  <Calendar
                    mode="single"
                    selected={customFrom}
                    onSelect={setCustomFrom}
                    disabled={(date) => date > new Date()}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">To</div>
                  <Calendar
                    mode="single"
                    selected={customTo}
                    onSelect={setCustomTo}
                    disabled={(date) => date > new Date() || (customFrom ? date < customFrom : false)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsCustomOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCustomApply} disabled={!customFrom || !customTo}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show date range when custom is selected */}
      {isCustomRange && (
        <span className="text-sm text-muted-foreground">
          {format(value.from, "MMM d, yyyy")} - {format(value.to, "MMM d, yyyy")}
        </span>
      )}
    </div>
  )
}
