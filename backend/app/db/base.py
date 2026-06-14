from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic can detect them
from app.models import user  # noqa: F401, E402
from app.models import api_key  # noqa: F401, E402
from app.models import generation  # noqa: F401, E402