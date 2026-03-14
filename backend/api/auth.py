"""
JWT-based authentication for organizer login/register.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

from database import create_user, authenticate_user, get_user_by_id

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

# --- Config ---
SECRET_KEY = os.getenv("JWT_SECRET", "swarm-os-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()

# --- Models ---

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# --- Token Helpers ---

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Dependency to extract and validate the current user from JWT token."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            print("[AUTH] Token missing 'sub' claim")
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError as e:
        print(f"[AUTH] JWT Decode Error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = get_user_by_id(user_id)
    if user is None:
        print(f"[AUTH] User not found for ID: {user_id}")
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- Routes ---

@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    """Register a new organizer account."""
    try:
        user = create_user(request.name, request.email, request.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    token = create_access_token(user["id"])
    return TokenResponse(access_token=token, user=user)

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Login with email and password."""
    user = authenticate_user(request.email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token(user["id"])
    return TokenResponse(access_token=token, user=user)

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return current_user
