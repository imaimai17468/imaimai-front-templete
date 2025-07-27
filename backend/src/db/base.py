from src.db.database import Base  # noqa: F401

# すべてのモデルをここでインポートして、
# Alembicが自動検出できるようにする
from src.db.models.sample import SampleTable  # noqa: F401
