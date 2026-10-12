-- Migration: Hub Waitlist and Backer Submissions
-- Allows users to join the Private Hub waitlist and record voluntary UPI support.

-- 1. Table: hub_waitlist
CREATE TABLE IF NOT EXISTS public.hub_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure a user or anonymous device is only counted once
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_waitlist_user_id ON public.hub_waitlist(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_waitlist_device_id ON public.hub_waitlist(device_id) WHERE user_id IS NULL AND device_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.hub_waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon + authenticated) to read waitlist rows or count
DROP POLICY IF EXISTS "Anyone can view waitlist entries" ON public.hub_waitlist;
CREATE POLICY "Anyone can view waitlist entries"
  ON public.hub_waitlist
  FOR SELECT
  USING (true);

-- Allow authenticated or anon to join waitlist
DROP POLICY IF EXISTS "Users can join waitlist" ON public.hub_waitlist;
CREATE POLICY "Users can join waitlist"
  ON public.hub_waitlist
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- RPC: Atomic Join Waitlist
CREATE OR REPLACE FUNCTION public.join_hub_waitlist(p_device_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_already_joined BOOLEAN := FALSE;
  v_total_count INTEGER;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.hub_waitlist WHERE user_id = v_user_id
    ) INTO v_already_joined;

    IF NOT v_already_joined THEN
      INSERT INTO public.hub_waitlist (user_id, device_id)
      VALUES (v_user_id, p_device_id)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    IF p_device_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.hub_waitlist WHERE device_id = p_device_id AND user_id IS NULL
      ) INTO v_already_joined;

      IF NOT v_already_joined THEN
        INSERT INTO public.hub_waitlist (device_id)
        VALUES (p_device_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  SELECT count(*)::INTEGER FROM public.hub_waitlist INTO v_total_count;

  RETURN jsonb_build_object(
    'joined', TRUE,
    'already_joined', v_already_joined,
    'total_count', v_total_count
  );
END;
$$;

-- RPC: Get Waitlist Status & Count
CREATE OR REPLACE FUNCTION public.get_hub_waitlist_status(p_device_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_joined BOOLEAN := FALSE;
  v_total_count INTEGER;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.hub_waitlist WHERE user_id = v_user_id
    ) INTO v_is_joined;
  ELSIF p_device_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.hub_waitlist WHERE device_id = p_device_id
    ) INTO v_is_joined;
  END IF;

  SELECT count(*)::INTEGER FROM public.hub_waitlist INTO v_total_count;

  RETURN jsonb_build_object(
    'joined', v_is_joined,
    'total_count', v_total_count
  );
END;
$$;

-- 2. Table: hub_backers
CREATE TABLE IF NOT EXISTS public.hub_backers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 50,
  currency TEXT NOT NULL DEFAULT 'INR',
  utr TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'featured'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hub_backers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit backer verification" ON public.hub_backers;
CREATE POLICY "Anyone can submit backer verification"
  ON public.hub_backers
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view verified backers or their own" ON public.hub_backers;
CREATE POLICY "Users can view verified backers or their own"
  ON public.hub_backers
  FOR SELECT
  USING (
    status = 'verified' OR
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- RPC: Submit backer verification (Security Definer avoids RLS select checks)
CREATE OR REPLACE FUNCTION public.submit_hub_backer(
  p_amount NUMERIC,
  p_utr TEXT,
  p_note TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  INSERT INTO public.hub_backers (
    user_id,
    username,
    amount,
    currency,
    utr,
    note,
    status
  )
  VALUES (
    v_user_id,
    NULLIF(TRIM(p_username), ''),
    p_amount,
    'INR',
    NULLIF(TRIM(p_utr), ''),
    NULLIF(TRIM(p_note), ''),
    'pending'
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'id', v_new_id);
END;
$$;

-- 3. Profile badge flags & Admin review functions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_backer BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS backer_tier TEXT DEFAULT NULL;

-- RPC: Get pending backer claims (Admin only)
CREATE OR REPLACE FUNCTION public.get_pending_hub_backers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_community_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only community admins can review backer submissions';
  END IF;

  RETURN coalesce(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'user_id', b.user_id,
        'username', coalesce(b.username, p.username, 'Anonymous'),
        'amount', b.amount,
        'currency', b.currency,
        'utr', b.utr,
        'note', b.note,
        'status', b.status,
        'created_at', b.created_at
      ) ORDER BY b.created_at DESC
    )
    FROM public.hub_backers b
    LEFT JOIN public.profiles p ON p.id = b.user_id
    WHERE b.status = 'pending'
    ),
    '[]'::jsonb
  );
END;
$$;

-- RPC: Review backer submission (Admin only)
CREATE OR REPLACE FUNCTION public.review_hub_backer(
  p_backer_id UUID,
  p_status TEXT -- 'verified' or 'rejected'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_username TEXT;
BEGIN
  IF NOT public.is_community_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only community admins can review backer submissions';
  END IF;

  IF p_status NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Status must be verified or rejected';
  END IF;

  SELECT user_id, username INTO v_user_id, v_username
  FROM public.hub_backers
  WHERE id = p_backer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Backer submission not found';
  END IF;

  UPDATE public.hub_backers
  SET status = p_status
  WHERE id = p_backer_id;

  IF p_status = 'verified' THEN
    IF v_user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET is_backer = TRUE, backer_tier = 'founding'
      WHERE id = v_user_id;
    END IF;
    IF v_username IS NOT NULL THEN
      UPDATE public.profiles
      SET is_backer = TRUE, backer_tier = 'founding'
      WHERE username = v_username;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

