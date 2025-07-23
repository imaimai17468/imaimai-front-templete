# ベースイメージを指定
FROM python:3.11-slim

# 作業ディレクトリを作成
WORKDIR /app

# PYTHONPATHを設定
ENV PYTHONPATH=/app

# uvをインストール
RUN pip install --no-cache-dir uv

# pyproject.tomlとuv.lockをコピー
COPY pyproject.toml uv.lock ./

# uvで依存関係をインストール（lockファイルを使用、本番依存関係のみ）
RUN uv sync --frozen --no-dev

# アプリケーションのソースコードをコピー
COPY . .

# アプリケーションを起動
CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]