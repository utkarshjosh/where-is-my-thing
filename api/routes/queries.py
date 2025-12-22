"""Query routes for semantic and smart search."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services.query_router import QueryRouter
from services.memory_service import MemoryService

router = APIRouter(prefix="/query", tags=["queries"])


class SmartQueryRequest(BaseModel):
    """Request for smart routed query."""
    query: str
    limit: int = 10
    force_semantic: bool = False  # Override routing to always use semantic


class SimilarRequest(BaseModel):
    """Request to find similar things."""
    thing_id: str
    limit: int = 5


@router.post("/smart")
async def smart_query(request: SmartQueryRequest):
    """Smart routed query - automatically picks Neo4j or LlamaIndex.
    
    Uses pattern matching to determine query type:
    - "where is passport" → Graph (Neo4j)
    - "travel stuff" → Semantic (LlamaIndex) → Graph resolve
    
    Set force_semantic=true to always use semantic search.
    """
    if request.force_semantic:
        with MemoryService() as ms:
            results = ms.semantic_search(request.query, request.limit)
        return {
            "status": "success",
            "count": len(results),
            "things": results,
            "route": "semantic (forced)"
        }
    
    query_router = QueryRouter()
    return query_router.route(request.query)


@router.post("/similar/{thing_id}")
async def find_similar(thing_id: str, limit: int = 5):
    """Find things semantically similar to a given thing.
    
    Useful for discovering related items that might go together.
    """
    with MemoryService() as ms:
        results = ms.find_similar(thing_id, limit)
    
    return {
        "status": "success",
        "count": len(results),
        "things": results,
    }


@router.get("/explain")
async def explain_route(query: str):
    """Debug endpoint: explain which route would be used for a query."""
    query_router = QueryRouter()
    explanation = query_router.explain_route(query)
    return {"explanation": explanation}
