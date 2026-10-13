-- Preserve referenced item interpretation and containment until verified disposition exists.
create function private.guard_record_integrity() returns trigger
language plpgsql set search_path = '' as $$
begin
 if old.kind = 'item' and exists (
   select 1 from unnest(array['unit','grade','finish']) field
   where coalesce(old.fields->>field,'') is distinct from coalesce(new.fields->>field,'')
 ) and (
   exists(select 1 from public.stock_lots where company_id=old.company_id and item_id=old.id)
   or exists(select 1 from public.records where company_id=old.company_id and id<>old.id and fields->>'itemId'=old.id::text)
 ) then raise exception 'INVALID_TRANSITION'; end if;
 if old.kind='ncr' and new.state='closed' then raise exception 'INVALID_TRANSITION'; end if;
 return new;
end$$;
revoke all on function private.guard_record_integrity() from public,anon,authenticated;
create trigger records_integrity_guard before update on public.records
for each row execute function private.guard_record_integrity();

create or replace function public.workspace_snapshot(authority jsonb)returns jsonb language plpgsql security invoker set search_path=''as $$
declare company uuid:=(authority->>'companyId')::uuid;plant uuid;metadata jsonb;records jsonb;lots jsonb;reservations jsonb;packages jsonb;shipments jsonb;audit jsonb;capabilities jsonb;
begin
 if authority->>'kind'<>'team'or not private.member(company)then raise exception 'PERMISSION_DENIED';end if;
 plant:=coalesce((authority->>'plantId')::uuid,(select id from public.plants where company_id=company and private.member(company,id)order by id limit 1));if plant is null or not private.member(company,plant)then raise exception 'PERMISSION_DENIED';end if;
 select jsonb_build_object('id',id,'name',name,'currency',currency,'timezone',timezone,'createdAt',created_at)into metadata from public.companies where id=company;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'code',r.code,'name',r.name,'state',r.state,'revision',r.revision::text,'fields',r.fields,'createdAt',r.created_at)),'[]')into records from(select * from public.records where company_id=company and plant_id=plant order by created_at desc,id limit 200)r;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'code',l.code,'itemId',l.item_id,'itemName',coalesce(r.name,'Restricted item'),'unit',coalesce(r.fields->>'unit',''),'location',l.location,'qcState',l.qc_state,'revision',l.revision::text,'onHand',private.decimal_text(coalesce((select sum(quantity)from public.stock_ledger_entries where company_id=company and plant_id=plant and lot_id=l.id and custody='stores'),0)),'reserved',private.decimal_text(coalesce((select sum(quantity)from public.stock_reservations where company_id=company and plant_id=plant and lot_id=l.id and state='active'),0)),'available',case when l.qc_state='held'then '0'else private.decimal_text(coalesce((select sum(quantity)from public.stock_ledger_entries where company_id=company and plant_id=plant and lot_id=l.id and custody='stores'),0)-coalesce((select sum(quantity)from public.stock_reservations where company_id=company and plant_id=plant and lot_id=l.id and state='active'),0))end,'wip',private.decimal_text(coalesce((select sum(quantity)from public.stock_ledger_entries where company_id=company and plant_id=plant and lot_id=l.id and custody='wip'),0)),'vendor',private.decimal_text(coalesce((select sum(quantity)from public.stock_ledger_entries where company_id=company and plant_id=plant and lot_id=l.id and custody='vendor'),0)))),'[]')into lots from(select * from public.stock_lots where company_id=company and plant_id=plant order by code desc limit 200)l left join public.records r on r.id=l.item_id and r.company_id=l.company_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'lotId',r.lot_id,'orderId',r.order_id,'quantity',private.decimal_text(r.quantity),'state',r.state)),'[]')into reservations from(select * from public.stock_reservations where company_id=company and plant_id=plant order by id limit 200)r;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'reservationId',p.reservation_id,'lotId',p.lot_id,'orderId',p.order_id,'quantity',private.decimal_text(p.quantity),'state',p.state)),'[]')into packages from(select * from public.packages where company_id=company and plant_id=plant order by code desc limit 200)p;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'code',s.code,'lotId',s.lot_id,'orderId',s.order_id,'quantity',private.decimal_text(s.quantity),'carrier',s.carrier,'createdAt',s.created_at)),'[]')into shipments from(select * from public.shipments where company_id=company and plant_id=plant order by created_at desc limit 200)s;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'command',a.command,'entityId',a.entity_id,'actor',a.actor::text,'reason',a.reason,'createdAt',a.created_at)),'[]')into audit from(select * from public.audit_log where company_id=company and(plant_id=plant or plant_id is null)order by created_at desc limit 100)a;
 capabilities:=private.capabilities(company,plant);
 return jsonb_build_object('workspace',metadata,'records',records,'lots',lots,'reservations',reservations,'packages',packages,'shipments',shipments,'audit',audit,'capabilities',capabilities,'asOf',now());
end$$;
