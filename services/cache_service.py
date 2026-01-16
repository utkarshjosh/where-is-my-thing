"""Caching service for performance-critical lookups.

Provides LRU caching for:
- JWKS (Clerk) clients with TTL
- User ID mappings (Clerk ID → local ID)
"""
import time
import threading
from functools import lru_cache
from typing import Optional, Dict, Any
from collections import OrderedDict
import logging

logger = logging.getLogger(__name__)


class TTLCache:
    """Thread-safe LRU cache with TTL expiration."""
    
    def __init__(self, maxsize: int = 128, ttl_seconds: int = 300):
        """Initialize cache.
        
        Args:
            maxsize: Maximum number of items in cache
            ttl_seconds: Time-to-live for each entry in seconds
        """
        self.maxsize = maxsize
        self.ttl = ttl_seconds
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if exists and not expired."""
        with self._lock:
            if key in self._cache:
                value, expiry = self._cache[key]
                if time.time() < expiry:
                    # Move to end (most recently used)
                    self._cache.move_to_end(key)
                    self._hits += 1
                    return value
                else:
                    # Expired, remove it
                    del self._cache[key]
            self._misses += 1
            return None
    
    def set(self, key: str, value: Any) -> None:
        """Set value in cache with TTL."""
        with self._lock:
            expiry = time.time() + self.ttl
            # Remove if exists
            if key in self._cache:
                del self._cache[key]
            # Add to end
            self._cache[key] = (value, expiry)
            # Evict oldest if over capacity
            while len(self._cache) > self.maxsize:
                self._cache.popitem(last=False)
    
    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()
    
    def get_stats(self) -> dict:
        """Get cache statistics."""
        with self._lock:
            total = self._hits + self._misses
            return {
                "size": len(self._cache),
                "maxsize": self.maxsize,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": self._hits / total if total > 0 else 0,
            }


# Global cache instances
_jwks_cache: Optional[TTLCache] = None
_user_id_cache: Optional[TTLCache] = None


def get_jwks_cache() -> TTLCache:
    """Get JWKS client cache (5 minute TTL)."""
    global _jwks_cache
    if _jwks_cache is None:
        _jwks_cache = TTLCache(maxsize=10, ttl_seconds=300)  # 5 min TTL
    return _jwks_cache


def get_user_id_cache() -> TTLCache:
    """Get user ID mapping cache (5 minute TTL)."""
    global _user_id_cache
    if _user_id_cache is None:
        _user_id_cache = TTLCache(maxsize=1000, ttl_seconds=300)  # 5 min TTL
    return _user_id_cache


def get_cache_stats() -> dict:
    """Get stats for all caches."""
    return {
        "jwks_cache": get_jwks_cache().get_stats(),
        "user_id_cache": get_user_id_cache().get_stats(),
    }
