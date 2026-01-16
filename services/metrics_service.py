"""Metrics collection service for API performance monitoring."""
import time
import threading
from collections import defaultdict, deque
from typing import Dict, List, Optional
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class RequestMetric:
    """Single request metric."""
    endpoint: str
    method: str
    status_code: int
    duration_ms: float
    timestamp: float


class MetricsService:
    """Collects and aggregates API request metrics."""
    
    def __init__(self, max_history: int = 10000):
        """Initialize metrics service.
        
        Args:
            max_history: Maximum number of requests to keep in memory
        """
        self._lock = threading.Lock()
        self._requests: deque = deque(maxlen=max_history)
        self._endpoint_stats: Dict[str, dict] = defaultdict(
            lambda: {"count": 0, "total_ms": 0.0, "errors": 0, "latencies": []}
        )
        self._start_time = time.time()
    
    def record_request(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float
    ) -> None:
        """Record a single request metric."""
        with self._lock:
            metric = RequestMetric(
                endpoint=endpoint,
                method=method,
                status_code=status_code,
                duration_ms=duration_ms,
                timestamp=time.time()
            )
            self._requests.append(metric)
            
            # Update endpoint stats
            key = f"{method} {endpoint}"
            stats = self._endpoint_stats[key]
            stats["count"] += 1
            stats["total_ms"] += duration_ms
            if status_code >= 400:
                stats["errors"] += 1
            
            # Keep last 100 latencies for percentile calculation
            if len(stats["latencies"]) >= 100:
                stats["latencies"].pop(0)
            stats["latencies"].append(duration_ms)
    
    def get_endpoint_stats(self) -> Dict[str, dict]:
        """Get per-endpoint statistics."""
        with self._lock:
            result = {}
            for key, stats in self._endpoint_stats.items():
                latencies = sorted(stats["latencies"])
                n = len(latencies)
                
                result[key] = {
                    "calls": stats["count"],
                    "avg_ms": round(stats["total_ms"] / stats["count"], 2) if stats["count"] > 0 else 0,
                    "p50_ms": round(latencies[n // 2], 2) if n > 0 else 0,
                    "p95_ms": round(latencies[int(n * 0.95)], 2) if n > 0 else 0,
                    "p99_ms": round(latencies[int(n * 0.99)], 2) if n > 0 else 0,
                    "errors": stats["errors"],
                    "error_rate": round(stats["errors"] / stats["count"] * 100, 2) if stats["count"] > 0 else 0,
                }
            return result
    
    def get_recent_requests(self, limit: int = 50) -> List[dict]:
        """Get most recent requests."""
        with self._lock:
            requests = list(self._requests)[-limit:]
            return [
                {
                    "endpoint": r.endpoint,
                    "method": r.method,
                    "status": r.status_code,
                    "duration_ms": round(r.duration_ms, 2),
                    "timestamp": r.timestamp,
                }
                for r in reversed(requests)
            ]
    
    def get_summary(self) -> dict:
        """Get overall metrics summary."""
        with self._lock:
            total_requests = sum(s["count"] for s in self._endpoint_stats.values())
            total_errors = sum(s["errors"] for s in self._endpoint_stats.values())
            total_duration = sum(s["total_ms"] for s in self._endpoint_stats.values())
            
            return {
                "uptime_seconds": round(time.time() - self._start_time, 0),
                "total_requests": total_requests,
                "total_errors": total_errors,
                "avg_latency_ms": round(total_duration / total_requests, 2) if total_requests > 0 else 0,
                "error_rate": round(total_errors / total_requests * 100, 2) if total_requests > 0 else 0,
                "endpoints_count": len(self._endpoint_stats),
            }


# Global metrics instance
_metrics: Optional[MetricsService] = None


def get_metrics_service() -> MetricsService:
    """Get global metrics service instance."""
    global _metrics
    if _metrics is None:
        _metrics = MetricsService()
    return _metrics
