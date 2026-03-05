# API Reference

Base URL: `http://localhost:8000`

---

## Papers

### Upload a PDF
`POST /upload`

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✅ | PDF file |
| `title` | string | | Paper title (default: `"Untitled"`) |
| `author` | string | | Author name (default: `"Unknown Author"`) |
| `keywords` | string | | Comma-separated keywords |
| `year` | string | | Publication year (default: current year) |

**Response `200`:**
```json
{
  "message": "✅ Uploaded & indexed paper.pdf",
  "file_id": "a1b2c3d4-...",
  "chunks": 24,
  "meta": { "title": "...", "author": "...", "year": 2023 }
}
```

---

### Search Papers
`POST /search`

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | Free-text search query |
| `search_type` | `"semantic"` \| `"keyword"` \| `"advanced"` | Default: `"semantic"` |
| `title` | string | Filter: title must contain this |
| `author` | string | Filter: author must contain this |
| `keywords` | string | Filter: comma-separated keyword list |
| `year` | string | Filter: exact year match |

**Response `200`:**
```json
{
  "query": "transformers NLP",
  "results": [
    {
      "id": "1",
      "file_id": "abc-123",
      "file_name": "paper.pdf",
      "title": "Attention Is All You Need",
      "authors": ["Vaswani et al."],
      "year": 2017,
      "abstract": "We propose the Transformer...",
      "keywords": ["transformer", "attention"],
      "citationCount": 50000,
      "relevanceScore": 0.912,
      "status": "unread",
      "source": "library",
      "doi": "",
      "venue": "Uploaded"
    }
  ]
}
```

---

### Get All Papers
`GET /all_pdfs`

**Response `200`:**
```json
{
  "pdfs": [
    {
      "file_id": "...",
      "title": "...",
      "author": "...",
      "year": 2023,
      "keywords": ["nlp"],
      "status": "unread",
      "abstract": "",
      "created_at": "2024-01-15T10:30:00",
      "chunk_count": 24
    }
  ],
  "total_pdfs": 5
}
```

---

### Update Paper Status
`PATCH /papers/{paper_id}/status`

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Values |
|-------|--------|
| `status` | `"read"` \| `"unread"` \| `"reading"` |

**Response `200`:**
```json
{ "message": "Status updated", "paper_id": "...", "status": "read" }
```

---

### Get Stats
`GET /stats`

**Response `200`:**
```json
{
  "totalPapers": 5,
  "readPapers": 2,
  "savedSearches": 0,
  "recommendations": 0
}
```

---

## AI Features

### Generate Summary
`POST /generate_summary`

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Description |
|-------|------|-------------|
| `file_id` | string | Paper ID |
| `max_summary_length` | integer | Word limit (default: 300) |

**Response `200`:**
```json
{
  "file_id": "...",
  "summary": "This paper proposes...",
  "original_text_length": 24000,
  "summary_length": 850
}
```

---

### Check Plagiarism
`POST /check_plagiarism`

**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | PDF to check |

**Response `200`:**
```json
{
  "file_id": "temp",
  "plagiarism_score": 34.7,
  "top_matches": [
    {
      "file_name": "existing_paper.pdf",
      "file_id": "abc-123",
      "similarity": 62.1,
      "excerpt": "We propose a new..."
    }
  ]
}
```

---

### Translate Text
`POST /translate`

**Content-Type:** `application/json`

```json
{
  "text": "The transformer architecture relies on self-attention.",
  "target_language": "Spanish"
}
```

**Response `200`:**
```json
{
  "original_text": "The transformer architecture...",
  "translated_text": "La arquitectura transformer...",
  "target_language": "Spanish"
}
```

---

### Get Recommendations
`GET /recommendations`

**Response `200`:** Array of recommendation objects (see [Recommendations](./recommendations.md))

---

## Collaboration

### Get Notes for a Paper
`GET /papers/{paper_id}/notes`

**Response `200`:** Array of `NoteResponse`
```json
[
  {
    "id": "...",
    "paper_id": "...",
    "author_name": "Alice",
    "content": "Key insight in section 3...",
    "created_at": "2024-01-15T10:30:00",
    "updated_at": "2024-01-15T10:30:00"
  }
]
```

---

### Create a Note
`POST /papers/{paper_id}/notes`

**Content-Type:** `application/json`

```json
{ "author_name": "Alice", "content": "Key insight in section 3..." }
```

**Response `200`:** `NoteResponse` (same shape as above). Also broadcasts `{ type: "note_added", note: {...} }` to all WebSocket clients on that paper.

---

### Get Comments for a Paper
`GET /papers/{paper_id}/comments`

**Response `200`:** Array of `CommentResponse`
```json
[
  {
    "id": "...",
    "paper_id": "...",
    "author_name": "Bob",
    "content": "Agree with the conclusion.",
    "created_at": "2024-01-15T10:35:00"
  }
]
```

---

### Create a Comment
`POST /papers/{paper_id}/comments`

**Content-Type:** `application/json`

```json
{ "author_name": "Bob", "content": "Agree with the conclusion." }
```

**Response `200`:** `CommentResponse`. Also broadcasts `{ type: "comment_added", comment: {...} }` to all WebSocket clients.

---

## WebSocket

### Collaborate on a Paper
`WS /ws/collaborate/{paper_id}`

**Connect:** `ws://localhost:8000/ws/collaborate/{paper_id}`

**Client sends (after connect):**
```json
{ "type": "join", "name": "Alice" }
```

**Server broadcasts:**
```json
{ "type": "user_joined", "name": "Alice", "online_users": ["Alice", "Bob"] }
{ "type": "user_left",   "name": "Bob",   "online_users": ["Alice"] }
{ "type": "note_added",    "note":    { ...NoteResponse... } }
{ "type": "comment_added", "comment": { ...CommentResponse... } }
```
