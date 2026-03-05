# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Next.js)                  │
│                                                     │
│  Sidebar → Dashboard / Upload / Search / Library    │
│           / Plagiarism / Voice / Multilingual       │
│           / Collaborate                             │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (REST) + WebSocket
                     │ localhost:8000
┌────────────────────▼────────────────────────────────┐
│                  FastAPI Backend                     │
│                                                     │
│  /upload   /search   /all_pdfs   /stats             │
│  /generate_summary   /check_plagiarism              │
│  /translate   /papers/{id}/notes                    │
│  /papers/{id}/comments                              │
│  ws://localhost:8000/ws/collaborate/{paper_id}      │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──┐  ┌──────▼──────┐  ┌─▼──────────────────┐
│PostgreSQL│  │Sentence     │  │Google Gemini 2.5    │
│          │  │Transformers │  │Flash API            │
│papers    │  │all-MiniLM   │  │                     │
│chunks    │  │-L6-v2       │  │/generate_summary    │
│paper_    │  │             │  │/translate           │
│notes     │  │384-dim      │  └─────────────────────┘
│paper_    │  │embeddings   │
│comments  │  └─────────────┘
└──────────┘
```

## Directory Structure

```
varun-project/
├── backend/
│   ├── main.py           # FastAPI app, all routes
│   ├── models.py         # SQLAlchemy ORM models
│   ├── schemas.py        # Pydantic request/response schemas
│   ├── crud.py           # Database operations
│   ├── database.py       # Async engine + session setup
│   └── utils/
│       ├── pdf_extractor.py   # PDF → text extraction
│       ├── embeddings.py      # Sentence Transformer wrapper
│       └── search_engine.py   # Legacy keyword search helper
├── frontend/
│   ├── components/
│   │   ├── dashboard.tsx        # Root layout, activeView state
│   │   ├── sidebar.tsx          # Navigation sidebar
│   │   ├── main-content.tsx     # View router
│   │   └── views/
│   │       ├── dashboard-view.tsx
│   │       ├── upload-view.tsx
│   │       ├── search-view.tsx
│   │       ├── library-view.tsx
│   │       ├── recommendations-view.tsx
│   │       ├── plagiarism-view.tsx
│   │       ├── multilingual-view.tsx
│   │       ├── voice-search-view.tsx
│   │       └── collaborate-view.tsx
│   └── app/
│       └── page.tsx
└── Docs/                 # This documentation
```

## Request Lifecycle (Semantic Search Example)

```
User types query → SearchView → POST /search (search_type=semantic)
  → Backend embeds query via SentenceTransformer
  → Fetch all chunks from PostgreSQL
  → Compute cosine similarity (Python/NumPy)
  → Sort, apply filters (title/author/year/keywords)
  → Return top 10 unique papers as JSON
  → SearchView renders result cards
```
