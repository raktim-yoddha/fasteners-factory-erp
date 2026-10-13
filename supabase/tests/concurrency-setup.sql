-- Only replayed into the runner-owned disposable database; never into the project or a hosted database.
do $$begin
 if current_database() !~ '^fasteners_acceptance_[0-9a-f]{16}$'
   or coalesce((select shobj_description(oid,'pg_database')from pg_database where datname=current_database()),'')not like 'fasteners-concurrency:%'
 then raise exception 'Concurrency fixtures require a marker-verified disposable database';end if;
end$$;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-4000-8000-000000000001','sample-concurrent-owner@example.invalid',now()),
 ('20000000-0000-4000-8000-000000000002','sample-concurrent-stores@example.invalid',now());
create schema acceptance;
create table acceptance.fixture(key text primary key,value uuid not null);
grant usage on schema acceptance to authenticated;
grant select,insert on acceptance.fixture to authenticated;
create function acceptance.command(action text,payload jsonb,request_key uuid,expected_revision text default null) returns jsonb language sql security invoker set search_path='' as $$
 select public.execute_command(jsonb_strip_nulls(jsonb_build_object('contractVersion',1,'command',action,
 'authority',jsonb_build_object('kind','team','companyId',(select value from acceptance.fixture where key='company'),'plantId',(select value from acceptance.fixture where key='plant')),
 'idempotencyKey',request_key,'expectedRevision',expected_revision,'payload',payload)))
$$;
create function acceptance.commit(action text,payload jsonb)returns uuid language plpgsql security invoker set search_path=''as $$
declare result jsonb;begin result:=acceptance.command(action,payload,gen_random_uuid());
 if result->>'ok'<>'true'then raise exception 'SAMPLE fixture command failed: % %',action,result;end if;
 return(result->'value'->>'id')::uuid;end$$;
set role authenticated;
set request.jwt.claims='{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
insert into acceptance.fixture values('company',public.create_company('{"name":"SAMPLE concurrency factory","plantName":"SAMPLE plant","warehouseName":"SAMPLE stores","currency":"INR","timezone":"Asia/Kolkata"}',gen_random_uuid()));
insert into acceptance.fixture select 'plant',id from public.plants where company_id=(select value from acceptance.fixture where key='company');
select public.manage_company((select value from acceptance.fixture where key='company'),'independent_review',null,false);
do $$declare customer uuid;item uuid;engineering uuid;quote uuid;orders uuid;lot uuid;begin
 customer:=acceptance.commit('save_record','{"kind":"customer","code":"SAMPLE-C","name":"SAMPLE Customer","fields":{}}');
 item:=acceptance.commit('save_record','{"kind":"item","code":"SAMPLE-I","name":"SAMPLE Bolt","fields":{"unit":"pcs"}}');
 engineering:=acceptance.commit('save_record',jsonb_build_object('kind','engineering','code','SAMPLE-E','name','SAMPLE Engineering','fields',jsonb_build_object('itemId',item,'drawingReference','SAMPLE drawing','route','SAMPLE operations','outputBasis','1')));
 perform acceptance.commit('transition_record',jsonb_build_object('id',engineering,'state','approved'));
 quote:=acceptance.commit('save_record',jsonb_build_object('kind','quotation','code','SAMPLE-Q','name','SAMPLE Quote','fields',jsonb_build_object('customerId',customer,'engineeringId',engineering,'quantity','100','unitPrice','1')));
 perform acceptance.commit('transition_record',jsonb_build_object('id',quote,'state','pending_approval'));
 perform acceptance.commit('transition_record',jsonb_build_object('id',quote,'state','approved'));
 orders:=acceptance.commit('save_record',jsonb_build_object('kind','sales_order','code','SAMPLE-SO','name','SAMPLE Order','fields',jsonb_build_object('customerId',customer,'quotationId',quote,'engineeringId',engineering,'itemId',item,'quantity','100','dueDate','2026-12-01','poReference','SAMPLE PO','poDiscrepancies','')));
 perform acceptance.commit('transition_record',jsonb_build_object('id',orders,'state','accepted'));
 lot:=acceptance.commit('receive_goods',jsonb_build_object('itemId',item,'quantity','10.000001','location','SAMPLE FG','supplierReference','SAMPLE concurrency receipt'));
 perform acceptance.commit('record_inspection',jsonb_build_object('lotId',lot,'lower','0','upper','2','readings',jsonb_build_array('1'),'unit','pcs'));
 perform acceptance.commit('release_lot',jsonb_build_object('lotId',lot));
 insert into acceptance.fixture values('lot',lot),('order',orders);
end$$;
reset role;
insert into public.memberships(company_id,user_id,all_plants)select value,'20000000-0000-4000-8000-000000000002',false from acceptance.fixture where key='company';
insert into public.member_role_assignments select value,'20000000-0000-4000-8000-000000000002','Stores'from acceptance.fixture where key='company';
insert into public.member_plant_scopes select (select value from acceptance.fixture where key='company'),'20000000-0000-4000-8000-000000000002',value from acceptance.fixture where key='plant';
