import uvicorn
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as api_router
from api.auth import router as auth_router
from api.chatbot import router as chat_router
from api.reminders import router as reminders_router
from api.email_scheduler import router as email_router
from api.orchestrator_chat import router as orchestrator_router
from api.social_media import router as social_router
from api.email_worker import email_worker

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background email worker
    worker_task = asyncio.create_task(email_worker())
    yield
    # Cleanup
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

app = FastAPI(title="OrgaNexus — Event Logistics Platform", lifespan=lifespan)

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth_router, prefix="/api")
app.include_router(api_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(reminders_router, prefix="/api")
app.include_router(email_router, prefix="/api")
app.include_router(orchestrator_router, prefix="/api")
app.include_router(social_router, prefix="/api")

@app.get("/")
def health_check():
    return {"status": "ok", "message": "OrgaNexus is running."}

# Helper routes to catch common misconfigurations (accessing port 8000 instead of 3000)
@app.get("/dashboard")
@app.get("/login")
@app.get("/register")
def frontend_route_on_backend():
    return {
        "status": "error",
        "message": "This is the BACKEND (API) server. Please access the FRONTEND (Dashboard) at http://localhost:3000.",
        "port_configuration": {
            "backend": 8000,
            "frontend": 3000
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
