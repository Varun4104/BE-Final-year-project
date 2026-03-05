# Research Assistant — Documentation

AI-powered PDF research paper management system with semantic search, collaboration, voice search, plagiarism detection, and multilingual support.

## Table of Contents

1. [Architecture Overview](./architecture.md)
2. [Semantic Search](./semantic-search.md)
3. [Keyword & Advanced Search](./keyword-search.md)
4. [PDF Upload & Processing](./pdf-upload.md)
5. [Plagiarism Detection](./plagiarism.md)
6. [Voice Search](./voice-search.md)
7. [Collaboration (Real-time)](./collaboration.md)
8. [Multilingual & Translation](./multilingual.md)
9. [Recommendations](./recommendations.md)
10. [API Reference](./api-reference.md)
11. [Database Schema](./database-schema.md)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python, SQLAlchemy (async) |
| Database | PostgreSQL |
| AI/ML | Sentence Transformers (`all-MiniLM-L6-v2`), Gemini 2.5 Flash |
| Real-time | WebSocket (FastAPI native) |
| Voice | Web Speech API, Web Audio API, SpeechSynthesis API |
| PDF | pypdf |

## Running Locally

```bash
# Backend
cd backend
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
