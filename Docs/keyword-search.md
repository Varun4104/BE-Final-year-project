# Keyword & Advanced Search

## Keyword Search

Keyword search performs **case-insensitive substring matching** across chunk content, paper titles, and author names using SQL `ILIKE`.

### How It Works

```python
# backend/main.py — POST /search with search_type="keyword"

stmt = (
    select(models.Chunk)
    .options(selectinload(models.Chunk.paper))
    .join(models.Paper)
    .where(
        or_(
            models.Chunk.content.ilike(f"%{query}%"),   # text body
            models.Paper.title.ilike(f"%{query}%"),     # paper title
            models.Paper.author.ilike(f"%{query}%"),    # author name
        )
    )
    .limit(50)
)
```

- **`ILIKE`** is PostgreSQL's case-insensitive `LIKE`
- `%query%` matches any text that *contains* the query anywhere
- Fetches up to 50 matching chunks, then deduplicates to return up to 10 unique papers
- Relevance score is fixed at **1.0** (boolean — either it matches or it doesn't)

### When to Use

- Searching for a **specific term, name, or phrase**
- Looking for papers by a known author (`"Smith"`)
- Finding exact jargon that must appear in the text

---

## Advanced Search

Advanced search combines **semantic search** with **metadata filters**. You can filter by any combination of:

| Filter | Field | Example |
|--------|-------|---------|
| Title contains | `paper.title` | `"neural"` |
| Author contains | `paper.author` | `"LeCun"` |
| Exact year | `paper.year` | `"2022"` |
| Keywords | `paper.keywords[]` | `"nlp,bert"` |

### How It Works

Advanced search runs the full **semantic pipeline** first (embed → cosine similarity → top 20 chunks), then applies filters before returning results:

```python
for chunk, score in top_chunks:
    paper = chunk.paper

    # All filters must pass
    if title and title.lower() not in (paper.title or "").lower():
        continue
    if author and author.lower() not in (paper.author or "").lower():
        continue
    if year and str(paper.year) != str(year):
        continue
    if kw_list:
        paper_kws = [k.lower() for k in paper.keywords]
        if not any(k in paper_kws for k in kw_list):
            continue

    # Paper passes all filters
    filtered_results.append({...})
```

### Keyword Filter Logic

Keywords from the form are comma-separated and matched against the paper's stored keyword array:

```python
kw_list = [k.strip().lower() for k in (keywords or "").split(",") if k.strip()]
# e.g. "nlp, bert" → ["nlp", "bert"]

# At least ONE keyword must match (OR logic)
if not any(k in paper_kws for k in kw_list):
    continue
```

### Voice Search → Advanced Search

The Voice Search view automatically converts natural speech into an advanced search query:

```
"papers by LeCun about convolutional networks from 2019"
      ↓ parseVoiceInput()
author = "LeCun"
title  = "convolutional networks"
year   = "2019"
      ↓ POST /search
search_type = "advanced"
author = "LeCun"
title  = "convolutional networks"
year   = "2019"
```

---

## Comparison: Keyword vs Semantic vs Advanced

| | Keyword | Semantic | Advanced |
|--|---------|----------|----------|
| Matching | Exact substring | Meaning/context | Meaning + metadata filters |
| Score | 1.0 (boolean) | 0.0–1.0 (cosine) | 0.0–1.0 (cosine) |
| Good for | Known terms | Conceptual queries | Targeted research |
| Filters | None | None | Title, Author, Year, Keywords |
