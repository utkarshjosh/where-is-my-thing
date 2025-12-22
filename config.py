"""Configuration settings for Spatial Memory system."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Google AI Studio
    google_api_key: str = ""
    model_name: str = "gemini-2.0-flash"
    
    # Embeddings
    embedding_model: str = "text-embedding-004"
    embedding_batch_size: int = 100
    
    # Neo4j Connection
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_username: str = "neo4j"
    neo4j_password: str = "password123"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
