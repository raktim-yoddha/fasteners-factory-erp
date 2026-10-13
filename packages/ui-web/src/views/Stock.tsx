import { recordOptions } from '@fasteners/application';
import { useState } from 'react';
import { Plus, ScanLine } from 'lucide-react';
import type { CommandName, CommandRequest, EntityKind, StockLot } from '@fasteners/contracts';
import { Badge, Button, Dialog, EmptyState, Field, PageHeading, Panel, Table } from '../components';
import { useFactory } from '../context';
import { ActionButton } from '../ActionButton';
type Operation =
  | 'receive'
  | 'inspection'
  | 'reserve'
  | 'transfer'
  | 'issue'
  | 'return'
  | 'consume'
  | 'vendor-out'
  | 'vendor-return';
export function Stock({ filter }: { filter: string }) {
  const { snapshot, run, busy, authority } = useFactory();
  const [operation, setOperation] = useState<Operation | null>(null);
  const [selected, setSelected] = useState<StockLot | null>(null);
  const [values, setValues] = useState<Record<string, string>>({
    quantity: '1',
    location: 'Stores A',
    supplierReference: '',
    lower: '0',
    upper: '2',
    readings: '1',
    loss: '0',
    reason: '',
  });
  const [scan, setScan] = useState('');
  const [scanResult, setScanResult] = useState('');
  const selectedLot = selected ? snapshot.lots.find((lot) => lot.id === selected.id) : undefined;
  function open(value: Operation, lot?: StockLot) {
    setSelected(lot ?? null);
    setOperation(value);
    setValues({
      quantity: '1',
      location: lot?.location ?? 'Stores A',
      supplierReference: '',
      itemId: lot?.itemId ?? '',
      lower: '0',
      upper: '2',
      readings: '1',
      loss: '0',
      reason: '',
    });
  }
  const field = (key: string, label: string, decimal = false) => (
    <Field label={label}>
      <input
        required={key !== 'supplierReference'}
        inputMode={decimal ? 'decimal' : undefined}
        value={values[key] ?? ''}
        onChange={(event) => setValues((previous) => ({ ...previous, [key]: event.target.value }))}
      />
    </Field>
  );
  function select(key: string, label: string, kind: EntityKind, required = true) {
    return (
      <Field label={label}>
        <select
          required={required}
          value={values[key] ?? ''}
          onChange={(event) =>
            setValues((previous) => ({ ...previous, [key]: event.target.value }))
          }
        >
          <option value="">Choose {label.toLowerCase()}</option>
          {recordOptions(snapshot, kind).map((record) => (
            <option key={record.id} value={record.id}>
              {record.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    let command: CommandName;
    let payload: CommandRequest['payload'];
    const lotId = selected?.id ?? '';
    switch (operation) {
      case 'receive':
        command = 'receive_goods';
        payload = {
          itemId: values.itemId ?? '',
          quantity: values.quantity ?? '',
          location: values.location ?? '',
          supplierReference: values.supplierReference ?? '',
          ...(values.purchaseOrderId ? { purchaseOrderId: values.purchaseOrderId } : {}),
        };
        break;
      case 'inspection':
        command = 'record_inspection';
        payload = {
          lotId,
          lower: values.lower ?? '',
          upper: values.upper ?? '',
          readings: (values.readings ?? '').split(',').map((value) => value.trim()),
          unit: selected?.unit ?? '',
        };
        break;
      case 'reserve':
        command = 'reserve_stock';
        payload = { lotId, orderId: values.orderId ?? '', quantity: values.quantity ?? '' };
        break;
      case 'transfer':
        command = 'transfer_stock';
        payload = { lotId, quantity: values.quantity ?? '', location: values.location ?? '' };
        break;
      case 'issue':
      case 'return':
      case 'consume':
        command =
          operation === 'issue'
            ? 'issue_material'
            : operation === 'return'
              ? 'return_material'
              : 'consume_material';
        payload = { lotId, workOrderId: values.workOrderId ?? '', quantity: values.quantity ?? '' };
        break;
      case 'vendor-out':
        command = 'send_jobwork';
        payload = { lotId, supplierId: values.supplierId ?? '', quantity: values.quantity ?? '' };
        break;
      case 'vendor-return':
        command = 'receive_jobwork';
        payload = {
          lotId,
          supplierId: values.supplierId ?? '',
          quantity: values.quantity ?? '',
          loss: values.loss ?? '0',
          reason: values.reason ?? '',
        };
        break;
      default:
        return;
    }
    if (await run(command, payload as never, selectedLot?.revision)) setOperation(null);
  }
  const lots = snapshot.lots.filter((lot) =>
    `${lot.code} ${lot.itemName} ${lot.location}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="STOCK & CUSTODY"
        title="Every lot. Every movement."
        description="Append-only ledger balances. Reservations do not change physical stock."
        action={
          <ActionButton command="receive_goods" onClick={() => open('receive')}>
            <Plus size={16} /> Receive goods
          </ActionButton>
        }
      />
      <Panel className="scan-bar">
        <ScanLine size={20} />
        <Field label="Exact lot code / scanner input">
          <input
            value={scan}
            onChange={(event) => setScan(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                const lot = snapshot.lots.find(
                  (row) => row.code === scan.trim() || row.id === scan.trim(),
                );
                setScanResult(
                  lot
                    ? `${lot.code}: ${lot.onHand} ${lot.unit}, ${lot.qcState}`
                    : 'No exact match in the loaded workspace.',
                );
                if (lot) setSelected(lot);
              }
            }}
            placeholder="Scan LOT-00001 and press Enter"
          />
        </Field>
        <span role="status">{scanResult}</span>
      </Panel>
      <Panel>
        {lots.length ? (
          <Table
            headers={[
              'Lot / item',
              'Location',
              'On hand',
              'Reserved',
              'Available',
              'WIP / vendor',
              'QC',
              'Actions',
            ]}
          >
            {lots.map((lot) => (
              <tr key={lot.id}>
                <td>
                  <strong className="mono">{lot.code}</strong>
                  <small>{lot.itemName}</small>
                </td>
                <td>{lot.location}</td>
                <td className="mono">
                  {lot.onHand} {lot.unit}
                </td>
                <td className="mono">{lot.reserved}</td>
                <td className="mono">{lot.available}</td>
                <td className="mono">
                  {lot.wip} / {lot.vendor}
                </td>
                <td>
                  <Badge tone={lot.qcState === 'held' ? 'warning' : 'success'}>
                    {lot.qcState === 'held' ? 'QC hold' : 'Released'}
                  </Badge>
                </td>
                <td>
                  <Button variant="ghost" onClick={() => setSelected(lot)}>
                    Manage lot
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState
            title="No recorded stock"
            description="Receive actual quantities. New lots enter QC hold automatically."
          />
        )}
      </Panel>
      {selectedLot ? (
        <Panel className="detail-panel">
          <div className="panel-heading">
            <h2>
              {selectedLot.code} · {selectedLot.itemName}
            </h2>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <p>
            {selectedLot.onHand} {selectedLot.unit} in stores · {selectedLot.wip} in WIP ·{' '}
            {selectedLot.vendor} at vendor
          </p>
          <div className="action-row">
            <ActionButton
              command="record_inspection"
              variant="secondary"
              onClick={() => open('inspection', selectedLot)}
            >
              Record inspection
            </ActionButton>
            <ActionButton
              command="release_lot"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run('release_lot', { lotId: selectedLot.id }, selectedLot.revision)
              }
            >
              {authority.kind === 'solo'
                ? 'Release / owner attestation'
                : 'Release after independent review'}
            </ActionButton>
            <ActionButton
              command="hold_lot"
              variant="danger"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt('Reason for QC containment');
                if (reason)
                  void run('hold_lot', { lotId: selectedLot.id, reason }, selectedLot.revision);
              }}
            >
              Place hold
            </ActionButton>
            <ActionButton
              command="reserve_stock"
              variant="secondary"
              onClick={() => open('reserve', selectedLot)}
            >
              Reserve
            </ActionButton>
            <ActionButton
              command="transfer_stock"
              variant="secondary"
              onClick={() => open('transfer', selectedLot)}
            >
              Transfer
            </ActionButton>
            <ActionButton
              command="issue_material"
              variant="secondary"
              onClick={() => open('issue', selectedLot)}
            >
              Issue to work
            </ActionButton>
            <ActionButton
              command="return_material"
              variant="secondary"
              onClick={() => open('return', selectedLot)}
            >
              Return material
            </ActionButton>
            <ActionButton
              command="consume_material"
              variant="secondary"
              onClick={() => open('consume', selectedLot)}
            >
              Consume material
            </ActionButton>
            <ActionButton
              command="send_jobwork"
              variant="secondary"
              onClick={() => open('vendor-out', selectedLot)}
            >
              Send to vendor
            </ActionButton>
            <ActionButton
              command="receive_jobwork"
              variant="secondary"
              onClick={() => open('vendor-return', selectedLot)}
            >
              Vendor return
            </ActionButton>
          </div>
          <p className="notice">
            Release requires a current passed inspection. A new hold invalidates previous release
            evidence. Transfers and returns create held destination lots.
          </p>
        </Panel>
      ) : null}
      {operation ? (
        <Dialog
          title={
            operation === 'receive'
              ? 'Receive goods — held stock'
              : `${operation.replaceAll('-', ' ')} · ${selected?.code ?? ''}`
          }
          onClose={() => setOperation(null)}
        >
          <form onSubmit={(event) => void submit(event)} className="form-grid">
            {operation === 'receive' ? (
              <>
                {select('itemId', 'Item', 'item')}
                {select('purchaseOrderId', 'Purchase order (optional)', 'purchase_order', false)}
                {field('supplierReference', 'Supplier lot / certificate reference')}
              </>
            ) : null}
            {operation === 'inspection' ? (
              <>
                {field('lower', 'Lower limit', true)}
                {field('upper', 'Upper limit', true)}
                {field('readings', `Readings in ${selected?.unit}, comma-separated`)}
                <p className="notice">
                  Initial numeric inspection model. Authority evaluates readings; full approved
                  inspection plans remain pending.
                </p>
              </>
            ) : (
              <>{field('quantity', `Quantity (${selected?.unit ?? 'item base unit'})`, true)}</>
            )}
            {['receive', 'transfer'].includes(operation) ? field('location', 'Location') : null}
            {operation === 'reserve'
              ? select('orderId', 'Accepted sales order', 'sales_order')
              : null}
            {['issue', 'return', 'consume'].includes(operation)
              ? select('workOrderId', 'Work order', 'work_order')
              : null}
            {['vendor-out', 'vendor-return'].includes(operation)
              ? select('supplierId', 'Supplier', 'supplier')
              : null}
            {operation === 'vendor-return' ? (
              <>
                {field('loss', 'Authorized loss', true)}
                {field('reason', 'Return / loss reason')}
              </>
            ) : null}
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setOperation(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Committing…' : 'Commit operation'}
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
