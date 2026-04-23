# Dependencies

## Exact Version Pinning

`package.json` の依存バージョンは**完全固定**する。レンジ指定子 (`^`, `~`) や major-only 表記 (`"4"`, `"^20"`) は使わず、必ず exact バージョン (`"1.2.3"`) で書く。

**NG**

```json
{
  "dependencies": {
    "next": "^16.1.1",
    "react": "^19.2.3"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20"
  }
}
```

**OK**

```json
{
  "dependencies": {
    "next": "16.1.1",
    "react": "19.2.3"
  },
  "devDependencies": {
    "typescript": "5.8.3",
    "@types/node": "20.19.9"
  }
}
```

**追加・更新時の運用:**

- exact で追加する: `bun add -E <pkg>` / `bun add -E -d <pkg>`
- 既存依存を更新する場合も、更新後に `package.json` の `^` / `~` / major-only 表記が残っていないか確認し、レンジが混入していたら手動で exact に修正する
- バージョン一覧が必要なら `bun pm ls` で実際にインストールされているバージョンを確認できる

理由: テンプレート用途なので、派生プロジェクト間で環境差分が出ないよう完全固定する。アップデートは意図的に行い、常に lockfile と `package.json` が一致した状態を保つ。
