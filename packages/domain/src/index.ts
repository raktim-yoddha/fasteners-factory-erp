import { decimalSchema, DomainError, type EntityKind } from '@fasteners/contracts';
const SCALE = 1_000_000n;
export function scaled(value: string): bigint {
  decimalSchema.parse(value);
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
}
export function decimal(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const part = (abs % SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  return `${sign}${abs / SCALE}${part ? `.${part}` : ''}`;
}
export function add(...values: string[]): string {
  return decimal(values.reduce((sum, value) => sum + scaled(value), 0n));
}
export function subtract(a: string, b: string): string {
  return decimal(scaled(a) - scaled(b));
}
export function positive(value: string): void {
  if (scaled(value) <= 0n)
    throw new DomainError('INVALID_INPUT', 'Quantity must be greater than zero.');
}
export function multiply(a: string, b: string): string {
  const product = scaled(a) * scaled(b);
  return decimal((product + SCALE / 2n) / SCALE);
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const transitions: Record<EntityKind, Record<string, readonly string[]>> = {
  customer: { active: ['inactive'], inactive: ['active'] },
  supplier: { active: ['inactive'], inactive: ['active'] },
  item: { active: ['inactive'], inactive: ['active'] },
  engineering: { draft: ['approved'], approved: [] },
  rfq: {
    draft: ['qualified', 'cancelled'],
    qualified: ['quoted', 'cancelled'],
    quoted: ['converted', 'lost'],
    converted: [],
    lost: [],
    cancelled: [],
  },
  quotation: {
    draft: ['pending_approval'],
    pending_approval: ['approved', 'draft'],
    approved: ['sent', 'superseded'],
    sent: ['accepted', 'rejected', 'expired'],
    accepted: [],
    rejected: [],
    expired: [],
    superseded: [],
  },
  sales_order: {
    draft: ['accepted', 'cancelled'],
    accepted: ['closed', 'cancelled'],
    partially_fulfilled: ['closed'],
    fulfilled: ['closed'],
    closed: [],
    cancelled: [],
  },
  purchase_order: {
    draft: ['pending_approval', 'cancelled'],
    pending_approval: ['open', 'draft'],
    open: ['closed', 'cancelled'],
    partial_receipt: ['closed'],
    received: ['closed'],
    closed: [],
    cancelled: [],
  },
  work_order: {
    draft: ['released', 'cancelled'],
    released: ['in_progress', 'blocked', 'cancelled'],
    in_progress: ['blocked', 'completed'],
    blocked: ['in_progress'],
    completed: ['closed'],
    closed: [],
    cancelled: [],
  },
  equipment: {
    ready: ['maintenance', 'unavailable'],
    maintenance: ['ready', 'unavailable'],
    unavailable: ['ready', 'maintenance'],
  },
  ncr: { open: ['awaiting_execution'], awaiting_execution: ['closed'], closed: [] },
  jobwork: { draft: ['open', 'cancelled'], open: ['closed'], closed: [], cancelled: [] },
};
export function initialState(kind: EntityKind): string {
  return ['customer', 'supplier', 'item'].includes(kind)
    ? 'active'
    : kind === 'equipment'
      ? 'ready'
      : kind === 'ncr'
        ? 'open'
        : 'draft';
}
export function assertTransition(kind: EntityKind, from: string, to: string): void {
  if (!transitions[kind][from]?.includes(to))
    throw new DomainError('INVALID_TRANSITION', `${kind}: ${from} cannot become ${to}.`);
}
export function isImmutable(kind: EntityKind, state: string): boolean {
  return kind === 'engineering'
    ? state === 'approved'
    : ['quotation', 'sales_order', 'purchase_order', 'work_order'].includes(kind) &&
        state !== 'draft';
}
