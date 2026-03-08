"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: number | string
  prefix?: string
  suffix?: string
  trend?: number
  trendLabel?: string
  isLoading?: boolean
  className?: string
}

export function MetricCard({
  title,
  value,
  prefix = "",
  suffix = "",
  trend,
  trendLabel = "vs last period",
  isLoading = false,
  className,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  const formatValue = (val: number | string): string => {
    if (typeof val === "string") return val
    
    // Format large numbers with commas
    if (val >= 1000) {
      return val.toLocaleString("en-US", { maximumFractionDigits: 0 })
    }
    
    // Format decimals for small numbers
    if (val < 10 && val % 1 !== 0) {
      return val.toFixed(2)
    }
    
    return val.toFixed(val % 1 !== 0 ? 2 : 0)
  }

  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) {
      return <Minus className="h-4 w-4 text-muted-foreground" />
    }
    if (trend > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />
    }
    return <TrendingDown className="h-4 w-4 text-red-500" />
  }

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return "text-muted-foreground"
    return trend > 0 ? "text-green-500" : "text-red-500"
  }

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground mb-1">
          {title}
        </p>
        <p className="text-2xl font-bold tracking-tight">
          {prefix}{formatValue(value)}{suffix}
        </p>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            {getTrendIcon()}
            <span className={cn("text-xs font-medium", getTrendColor())}>
              {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">
              {trendLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
