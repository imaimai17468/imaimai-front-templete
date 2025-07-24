-- avatarsバケットのRLSポリシー
-- 注: これらのポリシーはSupabaseダッシュボードのStorage > Policiesから設定することも可能です

-- 1. 誰でもアバター画像を閲覧可能（Public Read）
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 2. 認証済みユーザーは自分のアバターのみアップロード可能
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. ユーザーは自分のアバターのみ更新可能
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. ユーザーは自分のアバターのみ削除可能
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 推奨されるファイル構造:
-- avatars/{user_id}/avatar.png
-- これにより、各ユーザーが自分のフォルダ内のファイルのみ操作できます