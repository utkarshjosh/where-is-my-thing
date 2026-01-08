"""FastAPI application for Spatial Memory API."""
# Load environment variables FIRST, before any Google AI imports
from dotenv import load_dotenv
load_dotenv()

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.thing_routes import router
from api.routes.queries import router as queries_router
from api.routes.users import router as users_router
from api.routes.items import router as items_router
from api.routes.graph import router as graph_router
from api.routes.voice import router as voice_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print("🧠 Spatial Memory API starting up...")
    yield
    # Shutdown
    print("🧠 Spatial Memory API shutting down...")
    # Cleanup Groq service HTTP client
    from services.groq_service import get_groq_service
    try:
        groq_service = get_groq_service()
        await groq_service.close()
        print("✅ Groq service cleaned up")
    except Exception as e:
        print(f"⚠️  Error cleaning up Groq service: {e}")


app = FastAPI(
    title="Spatial Memory API",
    description="A personal knowledge graph for tracking where you keep things",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)
app.include_router(queries_router)
app.include_router(users_router)
app.include_router(items_router)
app.include_router(graph_router)
app.include_router(voice_router)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "Spatial Memory API",
        "version": "0.1.0",
        "description": "A personal knowledge graph for tracking where you keep things",
        "docs": "/docs",
        "endpoints": [
            "POST /thing/remember",
            "POST /thing/find",
            "POST /thing/move",
            "POST /thing/associate",
            "POST /place/contents",
            "POST /intent/attach",
            "POST /query/smart",
            "POST /query/similar/{thing_id}",
            "GET /query/explain",
            "GET /items",
            "GET /items/search",
            "GET /items/{id}",
            "GET /graph",
            "GET /graph/nodes",
            "GET /graph/edges",
            "WS /agent/voice",
        ]
    }

