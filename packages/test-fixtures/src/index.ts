import {
  DomainError,
  type Authority,
  type CommandName,
  type CommandPayload,
  type EntityKind,
  type Repository,
  type Workspace,
} from '@fasteners/contracts';
import { request } from '@fasteners/application';
export async function commit<K extends CommandName>(
  repository: Repository,
  authority: Authority,
  command: K,
  payload: CommandPayload<K>,
  expectedRevision?: string,
): Promise<string> {
  const result = await repository.execute(request(authority, command, payload, expectedRevision));
  if (!result.ok) throw new DomainError(result.error.code, result.error.message);
  return result.value.id;
}
export async function createSampleWorkspace(repository: Repository): Promise<Workspace> {
  const workspace = await repository.createWorkspace({
    name: 'SAMPLE Factory A',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  });
  const authority: Authority = { kind: 'solo', workspaceId: workspace.id };
  const save = (kind: EntityKind, code: string, name: string, fields: Record<string, string>) =>
    commit(repository, authority, 'save_record', { kind, code, name, fields });
  const transition = (id: string, state: string) =>
    commit(repository, authority, 'transition_record', { id, state });
  const customerId = await save('customer', 'SAMPLE-C001', 'SAMPLE Customer A', {});
  await save('supplier', 'SAMPLE-S001', 'SAMPLE Supplier A', {});
  const itemId = await save('item', 'SAMPLE-M8', 'SAMPLE M8 hex bolt', {
    unit: 'pcs',
    grade: 'SAMPLE 8.8',
    finish: 'SAMPLE zinc',
  });
  const engineeringId = await save(
    'engineering',
    'SAMPLE-ENG-01',
    'SAMPLE M8 engineering revision A',
    {
      itemId,
      drawingReference: 'SAMPLE-DWG-A',
      route: 'SAMPLE heading / threading / inspection',
      outputBasis: '1',
    },
  );
  await transition(engineeringId, 'approved');
  const quotationId = await save('quotation', 'SAMPLE-Q001', 'SAMPLE Customer A quotation', {
    customerId,
    engineeringId,
    quantity: '100',
    unitPrice: '4.5',
    materialCost: '1.5',
    processCost: '1',
  });
  await transition(quotationId, 'pending_approval');
  await transition(quotationId, 'approved');
  const orderId = await save('sales_order', 'SAMPLE-SO001', 'SAMPLE Customer A — M8 bolts', {
    customerId,
    quotationId,
    engineeringId,
    itemId,
    quantity: '100',
    dueDate: '2026-12-01',
    poReference: 'SAMPLE-PO-001',
    poDiscrepancies: '',
  });
  await transition(orderId, 'accepted');
  await save('equipment', 'SAMPLE-MC001', 'SAMPLE heading machine', {
    calibrationDue: '2030-01-01',
  });
  await save('rfq', 'SAMPLE-RFQ001', 'SAMPLE next enquiry', {
    customerId,
    itemId,
    quantity: '250',
    dueDate: '2026-12-15',
  });
  await commit(repository, authority, 'receive_goods', {
    itemId,
    quantity: '150',
    location: 'SAMPLE FG-A01',
    supplierReference: 'SAMPLE-HEAT-A',
  });
  return workspace;
}
