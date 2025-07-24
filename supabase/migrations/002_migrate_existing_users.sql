-- 既存のauth.usersからpublic.usersへデータを移行
INSERT INTO public.users (id, created_at, name)
SELECT
  id,
  created_at,
  COALESCE(
    raw_user_meta_data->>'name',
    raw_user_meta_data->>'user_name',
    raw_user_meta_data->>'full_name',
    NULL
  ) as name
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;
