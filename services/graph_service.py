"""Graph service for Neo4j operations.

Provides cognitive operations over the spatial memory graph:
- remember_thing: Create thing + place hierarchy
- move_thing: Update location, create event
- find_thing: Query by name/description/tags
- associate_things: Create RELATED_TO edges
- get_location_path: Traverse to root
"""
from datetime import datetime
from typing import Optional
from neo4j import GraphDatabase, Driver
from models import Thing, Place, Intent, Event, PlaceType, NodeLabel, RelationType
from config import get_settings


class GraphService:
    """Neo4j wrapper with cognitive operations for spatial memory.
    
    All operations are scoped to a specific user via the user_id parameter.
    This ensures per-user data isolation - users can only access their own things.
    """
    
    def __init__(self, user_id: Optional[str] = None, driver: Optional[Driver] = None):
        """Initialize with user_id for data isolation and optional driver.
        
        Args:
            user_id: The internal User ID for data isolation. Required for 
                    most operations. If None, operations will fail on user-scoped data.
            driver: Optional Neo4j driver. If not provided, creates from settings.
        """
        self.user_id = user_id
        if driver:
            self._driver = driver
        else:
            settings = get_settings()
            self._driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_username, settings.neo4j_password)
            )
    
    def close(self):
        """Close the driver connection."""
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
        """Find existing place by name or create new one."""
        with self._driver.session() as session:
            # Try to find existing
            result = session.run(
                """
                MATCH (p:Place {name: $name, place_type: $place_type})
                RETURN p
                """,
                name=name.strip(),
                place_type=place_type.value
            )
            record = result.single()
            
            if record:
                node = record["p"]
                return Place(
                    id=node["id"],
                    name=node["name"],
                    place_type=PlaceType(node["place_type"]),
                    description=node.get("description"),
                    parent_id=node.get("parent_id")
                )
            
            # Create new
            place = Place(name=name.strip(), place_type=place_type, parent_id=parent_id)
            session.run(
                """
                CREATE (p:Place {
                    id: $id,
                    name: $name,
                    place_type: $place_type,
                    description: $description,
                    parent_id: $parent_id,
                    created_at: datetime()
                })
                """,
                id=place.id,
                name=place.name,
                place_type=place.place_type.value,
                description=place.description,
                parent_id=place.parent_id
            )
            
            # Link to parent if exists
            if parent_id:
                session.run(
                    """
                    MATCH (parent:Place {id: $parent_id})
                    MATCH (child:Place {id: $child_id})
                    MERGE (parent)-[:CONTAINS]->(child)
                    """,
                    parent_id=parent_id,
                    child_id=place.id
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
        Also creates an initial 'created' event.
        """
        tags = tags or []
        
        # Check if thing already exists
        existing = self.find_thing_by_name(thing_name)
        if existing:
            # Update location instead
            return self.move_thing(thing_name, location)
        
        # Create location hierarchy
        leaf_place = self.create_location_hierarchy(location)
        
        # Create thing
        thing = Thing(
            name=thing_name.strip(),
            description=description,
            tags=tags
        )
        
        # Build embedding text for semantic search
        embedding_text = f"{thing.name}. {description or ''}. Tags: {', '.join(tags)}. Location: {location}"
        
        with self._driver.session() as session:
            # Create thing node
            session.run(
                """
                CREATE (t:Thing {
                    id: $id,
                    name: $name,
                    description: $description,
                    tags: $tags,
                    embedding_text: $embedding_text,
                    created_at: datetime(),
                    updated_at: datetime()
                })
                """,
                id=thing.id,
                name=thing.name,
                description=thing.description,
                tags=thing.tags,
                embedding_text=embedding_text
            )
            
            # Create LOCATED_IN relationship
            session.run(
                """
                MATCH (t:Thing {id: $thing_id})
                MATCH (p:Place {id: $place_id})
                MERGE (t)-[:LOCATED_IN]->(p)
                """,
                thing_id=thing.id,
                place_id=leaf_place.id
            )
            
            # Create initial event
            event = Event(event_type="created", to_place_id=leaf_place.id)
            session.run(
                """
                CREATE (e:Event {
                    id: $id,
                    event_type: $event_type,
                    timestamp: datetime(),
                    to_place_id: $to_place_id
                })
                WITH e
                MATCH (t:Thing {id: $thing_id})
                MERGE (t)-[:LAST_SEEN]->(e)
                """,
                id=event.id,
                event_type=event.event_type,
                to_place_id=event.to_place_id,
                thing_id=thing.id
            )
            
            # Create OWNS relationship for user-level access control
            if self.user_id:
                session.run(
                    """
                    MATCH (u:User {id: $user_id})
                    MATCH (t:Thing {id: $thing_id})
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
            "thing_id": thing.id,
            "thing_name": thing.name,
            "location_path": location_path,
            "message": f"Stored '{thing.name}' in {location_path}"
        }
    
    def find_thing_by_name(self, name: str) -> Optional[dict]:
        """Find a thing by exact or fuzzy name match.
        
        If user_id is set, only returns things owned by that user.
        """
        with self._driver.session() as session:
            # Build query based on whether user filtering is needed
            if self.user_id:
                # User-scoped query
                result = session.run(
                    """
                    MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing)
                    WHERE toLower(t.name) = toLower($name)
                    RETURN t
                    """,
                    user_id=self.user_id,
                    name=name.strip()
                )
            else:
                # Global query (for backwards compatibility)
                result = session.run(
                    """
                    MATCH (t:Thing)
                    WHERE toLower(t.name) = toLower($name)
                    RETURN t
                    """,
                    name=name.strip()
                )
            record = result.single()
            
            if record:
                node = record["t"]
                return {
                    "id": node["id"],
                    "name": node["name"],
                    "description": node.get("description"),
                    "tags": list(node.get("tags", []))
                }
            
            # Try fuzzy match
            if self.user_id:
                result = session.run(
                    """
                    MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing)
                    WHERE toLower(t.name) CONTAINS toLower($name)
                    RETURN t
                    LIMIT 1
                    """,
                    user_id=self.user_id,
                    name=name.strip()
                )
            else:
                result = session.run(
                    """
                    MATCH (t:Thing)
                    WHERE toLower(t.name) CONTAINS toLower($name)
                    RETURN t
                    LIMIT 1
                    """,
                    name=name.strip()
                )
            record = result.single()
            
            if record:
                node = record["t"]
                return {
                    "id": node["id"],
                    "name": node["name"],
                    "description": node.get("description"),
                    "tags": list(node.get("tags", []))
                }
            
            return None
    
    def find_thing(self, search_query: str) -> dict:
        """Find things matching a query (name, description, or tags).
        
        If user_id is set, only returns things owned by that user.
        """
        with self._driver.session() as session:
            if self.user_id:
                # User-scoped query
                result = session.run(
                    """
                    MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing)
                    WHERE toLower(t.name) CONTAINS toLower($search_term)
                       OR toLower(t.description) CONTAINS toLower($search_term)
                       OR ANY(tag IN t.tags WHERE toLower(tag) CONTAINS toLower($search_term))
                    WITH t
                    OPTIONAL MATCH (t)-[:LOCATED_IN]->(p:Place)
                    RETURN t, p
                    LIMIT 10
                    """,
                    user_id=self.user_id,
                    search_term=search_query.strip()
                )
            else:
                result = session.run(
                    """
                    MATCH (t:Thing)
                    WHERE toLower(t.name) CONTAINS toLower($search_term)
                       OR toLower(t.description) CONTAINS toLower($search_term)
                       OR ANY(tag IN t.tags WHERE toLower(tag) CONTAINS toLower($search_term))
                    WITH t
                    OPTIONAL MATCH (t)-[:LOCATED_IN]->(p:Place)
                    RETURN t, p
                    LIMIT 10
                    """,
                    search_term=search_query.strip()
                )
            
            things = []
            for record in result:
                node = record["t"]
                place = record["p"]
                
                thing_data = {
                    "id": node["id"],
                    "name": node["name"],
                    "description": node.get("description"),
                    "tags": list(node.get("tags", [])),
                    "location": place["name"] if place else None
                }
                
                # Get full location path
                if place:
                    thing_data["location_path"] = self.get_location_path(node["id"])
                
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
        # Find the thing
        thing = self.find_thing_by_name(thing_name)
        if not thing:
            return {
                "status": "error",
                "message": f"Thing '{thing_name}' not found"
            }
        
        thing_id = thing["id"]
        
        # Get old location
        old_location = self._get_current_location(thing_id)
        
        # Create new location hierarchy
        new_place = self.create_location_hierarchy(new_location)
        
        with self._driver.session() as session:
            # Remove old LOCATED_IN relationship
            session.run(
                """
                MATCH (t:Thing {id: $thing_id})-[r:LOCATED_IN]->()
                DELETE r
                """,
                thing_id=thing_id
            )
            
            # Create new LOCATED_IN relationship
            session.run(
                """
                MATCH (t:Thing {id: $thing_id})
                MATCH (p:Place {id: $place_id})
                MERGE (t)-[:LOCATED_IN]->(p)
                SET t.updated_at = datetime()
                """,
                thing_id=thing_id,
                place_id=new_place.id
            )
            
            # Create move event
            event = Event(
                event_type="moved",
                from_place_id=old_location.get("id") if old_location else None,
                to_place_id=new_place.id
            )
            session.run(
                """
                CREATE (e:Event {
                    id: $id,
                    event_type: 'moved',
                    timestamp: datetime(),
                    from_place_id: $from_place_id,
                    to_place_id: $to_place_id
                })
                WITH e
                MATCH (t:Thing {id: $thing_id})
                // Remove old LAST_SEEN
                OPTIONAL MATCH (t)-[r:LAST_SEEN]->()
                DELETE r
                WITH t, e
                MERGE (t)-[:LAST_SEEN]->(e)
                """,
                id=event.id,
                from_place_id=event.from_place_id,
                to_place_id=event.to_place_id,
                thing_id=thing_id
            )
        
        new_path = self.get_location_path(thing_id)
        
        return {
            "status": "success",
            "thing_name": thing["name"],
            "old_location": old_location.get("name") if old_location else "unknown",
            "new_location": new_path,
            "message": f"Moved '{thing['name']}' to {new_path}"
        }
    
    def _get_current_location(self, thing_id: str) -> Optional[dict]:
        """Get the current location of a thing."""
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (t:Thing {id: $thing_id})-[:LOCATED_IN]->(p:Place)
                RETURN p
                """,
                thing_id=thing_id
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
        """Get full location path from thing to room."""
        with self._driver.session() as session:
            # First get the direct location
            result = session.run(
                """
                MATCH (t:Thing {id: $thing_id})-[:LOCATED_IN]->(leaf:Place)
                OPTIONAL MATCH path = (leaf)<-[:CONTAINS*]-(ancestor:Place)
                WITH leaf, ancestor
                ORDER BY CASE ancestor.place_type 
                    WHEN 'room' THEN 0 
                    WHEN 'zone' THEN 1 
                    WHEN 'container' THEN 2 
                    ELSE 3 
                END
                RETURN leaf, collect(ancestor.name) AS ancestors
                """,
                thing_id=thing_id
            )
            record = result.single()
            if record:
                leaf = record["leaf"]
                ancestors = record["ancestors"] or []
                # Build path from room down to leaf
                path_parts = list(reversed(ancestors)) + [leaf["name"]]
                return " → ".join(path_parts)
            return "unknown location"
    
    def associate_things(
        self, 
        thing1_name: str, 
        thing2_name: str,
        relationship: Optional[str] = None
    ) -> dict:
        """Create a RELATED_TO relationship between two things."""
        thing1 = self.find_thing_by_name(thing1_name)
        thing2 = self.find_thing_by_name(thing2_name)
        
        if not thing1:
            return {"status": "error", "message": f"'{thing1_name}' not found"}
        if not thing2:
            return {"status": "error", "message": f"'{thing2_name}' not found"}
        
        with self._driver.session() as session:
            session.run(
                """
                MATCH (t1:Thing {id: $id1})
                MATCH (t2:Thing {id: $id2})
                MERGE (t1)-[r:RELATED_TO]->(t2)
                SET r.description = $relationship
                """,
                id1=thing1["id"],
                id2=thing2["id"],
                relationship=relationship
            )
        
        return {
            "status": "success",
            "message": f"Linked '{thing1['name']}' with '{thing2['name']}'"
        }
    
    def list_contents(self, location: str) -> dict:
        """List all things in a location."""
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (p:Place)
                WHERE toLower(p.name) CONTAINS toLower($location)
                WITH p
                MATCH (t:Thing)-[:LOCATED_IN]->(p)
                RETURN t, p
                """,
                location=location.strip()
            )
            
            things = []
            place_name = None
            for record in result:
                node = record["t"]
                place = record["p"]
                place_name = place["name"]
                things.append({
                    "name": node["name"],
                    "description": node.get("description"),
                    "tags": list(node.get("tags", []))
                })
            
            if things:
                return {
                    "status": "success",
                    "location": place_name,
                    "count": len(things),
                    "things": things,
                    "message": f"Found {len(things)} item(s) in '{place_name}'"
                }
            else:
                return {
                    "status": "empty",
                    "location": location,
                    "count": 0,
                    "things": [],
                    "message": f"No items found in '{location}'"
                }
    
    def attach_intent(self, thing_name: str, intent_name: str, description: Optional[str] = None) -> dict:
        """Attach an intent/purpose to a thing."""
        thing = self.find_thing_by_name(thing_name)
        if not thing:
            return {"status": "error", "message": f"'{thing_name}' not found"}
        
        with self._driver.session() as session:
            # Find or create intent
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
                MATCH (t:Thing {id: $thing_id})
                MATCH (i:Intent {id: $intent_id})
                MERGE (t)-[:USED_FOR]->(i)
                """,
                thing_id=thing["id"],
                intent_id=intent_node["id"]
            )
        
        return {
            "status": "success",
            "thing": thing["name"],
            "intent": intent_name,
            "message": f"'{thing['name']}' is now associated with intent: {intent_name}"
        }
