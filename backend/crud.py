from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
import models, schemas
import uuid
import numpy as np

async def create_paper(db: AsyncSession, paper: schemas.PaperCreate):
    db_paper = models.Paper(
        id=str(uuid.uuid4()),
        title=paper.title,
        author=paper.author,
        year=paper.year,
        keywords=paper.keywords,
        file_path=paper.file_path,
        status="unread"
    )
    db.add(db_paper)
    await db.commit()
    await db.refresh(db_paper)
    return db_paper

async def create_chunks(db: AsyncSession, paper_id: str, chunks: list, embeddings: list):
    for i, content in enumerate(chunks):
        db_chunk = models.Chunk(
            id=str(uuid.uuid4()),
            paper_id=paper_id,
            content=content,
            embedding=embeddings[i].tolist()
        )
        db.add(db_chunk)
    await db.commit()

async def get_all_papers(db: AsyncSession):
    result = await db.execute(select(models.Paper).order_by(models.Paper.created_at.desc()))
    return result.scalars().all()

async def get_paper(db: AsyncSession, paper_id: str):
    result = await db.execute(select(models.Paper).where(models.Paper.id == paper_id))
    return result.scalar_one_or_none()

async def get_stats(db: AsyncSession):
    result = await db.execute(select(models.Paper))
    papers = result.scalars().all()
    total = len(papers)
    read = len([p for p in papers if p.status == 'read'])
    return {"totalPapers": total, "readPapers": read}

async def search_papers_keyword(db: AsyncSession, query: str):
    stmt = select(models.Chunk).join(models.Paper).where(
        or_(
            models.Chunk.content.ilike(f"%{query}%"),
            models.Paper.title.ilike(f"%{query}%"),
            models.Paper.author.ilike(f"%{query}%")
        )
    ).limit(50)
    result = await db.execute(stmt)
    chunks = result.scalars().all()
    return chunks

async def search_papers_semantic(db: AsyncSession, query_embedding: list, top_k: int = 5):
    # Retrieve all chunks and compute similarity in Python (PostgreSQL vector extension would be better for prod)
    result = await db.execute(select(models.Chunk).join(models.Paper))
    chunks = result.scalars().all()
    
    if not chunks:
        return []

    scores = []
    for chunk in chunks:
        if chunk.embedding:
            similarity = np.dot(query_embedding, chunk.embedding) / (np.linalg.norm(query_embedding) * np.linalg.norm(chunk.embedding))
            scores.append((chunk, similarity))
    
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_k]

async def update_paper_status(db: AsyncSession, paper_id: str, status: str):
    paper = await get_paper(db, paper_id)
    if paper:
        paper.status = status
        await db.commit()
        await db.refresh(paper)
    return paper

async def get_notes_for_paper(db: AsyncSession, paper_id: str):
    result = await db.execute(
        select(models.PaperNote).where(models.PaperNote.paper_id == paper_id).order_by(models.PaperNote.created_at.asc())
    )
    return result.scalars().all()

async def create_note(db: AsyncSession, paper_id: str, author_name: str, content: str):
    note = models.PaperNote(
        id=str(uuid.uuid4()),
        paper_id=paper_id,
        author_name=author_name,
        content=content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note

async def get_comments_for_paper(db: AsyncSession, paper_id: str):
    result = await db.execute(
        select(models.PaperComment).where(models.PaperComment.paper_id == paper_id).order_by(models.PaperComment.created_at.asc())
    )
    return result.scalars().all()

async def create_comment(db: AsyncSession, paper_id: str, author_name: str, content: str):
    comment = models.PaperComment(
        id=str(uuid.uuid4()),
        paper_id=paper_id,
        author_name=author_name,
        content=content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment
