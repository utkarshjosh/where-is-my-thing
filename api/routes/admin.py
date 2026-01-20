"""Admin routes for system monitoring and management."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import time
import os

from services.metrics_service import get_metrics_service
from services.cache_service import get_cache_stats
from services.rate_limiter import get_groq_rate_limiter, get_groq_voice_rate_limiter


router = APIRouter(prefix="/admin", tags=["admin"])


class SystemHealth(BaseModel):
    """System health overview."""
    status: str
    neo4j: str
    groq_api: str
    groq_llm_api: str
    groq_voice_api: str
    uptime_seconds: float
    version: str


class DataStats(BaseModel):
    """Data statistics."""
    users: int
    things: int
    places: int
    nodes_total: int


class RateLimitStats(BaseModel):
    """Rate limiter statistics."""
    total_requests: int
    rate_limited_requests: int
    current_tokens: float
    requests_in_window: int
    limit_per_second: int
    voice_total_requests: int
    voice_rate_limited_requests: int
    voice_current_tokens: float
    voice_requests_in_window: int
    voice_limit_per_second: int


class EndpointMetric(BaseModel):
    """Per-endpoint metrics."""
    endpoint: str
    calls: int
    avg_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    errors: int
    error_rate: float


class MetricsSummary(BaseModel):
    """Overall metrics summary."""
    uptime_seconds: float
    total_requests: int
    total_errors: int
    avg_latency_ms: float
    error_rate: float
    endpoints_count: int
    endpoints: Dict[str, Any]


@router.get("/health", response_model=SystemHealth)
async def admin_health():
    """Get overall system health status."""
    from services.db_pool import get_neo4j_driver
    from config import get_settings
    
    settings = get_settings()
    
    # Check Neo4j
    neo4j_status = "disconnected"
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            session.run("RETURN 1")
            neo4j_status = "connected"
    except Exception as e:
        neo4j_status = f"error: {str(e)[:50]}"
    
    # Check Groq API (just check if configured)
    groq_llm_status = "configured" if settings.groq_llm_api_key else "not_configured"
    groq_voice_status = "configured" if settings.groq_voice_api_key else "not_configured"
    if groq_llm_status == "configured" and groq_voice_status == "configured":
        groq_status = "configured"
    elif groq_llm_status == "configured" or groq_voice_status == "configured":
        groq_status = "partial"
    else:
        groq_status = "not_configured"
    
    # Overall status
    all_ok = neo4j_status == "connected" and groq_status == "configured"
    
    return SystemHealth(
        status="healthy" if all_ok else "degraded",
        neo4j=neo4j_status,
        groq_api=groq_status,
        groq_llm_api=groq_llm_status,
        groq_voice_api=groq_voice_status,
        uptime_seconds=get_metrics_service().get_summary()["uptime_seconds"],
        version="0.1.0"
    )


@router.get("/stats", response_model=DataStats)
async def admin_data_stats():
    """Get data statistics from Neo4j."""
    from services.db_pool import get_neo4j_driver
    
    driver = get_neo4j_driver()
    
    with driver.session() as session:
        # Get counts in single query
        result = session.run("""
            MATCH (u:User) WITH count(u) AS users
            MATCH (t:Thing) WITH users, count(t) AS things
            MATCH (p:Place) WITH users, things, count(p) AS places
            RETURN users, things, places, users + things + places AS total
        """)
        record = result.single()
        
        return DataStats(
            users=record["users"] or 0,
            things=record["things"] or 0,
            places=record["places"] or 0,
            nodes_total=record["total"] or 0
        )


@router.get("/metrics", response_model=MetricsSummary)
async def admin_metrics():
    """Get API request metrics and latency statistics."""
    metrics = get_metrics_service()
    summary = metrics.get_summary()
    endpoints = metrics.get_endpoint_stats()
    
    return MetricsSummary(
        **summary,
        endpoints=endpoints
    )


@router.get("/rate-limit", response_model=RateLimitStats)
async def admin_rate_limit():
    """Get Groq rate limiter statistics."""
    rate_limiter = get_groq_rate_limiter()
    stats = rate_limiter.get_stats()
    voice_rate_limiter = get_groq_voice_rate_limiter()
    voice_stats = voice_rate_limiter.get_stats()
    
    return RateLimitStats(
        total_requests=stats["total_requests"],
        rate_limited_requests=stats["rate_limited_requests"],
        current_tokens=round(stats["current_tokens"], 2),
        requests_in_window=stats["requests_in_window"],
        limit_per_second=90,  # From rate limiter config
        voice_total_requests=voice_stats["total_requests"],
        voice_rate_limited_requests=voice_stats["rate_limited_requests"],
        voice_current_tokens=round(voice_stats["current_tokens"], 2),
        voice_requests_in_window=voice_stats["requests_in_window"],
        voice_limit_per_second=90  # From rate limiter config
    )


@router.get("/cache")
async def admin_cache_stats():
    """Get cache statistics."""
    return get_cache_stats()


@router.get("/logs")
async def admin_recent_logs(limit: int = 50):
    """Get recent API request logs."""
    metrics = get_metrics_service()
    return {
        "requests": metrics.get_recent_requests(limit)
    }
