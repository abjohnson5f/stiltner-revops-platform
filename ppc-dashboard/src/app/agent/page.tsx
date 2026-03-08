"use client"

import * as React from "react"
import { Send, Bot, User, RefreshCw } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { agentApi } from "@/lib/agent"
import { cn } from "@/lib/utils"

interface Message {
  role: "agent" | "user"
  content: string
  timestamp: Date
}

export default function AgentChatPage() {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      role: "agent",
      content: "Hello! I'm your Autonomous PPC Agent. I can help you create campaigns, audit your account, or research competitors. What would you like to do?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userMsg: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    try {
      const response = await agentApi.chat(userMsg.content)
      
      const agentMsg: Message = {
        role: "agent",
        content: response.success ? response.data?.response : `Error: ${response.error}`,
        timestamp: new Date(),
      }
      
      setMessages((prev) => [...prev, agentMsg])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: "Sorry, I encountered a network error. Please ensure the Agent Server is running.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agent Chat</h1>
      </div>

      <Card className="flex-1 p-4 overflow-hidden flex flex-col bg-muted/50">
        <ScrollArea className="flex-1 pr-4">
          <div className="flex flex-col gap-4 pb-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3 max-w-[85%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <Avatar className={cn("h-8 w-8", msg.role === "agent" ? "bg-green-600" : "bg-blue-600")}>
                  <AvatarFallback className="text-white">
                    {msg.role === "agent" ? <Bot size={16} /> : <User size={16} />}
                  </AvatarFallback>
                </Avatar>
                
                <div
                  className={cn(
                    "rounded-lg p-3 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border shadow-sm"
                  )}
                >
                  <div className="prose dark:prose-invert max-w-none text-sm break-words">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                          pre: ({node, ...props}) => <pre className="overflow-auto w-full my-2 bg-black/10 dark:bg-black/30 p-2 rounded" {...props} />,
                          code: ({node, ...props}) => <code className="bg-black/10 dark:bg-black/30 rounded px-1" {...props} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-1 text-[10px] opacity-50 text-right">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 max-w-[80%]">
                 <Avatar className="h-8 w-8 bg-green-600">
                  <AvatarFallback><Bot size={16} /></AvatarFallback>
                </Avatar>
                <div className="bg-background border shadow-sm rounded-lg p-3 flex items-center gap-2">
                   <RefreshCw className="h-4 w-4 animate-spin" />
                   <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </Card>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          placeholder="Type your request... (e.g. 'Create a campaign for lawn care')"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  )
}
