"""Google GenAI embedding provider implementation."""
from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
from core.interfaces import IEmbeddingProvider, EmbeddingResult
from config import get_settings


class GoogleEmbeddingProvider(IEmbeddingProvider):
    """Google gemini-embedding-001 provider.
    
    Uses LlamaIndex's GoogleGenAIEmbedding wrapper.
    Bump VERSION when model changes to trigger re-indexing.
    """
    
    # Bump this when model changes or re-indexing needed
    VERSION = "v1.1"  # gemini-embedding-001 (3072 dims); was v1.0 text-embedding-004
    
    def __init__(self):
        settings = get_settings()
        self._model = GoogleGenAIEmbedding(
            model_name=settings.embedding_model,
            embed_batch_size=settings.embedding_batch_size,
            api_key=settings.google_api_key,
        )
        self._model_name = settings.embedding_model
    
    @property
    def model_name(self) -> str:
        return self._model_name
    
    @property
    def version(self) -> str:
        return self.VERSION
    
    @property
    def dimensions(self) -> int:
        return 3072  # gemini-embedding-001 dimension
    
    def embed_text(self, text: str) -> EmbeddingResult:
        """Embed text for storage."""
        vector = self._model.get_text_embedding(text)
        return EmbeddingResult(
            vector=vector,
            model=self.model_name,
            version=self.version,
            dimension=len(vector),
        )
    
    def embed_query(self, query: str) -> EmbeddingResult:
        """Embed query for search - uses query-specific embedding."""
        vector = self._model.get_query_embedding(query)
        return EmbeddingResult(
            vector=vector,
            model=self.model_name,
            version=self.version,
            dimension=len(vector),
        )
    
    def embed_batch(self, texts: list[str]) -> list[EmbeddingResult]:
        """Embed multiple texts efficiently."""
        vectors = self._model.get_text_embedding_batch(texts)
        return [
            EmbeddingResult(
                vector=v,
                model=self.model_name,
                version=self.version,
                dimension=len(v),
            )
            for v in vectors
        ]
