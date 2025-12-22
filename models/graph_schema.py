"""Neo4j graph schema definitions.

Defines node labels and relationship types for the property graph.
"""
from enum import Enum


class NodeLabel(str, Enum):
    """Node labels in the graph."""
    THING = "Thing"
    PLACE = "Place"
    INTENT = "Intent"
    EVENT = "Event"


class RelationType(str, Enum):
    """Relationship types between nodes."""
    # Thing relationships
    LOCATED_IN = "LOCATED_IN"      # Thing -> Place
    USED_FOR = "USED_FOR"          # Thing -> Intent
    RELATED_TO = "RELATED_TO"      # Thing -> Thing
    LAST_SEEN = "LAST_SEEN"        # Thing -> Event
    
    # Place relationships
    CONTAINS = "CONTAINS"          # Place -> Place (hierarchy)
    
    # Event relationships
    MOVED_FROM = "MOVED_FROM"      # Event -> Place
    MOVED_TO = "MOVED_TO"          # Event -> Place


# Cypher queries for schema setup
SCHEMA_CONSTRAINTS = """
// Unique constraints for IDs
CREATE CONSTRAINT thing_id IF NOT EXISTS FOR (t:Thing) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT place_id IF NOT EXISTS FOR (p:Place) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT intent_id IF NOT EXISTS FOR (i:Intent) REQUIRE i.id IS UNIQUE;
CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE;

// Index for name lookups
CREATE INDEX thing_name IF NOT EXISTS FOR (t:Thing) ON (t.name);
CREATE INDEX place_name IF NOT EXISTS FOR (p:Place) ON (p.name);
CREATE INDEX intent_name IF NOT EXISTS FOR (i:Intent) ON (i.name);
"""

VECTOR_INDEX_SETUP = """
// Vector index for semantic search on Things
CREATE VECTOR INDEX thing_embedding IF NOT EXISTS
FOR (t:Thing) ON (t.embedding)
OPTIONS {indexConfig: {
    `vector.dimensions`: 768,
    `vector.similarity_function`: 'cosine'
}};
"""
