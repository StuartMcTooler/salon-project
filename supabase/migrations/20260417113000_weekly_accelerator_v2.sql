-- Weekly Accelerator v2
-- Reuse the existing invite + bonus ledger model, but make it explicit for
-- barber-to-barber referral earnings and inviter visibility.

ALTER TABLE public.campaign_configs
ADD COLUMN IF NOT EXISTS earnings_cap_amount NUMERIC(10,2) DEFAULT 500.00;

ALTER TABLE public.creative_invites
ADD COLUMN IF NOT EXISTS weekly_reward_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS earnings_cap_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS accelerator_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accelerator_completed_at TIMESTAMPTZ;

ALTER TABLE public.switching_bonus_ledger
ADD COLUMN IF NOT EXISTS inviter_creative_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invited_creative_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL;

UPDATE public.switching_bonus_ledger
SET invited_creative_id = creative_id
WHERE invited_creative_id IS NULL;

UPDATE public.creative_invites
SET weekly_reward_amount = COALESCE(weekly_reward_amount, 1.00),
    earnings_cap_amount = COALESCE(earnings_cap_amount, 500.00);

UPDATE public.campaign_configs
SET earnings_cap_amount = COALESCE(earnings_cap_amount, 500.00);

DROP POLICY IF EXISTS "Creatives can view inviter accelerator ledger" ON public.switching_bonus_ledger;
CREATE POLICY "Creatives can view inviter accelerator ledger"
ON public.switching_bonus_ledger
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE staff_members.id = switching_bonus_ledger.inviter_creative_id
      AND staff_members.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_switching_bonus_inviter ON public.switching_bonus_ledger(inviter_creative_id);
CREATE INDEX IF NOT EXISTS idx_switching_bonus_invited ON public.switching_bonus_ledger(invited_creative_id);
