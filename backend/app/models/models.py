"""
M1: Database Models
Owner: Backend Dev 1
Dependencies: database.py

All SQLAlchemy ORM models for the platform.
Each class maps to a table and is independently testable.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Enum, Boolean,
    Integer, Float, JSON,
)
from sqlalchemy.orm import relationship
from app.db.database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    REVIEWER = "reviewer"
    ETHICS_REVIEWER = "ethics_reviewer"
    PUBLISHER = "publisher"


class AdType(str, enum.Enum):
    WEBSITE = "website"
    ADS = "ads"
    VOICEBOT = "voicebot"
    CHATBOT = "chatbot"


class AdStatus(str, enum.Enum):
    DRAFT = "draft"
    STRATEGY_CREATED = "strategy_created"
    UNDER_REVIEW = "under_review"
    ETHICS_REVIEW = "ethics_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    PAUSED = "paused"
    OPTIMIZING = "optimizing"


class DocumentType(str, enum.Enum):
    USP = "usp"
    COMPLIANCE = "compliance"
    POLICY = "policy"
    MARKETING_GOAL = "marketing_goal"
    ETHICAL_GUIDELINE = "ethical_guideline"
    REFERENCE = "reference"            # Reinforcement-learning reference doc
    PROTOCOL = "protocol"
    INPUT = "input"                     # User-uploaded input document


# ─── Helper ───────────────────────────────────────────────────────────────────

def _uuid():
    return str(uuid.uuid4())


# ─── Company ──────────────────────────────────────────────────────────────────

class Company(Base):
    __tablename__ = "companies"

    id          = Column(String, primary_key=True, default=_uuid)
    name        = Column(String(256), nullable=False)
    logo_url    = Column(String(512), nullable=True)
    industry    = Column(String(128), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    onboarded   = Column(Boolean, default=False)

    # Relationships
    users           = relationship("User", back_populates="company", cascade="all, delete-orphan")
    documents       = relationship("CompanyDocument", back_populates="company", cascade="all, delete-orphan")
    advertisements        = relationship("Advertisement", back_populates="company", cascade="all, delete-orphan")
    skills                = relationship("SkillConfig", back_populates="company", cascade="all, delete-orphan")
    reinforcement_logs    = relationship("ReinforcementLog", back_populates="company", cascade="all, delete-orphan")


# ─── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id          = Column(String, primary_key=True, default=_uuid)
    company_id  = Column(String, ForeignKey("companies.id"), nullable=False)
    email       = Column(String(256), unique=True, nullable=False)
    hashed_pw   = Column(String(512), nullable=False)
    full_name   = Column(String(256), nullable=False)
    role        = Column(Enum(UserRole), nullable=False)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="users")
    reviews = relationship("Review", back_populates="reviewer", cascade="all, delete-orphan")


# ─── Company Documents ────────────────────────────────────────────────────────

class CompanyDocument(Base):
    __tablename__ = "company_documents"

    id          = Column(String, primary_key=True, default=_uuid)
    company_id  = Column(String, ForeignKey("companies.id"), nullable=False)
    doc_type    = Column(Enum(DocumentType), nullable=False)
    title       = Column(String(512), nullable=False)
    content     = Column(Text, nullable=True)           # Extracted text content
    file_path   = Column(String(1024), nullable=True)   # Path to uploaded file
    priority    = Column(Integer, default=0)             # Higher = more weight in RAG
    version     = Column(Integer, default=1)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", back_populates="documents")


# ─── Skill Configuration ─────────────────────────────────────────────────────

class SkillConfig(Base):
    """
    Stores the generated skill.md content for Curator and Reviewer,
    customized per-company during the Training phase.
    """
    __tablename__ = "skill_configs"

    id          = Column(String, primary_key=True, default=_uuid)
    company_id  = Column(String, ForeignKey("companies.id"), nullable=False)
    skill_type  = Column(String(64), nullable=False)  # "curator" | "reviewer"
    skill_md    = Column(Text, nullable=False)         # Full SKILL.md content
    version     = Column(Integer, default=1)
    lessons_learnt = Column(Text, nullable=True)       # Appended by reinforcement loop
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", back_populates="skills")


# ─── Advertisement (Campaign) ────────────────────────────────────────────────

class Advertisement(Base):
    __tablename__ = "advertisements"

    id              = Column(String, primary_key=True, default=_uuid)
    company_id      = Column(String, ForeignKey("companies.id"), nullable=False)
    title           = Column(String(512), nullable=False)
    ad_type         = Column(JSON, nullable=False)          # List[str]: ["website","ads","voicebot","chatbot"]
    status          = Column(Enum(AdStatus), default=AdStatus.DRAFT)
    budget          = Column(Float, nullable=True)
    platforms       = Column(JSON, nullable=True)       # ["instagram", "google", ...]
    target_audience = Column(JSON, nullable=True)       # demographics object

    # AI-generated content
    strategy_json   = Column(JSON, nullable=True)       # Curator output
    review_notes    = Column(Text, nullable=True)       # Reviewer edits
    website_reqs    = Column(JSON, nullable=True)       # Website requirements (from Reviewer)
    ad_details      = Column(JSON, nullable=True)       # Ad specifications (from Reviewer)

    # Output artifacts
    output_url      = Column(String(1024), nullable=True)  # Published website/ad URL
    output_files    = Column(JSON, nullable=True)           # Generated file paths

    # Bot params (for voicebot/chatbot types)
    bot_config      = Column(JSON, nullable=True)

    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company              = relationship("Company", back_populates="advertisements")
    reviews              = relationship("Review", back_populates="advertisement", cascade="all, delete-orphan")
    analytics            = relationship("AdAnalytics", back_populates="advertisement", cascade="all, delete-orphan")
    optimizer_logs       = relationship("OptimizerLog", back_populates="advertisement", cascade="all, delete-orphan")
    reinforcement_logs   = relationship("ReinforcementLog", back_populates="advertisement")


# ─── Review ───────────────────────────────────────────────────────────────────

class Review(Base):
    __tablename__ = "reviews"

    id               = Column(String, primary_key=True, default=_uuid)
    advertisement_id = Column(String, ForeignKey("advertisements.id"), nullable=False)
    reviewer_id      = Column(String, ForeignKey("users.id"), nullable=False)
    review_type      = Column(String(32), nullable=False)  # "strategy" | "ethics" | "performance"
    status           = Column(String(32), default="pending")  # pending | approved | rejected | revision
    comments         = Column(Text, nullable=True)
    suggestions      = Column(JSON, nullable=True)
    edited_strategy  = Column(JSON, nullable=True)         # Manual edits by reviewer
    created_at       = Column(DateTime, default=datetime.utcnow)

    advertisement = relationship("Advertisement", back_populates="reviews")
    reviewer      = relationship("User", back_populates="reviews")


# ─── Ad Analytics ─────────────────────────────────────────────────────────────

class AdAnalytics(Base):
    __tablename__ = "ad_analytics"

    id               = Column(String, primary_key=True, default=_uuid)
    advertisement_id = Column(String, ForeignKey("advertisements.id"), nullable=False)
    recorded_at      = Column(DateTime, default=datetime.utcnow)

    # Website metrics
    user_retention   = Column(Float, nullable=True)
    click_rate       = Column(Float, nullable=True)
    follow_through   = Column(Float, nullable=True)
    call_duration    = Column(Float, nullable=True)        # seconds

    # Ad metrics
    views            = Column(Integer, nullable=True)
    likes            = Column(Integer, nullable=True)
    demographics     = Column(JSON, nullable=True)         # { age_group: %, region: % }
    impressions      = Column(Integer, nullable=True)
    conversions      = Column(Integer, nullable=True)
    cost_per_click   = Column(Float, nullable=True)

    advertisement = relationship("Advertisement", back_populates="analytics")


# ─── Optimizer Logs ───────────────────────────────────────────────────────────

class OptimizerLog(Base):
    __tablename__ = "optimizer_logs"

    id               = Column(String, primary_key=True, default=_uuid)
    advertisement_id = Column(String, ForeignKey("advertisements.id"), nullable=False)
    suggestions      = Column(JSON, nullable=False)        # Weighted suggestions
    context          = Column(JSON, nullable=True)          # Reviewer context for situational awareness
    human_decision   = Column(String(32), nullable=True)   # accepted | rejected | partial
    applied_changes  = Column(JSON, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    advertisement = relationship("Advertisement", back_populates="optimizer_logs")


# ─── Reinforcement Learning Log ───────────────────────────────────────────────

class ReinforcementLog(Base):
    __tablename__ = "reinforcement_logs"

    id               = Column(String, primary_key=True, default=_uuid)
    company_id       = Column(String, ForeignKey("companies.id"), nullable=False)
    advertisement_id = Column(String, ForeignKey("advertisements.id"), nullable=True)
    source_type      = Column(String(64), nullable=False)  # "user_review" | "performance" | "ethics"
    raw_data         = Column(JSON, nullable=False)
    formalized_doc   = Column(Text, nullable=True)         # RAG-processed reference document
    applied_to_skill = Column(Boolean, default=False)
    created_at       = Column(DateTime, default=datetime.utcnow)

    company       = relationship("Company", back_populates="reinforcement_logs")
    advertisement = relationship("Advertisement", back_populates="reinforcement_logs")
