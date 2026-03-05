"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Search,
  FileText,
  BookOpen,
  AudioWaveform as Waveform,
  Pause,
  RotateCcw,
  Zap,
  AlertCircle,
} from "lucide-react"

interface SearchResult {
  id: string
  title: string
  author: string
  abstract: string
  file_id?: string
  keywords?: string[]
  year?: number
}

const API_URL = "http://localhost:8000"

export function VoiceSearchView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceLevel, setVoiceLevel] = useState(0)
  const [transcript, setTranscript] = useState("")
  const [confidence, setConfidence] = useState(0)
  const [error, setError] = useState("")

  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animationRef = useRef<number>()
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const isListeningRef = useRef(false)

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) return
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = "en-US"

      recognitionRef.current.onresult = (event: any) => {
        const result = event.results[0][0]
        setTranscript(result.transcript)
        setSearchQuery(result.transcript)
        setConfidence(result.confidence || 0.8)
        handleVoiceSearch(result.transcript)
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error)
        setError(`Speech recognition error: ${event.error}`)
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
        stopAudioAnalysis()
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)

      microphoneRef.current.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateAudioLevel = () => {
        if (analyserRef.current && isListeningRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / bufferLength
          setVoiceLevel(Math.min(100, (average / 255) * 100))
          animationRef.current = requestAnimationFrame(updateAudioLevel)
        }
      }

      updateAudioLevel()
    } catch (error) {
      console.error("Error accessing microphone:", error)
      setError("Unable to access microphone")
    }
  }

  const stopAudioAnalysis = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setVoiceLevel(0)
  }

  const startVoiceRecognition = async () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true)
      setTranscript("")
      setConfidence(0)
      setError("")
      await startAudioAnalysis()
      recognitionRef.current.start()
    }
  }

  const stopVoiceRecognition = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      stopAudioAnalysis()
    }
  }

  const parseVoiceInput = (input: string) => {
    const params: { title?: string; author?: string; keywords?: string; year?: string } = {}

    // Extract author (e.g., "papers by John Smith" or "author Smith")
    const authorMatch = input.match(
      /(?:by|author|from|written by)\s+([A-Za-z\s]+?)(?:\s+(?:about|on|for|by|titled|with|published)|\s*$)/i,
    )
    if (authorMatch) {
      params.author = authorMatch[1].trim()
    }

    // Extract title (e.g., "about neural networks" or "on machine learning")
    const titleMatch = input.match(
      /(?:about|on|titled|regarding|papers on|research on|studies on)\s+([A-Za-z0-9\s&-]+?)(?:\s+(?:by|from|author|published|in|\d{4})|\s*$)/i,
    )
    if (titleMatch) {
      params.title = titleMatch[1].trim()
    }

    // Extract keywords (e.g., "artificial intelligence machine learning")
    const keywordsMatch = input.match(
      /(?:keywords?|topics?|about|concerning)\s+([A-Za-z0-9\s,&-]+?)(?:\s+(?:by|author|published)|\s*$)/i,
    )
    if (keywordsMatch) {
      params.keywords = keywordsMatch[1].trim().replace(/and/gi, ",")
    }

    // Extract year (e.g., "from 2023" or "2024")
    const yearMatch = input.match(/(?:from|in|year|published)?\s+(\d{4})/)
    if (yearMatch) {
      params.year = yearMatch[1]
    }

    return params
  }

  const handleVoiceSearch = async (query: string) => {
    if (!query.trim()) return

    setIsSearching(true)
    setError("")

    try {
      const params = parseVoiceInput(query)

      // Build FormData for the API call
      const formData = new URLSearchParams()
      formData.append("search_type", "advanced")

      if (params.title) formData.append("title", params.title)
      if (params.author) formData.append("author", params.author)
      if (params.keywords) formData.append("keywords", params.keywords)
      if (params.year) formData.append("year", params.year)

      // If no specific parameters extracted, use the full transcript as title
      if (!params.title && !params.author && !params.keywords && !params.year) {
        formData.append("title", query)
      }

      console.log("[v0] Voice search params:", Object.fromEntries(formData))

      const response = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("[v0] Search results:", data)

      // Transform API results to SearchResult format
      const results: SearchResult[] = (data.results || []).map((result: any, index: number) => ({
        id: result.file_id || `result-${index}`,
        title: result.title || "Untitled Paper",
        author: Array.isArray(result.authors) ? result.authors[0] : (result.author || "Unknown Author"),
        abstract: result.abstract || "No abstract available",
        file_id: result.file_id,
        keywords: result.keywords || [],
        year: result.year,
      }))

      setSearchResults(results)

      if (results.length === 0) {
        setError("No papers found matching your voice query. Try a different search.")
      }
    } catch (err) {
      console.error("Voice search error:", err)
      setError(`Search failed: ${err instanceof Error ? err.message : "Unknown error"}`)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const speakText = (text: string) => {
    if ("speechSynthesis" in window && !isSpeaking) {
      setIsSpeaking(true)
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "en-US"

      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      speechSynthesis.speak(utterance)
    }
  }

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Mic className="h-8 w-8 text-primary" />
            Voice Search
          </h1>
          <p className="text-muted-foreground mt-2">
            Search research papers using natural voice commands with AI-powered understanding
          </p>
        </div>
      </div>

      {/* Voice Control Panel */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Waveform className="h-5 w-5" />
            Voice Control Center
          </CardTitle>
          <CardDescription>
            Speak naturally to search for research papers. AI will understand your intent and context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Voice Interface */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Button
                size="lg"
                className={`h-24 w-24 rounded-full text-white transition-all duration-300 ${
                  isListening
                    ? "bg-red-500 hover:bg-red-600 animate-pulse shadow-lg shadow-red-500/50"
                    : "bg-primary hover:bg-primary/90"
                }`}
                onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
              >
                {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </Button>

              {isListening && (
                <div className="absolute -inset-4 rounded-full border-4 border-primary/30 animate-ping" />
              )}
            </div>

            <div className="text-center space-y-2">
              <p className="text-lg font-medium">{isListening ? "Listening..." : "Click to start voice search"}</p>
              {isListening && (
                <div className="space-y-2">
                  <Progress value={voiceLevel} className="w-48 h-2" />
                  <p className="text-sm text-muted-foreground">Voice Level: {Math.round(voiceLevel)}%</p>
                </div>
              )}
            </div>
          </div>

          {/* Live Transcript */}
          {(transcript || isListening) && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Live Transcript
                  </h4>
                  {confidence > 0 && <Badge variant="secondary">{Math.round(confidence * 100)}% confidence</Badge>}
                </div>
                <p className="text-foreground min-h-6">{transcript || (isListening ? "Speak now..." : "")}</p>
              </CardContent>
            </Card>
          )}

          {/* Manual Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Or type your search query here..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleVoiceSearch(searchQuery)}
              className="flex-1"
            />
            <Button onClick={() => handleVoiceSearch(searchQuery)} disabled={!searchQuery.trim() || isSearching}>
              <Search className="h-4 w-4 mr-2" />
              {isSearching ? "Searching..." : "Search"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("")
                setTranscript("")
                setError("")
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Voice Search Results ({searchResults.length})
            </CardTitle>
            <CardDescription>Results found using AI-powered voice understanding and backend search</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {searchResults.map((result) => (
              <Card key={result.id} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-foreground hover:text-primary cursor-pointer">{result.title}</h4>
                    {result.year && <Badge variant="outline">{result.year}</Badge>}
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">by {result.author}</p>
                  <p className="text-sm text-foreground mb-3 line-clamp-2">{result.abstract}</p>

                  {result.keywords && result.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {result.keywords.slice(0, 5).map((keyword, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline">
                      <FileText className="h-3 w-3 mr-1" />
                      View Paper
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => speakText(result.abstract)} disabled={isSpeaking}>
                      {isSpeaking ? <Pause className="h-3 w-3 mr-1" /> : <Volume2 className="h-3 w-3 mr-1" />}
                      {isSpeaking ? "Stop" : "Listen"}
                    </Button>
                    {isSpeaking && (
                      <Button size="sm" variant="ghost" onClick={stopSpeaking}>
                        <VolumeX className="h-3 w-3 mr-1" />
                        Stop All
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Voice Search Tips */}
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardHeader>
          <CardTitle className="text-lg">Voice Search Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Natural Language Examples:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• "Find papers about machine learning in healthcare"</li>
                <li>• "Papers by Dr. Smith on neural networks"</li>
                <li>• "Research about artificial intelligence from 2023"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">How It Works:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Speak naturally about your research interest</li>
                <li>• AI extracts title, author, keywords, and year</li>
                <li>• Searches backend vector database for matches</li>
                <li>• Listen to abstracts using text-to-speech</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
