def keyword_search(query, store, top_k=5):
    results = []
    for chunk in store.get("chunks", []):
        if query.lower() in chunk.lower():
            results.append({"text": chunk, "score": 1.0})
    return results[:top_k]
