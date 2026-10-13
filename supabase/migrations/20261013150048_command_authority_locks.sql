-- Preserve the checked command implementation while making authorization stable through its commit.
alter function private.execute_command(jsonb) rename to execute_command_unlocked;
revoke all on function private.execute_command_unlocked(jsonb) from public,anon,authenticated;

create function private.execute_command(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  company uuid;
  actor uuid := auth.uid();
  error_code text;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(request) <> 'object' or request->'authority'->>'kind' <> 'team'
    or octet_length(request::text) > 150000 then raise exception 'INVALID_INPUT'; end if;
  company := (request->'authority'->>'companyId')::uuid;
  -- Consistent lock order: company, current actor membership, then the existing plant stock lock.
  -- Shared locks permit commands in parallel; company/access administration must wait for their commit.
  perform 1 from public.companies c where c.id=company for share;
  if not found then raise exception 'PERMISSION_DENIED'; end if;
  perform 1 from public.memberships m where m.company_id=company and m.user_id=actor for share;
  if not found then raise exception 'PERMISSION_DENIED'; end if;
  -- The delegate rechecks active membership, current permissions/plant, company state and MFA after these locks.
  return private.execute_command_unlocked(request);
exception when others then
  error_code := case
    when sqlerrm like 'AUTH_REQUIRED%' then 'AUTH_REQUIRED'
    when sqlerrm like 'PERMISSION_DENIED%' then 'PERMISSION_DENIED'
    when sqlstate in ('40P01','40001','55P03','57014') then 'WORKSPACE_BUSY'
    else 'INVALID_INPUT'
  end;
  return jsonb_build_object('ok',false,'error',jsonb_build_object(
    'code',error_code,'message','Command rejected by current authority rules.',
    'retryable',error_code='WORKSPACE_BUSY','correlationId',gen_random_uuid()::text));
end$$;

create or replace function public.execute_command(request jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.execute_command(request)$$;
revoke all on function private.execute_command(jsonb),public.execute_command(jsonb) from public,anon,authenticated;
grant execute on function private.execute_command(jsonb),public.execute_command(jsonb) to authenticated;
