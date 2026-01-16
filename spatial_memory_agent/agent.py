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
    
    # Return concise result
    return {"ok": True, "name": result.get("thing_name"), "path": result.get("location_path")}


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
        return {"found": len(things), "items": concise_things}
    return {"found": 0, "items": []}


def move_thing(thing_name: str, new_location: str) -> dict:
    """Move thing to new location. Use when user says they moved something.
    
    Args:
        thing_name: Thing name
        new_location: New location path
    """
    with _get_graph_service() as gs:
        result = gs.move_thing(thing_name, new_location)
    
    # Return concise result
    if result.get("status") == "success":
        return {"ok": True, "name": result.get("thing_name"), "path": result.get("new_location")}
    return {"ok": False, "error": result.get("message", "Failed")}


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
    return {"ok": True, "linked": [thing1, thing2]}


def list_contents(location: str) -> dict:
    """List things in location. Use when user asks what's in a place.
    
    Args:
        location: Location name
    """
    with _get_graph_service() as gs:
        result = gs.list_contents(location)
    
    # Return concise result
    if result.get("status") == "success" and result.get("things"):
        things = result["things"]
        concise_things = [{"name": t.get("name")} for t in things[:10]]  # Limit to 10
        return {"count": len(things), "items": concise_things}
    return {"count": 0, "items": []}


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
    return {"ok": True, "thing": thing_name, "intent": intent}


# ========== Agent Definition ==========

AGENT_INSTRUCTION = """Spatial memory assistant. Track where users keep things.

Tools: remember_thing, find_thing, move_thing, associate_things, list_contents, attach_intent.
Location format: "Room > Zone > Container" (e.g., "Bedroom > Closet > Top Shelf").

CRITICAL RESPONSE RULES:
- Keep responses SHORT and CRISP - maximum 1-2 sentences
- NO lists, bullet points, or numbered items
- NO multiple examples - give at most ONE example if absolutely necessary
- NO pointers or formatting markers
- Use plain, conversational text only
- For locations, use "in" format: "Your passport is in Bedroom, in Locker, in Blue File"
- Be direct and concise - users have limited space

TTS rules: No markdown/emojis. Natural speech. Brief responses only.
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
        attach_intent,
    ],
)
