"""Graph routes for Neo4j visualization data."""
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.middleware.auth import get_current_user, AuthenticatedUser
from services.graph_service import GraphService
from services.user_service import UserService


router = APIRouter(prefix="/graph", tags=["graph"])


class GraphNode(BaseModel):
    """A node in the graph visualization."""
    id: str
    label: str
    type: str  # 'thing', 'place', 'intent'
    category: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None


class GraphEdge(BaseModel):
    """An edge in the graph visualization."""
    source: str  # Using 'source' and 'target' for force-graph compatibility
    target: str
    type: str  # 'LOCATED_IN', 'CONTAINS', 'RELATED_TO', 'USED_FOR', 'OWNS'


class GraphData(BaseModel):
    """Complete graph data for visualization."""
    nodes: list[GraphNode]
    edges: list[GraphEdge]


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


def _infer_category(tags: list, node_type: str, name: str) -> str:
    """Infer category for visualization coloring."""
    if node_type == "place":
        return "home"
    if node_type == "intent":
        return "personal"
    
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


@router.get("", response_model=GraphData)
async def get_graph(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Get complete graph data for visualization.
    
    Returns all nodes (things, places, intents) and edges (relationships)
    for the authenticated user's spatial memory graph.
    """
    user_id = _get_user_id(current_user)
    
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    seen_nodes: set[str] = set()
    
    with GraphService(user_id=user_id) as gs:
        with gs._driver.session() as session:
            # Check if user exists first
            user_exists = session.run(
                """
                MATCH (u:User {id: $user_id})
                RETURN count(u) AS user_count
                """,
                user_id=user_id
            )
            if user_exists.single()["user_count"] == 0:
                return GraphData(nodes=nodes, edges=edges)
            
            # Check if any Thing nodes exist at all (avoids relationship type warning)
            # If no Things exist in the database, return early
            thing_check = session.run(
                """
                MATCH (t:Thing)
                RETURN count(t) AS thing_count
                LIMIT 1
                """,
            )
            if thing_check.single()["thing_count"] == 0:
                return GraphData(nodes=nodes, edges=edges)
            
            # Get all things owned by user
            # Query may warn if OWNS relationship type doesn't exist yet - that's okay
            things_result = session.run(
                """
                MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing)
                RETURN t
                """,
                user_id=user_id
            )
            thing_records = list(things_result)
            
            # Fallback: If no things found with OWNS relationship, check for all Things
            # This handles backward compatibility for data created before OWNS relationships existed
            if not thing_records:
                # Get all Things (they might not have OWNS relationships yet)
                all_things = session.run(
                    """
                    MATCH (t:Thing)
                    RETURN t
                    LIMIT 100
                    """,
                )
                orphan_records = list(all_things)
                
                if orphan_records:
                    # Backfill: Create OWNS relationships for all Things
                    # This ensures all Things are associated with the current user
                    for record in orphan_records:
                        thing_node = record["t"]
                        session.run(
                            """
                            MATCH (u:User {id: $user_id})
                            MATCH (t:Thing {id: $thing_id})
                            MERGE (u)-[:OWNS]->(t)
                            """,
                            user_id=user_id,
                            thing_id=thing_node["id"]
                        )
                    
                    # Now query again with OWNS relationships
                    things_result = session.run(
                        """
                        MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing)
                        RETURN t
                        """,
                        user_id=user_id
                    )
                    thing_records = list(things_result)
            
            # If still no things exist for this user, return empty graph early to avoid other queries
            if not thing_records:
                return GraphData(nodes=nodes, edges=edges)
            
            for record in thing_records:
                node = record["t"]
                node_id = node["id"]
                if node_id not in seen_nodes:
                    seen_nodes.add(node_id)
                    tags = list(node.get("tags", []))
                    nodes.append(GraphNode(
                        id=node_id,
                        label=node["name"],
                        type="thing",
                        category=_infer_category(tags, "thing", node["name"]),
                    ))
            
            # Get all places connected to user's things
            places_result = session.run(
                """
                MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing)-[:LOCATED_IN]->(p:Place)
                OPTIONAL MATCH (p)<-[:CONTAINS*0..]-(ancestor:Place)
                WITH p, ancestor
                RETURN DISTINCT p, ancestor
                """,
                user_id=user_id
            )
            
            for record in places_result:
                for place in [record["p"], record["ancestor"]]:
                    if place and place["id"] not in seen_nodes:
                        seen_nodes.add(place["id"])
                        nodes.append(GraphNode(
                            id=place["id"],
                            label=place["name"],
                            type="place",
                            category="home",
                        ))
            
            # Get all intents connected to user's things (only if things exist)
            intents_result = session.run(
                """
                MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing)
                OPTIONAL MATCH (t)-[:USED_FOR]->(i:Intent)
                WHERE i IS NOT NULL
                RETURN DISTINCT i
                """,
                user_id=user_id
            )
            
            for record in intents_result:
                intent = record.get("i")
                if intent and intent["id"] not in seen_nodes:
                    seen_nodes.add(intent["id"])
                    nodes.append(GraphNode(
                        id=intent["id"],
                        label=intent["name"],
                        type="intent",
                        category="personal",
                    ))
            
            # Get all relationships
            # LOCATED_IN edges
            located_result = session.run(
                """
                MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing)-[r:LOCATED_IN]->(p:Place)
                RETURN t.id AS source, p.id AS target, type(r) AS rel_type
                """,
                user_id=user_id
            )
            for record in located_result:
                source = record.get("source")
                target = record.get("target")
                rel_type = record.get("rel_type")
                if source and target and rel_type:
                    edges.append(GraphEdge(
                        source=source,
                        target=target,
                        type=rel_type,
                    ))
            
            # CONTAINS edges (place hierarchy) - only if we have places
            if any(n.type == "place" for n in nodes):
                contains_result = session.run(
                    """
                    MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing)-[:LOCATED_IN]->(p:Place)
                    MATCH (parent:Place)-[r:CONTAINS]->(child:Place)
                    WHERE parent.id IN $place_ids OR child.id IN $place_ids
                    RETURN DISTINCT parent.id AS source, child.id AS target, type(r) AS rel_type
                    """,
                    user_id=user_id,
                    place_ids=[nid for nid in seen_nodes]
                )
                for record in contains_result:
                    source = record.get("source")
                    target = record.get("target")
                    rel_type = record.get("rel_type")
                    if source and target and rel_type:
                        edges.append(GraphEdge(
                            source=source,
                            target=target,
                            type=rel_type,
                        ))
            
            # RELATED_TO edges (thing associations) - only if we have things
            related_result = session.run(
                """
                MATCH (u:User {id: $user_id})-[:OWNS]->(t1:Thing)
                MATCH (t1)-[r:RELATED_TO]->(t2:Thing)<-[:OWNS]-(u)
                RETURN t1.id AS source, t2.id AS target, type(r) AS rel_type
                """,
                user_id=user_id
            )
            for record in related_result:
                source = record.get("source")
                target = record.get("target")
                rel_type = record.get("rel_type")
                if source and target and rel_type:
                    edges.append(GraphEdge(
                        source=source,
                        target=target,
                        type=rel_type,
                    ))
            
            # USED_FOR edges (thing to intent) - only if we have things
            used_for_result = session.run(
                """
                MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing)
                MATCH (t)-[r:USED_FOR]->(i:Intent)
                RETURN t.id AS source, i.id AS target, type(r) AS rel_type
                """,
                user_id=user_id
            )
            for record in used_for_result:
                source = record.get("source")
                target = record.get("target")
                rel_type = record.get("rel_type")
                if source and target and rel_type:
                    edges.append(GraphEdge(
                        source=source,
                        target=target,
                        type=rel_type,
                    ))
    
    return GraphData(nodes=nodes, edges=edges)


@router.get("/nodes", response_model=list[GraphNode])
async def get_nodes(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Get just the nodes for graph visualization."""
    graph_data = await get_graph(current_user)
    return graph_data.nodes


@router.get("/edges", response_model=list[GraphEdge])
async def get_edges(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Get just the edges for graph visualization."""
    graph_data = await get_graph(current_user)
    return graph_data.edges
