# Database Schema

PostgreSQL database managed by SQLAlchemy (async). Tables are auto-created on server startup via `Base.metadata.create_all`.

---

## `papers`

Stores metadata for each uploaded PDF.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `VARCHAR` | PK | UUID, assigned at upload time and used as filename (`{id}.pdf`) |
| `title` | `VARCHAR` | nullable | Paper title |
| `author` | `VARCHAR` | nullable | Author name |
| `year` | `INTEGER` | nullable | Publication year |
| `abstract` | `TEXT` | nullable | Paper abstract |
| `file_path` | `VARCHAR` | NOT NULL | Path on disk: `data/uploads/{id}.pdf` |
| `created_at` | `TIMESTAMP` | default now | Upload timestamp |
| `status` | `VARCHAR` | default `"unread"` | Reading status: `read`, `unread`, `reading` |
| `keywords` | `ARRAY(VARCHAR)` | default `[]` | Keyword tags |

**Relationships:**
- One `Paper` → many `Chunk` (cascade delete)

---

## `chunks`

Each chunk is an 800-character segment of a paper's extracted text, along with its embedding vector used for semantic search and plagiarism detection.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `VARCHAR` | PK | UUID |
| `paper_id` | `VARCHAR` | FK → `papers.id` | Parent paper |
| `content` | `TEXT` | NOT NULL | Up to 800 characters of extracted text |
| `embedding` | `ARRAY(FLOAT)` | nullable | 384-dimensional sentence embedding |

**Notes:**
- A typical 10-page paper produces ~30 chunks
- Each embedding is stored as a plain PostgreSQL float array (384 values)
- In production, the `pgvector` extension would replace this column with a `VECTOR(384)` type for efficient ANN indexing

---

## `paper_notes`

Shared notes written by collaborators, persisted across sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `VARCHAR` | PK | UUID |
| `paper_id` | `VARCHAR` | FK → `papers.id` NOT NULL | Parent paper |
| `author_name` | `VARCHAR` | NOT NULL | Display name entered by user |
| `content` | `TEXT` | NOT NULL | Note body |
| `created_at` | `TIMESTAMP` | default now | Creation time |
| `updated_at` | `TIMESTAMP` | default now, on update now | Last modification time |

---

## `paper_comments`

Threaded comments on a paper, visible to all collaborators.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `VARCHAR` | PK | UUID |
| `paper_id` | `VARCHAR` | FK → `papers.id` NOT NULL | Parent paper |
| `author_name` | `VARCHAR` | NOT NULL | Display name entered by user |
| `content` | `TEXT` | NOT NULL | Comment body |
| `created_at` | `TIMESTAMP` | default now | Creation time |

---

## Entity Relationship Diagram

```
papers
  ├── id (PK)
  ├── title, author, year, abstract
  ├── file_path, status, keywords
  └── created_at
       │
       │ 1 ──── N
       ▼
  chunks                    paper_notes               paper_comments
  ├── id (PK)               ├── id (PK)               ├── id (PK)
  ├── paper_id (FK)         ├── paper_id (FK)         ├── paper_id (FK)
  ├── content               ├── author_name           ├── author_name
  └── embedding [384 floats]├── content               ├── content
                            ├── created_at            └── created_at
                            └── updated_at
```

---

## Connection Setup

```python
# backend/database.py (typical setup)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "postgresql+asyncpg://user:pass@localhost/dbname"

engine = create_async_engine(DATABASE_URL)
SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()
```

Tables are created at startup:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with database.engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield
```
