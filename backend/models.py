from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from database import Base

class Paper(Base):
    __tablename__ = "papers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=True)
    author = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    abstract = Column(Text, nullable=True)
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="unread")  # read, unread, reading
    keywords = Column(ARRAY(String), default=list)
    
    chunks = relationship("Chunk", back_populates="paper", cascade="all, delete-orphan")

class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id = Column(String, ForeignKey("papers.id"))
    content = Column(Text, nullable=False)
    embedding = Column(ARRAY(Float), nullable=True)

    paper = relationship("Paper", back_populates="chunks")

class PaperNote(Base):
    __tablename__ = "paper_notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id = Column(String, ForeignKey("papers.id"), nullable=False)
    author_name = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PaperComment(Base):
    __tablename__ = "paper_comments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id = Column(String, ForeignKey("papers.id"), nullable=False)
    author_name = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
