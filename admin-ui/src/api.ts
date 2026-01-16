const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface SystemHealth {
    status: string;
    neo4j: string;
    groq_api: string;
    uptime_seconds: number;
    version: string;
}

export interface DataStats {
    users: number;
    things: number;
    places: number;
    nodes_total: number;
}

export interface MetricsSummary {
    uptime_seconds: number;
    total_requests: number;
    total_errors: number;
    avg_latency_ms: number;
    error_rate: number;
    endpoints_count: number;
    endpoints: Record<string, EndpointMetric>;
}

export interface EndpointMetric {
    calls: number;
    avg_ms: number;
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
    errors: number;
    error_rate: number;
}

export interface RateLimitStats {
    total_requests: number;
    rate_limited_requests: number;
    current_tokens: number;
    requests_in_window: number;
    limit_per_second: number;
}

export interface CacheStats {
    jwks_cache: CacheStat;
    user_id_cache: CacheStat;
}

export interface CacheStat {
    size: number;
    maxsize: number;
    hits: number;
    misses: number;
    hit_rate: number;
}

export interface RequestLog {
    endpoint: string;
    method: string;
    status: number;
    duration_ms: number;
    timestamp: number;
}

async function fetchApi<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

export const api = {
    getHealth: () => fetchApi<SystemHealth>('/admin/health'),
    getStats: () => fetchApi<DataStats>('/admin/stats'),
    getMetrics: () => fetchApi<MetricsSummary>('/admin/metrics'),
    getRateLimit: () => fetchApi<RateLimitStats>('/admin/rate-limit'),
    getCache: () => fetchApi<CacheStats>('/admin/cache'),
    getLogs: (limit = 50) => fetchApi<{ requests: RequestLog[] }>(`/admin/logs?limit=${limit}`),
};
