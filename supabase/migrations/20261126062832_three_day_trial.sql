-- Trial access is separate from paid entitlements and Paddle.
create table st_private.trials (
 owner uuid primary key references auth.users(id) on delete cascade,
 expires_at timestamptz not null
);
alter table st_private.trials enable row level security;
revoke all on st_private.trials from public,anon,authenticated;
-- Existing unpaid accounts receive 72 hours from this rollout, once.
insert into st_private.trials(owner,expires_at)
select id,case when coalesce(st_private.regional_access_until(id)>now(),false)
 then created_at+interval '72 hours' else now()+interval '72 hours' end from auth.users;
create function st_private.trial_until(u uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
 select coalesce((select expires_at from st_private.trials where owner=u),
 (select created_at+interval '72 hours' from auth.users where id=u));
$$;
create function st_private.effective_access_until(u uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
 select greatest(st_private.regional_access_until(u),st_private.trial_until(u));
$$;
revoke all on function st_private.trial_until(uuid),st_private.effective_access_until(uuid) from public,anon,authenticated;
create or replace function st_private.has_access(a st_private.accounts) returns boolean
language sql stable set search_path='' as $$
 select coalesce(st_private.effective_access_until(a.owner)>now(),false);
$$;
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
    into m,d from st_private.records where owner=u and st_private.has_access(a);
  return jsonb_build_object('paid',st_private.has_access(a),'manager',st_private.is_manager(),'paid_until',case when st_private.effective_access_until(u)='infinity' then null else st_private.effective_access_until(u) end,'trial',a.trial,'trial_until',st_private.trial_until(u),'trial_active',not coalesce(st_private.regional_access_until(u)>now(),false) and st_private.trial_until(u)>now(),'access_locked',not st_private.has_access(a),'months',m,'debts',d);
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
    if not st_private.has_access(a) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
    if jsonb_typeof(p_data->'entries') is distinct from 'array' or jsonb_typeof(p_data->'goals') is distinct from 'array' then raise exception 'BAD_RECORD'; end if;
    last_day := extract(day from ((p_key||'-01')::date + interval '1 month - 1 day'));
    if exists(select 1 from jsonb_array_elements(p_data->'entries') e where (e->>'day') is null
        or (e->>'day') !~ '^[1-9][0-9]?$' or (e->>'day')::integer > last_day) then raise exception 'BAD_DAY'; end if;
  elsif p_kind='debts' then
    if not st_private.has_access(a) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
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
