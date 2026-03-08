"use client"

import * as React from "react"
import { PenTool, Loader2, Copy } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { agentApi } from "@/lib/agent"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export default function CopywriterPage() {
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<string | null>(null)
  
  // Form State
  const [product, setProduct] = React.useState("Landscape Design Services")
  const [audience, setAudience] = React.useState("Homeowners in Dublin/Powell")
  const [platform, setPlatform] = React.useState("google_ads")
  const [tone, setTone] = React.useState("professional")
  
  const generateCopy = async () => {
    setLoading(true)
    setResult(null)
    
    const prompt = `
      Act as a world-class PPC Copywriter. 
      Generate creative ad copy for the following:
      
      Product/Service: ${product}
      Target Audience: ${audience}
      Platform: ${platform === 'google_ads' ? 'Google Search Ads (Headlines: 30 chars, Desc: 90 chars)' : platform === 'facebook' ? 'Facebook/Instagram Feed' : 'LinkedIn Ads'}
      Tone: ${tone}
      
      Provide 3 distinct variations testing different angles (e.g. Benefit-driven, Fear of Missing Out, Social Proof).
      Format the output clearly.
    `

    try {
      const res = await agentApi.chat(prompt)
      if (res.success && res.data?.response) {
        setResult(res.data.response)
      } else {
        setResult("Error generating copy. Please try again.")
      }
    } catch (e) {
      setResult("Network error. Please ensure agent is running.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">AI Copywriter</h2>
        <p className="text-muted-foreground">Generate high-converting ad copy for any platform.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Input Column */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Product / Service</Label>
              <Input value={product} onChange={(e) => setProduct(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={3} />
            </div>
            
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google_ads">Google Search Ads</SelectItem>
                  <SelectItem value="facebook">Facebook / Instagram</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="email">Email Sequence</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional & Trustworthy</SelectItem>
                  <SelectItem value="urgent">Urgent / Sales-driven</SelectItem>
                  <SelectItem value="friendly">Friendly & Approachable</SelectItem>
                  <SelectItem value="luxury">Luxury & Exclusive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={generateCopy} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenTool className="mr-2 h-4 w-4" />}
              Generate Ads
            </Button>
          </CardFooter>
        </Card>

        {/* Output Column */}
        <Card className="md:col-span-2 min-h-[500px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Generated Copy</CardTitle>
            {result && (
                <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(result)}>
                    <Copy className="h-4 w-4" />
                </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="flex flex-col items-center justify-center h-full py-20 space-y-4 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p>Crafting persuasive copy...</p>
                </div>
            ) : result ? (
                <div className="prose dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                        pre: ({node, ...props}) => <pre className="overflow-auto w-full my-2 bg-black/10 dark:bg-black/30 p-2 rounded" {...props} />,
                        code: ({node, ...props}) => <code className="bg-black/10 dark:bg-black/30 rounded px-1" {...props} />
                    }}
                  >
                    {result}
                  </ReactMarkdown>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground border-2 border-dashed rounded-lg">
                    <PenTool className="h-8 w-8 mb-2 opacity-50" />
                    <p>Fill out the details to generate ad copy</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
