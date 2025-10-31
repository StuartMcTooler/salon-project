-- Epic 1 & 2: Client Referral System (Smart Waitlist & Overflow)

-- Commission type enum
create type commission_type as enum ('finders_fee', 'revenue_share');

-- Table: creative_referral_terms (each creative sets their terms)
create table public.creative_referral_terms (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid references public.staff_members(id) on delete cascade not null unique,
  commission_type commission_type not null default 'finders_fee',
  commission_percentage numeric not null check (commission_percentage >= 0 and commission_percentage <= 100),
  revenue_share_duration_months integer check (revenue_share_duration_months > 0),
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Table: trusted_network (who trusts whom)
create table public.trusted_network (
  id uuid primary key default gen_random_uuid(),
  alpha_creative_id uuid references public.staff_members(id) on delete cascade not null,
  colleague_creative_id uuid references public.staff_members(id) on delete cascade not null,
  added_at timestamp with time zone default now(),
  unique(alpha_creative_id, colleague_creative_id),
  check (alpha_creative_id != colleague_creative_id)
);

-- Table: client_ownership (GDPR-compliant client tagging)
create table public.client_ownership (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid references public.staff_members(id) on delete cascade not null,
  client_email text not null,
  client_phone text,
  client_name text,
  source text not null check (source in ('csv_upload', 'manual_add', 'auto_tag')),
  tagged_at timestamp with time zone default now(),
  unique(creative_id, client_email)
);

-- Table: referral_transactions (commission tracking)
create table public.referral_transactions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.salon_appointments(id) on delete cascade not null,
  referrer_creative_id uuid references public.staff_members(id) on delete set null,
  receiver_creative_id uuid references public.staff_members(id) on delete set null not null,
  client_email text not null,
  commission_type commission_type not null,
  commission_percentage numeric not null,
  booking_amount numeric not null,
  commission_amount numeric not null,
  revenue_share_end_date timestamp with time zone,
  status text default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Epic 3: Creative-to-Creative (C2C) Growth Loop

-- Table: creative_invites (pro referral tracking)
create table public.creative_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_creative_id uuid references public.staff_members(id) on delete cascade not null,
  invited_creative_id uuid references public.staff_members(id) on delete cascade,
  invite_code text unique not null,
  signup_completed_at timestamp with time zone,
  tenth_booking_completed_at timestamp with time zone,
  upfront_bonus_paid boolean default false,
  upfront_bonus_amount numeric default 50,
  created_at timestamp with time zone default now()
);

-- Table: c2c_revenue_share (1% of referred creative's referral income)
create table public.c2c_revenue_share (
  id uuid primary key default gen_random_uuid(),
  inviter_creative_id uuid references public.staff_members(id) on delete cascade not null,
  invited_creative_id uuid references public.staff_members(id) on delete cascade not null,
  referral_transaction_id uuid references public.referral_transactions(id) on delete cascade not null,
  share_percentage numeric default 1 check (share_percentage >= 0 and share_percentage <= 100),
  share_amount numeric not null,
  status text default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.creative_referral_terms enable row level security;
alter table public.trusted_network enable row level security;
alter table public.client_ownership enable row level security;
alter table public.referral_transactions enable row level security;
alter table public.creative_invites enable row level security;
alter table public.c2c_revenue_share enable row level security;

-- RLS Policies: creative_referral_terms
create policy "Creatives can manage their own terms"
  on public.creative_referral_terms
  for all
  using (exists (
    select 1 from public.staff_members
    where staff_members.id = creative_referral_terms.creative_id
    and staff_members.user_id = auth.uid()
  ));

create policy "Anyone can view active referral terms"
  on public.creative_referral_terms
  for select
  using (is_active = true);

-- RLS Policies: trusted_network
create policy "Creatives can manage their own trusted network"
  on public.trusted_network
  for all
  using (exists (
    select 1 from public.staff_members
    where staff_members.id = trusted_network.alpha_creative_id
    and staff_members.user_id = auth.uid()
  ));

create policy "Trusted network viewable by involved parties"
  on public.trusted_network
  for select
  using (exists (
    select 1 from public.staff_members
    where staff_members.user_id = auth.uid()
    and (staff_members.id = trusted_network.alpha_creative_id 
         or staff_members.id = trusted_network.colleague_creative_id)
  ));

-- RLS Policies: client_ownership (CRITICAL: 100% private)
create policy "Creatives can manage their own client list"
  on public.client_ownership
  for all
  using (exists (
    select 1 from public.staff_members
    where staff_members.id = client_ownership.creative_id
    and staff_members.user_id = auth.uid()
  ));

-- RLS Policies: referral_transactions
create policy "Creatives can view their own transactions"
  on public.referral_transactions
  for select
  using (exists (
    select 1 from public.staff_members
    where staff_members.user_id = auth.uid()
    and (staff_members.id = referral_transactions.referrer_creative_id
         or staff_members.id = referral_transactions.receiver_creative_id)
  ));

create policy "Admins can view all transactions"
  on public.referral_transactions
  for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "System can insert transactions"
  on public.referral_transactions
  for insert
  with check (true);

-- RLS Policies: creative_invites
create policy "Creatives can view their own invites"
  on public.creative_invites
  for select
  using (exists (
    select 1 from public.staff_members
    where staff_members.user_id = auth.uid()
    and (staff_members.id = creative_invites.inviter_creative_id
         or staff_members.id = creative_invites.invited_creative_id)
  ));

create policy "Creatives can create invite codes"
  on public.creative_invites
  for insert
  with check (exists (
    select 1 from public.staff_members
    where staff_members.id = creative_invites.inviter_creative_id
    and staff_members.user_id = auth.uid()
  ));

-- RLS Policies: c2c_revenue_share
create policy "Creatives can view their own C2C revenue"
  on public.c2c_revenue_share
  for select
  using (exists (
    select 1 from public.staff_members
    where staff_members.user_id = auth.uid()
    and (staff_members.id = c2c_revenue_share.inviter_creative_id
         or staff_members.id = c2c_revenue_share.invited_creative_id)
  ));

-- Triggers for updated_at
create trigger update_creative_referral_terms_updated_at
  before update on public.creative_referral_terms
  for each row execute function public.update_updated_at_column();

-- Indexes for performance
create index idx_trusted_network_alpha on public.trusted_network(alpha_creative_id);
create index idx_trusted_network_colleague on public.trusted_network(colleague_creative_id);
create index idx_client_ownership_creative on public.client_ownership(creative_id);
create index idx_client_ownership_email on public.client_ownership(client_email);
create index idx_referral_transactions_appointment on public.referral_transactions(appointment_id);
create index idx_referral_transactions_referrer on public.referral_transactions(referrer_creative_id);
create index idx_referral_transactions_receiver on public.referral_transactions(receiver_creative_id);
create index idx_creative_invites_code on public.creative_invites(invite_code);
create index idx_c2c_revenue_share_inviter on public.c2c_revenue_share(inviter_creative_id);