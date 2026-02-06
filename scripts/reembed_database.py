#!/usr/bin/env python3
"""Re-create vector indexes (3072 dims for gemini-embedding-001) and re-embed all Things and CanonicalItems.

Run this after switching embedding model (e.g. text-embedding-004 → gemini-embedding-001).
Neo4j vector index dimensions cannot be changed in place; indexes must be dropped and recreated.

Usage:
    python scripts/reembed_database.py

Requires: Neo4j running, GOOGLE_API_KEY set, schema already applied (constraints exist).
"""
import sys
from neo4j import GraphDatabase

from config import get_settings
from models.graph_schema import VECTOR_INDEX_SETUP
from services.db_pool import get_neo4j_driver
from services.memory_service import MemoryService


VECTOR_INDEX_NAMES = ("thing_embedding", "canonical_embedding")


def drop_vector_indexes(driver):
    """Drop existing vector indexes so we can recreate them with new dimensions."""
    with driver.session() as session:
        result = session.run("SHOW INDEXES")
        indexes = {r.get("name") for r in result if r.get("name")}
    for name in VECTOR_INDEX_NAMES:
        if name not in indexes:
            print(f"   ⏭ Index '{name}' not present (already dropped or never created)")
            continue
        with driver.session() as session:
            try:
                session.run(f"DROP INDEX {name}")
                print(f"   ✓ Dropped index: {name}")
            except Exception as e:
                print(f"   ⚠ Failed to drop '{name}': {e}")


def create_vector_indexes(driver):
    """Create vector indexes with current schema (3072 dimensions)."""
    for statement in VECTOR_INDEX_SETUP.split(";"):
        lines = [line for line in statement.split("\n") if line.strip() and not line.strip().startswith("//")]
        stmt = "\n".join(lines).strip()
        if not stmt:
            continue
        with driver.session() as session:
            try:
                session.run(stmt)
                if "thing_embedding" in stmt:
                    print("   ✓ Created vector index 'thing_embedding' (3072 dims)")
                elif "canonical_embedding" in stmt:
                    print("   ✓ Created vector index 'canonical_embedding' (3072 dims)")
            except Exception as e:
                print(f"   ⚠ Vector index error: {e}")


def reembed_things(memory: MemoryService, driver):
    """Re-embed all Things. Uses stored embedding_text when present, else builds from node props."""
    with driver.session() as session:
        result = session.run("""
            MATCH (t:Thing)
            RETURN t.id as id, t.embedding_text as embedding_text,
                   t.name as name, t.description as description, t.tags as tags
        """)
        rows = list(result)
    if not rows:
        print("   No Things to re-embed.")
        return
    print(f"   Re-embedding {len(rows)} Thing(s)...")
    done = 0
    for r in rows:
        text = r.get("embedding_text")
        if not text:
            parts = [r.get("name") or "Thing"]
            if r.get("description"):
                parts.append(str(r["description"]))
            if r.get("tags"):
                parts.append("Tags: " + ", ".join(r["tags"]))
            text = ". ".join(parts)
        try:
            memory.embed_thing(r["id"], text)
            done += 1
        except Exception as e:
            print(f"   ⚠ Thing {r['id']}: {e}")
    print(f"   ✓ Embedded {done}/{len(rows)} Things.")


def reembed_canonicals(memory: MemoryService, driver):
    """Re-embed all CanonicalItems. Uses stored embedding_text when present, else builds from name + aliases."""
    with driver.session() as session:
        result = session.run("""
            MATCH (c:CanonicalItem)
            RETURN c.id as id, c.embedding_text as embedding_text,
                   c.canonical_name as canonical_name, c.aliases as aliases, c.item_type as item_type
        """)
        rows = list(result)
    if not rows:
        print("   No CanonicalItems to re-embed.")
        return
    print(f"   Re-embedding {len(rows)} CanonicalItem(s)...")
    done = 0
    for r in rows:
        text = r.get("embedding_text")
        if not text:
            parts = [r.get("canonical_name") or "Item"]
            if r.get("aliases"):
                parts.append("Aliases: " + ", ".join(r["aliases"]))
            if r.get("item_type"):
                parts.append("Type: " + str(r["item_type"]))
            text = ". ".join(parts)
        try:
            memory.embed_canonical(r["id"], text)
            done += 1
        except Exception as e:
            print(f"   ⚠ CanonicalItem {r['id']}: {e}")
    print(f"   ✓ Embedded {done}/{len(rows)} CanonicalItems.")


def main():
    settings = get_settings()
    if not settings.google_api_key:
        print("ERROR: GOOGLE_API_KEY not set. Set it in .env or environment.")
        sys.exit(1)

    driver = get_neo4j_driver()
    print("🔄 Re-embed database (gemini-embedding-001, 3072 dims)")
    print(f"   Neo4j: {settings.neo4j_uri}")

    print("\n📋 Dropping existing vector indexes...")
    drop_vector_indexes(driver)

    print("\n🔍 Creating vector indexes (3072 dimensions)...")
    create_vector_indexes(driver)

    print("\n📝 Re-embedding nodes...")
    memory = MemoryService()
    reembed_things(memory, driver)
    reembed_canonicals(memory, driver)

    print("\n✅ Re-embed complete.")


if __name__ == "__main__":
    main()
