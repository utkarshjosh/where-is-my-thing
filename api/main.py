"""FastAPI application for Spatial Memory API."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.thing_routes import router
from api.routes.queries import router as queries_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print("🧠 Spatial Memory API starting up...")
    yield
    # Shutdown
    print("🧠 Spatial Memory API shutting down...")


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
        ]
    }

