-- Run once in your Supabase project's SQL Editor (safe to run again).
begin;
create schema if not exists st_private;
revoke all on schema st_private from public, anon, authenticated;

create table if not exists st_private.accounts (
  owner uuid primary key references auth.users(id) on delete cascade,
  trial text not null check (trial ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
  paid boolean not null default false
);
alter table st_private.accounts add column if not exists paid_until timestamptz;
create table if not exists st_private.manager (
  singleton boolean primary key default true check (singleton),
  owner uuid not null unique references auth.users(id) on delete cascade
);
alter table st_private.manager enable row level security;

-- Resolve the owner's verified identity once. Browser clients cannot assign this role.
insert into st_private.manager(owner)
  select id from auth.users
  where lower(email)='growfinansy@gmail.com' and email_confirmed_at is not null and deleted_at is null
  on conflict(singleton) do nothing;
insert into st_private.accounts(owner,trial,paid)
  select owner,to_char(now() at time zone 'Asia/Bishkek','YYYY-MM'),true from st_private.manager
  on conflict(owner) do update set paid=true, paid_until=null;

create or replace function st_private.is_manager()
returns boolean language sql stable set search_path = '' as $$
  select exists(select 1 from st_private.manager where owner=auth.uid());
$$;
create or replace function st_private.has_access(a st_private.accounts)
returns boolean language sql stable set search_path = '' as $$
  select a.paid and (a.paid_until is null or a.paid_until > now());
$$;
revoke all on function st_private.is_manager(), st_private.has_access(st_private.accounts) from public,anon,authenticated;

create table if not exists st_private.records (
  owner uuid not null references st_private.accounts(owner) on delete cascade,
  kind text not null check(kind in ('months','debts')),
  key text not null,
  rev integer not null check(rev>0),
  data jsonb not null,
  primary key(owner, kind, key)
);
alter table st_private.accounts enable row level security;
alter table st_private.records enable row level security;
revoke all on all tables in schema st_private from public, anon, authenticated;

create or replace function public.st_book(p_month text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  a st_private.accounts%rowtype;
  m jsonb;
  d jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_month is null or p_month !~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$' then raise exception 'BAD_MONTH'; end if;
  insert into st_private.accounts(owner,trial) values(u,p_month) on conflict do nothing;
  select * into strict a from st_private.accounts where owner=u;
  insert into st_private.records(owner,kind,key,rev,data)
    values(u,'months',a.trial,1,'{"entries":[],"goals":[{"name":"Подушка","rate":20}]}') on conflict do nothing;
  select coalesce(jsonb_object_agg(key,jsonb_build_object('rev',rev,'data',data)) filter(where kind='months'),'{}'),
         coalesce(jsonb_object_agg(key,jsonb_build_object('rev',rev,'data',data)) filter(where kind='debts'),'{}')
    into m,d from st_private.records where owner=u;
  return jsonb_build_object('paid',st_private.has_access(a),'manager',st_private.is_manager(),'paid_until',a.paid_until,'trial',a.trial,'months',m,'debts',d);
end $$;

create or replace function public.st_save(p_kind text,p_key text,p_revision integer,p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  a st_private.accounts%rowtype;
  new_revision integer;
  last_day integer;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into strict a from st_private.accounts where owner=u for update;
  if p_data is null or jsonb_typeof(p_data)<>'object' or p_revision is null or p_revision<0 then raise exception 'BAD_RECORD'; end if;
  if p_kind='months' then
    if p_key is null or p_key !~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$' then raise exception 'BAD_MONTH'; end if;
    if not st_private.has_access(a) and p_key<>a.trial then raise exception 'MONTH_LIMIT'; end if;
    if jsonb_typeof(p_data->'entries') is distinct from 'array' or jsonb_typeof(p_data->'goals') is distinct from 'array' then raise exception 'BAD_RECORD'; end if;
    last_day := extract(day from ((p_key||'-01')::date + interval '1 month - 1 day'));
    if exists(select 1 from jsonb_array_elements(p_data->'entries') e where (e->>'day') is null
        or (e->>'day') !~ '^[1-9][0-9]?$' or (e->>'day')::integer > last_day) then raise exception 'BAD_DAY'; end if;
  elsif p_kind='debts' then
    if p_key is null or p_key !~ '^[0-9a-f-]{36}$' or jsonb_typeof(p_data->'payments') is distinct from 'array'
      then raise exception 'BAD_DEBT'; end if;
  else raise exception 'BAD_KIND'; end if;
  if p_revision=0 then
    insert into st_private.records(owner,kind,key,rev,data) values(u,p_kind,p_key,1,p_data)
      on conflict do nothing returning rev into new_revision;
  else
    update st_private.records set rev=rev+1,data=p_data
      where owner=u and kind=p_kind and key=p_key and rev=p_revision returning rev into new_revision;
  end if;
  if new_revision is null then raise exception 'STALE_VERSION'; end if;
  return jsonb_build_object('rev',new_revision,'data',p_data);
end $$;
revoke all on function public.st_book(text), public.st_save(text,text,integer,jsonb) from public,anon;
grant execute on function public.st_book(text), public.st_save(text,text,integer,jsonb) to authenticated;
-- Both RPCs authorize the caller before reading any member information.
create or replace function public.st_members(p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  members jsonb;
begin
  if not st_private.is_manager() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_offset is null or p_offset < 0 then raise exception 'BAD_OFFSET'; end if;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.joined desc, m.id),'[]'::jsonb)
    into members
    from (
      select u.id, u.email, u.created_at as joined,
             coalesce(st_private.has_access(a),false) as active, a.paid_until,
             u.id = auth.uid() as self
      from auth.users u left join st_private.accounts a on a.owner = u.id
      where u.deleted_at is null and u.email is not null
      order by u.created_at desc, u.id offset p_offset limit 26
    ) m;
  return members;
end $$;

create or replace function public.st_grant_member(p_member uuid, p_years integer)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  expires timestamptz;
begin
  if not st_private.is_manager() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_years is null or p_years not in (1,3) then raise exception 'BAD_TERM'; end if;
  if p_member=auth.uid() then raise exception 'OWNER_ACCOUNT'; end if;
  expires := ((now() at time zone 'Asia/Bishkek')::date + make_interval(years => p_years)) at time zone 'Asia/Bishkek';
  insert into st_private.accounts as a(owner, trial, paid, paid_until)
    select u.id, to_char(now() at time zone 'Asia/Bishkek','YYYY-MM'), true, expires
    from auth.users u where u.id=p_member and u.deleted_at is null and u.email is not null
    on conflict(owner) do update set paid=true, paid_until=excluded.paid_until
    where not (a.paid and a.paid_until is null)
    returning paid_until into expires;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  return expires;
end $$;
revoke all on function public.st_members(integer), public.st_grant_member(uuid,integer) from public,anon;
grant execute on function public.st_members(integer), public.st_grant_member(uuid,integer) to authenticated;
commit;
