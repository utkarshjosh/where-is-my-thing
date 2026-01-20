"""Configuration settings for Spatial Memory system."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Groq API (LLM)
    groq_llm_api_key: str = ""
    
    # Groq API (Voice: TTS, STT)
    groq_voice_api_key: str = ""
    
    # LLM Model (via LiteLLM)
    llm_model: str = "groq/qwen-qwq-32b"
    
    # TTS Model (Orpheus)
    tts_model: str = "canopylabs/orpheus-v1-english"
    tts_voice: str = "autumn"
    
    # STT Model (Whisper)
    stt_model: str = "whisper-large-v3-turbo"
    
    # Embeddings (Google AI)
    google_api_key: str = ""
    embedding_model: str = "text-embedding-004"
    embedding_batch_size: int = 100
    
    # Neo4j Connection
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_username: str = "neo4j"
    neo4j_password: str = "password123"
    
    # Clerk Authentication
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra env variables not defined in this class


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
