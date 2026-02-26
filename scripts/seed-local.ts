#!/usr/bin/env bun

/**
 * ローカルD1データベースにシードデータを投入するスクリプト
 *
 * 使い方:
 *   bun run db:seed:local
 *
 * 注意:
 *   - このスクリプトはローカル開発環境でのみ使用してください
 *   - 本番環境では実行しないでください
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

console.log("🌱 Generating seed SQL...");

const now = Math.floor(Date.now() / 1000);

const sqlStatements: string[] = [];

// テストユーザー
console.log("  → Users...");
const testUsers = [
  {
    id: "test-user-1",
    name: "テストユーザー",
    email: "test@example.com",
    emailVerified: 1,
    image: null,
  },
  {
    id: "test-user-2",
    name: "開発ユーザー",
    email: "dev@example.com",
    emailVerified: 1,
    image: null,
  },
];

for (const user of testUsers) {
  sqlStatements.push(
    `INSERT OR IGNORE INTO users (id, name, email, email_verified, image, created_at, updated_at) VALUES (
      '${user.id}',
      '${user.name}',
      '${user.email}',
      ${user.emailVerified},
      ${user.image ? `'${user.image}'` : "NULL"},
      ${now},
      ${now}
    );`
  );
}

// SQLファイル保存
const sqlContent = sqlStatements.join("\n");
const wranglerDir = path.join(process.cwd(), ".wrangler");
const sqlPath = path.join(wranglerDir, "seed.sql");

if (!fs.existsSync(wranglerDir)) {
  fs.mkdirSync(wranglerDir, { recursive: true });
}

fs.writeFileSync(sqlPath, sqlContent);
console.log("✅ SQL generated at .wrangler/seed.sql");

// wrangler.tomlからdatabase_nameを取得
const wranglerToml = fs.readFileSync(
  path.join(process.cwd(), "wrangler.toml"),
  "utf-8"
);
const dbNameMatch = wranglerToml.match(/database_name\s*=\s*"([^"]+)"/);
if (!dbNameMatch) {
  console.error("❌ database_name not found in wrangler.toml");
  process.exit(1);
}
const dbName = dbNameMatch[1];

console.log("🚀 Executing SQL...");
const result = spawnSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    dbName,
    "--local",
    "--file",
    ".wrangler/seed.sql",
  ],
  { stdio: "inherit" }
);

if (result.status === 0) {
  console.log("✅ Database seeded successfully!");
} else {
  console.error("❌ Failed to seed database");
  process.exit(1);
}
