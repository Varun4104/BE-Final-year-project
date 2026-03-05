# Plagiarism Detection

The plagiarism checker compares an uploaded document against every paper already in the database using **embedding-based cosine similarity** computed as a matrix operation.

## How It Works

### Step 1 — Embed the Uploaded Document

```python
text = extract_text_from_pdf(temp_path)
chunks = [text[i:i+800] for i in range(0, len(text), 800)]
new_embeddings = embed_texts(chunks)
# shape: (n_new_chunks, 384)
```

### Step 2 — Load All Database Embeddings

```python
db_chunks = (await db.execute(
    select(models.Chunk).options(selectinload(models.Chunk.paper))
)).scalars().all()

db_emb_matrix = np.array([c.embedding for c in db_chunks if c.embedding])
# shape: (n_db_chunks, 384)
```

### Step 3 — Batch Cosine Similarity Matrix

Instead of computing similarity one pair at a time, the system normalizes both matrices and uses **matrix multiplication** to compute all pairwise similarities at once:

```python
# Normalize each row to unit length → cosine sim becomes dot product
new_norm = new_embeddings / np.linalg.norm(new_embeddings, axis=1, keepdims=True)
db_norm  = db_emb_matrix  / np.linalg.norm(db_emb_matrix,  axis=1, keepdims=True)

# (n_new, 384) × (384, n_db) = (n_new, n_db)
sim_matrix = np.dot(new_norm, db_norm.T)
```

Each cell `sim_matrix[i][j]` = cosine similarity between new chunk `i` and database chunk `j`.

### Step 4 — Overall Plagiarism Score

```python
# For each new chunk, find its closest match in the DB
max_sim_per_chunk = np.max(sim_matrix, axis=1)   # shape: (n_new,)

# Average and convert to percentage
plagiarism_score = float(np.mean(max_sim_per_chunk) * 100)
```

This gives a **0–100% score** representing how similar the document is on average to the most similar content in the database.

### Step 5 — Top Matching Papers

```python
# Find the 5 DB chunks with the globally highest similarity
top_db_indices = np.argsort(np.max(sim_matrix, axis=0))[::-1][:5]

top_matches = []
for idx in top_db_indices:
    chunk = db_chunks[idx]
    sim_score = np.max(sim_matrix[:, idx]) * 100
    top_matches.append({
        "file_name": os.path.basename(chunk.paper.file_path),
        "file_id": chunk.paper.id,
        "similarity": round(float(sim_score), 2),
        "excerpt": chunk.content[:200] + "..."
    })
```

## Thresholds & Decisions

| Score | Status | Meaning |
|-------|--------|---------|
| < 20% | ✅ Passed | Largely original content |
| ≥ 20% | ⚠️ Pending Review | Manual review recommended |
| (implicit > 50%) | ❌ Likely Plagiarized | High overlap detected |

## Frontend Visualization

- **Pie chart** — "Original Content" vs "Similar Content" (using Recharts)
- **Top matches list** — file name, similarity %, matched excerpt
- **Accept / Reject workflow** — reviewer can mark a submission as accepted or rejected

## Example Response

```json
{
  "file_id": "temp",
  "plagiarism_score": 34.7,
  "top_matches": [
    {
      "file_name": "attention_paper.pdf",
      "file_id": "abc-123",
      "similarity": 62.1,
      "excerpt": "We propose a new simple network architecture, the Transformer..."
    }
  ]
}
```

## Limitations

- **Self-matches:** If the same paper is uploaded twice it will report ~100% similarity against itself.
- **Scale:** Loading all chunks into Python memory works for small libraries (< ~10k chunks). For production, use `pgvector` with an HNSW index for sub-linear approximate nearest-neighbour search.
- **Paraphrasing:** Embedding similarity catches paraphrased content better than keyword matching, but heavily rewritten text with retained ideas may still score low.
