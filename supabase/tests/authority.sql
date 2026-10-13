begin;
insert into auth.users(id,email,email_confirmed_at)values
 ('10000000-0000-4000-8000-000000000001','sample-owner-a@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','sample-owner-b@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000003','sample-inspector@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000004','sample-unverified@example.invalid',null);
create temporary table test_state(key text primary key,value text);
grant all on test_state to authenticated;
create function pg_temp.actor(actor uuid,assurance text default 'aal1')returns void language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal',assurance)::text,true)$$;
create function pg_temp.assert_true(value boolean,label text)returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.command(company uuid,command text,payload jsonb,request_key uuid default gen_random_uuid(),chosen_plant uuid default null)returns jsonb language sql as $$select public.execute_command(jsonb_build_object('contractVersion',1,'command',command,'authority',jsonb_strip_nulls(jsonb_build_object('kind','team','companyId',company,'plantId',chosen_plant)),'idempotencyKey',request_key,'payload',payload))$$;
create function pg_temp.commit(company uuid,command text,payload jsonb)returns uuid language plpgsql as $$declare result jsonb;begin result:=pg_temp.command(company,command,payload);if result->>'ok'<>'true'then raise exception 'FAIL command %: %',command,result;end if;return(result->'value'->>'id')::uuid;end$$;
set local role authenticated;
select pg_temp.actor('10000000-0000-4000-8000-000000000001');
do $$declare company uuid;key uuid:=gen_random_uuid();input jsonb:='{"name":"SAMPLE Factory A","plantName":"SAMPLE Plant A","warehouseName":"SAMPLE Stores A","currency":"INR","timezone":"Asia/Kolkata"}';begin
 company:=public.create_company(input,key);insert into test_state values('company_a',company::text);
 perform pg_temp.assert_true(public.create_company(input,key)=company,'company creation retry returns original company');
 begin perform public.create_company(input||'{"name":"SAMPLE changed"}',key);raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='IDEMPOTENCY_KEY_REUSED','changed company request key rejected');end;
 perform pg_temp.assert_true(jsonb_array_length(public.list_workspaces())=1,'new owner sees exactly one membership');
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000002');
insert into test_state values('company_b',public.create_company('{"name":"SAMPLE Factory B","plantName":"SAMPLE Plant B","warehouseName":"SAMPLE Stores B","currency":"INR","timezone":"Asia/Kolkata"}',gen_random_uuid())::text);
do $$begin perform pg_temp.assert_true(jsonb_array_length(public.list_workspaces())=1,'owner in B cannot discover company A');begin perform public.workspace_snapshot(jsonb_build_object('kind','team','companyId',(select value from test_state where key='company_a')));raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='PERMISSION_DENIED','nonmember snapshot rejected');end;end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000004');
do $$begin begin perform public.create_company('{"name":"SAMPLE Unverified","plantName":"A","warehouseName":"A","currency":"INR","timezone":"Asia/Kolkata"}',gen_random_uuid());raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='AUTH_REQUIRED','unverified identity cannot create company');end;end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000001');
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');customer uuid;item uuid;engineering uuid;quote uuid;orders uuid;lot uuid;inspection jsonb;reservation uuid;packed uuid;shipment uuid;key uuid:=gen_random_uuid();result jsonb;before_count integer;payload jsonb;ncr uuid;begin
 customer:=pg_temp.commit(company,'save_record','{"kind":"customer","code":"SAMPLE-C1","name":"SAMPLE Customer A","fields":{}}');
 item:=pg_temp.commit(company,'save_record','{"kind":"item","code":"SAMPLE-I1","name":"SAMPLE Bolt A","fields":{"unit":"pcs"}}');
 engineering:=pg_temp.commit(company,'save_record',jsonb_build_object('kind','engineering','code','SAMPLE-E1','name','SAMPLE Engineering A','fields',jsonb_build_object('itemId',item,'drawingReference','SAMPLE-A','route','SAMPLE operations','outputBasis','1')));
 perform pg_temp.commit(company,'transition_record',jsonb_build_object('id',engineering,'state','approved'));
 quote:=pg_temp.commit(company,'save_record',jsonb_build_object('kind','quotation','code','SAMPLE-Q1','name','SAMPLE Quote A','fields',jsonb_build_object('customerId',customer,'engineeringId',engineering,'quantity','100','unitPrice','0.1')));
 perform pg_temp.commit(company,'transition_record',jsonb_build_object('id',quote,'state','pending_approval'));perform pg_temp.commit(company,'transition_record',jsonb_build_object('id',quote,'state','approved'));
 orders:=pg_temp.commit(company,'save_record',jsonb_build_object('kind','sales_order','code','SAMPLE-SO1','name','SAMPLE Order A','fields',jsonb_build_object('customerId',customer,'quotationId',quote,'engineeringId',engineering,'itemId',item,'quantity','100','dueDate','2026-12-01','poReference','SAMPLE-PO-A','poDiscrepancies','')));
 perform pg_temp.commit(company,'transition_record',jsonb_build_object('id',orders,'state','accepted'));
 payload:=jsonb_build_object('itemId',item,'quantity','100.000001','location','SAMPLE-A','supplierReference','SAMPLE receipt');
 result:=pg_temp.command(company,'receive_goods',payload,key);perform pg_temp.assert_true(result->>'ok'='true','held receipt commits real ledger');lot:=(result->'value'->>'id')::uuid;
 perform pg_temp.assert_true(exists(select 1 from public.audit_log where entity_id=lot and command='receive_goods'and reason='Supplier reference: SAMPLE receipt'),'entered supplier receipt reference persists in immutable audit');
 perform pg_temp.assert_true(pg_temp.command(company,'receive_goods',payload,key)=result,'receipt retry returns original result');
 perform pg_temp.assert_true(pg_temp.command(company,'receive_goods',payload||'{"quantity":"99"}',key)->'error'->>'code'='IDEMPOTENCY_KEY_REUSED','changed receipt payload rejected');
 select count(*)into before_count from public.audit_log;
 result:=pg_temp.command(company,'reserve_stock',jsonb_build_object('lotId',lot,'orderId',orders,'quantity','10'));
 perform pg_temp.assert_true(result->'error'->>'code'='LOT_QC_HOLD','held lot cannot reserve');perform pg_temp.assert_true((select count(*)from public.audit_log)=before_count,'failed stock command leaves audit unchanged');
 perform pg_temp.commit(company,'record_inspection',jsonb_build_object('lotId',lot,'lower','0','upper','2','readings',jsonb_build_array('1','1.5'),'unit','pcs'));
 result:=pg_temp.command(company,'release_lot',jsonb_build_object('lotId',lot));perform pg_temp.assert_true(result->'error'->>'code'='INDEPENDENT_REVIEW_REQUIRED','Owner cannot self-review independent inspection');
 perform public.manage_company(company,'independent_review',null,false);
 perform pg_temp.commit(company,'release_lot',jsonb_build_object('lotId',lot));
 reservation:=pg_temp.commit(company,'reserve_stock',jsonb_build_object('lotId',lot,'orderId',orders,'quantity','20'));
 result:=pg_temp.command(company,'verify_packing',jsonb_build_object('reservationId',reservation,'quantity','20','scannedLotCode','SAMPLE-WRONG'));perform pg_temp.assert_true(result->'error'->>'code'='INVALID_INPUT','mismatched package scan rejected');
 packed:=pg_temp.commit(company,'verify_packing',jsonb_build_object('reservationId',reservation,'quantity','20','scannedLotCode',(select code from public.stock_lots where id=lot)));
 perform pg_temp.commit(company,'hold_lot',jsonb_build_object('lotId',lot,'reason','SAMPLE new containment'));
 result:=pg_temp.command(company,'confirm_dispatch',jsonb_build_object('packageId',packed,'carrier','SAMPLE carrier'));perform pg_temp.assert_true(result->'error'->>'code'='LOT_QC_HOLD','new hold blocks prepared package dispatch');
 perform pg_temp.commit(company,'record_inspection',jsonb_build_object('lotId',lot,'lower','0','upper','2','readings',jsonb_build_array('1'),'unit','pcs'));perform pg_temp.commit(company,'release_lot',jsonb_build_object('lotId',lot));
 shipment:=pg_temp.commit(company,'confirm_dispatch',jsonb_build_object('packageId',packed,'carrier','SAMPLE carrier'));
 perform pg_temp.assert_true((select state from public.records where id=orders)='partially_fulfilled','partial dispatch preserves open order');
 result:=pg_temp.command(company,'receive_customer_return',jsonb_build_object('shipmentId',shipment,'quantity','21','reason','SAMPLE excessive return'));perform pg_temp.assert_true(result->'error'->>'code'='INVALID_INPUT','excessive return rejected');
 perform pg_temp.commit(company,'receive_customer_return',jsonb_build_object('shipmentId',shipment,'quantity','5','reason','SAMPLE return'));
 perform pg_temp.assert_true((select sum(quantity)from public.stock_ledger_entries where lot_id=lot and custody='stores')=80.000001,'large exact ledger calculation retains six decimals');
 ncr:=pg_temp.commit(company,'save_record',jsonb_build_object('kind','ncr','code','SAMPLE-NCR','name','SAMPLE containment','fields',jsonb_build_object('lotId',lot,'quantity','1','defect','SAMPLE defect','disposition','SAMPLE text claim')));
 perform pg_temp.commit(company,'transition_record',jsonb_build_object('id',ncr,'state','awaiting_execution','reason','SAMPLE proposal'));
 select count(*)into before_count from public.audit_log;
 result:=pg_temp.command(company,'transition_record',jsonb_build_object('id',ncr,'state','closed','reason','SAMPLE text claim'));
 perform pg_temp.assert_true(result->'error'->>'code'='INVALID_TRANSITION','NCR cannot close through text disposition alone');
 result:=public.execute_command(jsonb_build_object('contractVersion',1,'command','save_record','authority',jsonb_build_object('kind','team','companyId',company,'plantId',(select plant_id from public.stock_lots where id=lot)),'expectedRevision',(select revision::text from public.records where records.id=ncr),'idempotencyKey',gen_random_uuid(),'payload',jsonb_build_object('kind','ncr','id',ncr,'code','SAMPLE-NCR','name','SAMPLE containment','fields',jsonb_build_object('lotId',(select id from public.stock_lots where id<>lot limit 1),'quantity','1','defect','SAMPLE defect','disposition','SAMPLE text claim'))));
 perform pg_temp.assert_true(result->'error'->>'code'='INVALID_TRANSITION','existing NCR containment reference cannot move');
 perform pg_temp.assert_true((select count(*)from public.audit_log)=before_count,'rejected NCR completion and movement leave audit unchanged');
 insert into test_state values('lot_a',lot::text),('item_a',item::text),('order_a',orders::text);
 begin update public.memberships set all_plants=true;raise exception 'missing rejection';exception when insufficient_privilege then perform pg_temp.assert_true(true,'direct membership mutation denied');end;
 begin update public.stock_ledger_entries set quantity=999;raise exception 'missing rejection';exception when insufficient_privilege then perform pg_temp.assert_true(true,'direct ledger mutation denied');end;
end$$;
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');invitation jsonb;plant uuid;begin
 select id into plant from public.plants where company_id=company limit 1;
 invitation:=public.invite_member(company,'sample-inspector@example.invalid',array['Quality inspector'],array[plant],false,gen_random_uuid());insert into test_state values('invite_inspector',invitation->>'token');
 begin perform public.update_member_access(company,'10000000-0000-4000-8000-000000000001',array['Administrator'],array[plant],true,false,array[]::text[],gen_random_uuid());raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='PERMISSION_DENIED','Owner cannot be removed or demoted through member administration');end;
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000003');
select public.accept_invitation((select value from test_state where key='invite_inspector'));
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');lot uuid:=(select value::uuid from test_state where key='lot_a');result jsonb;begin
 perform pg_temp.assert_true(jsonb_array_length(public.list_workspaces())=1,'invitation gives intended verified identity membership');
 result:=pg_temp.command(company,'release_lot',jsonb_build_object('lotId',lot));perform pg_temp.assert_true(result->'error'->>'code'='PERMISSION_DENIED','inspector has no release permission');
 result:=pg_temp.command(company,'reserve_stock',jsonb_build_object('lotId',lot,'orderId',(select value from test_state where key='order_a'),'quantity','1'));perform pg_temp.assert_true(result->'error'->>'code'='PERMISSION_DENIED','inspector cannot borrow Stores role');
 perform pg_temp.assert_true((select count(*)from public.records where kind='quotation')=0,'read API hides commercial prices from inspector');
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000001');
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');plant uuid;plant_key uuid:=gen_random_uuid();result jsonb;item uuid:=(select value::uuid from test_state where key='item_a');row public.records%rowtype;before_count integer;begin
 plant:=public.create_plant(company,'SAMPLE Scoped plant','SAMPLE Scoped stores',plant_key);
 perform pg_temp.assert_true(public.create_plant(company,'SAMPLE Scoped plant','SAMPLE Scoped stores',plant_key)=plant,'plant creation retries commit once');
 insert into test_state values('plant_scoped',plant::text);
 select * into row from public.records where id=item;
 insert into test_state values('plant_original',row.plant_id::text);
 select count(*) into before_count from public.audit_log;
 result:=public.execute_command(jsonb_build_object('contractVersion',1,'command','save_record','authority',jsonb_build_object('kind','team','companyId',company,'plantId',row.plant_id),'expectedRevision',row.revision::text,'idempotencyKey',gen_random_uuid(),'payload',jsonb_build_object('kind','item','id',item,'code',row.code,'name',row.name,'fields',row.fields||'{"unit":"kg"}')));
 perform pg_temp.assert_true(result->'error'->>'code'='INVALID_TRANSITION','referenced item interpretation cannot change');
 perform pg_temp.assert_true((select count(*)from public.audit_log)=before_count,'item integrity rejection leaves no audit mutation');
 perform public.update_member_access(company,'10000000-0000-4000-8000-000000000003',array['Stores','Quality inspector'],array[plant],false,true,array[]::text[],gen_random_uuid());
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000003');
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');plant uuid:=(select value::uuid from test_state where key='plant_scoped');snapshot jsonb;result jsonb;begin
 snapshot:=public.workspace_snapshot(jsonb_build_object('kind','team','companyId',company));
 perform pg_temp.assert_true(snapshot->>'plantId'=plant::text and jsonb_array_length(snapshot->'plants')=1,'plant selector exposes exactly the current member scope');
 perform pg_temp.assert_true(jsonb_array_length(snapshot->'lots')=0,'default snapshot chooses an authorized plant and hides first plant stock');
 perform pg_temp.assert_true(snapshot->'capabilities' ? 'stock.receive' and snapshot->'capabilities' ? 'quality.inspect' and not(snapshot->'capabilities' ? 'quality.review'),'multiple roles compose current capabilities without reviewer privilege');
 begin perform public.workspace_snapshot(jsonb_build_object('kind','team','companyId',company,'plantId',(select value from test_state where key='plant_original')));raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='PERMISSION_DENIED','forged first plant snapshot denied');end;
 result:=pg_temp.command(company,'receive_goods',jsonb_build_object('itemId',(select value from test_state where key='item_a'),'quantity','1','location','SAMPLE scoped','supplierReference','SAMPLE'));
 perform pg_temp.assert_true(result->>'ok'='false','cross-plant item cannot be received using a legitimate Stores role');
 begin perform public.member_admin_snapshot(company);raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='PERMISSION_DENIED','ordinary multiple-role member cannot enumerate member administration');end;
 begin perform public.update_member_access(company,auth.uid(),array['Owner'],array[plant],true,true,array[]::text[],gen_random_uuid());raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='PERMISSION_DENIED','member cannot escalate itself to Owner');end;
 begin perform public.create_plant(company,'SAMPLE Escalated','SAMPLE',gen_random_uuid());raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='PERMISSION_DENIED','ordinary member cannot create plants');end;
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000001');
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');plant uuid:=(select value::uuid from test_state where key='plant_scoped');begin
 perform public.update_member_access(company,'10000000-0000-4000-8000-000000000003',array['Administrator'],array[plant],false,true,array[]::text[],gen_random_uuid());
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000003');
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');plant uuid:=(select value::uuid from test_state where key='plant_scoped');begin
 begin perform public.invite_member(company,'sample-escalate@example.invalid',array['Quality reviewer'],array[plant],false,gen_random_uuid());raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='PERMISSION_DENIED','Administrator cannot delegate an approval permission it lacks');end;
 begin perform public.update_member_access(company,auth.uid(),array['Administrator'],array[plant],false,true,array['quality.review'],gen_random_uuid());raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='PERMISSION_DENIED','explicit grants cannot exceed current delegator permission');end;
 begin perform public.update_member_access(company,auth.uid(),array['Administrator'],array[plant],true,true,array[]::text[],gen_random_uuid());raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='PERMISSION_DENIED','plant-scoped Administrator cannot grant all plants');end;
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000001');
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');begin
 begin perform public.manage_company(company,'require_mfa',null,true);raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='AUTH_REQUIRED','Owner must verify MFA before enabling required MFA');end;
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000001','aal2');
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');begin
 perform public.manage_company(company,'require_mfa',null,true);
 perform public.manage_company(company,'request_transfer','10000000-0000-4000-8000-000000000003',null);
 perform pg_temp.assert_true((select require_mfa from public.companies where id=company),'AAL2 Owner can enable server MFA policy');
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000003');
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');begin
 begin perform public.manage_company(company,'accept_transfer',null,null);raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='AUTH_REQUIRED','ownership acceptance cannot bypass required MFA');end;
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000001','aal2');
select public.manage_company((select value::uuid from test_state where key='company_a'),'require_mfa',null,false);
select pg_temp.actor('10000000-0000-4000-8000-000000000001');
select public.update_member_access((select value::uuid from test_state where key='company_a'),'10000000-0000-4000-8000-000000000003',array['Quality inspector'],array[(select id from public.plants where company_id=(select value::uuid from test_state where key='company_a')limit 1)],false,false,array[]::text[],gen_random_uuid());
select pg_temp.actor('10000000-0000-4000-8000-000000000003');
do $$begin perform pg_temp.assert_true(jsonb_array_length(public.list_workspaces())=0,'revocation is effective with unchanged JWT identity');end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000001');
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');plant uuid:=(select value::uuid from test_state where key='plant_original');item uuid:=(select value::uuid from test_state where key='item_a');supplier uuid;po uuid;result jsonb;begin
 result:=pg_temp.command(company,'save_record','{"kind":"supplier","code":"SAMPLE-OP-SUPPLIER","name":"SAMPLE private supplier","fields":{}}',gen_random_uuid(),plant);if result->>'ok'<>'true'then raise exception 'Operational supplier seed failed: %',result;end if;supplier:=(result->'value'->>'id')::uuid;
 result:=pg_temp.command(company,'save_record',jsonb_build_object('kind','purchase_order','code','SAMPLE-OP-PO','name','SAMPLE private purchase','fields',jsonb_build_object('supplierId',supplier,'itemId',item,'quantity','10','unitPrice','999.1','dueDate','2026-12-01')),gen_random_uuid(),plant);if result->>'ok'<>'true'then raise exception 'Operational PO seed failed: %',result;end if;po:=(result->'value'->>'id')::uuid;
 result:=pg_temp.command(company,'transition_record',jsonb_build_object('id',po,'state','pending_approval'),gen_random_uuid(),plant);if result->>'ok'<>'true'then raise exception 'PO submission failed: %',result;end if;
 result:=pg_temp.command(company,'transition_record',jsonb_build_object('id',po,'state','open'),gen_random_uuid(),plant);if result->>'ok'<>'true'then raise exception 'PO approval failed: %',result;end if;
 insert into test_state values('operational_po',po::text);
 perform public.update_member_access(company,'10000000-0000-4000-8000-000000000003',array['Stores'],array[plant],false,true,array[]::text[],gen_random_uuid());
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000003');
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');plant uuid:=(select value::uuid from test_state where key='plant_original');snapshot jsonb;result jsonb;before_count integer;begin
 snapshot:=public.workspace_snapshot(jsonb_build_object('kind','team','companyId',company,'plantId',plant));
 perform pg_temp.assert_true(jsonb_array_length(snapshot->'operationalOrders')=1,'Stores receives usable sales obligation reference without sales.read');
 perform pg_temp.assert_true(jsonb_array_length(snapshot->'operationalPurchaseOrders')=1,'Stores receives an approved PO reference without procurement.manage');
 perform pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(snapshot->'records')r where r->>'kind'in('quotation','sales_order','purchase_order')),'operational references do not unlock commercial records');
 perform pg_temp.assert_true(not((snapshot->'operationalPurchaseOrders'->0)?'unitPrice')and not((snapshot->'operationalOrders'->0)?'customerId')and(select count(*)from jsonb_object_keys(snapshot->'operationalPurchaseOrders'->0))=5,'operational references contain only the five permitted fields');
 result:=pg_temp.command(company,'receive_goods',jsonb_build_object('itemId',(select value from test_state where key='item_a'),'quantity','4','location','SAMPLE Stores','supplierReference','SAMPLE partial PO','purchaseOrderId',(select value from test_state where key='operational_po')),gen_random_uuid(),plant);
 perform pg_temp.assert_true(result->>'ok'='true','Stores can commit a real partial receipt against a private approved PO');
 select count(*)into before_count from public.audit_log;
 result:=pg_temp.command(company,'receive_goods',jsonb_build_object('itemId',(select value from test_state where key='item_a'),'quantity','7','location','SAMPLE Stores','supplierReference','SAMPLE over-receipt','purchaseOrderId',(select value from test_state where key='operational_po')),gen_random_uuid(),plant);
 perform pg_temp.assert_true(result->'error'->>'code'='INVALID_INPUT','remaining PO obligation is enforced for Stores without revealing price');
 snapshot:=public.workspace_snapshot(jsonb_build_object('kind','team','companyId',company,'plantId',(select value from test_state where key='plant_scoped')));
 raise exception 'missing scope rejection';
exception when others then
 if sqlerrm='PERMISSION_DENIED'then perform pg_temp.assert_true(true,'operational references remain plant-scoped');else raise;end if;
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000001');
select public.update_member_access((select value::uuid from test_state where key='company_a'),'10000000-0000-4000-8000-000000000003',array['Administrator'],array[(select value::uuid from test_state where key='plant_scoped')],false,true,array[]::text[],gen_random_uuid());
select public.manage_company((select value::uuid from test_state where key='company_a'),'request_transfer','10000000-0000-4000-8000-000000000003',null);
select pg_temp.actor('10000000-0000-4000-8000-000000000003');
select public.manage_company((select value::uuid from test_state where key='company_a'),'accept_transfer',null,null);
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');begin
 perform pg_temp.assert_true(exists(select 1 from public.member_role_assignments where company_id=company and user_id=auth.uid()and role_name='Owner')and(select all_plants from public.memberships where company_id=company and user_id=auth.uid()),'accepted ownership grants current Owner authority and all plants');
 perform pg_temp.assert_true(not exists(select 1 from public.member_role_assignments where company_id=company and user_id='10000000-0000-4000-8000-000000000001'and role_name='Owner'),'accepted transfer removes prior Owner authority atomically');
end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000001');
do $$begin begin perform public.manage_company((select value::uuid from test_state where key='company_a'),'archive',null,null);raise exception 'missing rejection';exception when others then perform pg_temp.assert_true(sqlerrm='PERMISSION_DENIED','previous Owner cannot archive after accepted transfer');end;end$$;
select pg_temp.actor('10000000-0000-4000-8000-000000000003');
select public.manage_company((select value::uuid from test_state where key='company_a'),'archive',null,null);
do $$declare company uuid:=(select value::uuid from test_state where key='company_a');result jsonb;begin
 perform pg_temp.assert_true(jsonb_array_length(public.workspace_snapshot(jsonb_build_object('kind','team','companyId',company,'plantId',(select value from test_state where key='plant_original')))->'records')>0,'authorized history remains readable after company archive');
 result:=pg_temp.command(company,'save_record','{"kind":"customer","code":"SAMPLE-AFTER-ARCHIVE","name":"SAMPLE blocked","fields":{}}');
 perform pg_temp.assert_true(result->'error'->>'code'='INVALID_TRANSITION','archived company rejects new business commands');
end$$;
reset role;
rollback;
