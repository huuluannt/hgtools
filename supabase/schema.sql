create extension if not exists "pgcrypto";

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  description text not null default '',
  updated_on date not null default current_date,
  type text not null check (type in ('public', 'private')),
  logo_url text,
  created_at timestamptz not null default now()
);

create unique index if not exists tools_name_unique on public.tools (name);

create table if not exists public.hgl_members (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint hgl_members_gmail check (email ~* '^[^@\s]+@gmail\.com$')
);

create table if not exists public.recent_tools (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, tool_id)
);

create or replace function public.record_recent_tool(p_tool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.recent_tools (user_id, tool_id, viewed_at)
  values (current_user_id, p_tool_id, now())
  on conflict (user_id, tool_id)
  do update set viewed_at = excluded.viewed_at;

  delete from public.recent_tools
  where user_id = current_user_id
    and tool_id not in (
      select tool_id
      from public.recent_tools
      where user_id = current_user_id
      order by viewed_at desc
      limit 5
    );
end;
$$;

grant execute on function public.record_recent_tool(uuid) to authenticated;

create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_hgl_admin()
returns boolean
language sql
stable
as $$
  select public.current_email() = 'huuluannt@gmail.com';
$$;

create or replace function public.is_hgl_member()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.hgl_members
    where email = public.current_email()
  );
$$;

alter table public.tools enable row level security;
alter table public.hgl_members enable row level security;
alter table public.recent_tools enable row level security;

drop policy if exists "Tools are visible by role" on public.tools;
create policy "Tools are visible by role"
on public.tools
for select
using (
  type = 'public'
  or public.is_hgl_admin()
  or public.is_hgl_member()
);

drop policy if exists "Only admin can insert tools" on public.tools;
create policy "Only admin can insert tools"
on public.tools
for insert
with check (public.is_hgl_admin());

drop policy if exists "Only admin can update tools" on public.tools;
create policy "Only admin can update tools"
on public.tools
for update
using (public.is_hgl_admin())
with check (public.is_hgl_admin());

drop policy if exists "Only admin can delete tools" on public.tools;
create policy "Only admin can delete tools"
on public.tools
for delete
using (public.is_hgl_admin());

drop policy if exists "Admin can read HGLmem" on public.hgl_members;
create policy "Admin can read HGLmem"
on public.hgl_members
for select
using (public.is_hgl_admin() or email = public.current_email());

drop policy if exists "Only admin can add HGLmem" on public.hgl_members;
create policy "Only admin can add HGLmem"
on public.hgl_members
for insert
with check (public.is_hgl_admin());

drop policy if exists "Only admin can delete HGLmem" on public.hgl_members;
create policy "Only admin can delete HGLmem"
on public.hgl_members
for delete
using (public.is_hgl_admin());

drop policy if exists "Users can read own recent tools" on public.recent_tools;
create policy "Users can read own recent tools"
on public.recent_tools
for select
using (auth.uid() = user_id);

drop policy if exists "Users can write own recent tools" on public.recent_tools;
create policy "Users can write own recent tools"
on public.recent_tools
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own recent tools" on public.recent_tools;
create policy "Users can update own recent tools"
on public.recent_tools
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recent tools" on public.recent_tools;
create policy "Users can delete own recent tools"
on public.recent_tools
for delete
using (auth.uid() = user_id);

insert into public.tools (name, url, description, updated_on, type)
values
  ('Gene Panel Browser', 'https://hglab.hcmus.edu.vn', 'Browse curated human genetics panels and annotations.', current_date - 6, 'public'),
  ('Variant Workbench', 'https://hglab.hcmus.edu.vn', 'Internal variant triage workspace for HGL members.', current_date - 10, 'private'),
  ('Primer Toolkit', 'https://hglab.hcmus.edu.vn', 'Small utilities for primer checks and sequence preparation.', current_date - 17, 'public')
on conflict (name) do nothing;

insert into public.hgl_members (email)
values ('huuluannt@gmail.com')
on conflict do nothing;

delete from public.hgl_members
where email = 'liamnicolas9x@gmail.com';

insert into storage.buckets (id, name, public)
values ('tool-logos', 'tool-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can read tool logos" on storage.objects;
create policy "Anyone can read tool logos"
on storage.objects
for select
using (bucket_id = 'tool-logos');

drop policy if exists "Only admin can upload tool logos" on storage.objects;
create policy "Only admin can upload tool logos"
on storage.objects
for insert
with check (bucket_id = 'tool-logos' and public.is_hgl_admin());

drop policy if exists "Only admin can update tool logos" on storage.objects;
create policy "Only admin can update tool logos"
on storage.objects
for update
using (bucket_id = 'tool-logos' and public.is_hgl_admin())
with check (bucket_id = 'tool-logos' and public.is_hgl_admin());

drop policy if exists "Only admin can delete tool logos" on storage.objects;
create policy "Only admin can delete tool logos"
on storage.objects
for delete
using (bucket_id = 'tool-logos' and public.is_hgl_admin());
