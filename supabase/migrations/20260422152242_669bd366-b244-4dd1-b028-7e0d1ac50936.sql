alter table public.preview_pages
  add column dm_sent_at timestamptz,
  add column archived_at timestamptz;

create table public.preview_page_claims (
  id uuid primary key default gen_random_uuid(),
  preview_page_id uuid not null references public.preview_pages(id) on delete cascade,
  email text not null,
  phone text,
  contacted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.preview_page_claims enable row level security;

create policy "Anyone can submit claim"
  on public.preview_page_claims for insert
  to anon, authenticated
  with check (true);

create policy "Admins can view claims"
  on public.preview_page_claims for select
  to authenticated
  using (has_role(auth.uid(), 'admin'));

create policy "Admins can update claims"
  on public.preview_page_claims for update
  to authenticated
  using (has_role(auth.uid(), 'admin'));