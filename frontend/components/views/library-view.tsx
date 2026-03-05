"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookOpen, Search, FileText, Sparkles, Clock, Star, ChevronDown, ChevronUp, CheckCircle } from "lucide-react"

interface Paper {
  id: string
  title: string
  authors: string[]
  year: number
  abstract: string
  keywords: string[]
  status: "read" | "unread" | "reading"
  dateAdded: string
  citationCount: number
  venue?: string
  doi?: string
  summary?: {
    brief: string
    keyPoints: string[]
    methodology: string
    findings: string
    significance: string
    generatedAt: string
  }
  notes?: string
}

interface PDFDocument {
  file_id: string
  file_name: string
  title: string
  author: string
  keywords: string[]
  year: number
  chunk_count: number
  abstract?: string
  created_at?: string
}

export function LibraryView() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("dateAdded")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [expandedPapers, setExpandedPapers] = useState<Set<string>>(new Set())

  const fetchAllPapers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("http://localhost:8000/all_pdfs")

      if (!response.ok) {
        throw new Error("Failed to fetch papers from library")
      }

      const data = await response.json()
      console.log("[v0] Fetched papers from API:", data)

      const transformedPapers: Paper[] = data.pdfs.map((pdf: PDFDocument) => ({
        id: pdf.file_id,
        title: pdf.title,
        authors: [pdf.author],
        year: pdf.year,
        abstract: pdf.abstract || (pdf.keywords.length > 0 ? `Keywords: ${pdf.keywords.join(", ")}` : "No abstract available"),
        keywords: pdf.keywords,
        status: (pdf.status as "read" | "unread" | "reading") || "unread",
        dateAdded: pdf.created_at ? pdf.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
        citationCount: 0,
        venue: "Uploaded Document",
        doi: pdf.file_id,
      }))

      setPapers(transformedPapers)
    } catch (err) {
      console.error("[v0] Error fetching papers:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch papers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllPapers()
  }, [])

  const generateSummary = async (paperId: string) => {
    setIsGeneratingSummary(true)
    try {
      const formData = new URLSearchParams()
      formData.append("file_id", paperId)
      const response = await fetch("http://localhost:8000/generate_summary", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      })
      if (!response.ok) throw new Error("Summary generation failed")
      const data = await response.json()
      setPapers((prev) =>
        prev.map((paper) => {
          if (paper.id === paperId) {
            return {
              ...paper,
              summary: {
                brief: data.summary,
                keyPoints: [],
                methodology: "",
                findings: "",
                significance: "",
                generatedAt: new Date().toISOString().split("T")[0],
              },
            }
          }
          return paper
        }),
      )
    } catch (err) {
      console.error("Failed to generate summary:", err)
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  const updateStatus = async (paperId: string, status: "read" | "unread" | "reading") => {
    try {
      const formData = new URLSearchParams()
      formData.append("status", status)
      await fetch(`http://localhost:8000/papers/${paperId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      })
      setPapers((prev) => prev.map((p) => (p.id === paperId ? { ...p, status } : p)))
    } catch (err) {
      console.error("Failed to update status:", err)
    }
  }

  const togglePaperExpansion = (paperId: string) => {
    setExpandedPapers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(paperId)) {
        newSet.delete(paperId)
      } else {
        newSet.add(paperId)
      }
      return newSet
    })
  }

  const filteredPapers = papers.filter((paper) => {
    const matchesSearch =
      searchQuery === "" ||
      paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paper.authors.some((author) => author.toLowerCase().includes(searchQuery.toLowerCase())) ||
      paper.keywords.some((keyword) => keyword.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = filterStatus === "all" || paper.status === filterStatus

    return matchesSearch && matchesStatus
  })

  const sortedPapers = [...filteredPapers].sort((a, b) => {
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title)
      case "year":
        return b.year - a.year
      case "citations":
        return b.citationCount - a.citationCount
      case "dateAdded":
      default:
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "read":
        return "default"
      case "reading":
        return "secondary"
      case "unread":
        return "outline"
      default:
        return "outline"
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-balance">My Library</h1>
        <p className="text-muted-foreground text-pretty">
          Manage your research papers with AI-powered summaries, notes, and organization tools.
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search papers, authors, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dateAdded">Date Added</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="year">Publication Year</SelectItem>
                <SelectItem value="citations">Citation Count</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Papers</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="reading">Currently Reading</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Loading your papers...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error: {error}</p>
            <Button onClick={fetchAllPapers} variant="outline" size="sm" className="mt-2 bg-transparent">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Library Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{papers.length}</p>
                  <p className="text-sm text-muted-foreground">Total Papers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{papers.filter((p) => p.status === "read").length}</p>
                  <p className="text-sm text-muted-foreground">Papers Read</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{papers.filter((p) => p.summary).length}</p>
                  <p className="text-sm text-muted-foreground">AI Summaries</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{papers.filter((p) => p.notes).length}</p>
                  <p className="text-sm text-muted-foreground">With Notes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Papers List */}
      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Papers ({sortedPapers.length})</CardTitle>
            <CardDescription>Your research paper collection with AI-powered insights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sortedPapers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No papers found in your library. Upload some papers to get started!
                </p>
              ) : (
                sortedPapers.map((paper) => {
                  const isExpanded = expandedPapers.has(paper.id)
                  return (
                    <div key={paper.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-balance">{paper.title}</h3>
                            <Badge variant={getStatusColor(paper.status)}>{paper.status}</Badge>
                            {paper.summary && (
                              <Badge variant="outline" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI Summary
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {paper.authors.join(", ")} • {paper.year} • {paper.venue}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {paper.keywords.map((keyword, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {paper.citationCount.toLocaleString()} citations
                          </p>
                          <p className="text-xs text-muted-foreground">Added {paper.dateAdded}</p>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="space-y-4 pt-4 border-t">
                          <div>
                            <h4 className="font-medium mb-2">Abstract</h4>
                            <p className="text-sm text-muted-foreground text-pretty">{paper.abstract}</p>
                          </div>

                          {paper.summary && (
                            <div className="space-y-3">
                              <h4 className="font-medium flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                AI-Generated Summary
                              </h4>
                              <div className="bg-accent/50 rounded-lg p-4 space-y-3">
                                <div>
                                  <h5 className="font-medium text-sm">Brief Summary</h5>
                                  <p className="text-sm text-pretty">{paper.summary.brief}</p>
                                </div>
                                <div>
                                  <h5 className="font-medium text-sm">Key Points</h5>
                                  <ul className="text-sm space-y-1">
                                    {paper.summary.keyPoints.map((point, index) => (
                                      <li key={index} className="flex items-start gap-2">
                                        <span className="text-primary">•</span>
                                        <span>{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h5 className="font-medium text-sm">Methodology</h5>
                                    <p className="text-sm text-pretty">{paper.summary.methodology}</p>
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-sm">Key Findings</h5>
                                    <p className="text-sm text-pretty">{paper.summary.findings}</p>
                                  </div>
                                </div>
                                <div>
                                  <h5 className="font-medium text-sm">Significance</h5>
                                  <p className="text-sm text-pretty">{paper.summary.significance}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Generated on {paper.summary.generatedAt}
                                </p>
                              </div>
                            </div>
                          )}

                          {paper.notes && (
                            <div>
                              <h4 className="font-medium mb-2">My Notes</h4>
                              <p className="text-sm bg-muted/50 rounded-lg p-3">{paper.notes}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={() => togglePaperExpansion(paper.id)}>
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              Show Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Show More
                            </>
                          )}
                        </Button>
                        {!paper.summary && (
                          <Button size="sm" onClick={() => generateSummary(paper.id)} disabled={isGeneratingSummary}>
                            {isGeneratingSummary ? (
                              <>
                                <Clock className="h-4 w-4 mr-1 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-1" />
                                Generate AI Summary
                              </>
                            )}
                          </Button>
                        )}
                        {paper.status !== "read" && (
                          <Button variant="outline" size="sm" onClick={() => updateStatus(paper.id, "read")}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Read
                          </Button>
                        )}
                        {paper.status !== "reading" && (
                          <Button variant="outline" size="sm" onClick={() => updateStatus(paper.id, "reading")}>
                            <BookOpen className="h-4 w-4 mr-1" />
                            Reading
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
