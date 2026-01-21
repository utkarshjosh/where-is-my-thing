"""Graph service for Neo4j operations.

Provides cognitive operations over the spatial memory graph:
- remember_thing: Create thing + place hierarchy
- move_thing: Update location
- find_thing: Query by name/description/tags
- associate_things: Create RELATED_TO edges
- get_location_path: Traverse to root

CRITICAL: User Isolation
========================
All operations are user-scoped. The user_id parameter is REQUIRED.
- Things have user_id property + OWNS relationship from User
- Places have user_id property (each user has their own places)
- All queries filter by user_id

Never call methods without a valid user_id - this would leak data between users.
"""
from typing import Optional
from neo4j import GraphDatabase, Driver
from models import Thing, Place, PlaceType, NodeLabel, RelationType
from config import get_settings


class GraphService:
    """Neo4j wrapper with cognitive operations for spatial memory.
    
    All operations are scoped to a specific user via the user_id parameter.
    This ensures per-user data isolation - users can only access their own things.
    """
    
    def __init__(self, user_id: str, driver: Optional[Driver] = None):
        """Initialize with user_id for data isolation and optional driver.
        
        Args:
            user_id: The internal User ID (UUID) for data isolation. REQUIRED.
            driver: Optional Neo4j driver. If not provided, uses shared pool.
            
        Raises:
            ValueError: If user_id is not provided
        """
        if not user_id:
            raise ValueError("user_id is required for GraphService - cannot operate without user context")
        
        self.user_id = user_id
        if driver:
            self._driver = driver
            self._owns_driver = False  # Don't close shared drivers
        else:
            # Use shared driver pool for better performance
            from services.db_pool import get_neo4j_driver
            self._driver = get_neo4j_driver()
            self._owns_driver = False  # Shared pool manages lifecycle
    
    def close(self):
        """Close the driver connection if we own it."""
        # Only close if we created this driver (not from pool)
        if hasattr(self, '_owns_driver') and self._owns_driver:
            self._driver.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
    
    # ========== Place Operations ==========
    
    def find_or_create_place(
        self, 
        name: str, 
        place_type: PlaceType,
        parent_id: Optional[str] = None
    ) -> Place:
        """Find existing place by name (user-scoped) or create new one."""
        with self._driver.session() as session:
            # Try to find existing place FOR THIS USER
            result = session.run(
                """
                MATCH (p:Place {user_id: $user_id, name: $name, place_type: $place_type})
                RETURN p
                """,
                user_id=self.user_id,
                name=name.strip(),
                place_type=place_type.value
            )
            record = result.single()
            
            if record:
                node = record["p"]
                return Place(
                    id=node["id"],
                    user_id=node["user_id"],
                    name=node["name"],
                    place_type=PlaceType(node["place_type"]),
                    description=node.get("description"),
                    parent_id=node.get("parent_id")
                )
            
            # Create new place for this user
            place = Place(
                user_id=self.user_id,
                name=name.strip(), 
                place_type=place_type, 
                parent_id=parent_id
            )
            session.run(
                """
                CREATE (p:Place {
                    id: $id,
                    user_id: $user_id,
                    name: $name,
                    place_type: $place_type,
                    description: $description,
                    parent_id: $parent_id,
                    created_at: datetime()
                })
                """,
                id=place.id,
                user_id=self.user_id,
                name=place.name,
                place_type=place.place_type.value,
                description=place.description,
                parent_id=place.parent_id
            )
            
            # Link to parent if exists
            if parent_id:
                session.run(
                    """
                    MATCH (parent:Place {id: $parent_id, user_id: $user_id})
                    MATCH (child:Place {id: $child_id, user_id: $user_id})
                    MERGE (parent)-[:CONTAINS]->(child)
                    """,
                    parent_id=parent_id,
                    child_id=place.id,
                    user_id=self.user_id
                )
            
            return place
    
    def parse_location_path(self, location_string: str) -> list[tuple[str, PlaceType]]:
        """Parse location string into (name, type) tuples.
        
        Examples:
            "Living Room > TV Unit > Blue Box" -> 
                [("Living Room", ROOM), ("TV Unit", ZONE), ("Blue Box", CONTAINER)]
            "Bedroom drawer" ->
                [("Bedroom", ROOM), ("drawer", CONTAINER)]
        """
        # Split by common separators
        parts = []
        for sep in [" > ", " -> ", " / ", " - "]:
            if sep in location_string:
                parts = [p.strip() for p in location_string.split(sep)]
                break
        
        if not parts:
            # Single location or space-separated
            parts = [location_string.strip()]
        
        # Assign types based on position in hierarchy
        result = []
        for i, part in enumerate(parts):
            if i == 0:
                place_type = PlaceType.ROOM
            elif i == len(parts) - 1:
                place_type = PlaceType.CONTAINER
            else:
                place_type = PlaceType.ZONE
            result.append((part, place_type))
        
        return result
    
    def create_location_hierarchy(self, location_string: str) -> Place:
        """Create full location hierarchy from string, return leaf place."""
        path = self.parse_location_path(location_string)
        
        parent_id = None
        leaf_place = None
        
        for name, place_type in path:
            place = self.find_or_create_place(name, place_type, parent_id)
            parent_id = place.id
            leaf_place = place
        
        return leaf_place
    
    # ========== Thing Operations ==========
    
    def remember_thing(
        self,
        thing_name: str,
        location: str,
        description: Optional[str] = None,
        tags: Optional[list[str]] = None
    ) -> dict:
        """Store a new thing at the specified location.
        
        Creates the thing node, location hierarchy, and LOCATED_IN relationship.
        Also creates OWNS relationship to the user.
        """
        tags = tags or []
        
        # Check if thing already exists FOR THIS USER
        matches = self.find_thing_by_name(thing_name)
        
        if len(matches) > 1:
            return {
                "status": "error",
                "error_type": "ambiguity",
                "message": f"Multiple items match '{thing_name}': {[m['name'] for m in matches]}. Please be more specific.",
                "matches": matches
            }
            
        if matches:
            existing = matches[0]
            # Update description and tags if provided
            if description is not None or tags is not None:
                with self._driver.session() as session:
                    query = "MATCH (t:Thing {id: $id, user_id: $user_id}) SET t.updated_at = datetime()"
                    params = {"id": existing["id"], "user_id": self.user_id}
                    if description is not None:
                        query += ", t.description = $description"
                        params["description"] = description
                    if tags is not None:
                        query += ", t.tags = $tags"
                        params["tags"] = tags
                    session.run(query, **params)
            
            # Update location
            result = self.move_thing(thing_name, location)
            
            # Mark as updated if metadata changed
            if result.get("action") == "no_change" and (description is not None or tags is not None):
                result["action"] = "updated"
                result["message"] = f"Updated metadata for '{thing_name}'"
            
            return result
        
        # Create location hierarchy
        leaf_place = self.create_location_hierarchy(location)
        
        # Create thing with user_id
        thing = Thing(
            user_id=self.user_id,
            name=thing_name.strip(),
            description=description,
            tags=tags
        )
        
        # Build embedding text for semantic search
        embedding_text = f"{thing.name}. {description or ''}. Tags: {', '.join(tags)}. Location: {location}"
        
        with self._driver.session() as session:
            # Create thing node with user_id
            session.run(
                """
                CREATE (t:Thing {
                    id: $id,
                    user_id: $user_id,
                    name: $name,
                    description: $description,
                    tags: $tags,
                    embedding_text: $embedding_text,
                    created_at: datetime(),
                    updated_at: datetime()
                })
                """,
                id=thing.id,
                user_id=self.user_id,
                name=thing.name,
                description=thing.description,
                tags=thing.tags,
                embedding_text=embedding_text
            )
            
            # Create LOCATED_IN relationship
            session.run(
                """
                MATCH (t:Thing {id: $thing_id, user_id: $user_id})
                MATCH (p:Place {id: $place_id, user_id: $user_id})
                MERGE (t)-[:LOCATED_IN]->(p)
                """,
                thing_id=thing.id,
                place_id=leaf_place.id,
                user_id=self.user_id
            )
            
            # Create OWNS relationship from User to Thing
            session.run(
                """
                MATCH (u:User {id: $user_id})
                MATCH (t:Thing {id: $thing_id, user_id: $user_id})
                MERGE (u)-[:OWNS]->(t)
                """,
                user_id=self.user_id,
                thing_id=thing.id
            )
        
        location_path = self.get_location_path(thing.id)
        
        # Embed the thing for semantic search
        try:
            from services.memory_service import MemoryService
            with MemoryService() as ms:
                profile_text = ms.build_profile_text(
                    name=thing.name,
                    description=description,
                    tags=tags,
                    location_path=location_path
                )
                ms.embed_thing(thing.id, profile_text)
        except Exception as e:
            # Log but don't fail if embedding fails
            print(f"Warning: Failed to embed thing '{thing.name}': {e}")
        
        return {
            "status": "success",
            "action": "created",
            "thing_id": thing.id,
            "thing_name": thing.name,
            "location_path": location_path,
            "message": f"Stored new item '{thing.name}' in {location_path}"
        }
    
    def find_thing_by_name(self, name: str) -> list[dict]:
        """Find things by exact or fuzzy name match (user-scoped).
        
        Returns a list of all matching things FOR THE CURRENT USER.
        Prioritizes exact matches: if exact matches exist, only they are returned.
        If no exact matches, returns items where name CONTAINS the search term.
        """
        with self._driver.session() as session:
            # First try exact matches - user-scoped
            result = session.run(
                """
                MATCH (t:Thing {user_id: $user_id})
                WHERE toLower(t.name) = toLower($name)
                RETURN t
                """,
                user_id=self.user_id,
                name=name.strip()
            )
            
            records = list(result)
            if records:
                return [
                    {
                        "id": r["t"]["id"],
                        "name": r["t"]["name"],
                        "description": r["t"].get("description"),
                        "tags": list(r["t"].get("tags", [])),
                        "location_path": self.get_location_path(r["t"]["id"])
                    }
                    for r in records
                ]
            
            # If no exact match, try fuzzy match (CONTAINS) - user-scoped
            result = session.run(
                """
                MATCH (t:Thing {user_id: $user_id})
                WHERE toLower(t.name) CONTAINS toLower($name)
                RETURN t
                """,
                user_id=self.user_id,
                name=name.strip()
            )
            
            records = list(result)
            return [
                {
                    "id": r["t"]["id"],
                    "name": r["t"]["name"],
                    "description": r["t"].get("description"),
                    "tags": list(r["t"].get("tags", [])),
                    "location_path": self.get_location_path(r["t"]["id"])
                }
                for r in records
            ]
    
    def find_thing(self, search_query: str) -> dict:
        """Find things matching a query using semantic (vector) search.
        
        Uses embedding-based similarity search for fuzzy matching.
        Always user-scoped - only returns things for current user.
        """
        from services.memory_service import MemoryService
        
        with MemoryService() as ms:
            results = ms.semantic_search(
                query=search_query.strip(),
                user_id=self.user_id,
                limit=10
            )
        
        things = []
        for r in results:
            thing_data = {
                "id": r.get("id"),
                "name": r.get("name"),
                "description": r.get("description"),
                "tags": list(r.get("tags") or []),
                "location": r.get("location"),
                "similarity_score": r.get("score")
            }
            
            # Get full location path
            if r.get("id"):
                thing_data["location_path"] = self.get_location_path(r["id"])
            
            things.append(thing_data)
        
        if things:
            return {
                "status": "success",
                "count": len(things),
                "things": things,
                "message": f"Found {len(things)} item(s) matching '{search_query}'"
            }
        else:
            return {
                "status": "not_found",
                "count": 0,
                "things": [],
                "message": f"No items found matching '{search_query}'"
            }
    
    def move_thing(self, thing_name: str, new_location: str) -> dict:
        """Move a thing to a new location."""
        # Find the thing (user-scoped)
        matches = self.find_thing_by_name(thing_name)
        
        if not matches:
            return {
                "status": "error",
                "message": f"Thing '{thing_name}' not found"
            }
            
        if len(matches) > 1:
            return {
                "status": "error",
                "error_type": "ambiguity",
                "message": f"Multiple items match '{thing_name}': {[m['name'] for m in matches]}. Which one do you want to move?",
                "matches": matches
            }
            
        thing = matches[0]
        thing_id = thing["id"]
        
        # Get old location
        old_location = self._get_current_location(thing_id)
        
        # Create new location hierarchy
        new_place = self.create_location_hierarchy(new_location)
        
        # Check if location actually changed
        if old_location and old_location["id"] == new_place.id:
            return {
                "status": "success",
                "action": "no_change",
                "thing_name": thing["name"],
                "location": self.get_location_path(thing_id),
                "message": f"'{thing['name']}' is already in {self.get_location_path(thing_id)}"
            }
        
        with self._driver.session() as session:
            # Remove old LOCATED_IN relationship
            session.run(
                """
                MATCH (t:Thing {id: $thing_id, user_id: $user_id})-[r:LOCATED_IN]->()
                DELETE r
                """,
                thing_id=thing_id,
                user_id=self.user_id
            )
            
            # Create new LOCATED_IN relationship
            session.run(
                """
                MATCH (t:Thing {id: $thing_id, user_id: $user_id})
                MATCH (p:Place {id: $place_id, user_id: $user_id})
                MERGE (t)-[:LOCATED_IN]->(p)
                SET t.updated_at = datetime()
                """,
                thing_id=thing_id,
                place_id=new_place.id,
                user_id=self.user_id
            )
        
        new_path = self.get_location_path(thing_id)
        
        # Re-index for semantic search (location changed)
        self._reindex_thing(thing_id)
        
        return {
            "status": "success",
            "action": "moved",
            "thing_name": thing["name"],
            "old_location": old_location.get("name") if old_location else "unknown",
            "new_location": new_path,
            "message": f"Moved '{thing['name']}' from {old_location.get('name') if old_location else 'unknown'} to {new_path}"
        }
    
    def _get_current_location(self, thing_id: str) -> Optional[dict]:
        """Get the current location of a thing (user-scoped)."""
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (t:Thing {id: $thing_id, user_id: $user_id})-[:LOCATED_IN]->(p:Place)
                RETURN p
                """,
                thing_id=thing_id,
                user_id=self.user_id
            )
            record = result.single()
            if record:
                node = record["p"]
                return {
                    "id": node["id"],
                    "name": node["name"],
                    "type": node.get("place_type")
                }
            return None
    
    def get_location_path(self, thing_id: str) -> str:
        """Get full location path from thing to room (user-scoped)."""
        with self._driver.session() as session:
            # First get the direct location
            result = session.run(
                """
                MATCH (t:Thing {id: $thing_id, user_id: $user_id})-[:LOCATED_IN]->(leaf:Place)
                OPTIONAL MATCH path = (leaf)<-[:CONTAINS*]-(ancestor:Place {user_id: $user_id})
                WITH leaf, ancestor
                ORDER BY CASE ancestor.place_type 
                    WHEN 'room' THEN 0 
                    WHEN 'zone' THEN 1 
                    WHEN 'container' THEN 2 
                    ELSE 3 
                END
                RETURN leaf, collect(ancestor.name) AS ancestors
                """,
                thing_id=thing_id,
                user_id=self.user_id
            )
            record = result.single()
            if record:
                leaf = record["leaf"]
                ancestors = record["ancestors"] or []
                # Build path from room down to leaf
                path_parts = list(reversed(ancestors)) + [leaf["name"]]
                return " → ".join(path_parts)
            return "unknown location"

    def _reindex_thing(self, thing_id: str):
        """Re-generate and store embedding for a thing.
        
        Fetches all relevant data from the graph to build a fresh profile.
        """
        try:
            from services.memory_service import MemoryService
            with self._driver.session() as session:
                result = session.run(
                    """
                    MATCH (t:Thing {id: $id, user_id: $user_id})
                    OPTIONAL MATCH (t)-[:USED_FOR]->(i:Intent)
                    RETURN t.name as name, 
                           t.description as description, 
                           t.tags as tags, 
                           i.name as intent
                    LIMIT 1
                    """,
                    id=thing_id,
                    user_id=self.user_id
                )
                record = result.single()
                if not record:
                    return
                
                location_path = self.get_location_path(thing_id)
                
                with MemoryService() as ms:
                    profile_text = ms.build_profile_text(
                        name=record["name"],
                        description=record["description"],
                        tags=list(record["tags"] or []),
                        location_path=location_path,
                        intent=record["intent"]
                    )
                    ms.embed_thing(thing_id, profile_text)
        except Exception as e:
            print(f"Warning: Failed to re-index thing '{thing_id}': {e}")
    
    def associate_things(
        self, 
        thing1_name: str, 
        thing2_name: str,
        relationship: Optional[str] = None
    ) -> dict:
        """Create a RELATED_TO relationship between two things (user-scoped)."""
        matches1 = self.find_thing_by_name(thing1_name)
        matches2 = self.find_thing_by_name(thing2_name)
        
        if not matches1:
            return {"status": "error", "message": f"'{thing1_name}' not found"}
        if len(matches1) > 1:
            return {"status": "error", "message": f"Ambiguous: multiple items match '{thing1_name}'", "matches": matches1}
            
        if not matches2:
            return {"status": "error", "message": f"'{thing2_name}' not found"}
        if len(matches2) > 1:
            return {"status": "error", "message": f"Ambiguous: multiple items match '{thing2_name}'", "matches": matches2}
            
        thing1 = matches1[0]
        thing2 = matches2[0]
        
        with self._driver.session() as session:
            session.run(
                """
                MATCH (t1:Thing {id: $id1, user_id: $user_id})
                MATCH (t2:Thing {id: $id2, user_id: $user_id})
                MERGE (t1)-[r:RELATED_TO]->(t2)
                SET r.description = $relationship
                """,
                id1=thing1["id"],
                id2=thing2["id"],
                user_id=self.user_id,
                relationship=relationship
            )
        
        return {
            "status": "success",
            "message": f"Linked '{thing1['name']}' with '{thing2['name']}'"
        }
    
    def list_contents(self, location: Optional[str] = None) -> dict:
        """List all things in a location (including sub-locations).
        
        If location is None, lists all things for the user.
        All queries are user-scoped.
        """
        with self._driver.session() as session:
            if not location:
                # List all things for user
                result = session.run(
                    """
                    MATCH (t:Thing {user_id: $user_id})
                    OPTIONAL MATCH (t)-[:LOCATED_IN]->(p:Place)
                    RETURN t, p
                    ORDER BY t.created_at DESC
                    LIMIT 50
                    """,
                    user_id=self.user_id
                )
                place_name = "All locations"
            else:
                # Find things in this place OR its sub-places (user-scoped)
                result = session.run(
                    """
                    MATCH (p:Place {user_id: $user_id})
                    WHERE toLower(p.name) CONTAINS toLower($location)
                    WITH p
                    MATCH (t:Thing {user_id: $user_id})-[:LOCATED_IN]->(:Place {user_id: $user_id})<-[:CONTAINS*0..]-(p)
                    RETURN DISTINCT t, p
                    LIMIT 50
                    """,
                    location=location.strip(),
                    user_id=self.user_id
                )
                place_name = location

            things = []
            final_place_name = place_name
            for record in result:
                node = record["t"]
                place = record["p"]
                if place and not location:
                    final_place_name = "Global"
                elif place and location:
                    final_place_name = place["name"]
                
                thing_data = {
                    "name": node["name"],
                    "description": node.get("description"),
                    "tags": list(node.get("tags", []))
                }
                
                # Add location path
                thing_data["location_path"] = self.get_location_path(node["id"])
                things.append(thing_data)
            
            if things:
                return {
                    "status": "success",
                    "location": final_place_name,
                    "count": len(things),
                    "things": things,
                    "message": f"Found {len(things)} item(s) in '{final_place_name}'"
                }
            else:
                return {
                    "status": "empty",
                    "location": location or "all locations",
                    "count": 0,
                    "things": [],
                    "message": f"No items found in '{location or 'all locations'}'"
                }

    def list_places(self) -> dict:
        """List all places used by the user."""
        with self._driver.session() as session:
            # Find all places for this user
            result = session.run(
                """
                MATCH (p:Place {user_id: $user_id})
                RETURN p.name as name, p.place_type as type
                ORDER BY CASE p.place_type 
                    WHEN 'room' THEN 0 
                    WHEN 'zone' THEN 1 
                    WHEN 'container' THEN 2 
                    ELSE 3 
                END, p.name
                """,
                user_id=self.user_id
            )
            
            places = [dict(r) for r in result]
            
            return {
                "status": "success",
                "count": len(places),
                "places": places,
                "message": f"Found {len(places)} location(s)"
            }
    
    def attach_intent(self, thing_name: str, intent_name: str, description: Optional[str] = None) -> dict:
        """Attach an intent/purpose to a thing (user-scoped)."""
        matches = self.find_thing_by_name(thing_name)
        if not matches:
            return {"status": "error", "message": f"'{thing_name}' not found"}
        if len(matches) > 1:
             return {"status": "error", "message": f"Ambiguous: multiple items match '{thing_name}'", "matches": matches}
             
        thing = matches[0]
        
        with self._driver.session() as session:
            # Find or create intent (intents are shared across users for now)
            result = session.run(
                """
                MERGE (i:Intent {name: $name})
                ON CREATE SET i.id = randomUUID(), i.description = $description, i.created_at = datetime()
                RETURN i
                """,
                name=intent_name.strip(),
                description=description
            )
            intent_node = result.single()["i"]
            
            # Link thing to intent
            session.run(
                """
                MATCH (t:Thing {id: $thing_id, user_id: $user_id})
                MATCH (i:Intent {id: $intent_id})
                MERGE (t)-[:USED_FOR]->(i)
                """,
                thing_id=thing["id"],
                intent_id=intent_node["id"],
                user_id=self.user_id
            )
        
        # Re-index (intent changed)
        self._reindex_thing(thing["id"])
        
        return {
            "status": "success",
            "thing": thing["name"],
            "intent": intent_name,
            "message": f"'{thing['name']}' is now associated with intent: {intent_name}"
        }
