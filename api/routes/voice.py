"""Voice agent WebSocket route for real-time audio streaming.

Uses ADK with LiteLLM (Groq) for text processing, and Groq's Whisper STT
and Orpheus TTS for audio input/output.

Optimizations:
- Binary WebSocket frames for audio (no base64 overhead)
- Sentence-level TTS streaming for lower perceived latency
"""
import asyncio
import base64
import binascii
import json
import io
import os
import logging
import re
import struct
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from starlette.websockets import WebSocketState
import jwt

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from spatial_memory_agent.agent import root_agent
from services.groq_service import get_groq_service
from services.user_service import UserService
from services.cache_service import get_user_id_cache
from config import get_settings

# Set up logger
logger = logging.getLogger(__name__)


# Binary message protocol constants
# We use a simple 1-byte header to distinguish message types in binary frames
BINARY_MSG_AUDIO = 0x01  # Audio data follows
BINARY_MSG_CONTROL = 0x02  # JSON control message follows (unused, we use text frames for JSON)


def split_into_sentences(text: str) -> List[str]:
    """Split text into sentences for streaming TTS.
    
    Uses a simple regex-based approach that handles common sentence endings
    while being careful about abbreviations and numbers.
    
    Returns a list where the last element may be an incomplete sentence.
    """
    if not text:
        return []
    
    # Pattern matches sentence-ending punctuation followed by space or end of string
    # Negative lookbehind for common abbreviations (Mr., Mrs., Dr., etc.)
    # and single letters (initials like "J. K. Rowling")
    sentence_end_pattern = r'(?<![A-Z])(?<!\b[A-Z])(?<!\bMr)(?<!\bMrs)(?<!\bMs)(?<!\bDr)(?<!\bProf)(?<!\bSr)(?<!\bJr)(?<!\bvs)(?<!\betc)(?<!\be\.g)(?<!\bi\.e)[.!?]+(?=\s|$)'
    
    # Find all sentence boundaries
    sentences = []
    last_end = 0
    
    for match in re.finditer(sentence_end_pattern, text):
        end_pos = match.end()
        sentence = text[last_end:end_pos].strip()
        if sentence:
            sentences.append(sentence)
        last_end = end_pos
    
    # Add remaining text (possibly incomplete sentence)
    remaining = text[last_end:].strip()
    if remaining:
        sentences.append(remaining)
    
    return sentences


def is_complete_sentence(text: str) -> bool:
    """Check if text ends with sentence-ending punctuation."""
    if not text:
        return False
    return text.rstrip()[-1] in '.!?'


router = APIRouter(prefix="/agent", tags=["agent"])

# Application name for ADK sessions
APP_NAME = "spatial-memory"

# Session service (in-memory for now, can be replaced with persistent storage)
session_service = InMemorySessionService()

# ADK Runner with the spatial memory agent
runner = Runner(
    app_name=APP_NAME,
    agent=root_agent,
    session_service=session_service
)

# Directory for saving debug audio files
DEBUG_AUDIO_DIR = Path("debug_audio")
try:
    DEBUG_AUDIO_DIR.mkdir(exist_ok=True)
    logger.info(f"Debug audio directory ready: {DEBUG_AUDIO_DIR.absolute()}")
except Exception as e:
    logger.error(f"Failed to create debug audio directory: {e}")
    DEBUG_AUDIO_DIR = None


async def verify_websocket_token(token: str) -> Optional[dict]:
    """Verify Clerk JWT token for WebSocket connections.
    
    Returns user claims if valid, None otherwise.
    Uses cached JWKS client to avoid network call on every connection.
    """
    try:
        # Decode without verification first to get issuer
        unverified = jwt.decode(token, options={"verify_signature": False})
        issuer = unverified.get("iss", "")
        
        # Get cached JWKS client
        from services.cache_service import get_jwks_cache
        jwks_cache = get_jwks_cache()
        
        cache_key = f"jwks:{issuer}"
        jwks_client = jwks_cache.get(cache_key)
        
        if jwks_client is None:
            from jwt import PyJWKClient
            jwks_url = f"{issuer}/.well-known/jwks.json"
            jwks_client = PyJWKClient(jwks_url)
            jwks_cache.set(cache_key, jwks_client)
        
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Verify and decode
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        
        return payload
    except Exception as e:
        logger.error(f"WebSocket auth error: {e}")
        return None


def _resolve_user_id(clerk_user_id: str, email: str = None) -> str:
    """Resolve Clerk user ID to internal user ID.
    
    Uses caching to avoid Neo4j lookup on every request.
    Creates user if not exists.
    
    Args:
        clerk_user_id: The Clerk user ID (from JWT 'sub' claim)
        email: Optional email from JWT
        
    Returns:
        Internal user UUID
        
    Raises:
        ConnectionError: If Neo4j is not available
    """
    from neo4j.exceptions import ServiceUnavailable
    
    cache = get_user_id_cache()
    
    # Check cache first
    cache_key = f"user:{clerk_user_id}"
    cached_id = cache.get(cache_key)
    if cached_id:
        return cached_id
    
    # Cache miss - query Neo4j
    try:
        with UserService() as us:
            user = us.find_or_create_user(
                clerk_user_id=clerk_user_id,
                email=email,
            )
    except ServiceUnavailable as e:
        logger.error(f"Neo4j connection failed: {e}")
        raise ConnectionError(
            "Database connection failed. Please ensure Neo4j is running. "
            "Try: sudo systemctl start neo4j.service"
        ) from e
    except Exception as e:
        logger.error(f"Failed to resolve user ID: {e}", exc_info=True)
        raise
    
    # Cache the result
    cache.set(cache_key, user.id)
    return user.id


def detect_audio_format(audio_data: bytes) -> str:
    """Detect audio format from file headers."""
    if len(audio_data) < 12:
        return "unknown"
    
    # Check for WAV (RIFF...WAVE)
    if audio_data[:4] == b'RIFF' and audio_data[8:12] == b'WAVE':
        return "wav"
    
    # Check for MP3 (ID3 tag or MP3 sync word)
    if audio_data[:3] == b'ID3' or (len(audio_data) >= 3 and audio_data[:3] == b'\xff\xfb\x90'):
        return "mp3"
    
    # Check for M4A/AAC (ftyp box)
    if audio_data[4:8] == b'ftyp':
        if b'm4a' in audio_data[8:20] or b'M4A' in audio_data[8:20]:
            return "m4a"
        elif b'isom' in audio_data[8:20] or b'iso2' in audio_data[8:20]:
            return "m4a"
    
    # Check for FLAC (fLaC)
    if audio_data[:4] == b'fLaC':
        return "flac"
    
    # Check for OGG (OggS)
    if audio_data[:4] == b'OggS':
        return "ogg"
    
    # Check for WebM (starts with EBML header)
    if audio_data[:4] == b'\x1a\x45\xdf\xa3':
        return "webm"
    
    # If no known header, assume raw PCM
    return "pcm"


def create_wav_header(audio_data: bytes, sample_rate: int = 24000, channels: int = 1, bits_per_sample: int = 16) -> bytes:
    """Create a WAV header for raw PCM audio data."""
    data_size = len(audio_data)
    file_size = data_size + 36
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    
    header = bytearray()
    header.extend(b'RIFF')
    header.extend(file_size.to_bytes(4, 'little'))
    header.extend(b'WAVE')
    header.extend(b'fmt ')
    header.extend((16).to_bytes(4, 'little'))  # Subchunk1Size
    header.extend((1).to_bytes(2, 'little'))   # AudioFormat (PCM)
    header.extend(channels.to_bytes(2, 'little'))
    header.extend(sample_rate.to_bytes(4, 'little'))
    header.extend(byte_rate.to_bytes(4, 'little'))
    header.extend(block_align.to_bytes(2, 'little'))
    header.extend(bits_per_sample.to_bytes(2, 'little'))
    header.extend(b'data')
    header.extend(data_size.to_bytes(4, 'little'))
    
    return bytes(header) + audio_data


def clean_text_for_tts(text: str) -> str:
    """Clean text to be speech-friendly for TTS.
    
    Removes:
    - Markdown formatting (asterisks, underscores)
    - Emojis
    - Visual indicators that don't translate well to speech
    
    Converts:
    - Arrow symbols (→) to "in" for location paths
    - Hash tags to "tagged as"
    - Other visual elements to natural speech
    """
    if not text:
        return text
    
    # Remove emojis (Unicode ranges for common emoji)
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags
        "\U00002702-\U000027B0"  # dingbats
        "\U000024C2-\U0001F251"  # enclosed characters
        "\U0001F900-\U0001F9FF"  # supplemental symbols
        "\U0001FA00-\U0001FA6F"  # chess symbols
        "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-A
        "\U00002600-\U000026FF"  # miscellaneous symbols
        "\U00002700-\U000027BF"  # dingbats
        "]+",
        flags=re.UNICODE
    )
    text = emoji_pattern.sub('', text)
    
    # Remove markdown formatting (asterisks, underscores)
    # Remove bold/italic markers: **text**, *text*, __text__, _text_
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # **bold**
    text = re.sub(r'\*([^*]+)\*', r'\1', text)  # *italic*
    text = re.sub(r'__([^_]+)__', r'\1', text)  # __bold__
    text = re.sub(r'_([^_]+)_', r'\1', text)  # _italic_
    
    # Convert arrow symbols to natural speech (handle multiple arrows in paths)
    # Replace "→" with " in " for location paths
    text = text.replace('→', ' in ')
    
    # Convert hash tags to natural speech
    # Replace each tag individually: "#tag" -> "tagged as tag"
    text = re.sub(r'#(\w+)', r'tagged as \1', text)
    
    # Remove any remaining asterisks or underscores
    text = re.sub(r'\*+', '', text)
    text = re.sub(r'_+', '', text)
    
    # Replace common visual patterns with speech-friendly alternatives
    # "Located in: location" -> "Located in location"
    text = re.sub(r'Located in:\s*', 'Located in ', text)
    text = re.sub(r'Tags:\s*', 'Tags: ', text)
    
    # Clean up extra whitespace and normalize
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s*,\s*', ', ', text)  # Normalize commas
    text = text.strip()
    
    return text


@router.websocket("/voice")
async def voice_agent_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="Clerk JWT token for authentication"),
):
    """WebSocket endpoint for real-time voice interaction with the spatial memory agent.
    
    Uses Groq's Whisper for STT and Orpheus for TTS in a sequential pipeline:
    Audio In -> STT (Whisper) -> LLM (Qwen3) -> TTS (Orpheus) -> Audio Out
    
    Protocol:
    1. Client connects with JWT token for authentication
    2. Client sends audio chunks as base64-encoded PCM (24kHz, 16-bit, mono)
    3. Server streams back audio responses and text transcripts
    
    Message format (client -> server):
        Binary frame: Raw audio bytes (WebM/Opus or PCM)
        Text frame: {"type": "text", "data": "text message"}
        Text frame: {"type": "end_turn"}  # Signal end of user turn
        Text frame: {"type": "audio", "data": "<base64>"}  # Legacy fallback
    
    Message format (server -> client):
        Binary frame: Raw audio bytes (WAV/Opus) - for audio playback
        Text frame: {"type": "transcript", "role": "user"|"assistant", "text": "..."}
        Text frame: {"type": "tool_call", "name": "...", "args": {...}}
        Text frame: {"type": "tool_result", "name": "...", "result": {...}}
        Text frame: {"type": "turn_complete"}
        Text frame: {"type": "audio_start"}  # Signals start of audio stream
        Text frame: {"type": "audio_end"}  # Signals end of audio stream
        Text frame: {"type": "error", "message": "..."}
    """
    # Verify token before accepting connection
    user_claims = await verify_websocket_token(token)
    if not user_claims:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return
    
    # CRITICAL: Resolve clerk_user_id to internal user_id
    # The agent tools expect internal user_id, not clerk_user_id
    clerk_user_id = user_claims.get("sub", "anonymous")
    email = user_claims.get("email")
    
    try:
        user_id = _resolve_user_id(clerk_user_id, email)
    except ConnectionError as e:
        # Neo4j is not available - send error and close
        logger.error(f"Database unavailable during WebSocket connection: {e}")
        await websocket.accept()  # Accept to send error message
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
        await websocket.close(code=1013, reason="Database unavailable")
        return
    except Exception as e:
        logger.error(f"Failed to resolve user ID: {e}", exc_info=True)
        await websocket.accept()  # Accept to send error message
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to initialize user session: {str(e)}"
        })
        await websocket.close(code=1011, reason="Internal error")
        return
    
    # Accept the WebSocket connection
    await websocket.accept()
    
    # Generate a unique session ID for this connection
    import uuid
    session_id = str(uuid.uuid4())
    
    # Initialize Groq service for TTS/STT
    try:
        groq_service = get_groq_service()
    except ValueError as e:
        logger.error(f"Failed to initialize Groq service: {e}")
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
        await websocket.close()
        return
    
    # Audio buffer for accumulating chunks
    audio_buffer = bytearray()
    
    # Track if TTS is currently being generated/sent
    tts_in_progress = asyncio.Event()
    tts_cancelled = False
    
    try:
        # Get or create session
        session = await session_service.get_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id
        )
        if not session:
            await session_service.create_session(
                app_name=APP_NAME,
                user_id=user_id,
                session_id=session_id
            )
        
        while True:
            try:
                # Receive either binary or text message
                ws_message = await websocket.receive()
                
                # Handle binary frames (raw audio data - preferred)
                if "bytes" in ws_message:
                    audio_data = ws_message["bytes"]
                    
                    # Cancel any ongoing TTS if user starts speaking over AI
                    if tts_in_progress.is_set():
                        tts_cancelled = True
                        await websocket.send_json({
                            "type": "interrupt"
                        })
                        await asyncio.sleep(0.1)
                        tts_cancelled = False
                    
                    # Accumulate binary audio directly (no base64 decode needed)
                    if audio_data:
                        audio_buffer.extend(audio_data)
                    continue
                
                # Handle text frames (JSON control messages)
                if "text" not in ws_message:
                    continue
                    
                data = ws_message["text"]
                message = json.loads(data)
                msg_type = message.get("type")
                
                if msg_type == "audio":
                    # Legacy base64 audio support (fallback for older clients)
                    if tts_in_progress.is_set():
                        tts_cancelled = True
                        await websocket.send_json({
                            "type": "interrupt"
                        })
                        await asyncio.sleep(0.1)
                        tts_cancelled = False
                    
                    # Accumulate audio chunks
                    try:
                        base64_data = message.get("data", "")
                        if not base64_data:
                            logger.warning("Audio message received but 'data' field is empty!")
                            await websocket.send_json({
                                "type": "error",
                                "message": "Audio message missing data field"
                            })
                            continue
                        
                        audio_data = base64.b64decode(base64_data)
                        audio_buffer.extend(audio_data)
                    except base64.binascii.Error as e:
                        logger.error(f"❌ Failed to decode base64 audio data: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Failed to decode audio (invalid base64): {str(e)}"
                        })
                    except Exception as e:
                        logger.error(f"❌ Failed to process audio data: {e}", exc_info=True)
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Failed to process audio: {str(e)}"
                        })
                
                elif msg_type == "text":
                    # Direct text input - process immediately
                    text = message["data"]
                    
                    # Cancel any ongoing TTS if user interrupts
                    if tts_in_progress.is_set():
                        tts_cancelled = True
                        await websocket.send_json({
                            "type": "interrupt"
                        })
                        # Wait a bit for TTS to cancel
                        await asyncio.sleep(0.1)
                        tts_cancelled = False
                    
                    # Send user transcript
                    await websocket.send_json({
                        "type": "transcript",
                        "role": "user",
                        "text": text
                    })
                    
                    # Process with agent
                    await process_agent_turn(
                        websocket, runner, groq_service,
                        user_id, session_id, text, tts_in_progress, lambda: tts_cancelled
                    )
                
                elif msg_type == "end_turn":
                    # Cancel any ongoing TTS if user interrupts
                    if tts_in_progress.is_set():
                        tts_cancelled = True
                        await websocket.send_json({
                            "type": "interrupt"
                        })
                        # Wait a bit for TTS to cancel
                        await asyncio.sleep(0.1)
                        tts_cancelled = False
                    
                    if len(audio_buffer) > 0:
                        # Save raw audio buffer for debugging
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                        
                        if DEBUG_AUDIO_DIR:
                            raw_audio_path = DEBUG_AUDIO_DIR / f"raw_audio_{session_id}_{timestamp}.pcm"
                            try:
                                with open(raw_audio_path, "wb") as f:
                                    f.write(bytes(audio_buffer))
                            except Exception as e:
                                logger.error(f"Failed to save raw audio: {e}", exc_info=True)
                        
                        # Detect audio format from file headers
                        audio_bytes = bytes(audio_buffer)
                        audio_format = detect_audio_format(audio_bytes)
                        
                        # Prepare audio for Whisper based on detected format
                        if audio_format == "wav":
                            wav_audio = audio_bytes
                            filename = "audio.wav"
                        elif audio_format in ["mp3", "m4a", "aac", "flac", "ogg", "webm"]:
                            wav_audio = audio_bytes
                            filename = f"audio.{audio_format}"
                        elif audio_format == "pcm":
                            # Convert PCM to WAV for Whisper
                            wav_audio = create_wav_header(audio_bytes)
                            filename = "audio.wav"
                        else:
                            # Try creating WAV header as fallback
                            wav_audio = create_wav_header(audio_bytes)
                            filename = "audio.wav"
                        
                        # Save WAV file for debugging
                        if DEBUG_AUDIO_DIR:
                            wav_audio_path = DEBUG_AUDIO_DIR / f"audio_{session_id}_{timestamp}.wav"
                            try:
                                with open(wav_audio_path, "wb") as f:
                                    f.write(wav_audio)
                            except Exception as e:
                                logger.error(f"Failed to save WAV audio: {e}", exc_info=True)
                        
                        # Transcribe with Whisper STT (explicitly set language to English)
                        try:
                            transcript = await groq_service.speech_to_text(
                                wav_audio, 
                                filename=filename,
                                language="en"  # Explicitly set to English
                            )
                            
                            if not transcript or not transcript.strip():
                                logger.warning("STT returned empty transcript")
                                await websocket.send_json({
                                    "type": "error",
                                    "message": "No speech detected in audio. Please try speaking again."
                                })
                                audio_buffer.clear()
                                continue
                        except Exception as e:
                            error_msg = f"STT error: {str(e)}"
                            logger.error(f"❌ {error_msg}", exc_info=True)
                            if DEBUG_AUDIO_DIR:
                                logger.error(f"Audio saved to: {wav_audio_path.absolute()}")
                            await websocket.send_json({
                                "type": "error",
                                "message": error_msg
                            })
                            audio_buffer.clear()
                            continue
                        
                        # Clear buffer
                        audio_buffer.clear()
                        
                        if transcript.strip():
                            # Send user transcript
                            await websocket.send_json({
                                "type": "transcript",
                                "role": "user",
                                "text": transcript
                            })
                            
                            # Process with agent
                            await process_agent_turn(
                                websocket, runner, groq_service,
                                user_id, session_id, transcript, tts_in_progress, lambda: tts_cancelled
                            )
                        else:
                            # No speech detected
                            await websocket.send_json({
                                "type": "turn_complete"
                            })
                    else:
                        # No audio to process
                        await websocket.send_json({
                            "type": "turn_complete"
                        })
                        
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for user: {user_id}")
                break
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON received: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"Invalid JSON: {str(e)}"
                })
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}", exc_info=True)
                await websocket.send_json({
                    "type": "error",
                    "message": f"Processing error: {str(e)}"
                })
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass


async def send_audio_binary(websocket: WebSocket, audio_data: bytes):
    """Send audio data as binary WebSocket frame.
    
    Uses binary frames instead of base64 JSON for ~33% bandwidth savings
    and reduced CPU overhead.
    """
    if websocket.application_state == WebSocketState.CONNECTED:
        await websocket.send_bytes(audio_data)


async def stream_tts_for_sentence(
    websocket: WebSocket,
    groq_service,
    sentence: str,
    is_cancelled: Optional[Callable[[], bool]] = None
) -> bool:
    """Generate and stream TTS for a single sentence.
    
    Returns True if successful, False if cancelled or error.
    """
    if is_cancelled and is_cancelled():
        return False
    
    try:
        audio_data = await groq_service.text_to_speech(sentence)
        
        if is_cancelled and is_cancelled():
            return False
        
        # Send as binary frame (no base64 encoding!)
        await send_audio_binary(websocket, audio_data)
        return True
        
    except Exception as e:
        logger.error(f"TTS error for sentence: {e}", exc_info=True)
        return False


async def process_agent_turn(
    websocket: WebSocket,
    runner: Runner,
    groq_service,
    user_id: str,
    session_id: str,
    user_text: str,
    tts_in_progress: Optional[asyncio.Event] = None,
    is_cancelled: Optional[Callable[[], bool]] = None
):
    """Process a single turn of user input through the agent.
    
    Features:
    - Sentence-level TTS streaming for lower perceived latency
    - Binary WebSocket frames for audio (no base64 overhead)
    
    Args:
        websocket: WebSocket connection
        runner: ADK Runner instance
        groq_service: Groq service for TTS/STT
        user_id: User ID
        session_id: Session ID
        user_text: User input text
        tts_in_progress: Event to track TTS status
        is_cancelled: Callable that returns True if TTS should be cancelled
    """
    try:
        # Create content for the agent
        content = types.Content(
            role="user",
            parts=[types.Part(text=user_text)]
        )
        
        # Run the agent and collect response
        response_text = ""
        
        # Set user context for tools
        from spatial_memory_agent.context import user_id_ctx
        token = user_id_ctx.set(user_id)
        
        try:
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=content
            ):
                # Check if cancelled
                if is_cancelled and is_cancelled():
                    logger.info("Agent turn cancelled due to user interrupt")
                    return
                
                # Handle tool calls
                if hasattr(event, "actions") and event.actions:
                    for action in event.actions:
                        if hasattr(action, "tool_call") and action.tool_call:
                            await websocket.send_json({
                                "type": "tool_call",
                                "name": action.tool_call.name,
                                "args": dict(action.tool_call.args) if action.tool_call.args else {}
                            })
                
                # Handle tool results
                if hasattr(event, "tool_results") and event.tool_results:
                    for result in event.tool_results:
                        await websocket.send_json({
                            "type": "tool_result",
                            "name": result.name if hasattr(result, "name") else "unknown",
                            "result": result.result if hasattr(result, "result") else str(result)
                        })
                
                # Accumulate response text
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            response_text += part.text
        finally:
            # Reset context
            user_id_ctx.reset(token)
        
        # Check if cancelled before TTS
        if is_cancelled and is_cancelled():
            logger.info("TTS cancelled before generation")
            return
        
        if response_text:
            # Send assistant transcript (keep original with formatting for UI)
            await websocket.send_json({
                "type": "transcript",
                "role": "assistant",
                "text": response_text
            })
            
            # Clean text for TTS (remove markdown, emojis, visual indicators)
            tts_text = clean_text_for_tts(response_text)
            
            # Mark TTS as in progress
            if tts_in_progress:
                tts_in_progress.set()
            
            try:
                # Check cancellation before starting TTS
                if is_cancelled and is_cancelled():
                    logger.info("TTS cancelled before API call")
                    return
                
                # Signal start of audio stream
                await websocket.send_json({"type": "audio_start"})
                
                # Split into sentences and stream TTS for each
                sentences = split_into_sentences(tts_text)
                
                if len(sentences) <= 1:
                    # Single sentence or short response - send as one chunk
                    if tts_text.strip():
                        await stream_tts_for_sentence(
                            websocket, groq_service, tts_text, is_cancelled
                        )
                else:
                    # Multiple sentences - stream each one
                    # Combine very short sentences with the next one for natural speech
                    combined_sentences = []
                    current = ""
                    
                    for sentence in sentences:
                        if len(current) + len(sentence) < 50:  # Combine short segments
                            current = f"{current} {sentence}".strip()
                        else:
                            if current:
                                combined_sentences.append(current)
                            current = sentence
                    
                    if current:
                        combined_sentences.append(current)
                    
                    # Stream TTS for each sentence chunk
                    for sentence in combined_sentences:
                        if is_cancelled and is_cancelled():
                            logger.info("TTS cancelled during streaming")
                            break
                        
                        if sentence.strip():
                            success = await stream_tts_for_sentence(
                                websocket, groq_service, sentence, is_cancelled
                            )
                            if not success and is_cancelled and is_cancelled():
                                break
                
                # Signal end of audio stream
                await websocket.send_json({"type": "audio_end"})
                
            except Exception as e:
                logger.error(f"TTS streaming error: {e}", exc_info=True)
                # Continue without audio - transcript was already sent
            finally:
                # Clear TTS in progress flag
                if tts_in_progress:
                    tts_in_progress.clear()
        
        # Signal turn complete
        await websocket.send_json({
            "type": "turn_complete"
        })
        
    except Exception as e:
        logger.error(f"Agent processing error: {e}", exc_info=True)
        if tts_in_progress:
            tts_in_progress.clear()
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })


@router.get("/health")
async def agent_health():
    """Health check for the agent service."""
    settings = get_settings()
    from services.rate_limiter import get_groq_rate_limiter
    
    rate_limiter = get_groq_rate_limiter()
    rate_stats = rate_limiter.get_stats()
    
    return {
        "status": "healthy",
        "agent": root_agent.name,
        "llm_model": settings.llm_model,
        "tts_model": settings.tts_model,
        "stt_model": settings.stt_model,
        "rate_limiter": {
            "total_requests": rate_stats["total_requests"],
            "rate_limited_requests": rate_stats["rate_limited_requests"],
            "current_tokens": round(rate_stats["current_tokens"], 2),
            "requests_in_window": rate_stats["requests_in_window"],
            "limit_per_second": 90,
            "limit_per_minute": 5400,
        }
    }
