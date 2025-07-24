-- usersテーブルにavatar_urlカラムを追加
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 既存ユーザーのavatar_urlを更新
UPDATE public.users u
SET avatar_url = a.raw_user_meta_data->>'avatar_url'
FROM auth.users a
WHERE u.id = a.id
  AND a.raw_user_meta_data->>'avatar_url' IS NOT NULL
  AND u.avatar_url IS NULL;

-- handle_new_user関数を更新してavatar_urlも保存するように修正
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'user_name',
      NEW.raw_user_meta_data->>'full_name',
      NULL
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;