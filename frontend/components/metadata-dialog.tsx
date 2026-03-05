"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface MetadataDialogProps {
  isOpen: boolean
  fileName: string
  onSubmit: (metadata: { title: string; author: string; keywords: string; year: string }) => void
  onCancel: () => void
}

export function MetadataDialog({ isOpen, fileName, onSubmit, onCancel }: MetadataDialogProps) {
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [keywords, setKeywords] = useState("")
  const [year, setYear] = useState(new Date().getFullYear().toString())

  const handleSubmit = () => {
    if (!title.trim()) {
      alert("Please enter a paper title")
      return
    }
    onSubmit({ title, author, keywords, year })
    resetForm()
  }

  const resetForm = () => {
    setTitle("")
    setAuthor("")
    setKeywords("")
    setYear(new Date().getFullYear().toString())
  }

  const handleCancel = () => {
    resetForm()
    onCancel()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Paper Metadata</DialogTitle>
          <DialogDescription>Add details about your research paper: {fileName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="meta-title">Paper Title *</Label>
            <Input
              id="meta-title"
              placeholder="Enter the title of the research paper"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-author">Author Name</Label>
            <Input
              id="meta-author"
              placeholder="Enter the primary author name"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-keywords">Keywords</Label>
            <Input
              id="meta-keywords"
              placeholder="Enter keywords (comma-separated)"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-year">Publication Year</Label>
            <Input
              id="meta-year"
              type="number"
              placeholder="Enter publication year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min="1900"
              max={new Date().getFullYear()}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Upload Paper</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
