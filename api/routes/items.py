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


# Map item_type (from canonical service) to UI category
ITEM_TYPE_TO_CATEGORY = {
    "keys": "keys",
    "book": "books",
    "document": "documents",
    "electronic": "electronics",
    "clothing": "personal",
    "tool": "home",
    "personal": "personal",
    "misc": "other",
}


def _get_category(item_type: Optional[str], tags: list[str], name: str) -> str:
    """Get category from item_type or infer from tags/name.
    
    Priority:
    1. Use item_type if available (from canonical service detection)
    2. Fall back to keyword inference for legacy items without item_type
    """
    # Use item_type if available (stored on Thing from canonical detection)
    if item_type:
        return ITEM_TYPE_TO_CATEGORY.get(item_type, "other")
    
    # Fallback: infer from keywords for legacy items
    category_keywords = {
        "keys": ["key", "keys"],
        "books": ["book", "novel", "textbook", "magazine", "comic", "manga", "journal"],
        "electronics": ["phone", "laptop", "charger", "cable", "electronic", "device", "power"],
        "documents": ["document", "passport", "paper", "file", "certificate", "id"],
        "personal": ["wallet", "glasses", "watch", "jewelry", "bag", "clothing", "shirt", "pants"],
        "home": ["tool", "kitchen", "furniture", "household", "screwdriver", "hammer"],
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
    Optimized: computes location_path in single query (no N+1).
    """
    user_id = _get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        with gs._driver.session() as session:
            # Single query: get things with location path computed inline
            # Avoids N+1 by computing location_path in Cypher
            # Uses aggregation to get the longest path (avoiding duplicates)
            result = session.run(
                """
                MATCH (t:Thing {user_id: $user_id})
                OPTIONAL MATCH (t)-[:LOCATED_IN]->(leaf:Place {user_id: $user_id})
                OPTIONAL MATCH path = (leaf)<-[:CONTAINS*0..]-(ancestor:Place {user_id: $user_id})
                WITH t, leaf,
                     CASE WHEN leaf IS NOT NULL 
                          THEN leaf.name 
                          ELSE null 
                     END as location,
                     CASE WHEN leaf IS NOT NULL
                          THEN reverse(reduce(s = [], n IN nodes(path) | s + n.name))
                          ELSE null
                     END as path_parts,
                     length(path) as path_length
                // Group by thing and select the longest path (most complete hierarchy)
                ORDER BY path_length DESC
                WITH t, location, collect(path_parts)[0] as longest_path_parts
                WITH t, location,
                     CASE WHEN longest_path_parts IS NOT NULL AND size(longest_path_parts) > 0
                          THEN reduce(s = '', i IN range(0, size(longest_path_parts)-1) | 
                               CASE WHEN i = 0 THEN longest_path_parts[i] 
                                    ELSE s + ' → ' + longest_path_parts[i] END)
                          ELSE location
                     END as location_path
                RETURN t.id as id,
                       t.name as name,
                       t.description as description,
                       t.tags as tags,
                       t.item_type as item_type,
                       location,
                       location_path,
                       t.created_at as created_at
                ORDER BY created_at DESC
                SKIP $offset LIMIT $limit
                """,
                user_id=user_id,
                offset=offset,
                limit=limit
            )
            
            items = []
            for record in result:
                tags = list(record["tags"] or [])
                name = record["name"] or "Unnamed"
                item_type = record["item_type"]
                
                item = ItemResponse(
                    id=record["id"],
                    name=name,
                    description=record["description"],
                    tags=tags,
                    location=record["location"],
                    location_path=record["location_path"],
                    category=_get_category(item_type, tags, name),
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
    
    Performs semantic search across the user's stored things.
    """
    user_id = _get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        result = gs.find_thing(q)
        
        # Get item_types for search results in one query
        thing_ids = [t["id"] for t in result.get("things", []) if t.get("id")]
        item_types = {}
        if thing_ids:
            with gs._driver.session() as session:
                type_result = session.run(
                    """
                    MATCH (t:Thing {user_id: $user_id})
                    WHERE t.id IN $ids
                    RETURN t.id as id, t.item_type as item_type
                    """,
                    user_id=user_id,
                    ids=thing_ids
                )
                item_types = {r["id"]: r["item_type"] for r in type_result}
        
        items = []
        for thing in result.get("things", []):
            tags = thing.get("tags", [])
            name = thing["name"]
            thing_id = thing["id"]
            item_type = item_types.get(thing_id)
            
            item = ItemResponse(
                id=thing_id,
                name=name,
                description=thing.get("description"),
                tags=tags,
                location=thing.get("location"),
                location_path=thing.get("location_path"),
                category=_get_category(item_type, tags, name),
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
    Optimized: computes location_path in single query.
    """
    user_id = _get_user_id(current_user)
    
    with GraphService(user_id=user_id) as gs:
        with gs._driver.session() as session:
            # Single query with location_path computed inline
            # Uses aggregation to get the longest path (avoiding duplicates)
            result = session.run(
                """
                MATCH (t:Thing {id: $item_id, user_id: $user_id})
                OPTIONAL MATCH (t)-[:LOCATED_IN]->(leaf:Place {user_id: $user_id})
                OPTIONAL MATCH path = (leaf)<-[:CONTAINS*0..]-(ancestor:Place {user_id: $user_id})
                WITH t, leaf,
                     CASE WHEN leaf IS NOT NULL THEN leaf.name ELSE null END as location,
                     CASE WHEN leaf IS NOT NULL
                          THEN reverse(reduce(s = [], n IN nodes(path) | s + n.name))
                          ELSE null
                     END as path_parts,
                     length(path) as path_length
                // Group by thing and select the longest path (most complete hierarchy)
                ORDER BY path_length DESC
                WITH t, location, collect(path_parts)[0] as longest_path_parts
                WITH t, location,
                     CASE WHEN longest_path_parts IS NOT NULL AND size(longest_path_parts) > 0
                          THEN reduce(s = '', i IN range(0, size(longest_path_parts)-1) | 
                               CASE WHEN i = 0 THEN longest_path_parts[i] 
                                    ELSE s + ' → ' + longest_path_parts[i] END)
                          ELSE location
                     END as location_path
                RETURN t.id as id,
                       t.name as name,
                       t.description as description,
                       t.tags as tags,
                       t.item_type as item_type,
                       location,
                       location_path
                """,
                user_id=user_id,
                item_id=item_id
            )
            
            record = result.single()
            if not record:
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="Item not found")
            
            tags = list(record["tags"] or [])
            name = record["name"]
            item_type = record["item_type"]
            
            return ItemResponse(
                id=record["id"],
                name=name,
                description=record["description"],
                tags=tags,
                location=record["location"],
                location_path=record["location_path"],
                category=_get_category(item_type, tags, name),
            )
