"""Memory service for semantic retrieval using LlamaIndex.

ONLY handles semantic operations:
- Fuzzy semantic search ("travel stuff")
- Similar descriptions
- Memory recall by vibe

Does NOT handle (use GraphService instead):
- Exact location lookup
- Hierarchy traversal
- Relationship queries

Rule: If the answer can be expressed as a Cypher query, don't embed it.
"""
from typing import Optional
from neo4j import GraphDatabase
from core.interfaces import IEmbeddingProvider, EmbeddingResult
from config import get_settings


class MemoryService:
    """Semantic memory layer - embeddings only.
    
    Uses the embedding provider interface for vendor abstraction.
    Stores embeddings with version metadata for re-indexing support.
    """
    
    def __init__(self, embedding_provider: Optional[IEmbeddingProvider] = None):
        """Initialize with optional embedding provider.
        
        Args:
            embedding_provider: Custom provider or defaults to Google
        """
        # Lazy import to avoid circular dependencies
        if embedding_provider is None:
            from adapters.google_embedding import GoogleEmbeddingProvider
            self._embedder = GoogleEmbeddingProvider()
        else:
            self._embedder = embedding_provider
        
        # Use shared Neo4j driver pool
        from services.db_pool import get_neo4j_driver
        self._driver = get_neo4j_driver()
        self._owns_driver = False
    
    def build_profile_text(
        self,
        name: str,
        description: Optional[str] = None,
        tags: Optional[list[str]] = None,
        location_path: Optional[str] = None,
        intent: Optional[str] = None
    ) -> str:
        """Build synthetic profile text for embedding.
        
        Creates a rich text representation that captures:
        - What the thing is
        - Where it's located
        - Why it's kept (intent)
        - Related tags/categories
        """
        parts = [f"Item: {name}"]
        
        if description:
            parts.append(f"Description: {description}")
        
        if tags:
            parts.append(f"Categories: {', '.join(tags)}")
        
        if location_path:
            parts.append(f"Location: {location_path}")
        
        if intent:
            parts.append(f"Purpose: {intent}")
        
        return ". ".join(parts)
    
    def embed_thing(self, thing_id: str, profile_text: str) -> None:
        """Generate and store embedding with version metadata.
        
        Args:
            thing_id: The thing's unique ID
            profile_text: Rich text to embed (from build_profile_text)
        """
        result = self._embedder.embed_text(profile_text)
        
        with self._driver.session() as session:
            session.run("""
                MATCH (t:Thing {id: $thing_id})
                SET t.embedding = $embedding,
                    t.embedding_model = $model,
                    t.embedding_version = $version,
                    t.embedding_text = $profile_text
            """, 
                thing_id=thing_id, 
                embedding=result.vector,
                model=result.model,
                version=result.version,
                profile_text=profile_text
            )
    
    def semantic_search(self, query: str, user_id: str = None, limit: int = 10, min_score: float = 0.55) -> list[dict]:
        """Fuzzy semantic search - for 'vibes' and similar descriptions.
        
        Use this for queries like:
        - "travel stuff"
        - "electronics I don't use often"
        - "things for emergencies"
        
        Args:
            query: Search term or phrase
            user_id: REQUIRED for production - only returns things for this user
            limit: Maximum results to return
            min_score: Minimum similarity score threshold (0.0 to 1.0, default 0.55)
        
        Returns list of matching things with similarity scores.
        Only returns results that are semantically relevant.
        If there's a clear "winner" (top result much higher than others), 
        filters out lower-scoring results.
        """
        result = self._embedder.embed_query(query)
        
        with self._driver.session() as session:
            if user_id:
                # User-scoped semantic search using user_id property (more efficient)
                records = session.run("""
                    CALL db.index.vector.queryNodes(
                        'thing_embedding', $limit_extra, $embedding
                    ) YIELD node, score
                    WHERE score > $min_score AND node.user_id = $user_id
                    WITH node, score
                    OPTIONAL MATCH (node)-[:LOCATED_IN]->(p:Place {user_id: $user_id})
                    RETURN node.id as id, 
                           node.name as name, 
                           node.description as description,
                           node.tags as tags,
                           p.name as location,
                           score
                    ORDER BY score DESC
                    LIMIT $limit
                """, limit_extra=limit * 3, limit=limit, embedding=result.vector, user_id=user_id, min_score=min_score)
            else:
                # No user filter - only for testing/admin
                # WARNING: In production, always provide user_id
                records = session.run("""
                    CALL db.index.vector.queryNodes(
                        'thing_embedding', $limit, $embedding
                    ) YIELD node, score
                    WHERE score > $min_score
                    WITH node, score
                    OPTIONAL MATCH (node)-[:LOCATED_IN]->(p:Place)
                    RETURN node.id as id, 
                           node.name as name, 
                           node.description as description,
                           node.tags as tags,
                           p.name as location,
                           score
                    ORDER BY score DESC
                """, limit=limit, embedding=result.vector, min_score=min_score)
            
            results = [dict(r) for r in records]
            
            # Smart filtering: if top result has significantly higher score, 
            # filter out less relevant results
            if len(results) >= 2:
                top_score = results[0].get('score', 0)
                # Keep only results within 0.15 of top score (clear winner filtering)
                results = [r for r in results if r.get('score', 0) >= top_score - 0.15]
            
            return results
    
    def find_similar(self, thing_id: str, limit: int = 5) -> list[dict]:
        """Find things semantically similar to a given thing.
        
        Useful for discovering related items that might go together.
        """
        with self._driver.session() as session:
            # Get the thing's existing embedding
            record = session.run("""
                MATCH (t:Thing {id: $thing_id})
                RETURN t.embedding as embedding, t.name as source_name
            """, thing_id=thing_id).single()
            
            if not record or not record["embedding"]:
                return []
            
            # Find similar things (exclude self)
            records = session.run("""
                CALL db.index.vector.queryNodes(
                    'thing_embedding', $limit_plus, $embedding
                ) YIELD node, score
                WHERE node.id <> $thing_id AND score > 0.6
                RETURN node.id as id, 
                       node.name as name, 
                       node.description as description,
                       score as similarity
                ORDER BY score DESC
                LIMIT $limit
            """, 
                limit_plus=limit + 1,
                limit=limit, 
                embedding=record["embedding"], 
                thing_id=thing_id
            )
            
            return [dict(r) for r in records]
    
    def get_stale_embeddings(self, current_version: str) -> list[dict]:
        """Find things with outdated embeddings that need re-indexing.
        
        Call this when bumping embedding version to get things needing update.
        """
        with self._driver.session() as session:
            records = session.run("""
                MATCH (t:Thing)
                WHERE t.embedding_version IS NULL 
                   OR t.embedding_version <> $version
                RETURN t.id as id, t.name as name, t.embedding_text as text
            """, version=current_version)
            
            return [dict(r) for r in records]
    
    def close(self):
        """Close Neo4j driver if we own it."""
        if hasattr(self, '_owns_driver') and self._owns_driver:
            self._driver.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()
