"""Voice agent WebSocket route for real-time audio streaming.

Uses ADK with LiteLLM (Groq) for text processing, and Groq's Whisper STT
and Orpheus TTS for audio input/output.
"""
import asyncio
import base64
import binascii
import json
import io
import os
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import jwt

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from spatial_memory_agent.agent import root_agent
from services.groq_service import get_groq_service
from config import get_settings

# Set up logger
logger = logging.getLogger(__name__)


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
        {"type": "audio", "data": "<base64 encoded PCM audio>"}
        {"type": "text", "data": "text message"}
        {"type": "end_turn"}  # Signal end of user turn
    
    Message format (server -> client):
        {"type": "audio", "data": "<base64 encoded WAV audio>"}
        {"type": "transcript", "role": "user", "text": "..."}
        {"type": "transcript", "role": "assistant", "text": "..."}
        {"type": "tool_call", "name": "...", "args": {...}}
        {"type": "tool_result", "name": "...", "result": {...}}
        {"type": "turn_complete"}
        {"type": "error", "message": "..."}
    """
    # Verify token before accepting connection
    user_claims = await verify_websocket_token(token)
    if not user_claims:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return
    
    user_id = user_claims.get("sub", "anonymous")
    
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
                data = await websocket.receive_text()
                message = json.loads(data)
                msg_type = message.get("type")
                
                if msg_type == "audio":
                    # Cancel any ongoing TTS if user starts speaking over AI
                    if tts_in_progress.is_set():
                        tts_cancelled = True
                        await websocket.send_json({
                            "type": "interrupt"
                        })
                        # Wait a bit for TTS to cancel
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
        
        # Run the agent (non-streaming for now)
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
            
            # Convert response to speech with Orpheus TTS
            try:
                # Check cancellation before starting TTS
                if is_cancelled and is_cancelled():
                    logger.info("TTS cancelled before API call")
                    return
                
                # Generate TTS audio
                audio_data = await groq_service.text_to_speech(tts_text)
                
                # Check cancellation after TTS generation
                if is_cancelled and is_cancelled():
                    logger.info("TTS cancelled after generation, not sending audio")
                    return
                
                # Send audio immediately after generation
                audio_b64 = base64.b64encode(audio_data).decode("utf-8")
                
                await websocket.send_json({
                    "type": "audio",
                    "data": audio_b64
                })
            except Exception as e:
                logger.error(f"TTS error: {e}", exc_info=True)
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
