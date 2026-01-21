"""Query router - enforces Neo4j vs LlamaIndex boundaries.

Prevents:
- Double storage
- Double latency
- Double confusion
- Fake intelligence

The rule: If the answer can be expressed as a Cypher query, don't embed it.

NOTE: This router requires user_id for proper data isolation.
"""
from typing import Optional
from services.graph_service import GraphService
from services.memory_service import MemoryService


class QueryRouter:
    """Routes queries to the appropriate system.
    
    Query Routing:
    - Exact location / containment → Neo4j
    - Hierarchy, regrouping → Neo4j
    - "Where did I keep X?" (fuzzy) → LlamaIndex → Neo4j
    - Similar past descriptions → LlamaIndex
    - Reasoning over relations → Neo4j
    - Memory recall by vibe → LlamaIndex
    
    IMPORTANT: user_id is required for proper data isolation.
    """
    
    # Keywords indicating a graph query (Neo4j)
    GRAPH_PATTERNS = [
        "where is", "where's", "find", "in the", "inside", "contains",
        "what's in", "hierarchy", "moved to", "related to",
        "location of", "path to", "show me", "list",
    ]
    
    # Keywords indicating semantic query (LlamaIndex)
    SEMANTIC_PATTERNS = [
        "like", "similar to", "stuff", "things for", "kind of",
        "remember when", "vibe", "category", "related", "type of",
        "anything", "something", "whatever",
    ]
    
    def __init__(self, user_id: Optional[str] = None):
        """Initialize with user_id for data isolation.
        
        Args:
            user_id: Internal user UUID. Required for proper data isolation.
        """
        self.user_id = user_id
    
    def route(self, query: str) -> dict:
        """Route query to appropriate system and execute.
        
        Returns results with 'route' metadata indicating which path was used.
        """
        query_lower = query.lower()
        
        # Check for patterns
        is_graph = any(p in query_lower for p in self.GRAPH_PATTERNS)
        is_semantic = any(p in query_lower for p in self.SEMANTIC_PATTERNS)
        
        # Decision logic
        if is_graph and not is_semantic:
            # Clear graph query
            return self._graph_search(query)
        elif is_semantic and not is_graph:
            # Clear semantic query
            return self._semantic_then_resolve(query)
        elif is_semantic and is_graph:
            # Mixed - semantic is likely dominant
            return self._semantic_then_resolve(query)
        else:
            # No clear pattern - try graph first, fall back to semantic
            result = self._graph_search(query)
            if result.get("count", 0) == 0:
                result = self._semantic_then_resolve(query)
                result["route"] = "graph→semantic (fallback)"
            return result
    
    def _graph_search(self, query: str) -> dict:
        """Direct graph search using Neo4j."""
        if not self.user_id:
            return {
                "status": "error",
                "count": 0,
                "things": [],
                "route": "graph",
                "message": "User context required for search"
            }
        
        with GraphService(user_id=self.user_id) as gs:
            result = gs.find_thing(query)
        result["route"] = "graph"
        return result
    
    def _semantic_then_resolve(self, query: str) -> dict:
        """Semantic search, then resolve locations via graph.
        
        LlamaIndex finds semantically matching things,
        then Neo4j resolves their current locations.
        """
        with MemoryService() as ms:
            semantic_results = ms.semantic_search(query, user_id=self.user_id)
        
        if not semantic_results:
            return {
                "status": "not_found",
                "count": 0,
                "things": [],
                "route": "semantic",
                "message": f"No semantic matches for '{query}'"
            }
        
        if not self.user_id:
            # Return semantic results without graph resolution
            return {
                "status": "success",
                "count": len(semantic_results),
                "things": semantic_results,
                "route": "semantic (no graph)",
                "message": f"Found {len(semantic_results)} semantically matching items"
            }
        
        # Resolve full location paths from graph
        with GraphService(user_id=self.user_id) as gs:
            things = []
            for r in semantic_results:
                location_path = gs.get_location_path(r["id"])
                things.append({
                    "id": r["id"],
                    "name": r["name"],
                    "description": r.get("description"),
                    "tags": r.get("tags", []),
                    "location_path": location_path,
                    "similarity_score": r.get("score"),
                })
            
            return {
                "status": "success",
                "count": len(things),
                "things": things,
                "route": "semantic→graph",
                "message": f"Found {len(things)} semantically matching items"
            }
    
    def explain_route(self, query: str) -> str:
        """Explain which route would be used for a query (for debugging)."""
        query_lower = query.lower()
        
        graph_matches = [p for p in self.GRAPH_PATTERNS if p in query_lower]
        semantic_matches = [p for p in self.SEMANTIC_PATTERNS if p in query_lower]
        
        explanation = f"Query: '{query}'\n"
        explanation += f"Graph patterns matched: {graph_matches}\n"
        explanation += f"Semantic patterns matched: {semantic_matches}\n"
        
        if graph_matches and not semantic_matches:
            explanation += "Decision: Graph (Neo4j)"
        elif semantic_matches:
            explanation += "Decision: Semantic (LlamaIndex → Neo4j)"
        else:
            explanation += "Decision: Graph first, fallback to Semantic"
        
        return explanation
