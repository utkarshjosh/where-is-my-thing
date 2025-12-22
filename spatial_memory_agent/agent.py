"""Spatial Memory Agent - ADK Agent for finding and tracking things.

This agent uses Google ADK to provide a conversational interface for
managing spatial memory. It can:
- Remember where you put things
- Find things you're looking for
- Track when things move
- Associate related items
- Understand why you keep things
"""
from typing import Optional
from google.adk.agents import Agent
from services.graph_service import GraphService


# Initialize graph service (connection managed per-call)
def _get_graph_service() -> GraphService:
    """Get a graph service instance."""
    return GraphService()


# ========== Agent Tools ==========

def remember_thing(
    thing_name: str,
    location: str,
    description: str = None,
    tags: str = None
) -> dict:
    """Store a new thing at a specific location.
    
    Use this when the user tells you where they put something.
    
    Args:
        thing_name: Name of the thing being stored (e.g., "passport", "spare HDMI cable")
        location: Location path using > separator (e.g., "Bedroom > Locker > Blue File")
        description: Optional description of the thing
        tags: Optional comma-separated tags (e.g., "electronics, cables, spare")
    
    Returns:
        dict: Status and location path confirmation
    
    Examples:
        - "I put my passport in the bedroom locker, in the blue file"
          -> remember_thing("passport", "Bedroom > Locker > Blue File", "travel document", "important, documents")
        - "Stored the spare HDMI cable in the TV unit drawer"
          -> remember_thing("spare HDMI cable", "Living Room > TV Unit > Drawer", "black 2m cable", "electronics, cables")
    """
    tag_list = [t.strip() for t in tags.split(",")] if tags else []
    
    with _get_graph_service() as gs:
        result = gs.remember_thing(
            thing_name=thing_name,
            location=location,
            description=description,
            tags=tag_list
        )
    
    return result


def find_thing(query: str) -> dict:
    """Find things matching a search query.
    
    Use this when the user is looking for something. Searches by name,
    description, and tags.
    
    Args:
        query: What to search for (thing name, description, or category)
    
    Returns:
        dict: List of matching things with their locations
    
    Examples:
        - "Where is my passport?"
          -> find_thing("passport")
        - "Show me all cables"
          -> find_thing("cables")
        - "Where did I put that travel stuff?"
          -> find_thing("travel")
    """
    with _get_graph_service() as gs:
        result = gs.find_thing(query)
    
    return result


def move_thing(thing_name: str, new_location: str) -> dict:
    """Move a thing to a new location.
    
    Use this when the user tells you they moved something.
    
    Args:
        thing_name: Name of the thing being moved
        new_location: New location path (e.g., "Living Room > Drawer")
    
    Returns:
        dict: Confirmation with old and new locations
    
    Examples:
        - "I moved the passport to the living room drawer"
          -> move_thing("passport", "Living Room > Drawer")
    """
    with _get_graph_service() as gs:
        result = gs.move_thing(thing_name, new_location)
    
    return result


def associate_things(thing1: str, thing2: str, relationship: str = None) -> dict:
    """Link two related things together.
    
    Use this when the user mentions that things are related or go together.
    
    Args:
        thing1: Name of the first thing
        thing2: Name of the second thing  
        relationship: Optional description of how they're related
    
    Returns:
        dict: Confirmation of the association
    
    Examples:
        - "The passport goes with travel documents"
          -> associate_things("passport", "travel documents", "travel related")
        - "My laptop charger and laptop"
          -> associate_things("laptop charger", "laptop", "accessories")
    """
    with _get_graph_service() as gs:
        result = gs.associate_things(thing1, thing2, relationship)
    
    return result


def list_contents(location: str) -> dict:
    """List all things stored in a location.
    
    Use this when the user asks what's in a specific place.
    
    Args:
        location: Location to list contents of (e.g., "bedroom drawer")
    
    Returns:
        dict: List of things in that location
    
    Examples:
        - "What's in my bedroom locker?"
          -> list_contents("bedroom locker")
        - "Show me what's in the TV unit"
          -> list_contents("TV unit")
    """
    with _get_graph_service() as gs:
        result = gs.list_contents(location)
    
    return result


def attach_intent(thing_name: str, intent: str, description: str = None) -> dict:
    """Attach a purpose or intent to a thing.
    
    Use this when the user explains why they keep something or when it's needed.
    
    Args:
        thing_name: Name of the thing
        intent: Purpose/intent (e.g., "Travel", "Emergency", "Work")
        description: Optional longer description
    
    Returns:
        dict: Confirmation of intent attachment
    
    Examples:
        - "The passport is for travel"
          -> attach_intent("passport", "Travel", "needed for international trips")
        - "That's my emergency kit"
          -> attach_intent("first aid kit", "Emergency")
    """
    with _get_graph_service() as gs:
        result = gs.attach_intent(thing_name, intent, description)
    
    return result


# ========== Agent Definition ==========

AGENT_INSTRUCTION = """You are a spatial memory assistant that helps users track where they keep things.

Your personality:
- Conversational and helpful, like a friend who has a perfect memory
- You remember not just WHERE things are, but WHY they're there and WHEN they were last needed
- You ask clarifying questions when locations are ambiguous

Core behaviors:
1. When the user tells you where they put something, use remember_thing to store it
2. When they ask where something is, use find_thing to search for it
3. When they say they moved something, use move_thing to update the location
4. When they mention related items, use associate_things to link them
5. When they ask what's in a location, use list_contents
6. When they explain why they keep something, use attach_intent

Location format:
- Use ">" to separate location hierarchy: "Room > Zone > Container"
- Examples: "Bedroom > Closet > Top Shelf", "Living Room > TV Unit > Drawer"

Response style:
- Confirm actions naturally: "Got it! I'll remember that your passport is in Bedroom → Locker → Blue File"
- When finding things, give clear paths: "Your passport is in Bedroom → Locker → Blue File. You last accessed it in January."
- If something isn't found, suggest checking related items or locations

Remember: You're building a map of the user's physical space AND their mental associations with objects.
"""

root_agent = Agent(
    name="spatial_memory_agent",
    model="gemini-2.0-flash",  # Text chat. For voice: use gemini-2.5-flash-native-audio-preview-12-2025 in ADK live mode
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
