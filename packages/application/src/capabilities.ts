import {
  supportedTeamCommands,
  type Authority,
  type CommandName,
  type CommandRequest,
  type Snapshot,
} from '@fasteners/contracts';
export function capability(
  authority: Authority,
  snapshot: Snapshot,
  command: CommandName,
  payload?: CommandRequest['payload'],
): { allowed: boolean; reason: string } {
  if (command === 'consume_material')
    return {
      allowed: false,
      reason: 'Material consumption awaits approved output/scrap and genealogy reconciliation.',
    };
  if (command === 'record_production_output')
    return {
      allowed: false,
      reason:
        'Production output awaits approved component consumption and genealogy reconciliation.',
    };
  if (
    command === 'transition_record' &&
    payload &&
    'id' in payload &&
    'state' in payload &&
    payload.state === 'closed' &&
    snapshot.records.find((row) => row.id === payload.id)?.kind === 'ncr'
  )
    return {
      allowed: false,
      reason: 'NCR closure awaits verified disposition and independent review.',
    };
  if (authority.kind === 'solo') return { allowed: true, reason: '' };
  if (!(supportedTeamCommands as readonly string[]).includes(command))
    return { allowed: false, reason: 'This command is not yet delivered for team authority.' };
  let permission = '';
  switch (command) {
    case 'save_record': {
      const kind = payload && 'kind' in payload ? payload.kind : '';
      permission = ['rfq', 'quotation', 'sales_order'].includes(kind)
        ? 'sales.manage'
        : kind === 'purchase_order'
          ? 'procurement.manage'
          : kind === 'work_order'
            ? 'planning.manage'
            : kind === 'equipment'
              ? 'equipment.manage'
              : kind === 'ncr'
                ? 'quality.inspect'
                : kind === 'jobwork'
                  ? 'jobwork.manage'
                  : 'master_data.manage';
      break;
    }
    case 'transition_record': {
      const id = payload && 'id' in payload ? payload.id : undefined;
      const record = snapshot.records.find((row) => row.id === id);
      const next = payload && 'state' in payload ? payload.state : '';
      if (record?.kind === 'work_order' || record?.kind === 'jobwork')
        return {
          allowed: false,
          reason: 'Team execution for this workflow is pending its invariant-owning slice.',
        };
      permission =
        record?.kind === 'engineering'
          ? 'engineering.approve'
          : record?.kind === 'quotation' && next === 'approved'
            ? 'commercial.approve'
            : record?.kind === 'purchase_order' && next === 'open'
              ? 'procurement.approve'
              : record && ['rfq', 'quotation', 'sales_order'].includes(record.kind)
                ? 'sales.manage'
                : record?.kind === 'purchase_order'
                  ? 'procurement.manage'
                  : record?.kind === 'ncr'
                    ? 'quality.review'
                    : record?.kind === 'equipment'
                      ? 'equipment.manage'
                      : 'master_data.manage';
      break;
    }
    case 'receive_goods':
    case 'receive_customer_return':
      permission = 'stock.receive';
      break;
    case 'record_inspection':
      permission = 'quality.inspect';
      break;
    case 'release_lot':
    case 'hold_lot':
      permission = 'quality.review';
      break;
    case 'reserve_stock':
    case 'release_reservation':
      permission = 'stock.reserve';
      break;
    case 'verify_packing':
      permission = 'dispatch.manage';
      break;
    case 'confirm_dispatch':
      permission = 'dispatch.confirm';
      break;
    default:
      return { allowed: false, reason: 'This command is not delivered in team mode.' };
  }
  return snapshot.capabilities?.includes(permission)
    ? { allowed: true, reason: '' }
    : { allowed: false, reason: `Current membership requires ${permission}.` };
}
