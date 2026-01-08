# Spatial Memory System

A personal knowledge graph that externalizes spatial memory + intent. Built with Google ADK for agent execution and LlamaIndex for memory/retrieval over Neo4j.

## Quick Start

### 1. Prerequisites

- Python 3.10+
- Neo4j (local Docker or [Neo4j Aura](https://neo4j.com/cloud/aura/))
- Google AI Studio API key

### 2. Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -e .

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys
```

### 3. Start Neo4j (if using Docker)

```bash
docker run -d --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password123 \
  neo4j:latest
```

### 4. Run the Agent (Dev UI)

```bash
adk web
```

Then open http://localhost:5000 and select `spatial_memory_agent`.

### 5. Run the API Server

```bash
uvicorn src.api.main:app --reload --port 5000
```

API docs at http://localhost:5000/docs

### 6. Run the Mobile App

```bash
cd mobile-app
bunx expo start
```

## Core Concepts

- **Thing**: Physical object (passport, cable, tool)
- **Place**: Location hierarchy (Room → Zone → Container)
- **Intent**: Purpose/reason for keeping something
- **Event**: Temporal record of changes

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /thing/remember` | Store new thing with location |
| `POST /thing/find` | Semantic search for things |
| `POST /thing/move` | Update thing location |
| `POST /thing/associate` | Link related things |
| `POST /place/contents` | List contents of location |
| `POST /intent/attach` | Associate purpose with thing |
