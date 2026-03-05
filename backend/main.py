import os
import pickle
import numpy as np
import uuid
import random
import json
from typing import Optional, List, Dict
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, Form, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func
from sqlalchemy.orm import selectinload

# In-memory presence store: paper_id -> {websocket -> user_name}
paper_connections: Dict[str, Dict[WebSocket, str]] = {}

# Local imports
from utils.pdf_extractor import extract_text_from_pdf
from utils.embeddings import embed_texts
import database
import models
import schemas
import crud

# Make sure upload directory exists
UPLOAD_DIR = "data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize Database Models
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    async with database.engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield
    # Shutdown

app = FastAPI(title="AI PDF Search API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
async def get_db():
    async with database.SessionLocal() as session:
        yield session

# ---------- UPLOAD ----------
@app.post("/upload", response_model=dict)
async def upload_pdf(
    file: UploadFile,
    title: str = Form("Untitled"),
    author: str = Form("Unknown Author"),
    keywords: str = Form(""),
    year: str = Form(""),
    db: AsyncSession = Depends(get_db)
):
    # Parse year safely
    try:
        parsed_year = int(year) if year else datetime.now().year
    except ValueError:
        parsed_year = datetime.now().year

    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")

    # Save file to disk
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    
    with open(file_path, "wb") as f:
        f.write(contents)

    # Extract text and embed
    try:
        text = extract_text_from_pdf(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {str(e)}")
    
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")

    chunks = [text[i:i + 800] for i in range(0, len(text), 800)]
    embeddings = embed_texts(chunks)

    # Save to Database
    keyword_list = [k.strip() for k in keywords.split(",") if k.strip()]
    
    # Create Paper
    paper_create = schemas.PaperCreate(
        title=title,
        author=author,
        year=parsed_year,
        keywords=keyword_list,
        file_path=file_path,
        status="unread"
    )
    
    db_paper = models.Paper(
        id=file_id,
        **paper_create.dict()
    )
    db.add(db_paper)
    await db.commit()

    # Create Chunks
    for i, content in enumerate(chunks):
        db_chunk = models.Chunk(
            id=str(uuid.uuid4()),
            paper_id=file_id,
            content=content,
            embedding=embeddings[i].tolist()
        )
        db.add(db_chunk)
    
    await db.commit()

    return {
        "message": f"✅ Uploaded & indexed {file.filename}",
        "file_id": file_id,
        "chunks": len(chunks),
        "meta": {
            "title": title,
            "author": author,
            "year": parsed_year
        }
    }

# ---------- SEARCH ----------
@app.post("/search")
async def search(
    query: str = Form(""),
    search_type: str = Form("semantic"),
    title: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
    keywords: Optional[str] = Form(None),
    year: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    results = []

    if search_type == "keyword" and query:
        stmt = (
            select(models.Chunk)
            .options(selectinload(models.Chunk.paper))
            .join(models.Paper)
            .where(
                or_(
                    models.Chunk.content.ilike(f"%{query}%"),
                    models.Paper.title.ilike(f"%{query}%"),
                    models.Paper.author.ilike(f"%{query}%"),
                )
            )
            .limit(50)
        )
        kw_res = await db.execute(stmt)
        kw_chunks = kw_res.scalars().all()
        seen_ids: set = set()
        for chunk in kw_chunks:
            paper = chunk.paper
            if paper.id not in seen_ids:
                seen_ids.add(paper.id)
                results.append({
                    "id": str(len(results) + 1),
                    "file_id": paper.id,
                    "file_name": os.path.basename(paper.file_path),
                    "title": paper.title or "Untitled",
                    "authors": [paper.author or "Unknown"],
                    "year": paper.year or datetime.now().year,
                    "abstract": chunk.content[:500] + "...",
                    "keywords": paper.keywords or [],
                    "citationCount": 0,
                    "relevanceScore": 1.0,
                    "status": paper.status,
                    "source": "library",
                    "doi": "",
                    "venue": "Uploaded",
                })
                if len(results) >= 10:
                    break
        return {"query": query, "results": results}

    # ------------------------------
    # HYBRID / SEMANTIC SEARCH
    # ------------------------------
    # 1. Embed query
    query_vec = embed_texts([query])[0]
    
    # 2. Get all chunks (inefficient for large DBs, but fine for MVP local)
    # Ideally use pgvector. Here we do Python-side cosine similarity.
    all_chunks_res = await db.execute(
        select(models.Chunk).options(selectinload(models.Chunk.paper))
    )
    all_chunks = all_chunks_res.scalars().all()

    scored_chunks = []
    for chunk in all_chunks:
        if chunk.embedding:
            # Cosine similarity
            emb = np.array(chunk.embedding)
            sim = np.dot(query_vec, emb) / (np.linalg.norm(query_vec) * np.linalg.norm(emb))
            scored_chunks.append((chunk, sim))
    
    # Sort by similarity
    scored_chunks.sort(key=lambda x: x[1], reverse=True)
    top_chunks = scored_chunks[:20]

    # 3. Apply Filters (Advanced Search)
    filtered_results = []
    seen_ids = set()

    kw_list = [k.strip().lower() for k in (keywords or "").split(",") if k.strip()]

    for chunk, score in top_chunks:
        paper = chunk.paper
        
        # Apply filters
        if title and title.lower() not in (paper.title or "").lower(): continue
        if author and author.lower() not in (paper.author or "").lower(): continue
        if year and str(paper.year) != str(year): continue
        if kw_list:
            paper_kws = [k.lower() for k in paper.keywords]
            if not any(k in paper_kws for k in kw_list): continue
        
        if paper.id not in seen_ids:
            seen_ids.add(paper.id)
            filtered_results.append({
                "id": str(len(filtered_results) + 1),
                "file_id": paper.id,
                "file_name": os.path.basename(paper.file_path),
                "title": paper.title or "Untitled",
                "authors": [paper.author or "Unknown"],
                "year": paper.year or datetime.now().year,
                "abstract": chunk.content[:500] + "...",
                "keywords": paper.keywords,
                "citationCount": random.randint(5, 300),
                "relevanceScore": round(float(score), 3),
                "status": paper.status,
                "source": "library",
                "doi": f"10.fake/{uuid.uuid4().hex[:8]}",
                "venue": "Uploaded",
            })
            if len(filtered_results) >= 10:
                break
    
    return {"query": query, "results": filtered_results}


@app.get("/all_pdfs")
async def get_all_pdfs(db: AsyncSession = Depends(get_db)):
    papers = await crud.get_all_papers(db)
    results = []
    for p in papers:
        # Get chunk count
        chunks_res = await db.execute(select(func.count(models.Chunk.id)).where(models.Chunk.paper_id == p.id))
        chunk_count = chunks_res.scalar() or 0

        results.append({
            "file_id": p.id,
            "title": p.title,
            "author": p.author,
            "year": p.year,
            "keywords": p.keywords or [],
            "status": p.status,
            "abstract": p.abstract or "",
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "chunk_count": chunk_count
        })
    return {"pdfs": results, "total_pdfs": len(results)}


@app.get("/stats", response_model=schemas.StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    papers = await crud.get_all_papers(db)
    total = len(papers)
    read = len([p for p in papers if p.status == "read"])
    return {
        "totalPapers": total,
        "readPapers": read,
        "savedSearches": 0,
        "recommendations": 0
    }

@app.get("/recommendations")
async def get_recommendations(db: AsyncSession = Depends(get_db)):
    # Simple logic: return random unread papers or mock data
    # For now, return a fixed structure to satisfy frontend
    return [
         {
            "id": "1",
            "title": "Attention Is All You Need",
            "authors": ["Vaswani et al."],
            "year": 2017,
            "abstract": "We introduce LLaMA, a collection of foundation language models...",
            "keywords": ["transformer", "llm"],
            "citationCount": 50000,
            "venue": "NIPS",
            "relevanceScore": 0.99,
            "reason": "Foundational paper in your field",
            "category": "trending",
            "source": "arxiv"
        }
    ]

@app.patch("/papers/{paper_id}/status")
async def update_paper_status(paper_id: str, status: str = Form(...), db: AsyncSession = Depends(get_db)):
    valid_statuses = {"read", "unread", "reading"}
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")
    paper = await crud.update_paper_status(db, paper_id, status)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return {"message": "Status updated", "paper_id": paper_id, "status": status}

# GEMINI Integration for Summary (Unchanged logic, just ensure env var)
import requests
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

@app.post("/generate_summary")
async def generate_summary(
    file_id: str = Form(...),
    max_summary_length: int = Form(300),
    db: AsyncSession = Depends(get_db)
):
    paper = await crud.get_paper(db, file_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    text = extract_text_from_pdf(paper.file_path)
    if not text:
        raise HTTPException(status_code=400, detail="No text found")
    
    truncated_text = text[:8000]
    prompt = f"Summarize this in {max_summary_length} words:\n\n{truncated_text}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 1024}
    }
    
    response = requests.post(
        GEMINI_API_URL, 
        headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
        json=payload
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Gemini Error: {response.text}")
        
    data = response.json()
    try:
        summary = data["candidates"][0]["content"]["parts"][0]["text"]
    except:
        summary = "Could not generate summary."

    return {
        "file_id": file_id,
        "summary": summary,
        "original_text_length": len(text),
        "summary_length": len(summary)
    }

# PLAGIARISM CHECK (Updated to use DB)
@app.post("/check_plagiarism")
async def check_plagiarism(file: UploadFile, db: AsyncSession = Depends(get_db)):
    # 1. Read uploaded file
    content = await file.read()
    temp_path = f"/tmp/{uuid.uuid4()}.pdf"
    with open(temp_path, "wb") as f:
        f.write(content)
    
    text = extract_text_from_pdf(temp_path)
    os.remove(temp_path)
    
    if not text:
        return {"error": "No text found"}

    # 2. Embed uploaded text
    chunks = [text[i:i+800] for i in range(0, len(text), 800)]
    new_embeddings = embed_texts(chunks) # numpy array

    # 3. Compare with DB chunks
    all_chunks_res = await db.execute(
        select(models.Chunk).options(selectinload(models.Chunk.paper))
    )
    db_chunks = all_chunks_res.scalars().all()
    
    if not db_chunks:
         return {"plagiarism_score": 0, "top_matches": []}

    # Prepare DB embeddings matrix
    db_emb_matrix = np.array([c.embedding for c in db_chunks if c.embedding])
    
    # Compute similarity (simplified: max similarity of any chunk to any DB chunk)
    # Cosine Similarity: A . B / |A|*|B|
    
    # Normalize
    new_norm = new_embeddings / np.linalg.norm(new_embeddings, axis=1, keepdims=True)
    db_norm = db_emb_matrix / np.linalg.norm(db_emb_matrix, axis=1, keepdims=True)
    
    sim_matrix = np.dot(new_norm, db_norm.T) # shape (n_new, n_db)
    
    # Max similarity for each new chunk
    max_sim_per_chunk = np.max(sim_matrix, axis=1)
    # Overall document similarity score (average of top matches)
    plagiarism_score = float(np.mean(max_sim_per_chunk) * 100)
    
    # Top matches details
    top_db_indices = np.argsort(np.max(sim_matrix, axis=0))[::-1][:5]
    
    top_matches = []
    for idx in top_db_indices:
        chunk = db_chunks[idx]
        paper = chunk.paper
        sim_score = np.max(sim_matrix[:, idx]) * 100
        
        top_matches.append({
            "file_name": os.path.basename(paper.file_path),
            "file_id": paper.id,
            "similarity": round(float(sim_score), 2),
            "excerpt": chunk.content[:200] + "..."
        })

    return {
        "file_id": "temp",
        "plagiarism_score": round(plagiarism_score, 2),
        "top_matches": top_matches
    }

# ---------- COLLABORATE ----------

@app.get("/papers/{paper_id}/notes", response_model=List[schemas.NoteResponse])
async def get_notes(paper_id: str, db: AsyncSession = Depends(get_db)):
    return await crud.get_notes_for_paper(db, paper_id)

@app.post("/papers/{paper_id}/notes", response_model=schemas.NoteResponse)
async def create_note(paper_id: str, body: schemas.NoteCreate, db: AsyncSession = Depends(get_db)):
    note = await crud.create_note(db, paper_id, body.author_name, body.content)
    # Broadcast to all collaborators on this paper
    note_data = {
        "type": "note_added",
        "note": {
            "id": note.id,
            "paper_id": note.paper_id,
            "author_name": note.author_name,
            "content": note.content,
            "created_at": note.created_at.isoformat(),
            "updated_at": note.updated_at.isoformat(),
        }
    }
    if paper_id in paper_connections:
        for ws in list(paper_connections[paper_id].keys()):
            try:
                await ws.send_text(json.dumps(note_data))
            except Exception:
                pass
    return note

@app.get("/papers/{paper_id}/comments", response_model=List[schemas.CommentResponse])
async def get_comments(paper_id: str, db: AsyncSession = Depends(get_db)):
    return await crud.get_comments_for_paper(db, paper_id)

@app.post("/papers/{paper_id}/comments", response_model=schemas.CommentResponse)
async def create_comment(paper_id: str, body: schemas.CommentCreate, db: AsyncSession = Depends(get_db)):
    comment = await crud.create_comment(db, paper_id, body.author_name, body.content)
    comment_data = {
        "type": "comment_added",
        "comment": {
            "id": comment.id,
            "paper_id": comment.paper_id,
            "author_name": comment.author_name,
            "content": comment.content,
            "created_at": comment.created_at.isoformat(),
        }
    }
    if paper_id in paper_connections:
        for ws in list(paper_connections[paper_id].keys()):
            try:
                await ws.send_text(json.dumps(comment_data))
            except Exception:
                pass
    return comment

@app.websocket("/ws/collaborate/{paper_id}")
async def collaborate_ws(paper_id: str, websocket: WebSocket):
    await websocket.accept()
    if paper_id not in paper_connections:
        paper_connections[paper_id] = {}
    paper_connections[paper_id][websocket] = ""

    async def broadcast(msg: dict):
        for ws in list(paper_connections.get(paper_id, {}).keys()):
            try:
                await ws.send_text(json.dumps(msg))
            except Exception:
                pass

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            if msg.get("type") == "join":
                name = msg.get("name", "Anonymous")
                paper_connections[paper_id][websocket] = name
                online = list(paper_connections[paper_id].values())
                await broadcast({"type": "user_joined", "name": name, "online_users": online})
    except WebSocketDisconnect:
        name = paper_connections[paper_id].pop(websocket, "")
        if not paper_connections[paper_id]:
            del paper_connections[paper_id]
        else:
            online = list(paper_connections[paper_id].values())
            await broadcast({"type": "user_left", "name": name, "online_users": online})

# ---------- TRANSLATE ----------
from pydantic import BaseModel

class TranslationRequest(BaseModel):
    text: str
    target_language: str

@app.post("/translate")
async def translate_text(request: TranslationRequest):
    """
    Translate text using Gemini.
    """
    prompt = f"Translate the following text to {request.target_language}:\n\n{request.text}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 1024}
    }
    
    response = requests.post(
        GEMINI_API_URL, 
        headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
        json=payload
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Gemini Error: {response.text}")
        
    data = response.json()
    try:
        translated_text = data["candidates"][0]["content"]["parts"][0]["text"]
    except:
        raise HTTPException(status_code=500, detail="Could not generate translation.")

    return {
        "original_text": request.text,
        "translated_text": translated_text,
        "target_language": request.target_language
    }
