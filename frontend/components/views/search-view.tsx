"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Search,
  Filter,
  BookOpen,
  Sparkles,
  Clock,
  Star,
  ExternalLink,
  Mic,
  MicOff,
  Volume2,
  AlertCircle,
} from "lucide-react"
import { useSearch } from "@/components/search-provider"
import { API_URL as API_BASE_URL } from "@/lib/config"

interface SearchResult {
  id: string
  file_id: string
  file_name: string
  title: string
  authors: string[]
  year: number
  abstract: string
  keywords: string[]
  citationCount: number
  relevanceScore: number
  status: "read" | "unread" | "reading"
  source: "library" | "external"
  doi?: string
  venue?: string
}


export function SearchView() {
  const { searchQuery, setSearchQuery, isSearching, setIsSearching } = useSearch()
  const [searchType, setSearchType] = useState<"semantic" | "keyword" | "advanced">("semantic")
  const [advancedSearchFields, setAdvancedSearchFields] = useState({
    title: "",
    author: "",
    keywords: "",
    year: "",
  })
  const [filters, setFilters] = useState({
    yearRange: { min: 2000, max: 2024 },
    status: "all",
    source: "all",
    minCitations: 0,
  })
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [savedSearches, setSavedSearches] = useState([
    "machine learning algorithms",
    "deep neural networks",
    "natural language processing",
  ])
  const [apiError, setApiError] = useState<string | null>(null)

  const [isListening, setIsListening] = useState(false)
  const [voiceSearchQuery, setVoiceSearchQuery] = useState("")
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      setVoiceSupported(true)
      const SpeechRecognition = (window as any).webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = "en-US"

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setVoiceSearchQuery(transcript)
        setSearchQuery(transcript)
        setIsListening(false)
        handleVoiceSearch(transcript)
      }

      recognitionRef.current.onerror = () => {
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }
  }, [])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setApiError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          query: searchQuery,
          search_type: searchType,
        }),
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`)
      }

      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Search failed"
      setApiError(errorMessage)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleAdvancedSearch = async () => {
    if (
      !advancedSearchFields.title &&
      !advancedSearchFields.author &&
      !advancedSearchFields.keywords &&
      !advancedSearchFields.year
    ) {
      setApiError("Please enter at least one search criteria")
      return
    }

    setIsSearching(true)
    setApiError(null)

    try {
      const searchParams = new URLSearchParams({
        search_type: "advanced",
      })

      if (advancedSearchFields.title) searchParams.append("title", advancedSearchFields.title)
      if (advancedSearchFields.author) searchParams.append("author", advancedSearchFields.author)
      if (advancedSearchFields.keywords) searchParams.append("keywords", advancedSearchFields.keywords)
      if (advancedSearchFields.year) searchParams.append("year", advancedSearchFields.year)

      const response = await fetch(`${API_BASE_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: searchParams,
      })

      if (!response.ok) {
        throw new Error(`Advanced search failed: ${response.statusText}`)
      }

      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Advanced search failed"
      setApiError(errorMessage)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleVoiceSearch = async (query: string) => {
    setIsSearching(true)
    setApiError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          query: query,
          search_type: "semantic",
        }),
      })

      if (!response.ok) {
        throw new Error(`Voice search failed: ${response.statusText}`)
      }

      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Voice search failed"
      setApiError(errorMessage)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const startVoiceRecognition = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true)
      setVoiceSearchQuery("")
      recognitionRef.current.start()
    }
  }

  const stopVoiceRecognition = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const saveSearch = () => {
    if (searchQuery && !savedSearches.includes(searchQuery)) {
      setSavedSearches([...savedSearches, searchQuery])
    }
  }

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

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "en-US"
      speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-balance">Smart Search</h1>
        <p className="text-muted-foreground text-pretty">
          Use AI-powered semantic search to find relevant papers using natural language queries, keywords, voice
          commands, or metadata filters.
        </p>
      </div>

      {/* API Error Alert */}
      {apiError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}

      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI-Powered Search with Voice Support
          </CardTitle>
          <CardDescription>
            Search your library and external databases using natural language, keywords, voice commands, or metadata
            filters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isListening && (
            <Alert>
              <Mic className="h-4 w-4" />
              <AlertDescription>Listening for voice input... Speak your search query now.</AlertDescription>
            </Alert>
          )}

          {voiceSearchQuery && (
            <Alert>
              <Volume2 className="h-4 w-4" />
              <AlertDescription>Voice input detected: "{voiceSearchQuery}"</AlertDescription>
            </Alert>
          )}

          {/* Search Type Tabs */}
          <Tabs value={searchType} onValueChange={(value) => setSearchType(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="semantic">Semantic Search</TabsTrigger>
              <TabsTrigger value="keyword">Keyword Search</TabsTrigger>
              <TabsTrigger value="advanced">Advanced Search</TabsTrigger>
            </TabsList>

            <TabsContent value="semantic" className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Ask in natural language: 'Papers about transformer architectures'"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pr-12"
                  />
                  {voiceSupported && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`absolute right-1 top-1 h-8 w-8 p-0 ${
                        isListening ? "text-red-500" : "text-muted-foreground"
                      }`}
                      onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? <Clock className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
                <Button variant="outline" onClick={saveSearch}>
                  Save
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Use natural language to describe what you're looking for. AI will understand context and find relevant
                papers. {voiceSupported && "Click the microphone icon to use voice search."}
              </p>
            </TabsContent>

            <TabsContent value="keyword" className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Enter keywords: transformer, attention, neural networks"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pr-12"
                  />
                  {voiceSupported && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`absolute right-1 top-1 h-8 w-8 p-0 ${
                        isListening ? "text-red-500" : "text-muted-foreground"
                      }`}
                      onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? <Clock className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Search using specific keywords, author names, or paper titles.{" "}
                {voiceSupported && "Voice input supported."}
              </p>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Paper Title</label>
                  <Input
                    placeholder="Title contains..."
                    value={advancedSearchFields.title}
                    onChange={(e) => setAdvancedSearchFields({ ...advancedSearchFields, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Author Name</label>
                  <Input
                    placeholder="Author name..."
                    value={advancedSearchFields.author}
                    onChange={(e) => setAdvancedSearchFields({ ...advancedSearchFields, author: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Keywords</label>
                  <Input
                    placeholder="Keywords (comma-separated)..."
                    value={advancedSearchFields.keywords}
                    onChange={(e) => setAdvancedSearchFields({ ...advancedSearchFields, keywords: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Publication Year</label>
                  <Input
                    type="number"
                    placeholder="Year..."
                    value={advancedSearchFields.year}
                    onChange={(e) => setAdvancedSearchFields({ ...advancedSearchFields, year: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleAdvancedSearch} disabled={isSearching}>
                {isSearching ? <Clock className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Advanced Search
              </Button>
              <p className="text-sm text-muted-foreground">
                Search using paper metadata. At least one field is required. Leave fields empty to search all papers.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Saved Searches */}
      <Card>
        <CardHeader>
          <CardTitle>Saved Searches</CardTitle>
          <CardDescription>Quick access to your frequently used search queries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((search, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery(search)
                  setTimeout(() => {
                    setSearchQuery(search)
                    const event = new Event("search")
                  }, 0)
                }}
                className="text-xs"
              >
                {search}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <>
          {/* Search Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Papers</SelectItem>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="unread">Unread</SelectItem>
                      <SelectItem value="reading">Currently Reading</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Source</label>
                  <Select value={filters.source} onValueChange={(value) => setFilters({ ...filters, source: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="library">My Library</SelectItem>
                      <SelectItem value="external">External Databases</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Year Range</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="From"
                      value={filters.yearRange.min}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          yearRange: { ...filters.yearRange, min: Number.parseInt(e.target.value) || 2000 },
                        })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="To"
                      value={filters.yearRange.max}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          yearRange: { ...filters.yearRange, max: Number.parseInt(e.target.value) || 2024 },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Min Citations</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.minCitations}
                    onChange={(e) => setFilters({ ...filters, minCitations: Number.parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Results */}
          <Card>
            <CardHeader>
              <CardTitle>Search Results ({searchResults.length})</CardTitle>
              <CardDescription>Papers ranked by relevance and AI-powered matching</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {searchResults.map((paper) => (
                  <div key={paper.id} className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-balance">{paper.title}</h3>
                          <Badge variant={getStatusColor(paper.status)}>{paper.status}</Badge>
                          {paper.source === "external" && <Badge variant="outline">External</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {paper.authors.join(", ")} • {paper.year} • {paper.venue}
                        </p>
                        <p className="text-sm text-pretty">{paper.abstract}</p>
                        <div className="flex flex-wrap gap-1">
                          {paper.keywords.map((keyword, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="h-4 w-4" />
                          {Math.round(paper.relevanceScore * 100)}% match
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {paper.citationCount.toLocaleString()} citations
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                      <Button size="sm">
                        <BookOpen className="h-4 w-4 mr-1" />
                        {paper.source === "library" ? "Open" : "Add to Library"}
                      </Button>
                      <Button variant="outline" size="sm">
                        Generate Summary
                      </Button>
                      <Button variant="outline" size="sm">
                        Find Similar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => speakText(paper.abstract)}>
                        <Volume2 className="h-4 w-4 mr-1" />
                        Listen
                      </Button>
                      {paper.doi && (
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Original
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {searchResults.length === 0 && !isSearching && (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No search results yet. Try searching for papers to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Search Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Search Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Search Types</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Semantic: "Papers about attention mechanisms"</li>
                <li>• Keyword: "transformer, attention, BERT"</li>
                <li>• Advanced: Filter by title, author, keywords, year</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Advanced Features</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• AI understands context and synonyms</li>
                <li>• Search across uploaded papers</li>
                <li>• Voice search and text-to-speech support</li>
                <li>• Metadata filtering for precise results</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
