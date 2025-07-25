#!/usr/bin/env node

const { config } = require('dotenv');
const { execSync } = require('child_process');

// .env.localを読み込む
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URLが設定されていません');
  console.error('📝 .env.localファイルに以下の形式でDATABASE_URLを設定してください:');
  console.error('DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres');
  process.exit(1);
}

console.log('🚀 Supabaseマイグレーションを実行中...');

try {
  execSync(`bunx supabase db push --db-url "${DATABASE_URL}"`, { 
    stdio: 'inherit' 
  });
  console.log('✅ マイグレーションが完了しました！');
} catch (error) {
  console.error('❌ マイグレーションに失敗しました');
  process.exit(1);
}