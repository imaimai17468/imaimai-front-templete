#!/bin/bash
set -e

MIGRATIONS_DIR="src/lib/drizzle/migrations"
DB_NAME=$(grep 'database_name' wrangler.toml | head -1 | sed 's/.*= *"//;s/".*//')

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Error: No migrations found. Run 'bun run db:generate' first."
  exit 1
fi

SQL_FILES=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" -type f | sort)

if [ -z "$SQL_FILES" ]; then
  echo "Error: No migration SQL files found. Run 'bun run db:generate' first."
  exit 1
fi

echo "Resetting local D1..."
rm -rf .wrangler/state

echo "Applying migrations to local D1..."
for f in $SQL_FILES; do
  echo "  $(basename "$f")"
  wrangler d1 execute "$DB_NAME" --local --file="$f"
done

echo "Local D1 setup complete."
