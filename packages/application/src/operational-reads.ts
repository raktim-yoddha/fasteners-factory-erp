import type { EntityKind, Snapshot } from '@fasteners/contracts';
export function recordOptions(
  snapshot: Snapshot,
  kind: EntityKind,
): { id: string; label: string }[] {
  const obligations =
    kind === 'sales_order'
      ? snapshot.operationalOrders
      : kind === 'purchase_order'
        ? snapshot.operationalPurchaseOrders
        : undefined;
  if (obligations)
    return obligations
      .filter((row) =>
        kind === 'sales_order'
          ? ['accepted', 'partially_fulfilled'].includes(row.state)
          : ['open', 'partial_receipt'].includes(row.state),
      )
      .map((row) => ({ id: row.id, label: row.code }));
  return snapshot.records
    .filter(
      (row) =>
        row.kind === kind &&
        (kind === 'sales_order'
          ? ['accepted', 'partially_fulfilled'].includes(row.state)
          : kind === 'purchase_order'
            ? ['open', 'partial_receipt'].includes(row.state)
            : true),
    )
    .map((row) => ({ id: row.id, label: `${row.code} — ${row.name}` }));
}
export function orderLabel(snapshot: Snapshot, id: string): string {
  return (
    snapshot.operationalOrders?.find((row) => row.id === id)?.code ??
    snapshot.records.find((row) => row.kind === 'sales_order' && row.id === id)?.code ??
    'Not in permitted snapshot'
  );
}
