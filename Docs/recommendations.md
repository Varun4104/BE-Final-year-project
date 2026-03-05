# Recommendations

The recommendations system surfaces papers users might find interesting, organised into five categories.

## Current Implementation

The `/recommendations` endpoint currently returns a static mock response. This establishes the API contract and frontend UI while the ML backend is built out.

```python
@app.get("/recommendations")
async def get_recommendations(db: AsyncSession = Depends(get_db)):
    return [{
        "id": "1",
        "title": "Attention Is All You Need",
        "authors": ["Vaswani et al."],
        "year": 2017,
        "abstract": "...",
        "keywords": ["transformer", "llm"],
        "citationCount": 50000,
        "venue": "NIPS",
        "relevanceScore": 0.99,
        "reason": "Foundational paper in your field",
        "category": "trending",
        "source": "arxiv"
    }]
```

## Recommendation Categories

| Category | Description | Future Signal |
|----------|-------------|---------------|
| `trending` | Papers gaining recent attention | Citation velocity |
| `similar` | Papers semantically close to library | Embedding similarity to user's papers |
| `collaborative` | Papers read by like-minded users | User-user similarity on reading history |
| `recent` | Latest publications in user's areas | `year` filter on keywords |
| `highly-cited` | High citation count | `citationCount` threshold |

## Frontend Display

Each recommendation card shows:
- Title, authors, year, venue
- Relevance score as a percentage bar
- Citation count badge
- Category-specific badge (e.g., "Trending", "Highly Cited")
- `reason` field: plain-English explanation ("Foundational paper in your field")
- Quick actions: **Add to Library**, **Generate Summary**, **Find Similar**, **View Paper**

## Planned ML Implementation

### Content-Based Filtering

Compare papers in the user's library against a candidate pool using embedding similarity:

```python
# Pseudo-code for future implementation
user_paper_embeddings = [avg(chunk.embeddings) for paper in user_library]
user_centroid = np.mean(user_paper_embeddings, axis=0)  # shape (384,)

# Score each candidate paper
for candidate in candidate_pool:
    candidate_emb = avg(candidate.chunk_embeddings)
    score = cosine_similarity(user_centroid, candidate_emb)
```

### Collaborative Filtering

Track which papers users mark as `"read"` and recommend papers read by users with similar reading history (item-item or user-user collaborative filtering).

### Trending Detection

Rank by:
- Recent upload date (proxy for recency)
- Citation count (external API like Semantic Scholar)
- View frequency in the library

## Data Model (Recommendation Interface)

```typescript
interface Recommendation {
  id: string
  title: string
  authors: string[]
  year: number
  abstract: string
  keywords: string[]
  citationCount: number
  venue: string
  relevanceScore: number   // 0.0 – 1.0
  reason: string           // human-readable explanation
  category: "trending" | "similar" | "collaborative" | "recent" | "highly-cited"
  source: "arxiv" | "pubmed" | "ieee" | "acm" | "springer"
}
```
