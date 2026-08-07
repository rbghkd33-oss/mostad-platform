create table if not exists public.marketing_lecture_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  phone text not null,
  interest text not null,
  privacy_agreed boolean not null default false,
  privacy_agreed_at timestamptz,
  source text not null default 'free-marketing-class-landing',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'confirmed', 'cancelled')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_lecture_applications_created_at_idx
  on public.marketing_lecture_applications (created_at desc);

alter table public.marketing_lecture_applications enable row level security;
