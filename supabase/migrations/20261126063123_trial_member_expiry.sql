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
             coalesce(st_private.effective_access_until(u.id)>now(),false) as active, case when st_private.effective_access_until(u.id)='infinity' then null else st_private.effective_access_until(u.id) end as paid_until,
             u.id = auth.uid() as self
      from auth.users u left join st_private.accounts a on a.owner = u.id
      where u.deleted_at is null and u.email is not null
      order by u.created_at desc, u.id offset p_offset limit 26
    ) m;
  return members;
end $$;
