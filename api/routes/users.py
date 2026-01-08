"""User routes for profile and user management."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from api.middleware.auth import get_current_user, AuthenticatedUser
from services.user_service import UserService


router = APIRouter(prefix="/user", tags=["user"])


class ProfileResponse(BaseModel):
    """Response model for user profile."""
    id: str
    clerk_user_id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Get or create user profile.
    
    This endpoint maps the Clerk user to a local User in Neo4j.
    On first call, the user is automatically created.
    
    The backend uses this to:
    1. Create a User node in Neo4j if it doesn't exist
    2. Return the user's profile information
    3. Establish the user's identity for subsequent requests
    
    All spatial memory data is isolated per user via the OWNS relationship.
    """
    with UserService() as us:
        user = us.find_or_create_user(
            clerk_user_id=current_user.clerk_user_id,
            email=current_user.email,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
        )
    
    return ProfileResponse(
        id=user.id,
        clerk_user_id=user.clerk_user_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
    )


@router.get("/me")
async def get_current_user_info(
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Get current authenticated user info from token.
    
    This is a lightweight endpoint that returns the user info directly
    from the JWT token without hitting the database.
    """
    return {
        "clerk_user_id": current_user.clerk_user_id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
    }
