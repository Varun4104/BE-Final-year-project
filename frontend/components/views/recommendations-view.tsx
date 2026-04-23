"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Lightbulb,
  TrendingUp,
  Users,
  Calendar,
  Star,
  BookOpen,
  ExternalLink,
  RefreshCw,
  Target,
  Brain,
  Zap,
  Search,
  FileSearch,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { API_URL } from "@/lib/config"
import { useSearch } from "@/components/search-provider"

interface Recommendation {
  id: string
  title: string
  authors: string[]
  year: number
  abstract: string
  keywords: string[]
  citationCount: number
  venue?: string
  doi?: string
  relevanceScore: number
  reason: string
  category: "trending" | "similar" | "collaborative" | "recent" | "highly-cited"
  source: "arxiv" | "pubmed" | "ieee" | "acm" | "springer"
}

const CATEGORIES = [
  { id: "trending",     label: "Trending",      icon: TrendingUp, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { id: "similar",      label: "Similar",        icon: Target,     color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { id: "collaborative",label: "Collaborative",  icon: Users,      color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { id: "recent",       label: "Recent",         icon: Calendar,   color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { id: "highly-cited", label: "Highly Cited",   icon: Star,       color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
] as const

export function RecommendationsView() {
  const { navigate } = useSearch()

  const [activeCategory, setActiveCategory] = useState("all")
  const [isFetching, setIsFetching] = useState(false)
  const [domain, setDomain] = useState("machine learning")
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])

  const fetchRecommendations = async (searchDomain = domain) => {
    setIsFetching(true)
    try {
      const res = await fetch(`${API_URL}/recommendations?domain=${encodeURIComponent(searchDomain)}`)
      const data = await res.json()
      const mapped: Recommendation[] = data.map((item: any) => ({
        ...item,
        category: item.category || "trending",
        source: item.source || "arxiv",
        relevanceScore: item.relevanceScore ?? 0.9,
        reason: item.reason || "Recommended for you",
      }))
      setRecommendations(mapped)
    } catch (error) {
      console.error("Error fetching recommendations:", error)
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const countFor = (cat: string) => recommendations.filter((r) => r.category === cat).length

  const displayed =
    activeCategory === "all"
      ? recommendations
      : recommendations.filter((r) => r.category === activeCategory)

  const avgRelevance =
    recommendations.length > 0
      ? Math.round((recommendations.reduce((s, r) => s + r.relevanceScore, 0) / recommendations.length) * 100)
      : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">AI Recommendations</h1>
          <p className="text-muted-foreground">
            Discover relevant papers tailored to your research interests using advanced AI algorithms.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchRecommendations()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Domain Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search Research Domain
          </CardTitle>
          <CardDescription>Fetch latest papers from arXiv for your research domain</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchRecommendations()}
            placeholder="e.g. machine learning, AI healthcare, NLP..."
            className="flex-1"
          />
          <Button onClick={() => fetchRecommendations()} disabled={isFetching} className="gap-2 shrink-0">
            {isFetching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search arXiv
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{recommendations.length}</p>
                <p className="text-sm text-muted-foreground">Recommendations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{avgRelevance}%</p>
                <p className="text-sm text-muted-foreground">Avg Relevance Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">arXiv</p>
                <p className="text-sm text-muted-foreground">Source</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Paper List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Recommended Papers
          </CardTitle>
          <CardDescription>AI-powered recommendations across different categories</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="flex flex-wrap h-auto gap-1 mb-6">
              <TabsTrigger value="all">All ({recommendations.length})</TabsTrigger>
              {CATEGORIES.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id} className="gap-1">
                  <Icon className="h-3 w-3" />
                  {label} ({countFor(id)})
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Shared content for all tab values */}
            {["all", ...CATEGORIES.map((c) => c.id)].map((tabId) => (
              <TabsContent key={tabId} value={tabId}>
                <PaperList
                  papers={tabId === "all" ? recommendations : recommendations.filter((r) => r.category === tabId)}
                  isFetching={isFetching}
                  navigate={navigate}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function PaperList({
  papers,
  isFetching,
  navigate,
}: {
  papers: Recommendation[]
  isFetching: boolean
  navigate: (view: string) => void
}) {
  if (isFetching) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-border rounded-xl p-5 animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  if (papers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
        <FileSearch className="h-10 w-10 opacity-40" />
        <p className="font-medium">No papers found</p>
        <p className="text-sm">Try searching a different domain or refreshing.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {papers.map((paper) => {
        const cat = CATEGORIES.find((c) => c.id === paper.category)
        const Icon = cat?.icon ?? TrendingUp
        return (
          <Card key={paper.id} className="hover:bg-accent/40 transition-colors">
            <CardContent className="pt-5 pb-4">
              <div className="space-y-3">
                {/* Title row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm leading-snug">{paper.title}</h3>
                      {cat && (
                        <Badge className={`${cat.color} text-[10px] shrink-0 gap-1`}>
                          <Icon className="h-2.5 w-2.5" />
                          {cat.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {paper.authors.slice(0, 3).join(", ")}
                      {paper.authors.length > 3 && " et al."} · {paper.year}
                      {paper.venue && ` · ${paper.venue}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="flex items-center gap-1 justify-end text-sm font-semibold text-yellow-600">
                      <Star className="h-3.5 w-3.5" />
                      {Math.round(paper.relevanceScore * 100)}%
                    </div>
                    <p className="text-xs text-muted-foreground">{paper.citationCount.toLocaleString()} citations</p>
                  </div>
                </div>

                {/* Abstract */}
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{paper.abstract}</p>

                {/* Keywords */}
                {paper.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {paper.keywords.map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Why recommended */}
                <div className="bg-accent/40 rounded-lg px-3 py-2">
                  <p className="text-xs">
                    <span className="font-medium">Why recommended: </span>
                    {paper.reason}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <Button size="sm" onClick={() => navigate("upload")} className="h-7 text-xs gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    Add to Library
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("plagiarism")}>
                    Check Similarity
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("search")}>
                    Find Similar
                  </Button>
                  {paper.doi && (
                    <a href={paper.doi} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        <ExternalLink className="h-3.5 w-3.5" />
                        View on arXiv
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
