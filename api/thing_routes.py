"""FastAPI routes for Spatial Memory API.

Cognitive verb endpoints that mirror the graph service operations.
All endpoints require authentication and are scoped to the authenticated user.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.graph_service import GraphService
from services.user_service import UserService
from api.middleware.auth import get_current_user, AuthenticatedUser


router = APIRouter()


# ========== Request Models ==========

class RememberRequest(BaseModel):
    """Request to remember a new thing."""
    thing_name: str
    location: str
    description: Optional[str] = None
    tags: Optional[list[str]] = None


class FindRequest(BaseModel):
    """Request to find things."""
    query: str


class MoveRequest(BaseModel):
    """Request to move a thing."""
    thing_name: str
    new_location: str


class AssociateRequest(BaseModel):
    """Request to associate two things."""
    thing1: str
    thing2: str
    relationship: Optional[str] = None


class ContentsRequest(BaseModel):
    """Request to list contents of a location."""
    location: str


class IntentRequest(BaseModel):
    """Request to attach intent to a thing."""
    thing_name: str
    intent: str
    description: Optional[str] = None


# ========== Helper Functions ==========

def get_user_id(current_user: AuthenticatedUser) -> str:
    """Get or create the local user ID from Clerk authentication."""
    with UserService() as us:
        user = us.find_or_create_user(
            clerk_user_id=current_user.clerk_user_id,
            email=current_user.email,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
        )
    return user.id


# ========== Endpoints ==========

@router.post("/thing/remember")
async def remember_thing(
    request: RememberRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Store a new thing at a specific location.
    
    Creates the thing, location hierarchy, and all necessary graph relationships.
    The thing is automatically associated with the authenticated user.
    """
    user_id = get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        result = gs.remember_thing(
            thing_name=request.thing_name,
            location=request.location,
            description=request.description,
            tags=request.tags
        )
    
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    
    return result


@router.post("/thing/find")
async def find_thing(
    request: FindRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Find things matching a search query.
    
    Searches by name, description, and tags. Only returns things
    owned by the authenticated user.
    """
    user_id = get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        result = gs.find_thing(request.query)
    
    return result


@router.post("/thing/move")
async def move_thing(
    request: MoveRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Move a thing to a new location.
    
    Updates the location and creates a move event.
    Only works for things owned by the authenticated user.
    """
    user_id = get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        result = gs.move_thing(request.thing_name, request.new_location)
    
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result.get("message"))
    
    return result


@router.post("/thing/associate")
async def associate_things(
    request: AssociateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Link two related things together.
    
    Only works for things owned by the authenticated user.
    """
    user_id = get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        result = gs.associate_things(
            request.thing1,
            request.thing2,
            request.relationship
        )
    
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result.get("message"))
    
    return result


@router.post("/place/contents")
async def list_contents(
    request: ContentsRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """List all things in a location.
    
    Only returns things owned by the authenticated user.
    """
    user_id = get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        result = gs.list_contents(request.location)
    
    return result


@router.post("/intent/attach")
async def attach_intent(
    request: IntentRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Attach a purpose/intent to a thing.
    
    Only works for things owned by the authenticated user.
    """
    user_id = get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        result = gs.attach_intent(
            request.thing_name,
            request.intent,
            request.description
        )
    
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result.get("message"))
    
    return result


# ========== Health Check ==========

@router.get("/health")
async def health_check():
    """Health check endpoint (no auth required)."""
    return {"status": "healthy", "service": "spatial-memory-api"}
