# Neo4j Architecture in Where-Is-My-Thing

This document explains how Neo4j is used in the spatial memory application, including database structure, features used, embedding storage, and performance considerations.

## Table of Contents

1. [Overview](#overview)
2. [Neo4j Features Used](#neo4j-features-used)
3. [Database Schema](#database-schema)
4. [Embedding Storage](#embedding-storage)
5. [Code Organization](#code-organization)
6. [Performance Analysis: Why Items API is Slow](#performance-analysis-why-items-api-is-slow)

---

## Overview

Neo4j serves as the primary data store for this spatial memory application. It stores:
- **User items (Things)** with their names, descriptions, tags, and embeddings
- **Locations (Places)** in a hierarchical structure (Room → Zone → Container)
- **Relationships** between items, locations, and users
- **Canonical items** for deduplication with semantic similarity matching

The application uses Neo4j's **property graph model** combined with its **native vector index** for semantic search capabilities.

---

## Neo4j Features Used

### In the API Layer

| Feature | Usage | File Reference |
|---------|-------|----------------|
| **Cypher Query Language** | All database operations | `services/graph_service.py` |
| **Connection Pooling** | Singleton driver pool for performance | `services/db_pool.py` |
| **Session Management** | Request-scoped sessions | All service files |
| **Uniqueness Constraints** | Ensure unique IDs for nodes | `models/graph_schema.py` |
| **Property Indexes** | Fast lookups on `user_id`, `name` | `models/graph_schema.py` |
| **Vector Indexes** | Semantic similarity search | `models/graph_schema.py`, `services/memory_service.py` |
| **Path Traversal** | Location hierarchy (`CONTAINS*`) | `api/routes/items.py` |
| **MERGE Operations** | Find-or-create pattern | `services/graph_service.py` |

### In the Agent Layer

| Feature | Usage | File Reference |
|---------|-------|----------------|
| **Graph Traversal** | Find location paths | `spatial_memory_agent/agent.py` |
| **Relationship Queries** | Associate related items | Agent's `associate_things` tool |
| **Fuzzy Matching** | Find items by name/description | Agent's `find_thing` tool |
| **Vector Search** | Semantic "vibes" search | `services/memory_service.py` |

---

## Database Schema

### Node Labels

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER          │  THING           │  PLACE           │  INTENT       │
│  ──────        │  ──────          │  ──────          │  ──────       │
│  id (UUID)     │  id (UUID)       │  id (UUID)       │  id (UUID)    │
│  clerk_user_id │  user_id         │  user_id         │  name         │
│  email         │  name            │  name            │  description  │
│  first_name    │  description     │  place_type      │               │
│  last_name     │  tags[]          │  parent_id       │               │
│                │  item_type       │                  │               │
│                │  embedding[3072] │                  │               │
│                │  embedding_text  │                  │               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────┐
│  CANONICAL_ITEM                     │
│  ──────────────                     │
│  id (UUID)                          │
│  user_id                            │
│  canonical_name                     │
│  item_type                          │
│  aliases[]                          │
│  confidence (0.0-1.0)               │
│  embedding[3072]                    │
└─────────────────────────────────────┘
```

**Defined in:** `models/entities.py` (Pydantic models), `models/graph_schema.py` (Cypher schema)

### Relationship Types

```
(User)-[:OWNS]->(Thing)               # User ownership
(Thing)-[:LOCATED_IN]->(Place)        # Where a thing is stored
(Thing)-[:USED_FOR]->(Intent)         # Why it's kept
(Thing)-[:RELATED_TO]->(Thing)        # Related items
(Thing)-[:CANONICAL]->(CanonicalItem) # Deduplication link
(Place)-[:CONTAINS]->(Place)          # Location hierarchy
```

**Defined in:** `models/graph_schema.py`

### PlaceType Hierarchy

```
ROOM → ZONE → CONTAINER

Example:
  "Living Room" (ROOM)
       └── "TV Unit" (ZONE)
              └── "Top Drawer" (CONTAINER)
```

**Defined in:** `models/entities.py` (PlaceType enum)

### Constraints & Indexes

```cypher
-- Uniqueness Constraints
CREATE CONSTRAINT user_id FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT thing_id FOR (t:Thing) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT place_id FOR (p:Place) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT canonical_id FOR (c:CanonicalItem) REQUIRE c.id IS UNIQUE;

-- Performance Indexes (user-scoped queries)
CREATE INDEX thing_user FOR (t:Thing) ON (t.user_id);
CREATE INDEX place_user FOR (p:Place) ON (p.user_id);
CREATE INDEX canonical_user FOR (c:CanonicalItem) ON (c.user_id);
CREATE INDEX thing_name FOR (t:Thing) ON (t.name);

-- Vector Indexes (semantic search)
CREATE VECTOR INDEX thing_embedding FOR (t:Thing) ON (t.embedding)
OPTIONS {indexConfig: {`vector.dimensions`: 3072, `vector.similarity_function`: 'cosine'}};

CREATE VECTOR INDEX canonical_embedding FOR (c:CanonicalItem) ON (c.embedding)
OPTIONS {indexConfig: {`vector.dimensions`: 3072, `vector.similarity_function`: 'cosine'}};
```

**Defined in:** `models/graph_schema.py`, applied via `scripts/setup_schema.py`

---

## Embedding Storage

### Where Embeddings Are Stored

Embeddings are stored **directly in Neo4j node properties**, not in a separate vector database:

| Node Type | Property | Dimensions | Model |
|-----------|----------|------------|-------|
| `Thing` | `embedding` | 3072 | Google gemini-embedding-001 |
| `CanonicalItem` | `embedding` | 3072 | Google gemini-embedding-001 |

### Metadata Stored Alongside Embeddings

Each embedded node includes:
- `embedding`: Float array (3072 dimensions)
- `embedding_model`: Model name (e.g., "gemini-embedding-001")
- `embedding_version`: App version for re-indexing (e.g., "v1.1")
- `embedding_text`: The text that was embedded

### How Embeddings Are Generated

```
┌──────────────────────────────────────────────────────────────────────┐
│  Build Profile Text                                                  │
│  ─────────────────                                                   │
│  "Item: Passport. Description: Travel document. Categories: travel, │
│   important. Location: Bedroom → Locker → Blue File"                 │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Google GenAI Embedding Provider                                     │
│  ────────────────────────────                                        │
│  - Uses LlamaIndex GoogleGenAIEmbedding                             │
│  - Model: gemini-embedding-001                                       │
│  - Output: 3072-dimensional vector                                   │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Store in Neo4j                                                      │
│  ─────────────                                                       │
│  MATCH (t:Thing {id: $id})                                          │
│  SET t.embedding = $vector,                                          │
│      t.embedding_model = "gemini-embedding-001",                     │
│      t.embedding_version = "v1.1"                                    │
└──────────────────────────────────────────────────────────────────────┘
```

**Code Files:**
- `adapters/google_embedding.py` - Google embedding provider implementation
- `core/interfaces.py` - `IEmbeddingProvider` interface (allows vendor swapping)
- `services/memory_service.py` - Embedding storage and vector search

### Vector Search Implementation

```cypher
CALL db.index.vector.queryNodes(
    'thing_embedding',    -- Index name
    30,                   -- Limit (fetch extra for post-filtering)
    $embedding            -- Query vector
) YIELD node, score
WHERE score > 0.55 AND node.user_id = $user_id
RETURN node.id, node.name, score
ORDER BY score DESC
LIMIT 10
```

**File:** `services/memory_service.py` (`semantic_search` method)

### Re-embedding After Model Change

When the embedding model or dimensions change (e.g. text-embedding-004 → gemini-embedding-001), vector indexes must be recreated and all embeddings regenerated. Neo4j does not allow changing vector index dimensions in place.

Run the re-embed script (requires Neo4j running and `GOOGLE_API_KEY` set):

```bash
python scripts/reembed_database.py
```

This drops the existing vector indexes, recreates them with the current schema (3072 dims), and re-embeds every Thing and CanonicalItem using stored or rebuilt `embedding_text`.

---

## Code Organization

### Service Layer

| Service | Purpose | Key Neo4j Operations |
|---------|---------|---------------------|
| `services/graph_service.py` | Core graph operations | CRUD for Things/Places, path traversal |
| `services/memory_service.py` | Semantic search | Vector index queries, embedding storage |
| `services/canonical_service.py` | Deduplication | Canonical matching, alias management |
| `services/user_service.py` | User management | User node CRUD |
| `services/db_pool.py` | Connection pooling | Singleton driver instance |

### API Routes

| Route | Purpose | Neo4j Query Pattern |
|-------|---------|-------------------|
| `api/routes/items.py` | List/search items | Complex path aggregation |
| `api/routes/graph.py` | Graph visualization | Node/edge retrieval |
| `api/routes/users.py` | User management | User node operations |

### Agent Tools

The spatial memory agent (`spatial_memory_agent/agent.py`) exposes these Neo4j-backed tools:

- `remember_thing` - Creates Thing + Place hierarchy + embeddings
- `find_thing` - Vector similarity search
- `move_thing` - Updates LOCATED_IN relationship
- `associate_things` - Creates RELATED_TO edges
- `list_contents` - Traverses CONTAINS hierarchy
- `delete_thing` - Removes node and relationships

---

## Performance Analysis: Why Items API is Slow

The `/items` endpoint can be slow due to several factors:

### 1. Complex Path Aggregation in Cypher

The list items query computes location paths inline to avoid N+1 queries:

```cypher
-- From api/routes/items.py lines 127-166
MATCH (t:Thing {user_id: $user_id})
OPTIONAL MATCH (t)-[:LOCATED_IN]->(leaf:Place {user_id: $user_id})
OPTIONAL MATCH path = (leaf)<-[:CONTAINS*0..]-(ancestor:Place {user_id: $user_id})
-- Complex path manipulation follows...
```

**Problems:**
- `CONTAINS*0..` is a **variable-length path pattern** - expensive to compute
- Path aggregation uses `reduce()` and `reverse()` - CPU intensive
- Multiple `OPTIONAL MATCH` clauses create cartesian products before filtering

### 2. Vector Search Latency

When searching (`/items/search`), two round-trips occur:

1. **Vector search** - Query Neo4j vector index (~100-500ms for external API + Neo4j)
2. **Fetch item types** - Second query to get `item_type` for category mapping

```python
# From api/routes/items.py lines 200-217
result = gs.find_thing(q)  # Vector search

# Then another query for item_types
thing_ids = [t["id"] for t in result.get("things", [])]
if thing_ids:
    type_result = session.run("MATCH (t:Thing)... WHERE t.id IN $ids")
```

### 3. Embedding Generation Overhead

When creating/moving items, embeddings are regenerated:

```python
# From services/graph_service.py line 379-389
ms.embed_thing(thing.id, profile_text)  # Calls Google API
```

This adds **200-800ms latency** per item modification.

### 4. No Query Result Caching

Each API call executes fresh Cypher queries. There's no caching layer for:
- Location path strings (computed every time)
- User's item list (could be cached with TTL)
- Item type mappings

### Potential Optimizations

| Issue | Optimization | Complexity |
|-------|-------------|------------|
| Variable-length paths | Pre-compute and cache `location_path` on Thing nodes | Medium |
| Two-phase search | Return `item_type` from vector search query directly | Low |
| Embedding latency | Background queue for embedding generation | High |
| No caching | Add Redis/memory cache for item lists | Medium |
| Path aggregation | Use Neo4j APOC procedures for path operations | Medium |

### Example: Optimized Location Path

Instead of computing paths at query time, store them on the Thing node:

```cypher
-- During create/move
MATCH (t:Thing {id: $id})-[:LOCATED_IN]->(leaf)
OPTIONAL MATCH path = (leaf)<-[:CONTAINS*]-(ancestor)
WITH t, [n IN nodes(path) | n.name] as parts
SET t.cached_location_path = reduce(s = '', i IN range(0, size(parts)-1) |
    CASE WHEN i = 0 THEN parts[i] ELSE s + ' → ' + parts[i] END)
```

Then listing becomes:

```cypher
MATCH (t:Thing {user_id: $user_id})
RETURN t.name, t.cached_location_path
ORDER BY t.created_at DESC
LIMIT 50
```

---

## Summary

Neo4j is used as a **unified graph + vector database** in this application:

- **Graph features**: Relationships, path traversal, user isolation
- **Vector features**: Native 3072-dim embeddings (gemini-embedding-001), cosine similarity search
- **Key services**: `GraphService` (CRUD), `MemoryService` (embeddings), `CanonicalService` (dedup)

The main performance bottleneck is the **complex Cypher path aggregation** in the items listing endpoint, compounded by the lack of query-level caching.
