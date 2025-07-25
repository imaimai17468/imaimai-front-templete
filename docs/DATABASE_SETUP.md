# データベースセットアップ

## 1. Supabaseプロジェクトを作成

1. [Supabase](https://supabase.com)で新規プロジェクト作成
2. 以下を取得：
   - Project URL
   - Anon Key
   - Database URL (Settings > Database > Connection string)

## 2. 環境変数を設定

```bash
cp .env.local.example .env.local
```

`.env.local`を編集：
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

## 3. OAuth認証を設定

### GitHub
1. [GitHub OAuth Apps](https://github.com/settings/developers)で新規作成
2. Authorization callback URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Client ID/Secretを取得

### Google
1. [Google Cloud Console](https://console.cloud.google.com/)でOAuth作成
2. リダイレクトURI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Client ID/Secretを取得

### Supabase
Authentication > ProvidersでGitHub/Googleを有効化し、Client ID/Secretを入力

## 4. Storageバケットを作成

Storage > New bucketで作成：
- Name: `avatars`
- Public bucket: ✅
- File size limit: 5MB
- Allowed MIME types: `image/*`

## 5. データベースを初期化

SupabaseのSQL Editorで`supabase/migrations/000_initial_setup.sql`を実行

または：
```bash
bun run supabase:push
```

## 6. 動作確認

```bash
bun run dev
```

http://localhost:3000 でアプリケーションが起動します。

## 補足：Drizzleコマンド

初回セットアップ後、スキーマ変更時に使用：

```bash
# スキーマからマイグレーション生成
bun run db:generate

# スキーマを直接DBに反映（開発時）
bun run db:push

# データベースGUIを起動
bun run db:studio

# Supabaseの型を生成
bun run db:typegen
```

### 注意事項：db:typegenコマンドの設定

`bun run db:typegen`コマンドを使用する前に、package.jsonの`db:typegen`スクリプトを編集して、自分のSupabaseプロジェクトIDに変更してください：

```json
"db:typegen": "supabase gen types typescript --project-id '<your-project-id>' --schema public > src/lib/supabase/types.ts"
```

`<your-project-id>`は、SupabaseダッシュボードのProject Settings > Generalで確認できます。

※ 初回セットアップでは不要です。既存のスキーマで動作します。