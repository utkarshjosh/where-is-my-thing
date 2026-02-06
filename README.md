# Where Is My Thing? 🔍

> *"Mom, where did you put the winter blankets?"*  
> *"I don't remember... somewhere in the storeroom? Or was it the bedroom almirah?"*

This conversation happens in every household. We store things "safely" and then spend hours searching for them months later. **This project is my attempt to solve that problem for my mom.**

---

## The Problem

My mom has a habit of keeping things in "safe places" - and then completely forgetting where those safe places are. Seasonal items like blankets, festival decorations, or important documents vanish into the void of our home, only to be rediscovered by accident (or never at all).

Traditional solutions don't work:
- **Spreadsheets** are tedious to maintain
- **Note apps** become graveyards of forgotten entries
- **Physical labels** fall off or get ignored

What we needed was something that:
1. Is as easy as *talking* - "I put the Diwali lights in the bedroom cupboard"
2. Understands context - "Where's that thing I use for travel?"
3. Learns over time - recognizes "winter blanket" and "woolen blanket" are the same thing

---

## The Solution

A **voice-first spatial memory assistant** that acts as an external brain for your home inventory.

```
You: "I'm keeping the passport in the bedroom locker, top shelf"
Assistant: "Got it! I've stored your passport in Bedroom → Locker → Top Shelf"

--- 6 months later ---

You: "Where's my passport?"
Assistant: "Your passport is in your bedroom locker, on the top shelf"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                              │
│                    (Voice / Mobile App / Web App)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SPATIAL MEMORY AGENT                           │
│                         (Google ADK + Groq LLM)                          │
│                                                                          │
│  Tools: remember_thing, find_thing, move_thing, list_contents, etc.     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────┐
│        GRAPH SERVICE          │   │         MEMORY SERVICE            │
│          (Neo4j)              │   │    (Semantic Embeddings)          │
│                               │   │                                   │
│  - Thing nodes                │   │  - Vector similarity search       │
│  - Place hierarchy            │   │  - Fuzzy matching                 │
│  - Relationships              │   │  - "Vibes-based" retrieval        │
│  - User isolation             │   │                                   │
└───────────────────────────────┘   └───────────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CANONICAL RESOLUTION                              │
│                    (Deduplication + Confidence)                          │
│                                                                          │
│  "Crime and Punishment book" ═══╗                                       │
│  "Crime and Punishment"     ════╬═══▶ Same Canonical Item               │
│  "Dostoevsky's book"        ═══╝                                        │
│                                                                          │
│  📖 docs/canonical_resolution.md                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. Natural Language Understanding

The agent parses natural speech into structured operations:

| You Say | Agent Understands |
|---------|-------------------|
| "I put my passport in the bedroom locker" | `remember_thing("passport", "Bedroom > Locker")` |
| "Where's my charger?" | `find_thing("charger")` |
| "I moved the toolbox to the garage" | `move_thing("toolbox", "Garage")` |
| "What's in the kitchen drawer?" | `list_contents("Kitchen > Drawer")` |

**File:** [`spatial_memory_agent/agent.py`](spatial_memory_agent/agent.py)

### 2. Knowledge Graph (Neo4j)

Your home becomes a graph database:

```
(:User)-[:OWNS]->(:Thing)-[:LOCATED_IN]->(:Place)-[:CONTAINS]->(:Place)
                    │
                    └──[:CANONICAL]──>(:CanonicalItem)
```

- **Things** are physical objects (passport, blanket, screwdriver)
- **Places** form a hierarchy (Room → Zone → Container)
- **Relationships** capture location and associations

**File:** [`services/graph_service.py`](services/graph_service.py)

### 3. Semantic Search (Vector Embeddings)

Exact-match search fails when you can't remember the exact name. Semantic search understands meaning:

| Query | Finds |
|-------|-------|
| "travel documents" | passport, visa papers, tickets |
| "winter stuff" | blankets, sweaters, heater |
| "electronics" | laptop, charger, HDMI cable |

Uses Google's `gemini-embedding-001` model (3072 dimensions) with cosine similarity.

**File:** [`services/memory_service.py`](services/memory_service.py)

### 4. Canonical Resolution (Deduplication)

The smartest part. When you say "Crime and Punishment book" today and "that Dostoevsky novel" tomorrow, the system recognizes they're the same item.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    PERCEPTION    │────▶│      BELIEF      │────▶│   CONFIDENCE     │
│   (Normalize)    │     │     (Match)      │     │    (Learn)       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │                        │
   Strip noise,            Vector search            Build trust
   detect type            against existing          through use
```

**Full documentation:** [`docs/canonical_resolution.md`](docs/canonical_resolution.md)

**File:** [`services/canonical_service.py`](services/canonical_service.py)

---

## Tech Stack

| Component | Technology | Why |
|-----------|------------|-----|
| **Agent Framework** | [Google ADK](https://github.com/google/adk-python) | Clean tool-calling, conversation management |
| **LLM** | Groq (Qwen QwQ 32B) | Fast inference, good at tool use |
| **Graph Database** | Neo4j | Natural fit for spatial relationships |
| **Embeddings** | Google `gemini-embedding-001` | High quality, 3072 dimensions |
| **Voice** | Groq Whisper (STT) + Orpheus (TTS) | Real-time voice interaction |
| **API** | FastAPI | Async, auto-docs, type-safe |
| **Mobile** | React Native (Expo) | Cross-platform, voice-first UI |

---

## Project Structure

```
where-is-my-thing/
├── spatial_memory_agent/     # Agent definition & tools
│   ├── agent.py              # Main agent with 9 tools
│   └── context.py            # User context management
│
├── services/                 # Core business logic
│   ├── graph_service.py      # Neo4j operations
│   ├── memory_service.py     # Semantic search
│   ├── canonical_service.py  # Deduplication
│   └── groq_service.py       # Voice (TTS/STT)
│
├── models/                   # Data models
│   ├── entities.py           # Thing, Place, CanonicalItem
│   └── graph_schema.py       # Neo4j schema
│
├── api/                      # REST API
│   ├── main.py               # FastAPI app
│   └── routes/               # API endpoints
│
├── mobile-app/               # React Native app
├── web-app/                  # Web interface
├── admin-ui/                 # Admin dashboard
│
└── docs/                     # Documentation
    └── canonical_resolution.md
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Docker (for Neo4j)
- API keys: Groq, Google AI

### Setup

```bash
# Clone and setup
git clone https://github.com/yourusername/where-is-my-thing.git
cd where-is-my-thing

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e .

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### Start Neo4j

```bash
docker-compose up -d neo4j
```

### Run the Agent (Dev Mode)

```bash
adk web
```

Open http://localhost:5000 and select `spatial_memory_agent`.

### Run the API Server

```bash
uvicorn api.main:app --reload --port 8000
```

API docs at http://localhost:8000/docs

---

## Agent Tools

| Tool | Description |
|------|-------------|
| `remember_thing` | Store a thing at a location |
| `find_thing` | Search for things (semantic) |
| `move_thing` | Update thing location |
| `associate_things` | Link related items |
| `list_contents` | Show what's in a location |
| `list_places` | Show all known locations |
| `attach_intent` | Add purpose/reason to a thing |
| `confirm_item_match` | Confirm canonical match |
| `create_new_item` | Create explicitly new item |

---

## Core Concepts

### Thing
A physical object being tracked.
```
(:Thing {name: "Passport", description: "Blue cover", tags: ["travel", "documents"]})
```

### Place
A location in the hierarchy: **Room → Zone → Container**
```
(:Place {name: "Bedroom", type: "room"})
  └──[:CONTAINS]──▶ (:Place {name: "Locker", type: "container"})
                      └──[:CONTAINS]──▶ (:Place {name: "Top Shelf", type: "container"})
```

### CanonicalItem
The "true identity" of an item, solving the duplicate problem.
```
(:CanonicalItem {
  canonical_name: "passport",
  aliases: ["travel passport", "my passport", "blue passport"],
  confidence: 0.85
})
```

---

## Why This Matters

This isn't just a database of things. It's an **externalized memory system** that:

1. **Reduces cognitive load** - Stop trying to remember where things are
2. **Survives time** - Seasonal items aren't lost to forgetfulness
3. **Learns your language** - Adapts to how YOU refer to things
4. **Respects uncertainty** - Asks when unsure, doesn't guess wrong

For my mom, it means no more frantic searching before guests arrive. For anyone with ADHD, executive dysfunction, or just too much stuff - it's a second brain for your physical world.

---

## Contributing

Issues and PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License - See [LICENSE](LICENSE)

---

<p align="center">
  <i>Built with love for moms everywhere who "put it somewhere safe"</i> ❤️
</p>
