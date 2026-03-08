"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Mail, FileText, Share2, Image, ArrowRight } from "lucide-react"

const contentTools = [
  {
    title: "Newsletter Generator",
    description: "Create engaging newsletters with AI-powered content generation",
    icon: Mail,
    href: "/content/newsletter",
    status: "coming-soon",
  },
  {
    title: "Email Campaigns",
    description: "Build multi-email sequences for nurturing leads",
    icon: FileText,
    href: "/content/email",
    status: "coming-soon",
  },
  {
    title: "Social Media",
    description: "Atomize content for multiple platforms and schedule posts",
    icon: Share2,
    href: "/content/social",
    status: "coming-soon",
  },
  {
    title: "Ad Creatives",
    description: "Generate Meta Ads creative variations with AI",
    icon: Image,
    href: "/content/ads/meta",
    status: "coming-soon",
  },
]

export default function ContentStudioPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Content Studio</h1>
        <p className="text-sm text-muted-foreground">
          AI-powered content generation and automation tools
        </p>
      </div>

      {/* Content Tools Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {contentTools.map((tool) => (
          <Card key={tool.title} className="group hover:bg-muted/50 transition-colors">
            <Link href={tool.href}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-600/10 text-green-600">
                      <tool.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{tool.title}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {tool.description}
                      </CardDescription>
                    </div>
                  </div>
                  {tool.status === "coming-soon" && (
                    <Badge variant="secondary" className="text-xs">
                      Coming Soon
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  <span>Open</span>
                  <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      {/* Coming Soon Notice */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="font-medium mb-2">Content Studio Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The Content Studio is being built. Soon you&apos;ll be able to generate 
              newsletters, email campaigns, social media content, and ad creatives 
              all powered by AI.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
