from sentence_transformers import SentenceTransformer
import numpy as np
import pickle
import os

model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_texts(texts):
    return model.encode(texts, show_progress_bar=True, convert_to_numpy=True)

def create_vector_store(chunks, embeddings, file_id):
    store = {"chunks": chunks, "embeddings": embeddings, "file_id": file_id}
    return store

def save_embeddings(store, path):
    with open(path, "wb") as f:
        pickle.dump(store, f)

def load_embeddings(path):
    if os.path.exists(path):
        with open(path, "rb") as f:
            return pickle.load(f)
    return {"chunks": [], "embeddings": np.zeros((0, 384)), "file_id": ""}

def search_semantic(query, store, top_k=5):
    if len(store["chunks"]) == 0:
        return []
    query_vec = embed_texts([query])
    scores = np.dot(store["embeddings"], query_vec.T).squeeze()
    top_indices = np.argsort(scores)[::-1][:top_k]
    return [
        {"text": store["chunks"][i], "score": float(scores[i])}
        for i in top_indices
    ]
