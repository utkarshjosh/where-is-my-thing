"""Groq API service for TTS (Orpheus) and STT (Whisper) operations."""
import httpx
import base64
import logging
import asyncio
from typing import Optional
from config import get_settings
from services.rate_limiter import get_groq_rate_limiter

logger = logging.getLogger(__name__)


class GroqService:
    """Handles Groq TTS (Orpheus) and STT (Whisper) operations."""
    
    BASE_URL = "https://api.groq.com/openai/v1"
    
    def __init__(self):
        self.settings = get_settings()
        if not self.settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is not configured")
        
        # Create a persistent HTTP client with connection pooling
        self._client: Optional[httpx.AsyncClient] = None
        self._client_lock = asyncio.Lock()
        
        # Rate limiter
        self.rate_limiter = get_groq_rate_limiter()
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the persistent HTTP client."""
        if self._client is None:
            async with self._client_lock:
                if self._client is None:
                    # Create client with connection pooling and reasonable limits
                    limits = httpx.Limits(
                        max_keepalive_connections=20,
                        max_connections=100,
                        keepalive_expiry=30.0
                    )
                    self._client = httpx.AsyncClient(
                        timeout=httpx.Timeout(30.0, connect=10.0),
                        limits=limits
                        # HTTP/2 disabled - requires httpx[http2] dependency
                    )
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    def _get_headers(self, content_type: Optional[str] = None) -> dict:
        """Get headers for Groq API requests."""
        headers = {
            "Authorization": f"Bearer {self.settings.groq_api_key}",
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers
    
    async def speech_to_text(
        self, 
        audio_data: bytes, 
        filename: str = "audio.wav",
        language: Optional[str] = None,
        max_retries: int = 3
    ) -> str:
        """
        Transcribe audio using Groq's Whisper model.
        
        Args:
            audio_data: Raw audio bytes (WAV, MP3, etc.)
            filename: Filename with extension for mime type detection
            language: Optional language code (e.g., 'en')
            max_retries: Maximum number of retries on rate limit errors
        
        Returns:
            Transcribed text
        """
        client = await self._get_client()
        files = {
            "file": (filename, audio_data, self._get_mime_type(filename)),
        }
        data = {
            "model": self.settings.stt_model,
        }
        if language:
            data["language"] = language
        
        for attempt in range(max_retries + 1):
            try:
                # Acquire rate limit token before making request
                await self.rate_limiter.acquire()
                
                response = await client.post(
                    f"{self.BASE_URL}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.settings.groq_api_key}"},
                    files=files,
                    data=data,
                )
                response.raise_for_status()
                result = response.json()
                
                # Handle different response formats
                if isinstance(result, str):
                    transcript = result
                elif isinstance(result, dict):
                    transcript = result.get("text", "")
                else:
                    transcript = str(result)
                
                return transcript
                
            except httpx.HTTPStatusError as e:
                # Handle rate limiting (429) with retry
                if e.response.status_code == 429:
                    if attempt < max_retries:
                        # Exponential backoff: 2^attempt seconds
                        wait_time = 2 ** attempt
                        logger.warning(
                            f"Rate limited on STT (attempt {attempt + 1}/{max_retries + 1}), "
                            f"retrying in {wait_time}s"
                        )
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        error_detail = ""
                        try:
                            error_detail = e.response.json()
                        except:
                            error_detail = e.response.text
                        logger.error(f"❌ STT Rate limit exceeded after {max_retries} retries: {error_detail}")
                        raise
                else:
                    error_detail = ""
                    try:
                        error_detail = e.response.json()
                    except:
                        error_detail = e.response.text
                    logger.error(f"❌ STT HTTP Error {e.response.status_code}: {error_detail}")
                    raise
            except Exception as e:
                logger.error(f"❌ STT Error: {type(e).__name__}: {str(e)}", exc_info=True)
                raise
    
    async def text_to_speech(self, text: str, max_retries: int = 3) -> bytes:
        """
        Generate speech using Groq's Orpheus TTS model.
        
        Args:
            text: Text to convert to speech
            max_retries: Maximum number of retries on rate limit errors
        
        Returns:
            Audio bytes (WAV format)
        """
        client = await self._get_client()
        
        for attempt in range(max_retries + 1):
            try:
                # Acquire rate limit token before making request
                await self.rate_limiter.acquire()
                
                response = await client.post(
                    f"{self.BASE_URL}/audio/speech",
                    headers=self._get_headers("application/json"),
                    json={
                        "model": self.settings.tts_model,
                        "input": text,
                        "voice": self.settings.tts_voice,
                        "response_format": "wav",
                    },
                )
                response.raise_for_status()
                return response.content
                
            except httpx.HTTPStatusError as e:
                # Handle rate limiting (429) with retry
                if e.response.status_code == 429:
                    if attempt < max_retries:
                        # Exponential backoff: 2^attempt seconds
                        wait_time = 2 ** attempt
                        logger.warning(
                            f"Rate limited on TTS (attempt {attempt + 1}/{max_retries + 1}), "
                            f"retrying in {wait_time}s"
                        )
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        error_detail = ""
                        try:
                            error_detail = e.response.json()
                        except:
                            error_detail = e.response.text
                        logger.error(f"❌ TTS Rate limit exceeded after {max_retries} retries: {error_detail}")
                        raise
                else:
                    response.raise_for_status()  # Re-raise for other HTTP errors
            except Exception as e:
                logger.error(f"❌ TTS Error: {type(e).__name__}: {str(e)}", exc_info=True)
                raise
    
    def _get_mime_type(self, filename: str) -> str:
        """Get MIME type from filename extension."""
        ext = filename.lower().split(".")[-1]
        mime_types = {
            "wav": "audio/wav",
            "mp3": "audio/mpeg",
            "mp4": "audio/mp4",
            "m4a": "audio/m4a",
            "ogg": "audio/ogg",
            "webm": "audio/webm",
            "flac": "audio/flac",
            "pcm": "audio/pcm",
        }
        return mime_types.get(ext, "audio/wav")


# Singleton instance
_groq_service: Optional[GroqService] = None


def get_groq_service() -> GroqService:
    """Get or create the Groq service instance."""
    global _groq_service
    if _groq_service is None:
        _groq_service = GroqService()
    return _groq_service
