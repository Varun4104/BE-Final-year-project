"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Languages, Search, Volume2, Copy, RotateCcw, FileText, BookOpen, Globe } from "lucide-react"
import { API_URL } from "@/lib/config"

interface SearchResult {
  id: string
  title: string
  author: string
  abstract: string
  language: string
  relevanceScore: number
}

interface TranslationResult {
  originalText: string
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
}

export function MultilingualView() {
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [textToTranslate, setTextToTranslate] = useState("")
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchLanguage, setSearchLanguage] = useState("en")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isTranslating, setIsTranslating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const languages = [
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "es", name: "Spanish", flag: "🇪🇸" },
    { code: "fr", name: "French", flag: "🇫🇷" },
    { code: "de", name: "German", flag: "🇩🇪" },
    { code: "it", name: "Italian", flag: "🇮🇹" },
    { code: "pt", name: "Portuguese", flag: "🇵🇹" },
    { code: "ru", name: "Russian", flag: "🇷🇺" },
    { code: "zh", name: "Chinese", flag: "🇨🇳" },
    { code: "ja", name: "Japanese", flag: "🇯🇵" },
    { code: "ko", name: "Korean", flag: "🇰🇷" },
    { code: "ar", name: "Arabic", flag: "🇸🇦" },
    { code: "hi", name: "Hindi", flag: "🇮🇳" },
  ]

  const handleTranslate = async () => {
    if (!textToTranslate.trim()) return

    setIsTranslating(true)

    try {
      const response = await fetch(`${API_URL}/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textToTranslate,
          target_language: languages.find((l) => l.code === selectedLanguage)?.name || "English",
        }),
      })

      if (!response.ok) throw new Error("Translation failed")

      const data = await response.json()

      setTranslationResult({
        originalText: textToTranslate,
        translatedText: data.translated_text,
        sourceLanguage: "Auto-detected",
        targetLanguage: selectedLanguage,
      })
    } catch (error) {
      console.error("Translation error:", error)
    } finally {
      setIsTranslating(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)

    try {
      // Using form data for search endpoint
      const formData = new URLSearchParams()
      formData.append("query", searchQuery)
      formData.append("search_type", "semantic")

      const response = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      })

      if (!response.ok) throw new Error("Search failed")

      const data = await response.json()
      
      const results: SearchResult[] = data.results.map((r: any) => ({
        id: r.file_id,
        title: r.title,
        author: r.authors[0],
        abstract: r.abstract,
        language: "en", // Backend mostly has English papers
        relevanceScore: r.relevanceScore
      }))

      setSearchResults(results)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = selectedLanguage
      speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            Multilingual Interface
          </h1>
          <p className="text-muted-foreground mt-2">Translate text and search research papers in multiple languages</p>
        </div>
        <div className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-primary" />
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    {lang.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Translation Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Text Translation
          </CardTitle>
          <CardDescription>Translate research content to your preferred language</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Text to Translate</label>
              <Textarea
                placeholder="Enter text to translate..."
                value={textToTranslate}
                onChange={(e) => setTextToTranslate(e.target.value)}
                className="min-h-32"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Translation Result</label>
              <div className="min-h-32 p-3 bg-muted rounded-md border">
                {translationResult ? (
                  <div className="space-y-2">
                    <p className="text-foreground">{translationResult.translatedText}</p>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Badge variant="outline" className="text-xs">
                        {translationResult.sourceLanguage} → {translationResult.targetLanguage}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(translationResult.translatedText)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => speakText(translationResult.translatedText)}>
                        <Volume2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Translation will appear here...</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setTextToTranslate("")
                setTranslationResult(null)
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button onClick={handleTranslate} disabled={!textToTranslate.trim() || isTranslating}>
              {isTranslating ? "Translating..." : "Translate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Multilingual Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Multilingual Search
          </CardTitle>
          <CardDescription>Search research papers in multiple languages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={searchLanguage} onValueChange={setSearchLanguage}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      {lang.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search papers in selected language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={!searchQuery.trim() || isSearching}>
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Search Results ({searchResults.length})
              </h3>
              {searchResults.map((result) => (
                <Card key={result.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-foreground hover:text-primary cursor-pointer">{result.title}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {languages.find((l) => l.code === result.language)?.flag} {result.language.toUpperCase()}
                        </Badge>
                        <Badge variant="secondary">{Math.round(result.relevanceScore * 100)}% match</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">by {result.author}</p>
                    <p className="text-sm text-foreground mb-3">{result.abstract}</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <FileText className="h-3 w-3 mr-1" />
                        View Paper
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => speakText(result.abstract)}>
                        <Volume2 className="h-3 w-3 mr-1" />
                        Listen
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(result.title + " - " + result.abstract)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
