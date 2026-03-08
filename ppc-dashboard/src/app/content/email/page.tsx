"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, Copy, Check, Download } from "lucide-react"
import ReactMarkdown from "react-markdown"

const CAMPAIGN_TYPES = [
  { value: "welcome", label: "Welcome Series", description: "New subscriber onboarding" },
  { value: "nurture", label: "Nurture Series", description: "Lead follow-up sequence" },
  { value: "promotional", label: "Promotional", description: "Seasonal offers and promotions" },
]

const EMAIL_COUNTS = [
  { value: "3", label: "3 Emails", description: "Quick sequence" },
  { value: "5", label: "5 Emails", description: "Standard sequence" },
  { value: "7", label: "7 Emails", description: "Extended sequence" },
]

const AUDIENCES = [
  { value: "new_subscribers", label: "New Subscribers" },
  { value: "website_leads", label: "Website Leads" },
  { value: "past_customers", label: "Past Customers" },
  { value: "cold_leads", label: "Cold Leads" },
]

interface EmailContent {
  subject: string
  preview: string
  body: string
  delay: string
}

export default function EmailCampaignsPage() {
  const [campaignType, setCampaignType] = useState<string>("welcome")
  const [numEmails, setNumEmails] = useState<string>("5")
  const [audience, setAudience] = useState<string>("new_subscribers")
  const [isGenerating, setIsGenerating] = useState(false)
  const [emails, setEmails] = useState<EmailContent[]>([])
  const [activeTab, setActiveTab] = useState("0")
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generateSequence = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "email-sequence",
          params: {
            campaignType,
            numEmails: parseInt(numEmails) as 3 | 5 | 7,
            audience: AUDIENCES.find((a) => a.value === audience)?.label || audience,
          },
        }),
      })

      const result = await response.json()

      if (result.success && result.data?.emails) {
        setEmails(result.data.emails)
        setActiveTab("0")
      } else {
        setError(result.error || "Failed to generate sequence")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const exportAsJSON = () => {
    const data = {
      campaignType,
      audience,
      emails: emails.map((e, i) => ({
        position: i + 1,
        ...e,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `email-sequence-${campaignType}.json`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Email Campaign Builder</h1>
        <p className="text-sm text-muted-foreground">
          Generate multi-email sequences for lead nurturing
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>
              Configure your email sequence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Campaign Type */}
            <div className="space-y-2">
              <Label>Campaign Type</Label>
              <Select value={campaignType} onValueChange={setCampaignType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex flex-col">
                        <span>{type.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {type.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Number of Emails */}
            <div className="space-y-2">
              <Label>Sequence Length</Label>
              <Select value={numEmails} onValueChange={setNumEmails}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_COUNTS.map((count) => (
                    <SelectItem key={count.value} value={count.value}>
                      {count.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((aud) => (
                    <SelectItem key={aud.value} value={aud.value}>
                      {aud.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-500">
                {error}
              </div>
            )}

            <Button
              onClick={generateSequence}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Sequence"
              )}
            </Button>

            {emails.length > 0 && (
              <Button
                variant="outline"
                onClick={exportAsJSON}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as JSON
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Email Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Email Sequence</CardTitle>
            <CardDescription>
              {emails.length > 0
                ? `${emails.length} emails in sequence`
                : "Generated emails will appear here"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : emails.length > 0 ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full justify-start overflow-x-auto">
                  {emails.map((_, index) => (
                    <TabsTrigger key={index} value={index.toString()}>
                      Email {index + 1}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {emails.map((email, index) => (
                  <TabsContent key={index} value={index.toString()} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{email.delay}</Badge>
                    </div>

                    {/* Subject */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Subject</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(email.subject, `subject-${index}`)}
                        >
                          {copied === `subject-${index}` ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <p className="font-medium">{email.subject}</p>
                    </div>

                    {/* Preview */}
                    {email.preview && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Preview Text</Label>
                        <p className="text-sm text-muted-foreground">{email.preview}</p>
                      </div>
                    )}

                    {/* Body */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Body</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(email.body, `body-${index}`)}
                        >
                          {copied === `body-${index}` ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <div className="prose dark:prose-invert max-w-none text-sm border rounded-lg p-4 max-h-64 overflow-y-auto">
                        <ReactMarkdown>{email.body}</ReactMarkdown>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Configure options and click Generate to create your email sequence</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
