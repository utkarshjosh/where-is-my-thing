"""Rate limiter for Groq API calls.

Implements token bucket algorithm to respect Groq's rate limits:
- 6000 requests per minute = 100 requests per second
"""
import asyncio
import time
import logging
from collections import deque
from typing import Optional

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token bucket rate limiter for API calls.
    
    Rate limit: 6000 requests/minute = 100 requests/second
    We'll use a conservative 90 requests/second to leave headroom.
    """
    
    def __init__(
        self,
        max_requests: int = 90,  # Conservative: 90/sec = 5400/min (leaves 600/min headroom)
        time_window: float = 1.0,  # 1 second window
        max_burst: int = 100  # Allow small bursts
    ):
        """Initialize rate limiter.
        
        Args:
            max_requests: Maximum requests allowed in time_window
            time_window: Time window in seconds
            max_burst: Maximum burst size (tokens in bucket)
        """
        self.max_requests = max_requests
        self.time_window = time_window
        self.max_burst = max_burst
        
        # Token bucket: tokens available
        self.tokens = float(max_burst)
        
        # Request timestamps for sliding window tracking
        self.request_times: deque = deque()
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
        
        # Last token refill time
        self._last_refill = time.monotonic()
        
        # Statistics
        self.total_requests = 0
        self.rate_limited_requests = 0
    
    async def acquire(self, n: int = 1) -> None:
        """Acquire n tokens, waiting if necessary.
        
        Args:
            n: Number of tokens to acquire (default: 1)
        """
        async with self._lock:
            await self._wait_for_tokens(n)
            self.tokens -= n
            self.total_requests += n
            self.request_times.append(time.monotonic())
            
            # Clean old requests outside time window
            now = time.monotonic()
            while self.request_times and self.request_times[0] < now - self.time_window:
                self.request_times.popleft()
    
    async def _wait_for_tokens(self, n: int) -> None:
        """Wait until enough tokens are available."""
        while self.tokens < n:
            # Refill tokens based on time passed
            now = time.monotonic()
            time_passed = now - self._last_refill
            
            if time_passed > 0:
                # Refill tokens: max_requests tokens per time_window
                tokens_to_add = (time_passed / self.time_window) * self.max_requests
                self.tokens = min(self.max_burst, self.tokens + tokens_to_add)
                self._last_refill = now
            
            if self.tokens < n:
                # Calculate wait time
                tokens_needed = n - self.tokens
                wait_time = (tokens_needed / self.max_requests) * self.time_window
                
                # Also check if we're hitting the sliding window limit
                if len(self.request_times) >= self.max_requests:
                    oldest_request = self.request_times[0]
                    time_until_oldest_expires = self.time_window - (now - oldest_request)
                    wait_time = max(wait_time, time_until_oldest_expires)
                
                if wait_time > 0:
                    self.rate_limited_requests += 1
                    logger.debug(f"Rate limiting: waiting {wait_time:.3f}s for {n} tokens")
                    await asyncio.sleep(min(wait_time, 0.1))  # Sleep in small increments
    
    def get_stats(self) -> dict:
        """Get rate limiter statistics."""
        return {
            "total_requests": self.total_requests,
            "rate_limited_requests": self.rate_limited_requests,
            "current_tokens": self.tokens,
            "requests_in_window": len(self.request_times),
        }


# Global rate limiter instances
_groq_rate_limiter: Optional[RateLimiter] = None
_groq_voice_rate_limiter: Optional[RateLimiter] = None


def get_groq_rate_limiter() -> RateLimiter:
    """Get or create the global Groq rate limiter."""
    global _groq_rate_limiter
    if _groq_rate_limiter is None:
        _groq_rate_limiter = RateLimiter(
            max_requests=90,  # 90/sec = 5400/min (conservative)
            time_window=1.0,
            max_burst=100
        )
    return _groq_rate_limiter


def get_groq_voice_rate_limiter() -> RateLimiter:
    """Get or create the global Groq voice rate limiter."""
    global _groq_voice_rate_limiter
    if _groq_voice_rate_limiter is None:
        _groq_voice_rate_limiter = RateLimiter(
            max_requests=90,  # 90/sec = 5400/min (conservative)
            time_window=1.0,
            max_burst=100
        )
    return _groq_voice_rate_limiter

