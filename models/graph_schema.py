"""Neo4j graph schema definitions.

Defines node labels and relationship types for the property graph.

IMPORTANT: User Isolation Strategy
==================================
Every user has their own isolated graph. This is achieved by:
1. User node: stores internal id and clerk_user_id mapping
2. Thing nodes: have user_id property for fast filtering + OWNS relationship
3. Place nodes: have user_id property (each user has their own places)
4. CanonicalItem: user-scoped canonical names with aliases

All queries MUST filter by user_id to maintain isolation.
"""
from enum import Enum


class NodeLabel(str, Enum):
    """Node labels in the graph."""
    USER = "User"               # User account
    THING = "Thing"             # Physical object being tracked
    PLACE = "Place"             # Location (room, zone, container)
    INTENT = "Intent"           # Purpose/reason for keeping something
    CANONICAL_ITEM = "CanonicalItem"  # Canonical identity for deduplication


class RelationType(str, Enum):
    """Relationship types between nodes."""
    # User relationships
    OWNS = "OWNS"               # User -> Thing (ownership)
    
    # Thing relationships
    LOCATED_IN = "LOCATED_IN"   # Thing -> Place
    USED_FOR = "USED_FOR"       # Thing -> Intent
    RELATED_TO = "RELATED_TO"   # Thing -> Thing
    CANONICAL = "CANONICAL"     # Thing -> CanonicalItem (deduplication)
    
    # Place relationships
    CONTAINS = "CONTAINS"       # Place -> Place (hierarchy)


# Cypher queries for schema setup
SCHEMA_CONSTRAINTS = """
// User constraints
CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT user_clerk_id IF NOT EXISTS FOR (u:User) REQUIRE u.clerk_user_id IS UNIQUE;

// Thing constraints - ID must be unique globally
CREATE CONSTRAINT thing_id IF NOT EXISTS FOR (t:Thing) REQUIRE t.id IS UNIQUE;

// Place constraints
CREATE CONSTRAINT place_id IF NOT EXISTS FOR (p:Place) REQUIRE p.id IS UNIQUE;

// Intent constraints
CREATE CONSTRAINT intent_id IF NOT EXISTS FOR (i:Intent) REQUIRE i.id IS UNIQUE;

// CanonicalItem constraints
CREATE CONSTRAINT canonical_id IF NOT EXISTS FOR (c:CanonicalItem) REQUIRE c.id IS UNIQUE;

// Indexes for user-scoped queries (critical for performance)
CREATE INDEX thing_user IF NOT EXISTS FOR (t:Thing) ON (t.user_id);
CREATE INDEX place_user IF NOT EXISTS FOR (p:Place) ON (p.user_id);
CREATE INDEX canonical_user IF NOT EXISTS FOR (c:CanonicalItem) ON (c.user_id);

// Indexes for name lookups within user scope
CREATE INDEX thing_name IF NOT EXISTS FOR (t:Thing) ON (t.name);
CREATE INDEX place_name IF NOT EXISTS FOR (p:Place) ON (p.name);
CREATE INDEX intent_name IF NOT EXISTS FOR (i:Intent) ON (i.name);
CREATE INDEX canonical_name IF NOT EXISTS FOR (c:CanonicalItem) ON (c.canonical_name);
"""

VECTOR_INDEX_SETUP = """
// Vector index for semantic search on Things
CREATE VECTOR INDEX thing_embedding IF NOT EXISTS
FOR (t:Thing) ON (t.embedding)
OPTIONS {indexConfig: {
    `vector.dimensions`: 3072,
    `vector.similarity_function`: 'cosine'
}};

// Vector index for canonical item matching
CREATE VECTOR INDEX canonical_embedding IF NOT EXISTS
FOR (c:CanonicalItem) ON (c.embedding)
OPTIONS {indexConfig: {
    `vector.dimensions`: 3072,
    `vector.similarity_function`: 'cosine'
}};
"""


# Schema cleanup for fresh start
SCHEMA_CLEANUP = """
// Drop all nodes and relationships
MATCH (n) DETACH DELETE n;
"""

DROP_ALL_CONSTRAINTS = """
// Note: Run SHOW CONSTRAINTS first to see what exists
// Then drop each one manually as DROP CONSTRAINT doesn't support IF EXISTS in all versions
"""
