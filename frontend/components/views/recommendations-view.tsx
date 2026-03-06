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
  Settings,
  Target,
  Brain,
  Zap,
} from "lucide-react"
import { API_URL } from "@/lib/config"

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

interface RecommendationCategory {
  id: string
  title: string
  description: string
  icon: any
  count: number
  recommendations: Recommendation[]
}

export function RecommendationsView() {

  const [activeCategory, setActiveCategory] = useState("all")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [mockRecommendations, setRecommendations] = useState<Recommendation[]>([])

  const fetchRecommendations = async () => {
    try {
      const res = await fetch(`${API_URL}/recommendations`)
      const data = await res.json()
      // Map API response to Recommendation interface
      const mappedData = data.map((item: any) => ({
        ...item,
        category: item.category || "trending",
        source: item.source || "arxiv",
        relevanceScore: item.relevanceScore || 0.9,
        reason: item.reason || "Recommended for you"
      }))
      setRecommendations(mappedData)
    } catch (error) {
       console.error("Error fetching recommendations:", error)
    }
  }

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const categories: RecommendationCategory[] = [
    {
      id: "trending",
      title: "Trending Papers",
      description: "Popular papers gaining attention in your field",
      icon: TrendingUp,
      count: mockRecommendations.filter((r) => r.category === "trending").length,
      recommendations: mockRecommendations.filter((r) => r.category === "trending"),
    },
    {
      id: "similar",
      title: "Similar to Your Library",
      description: "Papers similar to ones you've already read",
      icon: Target,
      count: mockRecommendations.filter((r) => r.category === "similar").length,
      recommendations: mockRecommendations.filter((r) => r.category === "similar"),
    },
    {
      id: "collaborative",
      title: "Collaborative Filtering",
      description: "Papers read by researchers with similar interests",
      icon: Users,
      count: mockRecommendations.filter((r) => r.category === "collaborative").length,
      recommendations: mockRecommendations.filter((r) => r.category === "collaborative"),
    },
    {
      id: "recent",
      title: "Recent Publications",
      description: "Latest papers in your research areas",
      icon: Calendar,
      count: mockRecommendations.filter((r) => r.category === "recent").length,
      recommendations: mockRecommendations.filter((r) => r.category === "recent"),
    },
    {
      id: "highly-cited",
      title: "Highly Cited",
      description: "Influential papers with high citation counts",
      icon: Star,
      count: mockRecommendations.filter((r) => r.category === "highly-cited").length,
      recommendations: mockRecommendations.filter((r) => r.category === "highly-cited"),
    },
  ]

  const refreshRecommendations = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
    }, 2000)
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "trending":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "similar":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "collaborative":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "recent":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "highly-cited":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const displayedRecommendations =
    activeCategory === "all" ? mockRecommendations : mockRecommendations.filter((r) => r.category === activeCategory)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-balance">AI Recommendations</h1>
          <p className="text-muted-foreground text-pretty">
            Discover relevant papers tailored to your research interests using advanced AI algorithms.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshRecommendations} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </Button>
        </div>
      </div>

      {/* Recommendation Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{mockRecommendations.length}</p>
                <p className="text-sm text-muted-foreground">New Recommendations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(
                    (mockRecommendations.reduce((acc, r) => acc + r.relevanceScore, 0) / mockRecommendations.length) *
                      100,
                  )}
                  %
                </p>
                <p className="text-sm text-muted-foreground">Avg Relevance Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">Daily</p>
                <p className="text-sm text-muted-foreground">Update Frequency</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Recommendation Categories
          </CardTitle>
          <CardDescription>
            Explore different types of AI-powered recommendations based on various algorithms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">All ({mockRecommendations.length})</TabsTrigger>
              {categories.map((category) => {
                const Icon = category.icon
                return (
                  <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    {category.count}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => {
                  const Icon = category.icon
                  return (
                    <Card key={category.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-medium">{category.title}</h3>
                            <p className="text-sm text-muted-foreground">{category.count} papers</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            {categories.map((category) => (
              <TabsContent key={category.id} value={category.id} className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <category.icon className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium">{category.title}</h3>
                    <Badge variant="secondary">{category.count} papers</Badge>
                  </div>
                  <p className="text-muted-foreground mb-6">{category.description}</p>

                  <div className="space-y-4">
                    {category.recommendations.map((paper) => (
                      <Card key={paper.id} className="hover:bg-accent/50 transition-colors">
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-balance">{paper.title}</h3>
                                  <Badge className={getCategoryColor(paper.category)}>
                                    {paper.category.replace("-", " ")}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {paper.authors.slice(0, 3).join(", ")}
                                  {paper.authors.length > 3 && " et al."} • {paper.year} • {paper.venue}
                                </p>
                                <p className="text-sm text-pretty">{paper.abstract}</p>
                                <div className="flex flex-wrap gap-1">
                                  {paper.keywords.map((keyword, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {keyword}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="text-right space-y-2">
                                <div className="flex items-center gap-1 text-sm">
                                  <Star className="h-4 w-4 text-yellow-500" />
                                  {Math.round(paper.relevanceScore * 100)}%
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {paper.citationCount.toLocaleString()} citations
                                </p>
                              </div>
                            </div>

                            <div className="bg-accent/30 rounded-lg p-3">
                              <p className="text-sm">
                                <span className="font-medium">Why recommended:</span> {paper.reason}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                              <Button size="sm">
                                <BookOpen className="h-4 w-4 mr-1" />
                                Add to Library
                              </Button>
                              <Button variant="outline" size="sm">
                                Generate Summary
                              </Button>
                              <Button variant="outline" size="sm">
                                Find Similar
                              </Button>
                              {paper.doi && (
                                <Button variant="outline" size="sm">
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  View Paper
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Recommendation Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendation Preferences</CardTitle>
          <CardDescription>Customize how AI generates recommendations for you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">Research Interests</h4>
              <div className="flex flex-wrap gap-2">
                {[
                  "Natural Language Processing",
                  "Machine Learning",
                  "Computer Vision",
                  "AI Safety",
                  "Deep Learning",
                ].map((interest, index) => (
                  <Badge key={index} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
              <Button variant="outline" size="sm">
                Edit Interests
              </Button>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium">Recommendation Frequency</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Daily updates</span>
                  <Badge variant="outline">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weekly digest</span>
                  <Badge variant="outline">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Trending alerts</span>
                  <Badge variant="outline">Disabled</Badge>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Manage Notifications
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
