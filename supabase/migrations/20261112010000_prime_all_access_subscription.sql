CREATE TABLE IF NOT EXISTS public.prime_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL,
  price numeric NOT NULL CHECK (price > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);

ALTER TABLE public.prime_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.prime_subscriptions TO authenticated;
DROP POLICY IF EXISTS "Members see tiers" ON public.prime_subscriptions;
DROP POLICY IF EXISTS "Users see own tiers" ON public.prime_subscriptions;
CREATE POLICY "Users see own tiers" ON public.prime_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.prime_subscribe(_tier text)
RETURNS timestamptz
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _price numeric;
  _expires_at timestamptz;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  CASE _tier
    WHEN 'blue' THEN _price := 199;
    WHEN 'gold' THEN _price := 499;
    WHEN 'black' THEN _price := 999;
    WHEN 'all_access' THEN _price := 10000;
    ELSE RAISE EXCEPTION 'Unknown subscription tier';
  END CASE;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));
  IF public.wallet_balance(_user_id) < _price THEN
    RAISE EXCEPTION 'Insufficient balance — top up your wallet';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, type, amount, counterparty, note)
  VALUES (_user_id, 'send', _price, 'Primegram', 'Prime subscription: ' || _tier);
  INSERT INTO public.prime_subscriptions (user_id, tier, price)
  VALUES (_user_id, _tier, _price)
  RETURNING expires_at INTO _expires_at;

  RETURN _expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.prime_tier(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tier
  FROM public.prime_subscriptions
  WHERE user_id = _user_id
    AND _user_id = auth.uid()
    AND expires_at > now()
  ORDER BY CASE tier
    WHEN 'all_access' THEN 4
    WHEN 'black' THEN 3
    WHEN 'gold' THEN 2
    WHEN 'blue' THEN 1
    ELSE 0
  END DESC, expires_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.prime_subscribe(text), public.prime_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prime_subscribe(text), public.prime_tier(uuid) TO authenticated;
