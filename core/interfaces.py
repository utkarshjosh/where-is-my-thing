"""Core interfaces for dependency injection and abstraction."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class EmbeddingResult:
    """Embedding with metadata for versioning.
    
    Attributes:
        vector: The embedding vector (list of floats)
        model: Model name used (e.g., "text-embedding-004")
        version: Application version for re-indexing (e.g., "v1.0")
        dimension: Vector dimension (e.g., 768)
    """
    vector: list[float]
    model: str
    version: str
    dimension: int


class IEmbeddingProvider(ABC):
    """Abstract embedding provider interface.
    
    Swap vendors without losing data - embeddings are stored with
    model/version metadata so stale embeddings can be re-indexed
    when providers change.
    """
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Model identifier (e.g., 'text-embedding-004')."""
        ...
    
    @property
    @abstractmethod
    def version(self) -> str:
        """Application version - bump when re-indexing needed."""
        ...
    
    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Vector dimensions for this model."""
        ...
    
    @abstractmethod
    def embed_text(self, text: str) -> EmbeddingResult:
        """Embed a text string for storage."""
        ...
    
    @abstractmethod
    def embed_query(self, query: str) -> EmbeddingResult:
        """Embed a query string for search (may differ from text embedding)."""
        ...
    
    @abstractmethod
    def embed_batch(self, texts: list[str]) -> list[EmbeddingResult]:
        """Embed multiple texts efficiently."""
        ...
