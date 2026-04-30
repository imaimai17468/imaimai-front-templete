# Architecture Decision Records (ADR)

自明でない設計判断の根拠を長期保存するための記録。プランやコミットメッセージは「何を変えたか」を記録するが、ADR は **なぜその選択肢を選んだか** を記録する。将来の読者が状況変化時に判断を再検討できるようにするためのもの。

## ADR を書くとき

以下の **すべて** に該当する場合に書く：

- 協調的な作業なしには巻き戻しが難しい判断
- 正解が自明ではなく、有力な代替案が存在した
- 6 か月後には理由が忘れられている

コードやコミットメッセージだけで判断を再導出できる場合は ADR 不要。

## フォーマット

MADR-lite を使用。各 ADR は `docs/adr/NNNN-kebab-title.md` に以下の骨格で作成する：

```markdown
# NNNN. タイトル

- Status: proposed | accepted | superseded by NNNN | deprecated
- Date: YYYY-MM-DD

## Context

どんな問題を解決するのか？ どんな制約・力学があるか？

## Decision

何を決定したか。1 段落、宣言的に書く。

## Alternatives considered

- **案 A**: 却下理由
- **案 B**: 却下理由

## Consequences

何が容易になるか？ 何が難しくなるか？ どんなフォローアップが必要か？
```

各 ADR は約 80 行以内に収める。長くなる場合は分割する。

## 番号付け

厳密に連番、4 桁ゼロ埋め。絶対に振り直さない。ADR が置き換えられた場合は旧 ADR を `superseded by NNNN` にマークし、新しい ADR を作成する。旧 ADR の Decision を書き換えてはならない。

## 一覧

| # | タイトル | Status |
|---|---|---|
| [0001](0001-coding-rules-via-claude-rules-include.md) | コーディングルールは `.claude/rules/` に配置し `AGENTS.md` の `@include` でロード | accepted |
| [0002](0002-direct-deps-only-audit.md) | `bun audit` は直接依存の脆弱性のみブロック | accepted |
| [0003](0003-subagent-driven-implementation.md) | チケット粒度の実装は subagent に委譲 | accepted |
| [0004](0004-permission-deny-as-security-boundary.md) | `permissions.deny` がセキュリティ境界（`ask` ではない） | accepted |
| [0005](0005-wrangler-types-for-cloudflare-env.md) | `CloudflareEnv` は `wrangler types` で生成（手書き禁止） | accepted |
| [0006](0006-orchestration-layering.md) | `/start-workflow` が唯一のオーケストレーション入口。aegis / superpowers / カスタムスキルはサブステップ | accepted |
