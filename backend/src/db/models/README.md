# モデル管理ガイド

## 新規モデル追加手順

このドキュメントでは、新しいSQLAlchemyモデルを追加してマイグレーションを正常に動作させるための手順を説明します。

### 🚨 重要な原則

新しいモデルファイルを作成した後、**必ず以下の3つのファイルを更新**してください。これを忘れると、Alembicがモデルを検出できずマイグレーションエラーが発生します。

## 📋 完全な手順チェックリスト

### ステップ 1: 新しいモデルファイルの作成

新しいモデルファイル（例：`user.py`）を作成し、SQLAlchemyモデルを定義します。

```python
# src/db/models/user.py
from typing import Optional
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from src.db.models.base import BaseModel

class UserTable(BaseModel):
    __tablename__ = "users"
    
    username: Mapped[str] = mapped_column(
        String(50), 
        unique=True, 
        nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(255), 
        unique=True, 
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, 
        default=True, 
        nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<UserTable(id={self.id}, username='{self.username}')>"
```

### ステップ 2: 必須ファイルの更新

以下の3つのファイルを**必ず**更新してください：

#### 2-1. `src/db/base.py` （最重要）

```python
from src.db.database import Base

# すべてのモデルをここでインポートして、
# Alembicが自動検出できるようにする
from src.db.models.sample import SampleTable  # noqa: F401
from src.db.models.user import UserTable  # 👈 新しいモデルを追加
```

#### 2-2. `src/db/migrations/env.py`

```python
# すべてのモデルをインポートしてAlembicが認識できるようにする
from src.db.models.sample import SampleTable  # noqa: F401
from src.db.models.user import UserTable  # 👈 新しいモデルを追加
```

#### 2-3. `src/db/models/__init__.py`

```python
from src.db.models.sample import SampleTable
from src.db.models.user import UserTable  # 👈 新しいモデルを追加

__all__ = [
    "SampleTable", 
    "UserTable"  # 👈 __all__にも追加
]
```

### ステップ 3: 準備完了

これで新しいモデルがマイグレーションシステムに認識される準備が整いました。
`task migrate`を実行することでマイグレーションファイルが生成されます。

## 🔍 重要度順のファイル更新

1. **`base.py`** - 🔴 最重要（これがないとAlembicが検出しない）
2. **`env.py`** - 🟡 重要（確実な検出のため）
3. **`__init__.py`** - 🟢 必要（他の部分でモデルを使用する場合）

## ❌ よくあるエラーと対処法

### エラー 1: `ImportError: cannot import name 'UserTable'`

**原因**: クラス名の不一致またはimportパスの間違い

**対処法**: 
- 実際のクラス名を確認
- import文のパスを確認
- タイポがないか確認

### エラー 2: `ModuleNotFoundError: No module named 'src.db.models.user'`

**原因**: ファイルパスまたはファイル名の間違い

**対処法**:
- ファイル名を確認（`user.py`が正しく作成されているか）
- パスを確認（`src/db/models/`配下にあるか）

### エラー 3: マイグレーションで新しいテーブルが検出されない

**原因**: `base.py`または`env.py`でモデルがimportされていない

**対処法**:
- `base.py`に`# noqa: F401`付きでimportを追加
- `env.py`にも同様にimportを追加

## 🎯 ベストプラクティス

### モデル命名規則

- **クラス名**: `UserTable`（PascalCase + Table接尾辞）
- **テーブル名**: `users`（複数形、snake_case）
- **ファイル名**: `user.py`（単数形、snake_case）

### 型アノテーション

```python
# 推奨: 明示的な型アノテーション
username: Mapped[str] = mapped_column(String(50))
is_active: Mapped[bool] = mapped_column(Boolean, default=True)
description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
```

### BaseModelの継承

すべてのモデルは`BaseModel`を継承してください：

```python
from src.db.models.base import BaseModel

class UserTable(BaseModel):  # 👈 BaseModelを継承
    __tablename__ = "users"
    # ...
```

これにより、自動的に`id`、`created_at`、`updated_at`フィールドが追加されます。

## 🔧 テストの追加

新しいモデルを追加した場合は、対応するテストも作成することを推奨します：

```python
# tests/test_models/test_user.py
import pytest
from src.db.models.user import UserTable

def test_user_table_creation():
    user = UserTable(
        username="testuser",
        email="test@example.com"
    )
    assert user.username == "testuser"
    assert user.email == "test@example.com"
    assert user.is_active is True  # デフォルト値
```

## 📚 関連ドキュメント

- [CLAUDE.md](../../../CLAUDE.md) - プロジェクト全体のルールとガイドライン
- [auto_migrate.py](../../script/auto_migrate/auto_migrate.py) - 自動マイグレーションツール
- [Alembic Documentation](https://alembic.sqlalchemy.org/) - マイグレーションツールの公式ドキュメント

---

**注意**: このドキュメントの手順に従わないと、マイグレーションエラーが発生する可能性があります。新しいモデルを追加する際は、必ずこのチェックリストを参考にしてください。