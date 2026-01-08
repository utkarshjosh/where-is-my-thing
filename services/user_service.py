"""User service for Neo4j operations.

Handles user CRUD operations and maps Clerk users to local User nodes.
"""
from typing import Optional
from neo4j import GraphDatabase, Driver
from models.user import User
from config import get_settings


class UserService:
    """Service for user operations in Neo4j.
    
    Provides methods to find or create users based on Clerk authentication.
    Users are automatically created on first authenticated API request.
    """
    
    def __init__(self, driver: Optional[Driver] = None):
        """Initialize with optional driver, or create from settings."""
        if driver:
            self._driver = driver
        else:
            settings = get_settings()
            self._driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_username, settings.neo4j_password)
            )
    
    def close(self):
        """Close the driver connection."""
        self._driver.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
    
    def find_or_create_user(
        self, 
        clerk_user_id: str,
        email: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None
    ) -> User:
        """Find user by Clerk ID or create if not exists.
        
        This method is called on every authenticated API request to ensure
        the user exists in Neo4j. If the user doesn't exist, they are
        created with the information from the Clerk JWT.
        
        Args:
            clerk_user_id: The Clerk user ID (from JWT 'sub' claim)
            email: User's email address
            first_name: User's first name
            last_name: User's last name
            
        Returns:
            User: The found or newly created user
        """
        with self._driver.session() as session:
            # Try to find existing user
            result = session.run(
                """
                MATCH (u:User {clerk_user_id: $clerk_user_id})
                RETURN u
                """,
                clerk_user_id=clerk_user_id
            )
            record = result.single()
            
            if record:
                node = record["u"]
                # Update user info if changed
                if email or first_name or last_name:
                    session.run(
                        """
                        MATCH (u:User {clerk_user_id: $clerk_user_id})
                        SET u.email = COALESCE($email, u.email),
                            u.first_name = COALESCE($first_name, u.first_name),
                            u.last_name = COALESCE($last_name, u.last_name),
                            u.updated_at = datetime()
                        """,
                        clerk_user_id=clerk_user_id,
                        email=email,
                        first_name=first_name,
                        last_name=last_name
                    )
                
                return User(
                    id=node["id"],
                    clerk_user_id=node["clerk_user_id"],
                    email=email or node.get("email"),
                    first_name=first_name or node.get("first_name"),
                    last_name=last_name or node.get("last_name"),
                )
            
            # Create new user
            user = User(
                clerk_user_id=clerk_user_id,
                email=email,
                first_name=first_name,
                last_name=last_name,
            )
            session.run(
                """
                CREATE (u:User {
                    id: $id,
                    clerk_user_id: $clerk_user_id,
                    email: $email,
                    first_name: $first_name,
                    last_name: $last_name,
                    created_at: datetime(),
                    updated_at: datetime()
                })
                """,
                id=user.id,
                clerk_user_id=user.clerk_user_id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
            )
            return user
    
    def get_user_by_clerk_id(self, clerk_user_id: str) -> Optional[User]:
        """Get user by Clerk user ID.
        
        Args:
            clerk_user_id: The Clerk user ID
            
        Returns:
            User if found, None otherwise
        """
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (u:User {clerk_user_id: $clerk_user_id})
                RETURN u
                """,
                clerk_user_id=clerk_user_id
            )
            record = result.single()
            if record:
                node = record["u"]
                return User(
                    id=node["id"],
                    clerk_user_id=node["clerk_user_id"],
                    email=node.get("email"),
                    first_name=node.get("first_name"),
                    last_name=node.get("last_name"),
                )
            return None
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by internal ID.
        
        Args:
            user_id: The internal user UUID
            
        Returns:
            User if found, None otherwise
        """
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (u:User {id: $user_id})
                RETURN u
                """,
                user_id=user_id
            )
            record = result.single()
            if record:
                node = record["u"]
                return User(
                    id=node["id"],
                    clerk_user_id=node["clerk_user_id"],
                    email=node.get("email"),
                    first_name=node.get("first_name"),
                    last_name=node.get("last_name"),
                )
            return None
