"""Spatial Memory Agent - ADK Agent for finding and tracking things.

This agent uses Google ADK with LiteLLM to provide a conversational interface for
managing spatial memory. It can:
- Remember where you put things
- Find things you're looking for
- Track when things move
- Associate related items
- Understand why you keep things
"""
import os
from typing import Optional
from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from services.graph_service import GraphService
from config import get_settings

# Set Groq API key for LiteLLM
settings = get_settings()
os.environ["GROQ_API_KEY"] = settings.groq_api_key

# Configure LiteLLM rate limiting for Groq
# Rate limit: 6000 requests/minute = 100 requests/second
# Use conservative 90 requests/second to leave headroom
# Format: "model_name:rpm:rpd" (requests per minute, requests per day)
# For groq models, we'll set a per-minute limit
os.environ["LITELLM_RATE_LIMIT"] = f"{settings.llm_model}:5400:864000"  # 5400/min (90/sec), 864000/day


# Initialize graph service (connection managed per-call)
def _get_graph_service() -> GraphService:
    """Get a graph service instance with the current user ID from context."""
    from spatial_memory_agent.context import user_id_ctx
    user_id = user_id_ctx.get()
    return GraphService(user_id=user_id)


# ========== Agent Tools ==========

def remember_thing(
    thing_name: str,
    location: str,
    description: str = None,
    tags: str = None
) -> dict:
    """Store thing at location. Use when user says where they put something.
    
    Args:
        thing_name: Thing name
        location: Path with > separator (e.g., "Bedroom > Locker > Blue File")
        description: Optional description
        tags: Optional comma-separated tags
    """
    tag_list = [t.strip() for t in tags.split(",")] if tags else []
    
    with _get_graph_service() as gs:
        result = gs.remember_thing(
            thing_name=thing_name,
            location=location,
            description=description,
            tags=tag_list
        )
    
    if result.get("status") == "error":
        return {"ok": False, "error": result.get("message"), "matches": result.get("matches")}
        
    # Return concise result with action context
    return {
        "ok": True, 
        "action": result.get("action"),
        "name": result.get("thing_name"), 
        "path": result.get("location_path") or result.get("new_location") or result.get("location"),
        "message": result.get("message")
    }


def find_thing(query: str) -> dict:
    """Find things by name/description/tags. Use when user asks where something is.
    
    Args:
        query: Search term
    """
    with _get_graph_service() as gs:
        result = gs.find_thing(query)
    
    # Return concise result - only essential fields
    if result.get("status") == "success" and result.get("things"):
        things = result["things"]
        # Only include name and location_path for each thing
        concise_things = [
            {"name": t.get("name"), "path": t.get("location_path")}
            for t in things[:5]  # Limit to 5 results
        ]
        return {"query": query, "found": len(things), "items": concise_things}
    return {"query": query, "found": 0, "items": []}


def move_thing(thing_name: str, new_location: str) -> dict:
    """Move thing to new location. Use when user says they moved something.
    
    Args:
        thing_name: Thing name
        new_location: New location path
    """
    with _get_graph_service() as gs:
        result = gs.move_thing(thing_name, new_location)
    
    # Return concise result
    # Return concise result
    if result.get("status") == "success":
        return {
            "ok": True, 
            "action": result.get("action", "moved"),
            "name": result.get("thing_name"), 
            "path": result.get("new_location") or result.get("location"),
            "message": result.get("message")
        }
    return {"ok": False, "error": result.get("message"), "matches": result.get("matches")}


def associate_things(thing1: str, thing2: str, relationship: str = None) -> dict:
    """Link related things. Use when user says things go together.
    
    Args:
        thing1: First thing name
        thing2: Second thing name
        relationship: Optional relationship description
    """
    with _get_graph_service() as gs:
        result = gs.associate_things(thing1, thing2, relationship)
    
    # Return concise result
    if result.get("status") == "success":
        return {"ok": True, "linked": [thing1, thing2], "message": result.get("message")}
    return {"ok": False, "error": result.get("message"), "matches": result.get("matches")}


def list_contents(location: str = None) -> dict:
    """List thing in a location. Use when user asks what's in a place or asks to list everything.
    
    Args:
        location: Optional location name (e.g., "Living Room"). If None, lists everything.
    """
    with _get_graph_service() as gs:
        result = gs.list_contents(location)
    
    # Return concise result
    if result.get("status") == "success" and result.get("things"):
        things = result["things"]
        concise_things = [
            {"name": t.get("name"), "path": t.get("location_path")} 
            for t in things[:10]
        ]  # Limit to 10
        return {"count": len(things), "items": concise_things, "location": result.get("location")}
    return {"count": 0, "items": [], "location": location or "all"}


def list_places() -> dict:
    """List all available locations where things are stored. Use when user asks where they have things.
    """
    with _get_graph_service() as gs:
        result = gs.list_places()
    
    if result.get("status") == "success":
        return {"count": result["count"], "places": result["places"][:20]}
    return {"count": 0, "places": []}


def attach_intent(thing_name: str, intent: str, description: str = None) -> dict:
    """Attach purpose/intent to thing. Use when user explains why they keep it.
    
    Args:
        thing_name: Thing name
        intent: Purpose (e.g., "Travel", "Emergency", "Work")
        description: Optional description
    """
    with _get_graph_service() as gs:
        result = gs.attach_intent(thing_name, intent, description)
    
    # Return concise result
    if result.get("status") == "success":
        return {"ok": True, "thing": thing_name, "intent": intent, "message": result.get("message")}
    return {"ok": False, "error": result.get("message"), "matches": result.get("matches")}


# ========== Agent Definition ==========

AGENT_INSTRUCTION = """Spatial memory assistant. Track where users keep things.

Tools: remember_thing, find_thing, move_thing, associate_things, list_contents, list_places, attach_intent.
Location format: "Room > Zone > Container" (e.g., "Bedroom > Closet > Top Shelf").

🔑 CRITICAL: STATE-AWARENESS
The `remember_thing` and `move_thing` tools are state-aware and will detect if an item already exists or if a movement is redundant.
However, to ensure precision and handle ambiguity:
1. If you call a tool and it returns `ok: False` with an `error` message about ambiguity (multiple matches), you MUST ask the user for clarification. Use the `matches` provided in the tool output to give the user options: "I found multiple items matching that: [Item 1] in [Location 1] and [Item 2] in [Location 2]. Which one did you mean?"
2. To avoid these errors, you SHOULD call `find_thing` first if the user's request is broad (e.g., "my book" when they might have many).
3. If multiple matches exist in `find_thing` results, ALWAYS ask for clarification before proceeding with a store or move.

The tools will return an `action` (created, moved, updated, or no_change) which you should use to confirm the result naturally to the user.

RESPONSE GUIDELINES:
- Be helpful and conversational - provide complete, quality answers
- When listing multiple items, read them naturally: "You have your passport, wallet, and keys in the bedroom locker"
- For complex queries, give detailed but organized responses
- hierarchical search is supported: if a user asks what's in a room, list things in all containers/zones within it
- list_contents without arguments lists ALL things the user owns
- list_places shows all rooms, zones, and containers the user has used
- For locations, use natural "in" format: "Your passport is in Bedroom, in Locker, in Blue File"
- Provide helpful context when relevant, such as when items were stored or related items

TTS FORMATTING RULES (important for voice output):
- NO markdown formatting (no asterisks, hashes, backticks)
- NO emojis
- NO bullet points or numbered lists - use natural speech to enumerate items
- Use commas and "and" for lists: "You have three items: a book, a phone, and your keys"
- Speak in complete, natural sentences
"""

# Create LiteLLM wrapper for Groq model
llm_model = LiteLlm(model=settings.llm_model)

root_agent = Agent(
    name="spatial_memory_agent",
    model=llm_model,  # LiteLLM wrapper for Groq qwen-qwq-32b
    description="A spatial memory assistant that helps you track where you keep things in your home.",
    instruction=AGENT_INSTRUCTION,
    tools=[
        remember_thing,
        find_thing,
        move_thing,
        associate_things,
        list_contents,
        list_places,
        attach_intent,
    ],
)
