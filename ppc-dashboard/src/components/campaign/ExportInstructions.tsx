"use client"

import * as React from "react"
import { Download, Copy, ExternalLink, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { generateManualInstructions } from "@/lib/ad-generator"

interface GeneratedAd {
  platform: "google" | "meta"
  headlines: string[]
  descriptions: string[]
  keywords?: string[]
  targeting?: string[]
  imagePrompts?: string[]
}

interface ExportInstructionsProps {
  ads: GeneratedAd[]
  campaignName: string
  budget: string
  service: string
  locations: string[]
}

export function ExportInstructions({
  ads,
  campaignName,
  budget,
  service,
  locations,
}: ExportInstructionsProps) {
  const [copied, setCopied] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)

  const googleAd = ads.find((a) => a.platform === "google")
  const metaAd = ads.find((a) => a.platform === "meta")

  const googleInstructions = googleAd
    ? generateManualInstructions(googleAd, campaignName, budget)
    : ""
  const metaInstructions = metaAd
    ? generateManualInstructions(metaAd, campaignName, budget)
    : ""

  const handleCopy = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Generate quick reference card
  const generateQuickReference = () => {
    const lines = [
      `# Quick Reference: ${campaignName}`,
      ``,
      `**Service:** ${service}`,
      `**Locations:** ${locations.join(", ")}`,
      `**Daily Budget:** $${budget}`,
      ``,
      `---`,
      ``,
    ]

    if (googleAd) {
      lines.push(
        `## Google Ads`,
        ``,
        `### Headlines`,
        ...googleAd.headlines.map((h, i) => `${i + 1}. ${h}`),
        ``,
        `### Descriptions`,
        ...googleAd.descriptions.map((d, i) => `${i + 1}. ${d}`),
        ``,
        `### Keywords`,
        googleAd.keywords?.map((k) => `- ${k}`).join("\n") || "N/A",
        ``,
        `---`,
        ``
      )
    }

    if (metaAd) {
      lines.push(
        `## Meta Ads`,
        ``,
        `### Headlines`,
        ...metaAd.headlines.map((h, i) => `${i + 1}. ${h}`),
        ``,
        `### Ad Copy`,
        ...metaAd.descriptions.map((d, i) => `\n**Variation ${i + 1}:**\n${d}\n`),
        ``,
        `### Targeting`,
        metaAd.targeting?.map((t) => `- ${t}`).join("\n") || "N/A",
        ``,
        `### Image Prompts`,
        metaAd.imagePrompts?.map((p, i) => `${i + 1}. ${p}`).join("\n") || "N/A",
        ``
      )
    }

    return lines.join("\n")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Instructions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Export Campaign Instructions</DialogTitle>
          <DialogDescription>
            Step-by-step guides for creating this campaign manually in each platform
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="quick" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quick">Quick Reference</TabsTrigger>
            <TabsTrigger value="google">Google Ads Guide</TabsTrigger>
            <TabsTrigger value="meta">Meta Ads Guide</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="flex justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Copy-paste ready content for quick setup
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(generateQuickReference(), "quick")}
                >
                  {copied === "quick" ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  Copy All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleDownload(
                      generateQuickReference(),
                      `${campaignName.replace(/\s+/g, "-")}-quick-reference.md`
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[400px] rounded-md border p-4">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {generateQuickReference()}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="google" className="mt-4">
            <div className="flex justify-between mb-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Complete step-by-step guide for Google Ads
                </p>
                <Button size="sm" variant="link" asChild>
                  <a
                    href="https://ads.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open Ads Manager
                  </a>
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(googleInstructions, "google")}
                >
                  {copied === "google" ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleDownload(
                      googleInstructions,
                      `${campaignName.replace(/\s+/g, "-")}-google-ads.md`
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[400px] rounded-md border p-4">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {googleInstructions || "No Google Ads campaign generated"}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="meta" className="mt-4">
            <div className="flex justify-between mb-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Complete step-by-step guide for Meta Ads
                </p>
                <Button size="sm" variant="link" asChild>
                  <a
                    href="https://business.facebook.com/adsmanager"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open Ads Manager
                  </a>
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(metaInstructions, "meta")}
                >
                  {copied === "meta" ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleDownload(
                      metaInstructions,
                      `${campaignName.replace(/\s+/g, "-")}-meta-ads.md`
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[400px] rounded-md border p-4">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {metaInstructions || "No Meta Ads campaign generated"}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// Standalone export button for use in other contexts
export function ExportButton({
  content,
  filename,
  label = "Export",
}: {
  content: string
  filename: string
  label?: string
}) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" onClick={handleDownload}>
      <Download className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )
}

// Copy button with feedback
export function CopyButton({
  content,
  label = "Copy",
}: {
  content: string
  label?: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" onClick={handleCopy}>
      {copied ? (
        <Check className="mr-2 h-4 w-4" />
      ) : (
        <Copy className="mr-2 h-4 w-4" />
      )}
      {copied ? "Copied!" : label}
    </Button>
  )
}
