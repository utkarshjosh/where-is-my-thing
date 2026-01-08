# Rate Limiting Fixes for Groq API

## Problem
The agent was getting rate limited easily despite having a 6000 requests/minute limit (100 requests/second) for Groq Qwen 32B. The main issues were:

1. **No connection pooling**: Each API call created a new HTTP client, wasting resources
2. **No rate limiting**: Requests were sent without throttling, easily exceeding limits
3. **No retry logic**: Rate limit errors (429) caused immediate failures
4. **No request queuing**: Concurrent requests could overwhelm the API

## Solutions Implemented

### 1. Connection Pooling (`services/groq_service.py`)
- **Before**: Created new `httpx.AsyncClient` for each request
- **After**: Persistent HTTP client with connection pooling
  - Reuses connections across requests
  - HTTP/2 support for better performance
  - Configurable connection limits (20 keepalive, 100 max)

### 2. Rate Limiter (`services/rate_limiter.py`)
- **Token bucket algorithm** with sliding window tracking
- **Conservative limits**: 90 requests/second (5400/min) to leave 600/min headroom
- **Burst handling**: Allows up to 100 requests in burst scenarios
- **Automatic throttling**: Waits when rate limit is approached

### 3. Retry Logic with Exponential Backoff
- **Automatic retries**: Up to 3 retries on 429 (rate limit) errors
- **Exponential backoff**: 1s, 2s, 4s delays between retries
- **Better error handling**: Detailed logging for debugging

### 4. LiteLLM Rate Limiting Configuration (`spatial_memory_agent/agent.py`)
- Configured LiteLLM to respect rate limits via environment variable
- Set to 5400 requests/minute for the Groq model
- Prevents LiteLLM from making excessive API calls

### 5. Monitoring and Health Checks (`api/routes/voice.py`)
- Added rate limiter stats to `/agent/health` endpoint
- Tracks total requests, rate-limited requests, and current token count
- Helps monitor rate limit usage in production

## Key Changes

### Files Modified:
1. `services/groq_service.py` - Connection pooling, rate limiting, retry logic
2. `services/rate_limiter.py` - New rate limiter implementation
3. `spatial_memory_agent/agent.py` - LiteLLM rate limit configuration
4. `api/main.py` - Cleanup on shutdown
5. `api/routes/voice.py` - Health check with rate limiter stats

## Rate Limit Strategy

- **Target**: 90 requests/second (5400/minute)
- **Headroom**: Leaves 600 requests/minute buffer
- **Burst**: Allows up to 100 requests in short bursts
- **Window**: 1-second sliding window for tracking

## Testing Recommendations

1. **Load testing**: Test with multiple concurrent WebSocket connections
2. **Monitor stats**: Check `/agent/health` endpoint for rate limiter stats
3. **Watch logs**: Monitor for rate limit warnings and retries
4. **Adjust if needed**: Can tune `max_requests` in `RateLimiter` if needed

## Configuration

Rate limits are configured in:
- `services/rate_limiter.py`: `RateLimiter(max_requests=90, ...)`
- `spatial_memory_agent/agent.py`: `LITELLM_RATE_LIMIT` environment variable

To adjust limits, modify these values based on your usage patterns.

