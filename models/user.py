"""User entity model for the spatial memory system.

Maps Clerk users to local User nodes in Neo4j.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid


def generate_id() -> str:
    """Generate a unique ID for entities."""
    return str(uuid.uuid4())


class User(BaseModel):
    """User entity for the spatial memory system.
    
    Each user has their own isolated spatial memory graph.
    Users are created automatically on first authenticated API request.
    
    Attributes:
        id: Internal UUID for the user
        clerk_user_id: External ID from Clerk (JWT 'sub' claim)
        email: User's email address
        first_name: User's first name
        last_name: User's last name
        created_at: When the user was first created
        updated_at: When the user was last updated
    """
    id: str = Field(default_factory=generate_id)
    clerk_user_id: str  # From Clerk JWT 'sub' claim
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "clerk_user_id": "user_2abc123def456",
                "email": "user@example.com",
                "first_name": "John",
                "last_name": "Doe",
            }
        }
