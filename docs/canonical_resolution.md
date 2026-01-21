# Canonical Item Resolution System

> **Part of [Where Is My Thing?](../README.md)** - A spatial memory assistant for tracking physical objects.

This document explains the canonical resolution layer - how the system prevents duplicate entries when users refer to the same item in different ways.

---

## The Problem

When users interact with a spatial memory system through natural language, they refer to the same object in many different ways:

- "Crime and Punishment book"
- "Crime and Punishment book by Dostoevsky"
- "that Russian novel"
- "Dostoevsky's book"

Without canonical resolution, each utterance creates a new database entry, leading to:
- Duplicate records for the same physical object
- Confusion when searching ("Where is my book?")
- Fragmented memory that doesn't reflect reality

---

## Philosophy: Perception → Belief → Confidence

### The Core Insight

> **Identity is earned through repetition, not guessed through search.**

The system doesn't try to "understand" what an item is. Understanding is expensive and often wrong. Instead, it focuses on **typing** and **matching**.

### Three-Stage Model

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER UTTERANCE                          │
│              "Crime and Punishment book by Dostoevsky"          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     1. PERCEPTION (Normalize)                   │
│                                                                 │
│  What did the user say? Strip noise, extract signal.           │
│                                                                 │
│  Input:  "Crime and Punishment book by Dostoevsky"             │
│  Output: "crime and punishment" + type: BOOK                   │
│                                                                 │
│  Rules:                                                        │
│  - Lowercase everything                                        │
│  - Remove filler words (my, the, a, thing, stuff)             │
│  - Remove "by [author]" patterns                               │
│  - Remove redundant type suffix for long titles                │
│  - Detect item type from keywords                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     2. BELIEF (Match)                           │
│                                                                 │
│  Have we seen this before? Compare against existing canonicals.│
│                                                                 │
│  Method: Vector similarity search on canonical embeddings      │
│                                                                 │
│  Similarity > 0.85  →  AUTO-REUSE (same item, add as alias)   │
│  Similarity 0.65-0.85 →  ASK USER (might be same, clarify)    │
│  Similarity < 0.65  →  CREATE NEW (different item)            │
│                                                                 │
│  Key: We don't KNOW it's the same. We BELIEVE it might be.    │
│  The user confirms or denies, building our confidence.         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   3. CONFIDENCE (Learn)                         │
│                                                                 │
│  Each interaction strengthens or weakens our belief.           │
│                                                                 │
│  New canonical created:           confidence = 0.50            │
│  User confirms match:             confidence += 0.10           │
│  User explicitly says "new item": confidence = 0.60 (new)      │
│  Used 3+ times:                   confidence += 0.05 per use   │
│  Maximum confidence:              1.00                         │
│                                                                 │
│  Rule: Never delete early. Only consolidate.                   │
│  Low-confidence items may later merge with high-confidence ones│
└─────────────────────────────────────────────────────────────────┘
```

### Why This Works

1. **Cheap to compute**: Normalization is rule-based, no API calls needed
2. **Semantic matching**: Vector similarity catches paraphrases
3. **Human in the loop**: Ambiguous cases ask the user, not guess
4. **Self-improving**: Confidence grows with use, aliases accumulate
5. **No data loss**: We never delete, only link and merge

---

## Data Model

### CanonicalItem Node

```cypher
(:CanonicalItem {
    id: "uuid",
    user_id: "user-uuid",
    canonical_name: "crime and punishment",
    item_type: "book",
    aliases: ["crime punishment", "dostoevsky book", "that russian novel"],
    confidence: 0.71,
    embedding: [float array for similarity search],
    created_at: datetime,
    updated_at: datetime
})
```

### Relationships

```
(Thing)-[:CANONICAL]->(CanonicalItem)
```

Multiple Thing nodes can point to the same CanonicalItem (e.g., if user has two copies of the same book in different locations).

---

## Implementation

### File Structure

```
services/
├── canonical_service.py    # Core canonical resolution logic (NEW)
├── memory_service.py       # Embedding & similarity search (UPDATED)
├── graph_service.py        # Neo4j operations (UPDATED)

spatial_memory_agent/
├── agent.py                # Agent tools & instructions (UPDATED)

models/
├── entities.py             # CanonicalItem model (pre-existing)
├── graph_schema.py         # Node labels & relationships (pre-existing)
```

### Key Files Explained

---

#### 1. `services/canonical_service.py` (NEW)

The brain of canonical resolution. Handles the entire Perception → Belief → Confidence flow.

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `normalize_name(utterance)` | Strip filler words, detect type, normalize to canonical form |
| `find_canonical_match(name, user_id)` | Vector similarity search against existing canonicals |
| `resolve_or_create(utterance, user_id)` | **Main entry point** - returns action: `reuse`/`clarify`/`create` |
| `confirm_match(canonical_id, utterance)` | User confirmed match - add alias, boost confidence |
| `reject_match_and_create(utterance)` | User said it's different - create new with higher confidence |
| `boost_confidence(canonical_id, amount)` | Increase confidence (capped at 1.0) |
| `add_alias_to_canonical(canonical_id, alias)` | Add new alias, re-embed for better future matching |

**Normalization Examples:**

| Input | Output | Detected Type |
|-------|--------|---------------|
| "Crime and Punishment book by Dostoevsky" | "crime and punishment" | BOOK |
| "my blue pen" | "blue pen" | MISC |
| "laptop charger" | "laptop charger" | ELECTRONIC |
| "the old wallet" | "wallet" | PERSONAL |

---

#### 2. `services/graph_service.py` (UPDATED)

Modified `remember_thing()` to integrate canonical resolution before creating Things.

**New Flow:**

```python
def remember_thing(thing_name, location, ..., canonical_id=None):
    # Step 1: Resolve canonical (unless pre-provided)
    if not canonical_id:
        resolution = canonical_service.resolve_or_create(thing_name)
        
        if resolution["action"] == "clarify":
            return {
                "status": "needs_clarification",
                "candidates": [...],
                "message": "Is this the same as X?"
            }
    
    # Step 2: Create Thing linked to Canonical
    ...
    self._link_thing_to_canonical(thing_id, canonical_id)
```

**New Methods:**

| Method | Purpose |
|--------|---------|
| `remember_thing_confirmed(...)` | Store thing after user confirms canonical match |
| `remember_thing_new(...)` | Store thing as explicitly new (user rejected match) |
| `_link_thing_to_canonical(thing_id, canonical_id)` | Create CANONICAL relationship |

---

#### 3. `services/memory_service.py` (UPDATED)

Added methods for canonical embeddings to enable similarity search. These are called by `CanonicalService` for clean separation of concerns - all embedding logic lives in MemoryService.

**New Methods:**

| Method | Purpose |
|--------|---------|
| `embed_canonical(canonical_id, embedding_text)` | Generate and store embedding for canonical item |
| `canonical_similarity_search(query, user_id)` | Search canonical embeddings for similar items |

**Usage in CanonicalService:**
```python
# Finding matches
results = self.memory_service.canonical_similarity_search(query=name, user_id=self.user_id)

# Creating/updating embeddings
self.memory_service.embed_canonical(canonical.id, embedding_text)
```

---

#### 4. `spatial_memory_agent/agent.py` (UPDATED)

New tools for the confirmation flow when clarification is needed.

**New Tools:**

| Tool | When to Use |
|------|-------------|
| `confirm_item_match(canonical_id, thing_name, location, ...)` | User said "Yes, it's the same item" |
| `create_new_item(thing_name, location, ...)` | User said "No, it's a different item" |

**Updated Instructions:**

The agent now knows to:
1. Check if `remember_thing` returns `needs_clarification: true`
2. Present candidates naturally: "I noticed you already have X. Is this the same?"
3. Based on user response, call `confirm_item_match` or `create_new_item`

---

## User Experience Examples

### Example 1: New Item (No Match)

```
User: "I put my blue pen in the desk drawer"

System:
  1. Normalize: "blue pen" (type: MISC)
  2. Search canonicals: No matches above 0.65
  3. Action: CREATE

Agent: "Got it! I've stored your blue pen in the desk drawer."
```

### Example 2: Clear Match (Auto-Reuse)

```
User: "I moved my blue pen to the kitchen"

System:
  1. Normalize: "blue pen"
  2. Search: Found "blue pen" with 0.92 similarity
  3. Action: REUSE (> 0.85 threshold)

Agent: "I've updated the location of your blue pen to the kitchen."
```

### Example 3: Ambiguous Match (Clarification Needed)

```
User: "I put my pen in the office"

System:
  1. Normalize: "pen"
  2. Search: Found "blue pen" with 0.78 similarity
  3. Action: CLARIFY (0.65 < similarity < 0.85)

Agent: "I noticed you already have a blue pen. Is this the same pen, 
        or a different one?"

User: "It's a different one, a black pen"

System:
  1. User rejected match
  2. Create new canonical "pen" with confidence 0.6

Agent: "Got it! I've stored your pen as a new item in the office."
```

### Example 4: Book Title Variations (Same Item, Different Phrasings)

```
User: "Crime and Punishment book is in the bedroom bookshelf"

System:
  1. Normalize: "crime and punishment" (type: BOOK)
  2. Search: No match
  3. CREATE with confidence 0.5

--- Later ---

User: "Where's my Crime and Punishment book by Dostoevsky?"

System:
  1. Normalize: "crime and punishment" (type: BOOK)
  2. Search: Found "crime and punishment" with 0.98 similarity
  3. REUSE - add original utterance as alias

Agent: "Your Crime and Punishment is in the bedroom bookshelf."
```

---

## Thresholds & Tuning

| Constant | Value | Meaning |
|----------|-------|---------|
| `THRESHOLD_AUTO_REUSE` | 0.85 | Above this, auto-match without asking |
| `THRESHOLD_CLARIFY` | 0.65 | Between this and auto-reuse, ask user |
| Below 0.65 | - | Create new canonical |

**Tuning Guidelines:**

- Too many false positives (wrong matches)? → Raise `THRESHOLD_AUTO_REUSE`
- Too many clarification prompts? → Lower `THRESHOLD_CLARIFY`
- Missing obvious matches? → Lower both thresholds

---

## Key Principle

> **The system doesn't need to be right. It needs to learn.**

Every interaction is an opportunity to build confidence:
- Wrong guesses are corrected by users
- Right guesses are reinforced
- Over time, the canonical graph becomes a faithful representation of the user's mental model

This is not AI trying to be smart. This is a system designed to **listen, ask, and remember**.
