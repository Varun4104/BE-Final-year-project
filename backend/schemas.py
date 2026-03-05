from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class PaperBase(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    year: Optional[int] = None
    keywords: Optional[List[str]] = []
    status: Optional[str] = "unread"

class PaperCreate(PaperBase):
    file_path: str

class PaperResponse(PaperBase):
    id: str
    created_at: datetime
    abstract: Optional[str] = None

    class Config:
        from_attributes = True

class SearchResult(BaseModel):
    id: str
    file_id: str
    file_name: str
    title: str
    authors: List[str]
    year: int
    abstract: str
    keywords: List[str]
    citationCount: int
    relevanceScore: float
    status: str
    source: str
    doi: str
    venue: str

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]

class StatsResponse(BaseModel):
    totalPapers: int
    readPapers: int
    savedSearches: int
    recommendations: int

class NoteCreate(BaseModel):
    author_name: str
    content: str

class NoteResponse(BaseModel):
    id: str
    paper_id: str
    author_name: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    author_name: str
    content: str

class CommentResponse(BaseModel):
    id: str
    paper_id: str
    author_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class PlagiarismMatch(BaseModel):
    file_name: str
    file_id: str
    similarity: float
    excerpt: str

class PlagiarismResponse(BaseModel):
    file_id: str
    plagiarism_score: float
    top_matches: List[PlagiarismMatch]
