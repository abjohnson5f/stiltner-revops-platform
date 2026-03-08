"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, Send, Copy, Check } from "lucide-react"
import ReactMarkdown from "react-markdown"

const TOPICS = [
  { id: "seasonal", label: "Seasonal Tips" },
  { id: "project", label: "Featured Project" },
  { id: "service", label: "Service Spotlight" },
  { id: "news", label: "Industry News" },
  { id: "tips", label: "Quick Tips" },
]

const SEASONS = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
]

export default function NewsletterGeneratorPage() {
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["seasonal", "tips"])
  const [season, setSeason] = useState<string>("")
  const [featuredProject, setFeaturedProject] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [newsletter, setNewsletter] = useState<{
    subject: string
    preview: string
    body: string
  } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((t) => t !== topicId)
        : [...prev, topicId]
    )
  }

  const generateNewsletter = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "newsletter",
          params: {
            topics: selectedTopics.map(
              (id) => TOPICS.find((t) => t.id === id)?.label || id
            ),
            seasonalTheme: season || undefined,
            featuredProject: featuredProject || undefined,
          },
        }),
      })

      const result = await response.json()

      if (result.success) {
        setNewsletter(result.data)
      } else {
        setError(result.error || "Failed to generate newsletter")
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Newsletter Generator</h1>
        <p className="text-sm text-muted-foreground">
          Create engaging newsletters with AI-powered content generation
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>
              Select topics and theme for your newsletter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Topics */}
            <div className="space-y-2">
              <Label>Topics to Cover</Label>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((topic) => (
                  <Badge
                    key={topic.id}
                    variant={selectedTopics.includes(topic.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTopic(topic.id)}
                  >
                    {topic.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Season */}
            <div className="space-y-2">
              <Label>Seasonal Theme</Label>
              <Select value={season} onValueChange={setSeason}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detect from date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto-detect</SelectItem>
                  {SEASONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Featured Project */}
            <div className="space-y-2">
              <Label>Featured Project (Optional)</Label>
              <Input
                placeholder="e.g., Johnson Family Patio Renovation"
                value={featuredProject}
                onChange={(e) => setFeaturedProject(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-500">
                {error}
              </div>
            )}

            <Button
              onClick={generateNewsletter}
              disabled={isGenerating || selectedTopics.length === 0}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Generate Newsletter
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              Generated newsletter content
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : newsletter ? (
              <div className="space-y-4">
                {/* Subject Line */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(newsletter.subject, "subject")}
                    >
                      {copied === "subject" ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="font-medium">{newsletter.subject}</p>
                </div>

                {/* Preview Text */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Preview Text</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(newsletter.preview, "preview")}
                    >
                      {copied === "preview" ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{newsletter.preview}</p>
                </div>

                {/* Body */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Body</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(newsletter.body, "body")}
                    >
                      {copied === "body" ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <div className="prose dark:prose-invert max-w-none text-sm border rounded-lg p-4 max-h-96 overflow-y-auto">
                    <ReactMarkdown>{newsletter.body}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Configure options and click Generate to create your newsletter</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
