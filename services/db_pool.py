"""Singleton Neo4j driver pool for connection reuse.

Provides a shared driver instance to avoid creating new connections
for each request. The driver handles internal connection pooling.
"""
from typing import Optional
from neo4j import GraphDatabase, Driver
from config import get_settings
import logging

logger = logging.getLogger(__name__)


class Neo4jPool:
    """Singleton Neo4j driver pool."""
    
    _instance: Optional["Neo4jPool"] = None
    _driver: Optional[Driver] = None
    
    def __new__(cls) -> "Neo4jPool":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    @property
    def driver(self) -> Driver:
        """Get the shared Neo4j driver, creating if needed."""
        if self._driver is None:
            settings = get_settings()
            self._driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_username, settings.neo4j_password),
                # Connection pool settings
                max_connection_lifetime=3600,  # 1 hour
                max_connection_pool_size=50,
                connection_acquisition_timeout=60,
            )
            logger.info("Neo4j driver pool initialized")
        return self._driver
    
    async def close(self):
        """Close the driver pool (call on shutdown)."""
        if self._driver:
            self._driver.close()
            self._driver = None
            logger.info("Neo4j driver pool closed")


# Module-level accessor
_pool: Optional[Neo4jPool] = None


def get_neo4j_driver() -> Driver:
    """Get the shared Neo4j driver instance."""
    global _pool
    if _pool is None:
        _pool = Neo4jPool()
    return _pool.driver


async def close_neo4j_pool():
    """Close the Neo4j pool (call on app shutdown)."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
