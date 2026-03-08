import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

export function MarkdownRenderer({ content, className }: { content: string, className?: string }) {
  return (
    <div className={cn("prose dark:prose-invert max-w-none text-sm", className)}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
            h1: ({node, ...props}) => <h1 className="text-3xl font-bold tracking-tight mt-8 mb-4 text-green-500 border-b border-green-500/20 pb-2" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-2xl font-bold tracking-tight mt-8 mb-4 text-primary" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-xl font-semibold tracking-tight mt-6 mb-3 text-foreground" {...props} />,
            p: ({node, ...props}) => <p className="leading-7 [&:not(:first-child)]:mt-4 text-muted-foreground" {...props} />,
            ul: ({node, ...props}) => <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props} />,
            ol: ({node, ...props}) => <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props} />,
            li: ({node, ...props}) => <li className="text-muted-foreground" {...props} />,
            blockquote: ({node, ...props}) => <blockquote className="mt-6 border-l-2 border-primary pl-6 italic text-muted-foreground" {...props} />,
            pre: ({node, ...props}) => <pre className="overflow-auto w-full my-4 bg-muted p-4 rounded-lg border" {...props} />,
            code: ({node, ...props}) => <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-foreground" {...props} />,
            strong: ({node, ...props}) => <strong className="font-bold text-foreground" {...props} />,
            a: ({node, ...props}) => <a className="font-medium text-primary underline underline-offset-4 hover:text-primary/80" {...props} />,
            hr: ({node, ...props}) => <hr className="my-8 border-muted" {...props} />,
            table: ({node, ...props}) => <div className="my-6 w-full overflow-y-auto"><table className="w-full" {...props} /></div>,
            tr: ({node, ...props}) => <tr className="m-0 border-t p-0 even:bg-muted" {...props} />,
            th: ({node, ...props}) => <th className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right" {...props} />,
            td: ({node, ...props}) => <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
