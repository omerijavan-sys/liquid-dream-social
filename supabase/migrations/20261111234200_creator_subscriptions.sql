CREATE TABLE public.creator_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_price integer NOT NULL DEFAULT 50 CHECK (monthly_price BETWEEN 50 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.creator_profiles TO authenticated;
CREATE POLICY "Creators are discoverable" ON public.creator_profiles
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users register themselves as creators" ON public.creator_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Creators update their own plans" ON public.creator_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER creator_profiles_updated_at
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.creator_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creator_profiles(user_id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount BETWEEN 50 AND 5000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  canceled_at timestamptz,
  UNIQUE (subscriber_id, creator_id),
  CHECK (subscriber_id <> creator_id)
);

ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.creator_subscriptions TO authenticated;
CREATE POLICY "Participants view creator subscriptions" ON public.creator_subscriptions
  FOR SELECT TO authenticated USING (subscriber_id = auth.uid() OR creator_id = auth.uid());
CREATE INDEX creator_subscriptions_creator_active_idx
  ON public.creator_subscriptions (creator_id, expires_at DESC)
  WHERE status = 'active';
CREATE INDEX creator_subscriptions_subscriber_idx
  ON public.creator_subscriptions (subscriber_id, expires_at DESC);

CREATE OR REPLACE FUNCTION public.creator_subscribe(_creator_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subscriber uuid := auth.uid();
  _price integer;
  _expiry timestamptz := now() + interval '1 month';
  _subscriber_name text;
BEGIN
  IF _subscriber IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _subscriber = _creator_id THEN RAISE EXCEPTION 'You cannot subscribe to yourself'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_subscriber::text, 0));
  SELECT monthly_price INTO _price
  FROM public.creator_profiles
  WHERE user_id = _creator_id;
  IF _price IS NULL THEN RAISE EXCEPTION 'This account is not registered as a creator'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.creator_subscriptions
    WHERE subscriber_id = _subscriber
      AND creator_id = _creator_id
      AND status = 'active'
      AND expires_at > now()
  ) THEN RAISE EXCEPTION 'You already have an active subscription'; END IF;

  IF public.wallet_balance(_subscriber) < _price THEN
    RAISE EXCEPTION 'Insufficient balance — top up your wallet';
  END IF;
  INSERT INTO public.wallet_transactions (user_id, type, amount, counterparty, note)
  VALUES (_subscriber, 'send', _price, 'Primegram', 'Creator subscription');
  SELECT username INTO _subscriber_name FROM public.profiles WHERE user_id = _subscriber;
  INSERT INTO public.wallet_transactions (user_id, type, amount, counterparty, note)
  VALUES (_creator_id, 'receive', round(_price * 0.95, 2), _subscriber_name, 'Creator subscription (5% fee)');

  INSERT INTO public.creator_subscriptions (subscriber_id, creator_id, amount, status, started_at, expires_at, canceled_at)
  VALUES (_subscriber, _creator_id, _price, 'active', now(), _expiry, NULL)
  ON CONFLICT (subscriber_id, creator_id) DO UPDATE
    SET amount = EXCLUDED.amount,
        status = 'active',
        started_at = EXCLUDED.started_at,
        expires_at = EXCLUDED.expires_at,
        canceled_at = NULL;

  RETURN _expiry;
END;
$$;

CREATE OR REPLACE FUNCTION public.prime_tip(_recipient uuid, _amount numeric)
RETURNS numeric
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender uuid := auth.uid();
  _amount_to_send numeric(12,2) := round(_amount, 2);
  _creator_name text;
  _sender_name text;
BEGIN
  IF _sender IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _amount_to_send IS NULL OR _amount_to_send NOT IN (5, 20, 50, 100, 500, 1000) THEN
    RAISE EXCEPTION 'Pick a valid tip amount';
  END IF;
  IF _sender = _recipient THEN RAISE EXCEPTION 'You cannot tip your own content'; END IF;

  SELECT username INTO _creator_name FROM public.profiles WHERE user_id = _recipient;
  IF NOT FOUND THEN RAISE EXCEPTION 'Creator not found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_sender::text, 0));
  IF public.wallet_balance(_sender) < _amount_to_send THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  SELECT username INTO _sender_name FROM public.profiles WHERE user_id = _sender;
  INSERT INTO public.wallet_transactions (user_id, type, amount, counterparty, note)
  VALUES (_sender, 'send', _amount_to_send, COALESCE(_creator_name, 'Primegram creator'), 'Creator tip');
  INSERT INTO public.wallet_transactions (user_id, type, amount, counterparty, note)
  VALUES (_recipient, 'receive', round(_amount_to_send * 0.95, 2), COALESCE(_sender_name, 'Primegram member'), 'Creator tip (5% fee)');

  RETURN round(_amount_to_send * 0.95, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.creator_cancel_subscription(_creator_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subscriber uuid := auth.uid();
BEGIN
  IF _subscriber IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.creator_subscriptions
  SET status = 'canceled', canceled_at = now()
  WHERE subscriber_id = _subscriber
    AND creator_id = _creator_id
    AND status = 'active'
    AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'No active subscription to cancel'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.creator_subscribe(uuid), public.creator_cancel_subscription(uuid), public.prime_tip(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creator_subscribe(uuid), public.creator_cancel_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prime_tip(uuid, numeric) TO authenticated;
