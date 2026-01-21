#!/usr/bin/env python3
"""Setup Neo4j schema including constraints and vector index.

Run this before starting the API to ensure all indexes are in place.

Usage:
    python scripts/setup_schema.py          # Setup only (keeps existing data)
    python scripts/setup_schema.py --reset  # DANGER: Deletes all data and recreates schema
"""
import sys
from neo4j import GraphDatabase
from config import get_settings
from models.graph_schema import SCHEMA_CONSTRAINTS, VECTOR_INDEX_SETUP


def reset_database():
    """DANGER: Delete all data and constraints from the database."""
    settings = get_settings()
    driver = GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password)
    )
    
    print("🔴 RESETTING DATABASE - This will delete ALL data!")
    print(f"   Connecting to: {settings.neo4j_uri}")
    
    with driver.session() as session:
        # First, get all constraints and drop them
        print("\n📋 Dropping all constraints...")
        try:
            result = session.run("SHOW CONSTRAINTS")
            constraints = list(result)
            for constraint in constraints:
                name = constraint.get("name")
                if name:
                    try:
                        session.run(f"DROP CONSTRAINT {name}")
                        print(f"   ✓ Dropped constraint: {name}")
                    except Exception as e:
                        print(f"   ⚠ Failed to drop {name}: {e}")
        except Exception as e:
            print(f"   ⚠ Error listing constraints: {e}")
        
        # Drop all indexes
        print("\n📋 Dropping all indexes...")
        try:
            result = session.run("SHOW INDEXES")
            indexes = list(result)
            for index in indexes:
                name = index.get("name")
                # Skip system indexes (like lookup indexes)
                if name and not name.startswith("__"):
                    try:
                        session.run(f"DROP INDEX {name}")
                        print(f"   ✓ Dropped index: {name}")
                    except Exception as e:
                        # Some indexes can't be dropped
                        if "Cannot drop" not in str(e):
                            print(f"   ⚠ Failed to drop {name}: {e}")
        except Exception as e:
            print(f"   ⚠ Error listing indexes: {e}")
        
        # Delete all nodes and relationships
        print("\n🗑️ Deleting all nodes and relationships...")
        try:
            # Use CALL IN TRANSACTIONS for large datasets
            result = session.run("""
                MATCH (n)
                CALL { WITH n DETACH DELETE n } IN TRANSACTIONS OF 10000 ROWS
                RETURN count(*) as deleted
            """)
            record = result.single()
            print(f"   ✓ Database cleared")
        except Exception as e:
            # Fallback for older Neo4j versions
            try:
                session.run("MATCH (n) DETACH DELETE n")
                print(f"   ✓ Database cleared (fallback method)")
            except Exception as e2:
                print(f"   ⚠ Error clearing database: {e2}")
    
    driver.close()
    print("\n✅ Database reset complete!")


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
            # Remove comment lines from the statement
            lines = [line for line in statement.split("\n") if not line.strip().startswith("//")]
            stmt = "\n".join(lines).strip()
            
            if stmt:
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
        
        # Run vector index setup - split by semicolons
        print("\n🔍 Creating vector indexes for semantic search...")
        for statement in VECTOR_INDEX_SETUP.split(";"):
            # Remove comment lines from the statement
            lines = [line for line in statement.split("\n") if not line.strip().startswith("//")]
            stmt = "\n".join(lines).strip()
            
            if stmt:
                try:
                    session.run(stmt)
                    # Extract index name from statement
                    if "thing_embedding" in stmt:
                        print("   ✓ Vector index 'thing_embedding' created")
                    elif "canonical_embedding" in stmt:
                        print("   ✓ Vector index 'canonical_embedding' created")
                    else:
                        print(f"   ✓ {stmt[:50]}...")
                except Exception as e:
                    error_msg = str(e)
                    if "already exists" in error_msg.lower():
                        print(f"   ⏭ Vector index already exists")
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
        # Check constraints
        result = session.run("SHOW CONSTRAINTS")
        constraints = list(result)
        print(f"   Found {len(constraints)} constraints")
        for c in constraints:
            print(f"      - {c.get('name', 'unnamed')}")
        
        # Check indexes
        result = session.run("SHOW INDEXES")
        indexes = list(result)
        print(f"   Found {len(indexes)} indexes")
        
        # Check for required vector indexes
        index_names = [i.get("name", "") for i in indexes]
        if any("thing_embedding" in n for n in index_names):
            print("   ✓ Vector index 'thing_embedding' is present")
        else:
            print("   ⚠ Vector index 'thing_embedding' not found!")
        
        if any("canonical_embedding" in n for n in index_names):
            print("   ✓ Vector index 'canonical_embedding' is present")
        else:
            print("   ⚠ Vector index 'canonical_embedding' not found!")
        
        # Show node counts
        result = session.run("""
            MATCH (n)
            WITH labels(n) as labels, count(*) as count
            UNWIND labels as label
            RETURN label, sum(count) as total
            ORDER BY total DESC
        """)
        print("\n   Node counts:")
        for record in result:
            print(f"      - {record['label']}: {record['total']}")
    
    driver.close()


def print_usage():
    print("""
Neo4j Schema Setup Script
=========================

Usage:
    python scripts/setup_schema.py          # Setup schema (keeps existing data)
    python scripts/setup_schema.py --reset  # DANGER: Delete ALL data and recreate schema
    python scripts/setup_schema.py --verify # Just verify current schema
    python scripts/setup_schema.py --help   # Show this help

The --reset flag will:
1. Drop all constraints
2. Drop all indexes  
3. Delete ALL nodes and relationships
4. Recreate the schema from scratch

Use --reset when:
- Starting fresh development
- Schema has changed significantly
- Data is corrupted or inconsistent
""")


if __name__ == "__main__":
    if "--help" in sys.argv or "-h" in sys.argv:
        print_usage()
    elif "--verify" in sys.argv:
        verify_schema()
    elif "--reset" in sys.argv:
        # Ask for confirmation
        print("\n⚠️  WARNING: This will DELETE ALL DATA in the database!")
        print("   Type 'yes' to confirm: ", end="")
        confirm = input().strip().lower()
        if confirm == "yes":
            reset_database()
            setup_schema()
            verify_schema()
        else:
            print("   Cancelled.")
    else:
        setup_schema()
        verify_schema()
