#!/usr/bin/env python3
"""Setup Neo4j schema including constraints and vector index.

Run this before starting the API to ensure all indexes are in place.
"""
from neo4j import GraphDatabase
from config import get_settings
from models.graph_schema import SCHEMA_CONSTRAINTS, VECTOR_INDEX_SETUP


def setup_schema():
    """Create all Neo4j constraints and indexes."""
    settings = get_settings()
    driver = GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password)
    )
    
    print("🔧 Setting up Neo4j schema...")
    print(f"   Connecting to: {settings.neo4j_uri}")
    
    with driver.session() as session:
        # Run constraints (split by semicolons, skip comments)
        print("\n📋 Creating constraints and indexes...")
        for statement in SCHEMA_CONSTRAINTS.split(";"):
            stmt = statement.strip()
            if stmt and not stmt.startswith("//"):
                try:
                    session.run(stmt)
                    # Extract meaningful part for display
                    display = stmt.replace("\n", " ")[:60]
                    print(f"   ✓ {display}...")
                except Exception as e:
                    error_msg = str(e)
                    if "already exists" in error_msg.lower():
                        print(f"   ⏭ Already exists: {stmt[:40]}...")
                    else:
                        print(f"   ⚠ {stmt[:40]}... - {e}")
        
        # Run vector index setup
        print("\n🔍 Creating vector index for semantic search...")
        try:
            session.run(VECTOR_INDEX_SETUP)
            print("   ✓ Vector index 'thing_embedding' created")
        except Exception as e:
            error_msg = str(e)
            if "already exists" in error_msg.lower():
                print("   ⏭ Vector index already exists")
            else:
                print(f"   ⚠ Vector index error: {e}")
    
    driver.close()
    print("\n✅ Schema setup complete!")


def verify_schema():
    """Verify the schema is correctly set up."""
    settings = get_settings()
    driver = GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password)
    )
    
    print("\n🔍 Verifying schema...")
    
    with driver.session() as session:
        # Check indexes
        result = session.run("SHOW INDEXES")
        indexes = list(result)
        print(f"   Found {len(indexes)} indexes")
        
        # Check for vector index specifically
        vector_indexes = [i for i in indexes if "thing_embedding" in str(i)]
        if vector_indexes:
            print("   ✓ Vector index 'thing_embedding' is present")
        else:
            print("   ⚠ Vector index 'thing_embedding' not found!")
    
    driver.close()


if __name__ == "__main__":
    setup_schema()
    verify_schema()
