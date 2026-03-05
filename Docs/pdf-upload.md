# PDF Upload & Processing

## Upload Flow

```
User selects PDF
      ↓
Frontend (upload-view.tsx)
  - Drag-and-drop or file picker
  - Shows metadata dialog (title, author, keywords, year)
      ↓
POST /upload (multipart/form-data)
  - file: PDF binary
  - title, author, keywords (comma-separated), year
      ↓
Backend processing:
  1. Save PDF to disk  →  data/uploads/{uuid}.pdf
  2. Extract text      →  pypdf PdfReader
  3. Chunk text        →  800-char segments
  4. Embed chunks      →  SentenceTransformer → 384-dim vectors
  5. Store in DB       →  Paper row + N Chunk rows
      ↓
Response: { file_id, chunks, meta }
```

## Text Extraction

Uses **pypdf** to read all pages and concatenate their text:

```python
# backend/utils/pdf_extractor.py
from pypdf import PdfReader

def extract_text_from_pdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text
```

**Known limitation:** pypdf handles digital PDFs well but cannot read scanned image-only PDFs (no OCR layer).

## Chunking Strategy

Text is split into **800-character non-overlapping segments**:

```python
chunks = [text[i:i+800] for i in range(0, len(text), 800)]
# A 10-page paper (~24,000 chars) → ~30 chunks
```

Each chunk becomes an independently searchable unit. A query matches at the chunk level; results are then grouped back by paper.

**Trade-off:** No overlap means a sentence split across chunk boundaries may lose context. A production system would use sliding-window chunking with ~100-char overlap.

## Embedding & Storage

```python
embeddings = embed_texts(chunks)   # numpy array, shape (n_chunks, 384)

for i, content in enumerate(chunks):
    db.add(models.Chunk(
        id=str(uuid.uuid4()),
        paper_id=file_id,
        content=content,
        embedding=embeddings[i].tolist()   # Python list stored as ARRAY(Float)
    ))
await db.commit()
```

## Metadata

| Field | Source | Default |
|-------|--------|---------|
| `title` | Form input | `"Untitled"` |
| `author` | Form input | `"Unknown Author"` |
| `year` | Form input | Current year |
| `keywords` | Form input (comma-separated) | `[]` |
| `file_path` | `data/uploads/{uuid}.pdf` | — |
| `status` | Auto | `"unread"` |

## File Storage

PDFs are saved locally under `backend/data/uploads/`:

```
backend/
└── data/
    └── uploads/
        ├── a1b2c3d4-....pdf
        └── e5f6g7h8-....pdf
```

The UUID filename (`file_id`) is the same as the paper's `id` in the database, making it easy to retrieve the file for summary generation or plagiarism checking.

## Frontend: Upload Progress States

| State | UI |
|-------|----|
| `uploading` | Progress bar, spinner |
| `processing` | "Indexing…" indicator |
| `completed` | Green checkmark, chunk count |
| `error` | Red banner with error message |
