"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, Copy, Check, Instagram, Facebook, Linkedin, Twitter } from "lucide-react"

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: Instagram, maxChars: 2200 },
  { id: "facebook", label: "Facebook", icon: Facebook, maxChars: 500 },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, maxChars: 700 },
  { id: "twitter", label: "Twitter/X", icon: Twitter, maxChars: 280 },
]

interface SocialPost {
  platform: string
  content: string
  hashtags: string[]
  characterCount: number
}

export default function SocialMediaPage() {
  const [sourceContent, setSourceContent] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "facebook"])
  const [isAtomizing, setIsAtomizing] = useState(false)
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    )
  }

  const atomizeContent = async () => {
    if (!sourceContent.trim() || selectedPlatforms.length === 0) return

    setIsAtomizing(true)
    setError(null)

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "atomize",
          params: {
            sourceContent,
            platforms: selectedPlatforms,
          },
        }),
      })

      const result = await response.json()

      if (result.success && result.data?.posts) {
        setPosts(result.data.posts)
      } else {
        setError(result.error || "Failed to atomize content")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsAtomizing(false)
    }
  }

  const copyToClipboard = async (text: string, postId: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(postId)
    setTimeout(() => setCopied(null), 2000)
  }

  const getPlatformIcon = (platformId: string) => {
    const platform = PLATFORMS.find((p) => p.id === platformId)
    if (!platform) return null
    const Icon = platform.icon
    return <Icon className="h-5 w-5" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Social Media Atomizer</h1>
        <p className="text-sm text-muted-foreground">
          Transform content for multiple social platforms
        </p>
      </div>

      {/* Source Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source Content</CardTitle>
          <CardDescription>
            Paste your blog post, newsletter, or any content to atomize
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Content to Atomize</Label>
            <Textarea
              placeholder="Paste your content here... (blog post, newsletter section, article, etc.)"
              value={sourceContent}
              onChange={(e) => setSourceContent(e.target.value)}
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              {sourceContent.length} characters
            </p>
          </div>

          {/* Platform Selection */}
          <div className="space-y-2">
            <Label>Target Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => {
                const Icon = platform.icon
                return (
                  <Badge
                    key={platform.id}
                    variant={
                      selectedPlatforms.includes(platform.id) ? "default" : "outline"
                    }
                    className="cursor-pointer gap-1"
                    onClick={() => togglePlatform(platform.id)}
                  >
                    <Icon className="h-3 w-3" />
                    {platform.label}
                  </Badge>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-500">
              {error}
            </div>
          )}

          <Button
            onClick={atomizeContent}
            disabled={isAtomizing || !sourceContent.trim() || selectedPlatforms.length === 0}
            className="w-full"
          >
            {isAtomizing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Atomizing...
              </>
            ) : (
              "Atomize Content"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Posts */}
      {isAtomizing ? (
        <div className="grid gap-4 md:grid-cols-2">
          {selectedPlatforms.map((p) => (
            <Card key={p}>
              <CardContent className="pt-6">
                <Skeleton className="h-6 w-24 mb-4" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : posts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post, index) => {
            const platform = PLATFORMS.find(
              (p) => p.id === post.platform.toLowerCase()
            )
            const isOverLimit = platform && post.characterCount > platform.maxChars

            return (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getPlatformIcon(post.platform.toLowerCase())}
                      <CardTitle className="text-base capitalize">
                        {post.platform}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isOverLimit ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {post.characterCount}
                        {platform && `/${platform.maxChars}`}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            `${post.content}\n\n${post.hashtags.join(" ")}`,
                            `post-${index}`
                          )
                        }
                      >
                        {copied === `post-${index}` ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                  {post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.hashtags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs text-blue-500"
                        >
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
