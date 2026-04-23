"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, AlertTriangle, CheckCircle, X, Eye, Download, Trash2, Loader, Globe, ExternalLink, Sparkles, BookOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { API_URL as API_BASE_URL } from "@/lib/config"

interface TopMatch {
  file_name: string
  file_id: string
  similarity: number
  excerpt: string
}

interface WebMatch {
  source: string
  title: string
  authors?: string[]
  similarity: number
  excerpt: string
  url: string | null
  analysis?: string
  verdict?: string
}

interface PlagiarismResult {
  filename: string
  file_id: string
  plagiarism_score: number
  local_score?: number
  web_score?: number
  top_matches: TopMatch[]
  web_matches?: WebMatch[]
  status: "analyzing" | "passed" | "rejected" | "pending_review"
  isWebCheck: boolean
}

function verdictStyle(verdict?: string): { bg: string; text: string; border: string; label: string } {
  const v = (verdict || "").toLowerCase()
  if (v.includes("original") || v.includes("no plagiarism")) {
    return { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", label: "Original" }
  }
  if (v.includes("duplicate") || v.includes("plagiar")) {
    return { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800", label: "Duplicate" }
  }
  return { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", label: "Similar" }
}

function similarityColor(pct: number) {
  if (pct >= 50) return "text-red-600"
  if (pct >= 20) return "text-amber-600"
  return "text-emerald-600"
}

export function PlagiarismView() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [results, setResults] = useState<PlagiarismResult[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [currentResult, setCurrentResult] = useState<PlagiarismResult | null>(null)
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setUploadedFiles((prev) => [...prev, ...files])
    setError(null)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    const pdfFiles = files.filter((file) => file.type === "application/pdf")
    if (pdfFiles.length !== files.length) {
      setError("Only PDF files are supported")
    }
    setUploadedFiles((prev) => [...prev, ...pdfFiles])
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const analyzePlagiarism = async (file: File, useWeb = false) => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const endpoint = useWeb ? `${API_BASE_URL}/check_plagiarism_web` : `${API_BASE_URL}/check_plagiarism`
      const response = await fetch(endpoint, { method: "POST", body: formData })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()

      const result: PlagiarismResult = {
        filename: file.name,
        file_id: data.file_id || "",
        plagiarism_score: data.plagiarism_score || 0,
        local_score: data.local_score,
        web_score: data.web_score,
        top_matches: data.top_matches || [],
        web_matches: data.web_matches || [],
        status: (data.plagiarism_score || 0) > 20 ? "pending_review" : "passed",
        isWebCheck: useWeb,
      }

      setResults((prev) => [...prev, result])
      setCurrentResult(result)
      setShowDecisionDialog(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to analyze plagiarism"
      setError(errorMessage)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAcceptPaper = () => {
    if (currentResult) {
      setResults((prev) =>
        prev.map((result) => (result.file_id === currentResult.file_id ? { ...result, status: "passed" } : result)),
      )
    }
    setShowDecisionDialog(false)
    setCurrentResult(null)
  }

  const handleRejectPaper = () => {
    if (currentResult) {
      setResults((prev) =>
        prev.map((result) => (result.file_id === currentResult.file_id ? { ...result, status: "rejected" } : result)),
      )
    }
    setShowDecisionDialog(false)
    setCurrentResult(null)
  }

  const preparePieChartData = (result: PlagiarismResult) => {
    const originalContent = 100 - result.plagiarism_score
    return [
      { name: "Original Content", value: originalContent, color: "#10b981" },
      { name: "Similar Content", value: result.plagiarism_score, color: result.plagiarism_score > 20 ? "#ef4444" : "#f59e0b" },
    ]
  }

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize="12" fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const removeResult = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Plagiarism Detection</h1>
          <p className="text-muted-foreground mt-2">
            Upload research papers to check for plagiarism against your existing library
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {results.filter((r) => r.status === "passed").length}
            </div>
            <div className="text-muted-foreground">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {results.filter((r) => r.status === "rejected").length}
            </div>
            <div className="text-muted-foreground">Rejected</div>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Papers for Analysis
          </CardTitle>
          <CardDescription>
            Drag and drop PDF files or click to browse. Papers with &gt;20% similarity will require review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">Drop your research papers here</p>
            <p className="text-muted-foreground mb-4">or click to browse files</p>
            <Button variant="outline">Choose Files</Button>
            <input id="file-upload" type="file" multiple accept=".pdf" className="hidden" onChange={handleFileUpload} />
          </div>

          {uploadedFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-medium text-foreground">Uploaded Files</h3>
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => analyzePlagiarism(file, false)} disabled={isAnalyzing} className="gap-2">
                      {isAnalyzing ? <><Loader className="h-4 w-4 animate-spin" />Analyzing...</> : "Local Check"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => analyzePlagiarism(file, true)} disabled={isAnalyzing} className="gap-2">
                      {isAnalyzing ? <Loader className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                      Web Check
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeFile(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>Plagiarism detection results for uploaded papers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-medium text-foreground">{result.filename}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {result.status === "passed" ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />Accepted
                          </Badge>
                        ) : result.status === "rejected" ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />Rejected
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Eye className="h-3 w-3 mr-1" />Pending Review
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">{result.plagiarism_score}% similarity</span>
                        {result.isWebCheck && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Globe className="h-3 w-3" />Web Check
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setCurrentResult(result); setShowDetailedAnalysis(true) }}>
                      <Eye className="h-4 w-4 mr-1" />View Details
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeResult(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Similarity Score</span>
                      <span className="text-sm text-muted-foreground">{result.plagiarism_score}%</span>
                    </div>
                    <Progress value={result.plagiarism_score} className="h-2" />
                  </div>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={preparePieChartData(result)} cx="50%" cy="50%" labelLine={false} label={renderCustomLabel} outerRadius={50} dataKey="value">
                          {preparePieChartData(result).map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`${value}%`, ""]} labelFormatter={(label) => label} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {result.status === "rejected" && (
                  <Alert variant="destructive" className="mb-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Paper Rejected:</strong> This paper has been rejected due to high similarity ({result.plagiarism_score}%) exceeding the 20% threshold.
                    </AlertDescription>
                  </Alert>
                )}

                {result.status === "passed" && (
                  <Alert className="mb-3 border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Paper Accepted:</strong> {result.plagiarism_score}% similarity is within acceptable limits.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Score breakdown — only for web checks */}
                {result.isWebCheck && result.web_score !== undefined && (
                  <div className="flex gap-4 text-xs text-muted-foreground bg-muted/50 rounded-md p-2 mb-3">
                    <span>Web (arXiv): <strong>{result.web_score}%</strong></span>
                  </div>
                )}

                {/* Local matches — only for local checks */}
                {!result.isWebCheck && result.top_matches && result.top_matches.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">
                      Library Matches ({result.top_matches.length})
                    </h4>
                    <div className="space-y-2">
                      {result.top_matches.map((match, matchIndex) => (
                        <div key={matchIndex} className="bg-muted p-3 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-foreground text-sm">{match.file_name}</h5>
                            <Badge variant="outline">{match.similarity}% match</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground italic line-clamp-2">
                            "{match.excerpt.substring(0, 100)}..."
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Web matches — visually rich cards */}
                {result.isWebCheck && result.web_matches && result.web_matches.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-blue-500" />
                      Web Sources — arXiv
                      <span className="ml-1 text-xs font-normal text-muted-foreground">({result.web_matches.length} found)</span>
                    </h4>
                    <div className="space-y-3">
                      {result.web_matches.map((match, matchIndex) => {
                        const vs = verdictStyle(match.verdict)
                        return (
                          <div key={matchIndex} className={`rounded-xl border ${vs.border} overflow-hidden`}>
                            {/* Card header */}
                            <div className={`${vs.bg} px-4 py-3 flex items-start justify-between gap-3`}>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-foreground leading-snug">{match.title}</p>
                                {match.authors && match.authors.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{match.authors.join(", ")}</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span className={`text-xl font-bold ${similarityColor(match.similarity)}`}>
                                  {match.similarity}%
                                </span>
                                <Badge className={`text-[10px] px-2 py-0 ${vs.bg} ${vs.text} border ${vs.border}`}>
                                  {vs.label}
                                </Badge>
                              </div>
                            </div>

                            {/* Similarity bar */}
                            <div className="px-4 pt-2 pb-1 bg-background">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground w-14 shrink-0">Similarity</span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${match.similarity >= 50 ? "bg-red-500" : match.similarity >= 20 ? "bg-amber-500" : "bg-emerald-500"}`}
                                    style={{ width: `${match.similarity}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground w-8 text-right">{match.similarity}%</span>
                              </div>
                            </div>

                            {/* Excerpt */}
                            <div className="px-4 py-2 bg-background">
                              <div className="flex items-start gap-1.5">
                                <BookOpen className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                <p className="text-xs text-muted-foreground italic line-clamp-3">
                                  "{match.excerpt}"
                                </p>
                              </div>
                            </div>

                            {/* AI Analysis */}
                            {match.analysis && (
                              <div className="mx-4 mb-3 rounded-lg bg-muted/60 border border-border p-3">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                                    AI Analysis
                                  </span>
                                  {match.verdict && (
                                    <span className={`ml-auto text-[10px] font-semibold uppercase ${vs.text}`}>
                                      {match.verdict}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-foreground leading-relaxed">{match.analysis}</p>
                              </div>
                            )}

                            {/* Footer */}
                            {match.url && (
                              <div className="px-4 pb-3 bg-background">
                                <a
                                  href={match.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View on arXiv
                                </a>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Decision Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentResult && currentResult.plagiarism_score > 20 ? (
                <><AlertTriangle className="h-5 w-5 text-destructive" />High Similarity Detected - Review Required</>
              ) : (
                <><CheckCircle className="h-5 w-5 text-green-600" />Analysis Complete - Low Similarity</>
              )}
            </DialogTitle>
            <DialogDescription>
              Review the plagiarism analysis results and decide whether to accept or reject this paper.
            </DialogDescription>
          </DialogHeader>
          {currentResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-4 rounded-lg ${currentResult.plagiarism_score > 20 ? "bg-destructive/10" : "bg-green-50"}`}>
                  <h3 className="font-medium text-foreground mb-2">{currentResult.filename}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">Similarity Score:</span>
                      <div className="font-bold text-lg">{currentResult.plagiarism_score}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {currentResult.isWebCheck ? "Web Matches:" : "Matched Papers:"}
                      </span>
                      <div className="font-bold text-lg">
                        {currentResult.isWebCheck
                          ? (currentResult.web_matches?.length ?? 0)
                          : currentResult.top_matches.length}
                      </div>
                    </div>
                  </div>
                  <Progress value={currentResult.plagiarism_score} className="h-2" />
                </div>

                <div className="h-48">
                  <h4 className="text-sm font-medium mb-2">Content Analysis</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={preparePieChartData(currentResult)} cx="50%" cy="50%" labelLine={false} label={renderCustomLabel} outerRadius={70} dataKey="value">
                        {preparePieChartData(currentResult).map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value}%`, ""]} labelFormatter={(label) => label} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {currentResult.plagiarism_score > 20 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> This paper exceeds the 20% similarity threshold with {currentResult.plagiarism_score}% similarity detected.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Good:</strong> This paper shows {currentResult.plagiarism_score}% similarity, within acceptable limits.
                  </AlertDescription>
                </Alert>
              )}

              {/* Dialog: local matches only for local check */}
              {!currentResult.isWebCheck && currentResult.top_matches && currentResult.top_matches.length > 0 && (
                <div className="max-h-60 overflow-y-auto">
                  <h4 className="font-medium mb-2">Matched Papers:</h4>
                  {currentResult.top_matches.map((match, idx) => (
                    <div key={idx} className="bg-muted p-3 rounded-md mb-2">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">{match.file_name}</span>
                        <Badge variant="outline">{match.similarity}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground italic">{match.excerpt.substring(0, 150)}...</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Dialog: web matches summary for web check */}
              {currentResult.isWebCheck && currentResult.web_matches && currentResult.web_matches.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  <h4 className="font-medium mb-2 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-blue-500" />Web Matches:
                  </h4>
                  {currentResult.web_matches.map((match, idx) => {
                    const vs = verdictStyle(match.verdict)
                    return (
                      <div key={idx} className={`p-3 rounded-lg border ${vs.border} ${vs.bg}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-sm">{match.title}</span>
                          <Badge className={`${vs.bg} ${vs.text} border ${vs.border} text-xs`}>{match.similarity}%</Badge>
                        </div>
                        {match.verdict && <p className={`text-xs font-semibold ${vs.text}`}>{match.verdict}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectPaper} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-2" />Reject Paper
            </Button>
            <Button variant="default" onClick={handleAcceptPaper} className="bg-green-600 hover:bg-green-700">
              <Download className="h-4 w-4 mr-2" />Accept Paper
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed Analysis Dialog */}
      <Dialog open={showDetailedAnalysis} onOpenChange={setShowDetailedAnalysis}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detailed Plagiarism Analysis</DialogTitle>
            <DialogDescription>Comprehensive analysis of similarity detection results</DialogDescription>
          </DialogHeader>
          {currentResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Similarity Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={preparePieChartData(currentResult)} cx="50%" cy="50%" labelLine={false} label={renderCustomLabel} outerRadius={80} dataKey="value">
                            {preparePieChartData(currentResult).map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value}%`, ""]} labelFormatter={(label) => label} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Analysis Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-primary">{currentResult.plagiarism_score}%</div>
                        <div className="text-sm text-muted-foreground">Similarity</div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-primary">{100 - currentResult.plagiarism_score}%</div>
                        <div className="text-sm text-muted-foreground">Original</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{currentResult.isWebCheck ? "Web Matches:" : "Matched Papers:"}</span>
                        <span className="font-medium">
                          {currentResult.isWebCheck
                            ? (currentResult.web_matches?.length ?? 0)
                            : currentResult.top_matches.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={currentResult.status === "passed" ? "default" : currentResult.status === "rejected" ? "destructive" : "secondary"}>
                          {currentResult.status === "passed" ? "Accepted" : currentResult.status === "rejected" ? "Rejected" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed: local matches */}
              {!currentResult.isWebCheck && currentResult.top_matches && currentResult.top_matches.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Matched Papers Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {currentResult.top_matches.map((match, idx) => (
                        <div key={idx} className="bg-muted p-4 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium">{match.file_name}</h4>
                            <Badge variant="outline">{match.similarity}% match</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground italic">
                            Excerpt: {match.excerpt.substring(0, 200)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detailed: web matches */}
              {currentResult.isWebCheck && currentResult.web_matches && currentResult.web_matches.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-500" />Web Source Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {currentResult.web_matches.map((match, idx) => {
                        const vs = verdictStyle(match.verdict)
                        return (
                          <div key={idx} className={`rounded-xl border ${vs.border} overflow-hidden`}>
                            <div className={`${vs.bg} px-4 py-3 flex items-start justify-between gap-3`}>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-foreground">{match.title}</p>
                                {match.authors && match.authors.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{match.authors.join(", ")}</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span className={`text-xl font-bold ${similarityColor(match.similarity)}`}>{match.similarity}%</span>
                                <Badge className={`text-[10px] px-2 py-0 ${vs.bg} ${vs.text} border ${vs.border}`}>{vs.label}</Badge>
                              </div>
                            </div>
                            <div className="px-4 py-3 bg-background space-y-3">
                              <div className="flex items-start gap-1.5">
                                <BookOpen className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                <p className="text-xs text-muted-foreground italic">"{match.excerpt}"</p>
                              </div>
                              {match.analysis && (
                                <div className="rounded-lg bg-muted/60 border border-border p-3">
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">AI Analysis</span>
                                    {match.verdict && (
                                      <span className={`ml-auto text-[10px] font-semibold uppercase ${vs.text}`}>{match.verdict}</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-foreground leading-relaxed">{match.analysis}</p>
                                </div>
                              )}
                              {match.url && (
                                <a href={match.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                                  <ExternalLink className="h-3 w-3" />View on arXiv
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailedAnalysis(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
