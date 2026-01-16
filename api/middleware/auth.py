"""Clerk JWT authentication middleware for FastAPI.

Validates Clerk tokens from the Authorization header and extracts user info.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
from jwt import PyJWKClient
from config import get_settings


class AuthenticatedUser(BaseModel):
    """Represents the authenticated user from Clerk JWT."""
    clerk_user_id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


# Security scheme for Bearer token
security = HTTPBearer(auto_error=False)



async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> AuthenticatedUser:
    """FastAPI dependency to get the authenticated user from Clerk JWT.
    
    Validates the JWT token from the Authorization header and extracts
    user information from the token claims.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - no token provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    settings = get_settings()
    
    if not settings.clerk_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clerk secret key not configured"
        )
    
    try:
        # Decode and verify the JWT
        # Clerk tokens are signed with RS256 by default
        # For development, we can decode without verification if JWKS is complex
        # In production, always verify with JWKS
        
        # First, decode without verification to get the issuer
        unverified = jwt.decode(token, options={"verify_signature": False})
        issuer = unverified.get("iss", "")
        
        # Get JWKS from Clerk
        jwks_url = f"{issuer}/.well-known/jwks.json"
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Verify and decode the token
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False}  # Clerk may not set audience
        )
        
        # Extract user info from claims
        # Clerk puts user info in various claims
        return AuthenticatedUser(
            clerk_user_id=payload.get("sub"),
            email=payload.get("email"),
            first_name=payload.get("first_name"),
            last_name=payload.get("last_name"),
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[AuthenticatedUser]:
    """Like get_current_user but returns None instead of raising for unauthenticated requests."""
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
