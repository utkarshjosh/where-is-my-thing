from contextvars import ContextVar
from typing import Optional

# Context variable for the current user ID
user_id_ctx: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
