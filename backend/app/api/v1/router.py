from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.v1 import demo, interactions, people, recognition, settings_routes, system
from app.core.security import require_token

api_router = APIRouter(prefix="/api/v1", dependencies=[Depends(require_token)])

api_router.include_router(system.router)
api_router.include_router(people.router)
api_router.include_router(recognition.router)
api_router.include_router(interactions.router)
api_router.include_router(settings_routes.router)
api_router.include_router(demo.router)
