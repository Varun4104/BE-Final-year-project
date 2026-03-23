"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  MessageCircle,
  Send,
  Bot,
  User,
  BookOpen,
  Loader,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
} from "lucide-react"
import { API_URL } from "@/lib/config"

interface Paper {
  file_id: string
  title: string
  author: string
  year: number
}

interface Source {
  excerpt: string
  relevance_score: number
}

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  sources?: Source[]
  timestamp: Date
}

interface Sections {
  abstract: string | null
  methodology: string | null
  results: string | null
  conclusions: string | null
  contributions: string | null
  limitations: string | null
}

export function ChatView() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [selectedPaperId, setSelectedPaperId] = useState<string>("")
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [sections, setSections] = useState<Sections | null>(null)
  const [sectionsOpen, setSectionsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${API_URL}/all_pdfs`)
      .then((r) => r.json())
      .then((data) => setPapers(data.pdfs || []))
      .catch(() => setError("Failed to load papers"))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handlePaperChange = (paperId: string) => {
    setSelectedPaperId(paperId)
    const paper = papers.find((p) => p.file_id === paperId) || null
    setSelectedPaper(paper)
    setMessages([])
    setSections(null)
    setError(null)
  }

  const sendMessage = async () => {
    if (!input.trim() || !selectedPaperId || isLoading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file_id", selectedPaperId)
      formData.append("question", userMsg.content)

      const resp = await fetch(`${API_URL}/ask`, { method: "POST", body: formData })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: data.answer,
        sources: data.sources,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get answer")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const extractSections = async () => {
    if (!selectedPaperId || isExtracting) return
    setIsExtracting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file_id", selectedPaperId)
      const resp = await fetch(`${API_URL}/extract_sections`, { method: "POST", body: formData })
      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()
      setSections(data.sections)
      setSectionsOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract sections")
    } finally {
      setIsExtracting(false)
    }
  }

  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  const sectionLabels: Record<keyof Sections, string> = {
    abstract: "Abstract / Introduction",
    methodology: "Methodology",
    results: "Results / Findings",
    conclusions: "Conclusions",
    contributions: "Key Contributions",
    limitations: "Limitations",
  }

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Chat with Paper</h1>
          <p className="text-muted-foreground mt-1">Ask questions about any uploaded research paper using RAG</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" />
          Gemini + RAG
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Paper Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Select a Research Paper
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Select value={selectedPaperId} onValueChange={handlePaperChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Choose a paper to chat with..." />
            </SelectTrigger>
            <SelectContent>
              {papers.map((p) => (
                <SelectItem key={p.file_id} value={p.file_id}>
                  {p.title || "Untitled"} {p.year ? `(${p.year})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPaperId && (
            <Button variant="outline" onClick={extractSections} disabled={isExtracting} className="gap-2 shrink-0">
              {isExtracting ? <Loader className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              Extract Sections
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Extracted Sections */}
      {sections && (
        <Card>
          <CardHeader className="pb-3 cursor-pointer" onClick={() => setSectionsOpen((v) => !v)}>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Extracted Sections — {selectedPaper?.title}
              </span>
              {sectionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
          </CardHeader>
          {sectionsOpen && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(sectionLabels) as (keyof Sections)[]).map((key) =>
                  sections[key] ? (
                    <div key={key} className="bg-muted rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-foreground mb-1">{sectionLabels[key]}</h4>
                      <p className="text-sm text-muted-foreground">{sections[key]}</p>
                    </div>
                  ) : null,
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Chat Interface */}
      <Card className="flex-1 flex flex-col min-h-[400px]">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {selectedPaper ? `Chatting with: ${selectedPaper.title}` : "Select a paper to start chatting"}
          </CardTitle>
          {selectedPaper && (
            <CardDescription>
              {selectedPaper.author} • {selectedPaper.year}
            </CardDescription>
          )}
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[450px]">
          {messages.length === 0 && selectedPaperId && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Start a conversation</p>
              <p className="text-sm">Ask anything about this paper — methodology, findings, conclusions...</p>
            </div>
          )}
          {messages.length === 0 && !selectedPaperId && (
            <div className="text-center text-muted-foreground py-8">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Select a paper above to begin</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
              {msg.type === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[75%] space-y-2 ${msg.type === "user" ? "items-end" : "items-start"} flex flex-col`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm ${
                    msg.type === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="w-full">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground gap-1 px-2"
                      onClick={() => toggleSources(msg.id)}
                    >
                      {expandedSources.has(msg.id) ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""}
                    </Button>
                    {expandedSources.has(msg.id) && (
                      <div className="space-y-2 mt-1">
                        {msg.sources.map((src, i) => (
                          <div key={i} className="bg-accent/50 rounded-lg px-3 py-2 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-muted-foreground">Excerpt {i + 1}</span>
                              <Badge variant="outline" className="text-xs h-4">
                                {Math.round(src.relevance_score * 100)}% match
                              </Badge>
                            </div>
                            <p className="text-muted-foreground italic">"{src.excerpt}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {msg.type === "user" && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <Separator />
        {/* Input */}
        <div className="p-4 flex gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedPaperId ? "Ask a question about this paper... (Enter to send)" : "Select a paper first"
            }
            disabled={!selectedPaperId || isLoading}
            className="resize-none min-h-[60px] max-h-[120px]"
            rows={2}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || !selectedPaperId || isLoading}
            className="self-end h-10 w-10 p-0"
          >
            {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    </div>
  )
}
