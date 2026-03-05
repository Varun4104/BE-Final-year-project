# Semantic Search

Semantic search finds papers by *meaning*, not just exact word matches. A query like "deep learning for medical imaging" will return relevant papers even if those exact words don't appear in them.

## How It Works

### 1. Embedding Model

The system uses **`all-MiniLM-L6-v2`** from the `sentence-transformers` library.

- **Output:** 384-dimensional dense float vector per text input
- **Size:** ~33M parameters — fast, runs on CPU
- **Strength:** Captures semantic similarity — "car" and "automobile" get similar vectors

```python
# backend/utils/embeddings.py
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_texts(texts: list[str]) -> np.ndarray:
    return model.encode(texts, convert_to_numpy=True)
    # Returns shape: (len(texts), 384)
```

### 2. Indexing at Upload Time

When a PDF is uploaded, its text is split into 800-character chunks and each chunk is embedded and stored in PostgreSQL:

```python
chunks = [text[i:i+800] for i in range(0, len(text), 800)]
embeddings = embed_texts(chunks)   # shape: (n_chunks, 384)

for i, content in enumerate(chunks):
    db.add(models.Chunk(
        paper_id=file_id,
        content=content,
        embedding=embeddings[i].tolist()   # stored as ARRAY(Float)
    ))
```

### 3. Query Embedding

At search time, the user's query is embedded with the same model:

```python
query_vec = embed_texts([query])[0]   # shape: (384,)
```

### 4. Cosine Similarity

Every stored chunk is compared to the query using **cosine similarity**:

```
similarity(A, B) = (A · B) / (|A| × |B|)
```

- Returns a value between **-1 and 1** (in practice 0–1 for text)
- **1.0** = identical meaning, **0.0** = completely unrelated

```python
for chunk in all_chunks:
    emb = np.array(chunk.embedding)
    sim = np.dot(query_vec, emb) / (
        np.linalg.norm(query_vec) * np.linalg.norm(emb)
    )
    scored_chunks.append((chunk, sim))

# Sort highest to lowest
scored_chunks.sort(key=lambda x: x[1], reverse=True)
top_chunks = scored_chunks[:20]
```

### 5. Deduplication & Filters

Multiple chunks may belong to the same paper. The system picks the highest-scoring chunk per paper and applies any active metadata filters:

```python
seen_ids = set()
for chunk, score in top_chunks:
    paper = chunk.paper
    if title and title.lower() not in (paper.title or "").lower(): continue
    if author and author.lower() not in (paper.author or "").lower(): continue
    if year and str(paper.year) != str(year): continue

    if paper.id not in seen_ids:
        seen_ids.add(paper.id)
        filtered_results.append({
            "relevanceScore": round(float(score), 3),
            ...
        })
        if len(filtered_results) >= 10:
            break
```

## Result Format

```json
{
  "query": "transformers in NLP",
  "results": [
    {
      "file_id": "abc-123",
      "title": "Attention Is All You Need",
      "authors": ["Vaswani et al."],
      "year": 2017,
      "abstract": "We propose a new network architecture...",
      "keywords": ["transformer", "attention"],
      "relevanceScore": 0.912,
      "status": "unread"
    }
  ]
}
```

## Limitations & Notes

| Concern | Current Approach | Production Alternative |
|---------|-----------------|----------------------|
| Similarity computed in Python for every query | Loads all chunks into memory | Use `pgvector` PostgreSQL extension for DB-side ANN search |
| Chunks have no overlap | 800-char hard splits | Sliding window with 100-char overlap to avoid missing context at boundaries |
| Single embedding model | all-MiniLM-L6-v2 | Fine-tune on scientific/academic corpus (e.g., SciBERT) |
