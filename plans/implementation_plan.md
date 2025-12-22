# Spatial Memory System - Implementation Plan

## Overview

This plan outlines the evolution of the spatial memory system into a production-ready, multi-user platform with:
1. **Full LlamaIndex integration** for semantic memory and retrieval
2. **User-level separation** with authentication and multi-tenancy
3. **Modular architecture** for MCP/public API/SaaS deployment

---

## Phase 1: LlamaIndex Integration (Semantic Memory Layer)

### 1.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      ADK Agent Layer                          │
│      (Conversational Interface + Tool Orchestration)          │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                    Service Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │  GraphService   │  │  MemoryService  │  │  UserService  │ │
│  │  (Neo4j CRUD)   │  │  (LlamaIndex)   │  │  (Auth)       │ │
│  └─────────────────┘  └─────────────────┘  └───────────────┘ │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                   Storage Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │     Neo4j       │  │  Vector Store   │  │  PostgreSQL   │ │
│  │  (Graph Data)   │  │  (Embeddings)   │  │  (Users/Meta) │ │
│  └─────────────────┘  └─────────────────┘  └───────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 LlamaIndex Memory Service Implementation

**File: `services/memory_service.py`**

Core responsibilities:
- Embed things using profile text (name + description + tags + location + intent)
- Store vectors in Neo4j Vector Index (or Qdrant/Pinecone for scale)
- Semantic search over user's things
- Temporal queries ("last time I used...")
- Association discovery ("things related to travel")

**Key Components:**

```python
# 1. Embedding Strategy
- Use Google's text-embedding-004 for consistency with Gemini
- Build rich profile texts combining all entity attributes
- Re-embed on updates (location changes, intent attached)

# 2. Index Structure
- PropertyGraphIndex: Traverse graph relationships
- VectorStoreIndex: Semantic similarity search
- TemporalIndex: Event-based timeline queries

# 3. Query Engine
- Hybrid retrieval: Vector + Graph + Keywords
- Re-ranking for user context
- Explanation generation (why this result matched)
```

### 1.3 Complete APIs to Implement

**Core Thing APIs (Existing - Need User Scoping)**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/thing/remember` | POST | Store a new thing |
| `/thing/find` | POST | Search things (semantic + fuzzy) |
| `/thing/move` | POST | Move thing to new location |
| `/thing/associate` | POST | Link related things |
| `/thing/delete` | DELETE | Soft delete a thing |
| `/thing/{id}` | GET | Get thing details |
| `/thing/{id}/history` | GET | Get movement/usage history |

**Place APIs (New)**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/place/contents` | POST | List things in location |
| `/place/hierarchy` | GET | Get user's place tree |
| `/place/rename` | PUT | Rename a place |
| `/place/merge` | POST | Merge two places |
| `/place/{id}/suggest` | GET | Suggest organization |

**Intent APIs (New)**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/intent/attach` | POST | Attach intent to thing |
| `/intent/list` | GET | List user's intents |
| `/intent/{name}/things` | GET | Get things for intent |
| `/intent/trigger` | POST | Mark intent as needed |

**Event APIs (New)**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/event/timeline` | GET | Get recent activity |
| `/event/usage` | POST | Record thing usage |
| `/event/search` | POST | Search events |

**Query APIs (New - LlamaIndex Powered)**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/query/semantic` | POST | Natural language search |
| `/query/related` | POST | Find related things |
| `/query/predict` | POST | Predict what's needed |
| `/query/recall` | POST | "When did I last..." |

---

## Phase 2: User-Level Separation (Multi-Tenancy)

### 2.1 User Model

**File: `models/user.py`**

```python
class User(BaseModel):
    id: str  # UUID
    email: str
    name: Optional[str]
    created_at: datetime
    
    # Preferences
    default_location: Optional[str]  # e.g., "Home"
    timezone: str = "UTC"
    
    # Subscription (for SaaS)
    tier: UserTier = UserTier.FREE
    things_limit: int = 100
    
class UserTier(str, Enum):
    FREE = "free"
    PERSONAL = "personal"
    FAMILY = "family"
```

### 2.2 Authentication Strategy

**Options (pick based on deployment target):**

1. **API Key Auth** (MCP/Developer API)
   - Header: `X-API-Key: user_xxx`
   - Simple, stateless
   - Good for integrations

2. **JWT Auth** (SaaS Web App)
   - Bearer token with user context
   - Short-lived access + refresh tokens
   - External provider (Firebase/Auth0/Supabase)

3. **Session Auth** (Internal/Personal Use)
   - Cookie-based
   - Simple for single-user

**Implementation:**

```python
# middleware/auth.py
class AuthMiddleware:
    async def __call__(self, request: Request, call_next):
        # Extract user from token/key
        user = await self.get_current_user(request)
        request.state.user = user
        return await call_next(request)

# Dependency injection for routes
async def get_current_user(request: Request) -> User:
    return request.state.user
```

### 2.3 Data Isolation in Neo4j

**Strategy: User-Scoped Queries**

Every graph query includes user filter:

```cypher
// BAD: Global query
MATCH (t:Thing {name: $name}) RETURN t

// GOOD: User-scoped query
MATCH (u:User {id: $user_id})-[:OWNS]->(t:Thing {name: $name}) RETURN t
```

**Graph Schema Updates:**

```
(User)-[:OWNS]->(Thing)
(User)-[:OWNS]->(Place)
(User)-[:OWNS]->(Intent)
```

### 2.4 User API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/user/register` | POST | Create new user |
| `/user/profile` | GET | Get current user |
| `/user/profile` | PUT | Update profile |
| `/user/preferences` | PUT | Update preferences |
| `/user/export` | GET | Export all user data |
| `/user/delete` | DELETE | Delete account + data |
| `/user/apikey` | POST | Generate API key |
| `/user/stats` | GET | Usage statistics |

---

## Phase 3: Modular Architecture (MCP/API/SaaS Ready)

### 3.1 Core Principles

1. **Interface Segregation**: Each module has clean interfaces
2. **Dependency Injection**: Services receive dependencies, don't create them
3. **Stateless Operations**: Each request is independent
4. **Event-Driven**: All mutations emit events for extensibility

### 3.2 Module Structure

```
spatial-memory/
├── core/                      # Core business logic (framework-agnostic)
│   ├── __init__.py
│   ├── interfaces.py          # Abstract base classes
│   ├── entities.py            # Domain models (Thing, Place, Intent, Event)
│   └── exceptions.py          # Custom exceptions
│
├── services/                  # Service layer (implements core interfaces)
│   ├── __init__.py
│   ├── graph_service.py       # Neo4j operations
│   ├── memory_service.py      # LlamaIndex operations
│   ├── user_service.py        # User management
│   ├── event_service.py       # Event tracking
│   └── query_service.py       # Complex queries (combines graph + memory)
│
├── adapters/                  # External system adapters
│   ├── __init__.py
│   ├── neo4j_adapter.py       # Neo4j connection pool
│   ├── vector_store.py        # Vector database abstraction
│   ├── auth_provider.py       # External auth (Firebase, etc.)
│   └── llm_provider.py        # LLM abstraction (Gemini, OpenAI)
│
├── api/                       # FastAPI REST layer
│   ├── __init__.py
│   ├── main.py                # FastAPI app factory
│   ├── routes/
│   │   ├── things.py
│   │   ├── places.py
│   │   ├── intents.py
│   │   ├── events.py
│   │   ├── queries.py
│   │   └── users.py
│   ├── middleware/
│   │   ├── auth.py
│   │   ├── rate_limit.py
│   │   └── logging.py
│   └── dependencies.py        # FastAPI dependencies
│
├── agent/                     # ADK Agent layer
│   ├── __init__.py
│   ├── agent.py               # Main agent definition
│   ├── tools.py               # Agent tools
│   └── prompts.py             # System prompts
│
├── mcp/                       # MCP Server (Model Context Protocol)
│   ├── __init__.py
│   ├── server.py              # MCP server implementation
│   ├── resources.py           # MCP resources
│   └── tools.py               # MCP tools (mirrors agent tools)
│
├── config/                    # Configuration
│   ├── __init__.py
│   ├── settings.py            # Pydantic settings
│   └── logging.py             # Logging config
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### 3.3 Core Interfaces

**File: `core/interfaces.py`**

```python
from abc import ABC, abstractmethod
from typing import Optional, List
from .entities import Thing, Place, Intent, Event, User

class IThingRepository(ABC):
    """Interface for Thing data access."""
    
    @abstractmethod
    async def create(self, user_id: str, thing: Thing) -> Thing: ...
    
    @abstractmethod
    async def find_by_id(self, user_id: str, thing_id: str) -> Optional[Thing]: ...
    
    @abstractmethod
    async def search(self, user_id: str, query: str, limit: int = 10) -> List[Thing]: ...
    
    @abstractmethod
    async def update_location(self, user_id: str, thing_id: str, place_id: str) -> Thing: ...
    
    @abstractmethod
    async def delete(self, user_id: str, thing_id: str) -> bool: ...


class IMemoryService(ABC):
    """Interface for semantic memory operations."""
    
    @abstractmethod
    async def embed_thing(self, user_id: str, thing: Thing) -> None: ...
    
    @abstractmethod
    async def semantic_search(self, user_id: str, query: str, limit: int = 10) -> List[Thing]: ...
    
    @abstractmethod
    async def find_related(self, user_id: str, thing_id: str) -> List[Thing]: ...


class IUserService(ABC):
    """Interface for user management."""
    
    @abstractmethod
    async def get_by_id(self, user_id: str) -> Optional[User]: ...
    
    @abstractmethod
    async def authenticate(self, token: str) -> Optional[User]: ...
    
    @abstractmethod
    async def create(self, user: User) -> User: ...
```

### 3.4 Deployment Targets

**A. MCP Server (for AI agents like Claude/Gemini)**

```python
# mcp/server.py
from mcp import Server, Tool, Resource

server = Server("spatial-memory")

@server.tool()
async def remember_thing(name: str, location: str, description: str = None):
    """Store where something is located."""
    # Uses same service layer as API
    ...

@server.resource("things://")
async def get_things(uri: str):
    """Resource for accessing things."""
    ...
```

**B. Public API (REST + OpenAPI)**

```python
# api/main.py - Already structured for this
# Just needs rate limiting, API key auth, usage tracking
```

**C. SaaS App (Multi-tenant)**

```python
# Additional components:
# - Subscription management
# - Usage metering
# - Team/family sharing
# - Audit logs
```

---

## Phase 4: Implementation Order

### Sprint 1: LlamaIndex Full Integration (Week 1)
- [ ] Setup embedding pipeline with Google text-embedding-004
- [ ] Create Neo4j Vector Index for embeddings
- [ ] Implement `MemoryService.embed_thing()`
- [ ] Implement `MemoryService.semantic_search()`
- [ ] Add `/query/semantic` endpoint
- [ ] Test with real data

### Sprint 2: Remaining APIs (Week 2)
- [ ] Implement Place APIs (hierarchy, rename, merge)
- [ ] Implement Intent APIs (trigger, list things)
- [ ] Implement Event APIs (timeline, usage tracking)
- [ ] Implement Query APIs (related, predict, recall)
- [ ] Add `/thing/{id}` GET and DELETE
- [ ] Add `/thing/{id}/history`

### Sprint 3: User System (Week 3)
- [ ] Add User model to entities
- [ ] Create UserService
- [ ] Implement API key authentication
- [ ] Scope all Graph queries to user
- [ ] Add user ownership relationships in Neo4j
- [ ] Implement User APIs
- [ ] Migration script for existing data

### Sprint 4: Modularization (Week 4)
- [ ] Refactor to new folder structure
- [ ] Create core interfaces
- [ ] Implement dependency injection
- [ ] Add adapter layer
- [ ] Add rate limiting middleware
- [ ] Add request logging

### Sprint 5: MCP Server (Week 5)
- [ ] Create MCP server
- [ ] Expose tools (remember, find, move, etc.)
- [ ] Expose resources (things, places, intents)
- [ ] Test with Claude Desktop
- [ ] Documentation

---

## Configuration Updates

### Environment Variables

```bash
# .env additions for Phase 2+

# Authentication
AUTH_PROVIDER=apikey  # Options: apikey, jwt, firebase
JWT_SECRET=your-secret-key
FIREBASE_PROJECT_ID=your-project

# Vector Store (optional, defaults to Neo4j)
VECTOR_STORE=neo4j  # Options: neo4j, qdrant, pinecone
QDRANT_URL=http://localhost:6333
PINECONE_API_KEY=xxx

# Embeddings
EMBEDDING_MODEL=text-embedding-004  # Google's model

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600  # seconds

# SaaS Features
ENABLE_SUBSCRIPTIONS=false
STRIPE_API_KEY=xxx
```

### Dependencies to Add

```toml
# pyproject.toml additions

dependencies = [
    # Existing...
    
    # Embeddings
    "llama-index-embeddings-google>=0.3.0",
    
    # Vector stores (optional)
    "llama-index-vector-stores-qdrant>=0.3.0",
    
    # Auth
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    
    # Rate limiting
    "slowapi>=0.1.9",
    
    # MCP
    "mcp>=1.0.0",
]
```

---

## Success Metrics

1. **LlamaIndex Integration**
   - Semantic search returns relevant results for fuzzy queries
   - "Find travel stuff" finds passport, luggage tags, etc.
   - Response time < 500ms for searches

2. **User Separation**
   - Users can only see their own data
   - API keys work for programmatic access
   - Export produces complete user data

3. **Modularity**
   - Can run as standalone API
   - Can run as MCP server
   - Can embed in other applications
   - All services are independently testable

---

## Next Steps

1. **Start with Sprint 1**: Focus on LlamaIndex integration first
2. **Run existing tests**: Make sure current functionality works
3. **Incremental migration**: Don't break what's working
4. **Keep agent working**: ADK agent should remain functional throughout

Would you like me to start implementing Sprint 1 (LlamaIndex integration)?
