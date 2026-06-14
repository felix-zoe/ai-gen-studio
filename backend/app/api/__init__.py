from fastapi import APIRouter

from app.api.routers import health, auth, keys, generate, generate_video, generations, upload

router = APIRouter(prefix="/api")
router.include_router(health.router)
router.include_router(auth.router)
router.include_router(keys.router)
router.include_router(generate.router)
router.include_router(generate_video.router)
router.include_router(generations.router)
router.include_router(upload.router)