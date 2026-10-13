-- An existing NCR cannot move its containment reference to another lot.
create or replace function private.guard_record_integrity() returns trigger
language plpgsql set search_path = '' as $$
begin
 if old.kind = 'item' and exists (
   select 1 from unnest(array['unit','grade','finish']) field
   where coalesce(old.fields->>field,'') is distinct from coalesce(new.fields->>field,'')
 ) and (
   exists(select 1 from public.stock_lots where company_id=old.company_id and item_id=old.id)
   or exists(select 1 from public.records where company_id=old.company_id and id<>old.id and fields->>'itemId'=old.id::text)
 ) then raise exception 'INVALID_TRANSITION'; end if;
 if old.kind='ncr' and (old.fields->>'lotId')is distinct from(new.fields->>'lotId')then raise exception 'INVALID_TRANSITION';end if;
 if old.kind='ncr' and new.state='closed' then raise exception 'INVALID_TRANSITION'; end if;
 return new;
end$$;
