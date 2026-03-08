"use client"

import { useState, useEffect, createContext, useContext } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type ViewRole = "owner" | "tech"

interface RoleContextType {
  role: ViewRole
  setRole: (role: ViewRole) => void
  isOwnerView: boolean
}

const RoleContext = createContext<RoleContextType>({
  role: "tech",
  setRole: () => {},
  isOwnerView: false,
})

export function useRole() {
  return useContext(RoleContext)
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<ViewRole>("tech")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load from localStorage
    const saved = localStorage.getItem("dashboard-role")
    if (saved === "owner" || saved === "tech") {
      setRoleState(saved)
    }
  }, [])

  const setRole = (newRole: ViewRole) => {
    setRoleState(newRole)
    localStorage.setItem("dashboard-role", newRole)
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        isOwnerView: role === "owner",
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

interface RoleToggleProps {
  className?: string
}

export function RoleToggle({ className }: RoleToggleProps) {
  const { role, setRole, isOwnerView } = useRole()

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Label
        htmlFor="role-toggle"
        className={cn(
          "text-sm cursor-pointer transition-colors",
          isOwnerView ? "text-foreground font-medium" : "text-muted-foreground"
        )}
      >
        Owner
      </Label>
      <Switch
        id="role-toggle"
        checked={!isOwnerView}
        onCheckedChange={(checked) => setRole(checked ? "tech" : "owner")}
      />
      <Label
        htmlFor="role-toggle"
        className={cn(
          "text-sm cursor-pointer transition-colors",
          !isOwnerView ? "text-foreground font-medium" : "text-muted-foreground"
        )}
      >
        Tech
      </Label>
    </div>
  )
}

// Wrapper component to conditionally render based on role
interface RoleGateProps {
  children: React.ReactNode
  allowedRoles?: ViewRole[]
  fallback?: React.ReactNode
}

export function RoleGate({ children, allowedRoles = ["tech"], fallback = null }: RoleGateProps) {
  const { role } = useRole()

  if (!allowedRoles.includes(role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// Hook to get owner-friendly labels
export function useOwnerLabels() {
  const { isOwnerView } = useRole()

  const labels: Record<string, { tech: string; owner: string }> = {
    cpl: { tech: "CPL", owner: "Cost per Lead" },
    roas: { tech: "ROAS", owner: "Return on Ad Spend" },
    ctr: { tech: "CTR", owner: "Click Rate" },
    cpc: { tech: "CPC", owner: "Cost per Click" },
    conversionRate: { tech: "Conversion Rate", owner: "Lead Quality" },
    impressions: { tech: "Impressions", owner: "Ad Views" },
    qualified: { tech: "Qualified", owner: "Serious Inquiries" },
  }

  return (key: string) => {
    const label = labels[key]
    if (!label) return key
    return isOwnerView ? label.owner : label.tech
  }
}
