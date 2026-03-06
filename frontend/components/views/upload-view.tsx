"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useDropzone } from "react-dropzone"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MetadataDialog } from "../metadata-dialog"
import { API_URL as API_BASE_URL } from "@/lib/config"

interface UploadedFile {
  id: string
  name: string
  size: number
  status: "uploading" | "processing" | "completed" | "error"
  progress: number
  fileId?: string
  title?: string
  author?: string
  keywords?: string
  year?: string
  metadata?: {
    title?: string
    authors?: string
    year?: string
    abstract?: string
  }
  errorMessage?: string
}

interface PendingFile {
  file: File
  id: string
}


export function UploadView() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const firstFile = acceptedFiles[0]
      setPendingFile({
        file: firstFile,
        id: Math.random().toString(36).substr(2, 9),
      })
      setDialogOpen(true)

      if (acceptedFiles.length > 1) {
        const remainingFiles = acceptedFiles.slice(1)
        remainingFiles.forEach((file) => {
          const fileId = Math.random().toString(36).substr(2, 9)
          const newFile: UploadedFile = {
            id: fileId,
            name: file.name,
            size: file.size,
            status: "uploading",
            progress: 0,
            title: file.name.replace(/\.[^/.]+$/, ""),
            author: "",
            keywords: "",
            year: new Date().getFullYear().toString(),
          }
          setUploadedFiles((prev) => [...prev, newFile])
          uploadFileToAPI(fileId, file, newFile)
        })
      }
    }
    setApiError(null)
  }, [])

  const handleMetadataSubmit = (metadata: { title: string; author: string; keywords: string; year: string }) => {
    if (pendingFile) {
      const fileId = pendingFile.id
      const newFile: UploadedFile = {
        id: fileId,
        name: pendingFile.file.name,
        size: pendingFile.file.size,
        status: "uploading",
        progress: 0,
        title: metadata.title,
        author: metadata.author,
        keywords: metadata.keywords,
        year: metadata.year,
      }
      setUploadedFiles((prev) => [...prev, newFile])
      uploadFileToAPI(fileId, pendingFile.file, newFile)
      setPendingFile(null)
      setDialogOpen(false)
    }
  }

  const uploadFileToAPI = async (fileId: string, file: File, fileData: UploadedFile) => {
    try {
      setUploadedFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: "uploading", progress: 30 } : f)))

      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", fileData.title || file.name)
      formData.append("author", fileData.author || "")
      formData.append("keywords", fileData.keywords || "")
      formData.append("year", fileData.year || new Date().getFullYear().toString())

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const detail = errorData?.detail || response.statusText
        throw new Error(`Upload failed: ${detail}`)
      }

      const data = await response.json()

      setUploadedFiles((prev) =>
        prev.map((f) => {
          if (f.id === fileId) {
            return {
              ...f,
              status: "processing",
              progress: 70,
              fileId: data.file_id,
            }
          }
          return f
        }),
      )

      setTimeout(() => {
        setUploadedFiles((prev) =>
          prev.map((f) => {
            if (f.id === fileId) {
              return {
                ...f,
                status: "completed",
                progress: 100,
                metadata: {
                  title: data.meta?.title || fileData.title || data.file_name || "Research Paper",
                  authors: data.meta?.author || fileData.author || "AI detected",
                  year: data.meta?.year?.toString() || fileData.year || new Date().getFullYear().toString(),
                  abstract: `Successfully uploaded and indexed ${data.chunks || 0} chunks from the document.`,
                },
              }
            }
            return f
          }),
        )
      }, 1000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      setApiError(errorMessage)
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: "error",
                errorMessage,
              }
            : f,
        ),
      )
    }
  }

  const updateFileMetadata = (fileId: string, field: string, value: string) => {
    setUploadedFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, [field]: value } : f)))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    multiple: true,
  })

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="p-6 space-y-6">
      <MetadataDialog
        isOpen={dialogOpen}
        fileName={pendingFile?.file.name || ""}
        onSubmit={handleMetadataSubmit}
        onCancel={() => {
          setPendingFile(null)
          setDialogOpen(false)
        }}
      />

      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-balance">Upload Research Papers</h1>
        <p className="text-muted-foreground text-pretty">
          Upload your research papers and let AI extract metadata, generate summaries, and organize them automatically.
        </p>
      </div>

      {apiError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add New Papers</CardTitle>
          <CardDescription>
            Drag and drop files or click to browse. Supports PDF, DOC, and DOCX formats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary hover:bg-accent/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop the files here...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-medium">Drag & drop your research papers here</p>
                <p className="text-sm text-muted-foreground">or click to select files from your computer</p>
                <Button variant="outline" className="mt-4 bg-transparent">
                  Browse Files
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Papers ({uploadedFiles.length})</CardTitle>
            <CardDescription>Track the progress of your uploaded papers and AI processing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-balance">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          file.status === "completed"
                            ? "default"
                            : file.status === "error"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {file.status === "uploading" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {file.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {file.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {file.status === "error" && <AlertCircle className="h-3 w-3 mr-1" />}
                        {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {file.status !== "completed" && file.status !== "error" && (
                    <div className="space-y-2">
                      <Progress value={file.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {file.status === "uploading" ? "Uploading to server..." : "Processing with AI and indexing..."}
                      </p>
                    </div>
                  )}

                  {file.status === "error" && <div className="text-sm text-destructive">{file.errorMessage}</div>}

                  {(file.status === "uploading" || file.status === "processing") && (
                    <div className="space-y-3 pt-3 border-t">
                      <h4 className="font-medium">Paper Metadata (Edit before upload completes)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`title-${file.id}`}>Paper Title</Label>
                          <Input
                            id={`title-${file.id}`}
                            placeholder="Enter paper title"
                            value={file.title || ""}
                            onChange={(e) => updateFileMetadata(file.id, "title", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`author-${file.id}`}>Author Name</Label>
                          <Input
                            id={`author-${file.id}`}
                            placeholder="Enter author name"
                            value={file.author || ""}
                            onChange={(e) => updateFileMetadata(file.id, "author", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`keywords-${file.id}`}>Keywords</Label>
                          <Input
                            id={`keywords-${file.id}`}
                            placeholder="Enter keywords (comma-separated)"
                            value={file.keywords || ""}
                            onChange={(e) => updateFileMetadata(file.id, "keywords", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`year-${file.id}`}>Publication Year</Label>
                          <Input
                            id={`year-${file.id}`}
                            type="number"
                            placeholder="Enter publication year"
                            value={file.year || new Date().getFullYear()}
                            onChange={(e) => updateFileMetadata(file.id, "year", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {file.status === "completed" && file.metadata && (
                    <div className="space-y-3 pt-3 border-t">
                      <h4 className="font-medium">Upload Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`title-display-${file.id}`}>Paper Title</Label>
                          <Input
                            id={`title-display-${file.id}`}
                            defaultValue={file.title || file.metadata.title}
                            placeholder="Paper title"
                            readOnly
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`author-display-${file.id}`}>Author</Label>
                          <Input
                            id={`author-display-${file.id}`}
                            defaultValue={file.author || file.metadata.authors}
                            placeholder="Author name"
                            readOnly
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`year-display-${file.id}`}>Publication Year</Label>
                          <Input
                            id={`year-display-${file.id}`}
                            defaultValue={file.year || file.metadata.year}
                            placeholder="Publication year"
                            readOnly
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`fileid-display-${file.id}`}>File ID</Label>
                          <Input
                            id={`fileid-display-${file.id}`}
                            defaultValue={file.fileId}
                            placeholder="File ID"
                            readOnly
                            className="text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <div className="flex gap-2">
                          <Badge variant="default">Indexed</Badge>
                          <Badge variant="outline">Ready to Search</Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`abstract-display-${file.id}`}>Upload Status</Label>
                        <Textarea
                          id={`abstract-display-${file.id}`}
                          defaultValue={file.metadata.abstract}
                          placeholder="Status"
                          rows={3}
                          readOnly
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" disabled>
                          Save to Library
                        </Button>
                        <Button variant="outline" size="sm">
                          View in Search
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Supported Formats</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• PDF documents (.pdf)</li>
                <li>• Word documents (.doc, .docx)</li>
                <li>• Maximum file size: 50MB</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Metadata Information</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Add paper title for better searchability</li>
                <li>• Include author names for filtering</li>
                <li>• Use keywords for categorization</li>
                <li>• Publication year helps with filtering</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
