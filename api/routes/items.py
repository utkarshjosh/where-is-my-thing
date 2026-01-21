"""Items routes for listing and searching user's things."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from api.middleware.auth import get_current_user, AuthenticatedUser
from services.graph_service import GraphService
from services.user_service import UserService


router = APIRouter(prefix="/items", tags=["items"])


class ItemResponse(BaseModel):
    """Response model for a single item."""
    id: str
    name: str
    description: Optional[str] = None
    tags: list[str] = []
    location: Optional[str] = None
    location_path: Optional[str] = None
    category: Optional[str] = None


class ItemsListResponse(BaseModel):
    """Response model for items list."""
    items: list[ItemResponse]
    count: int


def _get_user_id(current_user: AuthenticatedUser) -> str:
    """Get or create the local user ID from Clerk authentication.
    
    Uses caching to avoid Neo4j lookup on every request.
    """
    from services.cache_service import get_user_id_cache
    cache = get_user_id_cache()
    
    # Check cache first
    cache_key = f"user:{current_user.clerk_user_id}"
    cached_id = cache.get(cache_key)
    if cached_id:
        return cached_id
    
    # Cache miss - query Neo4j
    with UserService() as us:
        user = us.find_or_create_user(
            clerk_user_id=current_user.clerk_user_id,
            email=current_user.email,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
        )
    
    # Cache the result
    cache.set(cache_key, user.id)
    return user.id


def _infer_category(tags: list[str], name: str) -> str:
    """Infer category from tags or name."""
    category_keywords = {
        "keys": ["key", "keys"],
        "electronics": ["phone", "laptop", "charger", "cable", "electronic", "device", "power"],
        "documents": ["document", "passport", "paper", "file", "certificate", "id"],
        "personal": ["wallet", "glasses", "watch", "jewelry", "bag"],
        "home": ["tool", "kitchen", "furniture", "household"],
    }
    
    search_text = " ".join(tags + [name]).lower()
    
    for category, keywords in category_keywords.items():
        if any(kw in search_text for kw in keywords):
            return category
    
    return "other"


@router.get("", response_model=ItemsListResponse)
async def list_items(
    current_user: AuthenticatedUser = Depends(get_current_user),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List all items for the authenticated user.
    
    Returns all things stored in the user's spatial memory graph.
    Uses user_id property for efficient filtering.
    """
    user_id = _get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        with gs._driver.session() as session:
            # Query using user_id property on Thing (more efficient than traversing OWNS)
            result = session.run(
                """
                MATCH (t:Thing {user_id: $user_id})
                OPTIONAL MATCH (t)-[:LOCATED_IN]->(p:Place {user_id: $user_id})
                RETURN t, p, t.created_at AS created_at
                ORDER BY created_at DESC
                SKIP $offset LIMIT $limit
                """,
                user_id=user_id,
                offset=offset,
                limit=limit
            )
            
            items = []
            for record in result:
                node = record["t"]
                place = record["p"]
                
                if not node:
                    continue
                
                tags = list(node.get("tags", []))
                name = node.get("name", "Unnamed")
                
                item = ItemResponse(
                    id=node["id"],
                    name=name,
                    description=node.get("description"),
                    tags=tags,
                    location=place["name"] if place else None,
                    location_path=gs.get_location_path(node["id"]) if place else None,
                    category=_infer_category(tags, name),
                )
                items.append(item)
    
    return ItemsListResponse(items=items, count=len(items))


@router.get("/search", response_model=ItemsListResponse)
async def search_items(
    q: str = Query(..., min_length=1, description="Search query"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    limit: int = Query(default=20, le=50),
):
    """Search items by name, description, or tags.
    
    Performs a fuzzy search across the user's stored things.
    """
    user_id = _get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        result = gs.find_thing(q)
        
        items = []
        for thing in result.get("things", []):
            tags = thing.get("tags", [])
            name = thing["name"]
            
            item = ItemResponse(
                id=thing["id"],
                name=name,
                description=thing.get("description"),
                tags=tags,
                location=thing.get("location"),
                location_path=thing.get("location_path"),
                category=_infer_category(tags, name),
            )
            items.append(item)
    
    return ItemsListResponse(items=items[:limit], count=len(items[:limit]))


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Get a single item by ID.
    
    Returns details for a specific thing.
    Uses user_id property for efficient access control.
    """
    user_id = _get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        with gs._driver.session() as session:
            # Use user_id property for filtering (more efficient)
            result = session.run(
                """
                MATCH (t:Thing {id: $item_id, user_id: $user_id})
                OPTIONAL MATCH (t)-[:LOCATED_IN]->(p:Place {user_id: $user_id})
                RETURN t, p
                """,
                user_id=user_id,
                item_id=item_id
            )
            
            record = result.single()
            if not record:
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="Item not found")
            
            node = record["t"]
            place = record["p"]
            
            tags = list(node.get("tags", []))
            name = node["name"]
            
            return ItemResponse(
                id=node["id"],
                name=name,
                description=node.get("description"),
                tags=tags,
                location=place["name"] if place else None,
                location_path=gs.get_location_path(node["id"]) if place else None,
                category=_infer_category(tags, name),
            )
