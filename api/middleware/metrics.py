"""Request timing middleware for metrics collection."""
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from services.metrics_service import get_metrics_service


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Middleware to track request timing and collect metrics."""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip metrics for admin and health endpoints
        skip_paths = ["/admin", "/health", "/docs", "/openapi.json", "/redoc"]
        path = request.url.path
        
        if any(path.startswith(p) for p in skip_paths):
            return await call_next(request)
        
        start_time = time.perf_counter()
        
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            raise
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000
            
            # Normalize paths with IDs
            endpoint = self._normalize_path(path)
            
            # Record metrics
            metrics = get_metrics_service()
            metrics.record_request(
                endpoint=endpoint,
                method=request.method,
                status_code=status_code,
                duration_ms=duration_ms
            )
        
        return response
    
    def _normalize_path(self, path: str) -> str:
        """Normalize paths to group by pattern, not specific IDs."""
        parts = path.split("/")
        normalized = []
        
        for part in parts:
            # Replace UUIDs with placeholder
            if len(part) == 36 and part.count("-") == 4:
                normalized.append("{id}")
            # Replace other likely IDs (numeric or alphanumeric)
            elif part and part.isdigit():
                normalized.append("{id}")
            else:
                normalized.append(part)
        
        return "/".join(normalized)
