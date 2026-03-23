import os
import pickle
import numpy as np
import uuid
import random
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
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

    def _make_result(idx, paper, chunk_content, score, doi_prefix=""):
        return {
            "id": str(idx),
            "file_id": paper.id,
            "file_name": os.path.basename(paper.file_path),
            "title": paper.title or "Untitled",
            "authors": [paper.author or "Unknown"],
            "year": paper.year or datetime.now().year,
            "abstract": chunk_content[:500] + "...",
            "keywords": paper.keywords or [],
            "citationCount": random.randint(5, 300),
            "relevanceScore": round(float(score), 3),
            "status": paper.status,
            "source": "library",
            "doi": doi_prefix or f"10.local/{paper.id[:8]}",
            "venue": "Uploaded",
        }

    # -------------------------
    # KEYWORD SEARCH
    # -------------------------
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
                results.append(_make_result(len(results) + 1, paper, chunk.content, 1.0))
                if len(results) >= 10:
                    break
        return {"query": query, "results": results}

    # -------------------------
    # ADVANCED (FILTER-ONLY) SEARCH — when query is empty
    # -------------------------
    has_filters = any([title, author, keywords, year])
    if search_type == "advanced" and not query and has_filters:
        # Fetch all papers and filter purely by metadata
        all_papers_res = await db.execute(
            select(models.Paper)
        )
        all_papers = all_papers_res.scalars().all()
        kw_list = [k.strip().lower() for k in (keywords or "").split(",") if k.strip()]
        seen_ids = set()
        for paper in all_papers:
            if title and title.lower() not in (paper.title or "").lower():
                continue
            if author and author.lower() not in (paper.author or "").lower():
                continue
            if year and str(paper.year) != str(year):
                continue
            if kw_list:
                paper_kws = [k.lower() for k in (paper.keywords or [])]
                if not any(k in paper_kws for k in kw_list):
                    continue
            if paper.id not in seen_ids:
                seen_ids.add(paper.id)
                # Get first chunk for abstract
                first_chunk_res = await db.execute(
                    select(models.Chunk).where(models.Chunk.paper_id == paper.id).limit(1)
                )
                first_chunk = first_chunk_res.scalar_one_or_none()
                abstract = first_chunk.content if first_chunk else "No content available"
                results.append(_make_result(len(results) + 1, paper, abstract, 1.0))
                if len(results) >= 10:
                    break
        return {"query": query, "results": results}

    # -------------------------
    # SEMANTIC / HYBRID SEARCH
    # -------------------------
    if not query:
        return {"query": query, "results": []}

    query_vec = embed_texts([query])[0]
    query_norm = np.linalg.norm(query_vec)
    if query_norm == 0:
        return {"query": query, "results": []}

    all_chunks_res = await db.execute(
        select(models.Chunk).options(selectinload(models.Chunk.paper))
    )
    all_chunks = all_chunks_res.scalars().all()

    scored_chunks = []
    for chunk in all_chunks:
        if chunk.embedding:
            emb = np.array(chunk.embedding)
            emb_norm = np.linalg.norm(emb)
            if emb_norm > 0:
                sim = float(np.dot(query_vec, emb) / (query_norm * emb_norm))
                scored_chunks.append((chunk, sim))

    scored_chunks.sort(key=lambda x: x[1], reverse=True)
    top_chunks = scored_chunks[:20]

    # Apply optional metadata filters
    filtered_results = []
    seen_ids = set()
    kw_list = [k.strip().lower() for k in (keywords or "").split(",") if k.strip()]

    for chunk, score in top_chunks:
        paper = chunk.paper
        if title and title.lower() not in (paper.title or "").lower(): continue
        if author and author.lower() not in (paper.author or "").lower(): continue
        if year and str(paper.year) != str(year): continue
        if kw_list:
            paper_kws = [k.lower() for k in (paper.keywords or [])]
            if not any(k in paper_kws for k in kw_list): continue
        if paper.id not in seen_ids:
            seen_ids.add(paper.id)
            filtered_results.append(_make_result(len(filtered_results) + 1, paper, chunk.content, score))
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
    reading = len([p for p in papers if p.status == "reading"])
    # Estimate recommendations based on library size (real count comes from arXiv calls)
    rec_estimate = min(total * 5, 50) if total > 0 else 0
    return {
        "totalPapers": total,
        "readPapers": read,
        "savedSearches": reading,
        "recommendations": rec_estimate
    }

def _fetch_arxiv_papers(domain: str, max_results: int = 15) -> list:
    query = urllib.parse.quote(domain)
    url = (
        f"http://export.arxiv.org/api/query"
        f"?search_query=all:{query}"
        f"&start=0&max_results={max_results}"
        f"&sortBy=submittedDate&sortOrder=descending"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ResearchAssistant/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            xml_data = r.read().decode("utf-8")
    except Exception:
        return []

    ns = {"a": "http://www.w3.org/2005/Atom"}
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError:
        return []

    results = []
    for entry in root.findall("a:entry", ns):
        title_el = entry.find("a:title", ns)
        summary_el = entry.find("a:summary", ns)
        published_el = entry.find("a:published", ns)
        id_el = entry.find("a:id", ns)
        authors = [
            a.find("a:name", ns).text
            for a in entry.findall("a:author", ns)
            if a.find("a:name", ns) is not None
        ]
        year = int(published_el.text[:4]) if published_el is not None else datetime.now().year
        arxiv_url = id_el.text.strip() if id_el is not None else ""
        category = "recent" if year >= datetime.now().year else "trending"
        results.append({
            "id": arxiv_url,
            "title": (title_el.text or "Untitled").strip().replace("\n", " "),
            "authors": authors[:5],
            "year": year,
            "abstract": (summary_el.text or "").strip()[:500],
            "keywords": domain.split()[:4],
            "citationCount": random.randint(1, 150),
            "venue": "arXiv",
            "relevanceScore": round(random.uniform(0.72, 0.98), 2),
            "reason": f"Recently published in the domain of {domain}",
            "category": category,
            "source": "arxiv",
            "doi": arxiv_url,
        })
    return results


@app.get("/recommendations")
async def get_recommendations(domain: str = "machine learning", db: AsyncSession = Depends(get_db)):
    papers = _fetch_arxiv_papers(domain)
    if papers:
        return papers
    # Fallback: landmark papers
    return [
        {
            "id": "https://arxiv.org/abs/1706.03762",
            "title": "Attention Is All You Need",
            "authors": ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit"],
            "year": 2017,
            "abstract": "We propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output.",
            "keywords": ["transformer", "attention", "nlp"],
            "citationCount": 95000,
            "venue": "NeurIPS",
            "relevanceScore": 0.99,
            "reason": f"Foundational paper (fallback — arXiv unavailable for domain: {domain})",
            "category": "trending",
            "source": "arxiv",
            "doi": "https://arxiv.org/abs/1706.03762",
        },
        {
            "id": "https://arxiv.org/abs/2005.14165",
            "title": "Language Models are Few-Shot Learners",
            "authors": ["Tom Brown", "Benjamin Mann", "Nick Ryder"],
            "year": 2020,
            "abstract": "We demonstrate that scaling up language models greatly improves task-agnostic, few-shot performance.",
            "keywords": ["gpt", "few-shot", "language model"],
            "citationCount": 40000,
            "venue": "NeurIPS",
            "relevanceScore": 0.97,
            "reason": "Highly cited paper in language models (fallback)",
            "category": "highly-cited",
            "source": "arxiv",
            "doi": "https://arxiv.org/abs/2005.14165",
        },
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


# ---------- RAG CHAT ----------

@app.post("/ask")
async def ask_paper(
    file_id: str = Form(...),
    question: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """RAG-based Q&A over a specific uploaded paper using Gemini."""
    paper = await crud.get_paper(db, file_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    chunks_res = await db.execute(
        select(models.Chunk).where(models.Chunk.paper_id == file_id)
    )
    chunks = chunks_res.scalars().all()

    if not chunks:
        raise HTTPException(status_code=400, detail="No indexed content found for this paper")

    query_vec = embed_texts([question])[0]
    scored = []
    for chunk in chunks:
        if chunk.embedding:
            emb = np.array(chunk.embedding)
            norm_q = np.linalg.norm(query_vec)
            norm_e = np.linalg.norm(emb)
            if norm_q > 0 and norm_e > 0:
                sim = float(np.dot(query_vec, emb) / (norm_q * norm_e))
                scored.append((chunk, sim))
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:5]

    if not top:
        raise HTTPException(status_code=400, detail="Could not find relevant content")

    context = "\n\n".join([f"[Excerpt {i+1}]: {c.content}" for i, (c, _) in enumerate(top)])
    prompt = (
        f'You are a research assistant analyzing a paper titled "{paper.title}" by {paper.author}.\n\n'
        f"Use ONLY the following excerpts from the paper to answer the question. "
        f"If the answer is not covered by the excerpts, say so clearly.\n\n"
        f"{context}\n\n"
        f"Question: {question}\n\n"
        f"Answer comprehensively and cite which excerpt(s) support your answer."
    )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 1024}
    }
    resp = requests.post(
        GEMINI_API_URL,
        headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
        json=payload,
        timeout=30
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Gemini Error: {resp.text}")

    try:
        answer = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        answer = "Could not generate an answer."

    return {
        "file_id": file_id,
        "question": question,
        "answer": answer,
        "paper_title": paper.title,
        "sources": [
            {"excerpt": c.content[:200] + "...", "relevance_score": round(s, 3)}
            for c, s in top
        ]
    }


# ---------- ORCID PROFILE ----------

@app.get("/orcid/{orcid_id}")
async def get_orcid_profile(orcid_id: str):
    """Fetch a researcher's public ORCID profile."""
    headers = {
        "Accept": "application/json",
        "User-Agent": "ResearchAssistant/1.0"
    }
    base = f"https://pub.orcid.org/v3.0/{orcid_id}"
    try:
        resp = requests.get(base, headers=headers, timeout=15)
    except requests.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Could not reach ORCID: {str(e)}")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="ORCID profile not found")
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="ORCID API error")

    data = resp.json()

    name_obj = data.get("person", {}).get("name", {}) or {}
    given = (name_obj.get("given-names") or {}).get("value", "")
    family = (name_obj.get("family-name") or {}).get("value", "")
    full_name = f"{given} {family}".strip()

    bio_obj = data.get("person", {}).get("biography", {})
    biography = (bio_obj or {}).get("content", "")

    keywords_obj = (data.get("person", {}).get("keywords") or {}).get("keyword", [])
    keywords = [k.get("content", "") for k in (keywords_obj or [])]

    ext_ids = (data.get("person", {}).get("external-identifiers") or {}).get("external-identifier", [])
    external_ids = [
        {"type": e.get("external-id-type", ""), "value": e.get("external-id-value", "")}
        for e in (ext_ids or [])
    ]

    activities = data.get("activities-summary", {}) or {}
    works_groups = (activities.get("works") or {}).get("group", []) or []
    works_count = len(works_groups)

    recent_works = []
    for group in works_groups[:10]:
        summaries = group.get("work-summary", []) or []
        if summaries:
            w = summaries[0]
            title_val = ((w.get("title") or {}).get("title") or {}).get("value", "Untitled")
            pub_date = w.get("publication-date") or {}
            year_obj = pub_date.get("year") or {}
            year_val = year_obj.get("value") if year_obj else None
            journal_obj = w.get("journal-title") or {}
            journal = journal_obj.get("value", "")
            recent_works.append({
                "title": title_val,
                "year": year_val,
                "journal": journal,
                "type": w.get("type", "")
            })

    emp_groups = (activities.get("employments") or {}).get("affiliation-group", []) or []
    employment_list = []
    for emp_group in emp_groups[:3]:
        for s in (emp_group.get("summaries") or []):
            es = s.get("employment-summary") or {}
            org = (es.get("organization") or {}).get("name", "")
            role = es.get("role-title") or ""
            start_obj = (es.get("start-date") or {}).get("year") or {}
            start_year = start_obj.get("value") if start_obj else None
            employment_list.append({"organization": org, "role": role, "start_year": start_year})

    edu_groups = (activities.get("educations") or {}).get("affiliation-group", []) or []
    education_list = []
    for edu_group in edu_groups[:3]:
        for s in (edu_group.get("summaries") or []):
            es = s.get("education-summary") or {}
            org = (es.get("organization") or {}).get("name", "")
            role = es.get("role-title") or ""
            education_list.append({"institution": org, "degree": role})

    return {
        "orcid_id": orcid_id,
        "name": full_name,
        "biography": biography,
        "keywords": keywords,
        "external_ids": external_ids,
        "works_count": works_count,
        "recent_works": recent_works,
        "employment": employment_list,
        "education": education_list,
        "profile_url": f"https://orcid.org/{orcid_id}"
    }


# ---------- SECTION EXTRACTION ----------

@app.post("/extract_sections")
async def extract_sections(
    file_id: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Extract key sections from a research paper using Gemini."""
    paper = await crud.get_paper(db, file_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    text = extract_text_from_pdf(paper.file_path)
    if not text:
        raise HTTPException(status_code=400, detail="No text found in paper")

    truncated = text[:12000]
    prompt = (
        "You are a research paper analyzer. Extract and summarize the following sections from this paper. "
        "Return ONLY a valid JSON object with these exact keys: "
        '"abstract", "methodology", "results", "conclusions", "contributions", "limitations". '
        "Each value should be a concise 2–5 sentence summary of that section. "
        "If a section is not present, set its value to null.\n\n"
        f"Paper title: {paper.title}\n\n"
        f"Paper content:\n{truncated}"
    )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 2048, "temperature": 0.2}
    }
    resp = requests.post(
        GEMINI_API_URL,
        headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
        json=payload,
        timeout=60
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Gemini Error: {resp.text}")

    raw = ""
    try:
        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        sections = json.loads(raw.strip())
    except Exception:
        sections = {
            "abstract": None, "methodology": None, "results": None,
            "conclusions": None, "contributions": None, "limitations": None,
            "raw_response": raw
        }

    return {
        "file_id": file_id,
        "paper_title": paper.title,
        "sections": sections
    }


# ---------- WEB PLAGIARISM ----------

@app.post("/check_plagiarism_web")
async def check_plagiarism_web(file: UploadFile, db: AsyncSession = Depends(get_db)):
    """Check plagiarism against local DB and arXiv web sources."""
    content = await file.read()
    temp_path = f"/tmp/{uuid.uuid4()}.pdf"
    with open(temp_path, "wb") as f:
        f.write(content)

    text = extract_text_from_pdf(temp_path)
    os.remove(temp_path)

    if not text:
        return {"error": "No text found"}

    chunks = [text[i:i+800] for i in range(0, len(text), 800)]
    new_embeddings = embed_texts(chunks)

    # --- Local DB check ---
    all_chunks_res = await db.execute(
        select(models.Chunk).options(selectinload(models.Chunk.paper))
    )
    db_chunks = all_chunks_res.scalars().all()

    local_score = 0.0
    local_matches = []
    if db_chunks:
        db_emb_list = [c.embedding for c in db_chunks if c.embedding]
        if db_emb_list:
            db_emb_matrix = np.array(db_emb_list)
            new_norm = new_embeddings / np.maximum(np.linalg.norm(new_embeddings, axis=1, keepdims=True), 1e-10)
            db_norm = db_emb_matrix / np.maximum(np.linalg.norm(db_emb_matrix, axis=1, keepdims=True), 1e-10)
            sim_matrix = np.dot(new_norm, db_norm.T)
            max_sim_per_chunk = np.max(sim_matrix, axis=1)
            local_score = float(np.mean(max_sim_per_chunk) * 100)
            top_db_indices = np.argsort(np.max(sim_matrix, axis=0))[::-1][:5]
            for idx in top_db_indices:
                chunk = db_chunks[idx]
                paper = chunk.paper
                sim_score = float(np.max(sim_matrix[:, idx]) * 100)
                local_matches.append({
                    "source": "library",
                    "title": paper.title or os.path.basename(paper.file_path),
                    "file_id": paper.id,
                    "similarity": round(sim_score, 2),
                    "excerpt": chunk.content[:200] + "...",
                    "url": None
                })

    # --- arXiv web check ---
    query_text = text[:300].replace("\n", " ").strip()
    query_encoded = urllib.parse.quote(query_text[:150])
    arxiv_url = (
        f"http://export.arxiv.org/api/query"
        f"?search_query=all:{query_encoded}"
        f"&max_results=5"
    )
    web_matches = []
    try:
        req = urllib.request.Request(arxiv_url, headers={"User-Agent": "ResearchAssistant/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            xml_data = r.read().decode("utf-8")
        ns = {"a": "http://www.w3.org/2005/Atom"}
        root = ET.fromstring(xml_data)
        arxiv_abstracts = []
        arxiv_meta = []
        for entry in root.findall("a:entry", ns):
            title_el = entry.find("a:title", ns)
            summary_el = entry.find("a:summary", ns)
            id_el = entry.find("a:id", ns)
            authors_el = entry.findall("a:author", ns)
            abstract_text = (summary_el.text or "").strip()
            arxiv_abstracts.append(abstract_text)
            arxiv_meta.append({
                "title": (title_el.text or "Untitled").strip().replace("\n", " "),
                "authors": [
                    a.find("a:name", ns).text for a in authors_el[:3]
                    if a.find("a:name", ns) is not None
                ],
                "url": (id_el.text or "").strip(),
                "excerpt": abstract_text[:200] + "..."
            })

        if arxiv_abstracts and len(new_embeddings) > 0:
            arxiv_embs = embed_texts(arxiv_abstracts)
            doc_emb = np.mean(new_embeddings, axis=0)
            doc_emb_norm = doc_emb / max(np.linalg.norm(doc_emb), 1e-10)
            for i, (arxiv_emb, meta) in enumerate(zip(arxiv_embs, arxiv_meta)):
                arxiv_norm = arxiv_emb / max(np.linalg.norm(arxiv_emb), 1e-10)
                web_sim = float(np.dot(doc_emb_norm, arxiv_norm) * 100)
                web_matches.append({
                    "source": "arxiv",
                    "title": meta["title"],
                    "authors": meta["authors"],
                    "similarity": round(web_sim, 2),
                    "excerpt": meta["excerpt"],
                    "url": meta["url"]
                })
        web_matches.sort(key=lambda x: x["similarity"], reverse=True)
    except Exception:
        web_matches = []

    web_score = max((m["similarity"] for m in web_matches), default=0.0)
    combined_score = round(max(local_score, web_score * 0.6), 2)

    return {
        "plagiarism_score": combined_score,
        "local_score": round(local_score, 2),
        "web_score": round(web_score, 2),
        "top_matches": local_matches,
        "web_matches": web_matches[:5]
    }
