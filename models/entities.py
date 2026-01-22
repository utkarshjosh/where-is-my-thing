"""Core entity models for the spatial memory system.

The system models these core concepts:
- Thing: Physical object being tracked (user-scoped)
- Place: Location - room, zone, container (user-scoped)
- Intent: Purpose/reason for keeping something
- CanonicalItem: Canonical identity for deduplication (user-scoped)

All entities with user_id are user-isolated.
"""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
import uuid


def generate_id() -> str:
    """Generate a unique ID for entities."""
    return str(uuid.uuid4())


class PlaceType(str, Enum):
    """Types of places in the hierarchy."""
    ROOM = "room"
    ZONE = "zone"  # e.g., "drawing room bed", "bookshelf left side"
    CONTAINER = "container"  # e.g., drawer, box, bag, shelf


class ItemType(str, Enum):
    """Types of items for canonical classification.
    
    Aligned with UI categories for consistent display.
    """
    KEYS = "keys"  # keys, keychains
    BOOK = "book"
    DOCUMENT = "document"
    ELECTRONIC = "electronic"
    CLOTHING = "clothing"
    TOOL = "tool"
    PERSONAL = "personal"  # wallet, glasses, watch
    MISC = "misc"


class Thing(BaseModel):
    """A physical object being tracked.
    
    Examples: passport, HDMI cable, screwdriver
    
    User Isolation:
    - user_id property for fast filtering
    - Also connected via (User)-[:OWNS]->(Thing)
    """
    id: str = Field(default_factory=generate_id)
    user_id: str  # REQUIRED: Internal user UUID for isolation
    name: str
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    item_type: Optional[ItemType] = None  # For canonical classification
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # Metadata for semantic search
    embedding_text: Optional[str] = None  # Generated profile text for embeddings


class Place(BaseModel):
    """A physical or abstract location.
    
    Places form a hierarchy: Room → Zone → Container
    Examples:
    - Room: "Living Room", "Bedroom"
    - Zone: "TV Unit", "Bedside"
    - Container: "Blue Box", "Top Drawer"
    
    User Isolation:
    - Each user has their own places
    - user_id property for filtering
    """
    id: str = Field(default_factory=generate_id)
    user_id: str  # REQUIRED: Internal user UUID for isolation
    name: str
    place_type: PlaceType
    description: Optional[str] = None
    parent_id: Optional[str] = None  # Parent place in hierarchy
    created_at: datetime = Field(default_factory=datetime.now)


class Intent(BaseModel):
    """Purpose or reason for keeping something.
    
    Captures the 'why' - why was this kept, when is it needed.
    Examples: "Travel", "Emergency", "Hobby", "Sentimental"
    """
    id: str = Field(default_factory=generate_id)
    name: str
    description: Optional[str] = None
    urgency: Optional[str] = None  # e.g., "high", "low", "seasonal"
    created_at: datetime = Field(default_factory=datetime.now)


class CanonicalItem(BaseModel):
    """Canonical identity for object deduplication.
    
    Solves the "perception vs belief" problem:
    - Multiple utterances may refer to the same object
    - canonical_name is the best guess, not truth
    - aliases grow over time as user refers to item differently
    - confidence increases with repetition/confirmation
    
    Example:
    - canonical_name: "Crime and Punishment"
    - item_type: book
    - aliases: ["crime punishment", "dostoevsky book", "that russian novel"]
    - confidence: 0.71
    """
    id: str = Field(default_factory=generate_id)
    user_id: str  # REQUIRED: User-scoped canonicals
    canonical_name: str  # Best guess normalized name
    item_type: Optional[ItemType] = None
    aliases: list[str] = Field(default_factory=list)  # All known ways user refers to this
    confidence: float = Field(default=0.5)  # 0.0-1.0, increases with confirmation
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # Metadata for similarity matching
    embedding_text: Optional[str] = None
