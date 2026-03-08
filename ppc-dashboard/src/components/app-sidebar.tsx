import * as React from "react"
import {
  Bot,
  Command,
  Map,
  PieChart,
  SquareTerminal,
  PenTool,
  LayoutDashboard,
  Users,
  TrendingUp,
  FileText,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import Link from "next/link"

// Navigation structure
const navItems = {
  revops: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Leads Pipeline", url: "/leads", icon: Users },
    { title: "Attribution", url: "/attribution", icon: TrendingUp },
  ],
  tools: [
    { title: "Campaign Builder", url: "/campaigns", icon: SquareTerminal },
    { title: "Health Check", url: "/health", icon: PieChart },
    { title: "Research Tools", url: "/research", icon: Map },
    { title: "AI Copywriter", url: "/copywriter", icon: PenTool },
    { title: "Content Studio", url: "/content", icon: FileText },
    { title: "Agent Chat", url: "/agent", icon: Bot },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-green-600 text-sidebar-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Stiltner RevOps</span>
                  <span className="truncate text-xs">Marketing Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* RevOps Section */}
        <SidebarGroup>
          <SidebarGroupLabel>RevOps</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.revops.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Tools Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.tools.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {/* Footer content if needed */}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
