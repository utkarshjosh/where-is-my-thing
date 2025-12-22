"""Core entity models for the spatial memory system.

The system models 4 primitive concepts:
- Thing: Physical object
- Place: Location (physical or abstract)  
- Intent: Purpose/reason (why it exists / when needed)
- Event: Change over time
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


class Thing(BaseModel):
    """A physical object being tracked.
    
    Examples: passport, HDMI cable, screwdriver
    """
    id: str = Field(default_factory=generate_id)
    name: str
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
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
    """
    id: str = Field(default_factory=generate_id)
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


class Event(BaseModel):
    """A temporal record of change.
    
    Tracks when things happen: moved, used, last seen.
    """
    id: str = Field(default_factory=generate_id)
    event_type: str  # "moved", "used", "created", "updated"
    timestamp: datetime = Field(default_factory=datetime.now)
    notes: Optional[str] = None
    
    # For move events
    from_place_id: Optional[str] = None
    to_place_id: Optional[str] = None
