BEGIN;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS music_title text,
  ADD COLUMN IF NOT EXISTS music_artist text,
  ADD COLUMN IF NOT EXISTS music_art_url text,
  ADD COLUMN IF NOT EXISTS music_url text,
  ADD COLUMN IF NOT EXISTS music_youtube_id text,
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_adult boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adult_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.register_post_view(_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  _views integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.posts
  SET views_count = views_count + 1
  WHERE id = _post_id
    AND (
      NOT is_adult
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.profiles AS profile
        WHERE profile.user_id = auth.uid()
          AND profile.adult_verified_at IS NOT NULL
      )
    )
  RETURNING views_count INTO _views;

  RETURN COALESCE(_views, 0);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.register_post_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_post_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_adult(_dob date)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  _age integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _dob IS NULL THEN
    RETURN false;
  END IF;

  _age := pg_catalog.date_part('year', pg_catalog.age(_dob));
  IF _age < 18 OR _dob > CURRENT_DATE THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET adult_verified_at = pg_catalog.now()
  WHERE user_id = auth.uid();

  RETURN FOUND;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_adult(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_adult(date) TO authenticated;

DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "Members can view posts" ON public.posts;
CREATE POLICY "Members can view posts"
  ON public.posts
  FOR SELECT
  TO anon, authenticated
  USING (
    NOT is_adult
    OR user_id = auth.uid()
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS profile
        WHERE profile.user_id = auth.uid()
          AND profile.adult_verified_at IS NOT NULL
      )
    )
  );

COMMIT;
