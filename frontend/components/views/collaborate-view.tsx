"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Users, ArrowLeft, Send, FileText } from "lucide-react"

const API_URL = "http://localhost:8000"
const WS_URL = "ws://localhost:8000"

interface Paper {
  file_id: string
  title: string
  author: string
  year: number
  keywords: string[]
  abstract: string
}

interface Note {
  id: string
  paper_id: string
  author_name: string
  content: string
  created_at: string
  updated_at: string
}

interface Comment {
  id: string
  paper_id: string
  author_name: string
  content: string
  created_at: string
}

export function CollaborateView() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [userName, setUserName] = useState("")
  const [nameInput, setNameInput] = useState("")
  const [showNameModal, setShowNameModal] = useState(false)
  const [pendingPaper, setPendingPaper] = useState<Paper | null>(null)

  const [notes, setNotes] = useState<Note[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [noteText, setNoteText] = useState("")
  const [commentText, setCommentText] = useState("")
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [savingNote, setSavingNote] = useState(false)
  const [postingComment, setPostingComment] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Load papers on mount
  useEffect(() => {
    fetch(`${API_URL}/all_pdfs`)
      .then((r) => r.json())
      .then((d) => setPapers(d.pdfs || []))
      .catch(console.error)
  }, [])

  const enterWorkspace = (paper: Paper) => {
    setPendingPaper(paper)
    setShowNameModal(true)
  }

  const joinWorkspace = async () => {
    if (!nameInput.trim() || !pendingPaper) return
    const name = nameInput.trim()
    setUserName(name)
    setShowNameModal(false)
    setSelectedPaper(pendingPaper)

    // Load notes + comments
    const [notesRes, commentsRes] = await Promise.all([
      fetch(`${API_URL}/papers/${pendingPaper.file_id}/notes`),
      fetch(`${API_URL}/papers/${pendingPaper.file_id}/comments`),
    ])
    setNotes(await notesRes.json())
    setComments(await commentsRes.json())

    // Connect WebSocket
    const ws = new WebSocket(`${WS_URL}/ws/collaborate/${pendingPaper.file_id}`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", name }))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === "user_joined" || msg.type === "user_left") {
        setOnlineUsers(msg.online_users)
      } else if (msg.type === "note_added") {
        setNotes((prev) => [...prev, msg.note])
      } else if (msg.type === "comment_added") {
        setComments((prev) => [...prev, msg.comment])
      }
    }

    ws.onerror = console.error
  }

  const leaveWorkspace = () => {
    wsRef.current?.close()
    wsRef.current = null
    setSelectedPaper(null)
    setNotes([])
    setComments([])
    setOnlineUsers([])
    setNoteText("")
    setCommentText("")
  }

  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments])

  const saveNote = async () => {
    if (!noteText.trim() || !selectedPaper) return
    setSavingNote(true)
    try {
      await fetch(`${API_URL}/papers/${selectedPaper.file_id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author_name: userName, content: noteText }),
      })
      setNoteText("")
    } catch (e) {
      console.error(e)
    } finally {
      setSavingNote(false)
    }
  }

  const postComment = async () => {
    if (!commentText.trim() || !selectedPaper) return
    setPostingComment(true)
    try {
      await fetch(`${API_URL}/papers/${selectedPaper.file_id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author_name: userName, content: commentText }),
      })
      setCommentText("")
    } catch (e) {
      console.error(e)
    } finally {
      setPostingComment(false)
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  // ---- Workspace view ----
  if (selectedPaper) {
    return (
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={leaveWorkspace}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <span className="font-semibold truncate max-w-xs">{selectedPaper.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-1">Online:</span>
            {onlineUsers.map((u) => (
              <Badge key={u} variant={u === userName ? "default" : "secondary"}>
                {u}
              </Badge>
            ))}
          </div>
        </div>

        {/* Three-column workspace */}
        <div className="flex flex-1 overflow-hidden gap-0">
          {/* Left: Paper info */}
          <div className="w-56 shrink-0 border-r p-4 overflow-y-auto space-y-3">
            <h3 className="font-semibold text-sm">Paper Info</h3>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{selectedPaper.title}</p>
              {selectedPaper.author && <p className="text-muted-foreground">by {selectedPaper.author}</p>}
              {selectedPaper.year && <p className="text-muted-foreground">{selectedPaper.year}</p>}
            </div>
            {selectedPaper.keywords?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedPaper.keywords.slice(0, 6).map((k) => (
                  <Badge key={k} variant="outline" className="text-xs">
                    {k}
                  </Badge>
                ))}
              </div>
            )}
            {selectedPaper.abstract && (
              <p className="text-xs text-muted-foreground line-clamp-6">{selectedPaper.abstract}</p>
            )}
          </div>

          {/* Center: Shared notes */}
          <div className="flex-1 flex flex-col border-r overflow-hidden">
            <div className="p-4 border-b shrink-0">
              <h3 className="font-semibold text-sm mb-2">Shared Notes</h3>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="resize-none text-sm"
                  rows={3}
                />
              </div>
              <Button size="sm" className="mt-2" onClick={saveNote} disabled={savingNote || !noteText.trim()}>
                {savingNote ? "Saving..." : "Save Note"}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notes.length === 0 && (
                <p className="text-sm text-muted-foreground">No notes yet. Add the first one!</p>
              )}
              {notes.map((n) => (
                <Card key={n.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{n.author_name}</span>
                      <span className="text-xs text-muted-foreground">{formatTime(n.created_at)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Right: Comments */}
          <div className="w-72 shrink-0 flex flex-col overflow-hidden">
            <div className="p-4 border-b shrink-0">
              <h3 className="font-semibold text-sm">Comments</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{c.author_name}</span>
                    <span className="text-xs text-muted-foreground">{formatTime(c.created_at)}</span>
                  </div>
                  <p className="text-sm bg-muted rounded px-3 py-2 whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>
            <div className="p-3 border-t shrink-0 flex gap-2">
              <Input
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && postComment()}
                className="text-sm"
              />
              <Button size="sm" onClick={postComment} disabled={postingComment || !commentText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- Paper list view ----
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Collaborate
        </h1>
        <p className="text-muted-foreground mt-2">
          Work on papers together with shared notes, comments, and live presence.
        </p>
      </div>

      {papers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No papers uploaded yet. Upload a paper first to collaborate.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {papers.map((paper) => (
            <Card key={paper.file_id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base line-clamp-2">{paper.title || "Untitled"}</CardTitle>
                {paper.author && (
                  <CardDescription>by {paper.author}{paper.year ? ` · ${paper.year}` : ""}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-3">
                {paper.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {paper.keywords.slice(0, 4).map((k) => (
                      <Badge key={k} variant="outline" className="text-xs">
                        {k}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button size="sm" onClick={() => enterWorkspace(paper)}>
                  <Users className="h-4 w-4 mr-2" />
                  Collaborate
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Name modal */}
      <Dialog open={showNameModal} onOpenChange={setShowNameModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter your name</DialogTitle>
            <DialogDescription>
              Your name will be shown to other collaborators. No account needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Your name..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && joinWorkspace()}
              autoFocus
            />
            <Button className="w-full" onClick={joinWorkspace} disabled={!nameInput.trim()}>
              Enter Workspace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
