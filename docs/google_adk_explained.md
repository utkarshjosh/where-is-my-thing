# Google ADK in "Where Is My Thing?" - Complete Explanation

## Table of Contents
1. [What is Google ADK?](#what-is-google-adk)
2. [How ADK is Used in This Project](#how-adk-is-used-in-this-project)
3. [Key ADK Components Used](#key-adk-components-used)
4. [Why Google ADK is Beneficial Here](#why-google-adk-is-beneficial-here)
5. [Comparison with LangGraph](#comparison-with-langgraph)

---

## What is Google ADK?

**Google ADK (Agent Development Kit)** is an open-source, code-first Python toolkit for building, evaluating, and deploying AI agents. It's designed to make agent development feel like traditional software development.

### Core Philosophy
- **Code-first approach**: Write agents like you write software
- **Multi-agent architecture**: Compose multiple specialized agents
- **Model agnostic**: Works with various LLMs (optimized for Gemini, but supports others)
- **Production-ready**: Built-in deployment and evaluation tools

---

## How ADK is Used in This Project

### 1. **Agent Definition** (`spatial_memory_agent/agent.py`)

The project defines a single agent called `spatial_memory_agent` that acts as the conversational interface for managing spatial memory.

```python
from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm

# Create LiteLLM wrapper for Groq model
llm_model = LiteLlm(model=settings.llm_model)  # e.g., "groq/qwen-qwq-32b"

root_agent = Agent(
    name="spatial_memory_agent",
    model=llm_model,
    description="A spatial memory assistant that helps you track where you keep things in your home.",
    instruction=AGENT_INSTRUCTION,  # Detailed system prompt
    tools=[
        remember_thing,
        find_thing,
        move_thing,
        associate_things,
        list_contents,
        list_places,
        attach_intent,
        confirm_item_match,
        create_new_item,
    ],
)
```

**What this does:**
- Defines a single agent with 9 tools
- Uses LiteLLM to connect to Groq's Qwen QwQ 32B model
- Provides detailed instructions for canonical item resolution and state-awareness
- Each tool is a Python function that the LLM can call

### 2. **Agent Tools** (9 Custom Tools)

Each tool is a simple Python function that the agent can invoke:

#### Example: `remember_thing`
```python
def remember_thing(
    thing_name: str,
    location: str,
    description: str = None,
    tags: str = None
) -> dict:
    """Store thing at location. Use when user says where they put something."""
    # Gets user_id from context
    with _get_graph_service() as gs:
        result = gs.remember_thing(...)
    return {"ok": True, "action": "created", ...}
```

**Key features:**
- Type hints enable ADK to generate proper tool schemas
- Docstrings become tool descriptions for the LLM
- Return values are structured dictionaries
- Uses context variables for user isolation

### 3. **Session Management** (`api/routes/voice.py`)

ADK's session service manages conversation history:

```python
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

# In-memory session storage (can be replaced with persistent storage)
session_service = InMemorySessionService()

# ADK Runner orchestrates agent execution
runner = Runner(
    app_name="spatial-memory",
    agent=root_agent,
    session_service=session_service
)
```

**How it works:**
- Each WebSocket connection gets a unique `session_id`
- Sessions are scoped by `user_id` and `session_id`
- Conversation history is automatically maintained
- Runner handles the agent execution loop

### 4. **Agent Execution** (WebSocket Voice Route)

The voice route uses ADK's async streaming API:

```python
async for event in runner.run_async(
    user_id=user_id,
    session_id=session_id,
    new_message=content  # types.Content with user text
):
    # Handle tool calls
    if hasattr(event, "actions") and event.actions:
        for action in event.actions:
            if hasattr(action, "tool_call"):
                # Send tool call to client
                await websocket.send_json({
                    "type": "tool_call",
                    "name": action.tool_call.name,
                    "args": dict(action.tool_call.args)
                })
    
    # Handle tool results
    if hasattr(event, "tool_results"):
        # Send results to client
    
    # Accumulate response text
    if event.content and event.content.parts:
        for part in event.content.parts:
            if part.text:
                response_text += part.text
```

**What this provides:**
- **Streaming responses**: Get agent output as it's generated
- **Tool call visibility**: See when tools are invoked
- **Event-driven**: React to different event types
- **Async support**: Non-blocking execution

### 5. **Context Management** (`spatial_memory_agent/context.py`)

ADK doesn't directly handle user context, so the project uses Python's `contextvars`:

```python
from contextvars import ContextVar

user_id_ctx: ContextVar[Optional[str]] = ContextVar("user_id", default=None)

# In voice route:
token = user_id_ctx.set(user_id)
try:
    # Agent execution happens here
    async for event in runner.run_async(...):
        ...
finally:
    user_id_ctx.reset(token)
```

**Why this is needed:**
- Tools need to know which user they're operating on
- Context variables are thread/async-safe
- Ensures user isolation in multi-user scenarios

### 6. **Model Integration via LiteLLM**

ADK uses LiteLLM as a model adapter:

```python
from google.adk.models.lite_llm import LiteLlm

llm_model = LiteLlm(model="groq/qwen-qwq-32b")
```

**Benefits:**
- Unified interface to different LLM providers
- Built-in rate limiting support
- Easy model switching
- Handles API key management

---

## Key ADK Components Used

### 1. **`Agent` Class**
- **Purpose**: Defines the agent's behavior, tools, and instructions
- **Location**: `spatial_memory_agent/agent.py`
- **Key features**:
  - Tool registration (9 custom tools)
  - System instruction (detailed prompt)
  - Model integration (LiteLLM wrapper)

### 2. **`Runner` Class**
- **Purpose**: Executes agent conversations
- **Location**: `api/routes/voice.py`
- **Key features**:
  - Async streaming API (`run_async`)
  - Session management integration
  - Event emission (tool calls, responses, etc.)

### 3. **`InMemorySessionService`**
- **Purpose**: Manages conversation history
- **Location**: `api/routes/voice.py`
- **Key features**:
  - Session creation/retrieval
  - Conversation context storage
  - Can be swapped for persistent storage (e.g., database)

### 4. **`LiteLlm` Model Adapter**
- **Purpose**: Connects ADK to Groq LLM
- **Location**: `spatial_memory_agent/agent.py`
- **Key features**:
  - Model abstraction
  - Rate limiting configuration
  - API key management

### 5. **Event System**
- **Purpose**: Stream agent execution events
- **Location**: `api/routes/voice.py` (in `process_agent_turn`)
- **Event types**:
  - `actions`: Tool calls being made
  - `tool_results`: Tool execution results
  - `content`: LLM-generated text

---

## Why Google ADK is Beneficial Here

### 1. **Clean Tool-Calling Abstraction**

**Problem**: Need to expose 9 different operations (remember, find, move, etc.) as tools the LLM can call.

**ADK Solution**: 
- Define tools as simple Python functions
- ADK automatically generates tool schemas from type hints
- LLM receives structured tool definitions
- No manual JSON schema writing

**Example benefit:**
```python
# Without ADK/LangGraph: You'd need to manually define JSON schemas:
tools = [
    {
        "type": "function",
        "function": {
            "name": "remember_thing",
            "description": "Store thing at location...",
            "parameters": {
                "type": "object",
                "properties": {
                    "thing_name": {"type": "string"},
                    "location": {"type": "string"},
                    ...
                }
            }
        }
    },
    # ... 8 more tools
]

# With LangGraph: Use @tool decorator (still need explicit schemas)
from langchain_core.tools import tool

@tool
def remember_thing(thing_name: str, location: str, ...) -> dict:
    """Store thing at location..."""
    # LangGraph extracts schema from type hints
    ...

# With ADK: Just write functions (simplest approach)
def remember_thing(thing_name: str, location: str, ...) -> dict:
    """Store thing at location..."""
    # ADK automatically generates schemas from type hints
    ...
```

### 2. **Built-in Conversation Management**

**Problem**: Need to maintain conversation history across multiple turns in a voice session.

**ADK Solution**:
- `SessionService` handles conversation state
- Automatic context window management
- Session isolation per user
- History persistence (can swap implementations)

**Benefit**: No need to manually track messages, manage context windows, or handle token limits.

### 3. **Streaming API for Real-Time Voice**

**Problem**: Voice interactions need low latency - can't wait for full response.

**ADK Solution**:
- `runner.run_async()` yields events as they happen
- Can stream text as it's generated
- Tool calls are visible immediately
- Enables sentence-level TTS streaming

**Benefit**: The project streams TTS sentence-by-sentence, reducing perceived latency:
```python
async for event in runner.run_async(...):
    if event.content:
        response_text += event.content.parts[0].text
        # Can send to TTS immediately
```

### 4. **Model Agnostic Design**

**Problem**: Want to use Groq (fast, cost-effective) but might switch models later.

**ADK Solution**:
- LiteLLM adapter supports many providers
- Easy model switching (just change model string)
- Consistent interface regardless of provider

**Benefit**: Currently using `groq/qwen-qwq-32b`, but could switch to `openai/gpt-4` or `anthropic/claude` with minimal code changes.

### 5. **Type Safety and Developer Experience**

**Problem**: Tool definitions need to be correct - wrong schemas = broken agent.

**ADK Solution**:
- Type hints become tool schemas automatically
- Python's type system catches errors at development time
- IDE autocomplete works for tool definitions
- Docstrings become tool descriptions

**Benefit**: Less runtime errors, better developer experience, self-documenting code.

### 6. **Event-Driven Architecture**

**Problem**: Need visibility into agent execution for debugging and UI updates.

**ADK Solution**:
- Events for tool calls, results, and responses
- Can intercept and log at each stage
- Enables rich UI updates (showing tool calls in real-time)

**Benefit**: The WebSocket route sends tool call events to clients, enabling UI to show "Agent is searching..." states.

### 7. **Simple, Focused API**

**Problem**: Don't need complex state machines or workflow orchestration - just conversational agent with tools.

**ADK Solution**:
- Minimal API surface: `Agent`, `Runner`, `SessionService`
- No need to learn graph concepts or state management
- Focuses on the common case: conversational agents with tools

**Benefit**: Faster development, less cognitive overhead, easier to understand codebase.

### 8. **Production-Ready Features**

**Problem**: Need deployment, evaluation, and monitoring capabilities.

**ADK Solution**:
- Built-in CLI tools (`adk web` for local testing)
- Evaluation framework
- Deployment patterns (Docker, Cloud Run, Vertex AI)
- Session persistence options

**Benefit**: Can test agents locally with `adk web`, then deploy to production with minimal changes.

### 9. **Multi-User Isolation**

**Problem**: Multiple users, each with their own spatial memory.

**ADK Solution**:
- Sessions scoped by `user_id` and `session_id`
- Context variables for per-request user context
- Tools access user-specific data via context

**Benefit**: Clean separation of user data without manual session management.

### 10. **Error Handling and Tool Results**

**Problem**: Tools can fail or return complex results that need to be handled.

**ADK Solution**:
- Tool results are structured (dictionaries)
- Errors can be returned in tool results
- Agent can react to tool failures
- Supports clarification flows (e.g., `needs_clarification` flag)

**Benefit**: The `remember_thing` tool can return `needs_clarification: true`, and the agent automatically asks the user for confirmation.

---

## Comparison with LangGraph

### Overview

| Aspect | Google ADK | LangGraph |
|--------|------------|-----------|
| **Primary Use Case** | Conversational agents with tools | Complex workflows and state machines |
| **Complexity** | Low - simple API | Medium - graph-based concepts |
| **State Management** | Session-based (conversation history) | Explicit state graphs with reducers |
| **Workflow Control** | LLM-driven (dynamic) | Code-driven (deterministic) or LLM-driven |
| **Learning Curve** | Gentle - feels like writing functions | Steeper - need to understand graphs |
| **Best For** | Chatbots, assistants, tool-using agents | Multi-step workflows, complex orchestration |

### Detailed Comparison

#### 1. **Architecture Philosophy**

**Google ADK:**
- **Agent-centric**: One agent, multiple tools
- **Conversational**: Built for back-and-forth dialogue
- **Simple**: Minimal concepts to learn

**LangGraph:**
- **Graph-centric**: Nodes and edges define flow
- **Workflow-oriented**: Built for multi-step processes
- **Flexible**: Can model complex state transitions

**For this project**: ADK fits perfectly because the use case is conversational ("Where is my passport?" → agent calls `find_thing` → responds). No complex workflows needed.

#### 2. **State Management**

**Google ADK:**
```python
# State is implicit - conversation history
session = await session_service.get_session(
    app_name="spatial-memory",
    user_id=user_id,
    session_id=session_id
)
# ADK manages conversation state automatically
```

**LangGraph:**
```python
# State is explicit - you define the schema
from typing import TypedDict

class AgentState(TypedDict):
    messages: list
    user_id: str
    current_location: str
    # ... custom state fields

# Nodes read/write to state
def remember_node(state: AgentState) -> AgentState:
    # Modify state
    state["current_location"] = "bedroom"
    return state
```

**For this project**: ADK's implicit state (conversation history) is sufficient. LangGraph's explicit state would be overkill.

#### 3. **Tool Calling**

**Google ADK:**
```python
# Tools are just functions
def remember_thing(thing_name: str, location: str) -> dict:
    ...

agent = Agent(tools=[remember_thing, ...])
# ADK handles tool schema generation
```

**LangGraph (Python):**
```python
# Modern LangGraph uses @tool decorator from langchain-core
from langchain_core.tools import tool

@tool
def remember_thing(thing_name: str, location: str) -> dict:
    """Store thing at location. Use when user says where they put something.
    
    Args:
        thing_name: Thing name
        location: Path with > separator (e.g., "Bedroom > Locker > Blue File")
    """
    # Implementation
    return {"ok": True, "action": "created", ...}

# Create React agent with tools
from langgraph.prebuilt import create_react_agent

agent = create_react_agent(
    model=llm,
    tools=[remember_thing, find_thing, move_thing, ...]
)
```

**LangGraphJS (TypeScript/React):**
```typescript
// LangGraphJS uses tool() function from @langchain/core/tools
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const rememberThing = tool(
  async (input: { thing_name: string; location: string }) => {
    // Implementation
    return { ok: true, action: "created", ... };
  },
  {
    name: "remember_thing",
    description: "Store thing at location. Use when user says where they put something.",
    schema: z.object({
      thing_name: z.string().describe("Thing name"),
      location: z.string().describe("Path with > separator (e.g., 'Bedroom > Locker > Blue File')")
    })
  }
);

// Create React agent with tools
const agent = createReactAgent({
  llm: model,
  tools: [rememberThing, findThing, moveThing, ...]
});
```

**For this project**: ADK's simpler tool definition is cleaner. LangGraph requires LangChain integration and explicit schema definitions.

#### 4. **Execution Model**

**Google ADK:**
```python
# Single agent execution
async for event in runner.run_async(
    user_id=user_id,
    session_id=session_id,
    new_message=content
):
    # Events stream as they happen
    handle_event(event)
```

**LangGraph:**
```python
# Graph execution with nodes
graph = StateGraph(AgentState)
graph.add_node("remember", remember_node)
graph.add_node("find", find_node)
graph.add_edge("remember", "find")

# Execute graph
result = graph.invoke({"messages": [...]})
```

**For this project**: ADK's single-agent model matches the use case. LangGraph's graph model would add unnecessary complexity.

#### 5. **Multi-Agent Support**

**Google ADK:**
- Supports multi-agent architectures
- Agents can call other agents as tools
- Hierarchical agent composition

**LangGraph:**
- Nodes can be subgraphs (nested graphs)
- Can model agent-to-agent communication
- More explicit control over agent interactions

**For this project**: Single agent is sufficient. No need for multi-agent complexity.

#### 6. **Error Handling and Control Flow**

**Google ADK:**
- LLM decides tool calls dynamically
- Tool results can trigger follow-up actions
- Supports clarification flows via tool return values

**LangGraph:**
- Can define conditional edges (if/else logic)
- Explicit error handling nodes
- More control over execution flow

**For this project**: ADK's dynamic tool calling is sufficient. The agent handles clarification via tool return values (e.g., `needs_clarification`).

#### 7. **Streaming and Real-Time**

**Google ADK:**
- Built-in async streaming API
- Events emitted as they happen
- Good for real-time voice interactions

**LangGraph:**
- Supports streaming via `stream()` method
- Can stream state updates
- More granular control over what's streamed

**For this project**: Both support streaming, but ADK's event-based model is simpler for this use case.

#### 8. **Learning Curve**

**Google ADK:**
- **Easy**: Write functions, define agent, run
- **Concepts**: Agent, Runner, SessionService, Tools
- **Time to productive**: ~1-2 hours

**LangGraph:**
- **Moderate**: Understand graphs, nodes, edges, state
- **Concepts**: StateGraph, nodes, edges, reducers, conditional logic
- **Time to productive**: ~1-2 days

**For this project**: ADK's simplicity means faster development and easier maintenance.

#### 9. **Deployment and Production**

**Google ADK:**
- Built-in CLI (`adk web` for testing)
- Docker deployment patterns
- Vertex AI integration
- Session persistence options

**LangGraph:**
- Can deploy as LangChain agents
- Requires more setup for production
- Less built-in tooling

**For this project**: ADK's production-ready features are a plus.

#### 10. **Complete LangGraph React Agent Example**

Here's how you would set up a LangGraph React agent with tools using the modern `@tool` decorator:

**Python (LangGraph):**
```python
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

# Define tools using @tool decorator
@tool
def remember_thing(thing_name: str, location: str, description: str = None) -> dict:
    """Store thing at location. Use when user says where they put something.
    
    Args:
        thing_name: Thing name
        location: Path with > separator (e.g., "Bedroom > Locker > Blue File")
        description: Optional description
    """
    # Your implementation
    with _get_graph_service() as gs:
        result = gs.remember_thing(
            thing_name=thing_name,
            location=location,
            description=description
        )
    return {"ok": True, "action": result.get("action"), ...}

@tool
def find_thing(thing_name: str) -> dict:
    """Find where a thing is located."""
    # Implementation
    ...

# Create the React agent
llm = ChatOpenAI(model="gpt-4")
agent = create_react_agent(
    model=llm,
    tools=[remember_thing, find_thing, move_thing, ...]
)

# Use the agent
result = agent.invoke({"messages": [("user", "I put my keys in the bedroom")]})
```

**TypeScript/React (LangGraphJS):**
```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

// Define tools using tool() function
const rememberThing = tool(
  async (input: { 
    thing_name: string; 
    location: string; 
    description?: string;
  }) => {
    // Your implementation
    const result = await graphService.rememberThing({
      thingName: input.thing_name,
      location: input.location,
      description: input.description
    });
    return { ok: true, action: result.action, ... };
  },
  {
    name: "remember_thing",
    description: "Store thing at location. Use when user says where they put something.",
    schema: z.object({
      thing_name: z.string().describe("Thing name"),
      location: z.string().describe("Path with > separator (e.g., 'Bedroom > Locker > Blue File')"),
      description: z.string().optional().describe("Optional description")
    })
  }
);

const findThing = tool(
  async (input: { thing_name: string }) => {
    // Implementation
    ...
  },
  {
    name: "find_thing",
    description: "Find where a thing is located.",
    schema: z.object({
      thing_name: z.string().describe("Thing name to search for")
    })
  }
);

// Create the React agent
const model = new ChatOpenAI({ modelName: "gpt-4" });
const agent = createReactAgent({
  llm: model,
  tools: [rememberThing, findThing, moveThing, ...]
});

// Use the agent
const result = await agent.invoke({
  messages: [{ role: "user", content: "I put my keys in the bedroom" }]
});
```

**Key Differences from ADK:**
1. **Explicit schemas**: LangGraph requires you to define tool schemas (using type hints in Python or Zod in TypeScript)
2. **Decorator/function**: Python uses `@tool` decorator, TypeScript uses `tool()` function
3. **Schema validation**: LangGraph validates tool inputs against schemas
4. **LangChain integration**: Tools must be LangChain-compatible tool objects

**For this project**: The ADK approach (simple functions) is cleaner and requires less boilerplate.

#### 11. **When to Use Each**

**Use Google ADK when:**
- ✅ Building conversational agents
- ✅ Simple tool-calling workflows
- ✅ Want minimal boilerplate
- ✅ Need quick iteration
- ✅ Single-agent architecture is sufficient
- ✅ **This project's use case** ✓

**Use LangGraph when:**
- ✅ Complex multi-step workflows
- ✅ Need explicit state management
- ✅ Conditional branching logic
- ✅ Multi-agent coordination
- ✅ Long-running processes with checkpoints
- ✅ Need fine-grained control over execution

---

## Summary: Why ADK is Perfect for This Project

1. **Conversational Nature**: The project is fundamentally a conversational assistant. ADK is built for this.

2. **Simple Tool Set**: 9 tools, no complex orchestration needed. ADK's function-based tools are ideal.

3. **Real-Time Voice**: ADK's streaming API enables sentence-level TTS streaming for low latency.

4. **Rapid Development**: Less code, fewer concepts, faster iteration.

5. **Production Ready**: Built-in session management, deployment patterns, evaluation tools.

6. **Model Flexibility**: Easy to switch LLM providers via LiteLLM.

7. **Type Safety**: Python type hints become tool schemas automatically.

8. **Event Visibility**: Can see tool calls and results in real-time for debugging and UI.

**LangGraph would be overkill** for this use case. It's designed for complex workflows with explicit state management, conditional logic, and multi-agent coordination - none of which this project needs.

---

## References

- [Google ADK GitHub](https://github.com/google/adk-python)
- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [LangGraph Documentation](https://docs.langchain.com/oss/python/langgraph/overview)
- Project files:
  - `spatial_memory_agent/agent.py` - Agent definition
  - `api/routes/voice.py` - Runner and session management
  - `spatial_memory_agent/context.py` - User context handling
